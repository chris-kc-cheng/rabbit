from __future__ import annotations

import hashlib
import secrets
from collections import Counter
from datetime import UTC, datetime, timedelta

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from .auth import hash_password
from .db_models import (
    AccountActivation, ApplicationSetting, Attempt, DemoAttemptRecord, DemoSession, Family, FamilyGuardian,
    ImportedQuestionBank, LearnerProfile, PracticeSession, RevokedToken, RewardSetting,
    SessionQuestion, User,
)
from .engine import GeneratedQuestion
from .models import PublicQuestion, RewardSettings


def user_record(user: User) -> dict:
    return {
        "id": user.id,
        "role": user.role,
        "username": user.username,
        "email": user.email,
        "display_name": user.display_name,
        "parent_id": user.family_id if user.role == "learner" else None,
        "family_id": user.family_id,
        "password_hash": user.password_hash,
        "disabled": user.disabled,
        "token_version": user.token_version,
        "default_subject": user.default_subject,
        "default_topics": list(user.default_topics or []),
    }


def public_user(user: User | dict) -> dict:
    record = user_record(user) if isinstance(user, User) else user
    return {key: record[key] for key in ("id", "role", "username", "email", "display_name", "parent_id", "disabled", "default_subject", "default_topics")}


class IdentityRepository:
    def __init__(self, session: Session):
        self.session = session

    def get_by_id(self, user_id: str) -> User | None:
        return self.session.get(User, user_id)

    def get_by_username(self, username: str) -> User | None:
        return self.session.scalar(select(User).where(User.username == username.strip().casefold()))

    def get_by_login(self, identifier: str) -> User | None:
        normalized = identifier.strip().casefold()
        return self.session.scalar(select(User).where((User.email == normalized) | (User.username == normalized)))

    def create_signup(self, email: str, display_name: str) -> tuple[User | None, str | None]:
        normalized = email.strip().casefold()
        existing = self.session.scalar(select(User).where(User.email == normalized))
        if existing is not None and not existing.disabled:
            return None, None
        token = secrets.token_urlsafe(32)
        token_hash = hashlib.sha256(token.encode()).hexdigest()
        if existing is None:
            identifier = secrets.token_urlsafe(10)
            self.session.add(Family(id=identifier))
            self.session.flush()
            existing = User(id=identifier, family_id=identifier, role="parent", username=normalized,
                            email=normalized, display_name=display_name.strip(), password_hash="", disabled=True)
            self.session.add(existing)
            self.session.flush()
            self.session.add_all([FamilyGuardian(family_id=identifier, guardian_user_id=identifier),
                                  LearnerProfile(user_id=identifier, family_id=identifier)])
        else:
            existing.display_name = display_name.strip()
            old = self.session.scalar(select(AccountActivation).where(AccountActivation.user_id == existing.id))
            if old is not None:
                self.session.delete(old)
                self.session.flush()
        self.session.add(AccountActivation(token_hash=token_hash, user_id=existing.id,
                                           expires_at=datetime.now(UTC) + timedelta(minutes=30)))
        self.session.commit()
        return existing, token

    def activation_user(self, token: str) -> User | None:
        activation = self.session.get(AccountActivation, hashlib.sha256(token.encode()).hexdigest())
        if activation is None or activation.used_at is not None:
            return None
        expires_at = activation.expires_at
        if expires_at.tzinfo is None:
            expires_at = expires_at.replace(tzinfo=UTC)
        if expires_at <= datetime.now(UTC):
            return None
        return self.get_by_id(activation.user_id)

    def activate(self, token: str, password: str) -> User | None:
        activation = self.session.get(AccountActivation, hashlib.sha256(token.encode()).hexdigest())
        user = self.activation_user(token)
        if activation is None or user is None:
            return None
        user.password_hash = hash_password(password)
        user.disabled = False
        user.token_version += 1
        activation.used_at = datetime.now(UTC)
        self.session.commit()
        self.session.refresh(user)
        return user

    def list_managed_users(self) -> list[User]:
        return list(self.session.scalars(
            select(User).where(User.role.in_(("parent", "learner"))).order_by(User.created_at, User.id)
        ))

    def create_parent(self, email: str, password: str, display_name: str) -> User:
        normalized_username = email.strip().casefold()
        if self.get_by_username(normalized_username) is not None:
            raise ValueError("That username is already in use")
        identifier = secrets.token_urlsafe(10)
        family = Family(id=identifier)
        user = User(
            id=identifier,
            family_id=identifier,
            role="parent",
            username=normalized_username,
            email=normalized_username,
            display_name=display_name.strip(),
            password_hash=hash_password(password),
        )
        try:
            # Flush each dependency explicitly. This is portable across SQLite and
            # PostgreSQL and avoids reporting a family/guardian constraint failure
            # as though the submitted username were a duplicate.
            self.session.add(family)
            self.session.flush()
            self.session.add(user)
            self.session.flush()
            self.session.add_all([
                FamilyGuardian(family_id=identifier, guardian_user_id=identifier),
                LearnerProfile(user_id=identifier, family_id=identifier),
            ])
            self.session.commit()
        except IntegrityError as error:
            self.session.rollback()
            if self._is_username_conflict(error):
                raise ValueError("That username is already in use") from error
            raise
        self.session.refresh(user)
        return user

    def create_learner(self, parent: dict, username: str, password: str, display_name: str) -> User:
        family_id = parent.get("family_id")
        if not family_id:
            raise ValueError("Parent is not attached to a family")
        user = User(
            id=secrets.token_urlsafe(10),
            family_id=family_id,
            role="learner",
            username=username.strip().casefold(),
            display_name=display_name.strip(),
            password_hash=hash_password(password),
        )
        self.session.add_all([user, LearnerProfile(user_id=user.id, family_id=family_id)])
        return self._commit_user(user)

    def learners_for_family(self, family_id: str) -> list[User]:
        return list(self.session.scalars(
            select(User).where(User.role == "learner", User.family_id == family_id).order_by(User.created_at, User.id)
        ))

    def reset_password(self, user: User, password: str) -> None:
        user.password_hash = hash_password(password)
        user.token_version += 1
        self.session.commit()

    def set_learning_preferences(self, user: User, subject: str, topics: list[str]) -> User:
        user.default_subject = subject
        user.default_topics = topics
        self.session.commit()
        self.session.refresh(user)
        return user

    def update_managed_user(self, user: User, username: str, display_name: str, disabled: bool) -> User:
        user.username = username.strip().casefold()
        if user.role == "parent":
            user.email = user.username
        user.display_name = display_name.strip()
        if user.disabled != disabled:
            user.token_version += 1
        user.disabled = disabled
        return self._commit_user(user)

    def _commit_user(self, user: User) -> User:
        try:
            self.session.commit()
        except IntegrityError as error:
            self.session.rollback()
            if self._is_username_conflict(error):
                raise ValueError("That username is already in use") from error
            raise
        self.session.refresh(user)
        return user

    @staticmethod
    def _is_username_conflict(error: IntegrityError) -> bool:
        constraint = getattr(getattr(error.orig, "diag", None), "constraint_name", "") or ""
        detail = str(error.orig).casefold()
        return ("username" in constraint.casefold()
                or "users.username" in detail
                or ("username" in detail and "unique" in detail))


