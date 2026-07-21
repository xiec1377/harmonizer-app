import { useEffect, useRef, useCallback } from 'react'
import { useStore } from '../lib/store'
import type { Note, PitchFrame } from '../lib/types'

const WS_URL = `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/api/ws/pitch`
const CHUNK_SIZE = 4096   // samples per frame (≈93ms at 44.1kHz)
const SAMPLE_RATE = 44100

export function usePitchDetection(targetNotes: Note[]) {
  const wsRef = useRef<WebSocket | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const processorRef = useRef<ScriptProcessorNode | null>(null)
  const ctxRef = useRef<AudioContext | null>(null)
  const { isListening, practiceTime, setPitchFrame, setListening, setError } = useStore()

  const stop = useCallback(() => {
    processorRef.current?.disconnect()
    processorRef.current = null
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    ctxRef.current?.close()
    ctxRef.current = null
    wsRef.current?.close()
    wsRef.current = null
    setListening(false)
    setPitchFrame(null)
  }, [setListening, setPitchFrame])

  const start = useCallback(async () => {
    if (isListening) { stop(); return }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { sampleRate: SAMPLE_RATE, channelCount: 1 }, video: false })
      streamRef.current = stream

      const ctx = new AudioContext({ sampleRate: SAMPLE_RATE })
      ctxRef.current = ctx

      const source = ctx.createMediaStreamSource(stream)
      // ScriptProcessorNode is deprecated but widely supported; worklet alternative is complex
      const processor = ctx.createScriptProcessor(CHUNK_SIZE, 1, 1)
      processorRef.current = processor

      const ws = new WebSocket(WS_URL)
      wsRef.current = ws

      ws.onopen = () => {
        source.connect(processor)
        processor.connect(ctx.destination)
        setListening(true)
        setError(null)
      }

      ws.onmessage = (ev) => {
        try {
          const frame: PitchFrame = JSON.parse(ev.data)
          if (!frame.silence) setPitchFrame(frame)
          else setPitchFrame(null)
        } catch { /* ignore malformed */ }
      }

      ws.onerror = () => setError('Microphone connection lost. Reconnect to retry.')
      ws.onclose = () => setListening(false)

      processor.onaudioprocess = (ev) => {
        if (ws.readyState !== WebSocket.OPEN) return
        const float32 = ev.inputBuffer.getChannelData(0)
        // Convert to 16-bit PCM
        const int16 = new Int16Array(float32.length)
        for (let i = 0; i < float32.length; i++) {
          int16[i] = Math.max(-32768, Math.min(32767, Math.round(float32[i] * 32767)))
        }
        // Base64 encode
        const bytes = new Uint8Array(int16.buffer)
        let binary = ''
        for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i])
        const b64 = btoa(binary)

        ws.send(JSON.stringify({
          pcm_b64: b64,
          sample_rate: SAMPLE_RATE,
          current_time: practiceTime,
          target_notes: targetNotes.map((n) => ({ midi: n.midi, start: n.start, end: n.end })),
        }))
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Microphone access denied'
      setError(msg)
      throw e
    }
  }, [isListening, stop, targetNotes, practiceTime, setListening, setPitchFrame, setError])

  // Update target notes reference on the fly without reconnecting
  useEffect(() => {
    // Target notes are sent in each frame message — no re-connect needed
  }, [targetNotes])

  // Cleanup on unmount
  useEffect(() => { return () => { stop() } }, [stop])

  return { start, stop, isListening }
}
