from fastapi import APIRouter, HTTPException
from pathlib import Path
from pydantic import BaseModel
from typing import Optional, List
from config import CASES_DIR
from db.repositories.case_repo import get_case, get_all_cases, sign_off_case, update_case_patient_data, save_report_text, update_case_assessment
from db.repositories.finding_repo import get_findings_by_case
from core.rag.retriever import retrieve_clinical_context

router = APIRouter(prefix="/api", tags=["cases"])


@router.get("/cases")
def list_cases():
    """Return all cases for the dashboard, most recent first."""
    cases = get_all_cases()
    return {"cases": cases, "total": len(cases)}


@router.get("/cases/{case_id}/slices")
def get_case_slices(case_id: str):
    """
    Return ordered list of slice image URLs for a case.
    Used by the tomosynthesis slice viewer.
    """
    case = get_case(case_id)
    if not case:
        raise HTTPException(404, f"Case {case_id} not found")

    safe_pid   = (case.get("patient_id") or "").replace(" ", "_")
    slices_dir = CASES_DIR / safe_pid / "slices"

    if not slices_dir.exists():
        return {"slices": [], "total": 0, "series_type": case.get("series_type", "2d")}

    def _img_num(p):
        try:
            return int(p.stem.split("Img")[-1])
        except (ValueError, IndexError):
            return 0

    files = sorted(slices_dir.glob("*.jpg"), key=_img_num)
    urls  = [f"/data/cases/{safe_pid}/slices/{f.name}" for f in files]

    return {
        "slices":      urls,
        "total":       len(urls),
        "series_type": case.get("series_type", "2d"),
    }


class SignOffRequest(BaseModel):
    signed_off_by: Optional[str] = "radiologist_1"


@router.post("/cases/{case_id}/signoff")
def signoff_case(case_id: str, body: SignOffRequest = None):
    """Radiologist signs off — marks the case as reviewed and locked."""
    reviewer = (body.signed_off_by if body else None) or "radiologist_1"
    updated = sign_off_case(case_id, reviewer)
    if not updated:
        raise HTTPException(404, f"Case {case_id} not found")
    return {"case_id": case_id, "signed_off": True, "signed_off_by": reviewer}


class PatientUpdateRequest(BaseModel):
    patient_name: Optional[str] = None
    age: Optional[int] = None
    sex: Optional[str] = None
    study_date: Optional[str] = None
    menopause_status: Optional[str] = None
    brca_mutation: Optional[str] = None
    family_history: Optional[bool] = None
    personal_breast_cancer: Optional[bool] = None
    hormone_therapy: Optional[bool] = None
    breast_implants: Optional[bool] = None
    previous_surgery: Optional[bool] = None
    previous_biopsy: Optional[bool] = None
    reported_lump: Optional[bool] = None
    reported_pain: Optional[bool] = None
    reported_nipple_discharge: Optional[bool] = None
    overall_case_urgency: Optional[str] = None


@router.patch("/cases/{case_id}")
def update_case_patient(case_id: str, body: PatientUpdateRequest):
    """Update patient demographics and clinical history fields."""
    case = get_case(case_id)
    if not case:
        raise HTTPException(404, f"Case {case_id} not found")
    data = body.model_dump(exclude_unset=True)
    update_case_patient_data(case_id, data)
    updated = get_case(case_id)
    return {"case": updated}


class ReportUpdateRequest(BaseModel):
    final_report_text: str


@router.patch("/cases/{case_id}/report")
def update_report_text(case_id: str, body: ReportUpdateRequest):
    """Save radiologist-edited report text for a case."""
    if not get_case(case_id):
        raise HTTPException(404, f"Case {case_id} not found")
    save_report_text(case_id, body.final_report_text)
    return {"case_id": case_id, "saved": True}


class AssessmentUpdateRequest(BaseModel):
    overall_birads: Optional[int] = None
    overall_impression: Optional[str] = None
    recommended_management: Optional[str] = None
    density_category: Optional[str] = None


@router.patch("/cases/{case_id}/assessment")
def update_case_assessment_route(case_id: str, body: AssessmentUpdateRequest):
    """Radiologist corrects case-level AI assessment (BI-RADS, impression, management, density)."""
    if not get_case(case_id):
        raise HTTPException(404, f"Case {case_id} not found")
    data = body.model_dump(exclude_none=True)
    update_case_assessment(case_id, data)
    updated = get_case(case_id)
    return {"case": updated}


