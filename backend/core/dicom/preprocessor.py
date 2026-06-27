import pydicom
import numpy as np
from PIL import Image
from pathlib import Path

def preprocess(dicom_path: str, output_dir: str) -> str:
    """
    Loads DICOM, normalizes pixel values, saves as PNG.
    Returns path to saved PNG file.
    """
    dcm = pydicom.dcmread(dicom_path)
    pixels = dcm.pixel_array.astype(np.float32)

    pixels = _normalize(pixels)
    pixels = _apply_windowing(dcm, pixels)

    output_path = str(Path(output_dir) / "preprocessed.png")
    Image.fromarray(pixels.astype(np.uint8)).save(output_path)

    return output_path

def _normalize(pixels: np.ndarray) -> np.ndarray:
    """Normalize pixel values to 0-255 range."""
    pmin, pmax = pixels.min(), pixels.max()
    if pmax == pmin:
        return np.zeros_like(pixels)
    return ((pixels - pmin) / (pmax - pmin) * 255)

def _apply_windowing(dcm, pixels: np.ndarray) -> np.ndarray:
    """Apply DICOM window center/width if available."""
    try:
        wc = float(dcm.WindowCenter)
        ww = float(dcm.WindowWidth)
        lower = wc - ww / 2
        upper = wc + ww / 2
        pixels = np.clip(pixels, lower, upper)
        pixels = _normalize(pixels)
    except Exception:
        pass
    return pixels
