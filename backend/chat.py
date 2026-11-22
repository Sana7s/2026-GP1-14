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
MAX_HISTORY = 20           # how many earlier messages the AI sees
RATE_LIMIT = 20           # messages allowed per visitor ...
RATE_WINDOW = 600         # ... in this many seconds

# The rules the AI must follow live in system_prompt.txt (next to this file).
# Ask the supervising doctor to read that file before the demo: it decides
# what the chatbot may and may not say.
with open(os.path.join(os.path.dirname(__file__), "system_prompt.txt"), encoding="utf-8") as f:
    SYSTEM_PROMPT = f.read().strip()

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
