from __future__ import annotations

import json
import secrets
import time
from io import BytesIO

from fastapi import Depends, FastAPI, HTTPException
from fastapi.responses import FileResponse, StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPAuthorizationCredentials
from jsonschema import Draft202012Validator
from sqlalchemy import text
from sqlalchemy.orm import Session

from .auth import bearer, decode_token, issue_token, require_role, verify_password
from .demo_pack import DemoAttempt, create_demo_session, demo_questions, grade_demo_attempt
from .database import get_db
from .db_models import User
from .engine import BANK_DIRECTORY, generate_session, generate_template_preview, load_banks
from .models import (
    AttemptCreate,
    AttemptResult,
    AdminQuestionPreview,
    ActivationRequest,
    ContentSettings,
    DefaultSubjectUpdate,
    LearningPreferencesUpdate,
    LearnerCreate,
    LoginRequest,
    ParentCreate,
    ManagedUserUpdate,
    PasswordRequest,
    ProgressResponse,
    QuestionImport,
    RewardSettings,
    SessionCreate,
    SessionResponse,
    SignupRequest,
    WorksheetCreate,
)
from .repositories import (ContentRepository, IdentityRepository, PracticeRepository, TokenRepository,
                           public_user, user_record)
from .email_delivery import EmailDeliveryError, send_activation_email
from .worksheet import build_demo_pack_pdf, build_worksheet_pdf, topic_title

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
def start_demo_pack(db: Session = Depends(get_db)) -> dict:
    return create_demo_session(db)


@app.post("/api/v1/demo-pack/attempts")
def submit_demo_pack_attempt(attempt: DemoAttempt, db: Session = Depends(get_db)) -> dict:
    return grade_demo_attempt(attempt, db)


@app.post("/api/v1/demo-pack/worksheet", status_code=200, response_class=StreamingResponse)
def create_demo_worksheet() -> StreamingResponse:
    """Print every reviewed activity currently presented in the kid demo."""
    pdf = build_demo_pack_pdf(demo_questions())
    filename = "rabbit-demo-all-questions.pdf"
    return StreamingResponse(BytesIO(pdf), media_type="application/pdf", headers={
        "Content-Disposition": f'attachment; filename="{filename}"',
        "Content-Length": str(len(pdf)),
    })


def _demo_worksheet_questions(count: int):
    """Resolve the single template-backed question set shared by preview and PDF."""
    seed = 20260921
    bank = load_bank()
    return bank, generate_session(seed, count, bank), seed


@app.post("/api/v1/demo-pack/worksheet-preview")
def preview_demo_worksheet(request: DemoWorksheetCreate) -> dict:
    """Show the exact safe, public questions that the demo PDF will contain."""
    bank, generated, seed = _demo_worksheet_questions(request.count)
    return {
        "subject_title": bank["title"],
        "seed": seed,
        "questions": [question.public for question in generated],
    }


@app.post("/api/v1/auth/login")
def login(request: LoginRequest, db: Session = Depends(get_db)) -> dict:
    model = IdentityRepository(db).get_by_login(request.email)
    user = user_record(model) if model is not None else None
    if user is None or user["disabled"] or not verify_password(request.password, user["password_hash"]):
        raise HTTPException(401, "Email address or password is not correct")
    token, expires_at = issue_token(user)
    return {"access_token": token, "token_type": "bearer", "expires_at": expires_at, "user": public_user(user)}


@app.post("/api/v1/auth/signup", status_code=202)
def signup(request: SignupRequest, db: Session = Depends(get_db)) -> dict:
    """Create an inactive parent and email a short-lived, single-use setup link."""
    try:
        user, token = IdentityRepository(db).create_signup(request.email, request.display_name)
    except ValueError:
        user, token = None, None
    if user is not None and token is not None:
        try:
            send_activation_email(user.email or request.email, user.display_name, token)
        except EmailDeliveryError as error:
            raise HTTPException(503, str(error)) from None
    return {"message": "If this email can be registered, an activation link is on its way."}


@app.get("/api/v1/auth/activate/{token}")
def inspect_activation(token: str, db: Session = Depends(get_db)) -> dict:
    user = IdentityRepository(db).activation_user(token)
    if user is None:
        raise HTTPException(410, "This activation link is invalid, expired, or already used")
    return {"email": user.email, "display_name": user.display_name}


