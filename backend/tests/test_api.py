import json
from pathlib import Path

from fastapi.testclient import TestClient

from app.main import app
from app.store import store

client = TestClient(app)


def setup_function():
    store.sessions.clear(); store.rewards.clear(); store.imported_banks.clear(); store.revoked_tokens.clear()
    store.include_drafts = False
    for user_id, user in list(store.users.items()):
        if user["role"] != "admin":
            store.usernames.pop(user["username"], None); store.users.pop(user_id)


def login(username="admin", password="rabbit-admin"):
    response = client.post("/api/v1/auth/login", json={"username": username, "password": password})
    assert response.status_code == 200
    return {"Authorization": f"Bearer {response.json()['access_token']}"}, response.json()["user"]


def family():
    admin, _ = login()
    parent = client.post("/api/v1/admin/parents", headers=admin, json={"username":"parent.one","password":"welcome12","display_name":"A Parent"}).json()
    parent_headers, _ = login("parent.one", "welcome12")
    learner = client.post("/api/v1/parents/learners", headers=parent_headers, json={"username":"learner.one","password":"practice12","display_name":"Mina"}).json()
    learner_headers, _ = login("learner.one", "practice12")
    return parent_headers, learner_headers, learner


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
    assert client.post("/api/v1/attempts", headers=learner_headers, json={"session_id":session["id"],"question_id":question["id"],"choice_id":correct}).status_code == 200
    progress = client.get(f"/api/v1/parents/learners/{learner['id']}/progress", headers=parent_headers).json()
    assert progress["attempts"] == 1 and progress["points"] == 10
    parent_id = client.get("/api/v1/auth/me", headers=parent_headers).json()["id"]
    family_report = client.get(f"/api/v1/parents/families/{parent_id}/progress", headers=parent_headers).json()
    assert [child["name"] for child in family_report["learners"]] == ["Mina"]
    assert client.get("/api/v1/parents/families/another-family/progress", headers=parent_headers).status_code == 403
    assert client.get(f"/api/v1/parents/families/{parent_id}/progress", headers=learner_headers).status_code == 403
    admin, _ = login(); assert client.get(f"/api/v1/parents/learners/{learner['id']}/progress", headers=admin).status_code == 403
    assert client.put(f"/api/v1/parents/learners/{learner['id']}/password",headers=parent_headers,json={"password":"new-password"}).status_code == 204
    assert client.post("/api/v1/auth/login",json={"username":"learner.one","password":"practice12"}).status_code == 401


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
