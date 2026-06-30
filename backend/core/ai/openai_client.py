import base64
import json
from pathlib import Path
from openai import OpenAI

SYSTEM_PROMPT = """You are a board-certified radiologist specializing in breast imaging with 20+ years of experience interpreting mammograms and digital breast tomosynthesis (DBT) studies. You follow ACR BI-RADS 5th Edition standards strictly.

Your task is to analyze mammogram images and extract structured clinical findings in JSON format.

CRITICAL RULES:
1. Use only ACR BI-RADS lexicon terminology for all descriptors.
2. You will often receive single-view (CC only) or unilateral images — this is expected. Analyze what you have and report all visible findings. Do NOT use incomplete views as a reason to return 0 findings.
3. Reflect genuine uncertainty in confidence_score values (0.5-0.6 = uncertain, 0.9+ = highly confident).
4. Size estimates are approximate — mammograms lack calibration markers unless a reference scale is visible.
5. Acknowledge view limitations in overall_impression but still report every suspicious area you see.
6. This output will be reviewed and signed off by a qualified radiologist before any clinical action is taken.

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
    """
    Format CV detection output as a structured block for the LLM prompt.
    LLM uses this as a strong prior — it narrates FROM these scores, not FROM the raw image.
    """
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


class OpenAIClient:
    def __init__(self, api_key: str):
        self.client = OpenAI(api_key=api_key)
        self.model  = "gpt-5.5"

    def analyze_mammogram(self, image_paths: list, patient_context: dict, urgency_hint: str = "concerning", cv_result: dict = None, rag_context: str = None, confirmed_abnormal: bool = False) -> dict:
        content = []

        for i, img_path in enumerate(image_paths, start=1):
            try:
                img_b64 = base64.standard_b64encode(Path(img_path).read_bytes()).decode()
                content.append({
                    "type": "image_url",
                    "image_url": {"url": f"data:image/jpeg;base64,{img_b64}", "detail": "high"},
                })
                if len(image_paths) > 1:
                    labels = {1: "first (superficial)", len(image_paths) // 2 + 1: "middle", len(image_paths): "last (deep)"}
                    label  = labels.get(i, f"slice {i}")
                    content.append({"type": "text", "text": f"[Image {i}/{len(image_paths)}: {label} slice]"})
            except Exception:
                pass

        content.append({"type": "text", "text": self._build_prompt(patient_context, len(image_paths), cv_result, rag_context, confirmed_abnormal)})

        response = self.client.chat.completions.create(
            model=self.model,
            max_completion_tokens=8192,
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user",   "content": content},
            ],
        )

        raw = (response.choices[0].message.content or "").strip()

        if raw.startswith("```"):
            lines = raw.split("\n")
            raw   = "\n".join(lines[1:-1]) if lines[-1].startswith("```") else "\n".join(lines[1:])

        if not raw:
            raise ValueError("OpenAI returned an empty response — possible content filter or token limit hit")

        # Detect content-filter refusals before attempting JSON parse
        _REFUSALS = ("i'm sorry", "i cannot", "i can't", "i am unable", "unable to assist", "cannot assist", "i'm unable")
        if any(raw.lower().startswith(r) for r in _REFUSALS):
            raise ValueError(f"OpenAI content filter blocked this request: {raw[:120]}")

        try:
            result = json.loads(raw)
        except json.JSONDecodeError:
            # Try to extract JSON object if model wrapped it in extra text
            import re
            m = re.search(r'\{.*\}', raw, re.DOTALL)
            if m:
                result = json.loads(m.group())
            else:
                raise ValueError(f"OpenAI response was not valid JSON. First 200 chars: {raw[:200]}")
        result["ai_provider"] = "openai"
        result["ai_model"]    = self.model
        result["is_mock"]     = False
        result["mock_reason"] = None
        result["findings"]    = self._normalize_findings(result.get("findings", []))
        return result

    def _build_prompt(self, ctx: dict, n_images: int, cv_result: dict = None, rag_context: str = None, confirmed_abnormal: bool = False) -> str:
        symptoms = [s for s, flag in [
            ("palpable lump",    ctx.get("reported_lump")),
            ("breast pain",      ctx.get("reported_pain")),
            ("nipple discharge", ctx.get("reported_nipple_discharge")),
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

        if confirmed_abnormal:
            case_instruction = (
                "This is a CONFIRMED ABNORMAL CASE from a known pathology dataset — there IS pathology present. "
                "Look carefully for any masses, calcifications, asymmetries, or architectural distortions even if subtle. "
                "Do NOT return an empty findings list. When in doubt between BI-RADS 1 and 3, prefer 3 — radiologist will downgrade if needed."
            )
        else:
            case_instruction = (
                "This may be a routine screening or diagnostic case. Report findings only if genuinely present. "
                "BI-RADS 1 or 2 is appropriate if the study appears normal. Do not over-report on normal tissue."
            )

        return f"""Analyze {'these mammogram images' if n_images > 1 else 'this mammogram image'} and extract clinical findings.

{case_instruction}

{cv_section}{rag_section}Patient context:
- Age: {ctx.get('age') or 'unknown'}
- Family history of breast cancer: {'Yes' if ctx.get('family_history') else 'unknown'}
- Menopause status: {ctx.get('menopause_status') or 'unknown'}
- BRCA status: {ctx.get('brca_mutation') or 'unknown'}
- Reported symptoms: {', '.join(symptoms) if symptoms else 'none reported'}

Imaging: {image_note}

If this is a single-view or unilateral study, still report every suspicious finding visible. Note view limitations in overall_impression.

Respond ONLY with JSON matching this exact schema:

{_JSON_SCHEMA}"""

    def _normalize_findings(self, findings: list) -> list:
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
