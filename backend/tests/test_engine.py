import json
import random
from pathlib import Path

import jsonschema

from app.engine import evaluate, generate_question, generate_session, load_bank

ROOT = Path(__file__).resolve().parents[2]


def test_question_bank_matches_schema():
    schema = json.loads((ROOT / "content/question-template.schema.json").read_text())
    bank = load_bank()
    jsonschema.Draft202012Validator(schema).validate(bank)
    assert len(bank["templates"]) == 10


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
