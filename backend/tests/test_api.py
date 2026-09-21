import json
import os
from pathlib import Path
from unittest.mock import patch

from fastapi.testclient import TestClient

from app import main as main_module
from app.main import app
from app.store import store

client = TestClient(app)


def setup_function():
    store.sessions.clear(); store.rewards.clear(); store.imported_banks.clear(); store.revoked_tokens.clear()
    store.include_drafts = False


def login(username="admin", password=None):
    if password is None:
        password = os.environ["RABBIT_ADMIN_PASSWORD"]
    response = client.post("/api/v1/auth/login", json={"username": username, "password": password})
    assert response.status_code == 200
    return {"Authorization": f"Bearer {response.json()['access_token']}"}, response.json()["user"]


def family():
    admin, _ = login()
    parent_response = client.post("/api/v1/admin/parents", headers=admin, json={"username":"parent.one","password":"welcome12","display_name":"A Parent"})
    assert parent_response.status_code == 201, parent_response.text
    parent = parent_response.json()
    parent_headers, _ = login("parent.one", "welcome12")
    learner_response = client.post("/api/v1/parents/learners", headers=parent_headers, json={"username":"learner.one","password":"practice12","display_name":"Mina"})
    assert learner_response.status_code == 201, learner_response.text
    learner = learner_response.json()
    learner_headers, _ = login("learner.one", "practice12")
    return parent_headers, learner_headers, learner


def test_password_hash_round_trip_is_stable_for_created_accounts():
    from app.auth import hash_password, verify_password

    for password in ("rabbit-admin", "welcome12", "practice12"):
        encoded = hash_password(password)
        assert verify_password(password, encoded)
        assert not verify_password(f"{password}-different", encoded)


def test_health_demo_and_protected_catalogue():
    assert client.get("/api/v1/health").json()["status"] == "ok"
    assert client.post("/api/v1/demo-pack/sessions").status_code == 201
    assert client.get("/api/v1/subjects").status_code == 401
    headers, _ = login()
    subjects = client.get("/api/v1/subjects", headers=headers).json()
    assert [item["id"] for item in subjects] == ["math.elementary"]
    assert client.get("/api/v1/admin/content").status_code == 401
    assert client.put("/api/v1/admin/content", headers=headers, json={"include_drafts": True}).json() == {"include_drafts": True}
    assert {item["id"] for item in client.get("/api/v1/subjects", headers=headers).json()} == {"math.elementary", "canadian-citizenship"}


def test_role_login_family_isolation_password_reset_and_progress():
    parent_headers, learner_headers, learner = family()
    session = client.post("/api/v1/sessions", headers=learner_headers, json={"learner_id":learner["id"],"seed":42,"count":2}).json()
    question = session["questions"][0]
    assert "correct_choice_id" not in question
    correct = store.sessions[session["id"]].questions[question["id"]].correct_choice_id
    assert client.post("/api/v1/attempts", headers=learner_headers, json={"session_id":session["id"],"question_id":question["id"],"choice_id":correct,"time_spent_ms":12500}).status_code == 200
    progress = client.get(f"/api/v1/parents/learners/{learner['id']}/progress", headers=parent_headers).json()
    assert progress["attempts"] == 1 and progress["points"] == 10
    attempt = progress["attempt_history"][0]
    assert attempt["question"] == question
    assert attempt["selected_value"] == attempt["correct_value"]
    assert attempt["time_spent_ms"] == 12500
    assert client.get("/api/v1/learners/me/progress", headers=learner_headers).json()["attempt_history"] == progress["attempt_history"]
    assert client.get("/api/v1/learners/me/progress", headers=parent_headers).status_code == 403
    parent_id = client.get("/api/v1/auth/me", headers=parent_headers).json()["id"]
    family_report = client.get(f"/api/v1/parents/families/{parent_id}/progress", headers=parent_headers).json()
    assert [child["name"] for child in family_report["learners"]] == ["Mina"]
    assert client.get("/api/v1/parents/families/another-family/progress", headers=parent_headers).status_code == 403
    assert client.get(f"/api/v1/parents/families/{parent_id}/progress", headers=learner_headers).status_code == 403
    admin, _ = login(); assert client.get(f"/api/v1/parents/learners/{learner['id']}/progress", headers=admin).status_code == 403
    assert client.put(f"/api/v1/parents/learners/{learner['id']}/password",headers=parent_headers,json={"password":"new-password"}).status_code == 204
    assert client.post("/api/v1/auth/login",json={"username":"learner.one","password":"practice12"}).status_code == 401


def test_identity_records_are_relational_and_learner_has_one_family():
    from sqlalchemy import select
    from sqlalchemy.orm import Session

    from app.database import engine
    from app.db_models import FamilyGuardian, LearnerProfile, User

    parent_headers, _, learner = family()
    parent = client.get("/api/v1/auth/me", headers=parent_headers).json()
    with Session(engine) as session:
        learner_model = session.get(User, learner["id"])
        profile = session.get(LearnerProfile, learner["id"])
        guardian = session.scalar(select(FamilyGuardian).where(
            FamilyGuardian.guardian_user_id == parent["id"]
        ))
        assert learner_model is not None and learner_model.family_id == parent["id"]
        assert profile is not None and profile.family_id == parent["id"]
        assert guardian is not None and guardian.family_id == parent["id"]


