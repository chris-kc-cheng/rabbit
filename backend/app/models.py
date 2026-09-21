from typing import Any, Literal

from pydantic import BaseModel, Field


class ContentBlock(BaseModel):
    type: Literal["text", "math"]
    value: str


class PublicChoice(BaseModel):
    id: str
    value: str


class PublicQuestion(BaseModel):
    id: str
    template_id: str
    variant_id: str
    skill: str
    difficulty: int
    prompt: list[ContentBlock]
    choices: list[PublicChoice]
    hint: str
    visual: dict | None = None


class SessionCreate(BaseModel):
    learner_id: str = Field(default="demo-learner", min_length=1, max_length=80)
    subject: str = Field(default="math.elementary", min_length=1, max_length=80)
    seed: int | None = None
    count: int = Field(default=10, ge=1, le=10)


class SessionResponse(BaseModel):
    id: str
    learner_id: str
    questions: list[PublicQuestion]


class AttemptCreate(BaseModel):
    session_id: str
    question_id: str
    choice_id: str


class AttemptResult(BaseModel):
    correct: bool
    correct_choice_id: str
    feedback: str
    explanation: str
    misconception_id: str | None = None
    points_earned: int


class RewardSettings(BaseModel):
    enabled: bool = False
    target_points: int = Field(default=200, ge=50, le=10_000, multiple_of=10)
    reward: str = Field(default="A trip to the bookshop", min_length=1, max_length=80)


class ProgressResponse(BaseModel):
    learner_id: str
    attempts: int
    correct: int
    points: int
    accuracy: float
    misconceptions: dict[str, int]
    recent_attempts: list[dict]
    reward: RewardSettings


class LoginRequest(BaseModel):
    username: str = Field(min_length=3, max_length=80)
    password: str = Field(min_length=8, max_length=200)


class PasswordRequest(BaseModel):
    password: str = Field(min_length=8, max_length=200)


class ParentCreate(LoginRequest):
    display_name: str = Field(min_length=1, max_length=80)


class LearnerCreate(PasswordRequest):
    username: str = Field(min_length=3, max_length=80)
    display_name: str = Field(min_length=1, max_length=80)


class QuestionImport(BaseModel):
    document: dict[str, Any]