@app.post("/api/v1/auth/activate")
def activate_account(request: ActivationRequest, db: Session = Depends(get_db)) -> dict:
    user = IdentityRepository(db).activate(request.token, request.password)
    if user is None:
        raise HTTPException(410, "This activation link is invalid, expired, or already used")
    record = user_record(user)
    token, expires_at = issue_token(record)
    return {"access_token": token, "token_type": "bearer", "expires_at": expires_at,
            "user": public_user(user)}


@app.get("/api/v1/auth/me")
def me(user: dict = Depends(require_role("admin", "parent", "learner"))) -> dict:
    return public_user(user)


@app.post("/api/v1/auth/logout", status_code=204)
def logout(credentials: HTTPAuthorizationCredentials = Depends(bearer),
           user: dict = Depends(require_role("admin", "parent", "learner")),
           db: Session = Depends(get_db)) -> None:
    claims = decode_token(credentials.credentials)
    TokenRepository(db).revoke(claims["jti"], user["id"], claims["exp"])


@app.get("/api/v1/admin/users")
def list_managed_users(_: dict = Depends(require_role("admin")), db: Session = Depends(get_db)) -> list[dict]:
    return [public_user(user) for user in IdentityRepository(db).list_managed_users()]


@app.put("/api/v1/admin/users/{user_id}")
def update_managed_user(user_id: str, request: ManagedUserUpdate, _: dict = Depends(require_role("admin")),
                        db: Session = Depends(get_db)) -> dict:
    repository = IdentityRepository(db)
    user = repository.get_by_id(user_id)
    if user is None or user.role not in {"parent", "learner"}:
        raise HTTPException(404, "Parent or learner not found")
    try:
        return public_user(repository.update_managed_user(
            user, request.email or request.username, request.display_name, request.disabled
        ))
    except ValueError as error:
        raise HTTPException(409, str(error)) from None


@app.post("/api/v1/admin/parents", status_code=201)
def create_parent(request: ParentCreate, _: dict = Depends(require_role("admin")),
                  db: Session = Depends(get_db)) -> dict:
    try:
        return public_user(IdentityRepository(db).create_parent(request.email, request.password, request.display_name))
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


@app.post("/api/v1/admin/users/{user_id}/impersonate")
def impersonate_managed_user(user_id: str, _: dict = Depends(require_role("admin")),
                             db: Session = Depends(get_db)) -> dict:
    """Create a user session while the browser retains its administrator session."""
    model = IdentityRepository(db).get_by_id(user_id)
    if model is None or model.role not in {"parent", "learner"}:
        raise HTTPException(404, "Parent or learner not found")
    if model.disabled:
        raise HTTPException(409, "Activate this account before viewing as this user")
    user = user_record(model)
    token, expires_at = issue_token(user)
    return {"access_token": token, "token_type": "bearer", "expires_at": expires_at,
            "user": public_user(user)}


SCHEMA_PATH = BANK_DIRECTORY / "question-template.schema.json"
QUESTION_VALIDATOR = Draft202012Validator(json.loads(SCHEMA_PATH.read_text(encoding="utf-8")))


@app.get("/api/v1/questions/schema", response_class=FileResponse)
def question_schema() -> FileResponse:
    """Return the exact authoring contract used by the public validator."""
    return FileResponse(
        SCHEMA_PATH,
        media_type="application/schema+json",
        filename="rabbit-question-bank-v2.schema.json",
    )


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
        "maxItems": f"Remove items until this array contains at most {error.validator_value}.",
        "oneOf": "Check the template type and include only the fields required for that template shape.",
    }
    return suggestions.get(error.validator, "Check this value against the schema constraint shown in the message.")


