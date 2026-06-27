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
            dicom_file_path, preprocessed_image_path, is_demo_case
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
            :dicom_file_path, :preprocessed_image_path, :is_demo_case
        )
    ''', {**data, "id": case_id})
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
