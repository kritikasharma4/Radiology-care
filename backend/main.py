from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from db.connection import init_db
from contextlib import asynccontextmanager
import uvicorn

from api.routes import upload, analysis, cases, risk_profile, feedback

@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    print("Database initialized")
    print("Mammography AI Assistant running")
    yield

app = FastAPI(
    title="Mammography AI Assistant",
    description="Advanced Radiologist Assistance System",
    version="0.1.0",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount("/data", StaticFiles(directory="data"), name="data")

app.include_router(upload.router)
app.include_router(analysis.router)
app.include_router(cases.router)
app.include_router(risk_profile.router)
app.include_router(feedback.router)

@app.get("/health")
async def health_check():
    return {
        "status": "ok",
        "app": "Mammography AI Assistant",
        "version": "0.1.0"
    }

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