def validate_question_bank(document: dict) -> list[dict[str, str]]:
    try:
        errors = sorted(QUESTION_VALIDATOR.iter_errors(document), key=lambda item: error_path(item))
    except Exception as error:
        return [{"path": "$", "message": f"The schema check could not read this document: {error}",
                 "suggestion": "Confirm the uploaded value is a complete JSON question-bank object."}]
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
def import_questions(request: QuestionImport, admin: dict = Depends(require_role("admin")),
                     db: Session = Depends(get_db)) -> dict:
    errors = validate_question_bank(request.document)
    if errors:
        raise HTTPException(422, {"message": "Question bank does not match the v2 schema", "errors": errors})
    subject = request.document["subject"]
    repository = ContentRepository(db)
    existing = repository.banks().get(subject)
    if existing is not None:
        if existing["publicationStatus"] == "published":
            raise HTTPException(409, "A published bank with this subject already exists and cannot be changed")
        if request.document["publicationStatus"] != "draft":
            raise HTTPException(409, "Review the existing draft before publishing it from the curriculum panel")
        repository.replace_draft(subject, request.document, admin["id"])
        return {"subject": subject, "templates_imported": len(request.document["templates"]), "status": "replaced"}
    built_in = load_banks(True).get(subject)
    if built_in is not None:
        if built_in["publicationStatus"] == "published":
            raise HTTPException(409, "This subject is built-in and published, so it cannot be replaced")
        if request.document["publicationStatus"] != "draft":
            raise HTTPException(409, "Import this built-in subject as a draft, then publish it after review")
    try:
        repository.import_bank(request.document, admin["id"])
    except ValueError as error:
        raise HTTPException(409, str(error)) from None
    return {"subject": subject, "templates_imported": len(request.document["templates"]), "status": "imported"}


