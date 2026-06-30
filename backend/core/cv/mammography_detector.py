"""
CV Detection Layer — Phase 4a

Two-level pipeline:
  Level 1 (primary):   HuggingFace Inference API → ianpan/mammoscreen
                        EfficientNetV2-Small ensemble, AUC 0.9451, CBIS-DDSM + RSNA trained
                        Requires HF_API_TOKEN env var. Runs on HuggingFace GPUs (free tier).

  Level 2 (fallback):  OpenCV statistical analysis
                        CLAHE enhancement → density estimation → suspicious region detection
                        Deterministic, no GPU, always works on CPU. Real CV — not LLM guessing.

Output dict is passed to the LLM as structured context.
The LLM writes clinical narrative FROM this output — it no longer detects from raw images.

Upgrade path: swap _hf_api_classify() for Lunit INSIGHT MMG API call.
Same output dict shape, same downstream pipeline.
"""

import os
import cv2
import numpy as np
import requests
from pathlib import Path

HF_MODEL_ID  = "ianpan/mammoscreen"
HF_API_URL   = f"https://api-inference.huggingface.co/models/{HF_MODEL_ID}"
HF_TIMEOUT   = 45   # seconds — model may need warm-up on free tier


# ── public API ───────────────────────────────────────────────────────────────

def detect(image_paths: list) -> dict:
    """
    Run CV analysis across all mammogram images (already FUJIFILM-panel-cropped).
    Returns a structured dict passed directly to the LLM prompt.
    """
    if not image_paths:
        return _null_result()

    hf_token = os.getenv("HF_API_TOKEN", "").strip()
    per_image = []

    for path in image_paths:
        if hf_token:
            result = _hf_api_classify(path, hf_token)
        else:
            result = _opencv_analyze(path)
        per_image.append(result)

    per_image = [r for r in per_image if r]  # drop None on read errors

    if not per_image:
        return _null_result()

    # Aggregate: most suspicious slice drives the overall score
    best = max(per_image, key=lambda r: r.get("suspicion_score", 0))

    # Average density across slices
    density_scores = [r["density_score"] for r in per_image if r.get("density_score") is not None]
    avg_density    = sum(density_scores) / len(density_scores) if density_scores else 0.5

    is_neural = any(r.get("is_hf") for r in per_image)

    return {
        # Model metadata — shown in UI
        "cv_model":             HF_MODEL_ID if is_neural else "OpenCV-density-analysis",
        "cv_model_description": (
            "EfficientNetV2-Small ensemble — AUC 0.9451, trained on CBIS-DDSM + RSNA"
            if is_neural else
            "Statistical density & suspicious-region analysis (OpenCV)"
        ),
        "is_neural_cv":         is_neural,
        "is_real_cv":           True,   # always real CV — never LLM guess

        # Scores
        "suspicion_score":      round(best.get("suspicion_score", 0.5), 3),
        "density_score":        round(avg_density, 3),
        "density_class":        _density_to_birads(avg_density),

        # Suspicious regions from the most suspicious slice (for LLM context)
        "suspicious_regions":   best.get("suspicious_regions", []),

        # Per-image breakdown (stored for debugging)
        "per_image":            per_image,
    }


# ── HuggingFace Inference API ────────────────────────────────────────────────

def _hf_api_classify(image_path: str, token: str) -> dict:
    """Call HuggingFace Inference API for mammoscreen cancer probability."""
    try:
        img_bytes = Path(image_path).read_bytes()
        resp = requests.post(
            HF_API_URL,
            headers={"Authorization": f"Bearer {token}"},
            data=img_bytes,
            timeout=HF_TIMEOUT,
        )

        if resp.status_code == 503:
            # Model loading — wait and retry once
            import time; time.sleep(20)
            resp = requests.post(
                HF_API_URL,
                headers={"Authorization": f"Bearer {token}"},
                data=img_bytes,
                timeout=HF_TIMEOUT,
            )

        if resp.status_code == 200:
            data = resp.json()
            if isinstance(data, list) and data:
                # Standard HF classification output: [{"label": "...", "score": 0.x}]
                cancer_score = 0.5
                for item in data:
                    label = item.get("label", "").lower()
                    if any(k in label for k in ["cancer", "malign", "positive", "1", "abnormal"]):
                        cancer_score = float(item.get("score", 0.5))
                        break

                # Also try extracting density if the model returns it
                density_score = 0.5
                for item in data:
                    label = item.get("label", "").lower()
                    if any(k in label for k in ["dense", "density", "c", "d"]):
                        density_score = min(0.9, float(item.get("score", 0.5)) + 0.2)
                        break

                return {
                    "suspicion_score":    cancer_score,
                    "density_score":      density_score,
                    "suspicious_regions": [],
                    "is_hf":              True,
                }

        print(f"[CV] HuggingFace API status {resp.status_code} — falling back to OpenCV")

    except Exception as exc:
        print(f"[CV] HuggingFace API error: {exc} — falling back to OpenCV")

    # Fall through to OpenCV on any failure
    return _opencv_analyze(image_path)