def ensure_admin(session: Session, password: str) -> None:
    repository = IdentityRepository(session)
    if repository.get_by_username("admin") is not None:
        return
    session.add(User(
        id=secrets.token_urlsafe(10),
        role="admin",
        username="admin",
        display_name="Rabbit administrator",
        password_hash=hash_password(password),
    ))
    session.commit()


class PracticeRepository:
    def __init__(self, session: Session):
        self.session = session

    def create_session(self, session_id: str, learner_id: str, subject: str, seed: int,
                       questions: list[GeneratedQuestion]) -> None:
        self.session.add(PracticeSession(id=session_id, learner_id=learner_id, subject=subject, seed=str(seed)))
        for position, question in enumerate(questions):
            self.session.add(SessionQuestion(
                session_id=session_id, question_id=question.public.id, position=position,
                public_snapshot=question.public.model_dump(), grading_snapshot={
                    "correct_choice_id": question.correct_choice_id,
                    "explanation": question.explanation,
                    "choices": question.choices,
                    "generation": question.generation,
                },
            ))
        self.session.commit()

    def session_owner(self, session_id: str) -> str | None:
        practice = self.session.get(PracticeSession, session_id)
        return practice.learner_id if practice else None

    def question(self, session_id: str, question_id: str) -> GeneratedQuestion | None:
        row = self.session.get(SessionQuestion, (session_id, question_id))
        if row is None:
            return None
        grading = row.grading_snapshot
        return GeneratedQuestion(PublicQuestion.model_validate(row.public_snapshot), grading["correct_choice_id"],
                                 grading["explanation"], grading["choices"], grading["generation"])

    def attempt_exists(self, session_id: str, question_id: str) -> bool:
        return self.session.scalar(select(Attempt.id).where(
            Attempt.session_id == session_id, Attempt.question_id == question_id
        )) is not None

    def add_attempt(self, session_id: str, question_id: str, learner_id: str, snapshot: dict) -> None:
        self.session.add(Attempt(id=secrets.token_urlsafe(10), session_id=session_id, question_id=question_id,
                                 learner_id=learner_id, snapshot=snapshot))
        try:
            self.session.commit()
        except IntegrityError as error:
            self.session.rollback()
            raise ValueError("Question already answered") from error

    def progress(self, learner_id: str) -> dict:
        rows = list(self.session.scalars(
            select(Attempt).where(Attempt.learner_id == learner_id).order_by(Attempt.answered_at.desc(), Attempt.id.desc())
        ))
        attempts = [{**row.snapshot, "answered_at": row.answered_at.isoformat()} for row in rows]
        misconceptions = Counter(item["misconception_id"] for item in attempts if item.get("misconception_id"))
        correct = sum(bool(item["correct"]) for item in attempts)
        reward = self.session.get(RewardSetting, learner_id)
        return {
            "learner_id": learner_id, "attempts": len(attempts), "correct": correct,
            "points": sum(item.get("points_earned", 10 if item["correct"] else 0) for item in attempts),
            "accuracy": round(correct / len(attempts), 3) if attempts else 0,
            "hints_used": sum(bool(item.get("hint_used")) for item in attempts),
            "misconceptions": dict(misconceptions), "recent_attempts": attempts[:10],
            "attempt_history": attempts,
            "reward": RewardSettings.model_validate(reward.settings) if reward else RewardSettings(),
        }

    def set_reward(self, learner_id: str, reward: RewardSettings) -> RewardSettings:
        row = self.session.get(RewardSetting, learner_id)
        if row is None:
            self.session.add(RewardSetting(learner_id=learner_id, settings=reward.model_dump()))
        else:
            row.settings = reward.model_dump()
        self.session.commit()
        return reward


