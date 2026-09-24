import json
import os
from datetime import UTC, datetime, timedelta
from pathlib import Path
from unittest.mock import patch

from fastapi.testclient import TestClient

from app import main as main_module
from app.main import app

client = TestClient(app)


def setup_function():
    pass


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
    assert {item["id"] for item in client.get("/api/v1/subjects", headers=headers).json()} == {
        "math.elementary", "canadian-citizenship", "math.visuals",
    }
    counts = {item["id"]: item["practice_question_count"]
              for item in client.get("/api/v1/subjects", headers=headers).json()}
    assert counts == {"math.elementary": 10, "canadian-citizenship": 20, "math.visuals": 10}


def test_learner_can_start_a_twenty_question_discover_canada_session():
    _, learner_headers, learner = family()
    admin_headers, _ = login()
    client.put("/api/v1/admin/content", headers=admin_headers, json={"include_drafts": True})

    response = client.post("/api/v1/sessions", headers=learner_headers, json={
        "learner_id": learner["id"], "subject": "canadian-citizenship",
        "seed": 8675309,
    })

    assert response.status_code == 201, response.text
    assert len(response.json()["questions"]) == 20


def test_learner_can_start_a_twenty_question_discover_canada_session():
    _, learner_headers, learner = family()
    admin_headers, _ = login()
    client.put("/api/v1/admin/content", headers=admin_headers, json={"include_drafts": True})

    response = client.post("/api/v1/sessions", headers=learner_headers, json={
        "learner_id": learner["id"], "subject": "canadian-citizenship",
        "seed": 8675309, "count": 20,
    })

    assert response.status_code == 201, response.text
    assert len(response.json()["questions"]) == 20


def test_role_login_family_isolation_password_reset_and_progress():
    parent_headers, learner_headers, learner = family()
    session = client.post("/api/v1/sessions", headers=learner_headers, json={"learner_id":learner["id"],"seed":42,"count":2}).json()
    question = session["questions"][0]
    assert "correct_choice_id" not in question
    from sqlalchemy.orm import Session
    from app.database import engine
    from app.repositories import PracticeRepository
    with Session(engine) as db:
        correct = PracticeRepository(db).question(session["id"], question["id"]).correct_choice_id
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


def test_new_learners_default_to_a_seventy_percent_reward_target():
    parent_headers, learner_headers, learner = family()

    parent_progress = client.get(
        f"/api/v1/parents/learners/{learner['id']}/progress", headers=parent_headers
    ).json()
    learner_progress = client.get("/api/v1/learners/me/progress", headers=learner_headers).json()

    assert parent_progress["reward"]["target_accuracy"] == 70
    assert learner_progress["reward"]["target_accuracy"] == 70


def test_parent_deletes_a_whole_test_and_cannot_delete_another_familys_results():
    parent_headers, learner_headers, learner = family()
    practice = client.post("/api/v1/sessions", headers=learner_headers,
                           json={"learner_id": learner["id"], "seed": 91, "count": 2}).json()
    from sqlalchemy.orm import Session
    from app.database import engine
    from app.repositories import PracticeRepository
    with Session(engine) as db:
        repository = PracticeRepository(db)
        correct = [repository.question(practice["id"], question["id"]).correct_choice_id
                   for question in practice["questions"]]
    for question, choice in zip(practice["questions"], correct):
        assert client.post("/api/v1/attempts", headers=learner_headers, json={
            "session_id": practice["id"], "question_id": question["id"],
            "choice_id": choice, "time_spent_ms": 1000,
        }).status_code == 200
    progress = client.get(f"/api/v1/parents/learners/{learner['id']}/progress", headers=parent_headers).json()
    assert {item["session_id"] for item in progress["attempt_history"]} == {practice["id"]}
    assert progress["achievements"] == {"correct_answers": 2, "gold_trophies": 1, "silver_trophies": 0}

    admin, _ = login()
    assert client.post("/api/v1/admin/parents", headers=admin, json={"username": "parent.two", "password": "welcome12", "display_name": "Other Parent"}).status_code == 201
    other_parent, _ = login("parent.two", "welcome12")
    assert client.delete(f"/api/v1/parents/learners/{learner['id']}/tests/{practice['id']}", headers=other_parent).status_code == 404
    assert client.delete(f"/api/v1/parents/learners/{learner['id']}/tests/{practice['id']}", headers=parent_headers).status_code == 204
    assert client.get(f"/api/v1/parents/learners/{learner['id']}/progress", headers=parent_headers).json()["attempts"] == 0


