import structlog
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List
from music21 import note, stream

from app.models.schemas import Note, ChordSegment
from app.services.harmony_service import generate_harmony

log = structlog.get_logger()
router = APIRouter()


class HarmonyRequest(BaseModel):
    notes: List[Note]
    chords: List[ChordSegment]
    key: str
    mode: str
    tempo_bpm: float
    


# @router.post("/generate")
# async def generate(req: HarmonyRequest):
#     """Use OpenAI to generate harmony voices from melody analysis."""
#     if not req.notes:
#         raise HTTPException(400, "No melody notes provided")

#     try:
#         analysis = await generate_harmony(
#             melody_notes=req.notes,
#             chords=req.chords,
#             key=req.key,
#             mode=req.mode,
#             tempo_bpm=req.tempo_bpm,
#         )
#     except Exception as e:
#         log.error("harmony_generation_error", error=str(e))
#         raise HTTPException(500, f"Harmony generation failed: {str(e)}")

#     return analysis.model_dump()



# body: JSON.stringify({
#         notes: notes.split(',').map((n) => n.trim()),
#         chords: [], // You can modify this to include actual chord segments if needed
#         key: 'C', // Replace with actual key if available
#         mode: 'major', // Replace with actual mode if available
#         tempo_bpm: 120, // Replace with actual tempo if available
#         harmony: harmony, // Include the selected harmony option
#       }),

class HarmonyRequest(BaseModel):
    notes: List[str]
    harmony: str
    
    
def harmony_voice(notes, interval):
    return [n.transpose(interval) for n in notes]


HARMONY_MAP = {
    "lower octave": "-P8",
    "higher octave": "P8",
    "lower third": "-M3",
    "higher third": "M3",
    "lower fifth": "-P5",
    "higher fifth": "P5",
    "lower seventh": "-m7",
    "higher seventh": "m7",
}

@router.post("/generate")
async def generate(req: HarmonyRequest):
    print("generate API called with notes:", req.notes, "and harmony:", req.harmony)
    if not req.notes or not req.harmony:
        raise HTTPException(status_code=400, detail="No melody notes or harmony provided")

    interval = HARMONY_MAP.get(req.harmony)
    if not interval:
        raise HTTPException(status_code=400, detail=f"Invalid harmony option: {req.harmony}")

    try:
        melody = [note.Note(p, quarterLength=1) for p in req.notes]
        print("melody:", melody)

        voices = {
            "melody": melody,
            "harmony": harmony_voice(melody, interval),
        }

        score = stream.Score()
        for name, voice_notes in voices.items():
            print(f"{name}: {voice_notes}")
            part = stream.Part(id=name)
            part.append(voice_notes)
            score.append(part)

        score.write("midi", fp="harmonized.mid")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))