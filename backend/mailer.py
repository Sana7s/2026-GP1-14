"""
BurnCare — mailer.py
-----------------------------------------------------------------------
Sends emails: the admin login code and the password reset code.

Each email has two versions in one message:
  - an HTML version (BurnCare colours, the code in big boxes)
  - a plain-text version, for email apps that don't show HTML
The email app picks the one it can show.

Settings come from the .env file:
  MAIL_SERVER=smtp.gmail.com
  MAIL_PORT=587
  MAIL_USERNAME=burncare.noreply@gmail.com
  MAIL_PASSWORD=xxxx xxxx xxxx xxxx      (a Gmail "App password")
  MAIL_FROM=BurnCare <burncare.noreply@gmail.com>

MAIL_FROM sets the name people see in their inbox ("BurnCare"). With
Gmail, the address inside < > must be the same Gmail account as
MAIL_USERNAME, or Gmail replaces it.

The BurnCare banner at the top of each email is the file
static/email-banner.png (600 x 200). It is attached INSIDE the email
(not a web link), so it shows even though the website isn't online yet.
If the file is missing, a plain "BurnCare" header is used instead.

If MAIL_SERVER is empty (development), no email is sent: it is printed
in the terminal where "python app.py" is running, so you can still test.
"""

import os
import smtplib
from email.message import EmailMessage
from email.utils import make_msgid
from html import escape

from flask import current_app

# BurnCare colours, the same as the website (styles.css).
ROSE = "#D9434D"     # Rose Red: code boxes and accents
BLUSH = "#FCEAEC"    # Blush: page background around the card
INK = "#29272A"      # Dark Text: headings and the code
MUTED = "#6B6669"    # softer text (Dark Text, lighter)
LINE = "#F7D6D8"     # Soft Pink: thin divider

BANNER_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "static", "email-banner.png")
BANNER_ID = "burncare-banner"  # how the email's HTML points to the attached banner


def send_email(to_address, subject, text, html=None):
    """Send one email. text = the plain version; html = the designed version."""
    config = current_app.config
    if not config.get("MAIL_SERVER"):
        print("\n" + "=" * 60)
        print(f"[DEV MODE] Email to {to_address}\nSubject: {subject}\n\n{text}")
        print("=" * 60 + "\n", flush=True)
        return

    sender = config["MAIL_FROM"] or f"BurnCare <{config['MAIL_USERNAME']}>"
    message = EmailMessage()
    message["From"] = sender
    message["To"] = to_address
    message["Subject"] = subject
    # Gmail and Outlook show "noreply" emails better with these headers:
    message["Message-ID"] = make_msgid(domain="burncare")
    message["Auto-Submitted"] = "auto-generated"  # an automatic email, not a person
    message.set_content(text)
    if html:
        message.add_alternative(html, subtype="html")
        # Attach the banner inside the HTML part, so <img src="cid:..."> finds it.
        if os.path.exists(BANNER_FILE):
            with open(BANNER_FILE, "rb") as image:
                message.get_payload()[1].add_related(
                    image.read(), maintype="image", subtype="png", cid=f"<{BANNER_ID}>"
                )

    with smtplib.SMTP(config["MAIL_SERVER"], config["MAIL_PORT"], timeout=15) as server:
        server.starttls()  # encrypt the connection
        server.login(config["MAIL_USERNAME"], config["MAIL_PASSWORD"])
        server.send_message(message)


def banner_html():
    """The top of the email: the logo banner, or a plain header if the file is missing."""
    if os.path.exists(BANNER_FILE):
        return (f'<img src="cid:{BANNER_ID}" width="480" alt="BurnCare" '
                'style="display:block;width:100%;max-width:480px;height:auto;border:0;">')
    return (f'<div style="background:{ROSE};padding:20px 28px;font-size:22px;'
            'font-weight:700;color:#FFFFFF;">BurnCare</div>')


def code_email(heading, intro, code, minutes, footer_note):
    """Build both versions of a "here is your code" email.
    Returns (text, html)."""
    text = (
        f"{heading}\n\n"
        f"{intro}\n\n"
        f"Your code: {code}\n\n"
        f"This code works for {minutes} minutes. Never share it with anyone, "
        f"BurnCare will never ask you for it.\n\n"
        f"{footer_note}\n\n"
        "— BurnCare\n"
        "This is an automatic email. Replies to it are not read."
    )

    # Email apps ignore <style> blocks and CSS classes, so every style is
    # written on the tag itself, and the layout uses tables.
    digits = "".join(
        f'<td style="padding:0 4px;"><div style="width:44px;height:56px;line-height:56px;'
        f"border:2px solid {ROSE};border-radius:10px;background:#FFFFFF;text-align:center;"
        f'font-size:28px;font-weight:700;color:{INK};font-family:Consolas,Menlo,monospace;">'
        f"{escape(d)}</div></td>"
        for d in code
    )
    html = f"""<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>{escape(heading)}</title></head>
<body style="margin:0;padding:0;background:{BLUSH};">
  <!-- Preview line shown in the inbox list -->
  <div style="display:none;max-height:0;overflow:hidden;">Your BurnCare code is {escape(code)}. It works for {minutes} minutes.</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:{BLUSH};padding:32px 12px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#FFFFFF;border-radius:16px;overflow:hidden;font-family:Arial,Helvetica,sans-serif;color:{INK};">
        <tr><td style="padding:0;line-height:0;">{banner_html()}</td></tr>
        <tr><td style="padding:28px 28px 8px;">
          <h1 style="margin:0 0 12px;font-size:22px;line-height:1.3;color:{INK};">{escape(heading)}</h1>
          <p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:{MUTED};">{escape(intro)}</p>
          <table role="presentation" cellpadding="0" cellspacing="0" align="center" style="margin:0 auto 24px;"><tr>{digits}</tr></table>
          <p style="margin:0 0 8px;font-size:14px;line-height:1.6;color:{MUTED};text-align:center;">
            This code works for <strong style="color:{INK};">{minutes} minutes</strong>.
          </p>
          <p style="margin:0 0 24px;font-size:14px;line-height:1.6;color:{MUTED};text-align:center;">
            Never share it with anyone. BurnCare will never ask you for it.
          </p>
        </td></tr>
        <tr><td style="padding:16px 28px 24px;border-top:1px solid {LINE};">
          <p style="margin:0 0 8px;font-size:13px;line-height:1.6;color:{MUTED};">{escape(footer_note)}</p>
          <p style="margin:0;font-size:12px;line-height:1.6;color:{MUTED};">
            This is an automatic email from BurnCare. Please don't reply; replies to this address are not read.
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>"""
    return text, html