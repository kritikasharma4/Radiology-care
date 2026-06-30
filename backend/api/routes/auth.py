import os
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

router = APIRouter(prefix="/api/auth", tags=["auth"])


class LoginRequest(BaseModel):
    username: str
    password: str


@router.post("/login")
def login(body: LoginRequest):
    expected_user = os.getenv("DEMO_USERNAME") or "radiologist"
    expected_pass = os.getenv("DEMO_PASSWORD") or "radcare2024"
    token         = os.getenv("API_SECRET_KEY") or "rc-demo-secret-2024"

    if body.username != expected_user or body.password != expected_pass:
        raise HTTPException(status_code=401, detail="Invalid credentials")

    return {"token": token, "username": body.username}


@router.post("/logout")
def logout():
    return {"ok": True}
