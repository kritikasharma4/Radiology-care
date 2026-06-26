import sqlite3
from config import DB_PATH

def create_tables():
    conn = sqlite3.connect(str(DB_PATH))
    cursor = conn.cursor()

    # CASES table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS cases (
            id TEXT PRIMARY KEY,
            patient_name TEXT,
            patient_id TEXT,
            age INTEGER,
            sex TEXT,
            study_date TEXT,

            -- Clinical context
            family_history INTEGER DEFAULT 0,
            personal_breast_cancer INTEGER DEFAULT 0,
            brca_mutation TEXT DEFAULT 'unknown',
            menopause_status TEXT DEFAULT 'unknown',
            hormone_therapy INTEGER DEFAULT 0,
            breast_implants INTEGER DEFAULT 0,
            previous_surgery INTEGER DEFAULT 0,
            previous_biopsy INTEGER DEFAULT 0,
            reported_lump INTEGER DEFAULT 0,
            reported_pain INTEGER DEFAULT 0,
            reported_nipple_discharge INTEGER DEFAULT 0,

            -- Quality assessment
            quality_score REAL,
            motion_blur_detected INTEGER DEFAULT 0,
            over_exposure_detected INTEGER DEFAULT 0,
            under_exposure_detected INTEGER DEFAULT 0,
            image_clipping_detected INTEGER DEFAULT 0,
            wrong_positioning_detected INTEGER DEFAULT 0,
            labels_covering_tissue INTEGER DEFAULT 0,
            missing_breast_tissue INTEGER DEFAULT 0,

            -- Breast assessment
            density_category TEXT,
            density_confidence REAL,
            asymmetry_detected INTEGER DEFAULT 0,
            lymph_node_abnormal INTEGER DEFAULT 0,
            skin_changes_detected INTEGER DEFAULT 0,
            edema_detected INTEGER DEFAULT 0,

            -- Risk profile
            patient_risk_category TEXT,
            overall_risk_score REAL,
            overall_case_urgency TEXT DEFAULT 'routine',

            -- File paths
            dicom_file_path TEXT,
            preprocessed_image_path TEXT,

            -- Metadata
            is_demo_case INTEGER DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')

    # FINDINGS table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS findings (
            id TEXT PRIMARY KEY,
            case_id TEXT NOT NULL,

            -- Finding identification
            finding_type TEXT,
            breast_side TEXT,
            clock_position INTEGER,
            quadrant TEXT,
            distance_from_nipple_mm REAL,

            -- Size
            size_length_mm REAL,
            size_width_mm REAL,
            size_area_mm2 REAL,

            -- Characteristics
            margin_type TEXT,
            density_level TEXT,
            shape TEXT,

            -- Risk
            malignancy_probability REAL,
            confidence_score REAL,
            bi_rads_suggestion INTEGER,
            recommended_action TEXT,

            -- Ensemble voting
            model_1_confidence REAL,
            model_2_confidence REAL,
            model_3_confidence REAL,
            ensemble_agreement TEXT,

            -- Explainability
            heatmap_file_path TEXT,
            segmentation_mask_path TEXT,
            key_features_json TEXT,
            feature_importance_json TEXT,

            -- Status
            is_validated INTEGER DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

            FOREIGN KEY (case_id) REFERENCES cases(id)
        )
    ''')

    # FEEDBACK table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS feedback (
            id TEXT PRIMARY KEY,
            finding_id TEXT NOT NULL,

            -- Feedback
            action TEXT,
            reason TEXT,
            corrected_finding_type TEXT,
            corrected_size_length REAL,
            corrected_size_width REAL,
            corrected_margin TEXT,
            corrected_density TEXT,
            corrected_bi_rads INTEGER,

            -- Metadata
            radiologist_id TEXT DEFAULT 'radiologist_1',
            use_for_retraining INTEGER DEFAULT 1,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

            FOREIGN KEY (finding_id) REFERENCES findings(id)
        )
    ''')

    conn.commit()
    conn.close()
    print("Tables created: cases, findings, feedback")
