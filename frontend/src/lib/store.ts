import { create } from 'zustand'
import type { AudioAnalysis, HarmonyAnalysis, PitchFrame, AppStage } from '../lib/types'

interface AppState {
  stage: AppStage
  audioAnalysis: AudioAnalysis | null
  audioFile: File | null
  harmonyAnalysis: HarmonyAnalysis | null
  selectedVoiceIdx: number
  pitchFrame: PitchFrame | null
  practiceTime: number
  isListening: boolean
  error: string | null

  setStage: (s: AppStage) => void
  setAudioAnalysis: (a: AudioAnalysis) => void
  setAudioFile: (f: File | null) => void
  setHarmonyAnalysis: (h: HarmonyAnalysis) => void
  setSelectedVoice: (i: number) => void
  setPitchFrame: (f: PitchFrame | null) => void
  setPracticeTime: (t: number) => void
  setListening: (v: boolean) => void
  setError: (e: string | null) => void
  reset: () => void
}

export const useStore = create<AppState>((set) => ({
  stage: 'upload',
  audioAnalysis: null,
  audioFile: null,
  harmonyAnalysis: null,
  selectedVoiceIdx: 0,
  pitchFrame: null,
  practiceTime: 0,
  isListening: false,
  error: null,

  setStage: (stage) => set({ stage }),
  setAudioAnalysis: (audioAnalysis) => set({ audioAnalysis }),
  setAudioFile: (audioFile) => set({ audioFile }),
  setHarmonyAnalysis: (harmonyAnalysis) => set({ harmonyAnalysis }),
  setSelectedVoice: (selectedVoiceIdx) => set({ selectedVoiceIdx }),
  setPitchFrame: (pitchFrame) => set({ pitchFrame }),
  setPracticeTime: (practiceTime) => set({ practiceTime }),
  setListening: (isListening) => set({ isListening }),
  setError: (error) => set({ error }),
  reset: () => set({
    stage: 'upload',
    audioAnalysis: null,
    audioFile: null,
    harmonyAnalysis: null,
    selectedVoiceIdx: 0,
    pitchFrame: null,
    practiceTime: 0,
    isListening: false,
    error: null,
  }),
}))