class ContentRepository:
    DRAFTS_KEY = "include_drafts"

    def __init__(self, session: Session):
        self.session = session

    def banks(self) -> dict[str, dict]:
        return {row.subject: row.document for row in self.session.scalars(select(ImportedQuestionBank))}

    def import_bank(self, document: dict, user_id: str) -> None:
        self.session.add(ImportedQuestionBank(subject=document["subject"], document=document, imported_by=user_id))
        try:
            self.session.commit()
        except IntegrityError as error:
            self.session.rollback()
            raise ValueError("A bank with this subject is already loaded; published content is immutable") from error

    def replace_draft(self, subject: str, document: dict, user_id: str) -> None:
        row = self.session.get(ImportedQuestionBank, subject)
        if row is None:
            raise ValueError("Question bank not found")
        if row.document["publicationStatus"] != "draft":
            raise ValueError("Published content is immutable")
        row.document = document
        row.imported_by = user_id
        self.session.commit()

    def publish_draft(self, subject: str) -> dict:
        row = self.session.get(ImportedQuestionBank, subject)
        if row is None:
            raise ValueError("Question bank not found")
        if row.document["publicationStatus"] == "published":
            return row.document
        row.document = {**row.document, "publicationStatus": "published"}
        self.session.commit()
        return row.document

    def delete_draft(self, subject: str) -> None:
        row = self.session.get(ImportedQuestionBank, subject)
        if row is None:
            raise ValueError("Question bank not found")
        if row.document["publicationStatus"] != "draft":
            raise ValueError("Published content is immutable")
        self.session.delete(row)
        self.session.commit()

    def include_drafts(self) -> bool:
        row = self.session.get(ApplicationSetting, self.DRAFTS_KEY)
        return bool(row and row.value.get("enabled"))

    def set_include_drafts(self, enabled: bool) -> None:
        row = self.session.get(ApplicationSetting, self.DRAFTS_KEY)
        if row is None:
            self.session.add(ApplicationSetting(key=self.DRAFTS_KEY, value={"enabled": enabled}))
        else:
            row.value = {"enabled": enabled}
        self.session.commit()


class TokenRepository:
    def __init__(self, session: Session):
        self.session = session

    def revoke(self, jti: str, user_id: str, expires_at: int) -> None:
        self.session.add(RevokedToken(jti=jti, user_id=user_id,
                                      expires_at=datetime.fromtimestamp(expires_at, UTC)))
        self.session.commit()

    def is_revoked(self, jti: str) -> bool:
        return self.session.get(RevokedToken, jti) is not None


class DemoRepository:
    def __init__(self, session: Session):
        self.session = session

    def create(self, session_id: str) -> None:
        self.session.add(DemoSession(id=session_id))
        self.session.commit()

    def attempt(self, session_id: str, question_id: str) -> DemoAttemptRecord | None:
        return self.session.get(DemoAttemptRecord, (session_id, question_id))

    def exists(self, session_id: str) -> bool:
        return self.session.get(DemoSession, session_id) is not None

    def add_attempt(self, session_id: str, question_id: str, response: object, result: dict) -> None:
        # JSON wraps scalar/list responses so every supported database stores the same shape.
        self.session.add(DemoAttemptRecord(session_id=session_id, question_id=question_id,
                                           response={"value": response}, result=result))
        try:
            self.session.commit()
        except IntegrityError as error:
            self.session.rollback()
            raise ValueError("Question already answered") from error
