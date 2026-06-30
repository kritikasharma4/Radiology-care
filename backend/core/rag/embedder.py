"""
Lightweight RAG embedder — no external vector store.
Embeds clinical chunks via OpenAI text-embedding-3-small,
caches to data/rag_embeddings.json so restarts are instant.
Uses numpy cosine similarity for retrieval (already in requirements).
"""
import json
import os
from pathlib import Path

import numpy as np

from core.rag.clinical_knowledge import CLINICAL_CHUNKS

CACHE_FILE = Path(__file__).parent.parent.parent / "data" / "rag_embeddings.json"

# Module-level cache: list of {id, text, metadata, embedding (list[float])}
_store: list[dict] = []


def _embed_texts(texts: list[str]) -> list[list[float]]:
    from openai import OpenAI
    client = OpenAI(api_key=os.getenv("OPENAI_API_KEY", ""))
    resp = client.embeddings.create(
        model="text-embedding-3-small",
        input=texts,
    )
    return [item.embedding for item in resp.data]


def initialize_rag() -> bool:
    """
    Load embeddings from cache or compute them via OpenAI API.
    Called once from main.py lifespan. Returns True on success.
    """
    global _store

    # Load from cache if it exists and covers all current chunks
    if CACHE_FILE.exists():
        try:
            cached = json.loads(CACHE_FILE.read_text(encoding="utf-8"))
            cached_ids = {c["id"] for c in cached}
            chunk_ids  = {c["id"] for c in CLINICAL_CHUNKS}
            if chunk_ids.issubset(cached_ids):
                _store = cached
                print(f"[RAG] Loaded {len(_store)} chunks from cache")
                return True
        except Exception as exc:
            print(f"[RAG] Cache load failed ({exc}) — re-embedding")

    # Compute embeddings
    api_key = os.getenv("OPENAI_API_KEY", "")
    if not api_key:
        print("[RAG] Skipping — OPENAI_API_KEY not set")
        return False

    try:
        print(f"[RAG] Embedding {len(CLINICAL_CHUNKS)} clinical chunks via OpenAI...")
        texts = [c["text"] for c in CLINICAL_CHUNKS]
        vectors = _embed_texts(texts)

        _store = [
            {
                "id":        chunk["id"],
                "text":      chunk["text"],
                "metadata":  chunk["metadata"],
                "embedding": vec,
            }
            for chunk, vec in zip(CLINICAL_CHUNKS, vectors)
        ]

        CACHE_FILE.parent.mkdir(parents=True, exist_ok=True)
        CACHE_FILE.write_text(json.dumps(_store, ensure_ascii=False), encoding="utf-8")
        print(f"[RAG] Done — {len(_store)} chunks cached to {CACHE_FILE.name}")
        return True

    except Exception as exc:
        print(f"[RAG] Initialization failed: {exc}")
        return False


def get_store() -> list[dict]:
    return _store
