from __future__ import annotations

import json
import secrets
import time

from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPAuthorizationCredentials
from jsonschema import Draft202012Validator

from .auth import bearer, decode_token, hash_password, issue_token, require_role, verify_password
from .demo_pack import DemoAttempt, create_demo_session, grade_demo_attempt
from .engine import BANK_DIRECTORY, generate_session, load_banks
from .models import (
    AttemptCreate,
    AttemptResult,
    ContentSettings,
    LearnerCreate,
    LoginRequest,
    ParentCreate,
    PasswordRequest,
    ProgressResponse,
    QuestionImport,
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


def public_user(user: dict) -> dict:
    return store.public_user(user)


@app.post("/api/v1/auth/login")
def login(request: LoginRequest) -> dict:
    user_id = store.usernames.get(request.username.strip().casefold())
    user = store.users.get(user_id or "")
    if user is None or user["disabled"] or not verify_password(request.password, user["password_hash"]):
        raise HTTPException(401, "Username or password is not correct")
    token, expires_at = issue_token(user)
    return {"access_token": token, "token_type": "bearer", "expires_at": expires_at, "user": public_user(user)}


@app.get("/api/v1/auth/me")
def me(user: dict = Depends(require_role("admin", "parent", "learner"))) -> dict:
    return public_user(user)


@app.post("/api/v1/auth/logout", status_code=204)
def logout(credentials: HTTPAuthorizationCredentials = Depends(bearer),
           _: dict = Depends(require_role("admin", "parent", "learner"))) -> None:
    store.revoked_tokens.add(decode_token(credentials.credentials)["jti"])


@app.get("/api/v1/admin/users")
def list_managed_users(_: dict = Depends(require_role("admin"))) -> list[dict]:
    return [public_user(user) for user in store.users.values() if user["role"] in {"parent", "learner"}]


@app.post("/api/v1/admin/parents", status_code=201)
def create_parent(request: ParentCreate, _: dict = Depends(require_role("admin"))) -> dict:
    try:
        return public_user(store.create_user("parent", request.username, request.password, request.display_name))
    except ValueError as error:
        raise HTTPException(409, str(error)) from None


@app.put("/api/v1/admin/users/{user_id}/password", status_code=204)
def admin_reset_password(user_id: str, request: PasswordRequest, _: dict = Depends(require_role("admin"))) -> None:
    user = store.users.get(user_id)
    if user is None or user["role"] not in {"parent", "learner"}:
        raise HTTPException(404, "Parent or learner not found")
    user["password_hash"] = hash_password(request.password)
    user["token_version"] += 1


SCHEMA_PATH = BANK_DIRECTORY / "question-template.schema.json"
QUESTION_VALIDATOR = Draft202012Validator(json.loads(SCHEMA_PATH.read_text(encoding="utf-8")))


def error_path(error) -> str:
    return "$" + "".join(f"[{part}]" if isinstance(part, int) else f".{part}" for part in error.absolute_path)


def error_suggestion(error) -> str:
    suggestions = {
        "required": "Add the named required field at this object location.",
        "additionalProperties": "Remove or correct the unexpected field name.",
        "type": f"Change this value to the required {error.validator_value} type.",
        "pattern": f"Use a value matching {error.validator_value}.",
        "enum": f"Choose one of: {', '.join(map(str, error.validator_value))}.",
        "const": f"Set this value to {error.validator_value!r}.",
        "minItems": f"Add items until this array contains at least {error.validator_value}.",
        "oneOf": "Check the template type and include only the fields required for that template shape.",
    }
    return suggestions.get(error.validator, "Check this value against the schema constraint shown in the message.")


@app.post("/api/v1/admin/questions/import")
def import_questions(request: QuestionImport, _: dict = Depends(require_role("admin"))) -> dict:
    errors = sorted(QUESTION_VALIDATOR.iter_errors(request.document), key=lambda item: error_path(item))
    if errors:
        details = [{"path": error_path(error), "message": error.message, "suggestion": error_suggestion(error)}
                   for error in errors[:25]]
        raise HTTPException(422, {"message": "Question bank does not match the v2 schema", "errors": details})
    try:
        generate_session(7, len(request.document["templates"]), request.document)
    except Exception as error:
        raise HTTPException(422, {"message": "Schema is valid, but questions could not be generated",
                                  "errors": [{"path": "$.templates", "message": str(error),
                                              "suggestion": "Check expressions, parameter ranges, and that each template generates four distinct choices."}]}) from None
    subject = request.document["subject"]
    if subject in load_banks() or subject in store.imported_banks:
        raise HTTPException(409, "A bank with this subject is already loaded; published content is immutable")
    store.imported_banks[subject] = request.document
    return {"subject": subject, "templates_imported": len(request.document["templates"]), "status": "imported"}


@app.get("/api/v1/subjects")
def subjects(_: dict = Depends(require_role("learner", "parent", "admin"))) -> list[dict]:
    return [
        {"id": bank["subject"], "title": bank["title"], "template_count": len(bank["templates"]),
         "publication_status": bank["publicationStatus"]}
        for bank in {**load_banks(store.include_drafts), **store.imported_banks}.values()
        if store.include_drafts or bank["publicationStatus"] == "published"
    ]


@app.post("/api/v1/sessions", response_model=SessionResponse, status_code=201)
def create_session(request: SessionCreate, user: dict = Depends(require_role("learner"))) -> SessionResponse:
    if request.learner_id != user["id"]:
        raise HTTPException(403, "Learners can only start their own sessions")
    bank = {**load_banks(store.include_drafts), **store.imported_banks}.get(request.subject)
    if bank is None:
        raise HTTPException(status_code=400, detail="Unknown subject")
    if bank["publicationStatus"] != "published" and not store.include_drafts:
        raise HTTPException(status_code=400, detail="Subject is not currently visible")
    session_id = secrets.token_urlsafe(12)
    generated = generate_session(request.seed if request.seed is not None else time.time_ns(), request.count, bank)
    store.sessions[session_id] = SessionRecord(
        learner_id=request.learner_id,
        questions={question.public.id: question for question in generated},
    )
    return SessionResponse(id=session_id, learner_id=request.learner_id, questions=[q.public for q in generated])


@app.post("/api/v1/attempts", response_model=AttemptResult)
def submit_attempt(request: AttemptCreate, user: dict = Depends(require_role("learner"))) -> AttemptResult:
    session = store.sessions.get(request.session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    if session.learner_id != user["id"]:
        raise HTTPException(403, "This session belongs to another learner")
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
        "variant_id": question.public.variant_id,
        "skill": question.public.skill,
        "selected_value": choice["value"],
        "correct": correct,
        "misconception_id": choice["misconception"],
        "hint_used": request.hint_used,
        "points_earned": 10 if correct else 0,
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


def _parent_learner(parent: dict, learner_id: str) -> dict:
    learner = store.users.get(learner_id)
    if learner is None or learner["role"] != "learner" or learner["parent_id"] != parent["id"]:
        raise HTTPException(404, "Learner not found in your family")
    return learner


@app.get("/api/v1/parents/learners")
def parent_learners(parent: dict = Depends(require_role("parent"))) -> list[dict]:
    return [{**public_user(user), "progress": store.progress(user["id"])} for user in store.users.values()
            if user["role"] == "learner" and user["parent_id"] == parent["id"]]


@app.post("/api/v1/parents/learners", status_code=201)
def create_learner(request: LearnerCreate, parent: dict = Depends(require_role("parent"))) -> dict:
    try:
        return public_user(store.create_user("learner", request.username, request.password, request.display_name, parent["id"]))
    except ValueError as error:
        raise HTTPException(409, str(error)) from None


@app.put("/api/v1/parents/learners/{learner_id}/password", status_code=204)
def parent_reset_password(learner_id: str, request: PasswordRequest, parent: dict = Depends(require_role("parent"))) -> None:
    learner = _parent_learner(parent, learner_id)
    learner["password_hash"] = hash_password(request.password)
    learner["token_version"] += 1


@app.get("/api/v1/parents/learners/{learner_id}/progress", response_model=ProgressResponse)
def learner_progress(learner_id: str, parent: dict = Depends(require_role("parent"))) -> dict:
    _parent_learner(parent, learner_id)
    return store.progress(learner_id)


@app.get("/api/v1/parents/families/{family_id}/progress")
def family_progress(family_id: str, parent: dict = Depends(require_role("parent"))) -> dict:
    if family_id != parent["id"]:
        raise HTTPException(403, "This family belongs to another parent")
    return store.family_progress(parent["id"])


@app.put("/api/v1/parents/learners/{learner_id}/reward", response_model=RewardSettings)
def update_reward(learner_id: str, reward: RewardSettings, parent: dict = Depends(require_role("parent"))) -> RewardSettings:
    _parent_learner(parent, learner_id)
    store.rewards[learner_id] = reward
    return reward


@app.get("/api/v1/admin/content", response_model=ContentSettings)
def content_settings(_: dict = Depends(require_role("admin"))) -> ContentSettings:
    return ContentSettings(include_drafts=store.include_drafts)


@app.put("/api/v1/admin/content", response_model=ContentSettings)
def update_content_settings(settings: ContentSettings, _: dict = Depends(require_role("admin"))) -> ContentSettings:
    store.include_drafts = settings.include_drafts
    return settings