@app.get("/api/v1/admin/question-banks")
def admin_question_banks(_: dict = Depends(require_role("admin")), db: Session = Depends(get_db)) -> list[dict]:
    imported = ContentRepository(db).banks()
    records = []
    built_in = load_banks(True)
    for subject, bank in {**built_in, **imported}.items():
        template_summaries = []
        for template in bank["templates"]:
            facts = len(template.get("knowledge", {}).get("facts", []))
            variants = len(template.get("variants", []))
            if facts:
                generation_space = facts * variants
            else:
                generation_space = 1
                for parameter in template.get("parameters", {}).values():
                    generation_space *= ((parameter["max"] - parameter["min"]) // parameter.get("step", 1)) + 1
            template_summaries.append({
                "id": template["id"], "version": template["version"], "type": template["type"],
                "skill": template["skill"], "difficulty": template.get("difficulty"),
                "fact_count": facts, "variant_count": variants, "generation_space": generation_space,
                "variants": [item["id"] for item in template.get("variants", [])] or ["default"],
            })
        records.append({"subject": subject, "title": bank["title"], "publication_status": bank["publicationStatus"],
                        "template_count": len(bank["templates"]), "source": "imported" if subject in imported else "built-in",
                        "replaces_builtin": subject in imported and subject in built_in,
                        "template_summaries": template_summaries,
                        "document": bank})
    return sorted(records, key=lambda item: (item["title"].casefold(), item["subject"]))


@app.post("/api/v1/admin/question-banks/{subject}/preview")
def preview_question_bank(subject: str, request: AdminQuestionPreview,
                          _: dict = Depends(require_role("admin")), db: Session = Depends(get_db)) -> dict:
    imported = ContentRepository(db).banks()
    bank = {**load_banks(True), **imported}.get(subject)
    if bank is None:
        raise HTTPException(404, "Question bank not found")
    seed = request.seed if request.seed is not None else secrets.randbits(63)
    if request.template_id:
        try:
            generated = generate_template_preview(seed, bank, request.template_id, request.variant_id)
        except ValueError as error:
            raise HTTPException(404, str(error)) from None
    elif request.variant_id:
        raise HTTPException(422, "Select a template before selecting a variant")
    else:
        generated = generate_session(seed, request.count, bank)
    return {"subject": subject, "seed": seed, "questions": [question.public for question in generated]}


@app.post("/api/v1/admin/question-banks/{subject}/publish")
def publish_question_bank(subject: str, _: dict = Depends(require_role("admin")),
                          db: Session = Depends(get_db)) -> dict:
    try:
        bank = ContentRepository(db).publish_draft(subject)
    except ValueError as error:
        raise HTTPException(404 if "not found" in str(error) else 409, str(error)) from None
    return {"subject": subject, "publication_status": bank["publicationStatus"]}


@app.delete("/api/v1/admin/question-banks/{subject}", status_code=204)
def delete_question_bank(subject: str, _: dict = Depends(require_role("admin")),
                         db: Session = Depends(get_db)) -> None:
    try:
        ContentRepository(db).delete_draft(subject)
    except ValueError as error:
        raise HTTPException(404 if "not found" in str(error) else 409, str(error)) from None


@app.get("/api/v1/subjects")
def subjects(_: dict = Depends(require_role("learner", "parent", "admin")),
             db: Session = Depends(get_db)) -> list[dict]:
    repository = ContentRepository(db)
    include_drafts = repository.include_drafts()
    return [
        {"id": bank["subject"], "title": bank["title"], "template_count": len(bank["templates"]),
         "publication_status": bank["publicationStatus"], "topics": [
             {"id": skill, "title": topic_title(skill)}
             for skill in dict.fromkeys(template["skill"] for template in bank["templates"])
         ]}
        for bank in {**load_banks(include_drafts), **repository.banks()}.values()
        if include_drafts or bank["publicationStatus"] == "published"
    ]


@app.post("/api/v1/sessions", response_model=SessionResponse, status_code=201)
def create_session(request: SessionCreate, user: dict = Depends(require_role("learner", "parent")),
                   db: Session = Depends(get_db)) -> SessionResponse:
    if request.learner_id != user["id"]:
        raise HTTPException(403, "You can only start your own practice session")
    content = ContentRepository(db)
    include_drafts = content.include_drafts()
    bank = {**load_banks(include_drafts), **content.banks()}.get(request.subject)
    if bank is None:
        raise HTTPException(status_code=400, detail="Unknown subject")
    if bank["publicationStatus"] != "published" and not include_drafts:
        raise HTTPException(status_code=400, detail="Subject is not currently visible")
    session_id = secrets.token_urlsafe(12)
    seed = request.seed if request.seed is not None else time.time_ns()
    learner = IdentityRepository(db).get_by_id(request.learner_id)
    selected_topics = list(learner.default_topics or []) if learner and learner.default_subject == request.subject else []
    if selected_topics:
        templates = [template for template in bank["templates"] if template["skill"] in selected_topics]
        if not templates:
            raise HTTPException(status_code=400, detail="Selected topics are not currently available")
        bank = {**bank, "templates": templates}
    generated = generate_session(seed, request.count, bank)
    PracticeRepository(db).create_session(session_id, request.learner_id, request.subject, seed, generated)
    return SessionResponse(id=session_id, learner_id=request.learner_id, questions=[q.public for q in generated])


@app.post("/api/v1/attempts", response_model=AttemptResult)
def submit_attempt(request: AttemptCreate, user: dict = Depends(require_role("learner", "parent")),
                   db: Session = Depends(get_db)) -> AttemptResult:
    repository = PracticeRepository(db)
    owner = repository.session_owner(request.session_id)
    if owner is None:
        raise HTTPException(status_code=404, detail="Session not found")
    if owner != user["id"]:
        raise HTTPException(403, "This session belongs to another learner")
    question = repository.question(request.session_id, request.question_id)
    if not question:
        raise HTTPException(status_code=404, detail="Question not found")
    if repository.attempt_exists(request.session_id, request.question_id):
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
        "time_spent_ms": request.time_spent_ms,
    }
    try:
        repository.add_attempt(request.session_id, request.question_id, user["id"], attempt)
    except ValueError:
        raise HTTPException(status_code=409, detail="Question already answered") from None
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
    progress = PracticeRepository(db)
    children = [{**public_user(user), "progress": progress.progress(user.id), "is_self": False}
                for user in IdentityRepository(db).learners_for_family(parent["family_id"])]
    parent_user = IdentityRepository(db).get_by_id(parent["id"])
    return children + [{**public_user(parent_user), "progress": progress.progress(parent["id"]), "is_self": True}]


@app.post("/api/v1/parents/learners/{learner_id}/impersonate")
def parent_impersonate_learner(learner_id: str, parent: dict = Depends(require_role("parent")),
                               db: Session = Depends(get_db)) -> dict:
    """Let a guardian enter a child's learner view while retaining the parent session."""
    learner = _parent_learner(parent, learner_id, db)
    if learner.disabled:
        raise HTTPException(409, "Activate this learner before viewing their practice")
    record = user_record(learner)
    token, expires_at = issue_token(record)
    return {"access_token": token, "token_type": "bearer", "expires_at": expires_at,
            "user": public_user(record)}


