from __future__ import annotations

from collections import Counter
from dataclasses import dataclass, field
from datetime import UTC, datetime
from threading import Lock

from .engine import GeneratedQuestion
from .models import RewardSettings
from .auth import hash_password


@dataclass
class SessionRecord:
    learner_id: str
    questions: dict[str, GeneratedQuestion]
    attempts: dict[str, dict] = field(default_factory=dict)


class MemoryStore:
    """Prototype store. Replace with PostgreSQL before multi-instance deployment."""

    def __init__(self) -> None:
        self.sessions: dict[str, SessionRecord] = {}
        self.rewards: dict[str, RewardSettings] = {}
        self.lock = Lock()
        self.users: dict[str, dict] = {}
        self.usernames: dict[str, str] = {}
        self.imported_banks: dict[str, dict] = {}
        self.revoked_tokens: set[str] = set()
        self.create_user("admin", "admin", __import__("os").environ.get("RABBIT_ADMIN_PASSWORD", "rabbit-admin"), "Rabbit administrator")

    def create_user(self, role: str, username: str, password: str, display_name: str, parent_id: str | None = None) -> dict:
        normalized = username.strip().casefold()
        if normalized in self.usernames:
            raise ValueError("That username is already in use")
        import secrets
        user_id = secrets.token_urlsafe(10)
        user = {"id": user_id, "role": role, "username": normalized, "display_name": display_name.strip(),
                "password_hash": hash_password(password), "parent_id": parent_id, "disabled": False, "token_version": 1}
        self.users[user_id] = user
        self.usernames[normalized] = user_id
        return user

    @staticmethod
    def public_user(user: dict) -> dict:
        return {key: user[key] for key in ("id", "role", "username", "display_name", "parent_id")}

    def progress(self, learner_id: str) -> dict:
        attempts = [
            attempt
            for session in self.sessions.values()
            if session.learner_id == learner_id
            for attempt in session.attempts.values()
        ]
        misconceptions = Counter(
            attempt["misconception_id"] for attempt in attempts if attempt["misconception_id"]
        )
        correct = sum(attempt["correct"] for attempt in attempts)
        recent = sorted(attempts, key=lambda item: item["answered_at"], reverse=True)[:10]
        return {
            "learner_id": learner_id,
            "attempts": len(attempts),
            "correct": correct,
            "points": correct * 10,
            "accuracy": round(correct / len(attempts), 3) if attempts else 0,
            "misconceptions": dict(misconceptions),
            "recent_attempts": recent,
            "reward": self.rewards.get(learner_id, RewardSettings()),
        }

    @staticmethod
    def now() -> str:
        return datetime.now(UTC).isoformat()


store = MemoryStore()
