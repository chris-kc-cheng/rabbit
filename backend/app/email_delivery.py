"""Transactional-email delivery through Resend's HTTPS API."""
from __future__ import annotations

import json
import html
import os
import urllib.error
import urllib.request


class EmailDeliveryError(RuntimeError):
    pass


def send_activation_email(email: str, display_name: str, token: str) -> None:
    api_key = os.environ.get("RESEND_API_KEY")
    public_url = os.environ.get("RABBIT_PUBLIC_URL", "http://localhost:5173").rstrip("/")
    sender = os.environ.get("RABBIT_EMAIL_FROM", "Rabbit <onboarding@resend.dev>")
    if not api_key:
        raise EmailDeliveryError("Email delivery is not configured")

    activation_url = f"{public_url}/?activate={token}"
    payload = json.dumps({
        "from": sender,
        "to": [email],
        "subject": "Activate your Rabbit account",
        "html": (
            f"<p>Hello {html.escape(display_name)},</p>"
            "<p>Welcome to Rabbit! Use this private, temporary link to activate your account "
            "and choose your password. It expires in 30 minutes.</p>"
            f'<p><a href="{activation_url}">Activate my Rabbit account</a></p>'
            "<p>If you did not request this account, you can ignore this email.</p>"
        ),
    }).encode()
    request = urllib.request.Request(
        "https://api.resend.com/emails",
        data=payload,
        headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=10) as response:
            if response.status not in {200, 201}:
                raise EmailDeliveryError("Email provider rejected the activation email")
    except (urllib.error.URLError, TimeoutError) as error:
        raise EmailDeliveryError("Activation email could not be delivered") from error
