from fastapi.testclient import TestClient

from app.main import app
from app.store import store

client = TestClient(app)


def setup_function():
    store.sessions.clear()
    store.rewards.clear()


def test_health_and_subject_catalogue():
    assert client.get("/api/v1/health").json()["status"] == "ok"
    subjects = client.get("/api/v1/subjects").json()
    assert subjects == [{"id": "math.elementary", "title": "Elementary Math", "template_count": 10}]


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
    reward = {"enabled": True, "target_points": 250, "reward": "Choose our family movie"}
    response = client.put("/api/v1/parents/learners/mina/reward", json=reward)
    assert response.status_code == 200
    assert response.json() == reward
    assert client.get("/api/v1/parents/learners/mina/progress").json()["reward"] == reward
