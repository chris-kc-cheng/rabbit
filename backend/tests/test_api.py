from fastapi.testclient import TestClient

from app.main import app
from app.store import store

client = TestClient(app)


def setup_function():
    store.sessions.clear()
    store.rewards.clear()
    store.include_drafts = True


def test_health_and_subject_catalogue():
    assert client.get("/api/v1/health").json()["status"] == "ok"
    subjects = client.get("/api/v1/subjects").json()
    assert subjects == [
        {"id": "canadian-citizenship", "title": "Canadian Citizenship", "template_count": 1, "publication_status": "draft"},
        {"id": "math.elementary", "title": "Elementary Math", "template_count": 10, "publication_status": "published"},
    ]


def test_unknown_subject_is_rejected():
    response = client.post("/api/v1/sessions", json={"subject": "unknown.subject"})
    assert response.status_code == 400


def test_session_hides_answers_and_attempt_updates_parent_progress():
    response = client.post("/api/v1/sessions", json={"learner_id": "mina", "seed": 42, "count": 10})
    assert response.status_code == 201
    session = response.json()
    question = session["questions"][0]
    assert "correct_choice_id" not in question
    assert all("misconception" not in choice for choice in question["choices"])

    correct_choice_id = store.sessions[session["id"]].questions[question["id"]].correct_choice_id
    answer = client.post("/api/v1/attempts", json={
        "session_id": session["id"], "question_id": question["id"], "choice_id": correct_choice_id
    })
    assert answer.status_code == 200
    assert answer.json()["correct"] is True
    assert answer.json()["points_earned"] == 10

    duplicate = client.post("/api/v1/attempts", json={
        "session_id": session["id"], "question_id": question["id"], "choice_id": correct_choice_id
    })
    assert duplicate.status_code == 409

    progress = client.get("/api/v1/parents/learners/mina/progress").json()
    assert progress["attempts"] == 1
    assert progress["correct"] == 1
    assert progress["points"] == 10


def test_parent_can_configure_optional_reward():
    reward = {"enabled": True, "target_accuracy": 85, "reward": "Choose our family movie"}
    response = client.put("/api/v1/parents/learners/mina/reward", json=reward)
    assert response.status_code == 200
    assert response.json() == reward
    assert client.get("/api/v1/parents/learners/mina/progress").json()["reward"] == reward


def test_admin_can_hide_drafts_and_discover_canada_is_practiceable():
    canada = client.post("/api/v1/sessions", json={"subject": "canadian-citizenship", "seed": 9, "count": 2})
    assert canada.status_code == 201
    assert all(question["skill"] == "canada.history.milestones" for question in canada.json()["questions"])

    assert client.put("/api/v1/admin/content", json={"include_drafts": False}).json() == {"include_drafts": False}
    assert [subject["id"] for subject in client.get("/api/v1/subjects").json()] == ["math.elementary"]
    assert client.post("/api/v1/sessions", json={"subject": "canadian-citizenship"}).status_code == 400


def test_hint_use_is_reported_for_every_child():
    session = client.post("/api/v1/sessions", json={"learner_id": "demo-learner", "seed": 42, "count": 1}).json()
    question = session["questions"][0]
    correct = store.sessions[session["id"]].questions[question["id"]].correct_choice_id
    result = client.post("/api/v1/attempts", json={
        "session_id": session["id"], "question_id": question["id"], "choice_id": correct, "hint_used": True,
    })
    assert result.json()["points_earned"] == 10
    family = client.get("/api/v1/parents/families/demo-family/progress").json()
    assert [child["name"] for child in family["learners"]] == ["Mina", "Noah"]
    assert family["learners"][0]["progress"]["hints_used"] == 1
    assert family["learners"][0]["progress"]["points"] == 10
