import uuid
from db.connection import get_connection

def create_feedback(data: dict) -> str:
    """Insert radiologist feedback for a finding. Returns feedback_id."""
    feedback_id = str(uuid.uuid4())
    conn = get_connection()
    conn.execute('''
        INSERT INTO feedback (
            id, case_id, finding_id,
            radiologist_action, radiologist_reason,
            corrected_bi_rads, corrected_finding_type,
            corrected_size_mm, correction_notes,
            radiologist_id, use_for_retraining
        ) VALUES (
            :id, :case_id, :finding_id,
            :radiologist_action, :radiologist_reason,
            :corrected_bi_rads, :corrected_finding_type,
            :corrected_size_mm, :correction_notes,
            :radiologist_id, :use_for_retraining
        )
    ''', {
        **data,
        "id": feedback_id,
        "corrected_bi_rads":        data.get("corrected_bi_rads"),
        "corrected_finding_type":   data.get("corrected_finding_type"),
        "corrected_size_mm":        data.get("corrected_size_mm"),
        "correction_notes":         data.get("correction_notes"),
        "radiologist_id":           data.get("radiologist_id"),
        "use_for_retraining":       data.get("use_for_retraining", 1),
    })
    conn.commit()
    conn.close()
    return feedback_id

def get_feedback_by_finding(finding_id: str) -> list:
    """Fetch all feedback entries for a specific finding."""
    conn = get_connection()
    rows = conn.execute(
        "SELECT * FROM feedback WHERE finding_id = ? ORDER BY created_at DESC",
        (finding_id,)
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]
