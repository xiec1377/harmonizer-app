import json
import base64
import structlog
from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app.services.pitch_service import analyze_pitch_frame

log = structlog.get_logger()
router = APIRouter()


@router.websocket("/pitch")
async def pitch_websocket(websocket: WebSocket):
    """
    Real-time pitch analysis WebSocket.

    Client sends JSON frames:
    {
      "pcm_b64": "<base64-encoded 16-bit PCM mono bytes>",
      "sample_rate": 44100,
      "current_time": 12.45,
      "target_notes": [{"midi": 64, "start": 12.0, "end": 12.5}, ...]
    }

    Server responds with PitchFrame JSON.
    """
    await websocket.accept()
    log.info("ws_pitch_connected", client=str(websocket.client))

    try:
        while True:
            raw = await websocket.receive_text()
            try:
                msg = json.loads(raw)
            except json.JSONDecodeError:
                await websocket.send_json({"error": "Invalid JSON"})
                continue

            pcm_b64 = msg.get("pcm_b64", "")
            sample_rate = int(msg.get("sample_rate", 44100))
            current_time = float(msg.get("current_time", 0.0))
            target_notes = msg.get("target_notes", [])

            try:
                pcm_bytes = base64.b64decode(pcm_b64)
            except Exception:
                await websocket.send_json({"error": "Invalid base64 PCM data"})
                continue

            frame = analyze_pitch_frame(
                pcm_bytes=pcm_bytes,
                target_notes=target_notes,
                current_time=current_time,
                sample_rate=sample_rate,
            )

            if frame:
                await websocket.send_json(frame.model_dump())
            else:
                await websocket.send_json({"silence": True})

    except WebSocketDisconnect:
        log.info("ws_pitch_disconnected")
    except Exception as e:
        log.error("ws_pitch_error", error=str(e))
        try:
            await websocket.send_json({"error": str(e)})
        except Exception:
            pass
