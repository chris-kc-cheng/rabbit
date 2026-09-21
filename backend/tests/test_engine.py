import json
import random
from pathlib import Path

import jsonschema

from app.engine import evaluate, generate_question, generate_session, load_bank

ROOT = Path(__file__).resolve().parents[2]


def test_question_bank_matches_schema():
    schema = json.loads((ROOT / "content/question-template.schema.json").read_text())
    validator = jsonschema.Draft202012Validator(schema, format_checker=jsonschema.FormatChecker())
    paths = sorted((ROOT / "content").glob("*.question-bank.json"))
    assert {path.name for path in paths} == {
        "canadian-citizenship.question-bank.json", "math.question-bank.json"
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
    templates = load_bank()["templates"]
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
