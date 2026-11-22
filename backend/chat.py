"""
BurnCare — chat.py
-----------------------------------------------------------------------
The Home page chatbot. The React chat window sends the visitor's
question to POST /api/chat. This file asks the AI model for a reply
and sends it back.

Settings (put them in the .env file, never in the React code):
    OPENAI_API_KEY   the secret key from platform.openai.com/api-keys
    OPENAI_MODEL     optional, which model to use
    OPENAI_VECTOR_STORE_ID   optional, the uploaded guideline the AI can search
"""

import os
import time
from collections import defaultdict, deque

import openai
from dotenv import load_dotenv
from flask import Blueprint, jsonify, request

load_dotenv()

bp = Blueprint("chat", __name__)

MODEL = os.environ.get("OPENAI_MODEL", "gpt-6-luna")
# If a model fails (busy, wrong name, over the limit), the next one in the list is tried.
MODELS = list(dict.fromkeys([MODEL, "gpt-6.1-sol"]))
MAX_MESSAGE_CHARS = 500   # longest question we accept
MAX_HISTORY = 6           # how many earlier messages the AI sees
RATE_LIMIT = 20           # messages allowed per visitor ...
RATE_WINDOW = 600         # ... in this many seconds

# The rules the AI must follow. Ask the supervising doctor to read this
# text before the demo: it decides what the chatbot may and may not say.
SYSTEM_PROMPT = """You are the BurnCare assistant on the BurnCare website. BurnCare helps people decide where a burn should be treated. You are not a doctor.

You can explain:
- The assessment: three short safety questions first, then questions about the patient and the burn, a body map to estimate how much of the body is burned (TBSA), and a burn photo. The AI estimates the burn depth. The result is one of three recommendations: no treatment needed, treat locally, or treat at a burn unit, with the reasons.
- The features: burn depth check, where to treat, body map (TBSA), heatmap explanation, voice entry, and a PDF report.
- Accounts: anyone can try a free assessment as a guest without an account. Patients with an account can save their reports. Healthcare staff can register to review shared cases and ask burn specialists for advice.

READ THE QUESTION CAREFULLY: treat something as a burn only if the visitor says skin was burned or touched by fire, hot liquid, steam, a hot object, a chemical, electricity or too much sun. Cold or cool water, or anything else that is not hot, does not cause a burn: say so in one sentence, and if the person seems hurt or unwell, say a doctor should check. If it is unclear what happened, ask one short question instead of guessing. If the visitor corrects you, accept the correction and answer the corrected question. Never repeat an earlier answer.

URGENT CASES (check this first): if the burn is on a baby or child, on the face, hands, feet, genitals or a joint, is large, deep, chemical or electrical, or the person has trouble breathing or is unconscious, start your reply by telling them to get urgent medical help now: call 997 or go to the nearest emergency department. Then give the first aid facts below in one sentence, and stop.

FIRST AID: only when the visitor asks what to do for a burn. These are the only facts you may give: cool the burn under cool running tap water for 20 minutes, within 3 hours of the burn; do not use ice, toothpaste or butter; keep the person warm. Say them in the visitor's language, in your own simple words, never copied word for word from this text. Do not add any other step or tip (no drying, wiping, bandaging, creams, clothing or medicine advice).

OTHER BURNS: never say how serious a specific burn is and never recommend medicine. Say a doctor should decide. Mention the free assessment only when the visitor asks whether or where to get treatment, not in every reply.

If you are not sure about something related to BurnCare (privacy, accuracy figures, launch dates), say you don't have that information. Never invent facts. If the question is not about BurnCare or burns, politely say you can only help with those.

GUIDELINE: use the uploaded guideline for facts. If it does not cover the question, say so and suggest seeing a doctor.

STYLE: reply in the visitor's language. In Arabic, use simple, clear Modern Standard Arabic with short sentences, speak to the person directly, and do not translate English word for word. Keep replies to 3 short sentences (4 for first aid). Plain text only: no markdown, no lists."""

# Remembers recent requests per visitor so nobody can use up the AI credit.
_recent = defaultdict(deque)


def _rate_limited(visitor):
    now = time.time()
    hits = _recent[visitor]
    while hits and now - hits[0] > RATE_WINDOW:
        hits.popleft()
    if len(hits) >= RATE_LIMIT:
        return True
    hits.append(now)
    return False


@bp.post("/api/chat")
def chat():
    data = request.get_json(silent=True) or {}
    message = str(data.get("message", "")).strip()

    if not message:
        return jsonify({"error": "Please type a question."}), 400
    if len(message) > MAX_MESSAGE_CHARS:
        return jsonify({"error": f"Please keep your question under {MAX_MESSAGE_CHARS} characters."}), 400
    if not os.environ.get("OPENAI_API_KEY"):
        return jsonify({"error": "The assistant is not available right now."}), 503
    if _rate_limited(request.remote_addr):
        return jsonify({"error": "Too many messages. Please wait a few minutes and try again."}), 429

    # Earlier messages of this chat, so follow-up questions make sense.
    history = []
    for item in (data.get("history") or [])[-MAX_HISTORY:]:
        if isinstance(item, dict) and item.get("role") in ("user", "assistant"):
            text = str(item.get("text", "")).strip()[: MAX_MESSAGE_CHARS * 2]
            if text:
                history.append({"role": item["role"], "content": text})
    # The conversation must start with the visitor's message.
    while history and history[0]["role"] != "user":
        history.pop(0)

    client = openai.OpenAI(api_key=os.environ["OPENAI_API_KEY"], timeout=20.0)

    # If a guideline was uploaded (see upload_guideline.py), let the AI search it.
    store_id = os.environ.get("OPENAI_VECTOR_STORE_ID")
    tools = [{"type": "file_search", "vector_store_ids": [store_id]}] if store_id else []

    reply = ""
    for model in MODELS:
        try:
            response = client.responses.create(
                model=model,
                instructions=SYSTEM_PROMPT,
                input=history + [{"role": "user", "content": message}],
                tools=tools,
                max_output_tokens=1500,
            )
            reply = (response.output_text or "").strip()
            if reply:
                break
            print(f"OpenAI returned no text ({model}).")
        except openai.OpenAIError as error:
            # Wrong key, wrong model name, busy, no credit left ...: the reason shows here.
            print(f"OpenAI error ({model}):", error)

    if not reply:
        return jsonify({"error": "The assistant is busy right now. Please try again in a moment."}), 502
    return jsonify({"reply": reply})
