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
            depth, distance_from_nipple_mm,
            size_length_mm, size_width_mm, size_area_mm2,
            margin_type, density_level, shape,
            calcification_morphology, calcification_distribution,
            malignancy_probability, confidence_score,
            bi_rads_suggestion, recommended_action,
            model_1_confidence, model_2_confidence, model_3_confidence,
            ensemble_agreement,
            key_features_json, feature_importance_json,
            ai_reasoning, differential_diagnosis_json, bbox_json
        ) VALUES (
            :id, :case_id,
            :finding_type, :breast_side, :clock_position, :quadrant,
            :depth, :distance_from_nipple_mm,
            :size_length_mm, :size_width_mm, :size_area_mm2,
            :margin_type, :density_level, :shape,
            :calcification_morphology, :calcification_distribution,
            :malignancy_probability, :confidence_score,
            :bi_rads_suggestion, :recommended_action,
            :model_1_confidence, :model_2_confidence, :model_3_confidence,
            :ensemble_agreement,
            :key_features_json, :feature_importance_json,
            :ai_reasoning, :differential_diagnosis_json, :bbox_json
        )
    ''', {
        "differential_diagnosis_json": None,
        "bbox_json": None,
        **data,
        "id": finding_id,
        "case_id": case_id,
    })
    conn.commit()
    conn.close()
    return finding_id

def update_finding_fields(finding_id: str, data: dict) -> bool:
    """Update editable clinical fields of a finding. Returns True if row found."""
    allowed = {
        'finding_type', 'breast_side', 'clock_position', 'quadrant',
        'distance_from_nipple_mm', 'depth', 'size_length_mm', 'size_width_mm',
        'margin_type', 'density_level', 'shape', 'bi_rads_suggestion',
        'malignancy_probability', 'recommended_action',
        'calcification_morphology', 'calcification_distribution', 'ai_reasoning',
    }
    filtered = {k: v for k, v in data.items() if k in allowed}
    if not filtered:
        return True
    set_clause = ", ".join(f"{k} = :{k}" for k in filtered)
    filtered["_id"] = finding_id
    conn = get_connection()
    cur = conn.execute(
        f"UPDATE findings SET {set_clause} WHERE id = :_id",
        filtered,
    )
    conn.commit()
    conn.close()
    return cur.rowcount > 0


def update_finding_review(finding_id: str, status: str, reviewed_birads: int | None,
                          reviewer_notes: str | None, reviewed_by: str) -> bool:
    """Update radiologist review status on a finding. Returns True if row was found."""
    from datetime import datetime
    conn = get_connection()
    cur = conn.execute(
        """UPDATE findings
           SET review_status   = ?,
               reviewed_birads = ?,
               reviewer_notes  = ?,
               reviewed_at     = ?,
               reviewed_by     = ?
           WHERE id = ?""",
        (status, reviewed_birads, reviewer_notes, datetime.utcnow().isoformat(), reviewed_by, finding_id),
    )
    conn.commit()
    conn.close()
    return cur.rowcount > 0


def get_findings_by_case(case_id: str) -> list:
    """Fetch all findings for a given case."""
    conn = get_connection()
    rows = conn.execute(
        "SELECT * FROM findings WHERE case_id = ? ORDER BY malignancy_probability DESC",
        (case_id,)
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]
