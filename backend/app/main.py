from __future__ import annotations

import json
import secrets
import time
from io import BytesIO

from fastapi import Depends, FastAPI, HTTPException
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPAuthorizationCredentials
from jsonschema import Draft202012Validator
from sqlalchemy import text
from sqlalchemy.orm import Session

from .auth import bearer, decode_token, issue_token, require_role, verify_password
from .demo_pack import DemoAttempt, create_demo_session, grade_demo_attempt
from .database import get_db
from .db_models import User
from .engine import BANK_DIRECTORY, generate_session, load_bank, load_banks
from .models import (
    AttemptCreate,
    AttemptResult,
    ContentSettings,
    DemoWorksheetCreate,
    LearnerCreate,
    LoginRequest,
    ParentCreate,
    PasswordRequest,
    ProgressResponse,
    QuestionImport,
    RewardSettings,
    SessionCreate,
    SessionResponse,
    WorksheetCreate,
)
from .store import SessionRecord, store
from .repositories import IdentityRepository, public_user, user_record
from .worksheet import build_worksheet_pdf, topic_title

app = FastAPI(title="Rabbit Learning API", version="0.1.0", docs_url="/api/docs", openapi_url="/api/openapi.json")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/v1/health")
def health(db: Session = Depends(get_db)) -> dict[str, str]:
    db.execute(text("SELECT 1"))
    return {"status": "ok", "service": "rabbit-api"}


@app.post("/api/v1/demo-pack/sessions", status_code=201)
def start_demo_pack() -> dict:
    return create_demo_session()


@app.post("/api/v1/demo-pack/attempts")
def submit_demo_pack_attempt(attempt: DemoAttempt) -> dict:
    return grade_demo_attempt(attempt)


@app.post("/api/v1/demo-pack/worksheet", status_code=200, response_class=StreamingResponse)
def create_demo_worksheet(request: DemoWorksheetCreate) -> StreamingResponse:
    """Build the public demo's deterministic worksheet without retaining data."""
    seed = 20260921
    bank = load_bank()
    generated = generate_session(seed, request.count, bank)
    pdf = build_worksheet_pdf(bank["title"], "mixed-practice", generated, seed)
    filename = f"rabbit-demo-{request.count}-questions.pdf"
    return StreamingResponse(BytesIO(pdf), media_type="application/pdf", headers={
        "Content-Disposition": f'attachment; filename="{filename}"',
        "Content-Length": str(len(pdf)),
    })


@app.post("/api/v1/auth/login")
def login(request: LoginRequest, db: Session = Depends(get_db)) -> dict:
    model = IdentityRepository(db).get_by_username(request.username)
    user = user_record(model) if model is not None else None
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
def list_managed_users(_: dict = Depends(require_role("admin")), db: Session = Depends(get_db)) -> list[dict]:
    return [public_user(user) for user in IdentityRepository(db).list_managed_users()]


@app.post("/api/v1/admin/parents", status_code=201)
def create_parent(request: ParentCreate, _: dict = Depends(require_role("admin")),
                  db: Session = Depends(get_db)) -> dict:
    try:
        return public_user(IdentityRepository(db).create_parent(request.username, request.password, request.display_name))
    except ValueError as error:
        raise HTTPException(409, str(error)) from None


@app.put("/api/v1/admin/users/{user_id}/password", status_code=204)
def admin_reset_password(user_id: str, request: PasswordRequest, _: dict = Depends(require_role("admin")),
                         db: Session = Depends(get_db)) -> None:
    repository = IdentityRepository(db)
    user = repository.get_by_id(user_id)
    if user is None or user.role not in {"parent", "learner"}:
        raise HTTPException(404, "Parent or learner not found")
    repository.reset_password(user, request.password)


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


def validate_question_bank(document: dict) -> list[dict[str, str]]:
    errors = sorted(QUESTION_VALIDATOR.iter_errors(document), key=lambda item: error_path(item))
    if errors:
        return [{"path": error_path(error), "message": error.message, "suggestion": error_suggestion(error)}
                for error in errors[:25]]
    try:
        generate_session(7, len(document["templates"]), document)
    except Exception as error:
        return [{"path": "$.templates", "message": str(error),
                 "suggestion": "Check expressions, parameter ranges, and that each template generates four distinct choices."}]
    return []


@app.post("/api/v1/questions/validate")
def validate_questions(request: QuestionImport) -> dict:
    """Validate untrusted authoring input without publishing or retaining it."""
    errors = validate_question_bank(request.document)
    if errors:
        raise HTTPException(422, {"message": "Question bank is not valid", "errors": errors})
    return {"valid": True, "templates_validated": len(request.document["templates"])}


@app.post("/api/v1/admin/questions/import")
def import_questions(request: QuestionImport, _: dict = Depends(require_role("admin"))) -> dict:
    errors = validate_question_bank(request.document)
    if errors:
        raise HTTPException(422, {"message": "Question bank does not match the v2 schema", "errors": errors})
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
        "selected_choice_id": request.choice_id,
        "correct_value": question.choices[question.correct_choice_id]["value"],
        # Keep the resolved public payload with the append-only attempt so a
        # later template change cannot rewrite what the learner actually saw.
        "question": question.public.model_dump(),
        "correct": correct,
        "misconception_id": choice["misconception"],
        "hint_used": request.hint_used,
        "points_earned": 10 if correct else 0,
        "answered_at": store.now(),
        "time_spent_ms": request.time_spent_ms,
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


