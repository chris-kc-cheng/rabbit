import urllib.error

import pytest

from app.email_delivery import EmailDeliveryError, send_activation_email


class _Response:
    status = 200

    def __enter__(self):
        return self

    def __exit__(self, *args):
        return None


def test_activation_email_identifies_the_application(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("RESEND_API_KEY", "test-key")
    captured = []

    def urlopen(request, timeout):
        captured.append((request, timeout))
        return _Response()

    monkeypatch.setattr("app.email_delivery.urllib.request.urlopen", urlopen)

    send_activation_email("parent@example.com", "Parent", "activation-token")

    request, timeout = captured[0]
    assert request.get_header("User-agent") == "Rabbit-Learning/1.0"
    assert timeout == 10


def test_activation_email_wraps_provider_http_errors(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("RESEND_API_KEY", "test-key")

    def urlopen(request, timeout):
        raise urllib.error.HTTPError(request.full_url, 403, "Forbidden", {}, None)

    monkeypatch.setattr("app.email_delivery.urllib.request.urlopen", urlopen)

    with pytest.raises(EmailDeliveryError, match="could not be delivered"):
        send_activation_email("parent@example.com", "Parent", "activation-token")