@app.put("/api/v1/parents/learners/{learner_id}/learning-preferences")
def update_learning_preferences(learner_id: str, request: LearningPreferencesUpdate,
                           parent: dict = Depends(require_role("parent")), db: Session = Depends(get_db)) -> dict:
    user = IdentityRepository(db).get_by_id(learner_id)
    if user is None or user.family_id != parent["family_id"] or (user.role != "learner" and user.id != parent["id"]):
        raise HTTPException(404, "Learner not found in your family")
    banks, include_drafts = _visible_banks(db)
    bank = banks.get(request.subject)
    if bank is None or (bank["publicationStatus"] != "published" and not include_drafts):
        raise HTTPException(400, "Subject is not currently available")
    available_topics = {template["skill"] for template in bank["templates"]}
    if len(request.topics) != len(set(request.topics)):
        raise HTTPException(400, "Choose each topic only once")
    unknown = set(request.topics) - available_topics
    if unknown:
        raise HTTPException(400, "One or more selected topics are not available for this subject")
    return public_user(IdentityRepository(db).set_learning_preferences(user, request.subject, request.topics))


@app.put("/api/v1/parents/learners/{learner_id}/default-subject", deprecated=True)
def update_default_subject(learner_id: str, request: DefaultSubjectUpdate,
                           parent: dict = Depends(require_role("parent")), db: Session = Depends(get_db)) -> dict:
    """Compatibility route: changing the bank resets its topic filter to all topics."""
    return update_learning_preferences(
        learner_id, LearningPreferencesUpdate(subject=request.subject, topics=[]), parent, db
    )


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
    if learner_id != parent["id"]:
        _parent_learner(parent, learner_id, db)
    return PracticeRepository(db).progress(learner_id)


@app.get("/api/v1/learners/me/progress", response_model=ProgressResponse)
def own_progress(learner: dict = Depends(require_role("learner")), db: Session = Depends(get_db)) -> dict:
    """Let a learner review their own evidence without exposing another family."""
    return PracticeRepository(db).progress(learner["id"])


@app.get("/api/v1/parents/families/{family_id}/progress")
def family_progress(family_id: str, parent: dict = Depends(require_role("parent")),
                    db: Session = Depends(get_db)) -> dict:
    if family_id != parent["family_id"]:
        raise HTTPException(403, "This family belongs to another parent")
    learners = IdentityRepository(db).learners_for_family(family_id)
    return {"family_id": family_id, "learners": [
        {"id": learner.id, "name": learner.display_name, "progress": PracticeRepository(db).progress(learner.id)}
        for learner in learners
    ]}


@app.put("/api/v1/parents/learners/{learner_id}/reward", response_model=RewardSettings)
def update_reward(learner_id: str, reward: RewardSettings, parent: dict = Depends(require_role("parent")),
                  db: Session = Depends(get_db)) -> RewardSettings:
    _parent_learner(parent, learner_id, db)
    return PracticeRepository(db).set_reward(learner_id, reward)


def _visible_banks(db: Session) -> tuple[dict[str, dict], bool]:
    repository = ContentRepository(db)
    include_drafts = repository.include_drafts()
    return {**load_banks(include_drafts), **repository.banks()}, include_drafts


@app.get("/api/v1/parents/worksheet-topics")
def worksheet_topics(_: dict = Depends(require_role("parent")), db: Session = Depends(get_db)) -> list[dict]:
    topics = []
    banks, include_drafts = _visible_banks(db)
    for bank in banks.values():
        if bank["publicationStatus"] != "published" and not include_drafts:
            continue
        for skill in dict.fromkeys(template["skill"] for template in bank["templates"]):
            topics.append({"subject": bank["subject"], "subject_title": bank["title"],
                           "id": skill, "title": topic_title(skill)})
    return topics


@app.post("/api/v1/parents/worksheets")
def create_worksheet(request: WorksheetCreate, _: dict = Depends(require_role("parent")),
                     db: Session = Depends(get_db)) -> StreamingResponse:
    banks, include_drafts = _visible_banks(db)
    bank = banks.get(request.subject)
    if bank is None or (bank["publicationStatus"] != "published" and not include_drafts):
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
def content_settings(_: dict = Depends(require_role("admin")), db: Session = Depends(get_db)) -> ContentSettings:
    return ContentSettings(include_drafts=ContentRepository(db).include_drafts())


@app.put("/api/v1/admin/content", response_model=ContentSettings)
def update_content_settings(settings: ContentSettings, _: dict = Depends(require_role("admin")),
                            db: Session = Depends(get_db)) -> ContentSettings:
    ContentRepository(db).set_include_drafts(settings.include_drafts)
    return settings
