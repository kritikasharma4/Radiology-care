import base64
import json
from pathlib import Path
import anthropic

SYSTEM_PROMPT = """You are a board-certified radiologist specializing in breast imaging with 20+ years of experience interpreting mammograms and digital breast tomosynthesis (DBT) studies. You follow ACR BI-RADS 5th Edition standards strictly.

Your task is to analyze mammogram images and extract structured clinical findings in JSON format.

STRICT RULES:
1. Only describe findings that are actually visible in the image — do not infer or invent
2. Use only ACR BI-RADS lexicon terminology for all descriptors
3. Reflect genuine uncertainty in confidence_score values (0.5-0.6 = uncertain, 0.9+ = highly confident)
4. Size estimates are approximate — mammograms lack calibration markers unless a reference scale is visible
5. If the image quality is insufficient to assess a region, state this in overall_impression
6. This output will be reviewed and signed off by a qualified radiologist before any clinical action is taken

Respond ONLY with valid JSON — no markdown, no preamble, no explanation."""

_JSON_SCHEMA = """{
  "density_category": "A" | "B" | "C" | "D",
  "density_confidence": <0.0-1.0>,
  "overall_birads": <0-6>,
  "overall_impression": "<one concise sentence clinical summary>",
  "recommended_management": "routine_screening" | "short_interval_followup" | "additional_imaging" | "tissue_sampling" | "urgent_tissue_sampling",
  "bilateral_symmetry": <true|false>,
  "asymmetry_detected": <true|false>,
  "skin_changes": <true|false>,
  "nipple_changes": <true|false>,
  "lymph_node_status": "normal" | "abnormal" | "not_visualized",
  "edema_detected": <true|false>,
  "findings": [
    {
      "finding_type": "mass" | "calcification" | "asymmetry" | "architectural_distortion" | "lymph_node",
      "breast_side": "L" | "R" | "bilateral",
      "clock_position": <1-12>,
      "quadrant": "UOQ" | "UIQ" | "LOQ" | "LIQ" | "central" | "subareolar",
      "depth": "anterior" | "middle" | "posterior",
      "distance_from_nipple_mm": <number or null>,
      "size_length_mm": <number or null>,
      "size_width_mm": <number or null>,
      "shape": "round" | "oval" | "irregular" | null,
      "margin_type": "circumscribed" | "obscured" | "microlobulated" | "indistinct" | "spiculated" | null,
      "density_level": "high" | "equal" | "low" | "fat_containing" | null,
      "calcification_morphology": "typically_benign" | "amorphous" | "coarse_heterogeneous" | "fine_pleomorphic" | "fine_linear" | null,
      "calcification_distribution": "diffuse" | "regional" | "grouped" | "linear" | "segmental" | null,
      "malignancy_probability": <0.0-1.0>,
      "confidence_score": <0.0-1.0>,
      "bi_rads_suggestion": <2-6>,
      "recommended_action": "<specific clinical action>",
      "key_features": ["<feature1>", "<feature2>"],
      "ai_reasoning": "<2-3 sentences explaining why this was flagged and the BI-RADS rationale>",
      "differential_diagnosis": [
        {
          "diagnosis": "<e.g. Invasive Ductal Carcinoma>",
          "probability": <0.0-1.0, top 3-4 differentials summing to ~1.0>,
          "evidence": "<key imaging features supporting this differential>"
        }
      ],
      "bbox": {
        "x": <0.0-1.0, left edge of finding as fraction of image width>,
        "y": <0.0-1.0, top edge of finding as fraction of image height>,
        "w": <0.0-1.0, width of finding as fraction of image width>,
        "h": <0.0-1.0, height of finding as fraction of image height>
      }
    }
  ]
}"""


def _format_cv_context(cv: dict | None) -> str:
    if not cv or not cv.get("is_real_cv"):
        return ""
    lines = [
        "=== COMPUTER VISION PRE-ANALYSIS (read carefully — use as primary signal) ===",
        f"Model: {cv.get('cv_model', 'unknown')}",
        f"Description: {cv.get('cv_model_description', '')}",
    ]
    if cv.get("suspicion_score") is not None:
        score = cv["suspicion_score"]
        level = "HIGH" if score >= 0.65 else "MODERATE" if score >= 0.35 else "LOW"
        lines.append(f"Suspicion score: {score:.2f} ({level}) — weight this heavily in your BI-RADS assessment")
    if cv.get("density_class"):
        lines.append(f"Density estimate: ACR {cv['density_class']}")
    regions = cv.get("suspicious_regions", [])
    if regions:
        lines.append(f"Suspicious regions detected: {len(regions)}")
        for i, r in enumerate(regions[:3], 1):
            lines.append(
                f"  Region {i}: x={r['x']:.2f} y={r['y']:.2f} w={r['w']:.2f} h={r['h']:.2f}"
                + (f" intensity={r.get('mean_intensity', ''):.2f}" if r.get('mean_intensity') else "")
            )
        lines.append("  → Use these coordinates as a strong hint for bbox placement in your findings.")
    else:
        lines.append("Suspicious regions: none detected by CV model")
    lines.append("=== END CV PRE-ANALYSIS ===\n")
    return "\n".join(lines) + "\n"


