from pydantic import BaseModel
from typing import List, Optional


class Note(BaseModel):
    midi: int
    frequency: float
    name: str         # e.g. "C4"
    start: float      # seconds
    end: float        # seconds
    confidence: float


class ChordSegment(BaseModel):
    start: float
    end: float
    root: str
    quality: str      # major, minor, dominant7, etc.
    notes: List[str]


class HarmonyVoice(BaseModel):
    name: str         # e.g. "Alto", "Tenor"
    interval: str     # e.g. "Minor 3rd below"
    notes: List[Note]
    description: str


class HarmonyAnalysis(BaseModel):
    melody_notes: List[Note]
    chords: List[ChordSegment]
    key: str
    mode: str         # major / minor
    tempo_bpm: Optional[float]
    voices: List[HarmonyVoice]
    tips: List[str]
    song_context: str


class PitchFrame(BaseModel):
    frequency: float
    midi: float
    note_name: str
    cents_off: float  # deviation from nearest harmony note
    target_midi: Optional[float]
    in_tune: bool     # within ±25 cents
