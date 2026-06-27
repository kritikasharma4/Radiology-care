from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
from db.repositories.feedback_repo import create_feedback, get_feedback_by_finding
from db.repositories.case_repo import get_case
from db.repositories.finding_repo import get_findings_by_case

router = APIRouter(prefix="/api", tags=["feedback"])


class FeedbackRequest(BaseModel):
    case_id:                str
    finding_id:             str
    radiologist_action:     str          # confirmed | corrected | dismissed
    radiologist_reason:     Optional[str] = None
    corrected_bi_rads:      Optional[int] = None
    corrected_finding_type: Optional[str] = None
    corrected_size_mm:      Optional[float] = None
    correction_notes:       Optional[str] = None
    radiologist_id:         Optional[str] = "demo_radiologist"
    use_for_retraining:     Optional[int] = 1


@router.post("/feedback")
def submit_feedback(body: FeedbackRequest):
    """
    Radiologist confirms, corrects, or dismisses an AI finding.
    Stored for model retraining and audit trail.
    """
    case = get_case(body.case_id)
    if not case:
        raise HTTPException(404, f"Case {body.case_id} not found")

    feedback_id = create_feedback(body.model_dump())
    return {
        "feedback_id": feedback_id,
        "message":     f"Feedback recorded: {body.radiologist_action}",
    }


@router.get("/feedback/{finding_id}")
def get_feedback(finding_id: str):
    """Fetch all radiologist feedback for a specific finding."""
    records = get_feedback_by_finding(finding_id)
    return {"finding_id": finding_id, "feedback": records, "total": len(records)}
