import os
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

router = APIRouter(prefix="/api/auth", tags=["auth"])

DEMO_USERNAME = "radiologist"
DEMO_PASSWORD = "radcare2024"


class LoginRequest(BaseModel):
    username: str
    password: str


@router.post("/login")
def login(body: LoginRequest):
    token = os.getenv("API_SECRET_KEY") or "rc-demo-secret-2024"

    if body.username != DEMO_USERNAME or body.password != DEMO_PASSWORD:
        raise HTTPException(status_code=401, detail="Invalid credentials")

    return {"token": token, "username": body.username}


@router.post("/logout")
def logout():
    return {"ok": True}