def test_duplicate_username_rolls_back_parent_family_creation():
    from sqlalchemy import func, select
    from sqlalchemy.orm import Session

    from app.database import engine
    from app.db_models import Family

    admin, _ = login()
    request = {"username":"same.parent","password":"welcome12","display_name":"First Parent"}
    assert client.post("/api/v1/admin/parents", headers=admin, json=request).status_code == 201
    assert client.post("/api/v1/admin/parents", headers=admin,
                       json={**request, "display_name":"Second Parent"}).status_code == 409
    with Session(engine) as session:
        assert session.scalar(select(func.count()).select_from(Family)) == 1


def test_import_pinpoints_schema_path_and_imports_valid_bank():
    headers, _ = login()
    invalid={"schemaVersion":2}
    response=client.post("/api/v1/admin/questions/import",headers=headers,json={"document":invalid})
    assert response.status_code==422
    errors=response.json()["detail"]["errors"]
    assert errors[0]["path"]=="$" and "required property" in errors[0]["message"]
    bank=json.loads((Path(__file__).parents[2]/"content/math.question-bank.json").read_text())
    bank["subject"]="math.imported";bank["title"]="Imported Math"
    response=client.post("/api/v1/admin/questions/import",headers=headers,json={"document":bank})
    assert response.status_code==200 and response.json()["templates_imported"]==10


def test_public_question_validation_checks_schema_and_generation_without_importing():
    invalid = client.post("/api/v1/questions/validate", json={"document": {"schemaVersion": 2}})
    assert invalid.status_code == 422
    assert invalid.json()["detail"]["errors"][0]["path"] == "$"

    bank = json.loads((Path(__file__).parents[2] / "content/math.question-bank.json").read_text())
    response = client.post("/api/v1/questions/validate", json={"document": bank})
    assert response.status_code == 200
    assert response.json() == {"valid": True, "templates_validated": 10}
    assert store.imported_banks == {}


def test_expired_jwt_is_rejected():
    import app.auth as auth
    headers, _ = login()
    token=headers["Authorization"].split()[1]
    original=auth.time.time
    try:
        auth.time.time=lambda: original()+auth.JWT_TTL_SECONDS+1
        assert client.get("/api/v1/auth/me",headers={"Authorization":f"Bearer {token}"}).status_code==401
    finally: auth.time.time=original


def test_logout_revokes_the_presented_token():
    headers, _ = login()
    assert client.post("/api/v1/auth/logout", headers=headers).status_code == 204
    assert client.get("/api/v1/auth/me", headers=headers).status_code == 401


def test_parent_can_generate_topic_worksheet_with_answer_key():
    parent_headers, learner_headers, _ = family()
    topics = client.get("/api/v1/parents/worksheet-topics", headers=parent_headers)
    assert topics.status_code == 200
    topic = topics.json()[0]
    request = {"subject": topic["subject"], "topic": topic["id"], "count": 3, "seed": 4242}
    first = client.post("/api/v1/parents/worksheets", headers=parent_headers, json=request)
    second = client.post("/api/v1/parents/worksheets", headers=parent_headers, json=request)
    assert first.status_code == 200
    assert first.headers["content-type"] == "application/pdf"
    assert "3-questions.pdf" in first.headers["content-disposition"]
    assert first.content.startswith(b"%PDF-") and first.content == second.content
    assert b"Answer key" in first.content
    assert client.post("/api/v1/parents/worksheets", headers=learner_headers, json=request).status_code == 403
    assert client.post("/api/v1/parents/worksheets", headers=parent_headers,
                       json={**request, "topic": "not.a.topic"}).status_code == 400
    assert client.post("/api/v1/parents/worksheets", headers=parent_headers,
                       json={**request, "count": 51}).status_code == 422


def test_public_demo_can_generate_a_real_worksheet_without_login():
    route = next(
        (route for route in app.routes if getattr(route, "path", None) == "/api/v1/demo-pack/worksheet"),
        None,
    )
    assert route is not None and "POST" in route.methods
    with patch.object(main_module, "build_demo_pack_pdf", wraps=main_module.build_demo_pack_pdf) as pdf_builder:
        first = client.post("/api/v1/demo-pack/worksheet", json={})
        second = client.post("/api/v1/demo-pack/worksheet", json={})
    pdf_questions = pdf_builder.call_args.args[0]
    kid_questions = client.post("/api/v1/demo-pack/sessions").json()["questions"]
    assert first.status_code == 200, first.text
    assert first.headers["content-type"] == "application/pdf"
    assert "rabbit-demo-all-questions.pdf" in first.headers["content-disposition"]
    assert first.content.startswith(b"%PDF-") and first.content == second.content
    assert b"Answer key" in first.content
    assert len(pdf_questions) == 11
    assert [question["id"] for question in pdf_questions] == [question["id"] for question in kid_questions]
    assert {question["subject"] for question in pdf_questions} == {
        "math", "trivia", "english", "canadian-citizenship"
    }
    assert {question["kind"] for question in pdf_questions} == {
        "single-select", "multi-select", "fill-blank", "reorder", "correction"
    }
    assert b"Find the missing side" in first.content
    assert b"Animal expert" in first.content
    assert b"Build the sentence" in first.content
    assert b"Confederation milestone" in first.content
    assert b"/Subtype /Image" in first.content


def test_backend_image_contains_the_demo_pdf_asset():
    dockerfile = (Path(__file__).parents[1] / "Dockerfile").read_text(encoding="utf-8")
    assert "COPY frontend/public/trivia-animals.png ./frontend/public/trivia-animals.png" in dockerfile
