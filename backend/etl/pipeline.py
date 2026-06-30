import os
import shutil
import cv2
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

from config import CASES_DIR, BASE_DIR
from core.quality.assessor import assess
from core.clinical.risk_calculator import calculate_risk
from core.ai.provider import get_client, select_images_for_analysis
from core.cv.mammography_detector import detect as cv_detect
from core.rag.retriever import retrieve_clinical_context, build_analysis_query
from db.repositories.case_repo import create_case, get_all_cases
from db.repositories.finding_repo import create_finding
from db.connection import get_connection

SOURCE_DIR = Path(os.getenv("ETL_SOURCE_DIR", r"C:\Users\91884\Downloads\radiology_data\mamo Patient abnormal images"))



def run_etl(source_dir=None):
    """
    Bulk ETL: Extract → Transform → Load all patient folders.
    Skips patients already present in the database.
    """
    src = Path(source_dir) if source_dir else SOURCE_DIR
    if not src.exists():
        return {"success": False, "error": f"Source directory not found: {src}"}

    existing_ids = {c["patient_id"] for c in get_all_cases()}
    patient_dirs = sorted(d for d in src.iterdir() if d.is_dir())

    results = []
    skipped = [{"patient_id": d.name, "status": "skipped", "reason": "already imported"}
               for d in patient_dirs if d.name in existing_ids]
    to_process = [d for d in patient_dirs if d.name not in existing_ids]

    with ThreadPoolExecutor(max_workers=4) as pool:
        future_to_pid = {pool.submit(_process_patient, pd): pd.name for pd in to_process}
        for future in as_completed(future_to_pid):
            pid = future_to_pid[future]
            try:
                r = future.result()
                r["status"] = "imported"
                results.append(r)
            except Exception as exc:
                results.append({"patient_id": pid, "status": "error", "error": str(exc)})

    results = skipped + results

    return {
        "success":  True,
        "total":    len(results),
        "imported": sum(1 for r in results if r["status"] == "imported"),
        "skipped":  sum(1 for r in results if r["status"] == "skipped"),
        "errors":   sum(1 for r in results if r["status"] == "error"),
        "results":  results,
    }


