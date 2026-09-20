from __future__ import annotations

import ast
import json
import operator
import random
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from .models import ContentBlock, PublicChoice, PublicQuestion

ROOT = Path(__file__).resolve().parents[2]
BANK_PATH = ROOT / "content" / "math.question-bank.json"
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


def render_text(text: str, variables: dict[str, int | float]) -> str:
    def substitute(match: re.Match[str]) -> str:
        return format_value(evaluate(match.group(1), variables), "number")

    return TOKEN.sub(substitute, text)


def format_value(value: int | float, style: str) -> str:
    if style == "money":
        return f"${value:.2f}"
    if style == "decimal":
        return f"{value:.1f}"
    if isinstance(value, float) and value.is_integer():
        return str(int(value))
    return str(value)


def load_bank() -> dict[str, Any]:
    return json.loads(BANK_PATH.read_text(encoding="utf-8"))


@dataclass
class GeneratedQuestion:
    public: PublicQuestion
    correct_choice_id: str
    explanation: str
    choices: dict[str, dict[str, Any]]


def _generate_question_once(template: dict[str, Any], rng: random.Random, index: int) -> GeneratedQuestion:
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
        for block in template["prompt"]
    ]
    visual = template.get("visual")
    if visual:
        visual = {
            key: evaluate(value, variables) if key in {"numerator", "denominator"} else value
            for key, value in visual.items()
        }
    public = PublicQuestion(
        id=instance_id,
        template_id=template["id"],
        skill=template["skill"],
        difficulty=template["difficulty"],
        prompt=prompt,
        choices=public_choices,
        hint=render_text(template["hint"], variables),
        visual=visual,
    )
    return GeneratedQuestion(
        public=public,
        correct_choice_id=correct_choice_id,
        explanation=render_text(template["explanation"], variables),
        choices=choices_by_public_id,
    )


def generate_question(template: dict[str, Any], rng: random.Random, index: int) -> GeneratedQuestion:
    for _ in range(100):
        try:
            return _generate_question_once(template, rng, index)
        except ValueError as error:
            if "duplicate choices" not in str(error):
                raise
    raise ValueError(f"Template {template['id']} could not generate four distinct choices")


def generate_session(seed: int, count: int) -> list[GeneratedQuestion]:
    rng = random.Random(seed)
    templates = load_bank()["templates"]
    return [generate_question(template, rng, index) for index, template in enumerate(templates[:count])]
