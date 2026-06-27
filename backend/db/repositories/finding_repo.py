import uuid
from db.connection import get_connection

def create_finding(case_id: str, data: dict) -> str:
    """Insert a finding for a case. Returns finding_id."""
    finding_id = str(uuid.uuid4())
    conn = get_connection()
    conn.execute('''
        INSERT INTO findings (
            id, case_id,
            finding_type, breast_side, clock_position, quadrant,
            distance_from_nipple_mm,
            size_length_mm, size_width_mm, size_area_mm2,
            margin_type, density_level, shape,
            malignancy_probability, confidence_score,
            bi_rads_suggestion, recommended_action,
            model_1_confidence, model_2_confidence, model_3_confidence,
            ensemble_agreement,
            key_features_json, feature_importance_json,
            radiologist_confirmed_bi_rads, radiologist_notes
        ) VALUES (
            :id, :case_id,
            :finding_type, :breast_side, :clock_position, :quadrant,
            :distance_from_nipple_mm,
            :size_length_mm, :size_width_mm, :size_area_mm2,
            :margin_type, :density_level, :shape,
            :malignancy_probability, :confidence_score,
            :bi_rads_suggestion, :recommended_action,
            :model_1_confidence, :model_2_confidence, :model_3_confidence,
            :ensemble_agreement,
            :key_features_json, :feature_importance_json,
            :radiologist_confirmed_bi_rads, :radiologist_notes
        )
    ''', {
        **data,
        "id": finding_id,
        "case_id": case_id,
        "radiologist_confirmed_bi_rads": data.get("radiologist_confirmed_bi_rads"),
        "radiologist_notes": data.get("radiologist_notes"),
    })
    conn.commit()
    conn.close()
    return finding_id

def get_findings_by_case(case_id: str) -> list:
    """Fetch all findings for a given case."""
    conn = get_connection()
    rows = conn.execute(
        "SELECT * FROM findings WHERE case_id = ? ORDER BY malignancy_probability DESC",
        (case_id,)
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]
