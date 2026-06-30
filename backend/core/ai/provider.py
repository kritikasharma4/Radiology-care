import os
from pathlib import Path
from config import CASES_DIR

# ── key lookup ────────────────────────────────────────────────────────────────

_KEY_VARS = {
    "claude": "ANTHROPIC_API_KEY",
    "openai": "OPENAI_API_KEY",
    "gemini": "GOOGLE_API_KEY",
}


def _active_provider() -> str:
    return os.getenv("AI_PROVIDER", "claude").lower()


def _api_key(provider: str) -> str | None:
    env_var = _KEY_VARS.get(provider)
    return os.getenv(env_var) if env_var else None


# ── public interface ──────────────────────────────────────────────────────────

def get_client():
    """
    Return the configured AI client.
    Falls back to MockClient with a clear reason when no API key is set.
    """
    provider = _active_provider()
    key      = _api_key(provider)

    if not key:
        from core.ai.mock_client import MockClient
        return MockClient(reason=f"No API key found for provider '{provider}'. Set {_KEY_VARS.get(provider, 'API_KEY')} in backend/.env to enable real AI analysis.")

    if provider == "claude":
        from core.ai.claude_client import ClaudeClient
        return ClaudeClient(api_key=key)

    if provider == "openai":
        from core.ai.openai_client import OpenAIClient
        return OpenAIClient(api_key=key)

    # gemini — placeholder
    from core.ai.mock_client import MockClient
    return MockClient(reason=f"Provider '{provider}' is not yet implemented. Supported: claude, openai.")


def get_status() -> dict:
    """Returns provider status — consumed by the frontend warning banner."""
    provider = _active_provider()
    key      = _api_key(provider)
    return {
        "provider":    provider,
        "model":       _model_name(provider),
        "has_key":     bool(key),
        "is_mock":     not bool(key),
        "warning":     None if key else f"Running in demo mode — no API key configured for '{provider}'. AI findings are illustrative mock data.",
    }


def select_images_for_analysis(case_dir: Path, series_type: str, total_slices: int) -> list[str]:
    """
    Choose which images to send to the LLM.
    - Tomosynthesis: first-quartile, middle, third-quartile slices (3 images)
    - 2D / Transpara: representative.jpg only (1 image)
    """
    rep = case_dir / "representative.jpg"

    if series_type != "tomosynthesis" or total_slices <= 1:
        return [str(rep)] if rep.exists() else []

    slices_dir = case_dir / "slices"
    if not slices_dir.exists():
        return [str(rep)] if rep.exists() else []

    def _num(p: Path) -> int:
        try:
            return int(p.stem.split("Img")[-1])
        except (ValueError, IndexError):
            return 0

    all_slices = sorted(slices_dir.glob("*.jpg"), key=_num)
    n = len(all_slices)
    if n == 0:
        return [str(rep)] if rep.exists() else []

    # 5 evenly-spaced slices: 10%, 25%, 50%, 75%, 90% depth
    indices = sorted({
        max(0, int(n * 0.10)),
        max(0, int(n * 0.25)),
        n // 2,
        min(n - 1, int(n * 0.75)),
        min(n - 1, int(n * 0.90)),
    })
    picks = [str(all_slices[i]) for i in indices]
    return picks


# ── private ───────────────────────────────────────────────────────────────────

def _model_name(provider: str) -> str:
    return {
        "claude": "claude-sonnet-4-6 / claude-opus-4-8",
        "openai": "gpt-5.5",
        "gemini": "gemini-1.5-pro",
    }.get(provider, "unknown")
