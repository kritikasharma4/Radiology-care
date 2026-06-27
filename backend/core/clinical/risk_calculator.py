def calculate_risk(patient: dict) -> dict:
    """
    Calculates patient risk score using standard medical multipliers.
    Based on Gail Model + ACR guidelines.
    """
    age = patient.get("age") or 50

    baseline  = _baseline_by_age(age)
    fh_mult   = 1.2 if patient.get("family_history")         else 1.0
    brca_mult = _brca_multiplier(patient.get("brca_mutation", "unknown"))
    meno_mult = _menopause_multiplier(patient.get("menopause_status", "unknown"))
    hrt_mult  = 1.1 if patient.get("hormone_therapy")        else 1.0
    bx_mult   = 1.5 if patient.get("previous_biopsy")        else 1.0
    ca_mult   = 2.0 if patient.get("personal_breast_cancer") else 1.0

    final_risk = baseline * fh_mult * brca_mult * meno_mult * hrt_mult * bx_mult * ca_mult
    final_risk = round(min(final_risk, 1.0), 4)

    return {
        "baseline_risk":             baseline,
        "family_history_multiplier": fh_mult,
        "brca_multiplier":           brca_mult,
        "menopause_multiplier":      meno_mult,
        "hrt_multiplier":            hrt_mult,
        "overall_risk_score":        final_risk,
        "patient_risk_category":     _categorize(final_risk),
    }

def _baseline_by_age(age: int) -> float:
    if age < 40: return 0.10
    if age < 50: return 0.12
    if age < 60: return 0.15
    if age < 70: return 0.18
    return 0.20

def _brca_multiplier(status: str) -> float:
    return {"positive": 2.5, "negative": 1.0}.get(status, 1.1)

def _menopause_multiplier(status: str) -> float:
    return {"post": 1.15, "peri": 1.1, "pre": 1.0}.get(status, 1.05)

def _categorize(risk: float) -> str:
    if risk < 0.15: return "low"
    if risk < 0.25: return "intermediate"
    return "high"
