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
    """Prototype store. Replace with PostgreSQL before multi-instance deployment."""

    def __init__(self) -> None:
        self.sessions: dict[str, SessionRecord] = {}
        self.rewards: dict[str, RewardSettings] = {}
        self.lock = Lock()

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