def _parent_learner(parent: dict, learner_id: str, db: Session) -> User:
    learner = IdentityRepository(db).get_by_id(learner_id)
    if learner is None or learner.role != "learner" or learner.family_id != parent["family_id"]:
        raise HTTPException(404, "Learner not found in your family")
    return learner


@app.get("/api/v1/parents/learners")
def parent_learners(parent: dict = Depends(require_role("parent")), db: Session = Depends(get_db)) -> list[dict]:
    return [{**public_user(user), "progress": store.progress(user.id)}
            for user in IdentityRepository(db).learners_for_family(parent["family_id"])]


@app.post("/api/v1/parents/learners", status_code=201)
def create_learner(request: LearnerCreate, parent: dict = Depends(require_role("parent")),
                   db: Session = Depends(get_db)) -> dict:
    try:
        return public_user(IdentityRepository(db).create_learner(
            parent, request.username, request.password, request.display_name
        ))
    except ValueError as error:
        raise HTTPException(409, str(error)) from None


@app.put("/api/v1/parents/learners/{learner_id}/password", status_code=204)
def parent_reset_password(learner_id: str, request: PasswordRequest, parent: dict = Depends(require_role("parent")),
                          db: Session = Depends(get_db)) -> None:
    repository = IdentityRepository(db)
    learner = _parent_learner(parent, learner_id, db)
    repository.reset_password(learner, request.password)


@app.get("/api/v1/parents/learners/{learner_id}/progress", response_model=ProgressResponse)
def learner_progress(learner_id: str, parent: dict = Depends(require_role("parent")),
                     db: Session = Depends(get_db)) -> dict:
    _parent_learner(parent, learner_id, db)
    return store.progress(learner_id)


@app.get("/api/v1/learners/me/progress", response_model=ProgressResponse)
def own_progress(learner: dict = Depends(require_role("learner"))) -> dict:
    """Let a learner review their own evidence without exposing another family."""
    return store.progress(learner["id"])


@app.get("/api/v1/parents/families/{family_id}/progress")
def family_progress(family_id: str, parent: dict = Depends(require_role("parent")),
                    db: Session = Depends(get_db)) -> dict:
    if family_id != parent["family_id"]:
        raise HTTPException(403, "This family belongs to another parent")
    learners = IdentityRepository(db).learners_for_family(family_id)
    return {"family_id": family_id, "learners": [
        {"id": learner.id, "name": learner.display_name, "progress": store.progress(learner.id)}
        for learner in learners
    ]}


@app.put("/api/v1/parents/learners/{learner_id}/reward", response_model=RewardSettings)
def update_reward(learner_id: str, reward: RewardSettings, parent: dict = Depends(require_role("parent")),
                  db: Session = Depends(get_db)) -> RewardSettings:
    _parent_learner(parent, learner_id, db)
    store.rewards[learner_id] = reward
    return reward


def _visible_banks() -> dict[str, dict]:
    return {**load_banks(store.include_drafts), **store.imported_banks}


@app.get("/api/v1/parents/worksheet-topics")
def worksheet_topics(_: dict = Depends(require_role("parent"))) -> list[dict]:
    topics = []
    for bank in _visible_banks().values():
        if bank["publicationStatus"] != "published" and not store.include_drafts:
            continue
        for skill in dict.fromkeys(template["skill"] for template in bank["templates"]):
            topics.append({"subject": bank["subject"], "subject_title": bank["title"],
                           "id": skill, "title": topic_title(skill)})
    return topics


@app.post("/api/v1/parents/worksheets")
def create_worksheet(request: WorksheetCreate, _: dict = Depends(require_role("parent"))) -> StreamingResponse:
    bank = _visible_banks().get(request.subject)
    if bank is None or (bank["publicationStatus"] != "published" and not store.include_drafts):
        raise HTTPException(400, "Unknown subject")
    templates = [template for template in bank["templates"] if template["skill"] == request.topic]
    if not templates:
        raise HTTPException(400, "Topic is not available for this subject")
    seed = request.seed if request.seed is not None else time.time_ns()
    generated = generate_session(seed, request.count, {**bank, "templates": templates})
    pdf = build_worksheet_pdf(bank["title"], request.topic, generated, seed)
    filename = f"rabbit-{request.topic.replace('.', '-')}-{request.count}-questions.pdf"
    return StreamingResponse(BytesIO(pdf), media_type="application/pdf", headers={
        "Content-Disposition": f'attachment; filename="{filename}"',
        "Content-Length": str(len(pdf)),
    })


@app.get("/api/v1/admin/content", response_model=ContentSettings)
def content_settings(_: dict = Depends(require_role("admin"))) -> ContentSettings:
    return ContentSettings(include_drafts=store.include_drafts)


@app.put("/api/v1/admin/content", response_model=ContentSettings)
def update_content_settings(settings: ContentSettings, _: dict = Depends(require_role("admin"))) -> ContentSettings:
    store.include_drafts = settings.include_drafts
    return settings