@router.get("/cases/{case_id}")
def get_case_detail(case_id: str):
    """Return full case detail including findings."""
    case = get_case(case_id)
    if not case:
        raise HTTPException(404, f"Case {case_id} not found")

    findings = get_findings_by_case(case_id)
    return {"case": case, "findings": findings}


class ChatMessage(BaseModel):
    role: str   # "user" or "assistant"
    content: str

class ChatRequest(BaseModel):
    message: str
    history: List[ChatMessage] = []

@router.post("/cases/{case_id}/chat")
def chat_with_case(case_id: str, body: ChatRequest):
    """
    AI chat grounded in a specific case's findings, CV scores, and patient context.
    Uses GPT-4.1 (or active provider) — no images, structured data only.
    """
    case = get_case(case_id)
    if not case:
        raise HTTPException(404, f"Case {case_id} not found")

    findings = get_findings_by_case(case_id)

    # Build structured case summary for the LLM
    finding_lines = []
    for i, f in enumerate(findings, 1):
        line = (
            f"  Finding {i}: {f.get('finding_type','unknown')} | "
            f"{f.get('breast_side','?')} breast | "
            f"Clock {f.get('clock_position','?')} | "
            f"BI-RADS {f.get('bi_rads_suggestion','?')} | "
            f"Malignancy prob {f.get('malignancy_probability','?')} | "
            f"Margin: {f.get('margin_type','?')} | Shape: {f.get('shape','?')}"
        )
        finding_lines.append(line)

    cv_line = ""
    if case.get("cv_model") and case.get("cv_suspicion_score") is not None:
        cv_line = (
            f"\nCV Detection ({case['cv_model']}): "
            f"suspicion score {case['cv_suspicion_score']:.2f}, "
            f"density class {case.get('cv_density_class','unknown')}"
        )

    # RAG lookup — retrieve clinical reference relevant to the radiologist's question
    rag_context = retrieve_clinical_context(body.message, n_results=3)
    rag_section = ""
    if rag_context:
        rag_section = f"""

CLINICAL REFERENCE MATERIAL (ACR BI-RADS knowledge base — cite specific criteria when relevant):
{rag_context}
"""

    system_prompt = f"""You are an AI radiology assistant helping a radiologist review a mammography case.
You have full access to the case data and ACR BI-RADS clinical references below.
Answer questions clearly, citing specific BI-RADS criteria when relevant.
Always remind the radiologist that all findings require their clinical review and sign-off.
Do not speculate beyond the data and references provided.

CASE DATA:
Patient ID: {case.get('patient_id')}
Overall BI-RADS: {case.get('overall_birads')}
Overall Impression: {case.get('overall_impression')}
Density: ACR {case.get('density_category')} — {case.get('density_confidence',0)*100:.0f}% confidence
Recommended Management: {case.get('recommended_management')}
Urgency: {case.get('overall_case_urgency')}{cv_line}

FINDINGS ({len(findings)} total):
{chr(10).join(finding_lines) if finding_lines else '  No findings detected.'}

Patient Context:
- Age: {case.get('age') or 'unknown'}
- Family history: {'Yes' if case.get('family_history') else 'unknown'}
- Reported lump: {'Yes' if case.get('reported_lump') else 'No'}
- Reported pain: {'Yes' if case.get('reported_pain') else 'No'}
{rag_section}"""

    # Build message history for the API call
    messages = [{"role": "system", "content": system_prompt}]
    for msg in body.history[-10:]:  # last 10 messages for context
        messages.append({"role": msg.role, "content": msg.content})
    messages.append({"role": "user", "content": body.message})

    try:
        import os
        from openai import OpenAI
        client = OpenAI(api_key=os.getenv("OPENAI_API_KEY", ""))
        resp = client.chat.completions.create(
            model="gpt-5.5",
            messages=messages,
            max_completion_tokens=1024,
        )
        reply = resp.choices[0].message.content.strip()
    except Exception as exc:
        reply = f"I'm unable to respond right now ({type(exc).__name__}). Please check the API configuration."

    return {"reply": reply}
