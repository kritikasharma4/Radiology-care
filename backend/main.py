from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from db.connection import init_db
from contextlib import asynccontextmanager
import uvicorn

from api.routes import upload, analysis, cases, risk_profile, feedback, etl as etl_routes, findings as findings_routes, auth as auth_routes
from api.middleware.auth_middleware import AuthMiddleware

@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    from db.schema import (
        migrate_add_ai_columns, migrate_add_review_columns,
        migrate_add_clinical_fields, migrate_add_report_text,
        migrate_add_bbox_column, migrate_add_mock_reason, migrate_add_cv_columns,
    )
    migrate_add_ai_columns()
    migrate_add_review_columns()
    migrate_add_clinical_fields()
    migrate_add_report_text()
    migrate_add_bbox_column()
    migrate_add_mock_reason()
    migrate_add_cv_columns()
    from core.ai.provider import get_status
    status = get_status()
    print(f"AI provider: {status['provider']} | key configured: {status['has_key']}")
    if status["is_mock"]:
        print(f"  WARNING: {status['warning']}")
    from core.rag.embedder import initialize_rag
    initialize_rag()
    print("Mammography AI Assistant running")
    yield

app = FastAPI(
    title="Mammography AI Assistant",
    description="Advanced Radiologist Assistance System",
    version="0.1.0",
    lifespan=lifespan
)

app.add_middleware(AuthMiddleware)
import os as _os
_ALLOWED_ORIGINS = [
    "http://localhost:3000",
    *[o.strip() for o in _os.getenv("ALLOWED_ORIGINS", "").split(",") if o.strip()],
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_ALLOWED_ORIGINS,
    allow_origin_regex=r"https://.*\.vercel\.app",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

from config import DATA_DIR
app.mount("/data", StaticFiles(directory=str(DATA_DIR)), name="data")

app.include_router(auth_routes.router)
app.include_router(upload.router)
app.include_router(analysis.router)
app.include_router(cases.router)
app.include_router(risk_profile.router)
app.include_router(feedback.router)
app.include_router(etl_routes.router)
app.include_router(findings_routes.router)

@app.get("/health")
async def health_check():
    return {"status": "ok", "app": "Mammography AI Assistant", "version": "0.1.0"}


@app.get("/api/ai/status")
async def ai_status():
    from core.ai.provider import get_status
    return get_status()

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
