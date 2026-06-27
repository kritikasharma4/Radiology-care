from fastapi import APIRouter
from pydantic import BaseModel
from typing import Optional
from core.clinical.risk_calculator import calculate_risk

router = APIRouter(prefix="/api", tags=["risk"])


class RiskRequest(BaseModel):
    age:                    int
    family_history:         Optional[bool] = False
    personal_breast_cancer: Optional[bool] = False
    brca_mutation:          Optional[str]  = "unknown"   # positive | negative | unknown
    menopause_status:       Optional[str]  = "unknown"   # pre | peri | post | unknown
    hormone_therapy:        Optional[bool] = False
    previous_biopsy:        Optional[bool] = False


@router.post("/risk")
def calculate_patient_risk(body: RiskRequest):
    """
    Calculates breast cancer risk score using Gail Model + ACR guidelines.
    Returns baseline risk, multipliers, final score, and risk category.
    """
    risk = calculate_risk(body.model_dump())
    return risk
