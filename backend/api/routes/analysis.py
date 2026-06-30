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
        for json_field, parsed_key in [("key_features_json", "key_features"), ("feature_importance_json", "feature_importance")]:
            if isinstance(f.get(json_field), str):
                try:
                    f[parsed_key] = json.loads(f[json_field])
                except Exception:
                    f[parsed_key] = []

    # Derive urgency from stored value or from max BI-RADS as fallback
    urgency = case.get("overall_case_urgency") or "routine"
    if urgency not in ("urgent", "concerning", "routine"):
        max_birads = max((f.get("bi_rads_suggestion", 1) for f in findings), default=1)
        urgency = "urgent" if max_birads >= 5 else "concerning" if max_birads >= 4 else "routine"

    return {
        "case_id":                  case_id,
        # Study-level AI output
        "density_category":         case.get("density_category"),
        "density_confidence":       case.get("density_confidence"),
        "overall_birads":           case.get("overall_birads"),
        "overall_impression":       case.get("overall_impression"),
        "recommended_management":   case.get("recommended_management"),
        "bilateral_symmetry":       case.get("bilateral_symmetry"),
        "asymmetry_detected":       case.get("asymmetry_detected"),
        "lymph_node_abnormal":      case.get("lymph_node_abnormal"),
        "skin_changes_detected":    case.get("skin_changes_detected"),
        "nipple_changes":           case.get("nipple_changes"),
        "edema_detected":           case.get("edema_detected"),
        # AI provenance
        "ai_provider":              case.get("ai_provider", "mock"),
        "ai_model":                 case.get("ai_model"),
        "is_mock":                  bool(case.get("is_mock", True)),
        # Urgency
        "overall_urgency":          urgency,
        # Findings
        "findings":                 findings,
        "finding_count":            len(findings),
        "preprocessed_image":       case.get("preprocessed_image_path"),
    }
