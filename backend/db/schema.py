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

            -- AI analysis metadata
            overall_birads INTEGER,
            overall_impression TEXT,
            recommended_management TEXT,
            bilateral_symmetry INTEGER DEFAULT 1,
            nipple_changes INTEGER DEFAULT 0,
            ai_provider TEXT DEFAULT 'mock',
            ai_model TEXT,
            is_mock INTEGER DEFAULT 1,

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

            -- Extended location
            depth TEXT,

            -- Calcification-specific
            calcification_morphology TEXT,
            calcification_distribution TEXT,

            -- Explainability
            heatmap_file_path TEXT,
            segmentation_mask_path TEXT,
            key_features_json TEXT,
            feature_importance_json TEXT,
            ai_reasoning TEXT,

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


def migrate_add_review_columns():
    """
    Idempotent migration — adds Phase 3 radiologist review columns.
    findings: review_status, reviewed_birads, reviewer_notes, reviewed_at, reviewed_by
    cases: signed_off, signed_off_at, signed_off_by
    """
    conn = sqlite3.connect(str(DB_PATH))
    try:
        cases_cols   = {r[1] for r in conn.execute("PRAGMA table_info(cases)").fetchall()}
        finding_cols = {r[1] for r in conn.execute("PRAGMA table_info(findings)").fetchall()}

        cases_new = {
            "signed_off":     "INTEGER DEFAULT 0",
            "signed_off_at":  "TEXT",
            "signed_off_by":  "TEXT",
        }
        for col, typedef in cases_new.items():
            if col not in cases_cols:
                conn.execute(f"ALTER TABLE cases ADD COLUMN {col} {typedef}")

        findings_new = {
            "review_status":    "TEXT DEFAULT 'pending'",
            "reviewed_birads":  "INTEGER",
            "reviewer_notes":   "TEXT",
            "reviewed_at":      "TEXT",
            "reviewed_by":      "TEXT",
        }
        for col, typedef in findings_new.items():
            if col not in finding_cols:
                conn.execute(f"ALTER TABLE findings ADD COLUMN {col} {typedef}")

        conn.commit()
        print("Phase 3 review columns migrated.")
    finally:
        conn.close()


def migrate_add_ai_columns():
    """
    Idempotent migration — adds AI analysis columns introduced in Phase 1.
    Safe to run on an existing DB; skips columns that already exist.
    """
    conn = sqlite3.connect(str(DB_PATH))
    try:
        cases_cols   = {r[1] for r in conn.execute("PRAGMA table_info(cases)").fetchall()}
        finding_cols = {r[1] for r in conn.execute("PRAGMA table_info(findings)").fetchall()}

        cases_new = {
            "overall_birads":       "INTEGER",
            "overall_impression":   "TEXT",
            "recommended_management": "TEXT",
            "bilateral_symmetry":   "INTEGER DEFAULT 1",
            "nipple_changes":       "INTEGER DEFAULT 0",
            "ai_provider":          "TEXT DEFAULT 'mock'",
            "ai_model":             "TEXT",
            "is_mock":              "INTEGER DEFAULT 1",
            "series_type":          "TEXT DEFAULT '2d'",
            "total_slices":         "INTEGER DEFAULT 1",
        }
        for col, typedef in cases_new.items():
            if col not in cases_cols:
                conn.execute(f"ALTER TABLE cases ADD COLUMN {col} {typedef}")

        findings_new = {
            "depth":                        "TEXT",
            "calcification_morphology":     "TEXT",
            "calcification_distribution":   "TEXT",
            "ai_reasoning":                 "TEXT",
        }
        for col, typedef in findings_new.items():
            if col not in finding_cols:
                conn.execute(f"ALTER TABLE findings ADD COLUMN {col} {typedef}")

        conn.commit()
    finally:
        conn.close()


def migrate_add_report_text():
    """Idempotent — adds final_report_text column for radiologist-edited report."""
    conn = sqlite3.connect(str(DB_PATH))
    try:
        cols = {r[1] for r in conn.execute("PRAGMA table_info(cases)").fetchall()}
        if "final_report_text" not in cols:
            conn.execute("ALTER TABLE cases ADD COLUMN final_report_text TEXT")
            conn.commit()
    finally:
        conn.close()


def migrate_add_mock_reason():
    """Idempotent — adds mock_reason column to cases for tracking why AI fell back to mock."""
    conn = sqlite3.connect(str(DB_PATH))
    try:
        cols = {r[1] for r in conn.execute("PRAGMA table_info(cases)").fetchall()}
        if "mock_reason" not in cols:
            conn.execute("ALTER TABLE cases ADD COLUMN mock_reason TEXT")
            conn.commit()
    finally:
        conn.close()


def migrate_add_bbox_column():
    """Idempotent — adds bbox_json column for AI localization overlay."""
    conn = sqlite3.connect(str(DB_PATH))
    try:
        cols = {r[1] for r in conn.execute("PRAGMA table_info(findings)").fetchall()}
        if "bbox_json" not in cols:
            conn.execute("ALTER TABLE findings ADD COLUMN bbox_json TEXT")
            conn.commit()
    finally:
        conn.close()


def migrate_add_cv_columns():
    """Idempotent — adds Phase 4a CV detection columns to cases."""
    conn = sqlite3.connect(str(DB_PATH))
    try:
        cols = {r[1] for r in conn.execute("PRAGMA table_info(cases)").fetchall()}
        new_cols = {
            "cv_model":           "TEXT",
            "cv_suspicion_score": "REAL",
            "cv_density_class":   "TEXT",
            "cv_is_neural":       "INTEGER DEFAULT 0",
        }
        for col, typedef in new_cols.items():
            if col not in cols:
                conn.execute(f"ALTER TABLE cases ADD COLUMN {col} {typedef}")
        conn.commit()
        print("CV columns migrated.")
    finally:
        conn.close()


def migrate_add_clinical_fields():
    """
    Idempotent migration — Phase 2c clinical features.
    cases: referring_physician, study_type
    findings: differential_diagnosis_json
    """
    conn = sqlite3.connect(str(DB_PATH))
    try:
        cases_cols   = {r[1] for r in conn.execute("PRAGMA table_info(cases)").fetchall()}
        finding_cols = {r[1] for r in conn.execute("PRAGMA table_info(findings)").fetchall()}

        for col, typedef in {
            "referring_physician": "TEXT",
            "study_type":          "TEXT DEFAULT 'screening'",
        }.items():
            if col not in cases_cols:
                conn.execute(f"ALTER TABLE cases ADD COLUMN {col} {typedef}")

        if "differential_diagnosis_json" not in finding_cols:
            conn.execute("ALTER TABLE findings ADD COLUMN differential_diagnosis_json TEXT")

        conn.commit()
        print("Clinical fields migration complete.")
    finally:
        conn.close()