def test_parent_can_choose_each_default_bank_impersonate_child_and_practice_last():
    parent_headers, learner_headers, learner = family()
    parent = client.get("/api/v1/auth/me", headers=parent_headers).json()
    listed = client.get("/api/v1/parents/learners", headers=parent_headers)
    assert listed.status_code == 200
    assert [(item["id"], item["is_self"]) for item in listed.json()] == [
        (learner["id"], False), (parent["id"], True)
    ]
    selected = client.put(f"/api/v1/parents/learners/{learner['id']}/default-subject",
                          headers=parent_headers, json={"subject": "math.elementary"})
    assert selected.status_code == 200
    assert selected.json()["default_subject"] == "math.elementary"
    assert client.put(f"/api/v1/parents/learners/{learner['id']}/default-subject",
                      headers=learner_headers, json={"subject": "math.elementary"}).status_code == 403
    viewed = client.post(f"/api/v1/parents/learners/{learner['id']}/impersonate", headers=parent_headers)
    assert viewed.status_code == 200
    child_headers = {"Authorization": f"Bearer {viewed.json()['access_token']}"}
    assert client.get("/api/v1/auth/me", headers=child_headers).json()["id"] == learner["id"]
    own_session = client.post("/api/v1/sessions", headers=parent_headers, json={
        "learner_id": parent["id"], "subject": "math.elementary", "seed": 99, "count": 1,
    })
    assert own_session.status_code == 201, own_session.text
    assert client.get("/api/v1/learners/me/progress", headers=parent_headers).status_code == 403
    assert client.get(
        f"/api/v1/parents/learners/{parent['id']}/progress", headers=parent_headers
    ).status_code == 200


def test_parent_can_choose_multiple_topics_and_sessions_use_only_that_plan():
    parent_headers, learner_headers, learner = family()
    subjects = client.get("/api/v1/subjects", headers=parent_headers).json()
    math = next(subject for subject in subjects if subject["id"] == "math.elementary")
    selected_topics = [math["topics"][0]["id"], math["topics"][3]["id"]]

    saved = client.put(
        f"/api/v1/parents/learners/{learner['id']}/learning-preferences",
        headers=parent_headers,
        json={"subject": "math.elementary", "topics": selected_topics},
    )
    assert saved.status_code == 200, saved.text
    assert saved.json()["default_topics"] == selected_topics

    session = client.post("/api/v1/sessions", headers=learner_headers, json={
        "learner_id": learner["id"], "subject": "math.elementary", "seed": 44, "count": 6,
    })
    assert session.status_code == 201, session.text
    assert {question["skill"] for question in session.json()["questions"]} == set(selected_topics)

    duplicate = client.put(
        f"/api/v1/parents/learners/{learner['id']}/learning-preferences",
        headers=parent_headers,
        json={"subject": "math.elementary", "topics": [selected_topics[0], selected_topics[0]]},
    )
    assert duplicate.status_code == 400
    assert client.put(
        f"/api/v1/parents/learners/{learner['id']}/learning-preferences",
        headers=parent_headers,
        json={"subject": "math.elementary", "topics": ["math.not-real"]},
    ).status_code == 400
    assert client.put(
        f"/api/v1/parents/learners/{learner['id']}/learning-preferences",
        headers=learner_headers,
        json={"subject": "math.elementary", "topics": selected_topics},
    ).status_code == 403


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


def test_non_username_integrity_errors_are_not_mislabeled():
    from sqlalchemy.exc import IntegrityError
    from sqlalchemy.orm import Session

    from app.database import engine
    from app.repositories import IdentityRepository

    with Session(engine) as session:
        repository = IdentityRepository(session)
        error = IntegrityError("insert", {}, Exception("foreign key constraint failed"))
        assert repository._is_username_conflict(error) is False


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


def test_ontario_grade_5_sample_imports():
    headers, _ = login()
    path = Path(__file__).parents[2] / "sample/ontario-grade-5-math-chatgpt.json"
    bank = json.loads(path.read_text(encoding="utf-8"))

    response = client.post("/api/v1/admin/questions/import", headers=headers, json={"document": bank})

    assert response.status_code == 200, response.json()
    assert response.json()["templates_imported"] == 264


def test_admin_can_replace_publish_and_delete_a_bank_but_not_edit_published_content():
    headers, _ = login()
    bank = json.loads((Path(__file__).parents[2] / "content/math.question-bank.json").read_text())
    bank.update(subject="math.review", title="Review Math", publicationStatus="draft")
    assert client.post("/api/v1/admin/questions/import", headers=headers, json={"document": bank}).json()["status"] == "imported"

    bank["title"] = "Revised Review Math"
    replaced = client.post("/api/v1/admin/questions/import", headers=headers, json={"document": bank})
    assert replaced.status_code == 200 and replaced.json()["status"] == "replaced"
    listed = client.get("/api/v1/admin/question-banks", headers=headers).json()
    record = next(item for item in listed if item["subject"] == "math.review")
    assert record["title"] == "Revised Review Math" and record["source"] == "imported"

    published = client.post("/api/v1/admin/question-banks/math.review/publish", headers=headers)
    assert published.json()["publication_status"] == "published"
    conflict = client.post("/api/v1/admin/questions/import", headers=headers, json={"document": bank})
    assert conflict.status_code == 409 and "published" in conflict.json()["detail"]
    assert client.delete("/api/v1/admin/question-banks/math.review", headers=headers).status_code == 204
    assert all(item["subject"] != "math.review" for item in client.get("/api/v1/admin/question-banks", headers=headers).json())


