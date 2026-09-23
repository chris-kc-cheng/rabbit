from __future__ import annotations

import os
from html import escape
from io import BytesIO
from pathlib import Path
from typing import Any

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.graphics.shapes import Circle, Drawing, Line, Polygon, Rect, String
from reportlab.platypus import Image, KeepTogether, PageBreak, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

from .engine import GeneratedQuestion

ROOT = Path(__file__).resolve().parents[2]
DEMO_ASSET_DIRECTORY = Path(os.environ.get("RABBIT_DEMO_ASSET_DIRECTORY", ROOT / "frontend" / "public"))


def topic_title(topic: str) -> str:
    """Turn a stable dotted skill identifier into a friendly worksheet label."""
    return topic.split(".")[-1].replace("-", " ").replace("_", " ").title()


def _question_prompt(question: GeneratedQuestion) -> str:
    # The PDF consumes the same already-resolved blocks as the web client.  We
    # deliberately show restricted-LaTeX source as text until print KaTeX is added.
    return " ".join(block.value for block in question.public.prompt)


def _question_visual(visual: dict[str, Any] | None, body_style: ParagraphStyle) -> list[Any]:
    if not visual:
        return []
    if visual["type"] == "data-table":
        data = [[Paragraph(escape(cell), body_style) for cell in visual["columns"]]]
        data += [[Paragraph(escape(cell), body_style) for cell in row] for row in visual["rows"]]
        table = Table(data, colWidths=[6.8 * inch / len(visual["columns"])] * len(visual["columns"]), repeatRows=1)
        table.setStyle(TableStyle([
            ("GRID", (0, 0), (-1, -1), .5, colors.HexColor("#6c5ce7")),
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#f1effb")),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ]))
        return [Paragraph(escape(visual["caption"]), body_style), table]
    drawing = Drawing(330, 150)
    purple = colors.HexColor("#6c5ce7")
    pale = colors.HexColor("#f1effb")
    if visual["type"] == "fraction-bar":
        width = 300 / visual["denominator"]
        for index in range(visual["denominator"]):
            drawing.add(Rect(15 + index * width, 45, width - 2, 55,
                             fillColor=purple if index < visual["numerator"] else pale,
                             strokeColor=purple))
    elif visual["type"] == "rectangle-grid":
        cell_width, cell_height = 260 / visual["width"], 105 / visual["height"]
        for index in range(visual["width"] * visual["height"]):
            drawing.add(Rect(35 + (index % visual["width"]) * cell_width,
                             25 + (index // visual["width"]) * cell_height,
                             cell_width, cell_height, fillColor=purple if index < visual.get("shaded", 0) else pale,
                             strokeColor=purple))
    elif visual["type"] == "angle":
        import math
        radians = math.radians(visual["degrees"])
        drawing.add(Line(165, 25, 285, 25, strokeColor=purple, strokeWidth=2))
        drawing.add(Line(165, 25, 165 + 115 * math.cos(radians), 25 + 115 * math.sin(radians), strokeColor=purple, strokeWidth=2))
        drawing.add(String(205, 45, visual.get("label", f'{visual["degrees"]} degrees'), fontSize=9))
    elif visual["type"] == "triangle":
        apex = 165 if visual["kind"] == "isosceles" else 285
        drawing.add(Polygon([35, 20, 285, 20, apex, 130], fillColor=pale, strokeColor=purple, strokeWidth=2))
        drawing.add(String(135, 5, f'{visual["base"]} {visual["unit"]}', fontSize=9))
        drawing.add(String(290, 70, f'{visual["height"]} {visual["unit"]}', fontSize=9))
    elif visual["type"] == "solid":
        drawing.add(Rect(65, 20, 180, 90, fillColor=pale, strokeColor=purple, strokeWidth=2))
        drawing.add(Polygon([65, 110, 100, 135, 280, 135, 245, 110], fillColor=colors.white, strokeColor=purple))
        drawing.add(Polygon([245, 20, 280, 45, 280, 135, 245, 110], fillColor=pale, strokeColor=purple))
    else:
        points = {point["id"]: (15 + point["x"] * 3, 15 + point["y"] * 1.2) for point in visual["points"]}
        for polygon in visual.get("polygons", []):
            drawing.add(Polygon([coordinate for point in polygon["points"] for coordinate in points[point]],
                                fillColor=pale if polygon.get("shaded") else None, strokeColor=purple))
        for segment in visual["segments"]:
            start, end = points[segment["from"]], points[segment["to"]]
            drawing.add(Line(*start, *end, strokeColor=purple, strokeWidth=2))
        for point in visual["points"]:
            x, y = points[point["id"]]
            drawing.add(Circle(x, y, 2.5, fillColor=purple, strokeColor=purple))
            if point.get("label"):
                drawing.add(String(x + 4, y + 4, point["label"], fontSize=8))
    drawing.add(String(12, 140, visual["alt"], fontSize=7, fillColor=colors.HexColor("#555555")))
    return [drawing]


def build_worksheet_pdf(
    subject_title: str, topic: str, questions: list[GeneratedQuestion], seed: int
) -> bytes:
    """Create a printable worksheet followed by its answer key."""
    output = BytesIO()
    document = SimpleDocTemplate(
        output, pagesize=letter, rightMargin=.65 * inch, leftMargin=.65 * inch,
        topMargin=.6 * inch, bottomMargin=.6 * inch,
        title=f"Rabbit {topic_title(topic)} worksheet",
        author="Rabbit Learning",
        pageCompression=0,
        invariant=1,
    )
    styles = getSampleStyleSheet()
    title_style = ParagraphStyle("RabbitTitle", parent=styles["Title"], textColor=colors.HexColor("#5441c8"))
    subtitle = ParagraphStyle("RabbitSubtitle", parent=styles["Normal"], alignment=TA_CENTER, textColor=colors.HexColor("#746e86"), spaceAfter=18)
    question_style = ParagraphStyle("Question", parent=styles["BodyText"], fontSize=11, leading=15, spaceAfter=6)
    choice_style = ParagraphStyle("Choice", parent=styles["BodyText"], fontSize=10, leading=14, leftIndent=12)
    story: list[Any] = [
        Paragraph("Rabbit practice worksheet", title_style),
        Paragraph(f"{escape(subject_title)} &bull; {escape(topic_title(topic))} &bull; {len(questions)} questions", subtitle),
        Table([["Name:", "", "Date:", ""]], colWidths=[.55*inch, 2.6*inch, .5*inch, 2.6*inch],
              style=TableStyle([("LINEBELOW", (1, 0), (1, 0), .5, colors.grey), ("LINEBELOW", (3, 0), (3, 0), .5, colors.grey)])),
        Spacer(1, 18),
    ]
    for number, question in enumerate(questions, 1):
        choices = [Paragraph(f"{chr(65 + index)}. {escape(choice.value)}", choice_style)
                   for index, choice in enumerate(question.public.choices)]
        visual_note = _question_visual(question.public.visual, choice_style)
        story.append(KeepTogether([
            Paragraph(f"<b>{number}.</b> {escape(_question_prompt(question))}", question_style),
            *visual_note, *choices, Spacer(1, 13),
        ]))

    story.extend([PageBreak(), Paragraph("Answer key", title_style),
                  Paragraph(f"Keep this page with the grown-up &bull; generation seed {seed}", subtitle)])
    for number, question in enumerate(questions, 1):
        choice_index = next(index for index, choice in enumerate(question.public.choices)
                            if choice.id == question.correct_choice_id)
        answer = question.public.choices[choice_index].value
        story.append(KeepTogether([
            Paragraph(f"<b>{number}. {chr(65 + choice_index)} &mdash; {escape(answer)}</b>", question_style),
            Paragraph(escape(question.explanation), choice_style), Spacer(1, 9),
        ]))

    document.build(story)
    return output.getvalue()


def _demo_visual(name: str) -> Drawing:
    drawing = Drawing(330, 145)
    if name == "triangle":
        drawing.add(Polygon([35, 20, 285, 20, 285, 125], fillColor=colors.HexColor("#e7f5ec"),
                            strokeColor=colors.HexColor("#206c6b"), strokeWidth=2))
        drawing.add(String(105, 83, "10 cm", fontSize=10))
        drawing.add(String(43, 28, "30 degrees", fontSize=9))
        drawing.add(String(295, 67, "? cm", fontSize=10))
    else:
        drawing.add(Rect(90, 25, 145, 82, fillColor=colors.HexColor("#e7f5ec"),
                         strokeColor=colors.HexColor("#206c6b"), strokeWidth=2))
        drawing.add(Polygon([90, 107, 128, 132, 273, 132, 235, 107], fillColor=colors.HexColor("#f3fbf6"),
                            strokeColor=colors.HexColor("#206c6b"), strokeWidth=2))
        drawing.add(Polygon([235, 25, 273, 50, 273, 132, 235, 107], fillColor=colors.HexColor("#d4eee0"),
                            strokeColor=colors.HexColor("#206c6b"), strokeWidth=2))
        drawing.add(String(145, 10, "4 cm", fontSize=9))
        drawing.add(String(278, 75, "3 cm", fontSize=9))
        drawing.add(String(244, 118, "2 cm", fontSize=9))
    return drawing


def _demo_formula(source: str) -> str:
    return {
        r"\sin(30^\circ)=\frac{\text{opposite}}{\text{hypotenuse}}": "sin(30 degrees) = opposite / hypotenuse",
        r"V=\ell\times w\times h": "V = length x width x height",
        r"A=\frac{1}{2}bh": "A = 1/2 x b x h",
    }.get(source, source)


def _demo_answer(question: dict) -> str:
    answer = question["answer"]
    if "choices" in question:
        selected = {answer} if isinstance(answer, str) else set(answer)
        return ", ".join(choice["label"] for choice in question["choices"] if choice["id"] in selected)
    if "tiles" in question:
        labels = {tile["id"]: tile["label"] for tile in question["tiles"]}
        return " ".join(labels[item] for item in answer)
    return str(answer)


def build_demo_pack_pdf(questions: list[dict]) -> bytes:
    """Print the complete fixed demo pack, including its authored media and answer key."""
    output = BytesIO()
    document = SimpleDocTemplate(
        output, pagesize=letter, rightMargin=.65 * inch, leftMargin=.65 * inch,
        topMargin=.6 * inch, bottomMargin=.6 * inch, title="Rabbit kid-view activity pack",
        author="Rabbit Learning", keywords=",".join(question["id"] for question in questions),
        pageCompression=0, invariant=1,
    )
    styles = getSampleStyleSheet()
    title_style = ParagraphStyle("DemoTitle", parent=styles["Title"], textColor=colors.HexColor("#5441c8"))
    subtitle = ParagraphStyle("DemoSubtitle", parent=styles["Normal"], alignment=TA_CENTER,
                              textColor=colors.HexColor("#746e86"), spaceAfter=18)
    question_style = ParagraphStyle("DemoQuestion", parent=styles["BodyText"], fontSize=11, leading=15, spaceAfter=6)
    choice_style = ParagraphStyle("DemoChoice", parent=styles["BodyText"], fontSize=10, leading=14, leftIndent=12)
    story: list[Any] = [
        Paragraph("Rabbit activity pack", title_style),
        Paragraph(f"All {len(questions)} activities from the kid view", subtitle),
        Table([["Name:", "", "Date:", ""]], colWidths=[.55*inch, 2.6*inch, .5*inch, 2.6*inch],
              style=TableStyle([("LINEBELOW", (1, 0), (1, 0), .5, colors.grey),
                                ("LINEBELOW", (3, 0), (3, 0), .5, colors.grey)])),
        Spacer(1, 18),
    ]
    subject_names = {"math": "Math Lab", "trivia": "Trivia Show", "english": "Word Studio",
                     "canadian-citizenship": "Discover Canada"}
    previous_subject = None
    for number, question in enumerate(questions, 1):
        elements: list[Any] = []
        if question["subject"] != previous_subject:
            elements.append(Paragraph(subject_names[question["subject"]], styles["Heading2"]))
            previous_subject = question["subject"]
        elements.extend([
            Paragraph(f"<b>{number}. {escape(question['title'])}</b>", question_style),
            Paragraph(escape(question["instruction"]), question_style),
        ])
        if question.get("visual"):
            elements.append(_demo_visual(question["visual"]))
        if question.get("image"):
            image_path = DEMO_ASSET_DIRECTORY / question["image"].lstrip("/")
            preview = Image(str(image_path), width=3.6 * inch, height=2.4 * inch, kind="proportional")
            preview.hAlign = "CENTER"
            elements.extend([preview, Paragraph(escape(question.get("image_alt", "")), choice_style)])
        if question.get("latex"):
            elements.append(Paragraph(f"<b>Formula:</b> {escape(_demo_formula(question['latex']))}", choice_style))
        if question.get("choices"):
            elements.extend(Paragraph(f"{chr(65 + index)}. {escape(choice['label'])}", choice_style)
                            for index, choice in enumerate(question["choices"]))
        elif question.get("tiles"):
            elements.append(Paragraph("Word tiles: " + " / ".join(escape(tile["label"]) for tile in question["tiles"]), choice_style))
            elements.append(Paragraph("Answer: __________________________________________________________", choice_style))
        else:
            elements.append(Paragraph("Answer: __________________________________________________________", choice_style))
        elements.append(Spacer(1, 13))
        story.append(KeepTogether(elements))

    story.extend([PageBreak(), Paragraph("Answer key", title_style),
                  Paragraph("Keep this page with the grown-up", subtitle)])
    for number, question in enumerate(questions, 1):
        story.append(KeepTogether([
            Paragraph(f"<b>{number}. {escape(_demo_answer(question))}</b>", question_style),
            Paragraph(escape(question["feedback"]), choice_style), Spacer(1, 9),
        ]))
    document.build(story)
    return output.getvalue()
