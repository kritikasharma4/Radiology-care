from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional

from db.repositories.finding_repo import update_finding_review, update_finding_fields

router = APIRouter(prefix="/api", tags=["findings"])


class ReviewRequest(BaseModel):
    status: str                        # accepted | modified | rejected
    reviewed_birads: Optional[int] = None
    reviewer_notes: Optional[str] = None
    reviewed_by: str = "radiologist_1"


@router.patch("/findings/{finding_id}/review")
def review_finding(finding_id: str, body: ReviewRequest):
    """Radiologist accepts, modifies, or rejects an AI finding."""
    valid = {"accepted", "modified", "rejected"}
    if body.status not in valid:
        raise HTTPException(400, f"status must be one of {valid}")

    updated = update_finding_review(
        finding_id=finding_id,
        status=body.status,
        reviewed_birads=body.reviewed_birads,
        reviewer_notes=body.reviewer_notes,
        reviewed_by=body.reviewed_by,
    )
    if not updated:
        raise HTTPException(404, f"Finding {finding_id} not found")

    return {"finding_id": finding_id, "status": body.status, "ok": True}


class FindingEditRequest(BaseModel):
    finding_type: Optional[str] = None
    breast_side: Optional[str] = None
    clock_position: Optional[int] = None
    quadrant: Optional[str] = None
    distance_from_nipple_mm: Optional[float] = None
    depth: Optional[str] = None
    size_length_mm: Optional[float] = None
    size_width_mm: Optional[float] = None
    margin_type: Optional[str] = None
    density_level: Optional[str] = None
    shape: Optional[str] = None
    bi_rads_suggestion: Optional[int] = None
    malignancy_probability: Optional[float] = None
    recommended_action: Optional[str] = None
    calcification_morphology: Optional[str] = None
    calcification_distribution: Optional[str] = None
    ai_reasoning: Optional[str] = None
    reviewer_notes: Optional[str] = None
    reviewed_by: str = "radiologist_1"


@router.patch("/findings/{finding_id}")
def edit_finding(finding_id: str, body: FindingEditRequest):
    """Update all editable clinical fields of a finding and mark as modified."""
    data = body.model_dump(exclude_none=True)

    clinical_keys = {
        'finding_type', 'breast_side', 'clock_position', 'quadrant',
        'distance_from_nipple_mm', 'depth', 'size_length_mm', 'size_width_mm',
        'margin_type', 'density_level', 'shape', 'bi_rads_suggestion',
        'malignancy_probability', 'recommended_action',
        'calcification_morphology', 'calcification_distribution', 'ai_reasoning',
    }
    clinical = {k: v for k, v in data.items() if k in clinical_keys}

    updated = update_finding_fields(finding_id, clinical)
    if not updated:
        raise HTTPException(404, f"Finding {finding_id} not found")

    update_finding_review(
        finding_id=finding_id,
        status="modified",
        reviewed_birads=clinical.get("bi_rads_suggestion"),
        reviewer_notes=data.get("reviewer_notes"),
        reviewed_by=data.get("reviewed_by", "radiologist_1"),
    )

    return {"finding_id": finding_id, "ok": True}