def _process_patient(patient_dir, patient_meta=None):
    pid  = patient_dir.name
    # All fields default to unknown — no fabricated demographics
    meta = {
        "age":                    None,
        "sex":                    "F",
        "family_history":         False,
        "personal_breast_cancer": False,
        "brca_mutation":          "unknown",
        "menopause_status":       "unknown",
        "hormone_therapy":        False,
        "breast_implants":        False,
        "previous_surgery":       False,
        "previous_biopsy":        False,
        "reported_lump":          False,
        "reported_pain":          False,
        "reported_nipple_discharge": False,
        **(patient_meta or {}),  # caller can override with real data
    }

    # ── EXTRACT ──────────────────────────────────────────────────────────────
    images = _sort_images(list(patient_dir.glob("*.jpg")))
    if not images:
        # Fall back to DICOM files (single-file or per-slice)
        dcm_files = sorted(patient_dir.glob("*.dcm"))
        if not dcm_files:
            raise ValueError("No JPG or DICOM files found in folder")
        images = _extract_dicom_to_jpgs(dcm_files, Path(CASES_DIR) / pid.replace(" ", "_"))
        if not images:
            raise ValueError("Could not extract frames from DICOM files")
    series_type = _detect_series_type(images)

    # ── TRANSFORM ─────────────────────────────────────────────────────────────
    safe_pid   = pid.replace(" ", "_")
    case_dir   = CASES_DIR / safe_pid
    slices_dir = case_dir / "slices"
    slices_dir.mkdir(parents=True, exist_ok=True)

    for img in images:
        shutil.copy2(img, slices_dir / img.name)

    # Middle slice as representative (tomo), first image otherwise
    rep_src  = images[len(images) // 2] if series_type == "tomosynthesis" else images[0]
    rep_dest = case_dir / "representative.jpg"
    shutil.copy2(rep_src, rep_dest)

    # Quality check on cropped image (removes FUJIFILM info panel on the left)
    crop_path = _crop_fujifilm_panel(rep_dest)
    quality   = assess(crop_path)
    try:
        Path(crop_path).unlink(missing_ok=True)
    except Exception:
        pass

    urgency_hint = meta.get("urgency", "concerning")  # used only for AI model tier selection
    risk    = calculate_risk({
        "age":                    meta["age"],
        "family_history":         meta["family_history"],
        "personal_breast_cancer": meta["personal_breast_cancer"],
        "brca_mutation":          meta["brca_mutation"],
        "menopause_status":       meta["menopause_status"],
        "hormone_therapy":        meta["hormone_therapy"],
        "previous_biopsy":        meta["previous_biopsy"],
    })

    rep_rel = rep_dest.relative_to(BASE_DIR).as_posix()

    # Select images for LLM analysis (multiple slices for tomo)
    image_paths = select_images_for_analysis(case_dir, series_type, len(images))
    # Crop FUJIFILM panel before sending to LLM — GPT-4o must only see breast tissue
    llm_paths, llm_temps = _make_llm_crops(image_paths)
    patient_ctx = {
        "age":              meta["age"],
        "family_history":   meta["family_history"],
        "menopause_status": meta["menopause_status"],
        "brca_mutation":    meta["brca_mutation"],
        "reported_lump":    meta["reported_lump"],
        "reported_pain":    meta["reported_pain"],
        "reported_nipple_discharge": meta["reported_nipple_discharge"],
    }
    # ── CV DETECTION (runs before LLM — LLM synthesizes FROM this output) ────
    print(f"  [CV] Running detection on {len(llm_paths)} image(s)...")
    cv_result = cv_detect(llm_paths)
    print(f"  [CV] {cv_result['cv_model']} | suspicion={cv_result.get('suspicion_score')} | density={cv_result.get('density_class')}")

    # ── RAG LOOKUP (retrieve relevant clinical references before LLM call) ───
    rag_query = build_analysis_query(cv_result, patient_ctx)
    rag_context = retrieve_clinical_context(rag_query, n_results=4)
    if rag_context:
        print(f"  [RAG] Retrieved {len(rag_context.split(chr(10)))} lines of clinical context")

    try:
        ai = get_client().analyze_mammogram(
            image_paths=llm_paths,
            patient_context=patient_ctx,
            urgency_hint=urgency_hint,
            cv_result=cv_result,
            rag_context=rag_context if rag_context else None,
            confirmed_abnormal=True,
        )
    except Exception as ai_exc:
        print(f"  WARNING: Real AI failed for {pid} ({ai_exc}). Falling back to mock.")
        from core.ai.mock_client import MockClient
        ai = MockClient(reason=str(ai_exc)).analyze_mammogram(
            image_paths=llm_paths,
            patient_context=patient_ctx,
            urgency_hint=urgency_hint,
        )
        ai["mock_reason"] = str(ai_exc)
    finally:
        for t in llm_temps:
            try: t.unlink(missing_ok=True)
            except: pass

    # Derive urgency from AI output — never use hardcoded metadata for this
    urgency = _birads_to_urgency(ai.get("overall_birads"))

    # ── LOAD ──────────────────────────────────────────────────────────────────
    # Guard against race condition when multiple threads process simultaneously
    conn_check = get_connection()
    try:
        already = conn_check.execute("SELECT id FROM cases WHERE patient_id=?", (pid,)).fetchone()
    finally:
        conn_check.close()
    if already:
        raise ValueError(f"Patient {pid} already imported (race condition guard)")

    case_id = create_case({
        "patient_name":              f"Patient {pid}",
        "patient_id":                pid,
        "age":                       meta["age"],
        "sex":                       meta["sex"],
        "study_date":                "",
        "family_history":            meta["family_history"],
        "personal_breast_cancer":    meta["personal_breast_cancer"],
        "brca_mutation":             meta["brca_mutation"],
        "menopause_status":          meta["menopause_status"],
        "hormone_therapy":           meta["hormone_therapy"],
        "breast_implants":           meta["breast_implants"],
        "previous_surgery":          meta["previous_surgery"],
        "previous_biopsy":           meta["previous_biopsy"],
        "reported_lump":             meta["reported_lump"],
        "reported_pain":             meta["reported_pain"],
        "reported_nipple_discharge": meta["reported_nipple_discharge"],
        "quality_score":             quality["quality_score"],
        "motion_blur_detected":      quality["motion_blur_detected"],
        "over_exposure_detected":    quality["over_exposure_detected"],
        "under_exposure_detected":   quality["under_exposure_detected"],
        "image_clipping_detected":   quality["image_clipping_detected"],
        "wrong_positioning_detected":quality["wrong_positioning_detected"],
        "labels_covering_tissue":    quality["labels_covering_tissue"],
        "missing_breast_tissue":     quality["missing_breast_tissue"],
        "density_category":          ai.get("density_category"),
        "density_confidence":        ai.get("density_confidence"),
        "asymmetry_detected":        ai.get("asymmetry_detected", False),
        "lymph_node_abnormal":       ai.get("lymph_node_status") == "abnormal",
        "skin_changes_detected":     ai.get("skin_changes", False),
        "edema_detected":            ai.get("edema_detected", False),
        "patient_risk_category":     risk["patient_risk_category"],
        "overall_risk_score":        risk["overall_risk_score"],
        "overall_case_urgency":      urgency,
        "dicom_file_path":           str(patient_dir),
        "preprocessed_image_path":   rep_rel,
        "is_demo_case":              False,
        "overall_birads":            ai.get("overall_birads"),
        "overall_impression":        ai.get("overall_impression"),
        "recommended_management":    ai.get("recommended_management"),
        "bilateral_symmetry":        ai.get("bilateral_symmetry", True),
        "nipple_changes":            ai.get("nipple_changes", False),
        "ai_provider":               ai.get("ai_provider", "mock"),
        "ai_model":                  ai.get("ai_model"),
        "is_mock":                   ai.get("is_mock", True),
        "cv_model":                  cv_result.get("cv_model"),
        "cv_suspicion_score":        cv_result.get("suspicion_score"),
        "cv_density_class":          cv_result.get("density_class"),
        "cv_is_neural":              int(cv_result.get("is_neural_cv", False)),
    })

    for finding in ai["findings"]:
        create_finding(case_id, finding)

    conn = get_connection()
    try:
        conn.execute(
            "UPDATE cases SET series_type=?, total_slices=? WHERE id=?",
            (series_type, len(images), case_id),
        )
        conn.commit()
    finally:
        conn.close()

    return {
        "case_id":      case_id,
        "patient_id":   pid,
        "series_type":  series_type,
        "total_slices": len(images),
        "urgency":      urgency,
    }


# ── helpers ──────────────────────────────────────────────────────────────────

def _detect_series_type(images):
    name = images[0].name if images else ""
    if "Ser1026" in name:
        return "tomosynthesis"
    if "Ser1001" in name or "Ser1002" in name:
        return "2d"
    return "transpara"


def _sort_images(images):
    def key(p):
        try:
            return int(p.stem.split("Img")[-1])
        except (ValueError, IndexError):
            return 0
    return sorted(images, key=key)


FUJIFILM_PANEL_FRAC = 0.38  # fraction of image width occupied by scanner info panel


def _birads_to_urgency(birads: int | None) -> str:
    """Derive clinical urgency from AI-assessed overall BI-RADS score."""
    if birads in (0, 5, 6):
        return "urgent"
    if birads in (3, 4):
        return "concerning"
    if birads in (1, 2):
        return "routine"
    return "concerning"  # safe default when AI returns no score

def _extract_dicom_to_jpgs(dcm_files: list, case_dir: Path) -> list:
    """
    Extract frames from DICOM files and save as JPGs in the case slices dir.
    Handles both single-frame 2D DICOMs and multi-frame tomosynthesis.
    Returns list of Path objects for the extracted frames.
    """
    from core.dicom.preprocessor import extract_frames as dcm_extract
    slices_dir = case_dir / "slices"
    slices_dir.mkdir(parents=True, exist_ok=True)

    all_frames = []
    for i, dcm_path in enumerate(sorted(dcm_files)):
        try:
            frame_dir = slices_dir / f"dcm_{i:04d}"
            frame_dir.mkdir(exist_ok=True)
            # Extract up to 10 frames per DICOM — covers tomo slices
            frames = dcm_extract(str(dcm_path), str(frame_dir), n_frames=10)
            # Convert PNGs to JPGs for pipeline consistency
            jpg_frames = []
            for fp in frames:
                from PIL import Image as PILImage
                jpg_path = Path(fp).with_suffix(".jpg")
                PILImage.open(fp).convert("RGB").save(str(jpg_path), "JPEG", quality=92)
                jpg_frames.append(Path(jpg_path))
            all_frames.extend(jpg_frames)
        except Exception as e:
            print(f"  WARNING: Could not extract frames from {dcm_path.name}: {e}")

    return all_frames


def _make_llm_crops(image_paths: list) -> tuple[list, list]:
    """
    Crop the FUJIFILM scanner panel from images before sending to the LLM.
    Returns (cropped_paths, temp_paths_to_cleanup).
    Coordinates returned by the LLM will be relative to the cropped image (breast-tissue only).
    """
    cropped, temps = [], []
    for p in image_paths:
        img = cv2.imread(str(p))
        if img is None:
            cropped.append(str(p))
            continue
        h, w = img.shape[:2]
        crop = img[:, int(w * FUJIFILM_PANEL_FRAC):]
        tmp = Path(p).parent / (Path(p).stem + "_llmcrop.jpg")
        cv2.imwrite(str(tmp), crop)
        cropped.append(str(tmp))
        temps.append(tmp)
    return cropped, temps


def _crop_fujifilm_panel(img_path):
    """
    FUJIFILM FDR-3000AWS embeds a ~38% wide info/UI panel on the left side.
    Crop it out so the quality assessor only sees the actual breast tissue.
    """
    img = cv2.imread(str(img_path))
    if img is None:
        return str(img_path)
    h, w = img.shape[:2]
    cropped = img[:, int(w * 0.38):]
    tmp = img_path.parent / (img_path.stem + "_qcrop.jpg")
    cv2.imwrite(str(tmp), cropped)
    return str(tmp)
