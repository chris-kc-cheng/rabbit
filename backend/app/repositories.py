from __future__ import annotations

import secrets

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from .auth import hash_password
from .db_models import Family, FamilyGuardian, LearnerProfile, User


def user_record(user: User) -> dict:
    return {
        "id": user.id,
        "role": user.role,
        "username": user.username,
        "display_name": user.display_name,
        "parent_id": user.family_id if user.role == "learner" else None,
        "family_id": user.family_id,
        "password_hash": user.password_hash,
        "disabled": user.disabled,
        "token_version": user.token_version,
    }


def public_user(user: User | dict) -> dict:
    record = user_record(user) if isinstance(user, User) else user
    return {key: record[key] for key in ("id", "role", "username", "display_name", "parent_id")}


class IdentityRepository:
    def __init__(self, session: Session):
        self.session = session

    def get_by_id(self, user_id: str) -> User | None:
        return self.session.get(User, user_id)

    def get_by_username(self, username: str) -> User | None:
        return self.session.scalar(select(User).where(User.username == username.strip().casefold()))

    def list_managed_users(self) -> list[User]:
        return list(self.session.scalars(
            select(User).where(User.role.in_(("parent", "learner"))).order_by(User.created_at, User.id)
        ))

    def create_parent(self, username: str, password: str, display_name: str) -> User:
        identifier = secrets.token_urlsafe(10)
        family = Family(id=identifier)
        user = User(
            id=identifier,
            family_id=identifier,
            role="parent",
            username=username.strip().casefold(),
            display_name=display_name.strip(),
            password_hash=hash_password(password),
        )
        self.session.add_all([
            family,
            user,
            FamilyGuardian(family_id=identifier, guardian_user_id=identifier),
        ])
        return self._commit_user(user)

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

    def _commit_user(self, user: User) -> User:
        try:
            self.session.commit()
        except IntegrityError as error:
            self.session.rollback()
            raise ValueError("That username is already in use") from error
        self.session.refresh(user)
        return user


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
