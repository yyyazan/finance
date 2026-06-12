"""Single-password gate for the API.

The app lives on the open internet but is personal, so one shared password
(``SPROUT_PASSWORD`` env var) unlocks it. Login exchanges the password for a
long-lived HttpOnly cookie holding an HMAC token derived from the password —
stateless (no session table), survives restarts, and rotating the password
revokes every issued cookie at once. When ``SPROUT_PASSWORD`` is unset (local
dev) the gate is disabled entirely.

Only ``/api/*`` is gated: the static SvelteKit shell holds no user data, and
serving it unauthenticated is what lets the frontend render the unlock screen.
"""
from __future__ import annotations

import hashlib
import hmac
import os
import time

from fastapi import APIRouter, Request, Response
from pydantic import BaseModel
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse

COOKIE_NAME = "sprout_session"
COOKIE_MAX_AGE = 90 * 24 * 3600  # ~3 months; re-login is one password away

router = APIRouter(prefix="/api/auth", tags=["auth"])


def _password() -> str:
    return os.environ.get("SPROUT_PASSWORD", "")


def enabled() -> bool:
    return bool(_password())


def _token() -> str:
    """Stateless session token: HMAC of a fixed label keyed by the password."""
    return hmac.new(_password().encode(), b"sprout-session-v1", hashlib.sha256).hexdigest()


def _authed(request: Request) -> bool:
    cookie = request.cookies.get(COOKIE_NAME, "")
    return bool(cookie) and hmac.compare_digest(cookie, _token())


class AuthGateMiddleware(BaseHTTPMiddleware):
    """401 every /api request without a valid session cookie.

    /api/auth/* stays open (it's how you get the cookie); everything else —
    static shell, /healthz — carries no portfolio data and passes through.
    """

    async def dispatch(self, request: Request, call_next):
        path = request.url.path
        if not enabled() or not path.startswith("/api") or path.startswith("/api/auth/"):
            return await call_next(request)
        if _authed(request):
            return await call_next(request)
        return JSONResponse({"detail": "locked"}, status_code=401)


class LoginIn(BaseModel):
    password: str


def _cookie_secure(request: Request) -> bool:
    # Railway terminates TLS upstream; the app sees plain http with the proto
    # in x-forwarded-proto. Local dev is honest http and needs secure=False.
    return request.url.scheme == "https" or request.headers.get("x-forwarded-proto") == "https"


@router.post("/login")
def login(body: LoginIn, request: Request, response: Response):
    if not enabled():
        return {"ok": True}
    if not hmac.compare_digest((body.password or "").encode(), _password().encode()):
        time.sleep(0.5)  # single worker — blunt but effective brute-force drag
        return JSONResponse({"ok": False}, status_code=401)
    response.set_cookie(
        COOKIE_NAME,
        _token(),
        max_age=COOKIE_MAX_AGE,
        httponly=True,
        samesite="lax",
        secure=_cookie_secure(request),
    )
    return {"ok": True}


@router.post("/logout")
def logout(response: Response):
    response.delete_cookie(COOKIE_NAME)
    return {"ok": True}
