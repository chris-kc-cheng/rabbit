import os

from sqlalchemy.orm import Session

from .database import engine
from .repositories import ensure_admin


def main() -> None:
    if os.environ.get("RABBIT_ENV") == "production" and not os.environ.get("RABBIT_ADMIN_PASSWORD"):
        raise RuntimeError("RABBIT_ADMIN_PASSWORD is required in production")
    with Session(engine) as session:
        ensure_admin(session, os.environ.get("RABBIT_ADMIN_PASSWORD", "rabbit-admin"))


if __name__ == "__main__":
    main()
