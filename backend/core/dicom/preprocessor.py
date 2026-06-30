import pydicom
import numpy as np
from PIL import Image
from pathlib import Path


def preprocess(dicom_path: str, output_dir: str) -> str:
    """Single-frame convenience wrapper — keeps backward compatibility."""
    return extract_frames(dicom_path, output_dir, n_frames=1)[0]


def extract_frames(dicom_path: str, output_dir: str, n_frames: int = 5) -> list:
    """
    Extract up to n_frames evenly-spaced frames from any DICOM file.
    - Single-frame 2D mammogram  → returns 1 path
    - Multi-frame tomosynthesis  → returns up to n_frames paths
    Always returns a non-empty list of absolute PNG paths.
    """
    dcm = pydicom.dcmread(dicom_path)
    pixels = dcm.pixel_array.astype(np.float32)
    wc, ww = _get_window(dcm)

    out_dir = Path(output_dir)
    out_dir.mkdir(parents=True, exist_ok=True)

    # Single frame (2D mammogram)
    if pixels.ndim == 2:
        path = str(out_dir / "frame_0000.png")
        Image.fromarray(_process_frame(pixels, wc, ww)).save(path)
        return [path]

    # Multi-frame tomosynthesis — shape (N, H, W) or (N, H, W, C)
    total = pixels.shape[0]
    indices = _pick_indices(total, min(n_frames, total))

    paths = []
    for i, idx in enumerate(indices):
        frame = pixels[idx]
        if frame.ndim == 3:
            frame = frame[:, :, 0]
        path = str(out_dir / f"frame_{i:04d}.png")
        Image.fromarray(_process_frame(frame, wc, ww)).save(path)
        paths.append(path)
    return paths


def is_multiframe(dicom_path: str) -> bool:
    """Return True if DICOM contains more than one frame (tomosynthesis)."""
    try:
        dcm = pydicom.dcmread(dicom_path, stop_before_pixels=True)
        return int(getattr(dcm, "NumberOfFrames", 1)) > 1
    except Exception:
        return False


def get_frame_count(dicom_path: str) -> int:
    try:
        dcm = pydicom.dcmread(dicom_path, stop_before_pixels=True)
        return int(getattr(dcm, "NumberOfFrames", 1))
    except Exception:
        return 1


def detect_series_type_from_dicom(dicom_path: str) -> str:
    """Detect mammogram series type from DICOM tags."""
    try:
        dcm = pydicom.dcmread(dicom_path, stop_before_pixels=True)
        if int(getattr(dcm, "NumberOfFrames", 1)) > 1:
            return "tomosynthesis"
        desc = str(getattr(dcm, "SeriesDescription", "")).lower()
        if any(k in desc for k in ("tomo", "3d", "dbt")):
            return "tomosynthesis"
        return "2d"
    except Exception:
        return "2d"


# ── internal helpers ──────────────────────────────────────────────────────────

def _get_window(dcm):
    """Extract WindowCenter/Width, handling MultiValue sequences."""
    try:
        wc_raw = dcm.WindowCenter
        ww_raw = dcm.WindowWidth
        wc = float(wc_raw[0] if hasattr(wc_raw, "__iter__") and not isinstance(wc_raw, str) else wc_raw)
        ww = float(ww_raw[0] if hasattr(ww_raw, "__iter__") and not isinstance(ww_raw, str) else ww_raw)
        return wc, ww
    except Exception:
        return None, None


def _process_frame(frame: np.ndarray, wc, ww) -> np.ndarray:
    if wc is not None and ww is not None:
        frame = np.clip(frame, wc - ww / 2, wc + ww / 2)
    return _normalize(frame).astype(np.uint8)


def _normalize(pixels: np.ndarray) -> np.ndarray:
    pmin, pmax = pixels.min(), pixels.max()
    if pmax == pmin:
        return np.zeros_like(pixels)
    return (pixels - pmin) / (pmax - pmin) * 255


def _pick_indices(n: int, k: int) -> list:
    if k >= n:
        return list(range(n))
    return sorted({
        max(0, int(n * 0.10)),
        max(0, int(n * 0.25)),
        n // 2,
        min(n - 1, int(n * 0.75)),
        min(n - 1, int(n * 0.90)),
    })


def _apply_windowing(dcm, pixels: np.ndarray) -> np.ndarray:
    """Kept for backward compatibility."""
    wc, ww = _get_window(dcm)
    if wc is not None and ww is not None:
        pixels = np.clip(pixels, wc - ww / 2, wc + ww / 2)
        pixels = _normalize(pixels)
    return pixels
