from __future__ import annotations

from collections import Counter
from dataclasses import dataclass, field
from datetime import UTC, datetime
from threading import Lock

from .engine import GeneratedQuestion
from .models import RewardSettings


@dataclass
class SessionRecord:
    learner_id: str
    questions: dict[str, GeneratedQuestion]
    attempts: dict[str, dict] = field(default_factory=dict)


class MemoryStore:
    """Temporary store for practice data not yet moved to PostgreSQL."""

    def __init__(self) -> None:
        self.sessions: dict[str, SessionRecord] = {}
        self.rewards: dict[str, RewardSettings] = {}
        self.lock = Lock()
        self.imported_banks: dict[str, dict] = {}
        self.revoked_tokens: set[str] = set()
        self.include_drafts = False

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
            "points": sum(attempt.get("points_earned", 10 if attempt["correct"] else 0) for attempt in attempts),
            "accuracy": round(correct / len(attempts), 3) if attempts else 0,
            "hints_used": sum(attempt.get("hint_used", False) for attempt in attempts),
            "misconceptions": dict(misconceptions),
            "recent_attempts": recent,
            "reward": self.rewards.get(learner_id, RewardSettings()),
        }

    @staticmethod
    def now() -> str:
        return datetime.now(UTC).isoformat()


store = MemoryStore()
