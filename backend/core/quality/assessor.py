import cv2
import numpy as np

def assess(image_path: str) -> dict:
    """
    Runs quality checks on preprocessed image.
    Returns quality score + individual flags.
    """
    img = cv2.imread(image_path, cv2.IMREAD_GRAYSCALE)

    if img is None:
        return {"quality_score": 0, "error": "Could not read image"}

    flags = {
        "motion_blur_detected":       bool(_check_motion_blur(img)),
        "over_exposure_detected":     bool(_check_over_exposure(img)),
        "under_exposure_detected":    bool(_check_under_exposure(img)),
        "image_clipping_detected":    bool(_check_clipping(img)),
        "wrong_positioning_detected": bool(_check_positioning(img)),
        "labels_covering_tissue":     False,
        "missing_breast_tissue":      bool(_check_missing_tissue(img)),
    }

    penalties = {
        "motion_blur_detected":       15,
        "over_exposure_detected":     20,
        "under_exposure_detected":    20,
        "image_clipping_detected":    15,
        "wrong_positioning_detected": 20,
        "missing_breast_tissue":      10,
    }

    score = 100
    for flag, triggered in flags.items():
        if triggered and flag in penalties:
            score -= penalties[flag]

    return {
        "quality_score": max(score, 0),
        **flags
    }

def _check_motion_blur(img: np.ndarray) -> bool:
    return cv2.Laplacian(img, cv2.CV_64F).var() < 50

def _check_over_exposure(img: np.ndarray) -> bool:
    return (img > 240).sum() > img.size * 0.3

def _check_under_exposure(img: np.ndarray) -> bool:
    return img.mean() < 30

def _check_clipping(img: np.ndarray) -> bool:
    return (img == 0).sum() > img.size * 0.15

def _check_positioning(img: np.ndarray) -> bool:
    non_black = (img > 10).sum()
    return non_black < img.size * 0.2

def _check_missing_tissue(img: np.ndarray) -> bool:
    non_black = (img > 20).sum()
    return non_black < img.size * 0.15
