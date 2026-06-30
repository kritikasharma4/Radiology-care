import uuid
from datetime import datetime
from db.connection import get_connection

def create_case(data: dict) -> str:
    """Insert a new case into database. Returns case_id."""
    case_id = str(uuid.uuid4())
    conn = get_connection()
    conn.execute('''
        INSERT INTO cases (
            id, patient_name, patient_id, age, sex, study_date,
            family_history, personal_breast_cancer, brca_mutation,
            menopause_status, hormone_therapy, breast_implants,
            previous_surgery, previous_biopsy,
            reported_lump, reported_pain, reported_nipple_discharge,
            quality_score,
            motion_blur_detected, over_exposure_detected,
            under_exposure_detected, image_clipping_detected,
            wrong_positioning_detected, labels_covering_tissue,
            missing_breast_tissue,
            density_category, density_confidence,
            asymmetry_detected, lymph_node_abnormal,
            skin_changes_detected, edema_detected,
            patient_risk_category, overall_risk_score,
            overall_case_urgency,
            dicom_file_path, preprocessed_image_path, is_demo_case,
            overall_birads, overall_impression, recommended_management,
            bilateral_symmetry, nipple_changes,
            ai_provider, ai_model, is_mock, mock_reason,
            cv_model, cv_suspicion_score, cv_density_class, cv_is_neural
        ) VALUES (
            :id, :patient_name, :patient_id, :age, :sex, :study_date,
            :family_history, :personal_breast_cancer, :brca_mutation,
            :menopause_status, :hormone_therapy, :breast_implants,
            :previous_surgery, :previous_biopsy,
            :reported_lump, :reported_pain, :reported_nipple_discharge,
            :quality_score,
            :motion_blur_detected, :over_exposure_detected,
            :under_exposure_detected, :image_clipping_detected,
            :wrong_positioning_detected, :labels_covering_tissue,
            :missing_breast_tissue,
            :density_category, :density_confidence,
            :asymmetry_detected, :lymph_node_abnormal,
            :skin_changes_detected, :edema_detected,
            :patient_risk_category, :overall_risk_score,
            :overall_case_urgency,
            :dicom_file_path, :preprocessed_image_path, :is_demo_case,
            :overall_birads, :overall_impression, :recommended_management,
            :bilateral_symmetry, :nipple_changes,
            :ai_provider, :ai_model, :is_mock, :mock_reason,
            :cv_model, :cv_suspicion_score, :cv_density_class, :cv_is_neural
        )
    ''', {"mock_reason": None, "cv_model": None, "cv_suspicion_score": None,
          "cv_density_class": None, "cv_is_neural": 0, **data, "id": case_id})
    conn.commit()
    conn.close()
    return case_id

def get_case(case_id: str) -> dict:
    """Fetch a single case by ID."""
    conn = get_connection()
    row = conn.execute(
        "SELECT * FROM cases WHERE id = ?", (case_id,)
    ).fetchone()
    conn.close()
    return dict(row) if row else None

def get_all_cases() -> list:
    """Fetch all cases ordered by most recent first."""
    conn = get_connection()
    rows = conn.execute(
        "SELECT * FROM cases ORDER BY created_at DESC"
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]

def sign_off_case(case_id: str, signed_off_by: str) -> bool:
    """Mark a case as radiologist-signed-off. Returns True if row was found."""
    from datetime import datetime
    conn = get_connection()
    cur = conn.execute(
        """UPDATE cases
           SET signed_off    = 1,
               signed_off_at = ?,
               signed_off_by = ?,
               updated_at    = ?
           WHERE id = ?""",
        (datetime.utcnow().isoformat(), signed_off_by, datetime.utcnow().isoformat(), case_id),
    )
    conn.commit()
    conn.close()
    return cur.rowcount > 0


def update_case_patient_data(case_id: str, data: dict) -> bool:
    """Update patient demographics and clinical history fields. Returns True if row found."""
    from datetime import datetime
    allowed = {
        "patient_name", "age", "sex", "study_date",
        "menopause_status", "brca_mutation",
        "family_history", "personal_breast_cancer",
        "hormone_therapy", "breast_implants",
        "previous_surgery", "previous_biopsy",
        "reported_lump", "reported_pain", "reported_nipple_discharge",
        "overall_case_urgency",
    }
    filtered = {k: v for k, v in data.items() if k in allowed and v is not None}
    if not filtered:
        return True
    set_clause = ", ".join(f"{k} = :{k}" for k in filtered)
    filtered["_id"] = case_id
    filtered["_updated_at"] = datetime.utcnow().isoformat()
    conn = get_connection()
    cur = conn.execute(
        f"UPDATE cases SET {set_clause}, updated_at = :_updated_at WHERE id = :_id",
        filtered,
    )
    conn.commit()
    conn.close()
    return cur.rowcount > 0


def save_report_text(case_id: str, text: str) -> bool:
    """Persist radiologist-edited report text."""
    conn = get_connection()
    cur = conn.execute(
        "UPDATE cases SET final_report_text = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
        (text, case_id),
    )
    conn.commit()
    conn.close()
    return cur.rowcount > 0


def update_case_assessment(case_id: str, data: dict) -> bool:
    """Update radiologist-corrected case-level AI assessment fields."""
    allowed = {
        'overall_birads', 'overall_impression', 'recommended_management',
        'density_category',
    }
    filtered = {k: v for k, v in data.items() if k in allowed}
    if not filtered:
        return True
    set_clause = ", ".join(f"{k} = :{k}" for k in filtered)
    filtered["_id"] = case_id
    filtered["_updated_at"] = datetime.utcnow().isoformat()
    conn = get_connection()
    cur = conn.execute(
        f"UPDATE cases SET {set_clause}, updated_at = :_updated_at WHERE id = :_id",
        filtered,
    )
    conn.commit()
    conn.close()
    return cur.rowcount > 0


def update_case_analysis(case_id: str, data: dict):
    """Update case with AI analysis results."""
    conn = get_connection()
    conn.execute('''
        UPDATE cases SET
            density_category       = :density_category,
            density_confidence     = :density_confidence,
            asymmetry_detected     = :asymmetry_detected,
            lymph_node_abnormal    = :lymph_node_abnormal,
            skin_changes_detected  = :skin_changes_detected,
            edema_detected         = :edema_detected,
            patient_risk_category  = :patient_risk_category,
            overall_risk_score     = :overall_risk_score,
            overall_case_urgency   = :overall_case_urgency,
            updated_at             = :updated_at
        WHERE id = :id
    ''', {**data, "id": case_id, "updated_at": datetime.now()})
    conn.commit()
    conn.close()
