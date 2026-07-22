import os
import asyncio
import numpy as np
import librosa
import soundfile as sf
import structlog
from typing import Tuple, List
from app.models.schemas import Note, ChordSegment


log = structlog.get_logger()

MIDI_NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]


def midi_to_note_name(midi: int) -> str:
    octave = (midi // 12) - 1
    name = MIDI_NOTE_NAMES[midi % 12]
    return f"{name}{octave}"


def freq_to_midi(freq: float) -> float:
    if freq <= 0:
        return 0.0
    return 12 * np.log2(freq / 440.0) + 69


def midi_to_freq(midi: float) -> float:
    return 440.0 * (2 ** ((midi - 69) / 12))


async def analyze_audio(file_path: str) -> Tuple[List[Note], List[ChordSegment], str, str, float]:
    """
    Extracts melody notes, chord segments, key, mode, tempo from an audio file.
    Returns (notes, chords, key, mode, tempo_bpm).
    """
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(None, _analyze_sync, file_path)


def _analyze_sync(file_path: str):
    log.info("audio_analysis_starting...", path=file_path)

    y, sr = librosa.load(file_path, sr=22050, mono=True, duration=120)

    # --- Tempo ---
    tempo, _ = librosa.beat.beat_track(y=y, sr=sr)
    log.info(f"tempo: {tempo}")
    tempo_bpm = float(tempo[0]) if hasattr(tempo, '__len__') else float(tempo)
    log.info(f"temp_bpm: {tempo_bpm}")

    # --- Key detection ---
    chroma = librosa.feature.chroma_cqt(y=y, sr=sr)
    chroma_mean = chroma.mean(axis=1)
    key_idx = int(np.argmax(chroma_mean))
    key_name = MIDI_NOTE_NAMES[key_idx]
    log.info(f"key name: {key_name}")

    # Krumhansl-Schmuckler simplified: major vs minor
    major_profile = np.array([6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88])
    minor_profile = np.array([6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17])

    def correlate_profile(chroma_vec, profile):
        scores = []
        for shift in range(12):
            shifted = np.roll(profile, shift)
            scores.append(np.corrcoef(chroma_vec, shifted)[0, 1])
        return max(scores)

    major_score = correlate_profile(chroma_mean, major_profile)
    minor_score = correlate_profile(chroma_mean, minor_profile)
    mode = "major" if major_score >= minor_score else "minor"
    log.info(f"mode: {mode}")

    # --- Melody (pitch tracking with pyin) ---
    f0, voiced_flag, voiced_probs = librosa.pyin(
        y,
        fmin=librosa.note_to_hz("C2"),
        fmax=librosa.note_to_hz("C7"),
        sr=sr,
        frame_length=2048,
    )

    times = librosa.times_like(f0, sr=sr)
    notes = _extract_notes(f0, voiced_flag, voiced_probs, times)

    # --- Chords (chroma-based segmentation) ---
    chords = _extract_chords(y, sr, key_name, mode)

    log.info(
        "audio_analysis_done",
        notes=len(notes),
        chords=len(chords),
        key=key_name,
        mode=mode,
        tempo=tempo_bpm,
    )
    return notes, chords, key_name, mode, tempo_bpm


def _extract_notes(f0, voiced_flag, voiced_probs, times) -> List[Note]:
    """Group consecutive voiced frames into discrete note objects."""
    notes = []
    current: dict | None = None

    for i, (freq, voiced, prob) in enumerate(zip(f0, voiced_flag, voiced_probs)):
        if not voiced or freq is None or np.isnan(freq):
            if current:
                notes.append(_finalize_note(current))
                current = None
            continue

        midi_raw = freq_to_midi(float(freq))
        midi_int = int(round(midi_raw))

        if current is None:
            current = {"midi": midi_int, "freqs": [float(freq)], "probs": [float(prob)], "start": float(times[i]), "end": float(times[i])}
        elif abs(midi_int - current["midi"]) <= 1:
            current["freqs"].append(float(freq))
            current["probs"].append(float(prob))
            current["end"] = float(times[i])
        else:
            notes.append(_finalize_note(current))
            current = {"midi": midi_int, "freqs": [float(freq)], "probs": [float(prob)], "start": float(times[i]), "end": float(times[i])}

    if current:
        notes.append(_finalize_note(current))

    # Filter short blips (<80ms)
    return [n for n in notes if n.end - n.start >= 0.08]


def _finalize_note(current: dict) -> Note:
    avg_freq = float(np.mean(current["freqs"]))
    avg_conf = float(np.mean(current["probs"]))
    midi = int(round(freq_to_midi(avg_freq)))
    return Note(
        midi=midi,
        frequency=round(avg_freq, 2),
        name=midi_to_note_name(midi),
        start=round(current["start"], 3),
        end=round(current["end"], 3),
        confidence=round(avg_conf, 3),
    )


def _extract_chords(y, sr, key: str, mode: str) -> List[ChordSegment]:
    """Simple chroma-based chord detection at 1-second segments."""
    hop = sr  # 1-second windows
    chroma = librosa.feature.chroma_cqt(y=y, sr=sr, hop_length=512)
    frame_times = librosa.frames_to_time(np.arange(chroma.shape[1]), sr=sr, hop_length=512)

    segments = []
    seg_size = max(1, int(hop / 512))

    for start_frame in range(0, chroma.shape[1] - seg_size, seg_size):
        end_frame = start_frame + seg_size
        seg_chroma = chroma[:, start_frame:end_frame].mean(axis=1)
        chord = _chroma_to_chord(seg_chroma)
        t_start = float(frame_times[start_frame])
        t_end = float(frame_times[min(end_frame, len(frame_times) - 1)])

        # Merge consecutive identical chords
        if segments and segments[-1].root == chord["root"] and segments[-1].quality == chord["quality"]:
            last = segments[-1]
            segments[-1] = ChordSegment(
                start=last.start, end=t_end,
                root=last.root, quality=last.quality, notes=last.notes
            )
        else:
            segments.append(ChordSegment(
                start=t_start, end=t_end,
                root=chord["root"], quality=chord["quality"], notes=chord["notes"]
            ))

    return segments


_CHORD_TEMPLATES = {
    "major":      [1, 0, 0, 0, 1, 0, 0, 1, 0, 0, 0, 0],
    "minor":      [1, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0],
    "dominant7":  [1, 0, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0],
    "major7":     [1, 0, 0, 0, 1, 0, 0, 1, 0, 0, 0, 1],
    "minor7":     [1, 0, 0, 1, 0, 0, 0, 1, 0, 0, 1, 0],
    "diminished": [1, 0, 0, 1, 0, 0, 1, 0, 0, 0, 0, 0],
}

_CHORD_INTERVALS = {
    "major":      ["1", "3", "5"],
    "minor":      ["1", "b3", "5"],
    "dominant7":  ["1", "3", "5", "b7"],
    "major7":     ["1", "3", "5", "7"],
    "minor7":     ["1", "b3", "5", "b7"],
    "diminished": ["1", "b3", "b5"],
}


def _chroma_to_chord(chroma: np.ndarray) -> dict:
    best_score = -1
    best_root = 0
    best_quality = "major"

    for quality, template in _CHORD_TEMPLATES.items():
        tmpl = np.array(template, dtype=float)
        for root in range(12):
            rolled = np.roll(tmpl, root)
            score = float(np.dot(chroma, rolled))
            if score > best_score:
                best_score = score
                best_root = root
                best_quality = quality

    root_name = MIDI_NOTE_NAMES[best_root]
    # Build note names from intervals
    interval_semitones = {"1": 0, "b3": 3, "3": 4, "b5": 6, "5": 7, "b7": 10, "7": 11}
    chord_notes = [
        MIDI_NOTE_NAMES[(best_root + interval_semitones[iv]) % 12]
        for iv in _CHORD_INTERVALS[best_quality]
    ]

    return {"root": root_name, "quality": best_quality, "notes": chord_notes}


# def _basic_pitch_predict(file_path: str):
#     return predict(file_path)

async def transcribe_basic_pitch(file_path: str):
    # loop = asyncio.get_event_loop()
    # _, _, note_events = await loop.run_in_executor(None, _basic_pitch_predict, file_path)

    # notes = []
    # for start, end, midi, velocity, pitch_bend in note_events:
    #     midi_int = int(round(float(midi)))
    #     octave = (midi_int // 12) - 1
    #     names = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]
    #     notes.append({
    #         "name": f"{names[midi_int % 12]}{octave}",
    #         "midi": midi_int,
    #         "start": round(float(start), 3),
    #         "end": round(float(end), 3),
    #         "velocity": int(velocity),
    #     })
        
    # print("notes:", notes)

    y, sr = librosa.load(file_path, sr=None, mono=True)

    chroma = librosa.feature.chroma_stft(y=y, sr=sr)
    dominant_pitch_indices = np.argmax(chroma, axis=0)

    note_names = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]
    print("note_names:", note_names)

    rms = librosa.feature.rms(y=y)[0]
    threshold = float(np.mean(rms) * 0.5)

    melody_notes = []
    for frame, pitch_idx in enumerate(dominant_pitch_indices):
        if frame < len(rms) and rms[frame] > threshold:
            melody_notes.append(note_names[int(pitch_idx)])
        else:
            melody_notes.append("Rest")

    if not melody_notes:
        return []

    compressed_melody = [melody_notes[0]]
    for note in melody_notes[1:]:
        if note != compressed_melody[-1]:
            compressed_melody.append(note)

    print("compressed_melody:", compressed_melody)
    return compressed_melody