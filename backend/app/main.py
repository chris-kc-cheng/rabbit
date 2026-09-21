from __future__ import annotations

import secrets
import time

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from .engine import generate_session, load_bank
from .demo_pack import DemoAttempt, create_demo_session, grade_demo_attempt
from .models import (
    AttemptCreate,
    AttemptResult,
    ProgressResponse,
    RewardSettings,
    SessionCreate,
    SessionResponse,
)
from .store import SessionRecord, store

app = FastAPI(title="Rabbit Learning API", version="0.1.0", docs_url="/api/docs", openapi_url="/api/openapi.json")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/v1/health")
def health() -> dict[str, str]:
    return {"status": "ok", "service": "rabbit-api"}


@app.post("/api/v1/demo-pack/sessions", status_code=201)
def start_demo_pack() -> dict:
    return create_demo_session()


@app.post("/api/v1/demo-pack/attempts")
def submit_demo_pack_attempt(attempt: DemoAttempt) -> dict:
    return grade_demo_attempt(attempt)


@app.get("/api/v1/subjects")
def subjects() -> list[dict]:
    bank = load_bank()
    return [{"id": bank["subject"], "title": "Elementary Math", "template_count": len(bank["templates"])}]


@app.post("/api/v1/sessions", response_model=SessionResponse, status_code=201)
def create_session(request: SessionCreate) -> SessionResponse:
    session_id = secrets.token_urlsafe(12)
    generated = generate_session(request.seed if request.seed is not None else time.time_ns(), request.count)
    store.sessions[session_id] = SessionRecord(
        learner_id=request.learner_id,
        questions={question.public.id: question for question in generated},
    )
    return SessionResponse(id=session_id, learner_id=request.learner_id, questions=[q.public for q in generated])


@app.post("/api/v1/attempts", response_model=AttemptResult)
def submit_attempt(request: AttemptCreate) -> AttemptResult:
    session = store.sessions.get(request.session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    question = session.questions.get(request.question_id)
    if not question:
        raise HTTPException(status_code=404, detail="Question not found")
    if request.question_id in session.attempts:
        raise HTTPException(status_code=409, detail="Question already answered")
    choice = question.choices.get(request.choice_id)
    if not choice:
        raise HTTPException(status_code=400, detail="Choice is not valid for this question")

    correct = request.choice_id == question.correct_choice_id
    attempt = {
        "question_id": request.question_id,
        "template_id": question.public.template_id,
        "skill": question.public.skill,
        "selected_value": choice["value"],
        "correct": correct,
        "misconception_id": choice["misconception"],
        "answered_at": store.now(),
    }
    with store.lock:
        session.attempts[request.question_id] = attempt
    return AttemptResult(
        correct=correct,
        correct_choice_id=question.correct_choice_id,
        feedback=question.explanation if correct else choice["feedback"],
        explanation=question.explanation,
        misconception_id=choice["misconception"],
        points_earned=10 if correct else 0,
    )


@app.get("/api/v1/parents/learners/{learner_id}/progress", response_model=ProgressResponse)
def learner_progress(learner_id: str) -> dict:
    return store.progress(learner_id)


@app.put("/api/v1/parents/learners/{learner_id}/reward", response_model=RewardSettings)
def update_reward(learner_id: str, reward: RewardSettings) -> RewardSettings:
    store.rewards[learner_id] = reward
    return reward