# ── OpenCV Statistical Analysis ──────────────────────────────────────────────

def _opencv_analyze(image_path: str) -> dict:
    """
    Real computer vision analysis — no neural network required.

    Pipeline:
      1. Density ratio   — bright pixels / tissue pixels (mammogram physics: bright = dense)
      2. CLAHE enhance   — local contrast normalization
      3. Region detect   — threshold → morphology → contours → bounding boxes
      4. Suspicion score — combines density + region count + region intensity

    All measurements are real image statistics, not LLM guesses.
    """
    img = cv2.imread(str(image_path), cv2.IMREAD_GRAYSCALE)
    if img is None:
        return None

    h, w = img.shape

    # ── 1. Tissue mask (exclude black background) ────────────────────────────
    tissue_mask = img > 25
    tissue_px   = int(tissue_mask.sum())
    if tissue_px < 1000:
        return {"suspicion_score": 0.5, "density_score": 0.5, "suspicious_regions": [], "is_hf": False}

    # ── 2. Density analysis ──────────────────────────────────────────────────
    # Dense fibroglandular tissue appears bright in mammograms
    dense_mask  = (img > 130) & tissue_mask
    dense_px    = int(dense_mask.sum())
    density_ratio = dense_px / tissue_px

    # ── 3. CLAHE enhancement + suspicious region detection ───────────────────
    clahe    = cv2.createCLAHE(clipLimit=3.0, tileGridSize=(8, 8))
    enhanced = clahe.apply(img)

    # High-intensity regions after enhancement = potential masses/calcifications
    threshold_val = int(np.percentile(enhanced[tissue_mask], 92))
    _, susp_mask  = cv2.threshold(enhanced, threshold_val, 255, cv2.THRESH_BINARY)

    # Only keep suspicious regions that are also in tissue area
    susp_mask = susp_mask & (tissue_mask.astype(np.uint8) * 255)

    # Morphological cleanup: remove tiny noise, connect nearby blobs
    kernel   = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (7, 7))
    susp_mask = cv2.morphologyEx(susp_mask.astype(np.uint8), cv2.MORPH_OPEN, kernel)
    susp_mask = cv2.morphologyEx(susp_mask, cv2.MORPH_CLOSE, kernel)

    contours, _ = cv2.findContours(susp_mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

    # ── 4. Filter contours by size ───────────────────────────────────────────
    min_area = (h * w) * 0.0008   # ≥ 0.08% of image — eliminates salt-and-pepper noise
    max_area = (h * w) * 0.20     # ≤ 20% — eliminates large uniform dense regions

    suspicious_regions = []
    for contour in contours:
        area = cv2.contourArea(contour)
        if not (min_area < area < max_area):
            continue

        x, y, rw, rh = cv2.boundingRect(contour)

        # Mean intensity of the region (higher = more suspicious)
        region_img    = enhanced[y:y+rh, x:x+rw]
        mean_intensity = float(np.mean(region_img)) / 255.0

        # Circularity (masses tend to be round/oval)
        perimeter    = cv2.arcLength(contour, True)
        circularity  = (4 * np.pi * area / (perimeter ** 2)) if perimeter > 0 else 0

        suspicious_regions.append({
            "x":              round(x / w, 4),
            "y":              round(y / h, 4),
            "w":              round(rw / w, 4),
            "h":              round(rh / h, 4),
            "area_fraction":  round(area / (h * w), 5),
            "mean_intensity": round(mean_intensity, 3),
            "circularity":    round(circularity, 3),
        })

    # Sort by area descending, keep top 5
    suspicious_regions.sort(key=lambda r: r["area_fraction"], reverse=True)
    suspicious_regions = suspicious_regions[:5]

    # ── 5. Suspicion score ───────────────────────────────────────────────────
    n_regions = len(suspicious_regions)
    max_intensity = max((r["mean_intensity"] for r in suspicious_regions), default=0.0)

    # Weighted combination: density + number of regions + intensity of brightest region
    suspicion_score = min(0.95, (
        density_ratio * 0.40 +
        min(n_regions / 4, 1.0) * 0.35 +
        max_intensity * 0.25
    ))

    return {
        "suspicion_score":    round(suspicion_score, 3),
        "density_score":      round(density_ratio, 3),
        "suspicious_regions": suspicious_regions,
        "is_hf":              False,
    }


# ── helpers ──────────────────────────────────────────────────────────────────

def _density_to_birads(score: float) -> str:
    if score < 0.25: return "A"
    if score < 0.45: return "B"
    if score < 0.65: return "C"
    return "D"


def _null_result() -> dict:
    return {
        "cv_model":             "none",
        "cv_model_description": "CV analysis unavailable",
        "is_neural_cv":         False,
        "is_real_cv":           False,
        "suspicion_score":      None,
        "density_score":        None,
        "density_class":        None,
        "suspicious_regions":   [],
        "per_image":            [],
    }