class ClaudeClient:
    def __init__(self, api_key: str):
        self.client        = anthropic.Anthropic(api_key=api_key)
        self.routine_model = "claude-sonnet-4-6"
        self.urgent_model  = "claude-opus-4-8"

    def analyze_mammogram(self, image_paths: list, patient_context: dict, urgency_hint: str = "concerning", cv_result: dict = None, rag_context: str = None, confirmed_abnormal: bool = False) -> dict:
        model = self.urgent_model if urgency_hint in ("urgent", "concerning") else self.routine_model

        content = []

        # Attach images
        for i, img_path in enumerate(image_paths, start=1):
            try:
                img_bytes = Path(img_path).read_bytes()
                img_b64   = base64.standard_b64encode(img_bytes).decode()
                content.append({
                    "type": "image",
                    "source": {
                        "type":       "base64",
                        "media_type": "image/jpeg",
                        "data":       img_b64,
                    },
                })
                if len(image_paths) > 1:
                    labels = {1: "first (superficial)", len(image_paths)//2 + 1: "middle", len(image_paths): "last (deep)"}
                    label  = labels.get(i, f"slice {i}")
                    content.append({"type": "text", "text": f"[Image {i}/{len(image_paths)}: {label} slice]"})
            except Exception:
                pass  # skip unreadable images — model still sees the rest

        content.append({"type": "text", "text": self._build_prompt(patient_context, len(image_paths), cv_result, rag_context)})

        response = self.client.messages.create(
            model=model,
            max_tokens=4096,
            system=SYSTEM_PROMPT,
            messages=[{"role": "user", "content": content}],
        )

        raw = response.content[0].text.strip()

        # Strip markdown code fences if the model wraps output despite instructions
        if raw.startswith("```"):
            lines = raw.split("\n")
            raw   = "\n".join(lines[1:-1]) if lines[-1].startswith("```") else "\n".join(lines[1:])

        result = json.loads(raw)
        result["ai_provider"] = "claude"
        result["ai_model"]    = model
        result["is_mock"]     = False
        result["mock_reason"] = None
        result["findings"]    = self._normalize_findings(result.get("findings", []))
        return result

    # ── private helpers ──────────────────────────────────────────────────────

    def _build_prompt(self, ctx: dict, n_images: int, cv_result: dict = None, rag_context: str = None) -> str:
        symptoms = [s for s, flag in [
            ("palpable lump",      ctx.get("reported_lump")),
            ("breast pain",        ctx.get("reported_pain")),
            ("nipple discharge",   ctx.get("reported_nipple_discharge")),
        ] if flag]

        image_note = (
            f"{n_images} images from a Digital Breast Tomosynthesis (3D) study: first, middle, and last slices."
            if n_images > 1 else
            "Single 2D mammogram image."
        )

        cv_section = _format_cv_context(cv_result)

        rag_section = ""
        if rag_context:
            rag_section = (
                "=== ACR BI-RADS CLINICAL REFERENCE MATERIAL ===\n"
                "(Retrieved from knowledge base — use these definitions when justifying BI-RADS categories, "
                "margin descriptors, and management recommendations in your response)\n\n"
                f"{rag_context}\n"
                "=== END CLINICAL REFERENCE MATERIAL ===\n\n"
            )

        return f"""Analyze {'these mammogram images' if n_images > 1 else 'this mammogram image'} and extract all clinical findings.

{cv_section}{rag_section}Patient context:
- Age: {ctx.get('age') or 'unknown'}
- Family history of breast cancer: {'Yes' if ctx.get('family_history') else 'unknown'}
- Menopause status: {ctx.get('menopause_status') or 'unknown'}
- BRCA status: {ctx.get('brca_mutation') or 'unknown'}
- Reported symptoms: {', '.join(symptoms) if symptoms else 'unknown'}

Imaging: {image_note}

Respond ONLY with JSON matching this exact schema:

{_JSON_SCHEMA}"""

    def _normalize_findings(self, findings: list) -> list:
        """Map LLM field names to DB column names and fill defaults."""
        out = []
        for f in findings:
            out.append({
                "finding_type":               f.get("finding_type", "mass"),
                "breast_side":                f.get("breast_side", "L"),
                "clock_position":             f.get("clock_position"),
                "quadrant":                   f.get("quadrant"),
                "depth":                      f.get("depth"),
                "distance_from_nipple_mm":    f.get("distance_from_nipple_mm"),
                "size_length_mm":             f.get("size_length_mm"),
                "size_width_mm":              f.get("size_width_mm"),
                "size_area_mm2":              None,
                "shape":                      f.get("shape"),
                "margin_type":                f.get("margin_type"),
                "density_level":              f.get("density_level"),
                "calcification_morphology":   f.get("calcification_morphology"),
                "calcification_distribution": f.get("calcification_distribution"),
                "malignancy_probability":     f.get("malignancy_probability", 0.5),
                "confidence_score":           f.get("confidence_score", 0.5),
                "bi_rads_suggestion":         f.get("bi_rads_suggestion", 3),
                "recommended_action":         f.get("recommended_action", ""),
                "model_1_confidence":         f.get("confidence_score", 0.5),
                "model_2_confidence":         None,
                "model_3_confidence":         None,
                "ensemble_agreement":         "1/1",
                "key_features_json":              json.dumps(f.get("key_features", [])),
                "feature_importance_json":        json.dumps([]),
                "ai_reasoning":                   f.get("ai_reasoning", ""),
                "differential_diagnosis_json":    json.dumps(f.get("differential_diagnosis", [])),
                "bbox_json":                      json.dumps(f["bbox"]) if isinstance(f.get("bbox"), dict) else None,
            })
        return out