def test_admin_can_import_a_draft_override_after_restoring_a_built_in_bank():
    headers, _ = login()
    bank = json.loads((Path(__file__).parents[2] / "content/canadian-citizenship.question-bank.json").read_text())

    imported = client.post("/api/v1/admin/questions/import", headers=headers, json={"document": bank})
    assert imported.status_code == 200 and imported.json()["status"] == "imported"
    listed = client.get("/api/v1/admin/question-banks", headers=headers).json()
    override = next(item for item in listed if item["subject"] == bank["subject"])
    assert override["source"] == "imported" and override["replaces_builtin"] is True
    assert override["template_count"] == 1
    assert override["template_summaries"] == [{
        "id": "canada.history.milestones", "version": 1,
        "type": "fact-collection-single-select", "skill": "canada.history.milestones",
        "difficulty": None, "fact_count": 6, "variant_count": 1, "generation_space": 6,
        "variants": ["identify-year"],
    }]

    first_preview = client.post(
        f"/api/v1/admin/question-banks/{bank['subject']}/preview", headers=headers,
        json={"seed": 8675309, "count": 1},
    )
    second_preview = client.post(
        f"/api/v1/admin/question-banks/{bank['subject']}/preview", headers=headers,
        json={"seed": 8675309, "count": 1},
    )
    assert first_preview.status_code == 200 and first_preview.json() == second_preview.json()
    question = first_preview.json()["questions"][0]
    assert "correct_choice_id" not in question and "misconception" not in json.dumps(question)

    template_preview = client.post(
        f"/api/v1/admin/question-banks/{bank['subject']}/preview", headers=headers,
        json={"seed": 123, "template_id": "canada.history.milestones", "variant_id": "identify-year"},
    )
    assert template_preview.status_code == 200
    assert len(template_preview.json()["questions"]) == 6
    assert {item["variant_id"] for item in template_preview.json()["questions"]} == {"identify-year"}

    assert client.delete(f"/api/v1/admin/question-banks/{bank['subject']}", headers=headers).status_code == 204
    restored = client.get("/api/v1/admin/question-banks", headers=headers).json()
    baseline = next(item for item in restored if item["subject"] == bank["subject"])
    assert baseline["source"] == "built-in" and baseline["replaces_builtin"] is False

    reimported = client.post("/api/v1/admin/questions/import", headers=headers, json={"document": bank})
    assert reimported.status_code == 200 and reimported.json()["status"] == "imported"


def test_admin_can_edit_and_pause_managed_user():
    headers, _ = login()
    created = client.post("/api/v1/admin/parents", headers=headers,
                          json={"username": "managed.parent", "password": "welcome12", "display_name": "Managed"}).json()
    response = client.put(f"/api/v1/admin/users/{created['id']}", headers=headers,
                          json={"username": "updated.parent", "display_name": "Updated Parent", "disabled": True})
    assert response.status_code == 200
    assert response.json()["display_name"] == "Updated Parent" and response.json()["disabled"] is True
    assert client.post("/api/v1/auth/login", json={"username": "updated.parent", "password": "welcome12"}).status_code == 401


def test_admin_lists_created_user_and_can_impersonate_active_accounts():
    admin_headers, _ = login()
    created = client.post("/api/v1/admin/parents", headers=admin_headers,
                          json={"username": "visible.parent", "password": "welcome12",
                                "display_name": "Visible Parent"}).json()

    listed = client.get("/api/v1/admin/users", headers=admin_headers)
    assert listed.status_code == 200
    assert [(user["display_name"], user["username"]) for user in listed.json()] == [
        ("Visible Parent", "visible.parent")
    ]

    viewed = client.post(f"/api/v1/admin/users/{created['id']}/impersonate", headers=admin_headers)
    assert viewed.status_code == 200
    assert viewed.json()["user"] == created
    viewed_headers = {"Authorization": f"Bearer {viewed.json()['access_token']}"}
    assert client.get("/api/v1/auth/me", headers=viewed_headers).json() == created
    assert client.get("/api/v1/admin/users", headers=viewed_headers).status_code == 403
    assert client.get("/api/v1/parents/learners", headers=viewed_headers).status_code == 200

    paused = client.put(f"/api/v1/admin/users/{created['id']}", headers=admin_headers,
                        json={"username": "visible.parent", "display_name": "Visible Parent",
                              "disabled": True})
    assert paused.status_code == 200
    blocked = client.post(f"/api/v1/admin/users/{created['id']}/impersonate", headers=admin_headers)
    assert blocked.status_code == 409


