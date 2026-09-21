import json
from pathlib import Path

from fastapi.testclient import TestClient
from jsonschema import validate

from app.main import app

client = TestClient(app)
ROOT = Path(__file__).resolve().parents[2]


def test_demo_pack_matches_schema_and_hides_answers():
    pack = json.loads((ROOT / "content/demo-pack.json").read_text(encoding="utf-8"))
    schema = json.loads((ROOT / "content/demo-pack.schema.json").read_text(encoding="utf-8"))
    validate(pack, schema)
    assert len({question["id"] for question in pack["questions"]}) == len(pack["questions"])
    session = client.post("/api/v1/demo-pack/sessions").json()
    assert len(session["questions"]) == 8
    assert all("answer" not in question and "feedback" not in question for question in session["questions"])
    assert {question["subject"] for question in session["questions"]} == {"math", "trivia", "english"}


def test_each_demo_kind_grades_and_retry_is_idempotent():
    pack = json.loads((ROOT / "content/demo-pack.json").read_text(encoding="utf-8"))
    session_id = client.post("/api/v1/demo-pack/sessions").json()["id"]
    for question in pack["questions"]:
        payload = {"session_id": session_id, "question_id": question["id"], "response": question["answer"]}
        response = client.post("/api/v1/demo-pack/attempts", json=payload)
        assert response.status_code == 200
        assert response.json()["correct"] is True
        assert client.post("/api/v1/demo-pack/attempts", json=payload).json() == response.json()


def test_multi_select_rejects_duplicate_and_wrong_answer():
    session_id = client.post("/api/v1/demo-pack/sessions").json()["id"]
    base = {"session_id": session_id, "question_id": "trivia-mammals-1"}
    duplicate = client.post("/api/v1/demo-pack/attempts", json={**base, "response": ["fox", "fox"]})
    assert duplicate.status_code == 400
    wrong = client.post("/api/v1/demo-pack/attempts", json={**base, "response": ["frog", "owl"]})
    assert wrong.status_code == 200
    assert wrong.json()["correct"] is False
    changed = client.post("/api/v1/demo-pack/attempts", json={**base, "response": ["fox", "bat"]})
    assert changed.status_code == 409
