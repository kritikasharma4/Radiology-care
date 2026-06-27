from fastapi import APIRouter, HTTPException
from db.repositories.case_repo import get_case, get_all_cases
from db.repositories.finding_repo import get_findings_by_case

router = APIRouter(prefix="/api", tags=["cases"])


@router.get("/cases")
def list_cases():
    """Return all cases for the dashboard, most recent first."""
    cases = get_all_cases()
    return {"cases": cases, "total": len(cases)}


@router.get("/cases/{case_id}")
def get_case_detail(case_id: str):
    """Return full case detail including findings."""
    case = get_case(case_id)
    if not case:
        raise HTTPException(404, f"Case {case_id} not found")

    findings = get_findings_by_case(case_id)
    return {"case": case, "findings": findings}
