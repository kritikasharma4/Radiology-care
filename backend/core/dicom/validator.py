import pydicom
from pathlib import Path

ALLOWED_MODALITIES = ["MG"]  # MG = Mammography

def validate_dicom(file_path: str) -> dict:
    """
    Validates uploaded DICOM file.
    Returns validation result with extracted metadata.
    """
    try:
        dcm = pydicom.dcmread(file_path)

        # Check it has pixel data
        if not hasattr(dcm, "PixelData"):
            return {"valid": False, "error": "No image data found in DICOM file"}

        return {
            "valid": True,
            "modality": getattr(dcm, "Modality", "Unknown"),
            "patient_name": str(getattr(dcm, "PatientName", "Unknown")),
            "patient_id": str(getattr(dcm, "PatientID", "Unknown")),
            "study_date": str(getattr(dcm, "StudyDate", "")),
            "view_position": str(getattr(dcm, "ViewPosition", "")),
            "laterality": str(getattr(dcm, "ImageLaterality", "")),
            "rows": int(getattr(dcm, "Rows", 0)),
            "columns": int(getattr(dcm, "Columns", 0)),
        }

    except Exception as e:
        return {"valid": False, "error": str(e)}
