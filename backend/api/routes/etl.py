import zipfile
import tempfile
import shutil
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from pydantic import BaseModel
from typing import Optional

from etl.pipeline import run_etl, _process_patient
from db.schema import migrate_add_ai_columns
from db.repositories.case_repo import get_all_cases

router = APIRouter(prefix="/api", tags=["etl"])


class ImportRequest(BaseModel):
    source_dir: Optional[str] = None


@router.post("/etl/import")
def trigger_import(body: ImportRequest = None):
    """Bulk-import all patient folders from a filesystem source directory."""
    src = body.source_dir if body else None
    return run_etl(src)


@router.post("/upload/zip")
async def upload_zip(
    file: UploadFile = File(...),
    age: Optional[int] = Form(None),
    sex: Optional[str] = Form(None),
    menopause_status: Optional[str] = Form(None),
    brca_mutation: Optional[str] = Form(None),
    family_history: Optional[bool] = Form(None),
    personal_breast_cancer: Optional[bool] = Form(None),
    hormone_therapy: Optional[bool] = Form(None),
    breast_implants: Optional[bool] = Form(None),
    previous_surgery: Optional[bool] = Form(None),
    previous_biopsy: Optional[bool] = Form(None),
    reported_lump: Optional[bool] = Form(None),
    reported_pain: Optional[bool] = Form(None),
    reported_nipple_discharge: Optional[bool] = Form(None),
    urgency: Optional[str] = Form(None),
):
    """
    Accept a ZIP file containing one or more patient JPG folders.
    Optional form fields set patient defaults for all patients in the ZIP.
    """
    if not file.filename.lower().endswith(".zip"):
        raise HTTPException(400, "Only .zip files are accepted")

    # Build patient_meta from whichever fields were explicitly provided
    patient_meta = {k: v for k, v in {
        "age":                    age,
        "sex":                    sex,
        "menopause_status":       menopause_status,
        "brca_mutation":          brca_mutation,
        "family_history":         family_history,
        "personal_breast_cancer": personal_breast_cancer,
        "hormone_therapy":        hormone_therapy,
        "breast_implants":        breast_implants,
        "previous_surgery":       previous_surgery,
        "previous_biopsy":        previous_biopsy,
        "reported_lump":          reported_lump,
        "reported_pain":          reported_pain,
        "reported_nipple_discharge": reported_nipple_discharge,
        "urgency":                urgency,
    }.items() if v is not None}

    migrate_add_ai_columns()
    existing_ids = {c["patient_id"] for c in get_all_cases()}

    tmp_dir = Path(tempfile.mkdtemp(prefix="radiology_upload_"))
    try:
        # Save and extract
        zip_path = tmp_dir / "upload.zip"
        zip_path.write_bytes(await file.read())

        extract_dir = tmp_dir / "extracted"
        extract_dir.mkdir()
        with zipfile.ZipFile(zip_path, "r") as z:
            z.extractall(extract_dir)

        patient_dirs = _find_patient_dirs(extract_dir)
        if not patient_dirs:
            raise HTTPException(400, "No patient folders with JPG images found inside the ZIP")

        skipped = [{"patient_id": pd.name, "status": "skipped", "reason": "already imported"}
                   for pd in patient_dirs if pd.name in existing_ids]
        to_process = [pd for pd in patient_dirs if pd.name not in existing_ids]

        imported_results = []
        with ThreadPoolExecutor(max_workers=4) as pool:
            future_to_pid = {pool.submit(_process_patient, pd, patient_meta or None): pd.name
                             for pd in to_process}
            for future in as_completed(future_to_pid):
                pid = future_to_pid[future]
                try:
                    r = future.result()
                    r["status"] = "imported"
                    imported_results.append(r)
                except Exception as exc:
                    imported_results.append({"patient_id": pid, "status": "error", "error": str(exc)})

        results = skipped + imported_results

        return {
            "success":  True,
            "total":    len(results),
            "imported": sum(1 for r in results if r["status"] == "imported"),
            "skipped":  sum(1 for r in results if r["status"] == "skipped"),
            "errors":   sum(1 for r in results if r["status"] == "error"),
            "results":  results,
        }
    finally:
        shutil.rmtree(tmp_dir, ignore_errors=True)


def _find_patient_dirs(root: Path) -> list:
    """
    Return directories that contain JPG or DICOM files.
    Handles flat ZIPs, nested ZIPs, and ZIPs with one extra nesting level.
    """
    def _has_images(d: Path) -> bool:
        return bool(list(d.glob("*.jpg")) or list(d.glob("*.dcm")))

    if _has_images(root):
        return [root]

    dirs = [d for d in sorted(root.iterdir()) if d.is_dir() and _has_images(d)]

    if not dirs:
        for outer in sorted(root.iterdir()):
            if outer.is_dir():
                dirs += [d for d in sorted(outer.iterdir()) if d.is_dir() and _has_images(d)]

    return dirs
