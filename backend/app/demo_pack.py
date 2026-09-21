"""Fixed, reviewed examples for the prototype subject pack.

This is deliberately separate from the versioned v1 generated math bank.
"""

from __future__ import annotations

import json
import os
import secrets
from pathlib import Path
from threading import Lock

from fastapi import HTTPException
from pydantic import BaseModel, Field


class DemoAttempt(BaseModel):
    session_id: str = Field(min_length=1, max_length=80)
    question_id: str = Field(min_length=1, max_length=80)
    response: str | list[str]


_content_dir = Path(os.environ["RABBIT_QUESTION_BANK"]).parent if "RABBIT_QUESTION_BANK" in os.environ else Path(__file__).resolve().parents[2] / "content"
_questions = {item["id"]: item for item in json.loads(
    (_content_dir / "demo-pack.json").read_text(encoding="utf-8")
)["questions"]}
_sessions: dict[str, dict[str, dict]] = {}
_lock = Lock()


def demo_questions() -> list[dict]:
    """Return the reviewed questions in the same order used by the kid view."""
    return list(_questions.values())


def create_demo_session() -> dict:
    session_id = secrets.token_urlsafe(18)
    with _lock:
        _sessions[session_id] = {}
    return {"id": session_id, "questions": [
        {key: value for key, value in question.items() if key not in {"answer", "feedback"}}
        for question in demo_questions()
    ]}


def grade_demo_attempt(attempt: DemoAttempt) -> dict:
    question = _questions.get(attempt.question_id)
    if question is None:
        raise HTTPException(404, "Question not found")
    kind = question["kind"]
    value = attempt.response
    if kind in {"single-select", "multi-select"}:
        valid = {choice["id"] for choice in question["choices"]}
        if kind == "single-select":
            if not isinstance(value, str) or value not in valid:
                raise HTTPException(400, "Choose one valid answer")
            correct = value == question["answer"]
        else:
            if not isinstance(value, list) or len(value) != len(set(value)) or not value or not set(value) <= valid:
                raise HTTPException(400, "Choose unique valid answers")
            correct = set(value) == set(question["answer"])
    elif kind == "reorder":
        valid = {tile["id"] for tile in question["tiles"]}
        if not isinstance(value, list) or len(value) != len(valid) or set(value) != valid:
            raise HTTPException(400, "Arrange every tile exactly once")
        correct = value == question["answer"]
    else:
        if not isinstance(value, str) or not 1 <= len(value.strip()) <= 200:
            raise HTTPException(400, "Enter an answer of 1 to 200 characters")
        normalize = lambda text: " ".join(text.strip().rstrip(".!").casefold().split())
        correct = normalize(value) == normalize(question["answer"])

    result = {"correct": correct, "feedback": question["feedback"], "points_earned": 10 if correct else 0}
    with _lock:
        session = _sessions.get(attempt.session_id)
        if session is None:
            raise HTTPException(404, "Demo session not found")
        previous = session.get(attempt.question_id)
        if previous:
            if previous["response"] == value:
                return previous["result"]
            raise HTTPException(409, "Question already answered")
        session[attempt.question_id] = {"response": value, "result": result}
    return result
