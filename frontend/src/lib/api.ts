import axios from 'axios'
import type { AudioAnalysis, HarmonyAnalysis, Note, ChordSegment } from './types'

const api = axios.create({ baseURL: '/api' })

export async function uploadAudio(file: File): Promise<AudioAnalysis> {
  const form = new FormData()
  form.append('file', file)
  const { data } = await api.post<AudioAnalysis>('/audio/upload', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return data
}

export async function generateHarmony(
  notes: Note[],
  chords: ChordSegment[],
  key: string,
  mode: string,
  tempo_bpm: number,
): Promise<HarmonyAnalysis> {
  const { data } = await api.post<HarmonyAnalysis>('/harmony/generate', {
    notes,
    chords,
    key,
    mode,
    tempo_bpm,
  })
  return data
}
