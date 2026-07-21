import json
import structlog
from typing import List
from openai import AsyncOpenAI
from app.models.schemas import Note, ChordSegment, HarmonyVoice, HarmonyAnalysis
from app.config import settings
from app.services.audio_service import midi_to_note_name, midi_to_freq

log = structlog.get_logger()

client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)


async def generate_harmony(
    melody_notes: List[Note],
    chords: List[ChordSegment],
    key: str,
    mode: str,
    tempo_bpm: float,
) -> HarmonyAnalysis:
    """Use OpenAI to generate intelligent harmony voices and teaching tips."""

    # Build a compact representation for the prompt
    note_summary = _summarize_notes(melody_notes[:80])  # cap to avoid token overflow
    chord_summary = _summarize_chords(chords[:30])

    prompt = f"""You are an expert vocal arranger and harmony teacher.

I have analyzed an audio file and extracted the following:

KEY: {key} {mode}
TEMPO: {tempo_bpm:.1f} BPM
MELODY NOTES (note name, start_sec, end_sec, confidence):
{note_summary}

CHORD PROGRESSION:
{chord_summary}

Your task:
1. Generate 2–3 harmony voices (e.g. "Alto", "Tenor", "High Harmony") that complement this melody.
2. For each voice, provide the actual harmony notes (one note per melody note) with MIDI values.
3. Provide 4–6 practical tips for a singer learning to harmonize this piece.
4. Write a brief "song_context" paragraph describing the harmonic character of this piece.

Rules for harmony generation:
- Prefer 3rds and 6ths (consonant intervals) with occasional 4ths/5ths for color
- Respect the chord tones — harmony notes should land on chord tones at chord changes
- Stay within a singable range: Alto F3-D5 (MIDI 53-74), Tenor C3-A4 (MIDI 48-69), High Harmony A3-F#5 (MIDI 57-78)
- Voice leading: minimize large leaps between consecutive harmony notes
- When melody rests, mark harmony note MIDI as -1

Respond ONLY with a JSON object exactly matching this schema:
{{
  "voices": [
    {{
      "name": "Alto",
      "interval": "Minor 3rd / Major 6th below",
      "description": "A warm alto line hugging the chord tones...",
      "notes": [
        {{"midi": 60, "frequency": 261.63, "name": "C4", "start": 0.0, "end": 0.5, "confidence": 1.0}},
        ...
      ]
    }}
  ],
  "tips": [
    "Start by humming the harmony while the melody plays — train your ear before singing it out loud.",
    ...
  ],
  "song_context": "This piece moves through a I-IV-V progression in {key} {mode}..."
}}

Every note in "notes" MUST correspond 1-to-1 with the melody notes provided (same count, same start/end times). Use midi: -1 for rests."""

    log.info("openai_harmony_request", notes=len(melody_notes), chords=len(chords))

    response = await client.chat.completions.create(
        model=settings.OPENAI_MODEL,
        messages=[{"role": "user", "content": prompt}],
        response_format={"type": "json_object"},
    )

    raw = (response.choices[0].message.content or "").strip()

    data = json.loads(raw)

    voices = []
    for v in data["voices"]:
        harmony_notes = []
        for n in v["notes"]:
            if n["midi"] == -1:
                continue
            harmony_notes.append(Note(
                midi=n["midi"],
                frequency=round(midi_to_freq(n["midi"]), 2),
                name=midi_to_note_name(n["midi"]),
                start=n["start"],
                end=n["end"],
                confidence=1.0,
            ))
        voices.append(HarmonyVoice(
            name=v["name"],
            interval=v["interval"],
            notes=harmony_notes,
            description=v["description"],
        ))

    log.info("openai_harmony_done", voices=len(voices))

    return HarmonyAnalysis(
        melody_notes=melody_notes,
        chords=chords,
        key=key,
        mode=mode,
        tempo_bpm=tempo_bpm,
        voices=voices,
        tips=data["tips"],
        song_context=data["song_context"],
    )


def _summarize_notes(notes: List[Note]) -> str:
    lines = [f"{n.name}, {n.start:.2f}s–{n.end:.2f}s, conf={n.confidence:.2f}" for n in notes]
    return "\n".join(lines)


def _summarize_chords(chords: List[ChordSegment]) -> str:
    lines = [f"{c.start:.1f}s–{c.end:.1f}s: {c.root} {c.quality} ({', '.join(c.notes)})" for c in chords]
    return "\n".join(lines)
