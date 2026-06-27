import pydicom
from datetime import datetime

def parse_metadata(file_path: str) -> dict:
    """
    Extracts all relevant metadata from DICOM file.
    Returns structured patient + study + image metadata.
    """
    dcm = pydicom.dcmread(file_path)

    raw_date = str(getattr(dcm, "StudyDate", ""))
    study_date = _parse_date(raw_date)

    dob = str(getattr(dcm, "PatientBirthDate", ""))
    age = _calculate_age(dob) if dob else getattr(dcm, "PatientAge", None)

    return {
        # Patient
        "patient_name": str(getattr(dcm, "PatientName", "Unknown")),
        "patient_id":   str(getattr(dcm, "PatientID", "Unknown")),
        "age":          age,
        "sex":          str(getattr(dcm, "PatientSex", "Unknown")),

        # Study
        "study_date":   study_date,
        "study_id":     str(getattr(dcm, "StudyID", "")),
        "institution":  str(getattr(dcm, "InstitutionName", "")),

        # Image
        "view_position": str(getattr(dcm, "ViewPosition", "")),
        "laterality":    str(getattr(dcm, "ImageLaterality", "")),
        "rows":          int(getattr(dcm, "Rows", 0)),
        "columns":       int(getattr(dcm, "Columns", 0)),
    }

def _parse_date(raw: str) -> str:
    """Convert DICOM date YYYYMMDD to readable YYYY-MM-DD."""
    try:
        return datetime.strptime(raw, "%Y%m%d").strftime("%Y-%m-%d")
    except Exception:
        return raw

def _calculate_age(dob: str) -> int:
    """Calculate age from date of birth string."""
    try:
        birth = datetime.strptime(dob, "%Y%m%d")
        today = datetime.today()
        return today.year - birth.year - (
            (today.month, today.day) < (birth.month, birth.day)
        )
    except Exception:
        return None
