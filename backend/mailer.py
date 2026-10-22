"""
BurnCare — mailer.py
-----------------------------------------------------------------------
Sends emails (for now: the admin login code).

Fill the MAIL_... settings in the .env file to send real emails. With
Gmail, MAIL_PASSWORD must be an "App password" (Google Account → Security
→ 2-Step Verification → App passwords), not your normal password.

If MAIL_SERVER is empty (development), no email is sent: the code is
printed in the terminal where "python app.py" is running, so you can
still test the login.
"""

import smtplib
from email.message import EmailMessage

from flask import current_app


def send_email(to_address, subject, text):
    config = current_app.config
    if not config.get("MAIL_SERVER"):
        print("\n" + "=" * 60)
        print(f"[DEV MODE] Email to {to_address}\nSubject: {subject}\n\n{text}")
        print("=" * 60 + "\n", flush=True)
        return

    message = EmailMessage()
    message["From"] = config["MAIL_FROM"] or config["MAIL_USERNAME"]
    message["To"] = to_address
    message["Subject"] = subject
    message.set_content(text)

    with smtplib.SMTP(config["MAIL_SERVER"], config["MAIL_PORT"], timeout=15) as server:
        server.starttls()  # encrypt the connection
        server.login(config["MAIL_USERNAME"], config["MAIL_PASSWORD"])
        server.send_message(message)
