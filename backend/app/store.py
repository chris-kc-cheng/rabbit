from __future__ import annotations

from collections import Counter
from dataclasses import dataclass, field
from datetime import UTC, datetime
from threading import Lock

from .engine import GeneratedQuestion
from .models import RewardSettings
from .auth import hash_password
import os


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
        self.include_drafts = False
        admin_password = os.environ.get("RABBIT_ADMIN_PASSWORD")
        if not admin_password:
            raise RuntimeError("RABBIT_ADMIN_PASSWORD is required")
        self.create_user("admin", "admin", admin_password, "Rabbit administrator")

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
        history = sorted(attempts, key=lambda item: item["answered_at"], reverse=True)
        return {
            "learner_id": learner_id,
            "attempts": len(attempts),
            "correct": correct,
            "points": sum(attempt.get("points_earned", 10 if attempt["correct"] else 0) for attempt in attempts),
            "accuracy": round(correct / len(attempts), 3) if attempts else 0,
            "hints_used": sum(attempt.get("hint_used", False) for attempt in attempts),
            "misconceptions": dict(misconceptions),
            "recent_attempts": history[:10],
            "attempt_history": history,
            "reward": self.rewards.get(learner_id, RewardSettings()),
        }

    def family_progress(self, parent_id: str) -> dict:
        return {
            "family_id": parent_id,
            "learners": [
                {"id": learner["id"], "name": learner["display_name"], "progress": self.progress(learner["id"])}
                for learner in self.users.values()
                if learner["role"] == "learner" and learner["parent_id"] == parent_id
            ],
        }

    @staticmethod
    def now() -> str:
        return datetime.now(UTC).isoformat()


store = MemoryStore()
