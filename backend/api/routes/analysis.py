import json
from fastapi import APIRouter, HTTPException
from db.repositories.case_repo import get_case
from db.repositories.finding_repo import get_findings_by_case

router = APIRouter(prefix="/api", tags=["analysis"])


@router.get("/analysis/{case_id}")
def get_analysis(case_id: str):
    """
    Returns AI analysis results for a case:
    findings, confidence scores, BI-RADS suggestions, ensemble agreement.
    """
    case = get_case(case_id)
    if not case:
        raise HTTPException(404, f"Case {case_id} not found")

    findings = get_findings_by_case(case_id)

    # Parse JSON fields stored as strings in SQLite
    for f in findings:
        if isinstance(f.get("key_features_json"), str):
            try:
                f["key_features"] = json.loads(f["key_features_json"])
            except Exception:
                f["key_features"] = []
        if isinstance(f.get("feature_importance_json"), str):
            try:
                f["feature_importance"] = json.loads(f["feature_importance_json"])
            except Exception:
                f["feature_importance"] = []

    # Determine overall urgency label
    max_birads = max((f.get("bi_rads_suggestion", 1) for f in findings), default=1)
    urgency = "routine"
    if max_birads >= 5:
        urgency = "urgent"
    elif max_birads >= 4:
        urgency = "concerning"

    return {
        "case_id":          case_id,
        "density_category": case.get("density_category"),
        "density_confidence": case.get("density_confidence"),
        "asymmetry_detected":    case.get("asymmetry_detected"),
        "lymph_node_abnormal":   case.get("lymph_node_abnormal"),
        "skin_changes_detected": case.get("skin_changes_detected"),
        "edema_detected":        case.get("edema_detected"),
        "overall_urgency":  urgency,
        "findings":         findings,
        "finding_count":    len(findings),
        "preprocessed_image": case.get("preprocessed_image_path"),
    }
