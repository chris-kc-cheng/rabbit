from __future__ import annotations

import ast
import json
import operator
import os
import random
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from .models import ContentBlock, PublicChoice, PublicQuestion

ROOT = Path(__file__).resolve().parents[2]
BANK_PATH = Path(os.environ.get("RABBIT_QUESTION_BANK", ROOT / "content" / "math.question-bank.json"))
BANK_DIRECTORY = Path(os.environ.get("RABBIT_QUESTION_BANK_DIRECTORY", ROOT / "content"))
TOKEN = re.compile(r"{{\s*(.*?)\s*}}")

_BINARY_OPERATORS = {
    ast.Add: operator.add,
    ast.Sub: operator.sub,
    ast.Mult: operator.mul,
    ast.Div: operator.truediv,
    ast.FloorDiv: operator.floordiv,
    ast.Mod: operator.mod,
}
_UNARY_OPERATORS = {ast.UAdd: operator.pos, ast.USub: operator.neg}


class UnsafeExpression(ValueError):
    pass


def evaluate(expression: str, variables: dict[str, int | float]) -> int | float:
    """Evaluate the deliberately small Rabbit arithmetic DSL."""
    tree = ast.parse(expression, mode="eval")

    def visit(node: ast.AST) -> int | float:
        if isinstance(node, ast.Expression):
            return visit(node.body)
        if isinstance(node, ast.Constant) and type(node.value) in (int, float):
            return node.value
        if isinstance(node, ast.Name) and node.id in variables:
            return variables[node.id]
        if isinstance(node, ast.BinOp) and type(node.op) in _BINARY_OPERATORS:
            return _BINARY_OPERATORS[type(node.op)](visit(node.left), visit(node.right))
        if isinstance(node, ast.UnaryOp) and type(node.op) in _UNARY_OPERATORS:
            return _UNARY_OPERATORS[type(node.op)](visit(node.operand))
        raise UnsafeExpression(f"Unsupported expression node: {type(node).__name__}")

    result = visit(tree)
    if not isinstance(result, (int, float)) or isinstance(result, bool):
        raise UnsafeExpression("Expression did not produce a number")
    return result


def _resolve_path(path: str, variables: dict[str, Any]) -> Any:
    parts = path.split(".")
    if not parts or any(not re.fullmatch(r"[A-Za-z][A-Za-z0-9_]*", part) for part in parts):
        raise UnsafeExpression(f"Invalid value path: {path}")
    value: Any = variables
    for part in parts:
        if not isinstance(value, dict) or part not in value:
            raise UnsafeExpression(f"Unknown value path: {path}")
        value = value[part]
    if not isinstance(value, (str, int, float)) or isinstance(value, bool):
        raise UnsafeExpression(f"Value path is not renderable: {path}")
    return value


def render_text(text: str, variables: dict[str, Any]) -> str:
    def substitute(match: re.Match[str]) -> str:
        expression = match.group(1)
        if "." in expression or any(isinstance(value, dict) for value in variables.values()):
            try:
                return str(_resolve_path(expression, variables))
            except UnsafeExpression:
                if "." in expression:
                    raise
        numeric_variables = {
            key: value for key, value in variables.items()
            if isinstance(value, (int, float)) and not isinstance(value, bool)
        }
        return format_value(evaluate(expression, numeric_variables), "number")

    return TOKEN.sub(substitute, text)


def format_value(value: int | float, style: str) -> str:
    if style == "money":
        return f"${value:.2f}"
    if style == "decimal":
        return f"{value:.1f}"
    if isinstance(value, float) and value.is_integer():
        return str(int(value))
    return str(value)


def load_bank(path: Path | None = None) -> dict[str, Any]:
    return json.loads((path or BANK_PATH).read_text(encoding="utf-8"))


def load_banks(include_drafts: bool = False) -> dict[str, dict[str, Any]]:
    paths = sorted(BANK_DIRECTORY.glob("*.question-bank.json"))
    if BANK_PATH.exists() and BANK_PATH not in paths:
        paths.append(BANK_PATH)
    banks = [
        bank for path in paths
        if (bank := load_bank(path))["publicationStatus"] == "published" or include_drafts
    ]
    return {bank["subject"]: bank for bank in banks}


@dataclass
class GeneratedQuestion:
    public: PublicQuestion
    correct_choice_id: str
    explanation: str
    choices: dict[str, dict[str, Any]]
    generation: dict[str, Any]


