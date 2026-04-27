#!/usr/bin/env python3
"""
LLM helper script - bridges Next.js to emergentintegrations (Python-only).
Reads JSON from stdin, returns JSON to stdout.

Input: { "session_id": str, "system": str, "text": str, "image_base64": str | null }
Output: { "ok": bool, "content": str, "error": str | null }
"""
import sys
import json
import os
import asyncio
import tempfile
import base64
from dotenv import load_dotenv

load_dotenv("/app/.env")

from emergentintegrations.llm.chat import LlmChat, UserMessage, FileContentWithMimeType


async def run(payload):
    api_key = os.environ.get("EMERGENT_LLM_KEY", "")
    if not api_key:
        return {"ok": False, "content": "", "error": "EMERGENT_LLM_KEY missing"}

    session_id = payload.get("session_id", "codevista-default")
    system_msg = payload.get("system", "You are a helpful assistant.")
    user_text = payload.get("text", "")
    image_b64 = payload.get("image_base64")  # raw base64 (no data: prefix)
    image_mime = payload.get("image_mime", "image/png")

    chat = LlmChat(
        api_key=api_key,
        session_id=session_id,
        system_message=system_msg,
    ).with_model("anthropic", "claude-sonnet-4-5-20250929")

    file_contents = None
    tmp_path = None
    if image_b64:
        # write image to temp file (Anthropic via emergentintegrations needs file path)
        try:
            ext = "png" if "png" in image_mime else ("jpg" if "jpeg" in image_mime or "jpg" in image_mime else "webp")
            tmp = tempfile.NamedTemporaryFile(delete=False, suffix=f".{ext}")
            tmp.write(base64.b64decode(image_b64))
            tmp.flush()
            tmp_path = tmp.name
            tmp.close()
            file_contents = [FileContentWithMimeType(file_path=tmp_path, mime_type=image_mime)]
        except Exception as e:
            return {"ok": False, "content": "", "error": f"image decode error: {e}"}

    msg = UserMessage(text=user_text, file_contents=file_contents) if file_contents else UserMessage(text=user_text)

    try:
        response = await chat.send_message(msg)
        return {"ok": True, "content": str(response), "error": None}
    except Exception as e:
        return {"ok": False, "content": "", "error": str(e)}
    finally:
        if tmp_path:
            try:
                os.unlink(tmp_path)
            except Exception:
                pass


def main():
    raw = sys.stdin.read()
    try:
        payload = json.loads(raw) if raw else {}
    except Exception as e:
        print(json.dumps({"ok": False, "content": "", "error": f"invalid input json: {e}"}))
        return
    result = asyncio.run(run(payload))
    print(json.dumps(result))


if __name__ == "__main__":
    main()
