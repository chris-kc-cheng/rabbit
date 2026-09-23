import json
import random
from pathlib import Path

import jsonschema

from app.engine import evaluate, generate_question, generate_session, load_bank, resolve_visual
from app.worksheet import build_worksheet_pdf

ROOT = Path(__file__).resolve().parents[2]


def test_question_bank_matches_schema():
    schema = json.loads((ROOT / "content/question-template.schema.json").read_text())
    validator = jsonschema.Draft202012Validator(schema, format_checker=jsonschema.FormatChecker())
    paths = sorted((ROOT / "content").glob("*.question-bank.json"))
    assert {path.name for path in paths} == {
        "canadian-citizenship.question-bank.json", "math-visuals.question-bank.json", "math.question-bank.json"
    }
    for path in paths:
        validator.validate(load_bank(path))


def test_safe_expression_evaluator():
    assert evaluate("a + b * 3", {"a": 2, "b": 4}) == 14
    try:
        evaluate("__import__('os').system('false')", {})
    except ValueError:
        pass
    else:
        raise AssertionError("Unsafe call was accepted")


def test_every_template_generates_distinct_rationale_aware_choices():
    templates = [
        template
        for path in sorted((ROOT / "content").glob("*.question-bank.json"))
        for template in load_bank(path)["templates"]
        if template["type"] == "single-select"
    ]
    for seed in range(250):
        rng = random.Random(seed)
        for index, template in enumerate(templates):
            question = generate_question(template, rng, index)
            assert len(question.public.choices) == 4
            assert len({choice.value for choice in question.public.choices}) == 4
            assert question.correct_choice_id in question.choices
            for choice in question.choices.values():
                if choice["id"] != "correct":
                    assert choice["misconception"]
                    assert choice["feedback"]


def test_generation_is_deterministic_for_same_seed():
    first = [item.public.model_dump() for item in generate_session(12345, 10)]
    second = [item.public.model_dump() for item in generate_session(12345, 10)]
    assert first == second


def test_every_declarative_visual_resolves_without_drawing_code():
    questions = {
        item.public.visual["type"]: item.public.visual
        for item in generate_session(12345, 7, load_bank(ROOT / "content" / "math-visuals.question-bank.json"))
        if item.public.visual
    }
    assert set(questions) == {"data-table", "fraction-bar", "rectangle-grid", "scene-2d", "angle", "triangle", "solid"}
    assert questions["data-table"]["columns"] == ["Number", "Hundreds", "Tens"]
    assert len(questions["data-table"]["rows"]) == 2
    assert questions["angle"]["degrees"] in range(30, 71, 10)
    assert all(isinstance(questions["triangle"][key], int) for key in ("base", "height"))
    assert all(isinstance(point["x"], int) for point in questions["scene-2d"]["points"])
    for visual in questions.values():
        payload = json.dumps(visual).lower()
        assert "<svg" not in payload and "javascript:" not in payload and "<script" not in payload


def test_visual_semantics_reject_malformed_tables_and_scene_references():
    try:
        resolve_visual({"type": "data-table", "caption": "Values", "columns": ["A", "B"],
                        "rows": [["1"]], "alt": "A malformed table."}, {})
    except ValueError as error:
        assert "rows" in str(error)
    else:
        raise AssertionError("A ragged table was accepted")

    try:
        resolve_visual({"type": "scene-2d", "points": [{"id": "a", "x": "1", "y": "2"}],
                        "segments": [{"from": "a", "to": "missing"}], "alt": "A broken scene."}, {})
    except ValueError as error:
        assert "declared points" in str(error)
    else:
        raise AssertionError("An unknown scene point was accepted")


def test_declarative_visual_pdf_is_deterministic_and_contains_table_text():
    bank = load_bank(ROOT / "content" / "math-visuals.question-bank.json")
    questions = generate_session(20260923, len(bank["templates"]), bank)
    first = build_worksheet_pdf(bank["title"], "all-visuals", questions, 20260923)
    second = build_worksheet_pdf(bank["title"], "all-visuals", questions, 20260923)
    assert first == second
    assert first.startswith(b"%PDF-")
    assert b"Addends by place value" in first
    assert b"Answer key" in first


def test_fact_collection_selects_a_fact_and_hides_answer_metadata():
    bank = load_bank(ROOT / "content" / "canadian-citizenship.question-bank.json")
    first = generate_session(8675309, 6, bank)
    second = generate_session(8675309, 6, bank)
    assert [item.public.model_dump() for item in first] == [item.public.model_dump() for item in second]
    assert len({item.generation["factId"] for item in first}) == 6
    for question in first:
        assert question.public.variant_id == "identify-year"
        assert len(question.public.choices) == 4
        assert len({choice.value for choice in question.public.choices}) == 4
        payload = question.public.model_dump()
        assert "correct_choice_id" not in payload
        assert "generation" not in payload
        assert question.generation["generatorVersion"] == "2.0.0"
        assert question.generation["seed"] == 8675309
