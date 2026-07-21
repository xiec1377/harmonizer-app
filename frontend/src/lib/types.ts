export interface Note {
  midi: number
  frequency: number
  name: string
  start: number
  end: number
  confidence: number
}

export interface ChordSegment {
  start: number
  end: number
  root: string
  quality: string
  notes: string[]
}

export interface HarmonyVoice {
  name: string
  interval: string
  notes: Note[]
  description: string
}

export interface HarmonyAnalysis {
  melody_notes: Note[]
  chords: ChordSegment[]
  key: string
  mode: string
  tempo_bpm: number
  voices: HarmonyVoice[]
  tips: string[]
  song_context: string
}

export interface AudioAnalysis {
  file_id: string
  key: string
  mode: string
  tempo_bpm: number
  note_count: number
  chord_count: number
  notes: Note[]
  chords: ChordSegment[]
}

export interface PitchFrame {
  frequency: number
  midi: number
  note_name: string
  cents_off: number
  target_midi: number | null
  in_tune: boolean
  silence?: boolean
}

export type AppStage = 'upload' | 'analyzing' | 'harmony' | 'practice'
