import os
from fastapi import Request
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware

# Paths that never require a token
_SKIP_PREFIXES = (
    "/api/auth/",
    "/health",
    "/data/",
    "/docs",
    "/openapi.json",
    "/redoc",
)


class AuthMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        # Always allow CORS preflight
        if request.method == "OPTIONS":
            return await call_next(request)

        path = request.url.path

        if any(path.startswith(p) for p in _SKIP_PREFIXES):
            return await call_next(request)

        # Only protect /api/* routes
        if not path.startswith("/api/"):
            return await call_next(request)

        expected_token = os.getenv("API_SECRET_KEY", "rc-demo-secret-2024")
        auth_header    = request.headers.get("Authorization", "")

        if auth_header == f"Bearer {expected_token}":
            return await call_next(request)

        return JSONResponse(
            status_code=401,
            content={"detail": "Authentication required. Please log in."},
        )