def test_public_question_validation_checks_schema_and_generation_without_importing():
    invalid = client.post("/api/v1/questions/validate", json={"document": {"schemaVersion": 2}})
    assert invalid.status_code == 422
    assert invalid.json()["detail"]["errors"][0]["path"] == "$"

    bank = json.loads((Path(__file__).parents[2] / "content/math.question-bank.json").read_text())
    response = client.post("/api/v1/questions/validate", json={"document": bank})
    assert response.status_code == 200
    assert response.json() == {"valid": True, "templates_validated": 10}
    from sqlalchemy.orm import Session
    from app.database import engine
    from app.repositories import ContentRepository
    with Session(engine) as db:
        assert ContentRepository(db).banks() == {}

    bank["templates"][0]["answer"]["expression"] = "1 / 0"
    unsafe = client.post("/api/v1/questions/validate", json={"document": bank})
    assert unsafe.status_code == 422
    assert unsafe.json()["detail"]["errors"][0]["path"] == "$.templates"


def test_public_question_schema_is_downloadable():
    response = client.get("/api/v1/questions/schema")
    assert response.status_code == 200
    assert response.headers["content-type"].startswith("application/schema+json")
    assert "rabbit-question-bank-v2.schema.json" in response.headers["content-disposition"]
    assert response.json()["properties"]["schemaVersion"]["const"] == 2

    bank["templates"][0]["answer"]["expression"] = "1 / 0"
    unsafe = client.post("/api/v1/questions/validate", json={"document": bank})
    assert unsafe.status_code == 422
    assert unsafe.json()["detail"]["errors"][0]["path"] == "$.templates"


def test_public_question_schema_is_downloadable():
    response = client.get("/api/v1/questions/schema")
    assert response.status_code == 200
    assert response.headers["content-type"].startswith("application/schema+json")
    assert "rabbit-question-bank-v2.schema.json" in response.headers["content-disposition"]
    assert response.json()["properties"]["schemaVersion"]["const"] == 2


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
    assert "RABBIT_DEMO_ASSET_DIRECTORY=/app/frontend/public" in dockerfile
    assert "COPY frontend/public/trivia-animals.png ./frontend/public/trivia-animals.png" in dockerfile


def test_parent_signup_requires_email_activation_and_password_setup(monkeypatch):
    delivered = {}

    def capture(email, display_name, token):
        delivered.update(email=email, display_name=display_name, token=token)

    monkeypatch.setattr(main_module, "send_activation_email", capture)
    signup = client.post("/api/v1/auth/signup", json={"email": "Parent@Example.com", "display_name": "Pat Parent"})
    assert signup.status_code == 202
    assert delivered["email"] == "parent@example.com"
    from sqlalchemy import select
    from sqlalchemy.orm import Session
    from app.database import engine
    from app.db_models import AccountActivation
    with Session(engine) as db:
        expires_at = db.scalar(select(AccountActivation.expires_at))
        if expires_at.tzinfo is None:
            expires_at = expires_at.replace(tzinfo=UTC)
        assert datetime.now(UTC) + timedelta(days=6, hours=23) < expires_at <= datetime.now(UTC) + timedelta(days=7, minutes=1)
    assert client.post("/api/v1/auth/login", json={"email": "parent@example.com", "password": "new-password"}).status_code == 401

    inspection = client.get(f"/api/v1/auth/activate/{delivered['token']}")
    assert inspection.status_code == 200
    assert inspection.json() == {"email": "parent@example.com", "display_name": "Pat Parent"}

    activated = client.post("/api/v1/auth/activate", json={"token": delivered["token"], "password": "new-password"})
    assert activated.status_code == 200
    assert activated.json()["user"]["email"] == "parent@example.com"
    assert client.post("/api/v1/auth/activate", json={"token": delivered["token"], "password": "new-password"}).status_code == 410
    assert client.post("/api/v1/auth/login", json={"email": "PARENT@example.com", "password": "new-password"}).status_code == 200


def test_signup_does_not_reveal_an_existing_active_email(monkeypatch):
    delivered = []
    monkeypatch.setattr(main_module, "send_activation_email", lambda *args: delivered.append(args))
    client.post("/api/v1/auth/signup", json={"email": "same@example.com", "display_name": "First"})
    token = delivered[0][2]
    client.post("/api/v1/auth/activate", json={"token": token, "password": "new-password"})
    duplicate = client.post("/api/v1/auth/signup", json={"email": "same@example.com", "display_name": "Someone"})
    assert duplicate.status_code == 202
    assert len(delivered) == 1