def _public_question(
    template: dict[str, Any], variant: dict[str, Any], variables: dict[str, Any],
    candidates: list[dict[str, Any]], rng: random.Random, index: int,
) -> tuple[PublicQuestion, str, dict[str, dict[str, Any]]]:
    unique: dict[str, dict[str, Any]] = {}
    for candidate in candidates:
        unique.setdefault(candidate["value"], candidate)
    if len(unique) < 4 or "correct" not in {item["id"] for item in unique.values()}:
        raise ValueError(f"Template {template['id']} generated duplicate choices")

    selected = [next(item for item in unique.values() if item["id"] == "correct")]
    selected.extend(item for item in unique.values() if item["id"] != "correct")
    selected = selected[:4]
    rng.shuffle(selected)
    choices_by_public_id: dict[str, dict[str, Any]] = {}
    correct_choice_id = ""
    public_choices: list[PublicChoice] = []
    for position, item in enumerate(selected):
        public_id = f"option-{position + 1}"
        choices_by_public_id[public_id] = item
        public_choices.append(PublicChoice(id=public_id, value=item["value"]))
        if item["id"] == "correct":
            correct_choice_id = public_id
    instance_id = f"{template['id']}:{index}:{rng.getrandbits(32):08x}"
    prompt = [
        ContentBlock(type=block["type"], value=render_text(block["value"], variables))
        for block in variant["prompt"]
    ]
    visual = variant.get("visual")
    if visual:
        numeric_variables = {
            key: value for key, value in variables.items() if isinstance(value, (int, float))
        }
        visual = {
            key: evaluate(value, numeric_variables)
            if key in {"numerator", "denominator"}
            else value
            for key, value in visual.items()
        }
    public = PublicQuestion(
        id=instance_id, template_id=template["id"], variant_id=variant.get("id", "default"),
        skill=template["skill"], difficulty=variant.get("difficulty", template.get("difficulty", 1)),
        prompt=prompt, choices=public_choices, hint=render_text(variant["hint"], variables), visual=visual,
    )
    return public, correct_choice_id, choices_by_public_id


def _generate_computed_question(template: dict[str, Any], rng: random.Random, index: int) -> GeneratedQuestion:
    variables = {
        name: rng.randrange(spec["min"], spec["max"] + 1, spec.get("step", 1))
        for name, spec in template["parameters"].items()
    }
    answer = template["answer"]
    candidates = [
        {
            "id": "correct",
            "value": format_value(evaluate(answer["expression"], variables), answer.get("format", "number")),
            "feedback": render_text(template["explanation"], variables),
            "misconception": None,
        }
    ]
    for distractor in template["distractors"]:
        candidates.append(
            {
                "id": distractor["id"],
                "value": format_value(
                    evaluate(distractor["expression"], variables), answer.get("format", "number")
                ),
                "feedback": render_text(distractor["feedback"], variables),
                "misconception": distractor["misconception"],
            }
        )

    public, correct_choice_id, choices_by_public_id = _public_question(
        template, template, variables, candidates, rng, index
    )
    return GeneratedQuestion(
        public=public,
        correct_choice_id=correct_choice_id,
        explanation=render_text(template["explanation"], variables),
        choices=choices_by_public_id,
        generation={"templateVersion": template["version"], "variantId": "default", "parameters": variables},
    )


def _generate_fact_question(template: dict[str, Any], rng: random.Random, index: int) -> GeneratedQuestion:
    facts = template["knowledge"]["facts"]
    fact = rng.choice(facts)
    variant = rng.choice(template["variants"])
    field = variant["answerField"]
    pool_field = variant["distractorPoolField"]
    answer_value = str(fact[field])
    other_values = list(
        dict.fromkeys(
            str(item[pool_field])
            for item in facts
            if str(item[pool_field]) != answer_value
        )
    )
    if len(other_values) < 3:
        raise ValueError(f"Template {template['id']} has fewer than three distinct distractors")
    rng.shuffle(other_values)
    variables = {"fact": fact}
    explanation = render_text(variant["explanation"], variables)
    candidates = [
        {
            "id": "correct",
            "value": answer_value,
            "feedback": explanation,
            "misconception": None,
        }
    ]
    candidates.extend({
        "id": f"other-fact-{position + 1}", "value": value,
        "feedback": render_text(variant["feedback"], variables), "misconception": variant["misconception"],
    } for position, value in enumerate(other_values[:3]))
    public, correct_choice_id, choices = _public_question(template, variant, variables, candidates, rng, index)
    return GeneratedQuestion(
        public=public, correct_choice_id=correct_choice_id, explanation=explanation, choices=choices,
        generation={"templateVersion": template["version"], "variantId": variant["id"], "factId": fact["id"]},
    )


def generate_question(template: dict[str, Any], rng: random.Random, index: int) -> GeneratedQuestion:
    for _ in range(100):
        try:
            if template["type"] == "fact-collection-single-select":
                return _generate_fact_question(template, rng, index)
            return _generate_computed_question(template, rng, index)
        except ValueError as error:
            if "duplicate choices" not in str(error):
                raise
    raise ValueError(f"Template {template['id']} could not generate four distinct choices")


def generate_session(seed: int, count: int, bank: dict[str, Any] | None = None) -> list[GeneratedQuestion]:
    rng = random.Random(seed)
    selected_bank = bank or load_bank()
    templates = selected_bank["templates"]
    generated: list[GeneratedQuestion] = []
    seen_fact_variants: set[tuple[str, str, str]] = set()
    for index in range(count):
        template = templates[index % len(templates)]
        question = generate_question(template, rng, index)
        if template["type"] == "fact-collection-single-select":
            available = len(template["knowledge"]["facts"]) * len(template["variants"])
            for _ in range(100):
                key = (template["id"], question.generation["variantId"], question.generation["factId"])
                seen_for_template = sum(1 for item in seen_fact_variants if item[0] == template["id"])
                if key not in seen_fact_variants or seen_for_template >= available:
                    break
                question = generate_question(template, rng, index)
            seen_fact_variants.add(key)
        question.generation.update({
            "generatorVersion": selected_bank["generatorVersion"],
            "seed": seed,
            "templateId": template["id"],
        })
        generated.append(question)
    return generated
