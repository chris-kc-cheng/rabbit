"""Small, dependency-free JWT and password primitives for the prototype.

The memory identity repository is intentionally replaceable; these primitives keep
password material out of that repository and enforce token expiry on every request.
"""
from __future__ import annotations

import base64
import hashlib
import hmac
import json
import os
import secrets
import time
from typing import Any

from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from .database import get_db


if os.environ.get("RABBIT_ENV") == "production" and not os.environ.get("RABBIT_JWT_SECRET"):
    raise RuntimeError("RABBIT_JWT_SECRET is required in production")
JWT_SECRET = os.environ.get("RABBIT_JWT_SECRET", secrets.token_urlsafe(48))
JWT_TTL_SECONDS = int(os.environ.get("RABBIT_JWT_TTL_SECONDS", "3600"))
bearer = HTTPBearer(auto_error=False)


def hash_password(password: str) -> str:
    salt = secrets.token_bytes(16)
    digest = hashlib.scrypt(password.encode(), salt=salt, n=2**14, r=8, p=1)
    return f"scrypt${_encode(salt)}${_encode(digest)}"


def verify_password(password: str, encoded: str) -> bool:
    try:
        algorithm, salt, expected = encoded.split("$")
        if algorithm != "scrypt":
            return False
        actual = hashlib.scrypt(password.encode(), salt=_decode(salt), n=2**14, r=8, p=1)
        return hmac.compare_digest(actual, _decode(expected))
    except (ValueError, TypeError):
        return False


def _encode(value: bytes) -> str:
    return base64.urlsafe_b64encode(value).rstrip(b"=").decode()


def _decode(value: str) -> bytes:
    return base64.urlsafe_b64decode(value + "=" * (-len(value) % 4))


def issue_token(user: dict[str, Any]) -> tuple[str, int]:
    now = int(time.time())
    expires = now + JWT_TTL_SECONDS
    header = _encode(json.dumps({"alg": "HS256", "typ": "JWT"}, separators=(",", ":")).encode())
    payload = _encode(json.dumps({"sub": user["id"], "role": user["role"], "ver": user["token_version"],
                                  "jti": secrets.token_urlsafe(12), "iat": now, "exp": expires}, separators=(",", ":")).encode())
    signature = _encode(hmac.new(JWT_SECRET.encode(), f"{header}.{payload}".encode(), hashlib.sha256).digest())
    return f"{header}.{payload}.{signature}", expires


def decode_token(token: str) -> dict[str, Any]:
    try:
        header, payload, signature = token.split(".")
        expected = _encode(hmac.new(JWT_SECRET.encode(), f"{header}.{payload}".encode(), hashlib.sha256).digest())
        if not hmac.compare_digest(signature, expected):
            raise ValueError
        claims = json.loads(_decode(payload))
        if not isinstance(claims.get("exp"), int) or claims["exp"] <= int(time.time()):
            raise HTTPException(401, "Your session has expired. Please log in again.")
        return claims
    except HTTPException:
        raise
    except (ValueError, KeyError, json.JSONDecodeError):
        raise HTTPException(401, "Invalid login session") from None


def current_user(credentials: HTTPAuthorizationCredentials | None = Depends(bearer),
                 db: Session = Depends(get_db)) -> dict:
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise HTTPException(401, "Please log in")
    from .repositories import IdentityRepository, user_record
    from .store import store
    claims = decode_token(credentials.credentials)
    model = IdentityRepository(db).get_by_id(claims["sub"])
    user = user_record(model) if model is not None else None
    if (user is None or user.get("disabled") or user["role"] != claims["role"]
            or user["token_version"] != claims.get("ver") or claims.get("jti") in store.revoked_tokens):
        raise HTTPException(401, "This login is no longer active")
    return user


def require_role(*roles: str):
    def dependency(user: dict = Depends(current_user)) -> dict:
        if user["role"] not in roles:
            raise HTTPException(403, "You do not have access to this area")
        return user
    return dependency
