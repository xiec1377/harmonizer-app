# Harmonia 🎵

AI-powered harmony learning app. Upload any song — the backend extracts the melody using pitch detection, detects chords and key, then uses Claude AI to compose harmony voices. In the practice mode, your microphone is analyzed in real time and a pitch meter shows how closely you're matching the harmony.

---

## Architecture

```
frontend/           React + TypeScript + Tailwind (Vite)
├── Upload stage    Drag-and-drop audio upload
├── Harmony stage   AI-generated voices, chord view, tips
└── Practice stage  Live pitch meter + note piano roll

backend/            FastAPI + Python
├── /api/audio/upload     Librosa pitch/chord/key analysis
├── /api/harmony/generate Claude AI harmony generation
└── /api/ws/pitch         WebSocket real-time YIN pitch detection
```

## Tech stack

| Layer | Tech |
|-------|------|
| Frontend | React 18, TypeScript, Tailwind CSS, Vite, Zustand |
| Backend | FastAPI, uvicorn, Python 3.12 |
| Audio analysis | librosa (pyin pitch tracker, chroma chords, key detection) |
| AI | Anthropic Claude (claude-sonnet-4-6) |
| Real-time | WebSocket + YIN pitch detection algorithm |
| Deploy | Docker Compose + nginx |

---

## Quick start (local dev)

### Prerequisites
- Node 20+
- Python 3.12+
- ffmpeg (`brew install ffmpeg` / `apt install ffmpeg`)
- Anthropic API key

### Backend
```bash
cd backend
python -m venv .venv 
.venv/bin/activate #.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt #python -m pip install basic-pitch
cp ../.env.example .env    # fill in ANTHROPIC_API_KEY
uvicorn app.main:app --reload --port 8000
```

### Frontend
```bash
cd frontend
npm install
npm run dev     # http://localhost:5173
```

The Vite dev server proxies `/api` → `localhost:8000`.

---

## Production deploy (Docker)

```bash
cp .env.example .env
# Edit .env: set ANTHROPIC_API_KEY

docker compose up --build -d
# App available at http://localhost:80
```

---

## How it works

### Audio analysis (librosa)
1. **Pitch tracking**: `librosa.pyin` — probabilistic YIN algorithm, extracts a fundamental frequency contour over time
2. **Note segmentation**: Consecutive voiced frames within ±1 semitone are merged into discrete Note objects (filtered for >80ms duration)
3. **Chord detection**: Chroma CQT → template matching against major/minor/dom7/maj7/min7/dim templates across all 12 roots
4. **Key detection**: Krumhansl-Schmuckler key-finding algorithm on the mean chroma vector; major vs minor via profile correlation

### AI harmony generation (Claude)
The melody notes and chord progression are serialized and sent to Claude with a detailed arranger prompt. Claude returns:
- 2–3 voice harmony lines (Alto, Tenor, High Harmony) with note-for-note assignments
- Voice-leading rules enforced in the prompt (prefer 3rds/6ths, respect chord tones, stay in vocal range)
- 4–6 practical singing tips personalized to the piece
- A song context paragraph

### Real-time pitch analysis (WebSocket + YIN)
The browser captures mic audio via `getUserMedia` → `ScriptProcessorNode` at 44.1kHz. Each ~93ms frame of 16-bit PCM is base64-encoded and sent over a WebSocket. The backend runs the YIN algorithm (a fast autocorrelation-based pitch detector) and compares the detected pitch to the expected harmony note at the current playback position. The cents deviation and in-tune status are streamed back to drive the pitch meter.

---

## API Reference

### `POST /api/audio/upload`
Upload an audio file (multipart/form-data, field `file`).  
Returns: `{ file_id, key, mode, tempo_bpm, note_count, chord_count, notes[], chords[] }`

### `POST /api/harmony/generate`
Body: `{ notes[], chords[], key, mode, tempo_bpm }`  
Returns: `HarmonyAnalysis { melody_notes, chords, key, mode, tempo_bpm, voices[], tips[], song_context }`

### `WS /api/ws/pitch`
Send: `{ pcm_b64, sample_rate, current_time, target_notes[] }`  
Receive: `{ frequency, midi, note_name, cents_off, target_midi, in_tune }` or `{ silence: true }`

---

## Configuration

| Env var | Default | Description |
|---------|---------|-------------|
| `ANTHROPIC_API_KEY` | required | Your Anthropic API key |
| `ENV` | `development` | Set to `production` to disable API docs |
| `MAX_UPLOAD_MB` | `50` | Max audio file size |
| `UPLOAD_DIR` | `/tmp/harmonia_uploads` | Temp audio storage |
| `CORS_ORIGINS` | localhost origins | Allowed CORS origins (JSON array) |

---

## Limitations & future work

- **Audio duration cap**: Analysis is capped at 120 seconds for performance
- **Pitch accuracy**: pyin works best on monophonic vocals/instruments; polyphonic audio may produce noisy note extraction
- **YIN on the backend**: For lower latency, pitch detection could move to a Web Audio Worklet using WASM
- **Playback sync**: The practice timer is manual (starts when mic is enabled); syncing to actual audio playback would improve accuracy
- **Persistent sessions**: File IDs are currently ephemeral; adding a database layer would enable saving analyses
