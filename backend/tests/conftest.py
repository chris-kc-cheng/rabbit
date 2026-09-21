import os
import secrets


os.environ.setdefault("RABBIT_ADMIN_PASSWORD", secrets.token_urlsafe(24))
