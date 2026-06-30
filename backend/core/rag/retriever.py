"""
RAG retrieval — cosine similarity search over embedded clinical chunks.
Used by the ETL analysis pipeline and the AI chat endpoint.
"""
import os
import numpy as np

from core.rag.embedder import get_store, _embed_texts


def _cosine_similarity(a: list[float], b: list[float]) -> float:
    va = np.array(a, dtype=np.float32)
    vb = np.array(b, dtype=np.float32)
    denom = np.linalg.norm(va) * np.linalg.norm(vb)
    return float(np.dot(va, vb) / denom) if denom > 0 else 0.0


def retrieve_clinical_context(query: str, n_results: int = 4) -> str:
    """
    Retrieve top-N relevant clinical reference chunks for a query string.
    Returns formatted text ready to inject into an LLM prompt.
    Returns empty string if store unavailable or API key missing.
    """
    store = get_store()
    if not store:
        return ""

    api_key = os.getenv("OPENAI_API_KEY", "")
    if not api_key:
        return ""

    try:
        query_vec = _embed_texts([query])[0]
    except Exception as exc:
        print(f"[RAG] Query embedding failed: {exc}")
        return ""

    scored = [
        (chunk, _cosine_similarity(query_vec, chunk["embedding"]))
        for chunk in store
    ]
    scored.sort(key=lambda x: x[1], reverse=True)
    top = scored[:n_results]

    lines = []
    for chunk, score in top:
        source = chunk["metadata"].get("source", "Clinical Reference")
        lines.append(f"[{source}]\n{chunk['text']}")

    return "\n\n---\n\n".join(lines)


def build_analysis_query(cv_result: dict, patient_ctx: dict) -> str:
    """
    Build a semantic query from CV detection output and patient context.
    """
    parts = ["mammography BI-RADS assessment findings management"]

    score = cv_result.get("suspicion_score") if cv_result else None
    if score is not None:
        if score >= 0.7:
            parts.append("suspicious mass spiculated margin irregular shape high malignancy probability biopsy")
        elif score >= 0.4:
            parts.append("probably benign mass short interval follow-up BI-RADS 3 4A calcifications")
        else:
            parts.append("benign findings routine screening BI-RADS 1 2 circumscribed mass")

    density = cv_result.get("density_class") if cv_result else None
    if density in ("C", "D"):
        parts.append("heterogeneously dense extremely dense breast tissue supplemental ultrasound")
    elif density in ("A", "B"):
        parts.append("fatty replaced scattered fibroglandular breast density")

    regions = cv_result.get("suspicious_regions", []) if cv_result else []
    if len(regions) > 1:
        parts.append("multiple suspicious regions architectural distortion asymmetry calcification cluster")

    if patient_ctx.get("family_history"):
        parts.append("high risk family history management surveillance")

    if patient_ctx.get("brca_mutation") not in (None, "unknown", "negative"):
        parts.append("BRCA mutation high risk enhanced screening MRI")

    return " ".join(parts)
