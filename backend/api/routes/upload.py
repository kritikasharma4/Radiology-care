import shutil
from pathlib import Path
from fastapi import APIRouter, File, UploadFile, Form, HTTPException

from config import CASES_DIR, BASE_DIR
from core.dicom.validator import validate_dicom
from core.dicom.parser import parse_metadata
from core.dicom.preprocessor import preprocess
from core.quality.assessor import assess
from core.ai.mock_inference import run_inference
from core.clinical.risk_calculator import calculate_risk
from db.repositories.case_repo import create_case, update_case_analysis
from db.repositories.finding_repo import create_finding

router = APIRouter(prefix="/api", tags=["upload"])


@router.post("/upload")
async def upload_dicom(
    file: UploadFile = File(...),
    case_type: str = Form("concerning"),          # routine | concerning | urgent
    patient_name: str = Form(""),
    patient_id: str = Form(""),
    age: int = Form(50),
    sex: str = Form("F"),
    study_date: str = Form(""),
    family_history: bool = Form(False),
    personal_breast_cancer: bool = Form(False),
    brca_mutation: str = Form("unknown"),         # positive | negative | unknown
    menopause_status: str = Form("unknown"),      # pre | peri | post | unknown
    hormone_therapy: bool = Form(False),
    breast_implants: bool = Form(False),
    previous_surgery: bool = Form(False),
    previous_biopsy: bool = Form(False),
    reported_lump: bool = Form(False),
    reported_pain: bool = Form(False),
    reported_nipple_discharge: bool = Form(False),
):
    if not file.filename.lower().endswith(".dcm"):
        raise HTTPException(400, "Only .dcm files are accepted")

    # 1. Save uploaded file to temp location
    import tempfile, os
    with tempfile.NamedTemporaryFile(delete=False, suffix=".dcm") as tmp:
        shutil.copyfileobj(file.file, tmp)
        tmp_path = tmp.name

    try:
        # 2. Validate
        validation = validate_dicom(tmp_path)
        if not validation["valid"]:
            raise HTTPException(400, f"Invalid DICOM: {validation['error']}")

        # 3. Parse metadata from DICOM tags (overrides form fields if present)
        meta = parse_metadata(tmp_path)
        resolved_name = meta.get("patient_name") or patient_name or "Unknown"
        resolved_id   = meta.get("patient_id")   or patient_id   or "DEMO-001"
        resolved_age  = meta.get("age")           or age          or 50
        resolved_date = meta.get("study_date")    or study_date   or ""

        # 4. Create permanent case folder
        case_dir = CASES_DIR / resolved_id
        case_dir.mkdir(parents=True, exist_ok=True)
        dicom_dest = str(case_dir / "original.dcm")
        shutil.copy(tmp_path, dicom_dest)

        # 5. Preprocess (DICOM → PNG)
        preprocessed_abs  = preprocess(dicom_dest, str(case_dir))
        # Store as URL-relative path so frontend can load via /data/...
        preprocessed_path = Path(preprocessed_abs).relative_to(BASE_DIR).as_posix()

        # 6. Quality assessment
        quality = assess(preprocessed_path)

        # 7. Risk calculation
        risk = calculate_risk({
            "age":                  resolved_age,
            "family_history":       family_history,
            "personal_breast_cancer": personal_breast_cancer,
            "brca_mutation":        brca_mutation,
            "menopause_status":     menopause_status,
            "hormone_therapy":      hormone_therapy,
            "previous_biopsy":      previous_biopsy,
        })

        # 8. Mock AI inference
        ai_result = run_inference(case_type)

        # 9. Store case in DB
        case_data = {
            "patient_name":            resolved_name,
            "patient_id":              resolved_id,
            "age":                     resolved_age,
            "sex":                     sex,
            "study_date":              resolved_date,
            "family_history":          family_history,
            "personal_breast_cancer":  personal_breast_cancer,
            "brca_mutation":           brca_mutation,
            "menopause_status":        menopause_status,
            "hormone_therapy":         hormone_therapy,
            "breast_implants":         breast_implants,
            "previous_surgery":        previous_surgery,
            "previous_biopsy":         previous_biopsy,
            "reported_lump":           reported_lump,
            "reported_pain":           reported_pain,
            "reported_nipple_discharge": reported_nipple_discharge,
            "quality_score":           quality["quality_score"],
            "motion_blur_detected":    quality.get("motion_blur_detected", False),
            "over_exposure_detected":  quality.get("over_exposure_detected", False),
            "under_exposure_detected": quality.get("under_exposure_detected", False),
            "image_clipping_detected": quality.get("image_clipping_detected", False),
            "wrong_positioning_detected": quality.get("wrong_positioning_detected", False),
            "labels_covering_tissue":  quality.get("labels_covering_tissue", False),
            "missing_breast_tissue":   quality.get("missing_breast_tissue", False),
            "density_category":        ai_result["density_category"],
            "density_confidence":      ai_result["density_confidence"],
            "asymmetry_detected":      ai_result["asymmetry_detected"],
            "lymph_node_abnormal":     ai_result["lymph_node_abnormal"],
            "skin_changes_detected":   ai_result["skin_changes_detected"],
            "edema_detected":          ai_result["edema_detected"],
            "patient_risk_category":   risk["patient_risk_category"],
            "overall_risk_score":      risk["overall_risk_score"],
            "overall_case_urgency":    case_type,
            "dicom_file_path":         dicom_dest,
            "preprocessed_image_path": preprocessed_path,
            "is_demo_case":            False,
        }
        case_id = create_case(case_data)

        # 10. Store each finding
        saved_findings = []
        for f in ai_result["findings"]:
            fid = create_finding(case_id, f)
            saved_findings.append({**f, "id": fid})

        return {
            "case_id":   case_id,
            "quality":   quality,
            "risk":      risk,
            "ai_result": {**ai_result, "findings": saved_findings},
            "message":   "Case uploaded and analysed successfully",
        }

    finally:
        import os
        os.unlink(tmp_path)
