from typing import Any, Literal

from pydantic import AliasChoices, BaseModel, Field, field_validator


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


class LearningPreferencesUpdate(BaseModel):
    subject: str = Field(min_length=1, max_length=80)
    topics: list[str] = Field(default_factory=list, max_length=50)


class SessionResponse(BaseModel):
    id: str
    learner_id: str
    questions: list[PublicQuestion]


class AttemptCreate(BaseModel):
    session_id: str
    question_id: str
    choice_id: str
    hint_used: bool = False
    time_spent_ms: int = Field(ge=0, le=86_400_000)


class AttemptResult(BaseModel):
    correct: bool
    correct_choice_id: str
    feedback: str
    explanation: str
    misconception_id: str | None = None
    points_earned: int


class RewardSettings(BaseModel):
    enabled: bool = False
    target_accuracy: int = Field(default=70, ge=50, le=100)
    reward: str = Field(default="A trip to the bookshop", min_length=1, max_length=80)


class ProgressResponse(BaseModel):
    learner_id: str
    attempts: int
    correct: int
    points: int
    accuracy: float
    hints_used: int
    misconceptions: dict[str, int]
    recent_attempts: list[dict]
    attempt_history: list[dict]
    reward: RewardSettings


class LoginRequest(BaseModel):
    email: str = Field(min_length=3, max_length=320, validation_alias=AliasChoices("email", "username"))
    password: str = Field(min_length=8, max_length=200)


class SignupRequest(BaseModel):
    email: str = Field(min_length=3, max_length=320)
    display_name: str = Field(min_length=1, max_length=80)

    @field_validator("email")
    @classmethod
    def validate_email(cls, value: str) -> str:
        normalized = value.strip().casefold()
        local, separator, domain = normalized.rpartition("@")
        if not separator or not local or "." not in domain or domain.startswith(".") or domain.endswith("."):
            raise ValueError("Enter a valid email address")
        return normalized


class PasswordRequest(BaseModel):
    password: str = Field(min_length=8, max_length=200)


class ActivationRequest(PasswordRequest):
    token: str = Field(min_length=32, max_length=200)


class ParentCreate(PasswordRequest):
    email: str = Field(min_length=3, max_length=320, validation_alias=AliasChoices("email", "username"))
    display_name: str = Field(min_length=1, max_length=80)


class ManagedUserUpdate(BaseModel):
    display_name: str = Field(min_length=1, max_length=80)
    username: str = Field(min_length=3, max_length=80)
    email: str | None = Field(default=None, min_length=3, max_length=320)
    disabled: bool


class LearnerCreate(PasswordRequest):
    username: str = Field(min_length=3, max_length=80)
    display_name: str = Field(min_length=1, max_length=80)


class DefaultSubjectUpdate(BaseModel):
    subject: str = Field(min_length=1, max_length=80)


class QuestionImport(BaseModel):
    document: dict[str, Any]


class AdminQuestionPreview(BaseModel):
    seed: int | None = None
    count: int = Field(default=1, ge=1, le=10)
    template_id: str | None = Field(default=None, min_length=1, max_length=120)
    variant_id: str | None = Field(default=None, min_length=1, max_length=120)


class ContentSettings(BaseModel):
    include_drafts: bool = False


class WorksheetCreate(BaseModel):
    subject: str = Field(min_length=1, max_length=80)
    topic: str = Field(min_length=1, max_length=120)
    count: int = Field(default=10, ge=1, le=50)
    seed: int | None = None
