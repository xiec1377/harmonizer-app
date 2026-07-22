import os
import uuid
import aiofiles
from django import core
from django.utils import duration
import structlog
from fastapi import APIRouter, UploadFile, File, HTTPException
from fastapi.responses import JSONResponse
from app.config import settings
from app.services.audio_service import transcribe_basic_pitch
from app.config import settings
from app.services.audio_service import analyze_audio
from basic_pitch.inference import predict
import librosa
import numpy as np
from fractions import Fraction

log = structlog.get_logger()
router = APIRouter()

ALLOWED_EXTENSIONS = {".mp3", ".wav", ".ogg", ".flac", ".m4a", ".aac"}
MAX_BYTES = settings.MAX_UPLOAD_MB * 1024 * 1024


@router.post("/upload")
async def upload_audio(file: UploadFile = File(...)):
    """Upload an audio faile and run acoustic anlysis. Returns notes, chords, key, tempo."""
    print("UPLOADING AUDIO FILE....")
    ext = os.path.splitext(file.filename or "")[1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            400,
            f"Unsupported file type: {ext}. Allowed: {', '.join(ALLOWED_EXTENSIONS)}",
        )

    os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
    file_id = str(uuid.uuid4())
    dest = os.path.join(settings.UPLOAD_DIR, f"{file_id}{ext}")

    # Stream-write with size guard
    total = 0
    async with aiofiles.open(dest, "wb") as out:
        while chunk := await file.read(65536):
            total += len(chunk)
            if total > MAX_BYTES:
                await out.close()
                os.remove(dest)
                raise HTTPException(
                    413, f"File exceeds {settings.MAX_UPLOAD_MB} MB limit"
                )
            await out.write(chunk)

    log.info("audio_uploaded", file_id=file_id, size_mb=round(total / 1e6, 2))

    try:
        notes, chords, key, mode, tempo = await analyze_audio(dest)
    except Exception as e:
        log.error("audio_analysis_error", error=str(e))
        raise HTTPException(500, f"Audio analysis failed: {str(e)}")

    print("ANALYSIS COMPLETE: ", notes, chords, key, mode, tempo)

    return {
        "file_id": file_id,
        "key": key,
        "mode": mode,
        "tempo_bpm": round(tempo, 1),
        "note_count": len(notes),
        "chord_count": len(chords),
        "notes": [n.model_dump() for n in notes],
        "chords": [c.model_dump() for c in chords],
    }


# ALLOWED_EXTENSIONS = {".mp3", ".wav", ".ogg", ".flac", ".m4a", ".aac"}
# MAX_BYTES = settings.MAX_UPLOAD_MB * 1024 * 1024
# @router.post("/transcribe")
# async def transcribe_audio(file: UploadFile = File(...)):
#     print("transcribing in api...")
#     ext = os.path.splitext(file.filename or "")[1].lower()
#     if ext not in ALLOWED_EXTENSIONS:
#         raise HTTPException(status_code=400, detail=f"Unsupported file type: {ext}")

#     os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
#     file_id = str(uuid.uuid4())
#     dest = os.path.join(settings.UPLOAD_DIR, f"{file_id}{ext}")

#     total = 0
#     async with aiofiles.open(dest, "wb") as out:
#         while chunk := await file.read(65536):
#             total += len(chunk)
#             if total > MAX_BYTES:
#                 await out.close()
#                 os.remove(dest)
#                 raise HTTPException(
#                     status_code=413,
#                     detail=f"File exceeds {settings.MAX_UPLOAD_MB} MB limit",
#                 )
#             await out.write(chunk)

#     try:
#         print("transcibe now...")
#         melody = await transcribe_basic_pitch(dest)
#     except Exception as e:
#         log.error("basic_pitch_transcription_failed", error=str(e))
#         raise HTTPException(status_code=500, detail=f"Transcription failed: {str(e)}")

#     score = stream.Score()
#     part = stream.Part()
#     part.append(meter.TimeSignature("4/4"))

#     for n in melody:
#         if n == "Rest":
#             part.append(note.Rest(quarterLength=1))
#         else:
#             part.append(note.Note(n, quarterLength=1))

#     score.append(part)
#     musicxml_path = "score.musicxml"
#     score.write("musicxml", fp=musicxml_path)

#     with open(musicxml_path, "r", encoding="utf-8") as f:
#         musicxml = f.read()

#     return {
#         "file_id": file_id,
#         "note_count": len(melody),
#         "notes": melody,
#         "musicxml": musicxml,
#     }


import asyncio
from music21 import stream, note, tempo, meter

NOTE_NAMES_SHARP = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]


def midi_to_note_name(midi: int) -> str:
    octave = (midi // 12) - 1
    name = NOTE_NAMES_SHARP[midi % 12]
    return f"{name}{octave}"


def _predict_basic_pitch(file_path: str):
    return predict(file_path)

from fastapi import UploadFile, File, HTTPException
import os
import uuid
import aiofiles
import asyncio
from music21 import stream, note, tempo, meter, duration

@router.post("/transcribe1")
async def transcribe_audio1(file: UploadFile = File(...)):
    print("TRANSCRIBING ENDPOINT...")

    ext = os.path.splitext(file.filename or "")[1].lower()
    os.makedirs(settings.UPLOAD_DIR, exist_ok=True)

    file_id = str(uuid.uuid4())
    dest = os.path.join(settings.UPLOAD_DIR, f"{file_id}{ext}")

    async with aiofiles.open(dest, "wb") as out:
        while chunk := await file.read(65536):
            await out.write(chunk)

    loop = asyncio.get_event_loop()
    try:
        _model_output, _midi_data, note_events = await loop.run_in_executor(
            None, _predict_basic_pitch, dest
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Transcription failed: {str(e)}")

    print("HERE ARE THE NOTE EVENTS:", note_events)

    score = stream.Score()
    part = stream.Part()
    part.append(tempo.MetronomeMark(number=120))
    part.append(meter.TimeSignature("4/4"))

    for start, end, pitch_midi, velocity, pitch_bend in note_events:
        midi = int(round(float(pitch_midi)))
        ql = max(0.25, (float(end) - float(start)) * 2)

        n = note.Note(midi)
        # n.duration = duration.Duration(ql)
        n = note.Note(midi, quarterLength=1)
        print(f"note={n.nameWithOctave}")
        part.append(n)

    score.append(part)
    musicxml_path = score.write("musicxml", fp=f"{file_id}.musicxml")

    with open(musicxml_path, "r", encoding="utf-8") as f:
        musicxml = f.read()

    return {
        "file_id": file_id,
        "note_count": len(note_events),
        "notes": [int(round(float(n[2]))) for n in note_events],
        "musicxml": musicxml,
    }
    
@router.post("/transcribe")
async def transcribe_audio(file: UploadFile = File(...)):
    print("TRANSCRIBING ENDPOINT...")
    ext = os.path.splitext(file.filename or "")[1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type: {ext}. Allowed: {', '.join(sorted(ALLOWED_EXTENSIONS))}",
        )

    os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
    file_id = str(uuid.uuid4())
    dest = os.path.join(settings.UPLOAD_DIR, f"{file_id}{ext}")
    total = 0

    try:
        async with aiofiles.open(dest, "wb") as out:
            while chunk := await file.read(65536):
                total += len(chunk)
                if total > MAX_BYTES:
                    raise HTTPException(
                        status_code=413,
                        detail=f"File exceeds {settings.MAX_UPLOAD_MB} MB limit",
                    )
                await out.write(chunk)

        def detect_pitches():
            audio, sample_rate = librosa.load(dest, sr=None, mono=True)
            hop_length = 512
            frequencies, voiced, probabilities = librosa.pyin(
                audio,
                fmin=librosa.note_to_hz("C2"),
                fmax=librosa.note_to_hz("C7"),
                sr=sample_rate,
                hop_length=hop_length,
            )
            times = librosa.times_like(
                frequencies, sr=sample_rate, hop_length=hop_length
            )
            pitch_frames = [
                {
                    "time": round(float(time), 3),
                    "frequency_hz": round(float(frequency), 2),
                    "note": str(librosa.hz_to_note(frequency)),
                    "midi": int(round(float(librosa.hz_to_midi(frequency)))),
                    "confidence": round(float(probability), 3),
                }
                for time, frequency, is_voiced, probability in zip(
                    times, frequencies, voiced, probabilities
                )
                if is_voiced and np.isfinite(frequency)
            ]

            # Collapse adjacent frames while retaining silence as rests. Keeping
            # rests makes score timestamps line up with the original audio.
            score_events = []
            unset = object()
            current_midi = unset
            start_frame = 0
            for frame_index, (frequency, is_voiced) in enumerate(
                zip(frequencies, voiced)
            ):
                midi = (
                    int(round(float(librosa.hz_to_midi(frequency))))
                    if is_voiced and np.isfinite(frequency)
                    else None
                )
                if midi != current_midi:
                    if current_midi is not unset:
                        score_events.append((current_midi, frame_index - start_frame))
                    current_midi = midi
                    start_frame = frame_index

            if current_midi is not unset:
                score_events.append((current_midi, len(frequencies) - start_frame))

            score = stream.Score()
            part = stream.Part()
            part.append(tempo.MetronomeMark(number=120))
            part.append(meter.TimeSignature("4/4"))
            seconds_per_frame = hop_length / sample_rate
            elapsed_frames = 0
            previous_sixteenth = 0
            score_note_count = 0
            for midi, frame_count in score_events:
                # At 120 BPM, one quarter note lasts 0.5 seconds.
                elapsed_frames += frame_count
                elapsed_quarter_length = elapsed_frames * seconds_per_frame * 2
                current_sixteenth = round(elapsed_quarter_length * 4)
                sixteenth_count = current_sixteenth - previous_sixteenth
                if sixteenth_count <= 0:
                    continue
                previous_sixteenth = current_sixteenth
                quarter_length = Fraction(sixteenth_count, 4)
                score_element = (
                    note.Rest(quarterLength=quarter_length)
                    if midi is None
                    else note.Note(midi, quarterLength=quarter_length)
                )
                part.append(score_element)
                if midi is not None:
                    score_note_count += 1
            score.append(part)
            score.makeNotation(inPlace=True)

            xml_dest = os.path.join(settings.UPLOAD_DIR, f"{file_id}.musicxml")
            try:
                musicxml_path = score.write("musicxml", fp=xml_dest)
                with open(musicxml_path, "r", encoding="utf-8") as xml_file:
                    musicxml = xml_file.read()
            finally:
                if os.path.exists(xml_dest):
                    os.remove(xml_dest)

            return pitch_frames, score_note_count, musicxml

        notes, score_note_count, musicxml = await asyncio.to_thread(detect_pitches)
    except HTTPException:
        raise
    except Exception as exc:
        log.exception("pitch_detection_failed", file_id=file_id, error=str(exc))
        raise HTTPException(
            status_code=422,
            detail=f"Could not decode or analyze the audio file: {exc}",
        ) from exc
    finally:
        if os.path.exists(dest):
            os.remove(dest)
        await file.close()

    return {
        "file_id": file_id,
        "filename": file.filename,
        "note_count": score_note_count,
        "notes": notes,
        "musicxml": musicxml,
    }
