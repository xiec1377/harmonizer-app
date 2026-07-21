import { useCallback, useEffect, useRef } from 'react'
import { Mic, MicOff, ArrowLeft, ChevronLeft, ChevronRight } from 'lucide-react'
import { useStore } from '../lib/store'
import { usePitchDetection } from '../hooks/usePitchDetection'
import { PitchMeter } from './PitchMeter'
import { NoteTimeline } from './NoteTimeline'

export function PracticeStage() {
  const {
    harmonyAnalysis,
    selectedVoiceIdx,
    setSelectedVoice,
    pitchFrame,
    practiceTime,
    setPracticeTime,
    isListening,
    setStage,
    error,
    audioFile,
    setError,
  } = useStore()

  const timerRef = useRef<number | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const objectUrlRef = useRef<string | null>(null)
  const voice = harmonyAnalysis?.voices[selectedVoiceIdx]
  const targetNotes = voice?.notes ?? []

  const { start, stop } = usePitchDetection(targetNotes)

  useEffect(() => {
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current)
      objectUrlRef.current = null
    }

    if (!audioFile) {
      if (audioRef.current) {
        audioRef.current.removeAttribute('src')
        audioRef.current.load()
      }
      return
    }

    const objectUrl = URL.createObjectURL(audioFile)
    objectUrlRef.current = objectUrl
    if (audioRef.current) {
      audioRef.current.src = objectUrl
      audioRef.current.load()
      audioRef.current.currentTime = 0
    }

    return () => {
      if (objectUrlRef.current === objectUrl) {
        URL.revokeObjectURL(objectUrl)
        objectUrlRef.current = null
      }
    }
  }, [audioFile])

  useEffect(() => {
    if (isListening) {
      timerRef.current = window.setInterval(() => {
        if (audioRef.current) {
          setPracticeTime(audioRef.current.currentTime)
        }
      }, 100)
    } else {
      if (timerRef.current) clearInterval(timerRef.current)
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [isListening, setPracticeTime])

  const syncPlayback = useCallback(async () => {
    if (!audioFile || !audioRef.current) {
      setError('Upload a song before starting practice.')
      return
    }

    const audio = audioRef.current
    audio.currentTime = 0
    setPracticeTime(0)
    setError(null)

    const playPromise = audio.play()
    try {
      await start()
      await playPromise
    } catch (e: unknown) {
      audio.pause()
      audio.currentTime = 0
      stop()
      if (e instanceof Error) {
        setError(e.message)
      }
    }
  }, [audioFile, setError, setPracticeTime, start, stop])

  const stopPlayback = useCallback(() => {
    stop()
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.currentTime = 0
    }
    setPracticeTime(0)
  }, [setPracticeTime, stop])

  if (!harmonyAnalysis || !voice) return null

  const voices = harmonyAnalysis.voices

  return (
    <div className="max-w-3xl mx-auto space-y-6 animate-fade-up">
      {/* Back button */}
      <button
        onClick={() => { stopPlayback(); setStage('harmony') }}
        className="flex items-center gap-1.5 text-silver hover:text-pearl text-sm transition-colors"
      >
        <ArrowLeft className="w-4 h-4" /> Back to harmony
      </button>

      {/* Voice selector */}
      <div className="bg-mist rounded-2xl border border-slate/50 p-4 space-y-3">
        <p className="text-silver text-xs font-mono uppercase tracking-widest">Practicing voice</p>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setSelectedVoice(Math.max(0, selectedVoiceIdx - 1))}
            disabled={selectedVoiceIdx === 0}
            className="p-1.5 rounded-lg bg-fog border border-slate/50 disabled:opacity-30 hover:enabled:border-resonance/50 transition-colors"
          >
            <ChevronLeft className="w-4 h-4 text-silver" />
          </button>

          <div className="flex-1 text-center">
            <p className="text-pearl font-display text-2xl">{voice.name}</p>
            <p className="text-silver text-xs font-mono">{voice.interval}</p>
          </div>

          <button
            onClick={() => setSelectedVoice(Math.min(voices.length - 1, selectedVoiceIdx + 1))}
            disabled={selectedVoiceIdx === voices.length - 1}
            className="p-1.5 rounded-lg bg-fog border border-slate/50 disabled:opacity-30 hover:enabled:border-resonance/50 transition-colors"
          >
            <ChevronRight className="w-4 h-4 text-silver" />
          </button>
        </div>
      </div>

      {/* Song playback */}
      <div className="bg-mist rounded-2xl border border-slate/50 p-4 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <p className="text-silver text-xs font-mono uppercase tracking-widest">Song playback</p>
          <span className="text-xs text-silver">{audioFile ? 'Ready to play' : 'No audio loaded'}</span>
        </div>
        <audio
          ref={audioRef}
          controls
          preload="auto"
          className="w-full"
          onTimeUpdate={(e) => setPracticeTime((e.currentTarget as HTMLAudioElement).currentTime)}
          onEnded={() => stopPlayback()}
        />
        <p className="text-xs text-slate">
          Press start singing to play the song and record your voice together.
        </p>
      </div>

      {/* Note timeline */}
      <div className="bg-mist rounded-2xl border border-slate/50 p-4 space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-silver text-xs font-mono uppercase tracking-widest">Piano roll</p>
          <span className="text-xs font-mono text-silver">{practiceTime.toFixed(1)}s</span>
        </div>
        <NoteTimeline
          melodyNotes={harmonyAnalysis.melody_notes}
          harmonyNotes={targetNotes}
          currentTime={practiceTime}
          voiceName={voice.name}
        />
      </div>

      {/* Pitch meter */}
      <div className={`bg-mist rounded-2xl border p-6 transition-all duration-300 ${
        pitchFrame?.in_tune
          ? 'border-gold/50 shadow-[0_0_40px_rgba(251,191,36,0.12)] animate-glow-pulse'
          : pitchFrame
          ? 'border-ember/30'
          : 'border-slate/50'
      }`}>
        <p className="text-silver text-xs font-mono uppercase tracking-widest mb-6 text-center">Your pitch</p>
        <PitchMeter frame={pitchFrame} isListening={isListening} />
      </div>

      {/* Mic toggle */}
      <div className="flex flex-col items-center gap-3">
        <button
          onClick={isListening ? stopPlayback : syncPlayback}
          className={`flex items-center gap-3 px-7 py-3.5 rounded-2xl font-semibold text-lg transition-all duration-200 ${
            isListening
              ? 'bg-ember/20 border border-ember/50 text-ember hover:bg-ember/30'
              : 'bg-resonance text-ink hover:bg-resonance/90 shadow-[0_0_24px_rgba(167,139,250,0.3)]'
          }`}
        >
          {isListening ? (
            <><MicOff className="w-5 h-5" /> Stop listening</>
          ) : (
            <><Mic className="w-5 h-5" /> Start singing</>
          )}
        </button>
        <p className="text-slate text-xs">
          {isListening ? 'Mic active — sing the harmony line' : 'Tap to enable microphone'}
        </p>
        {error && <p className="text-ember text-xs text-center max-w-xs">{error}</p>}
      </div>

      {/* Tips quick access */}
      {harmonyAnalysis.tips.length > 0 && (
        <div className="bg-mist rounded-2xl border border-slate/50 p-4">
          <p className="text-silver text-xs font-mono uppercase tracking-widest mb-3">Quick tip</p>
          <p className="text-pearl text-sm leading-relaxed">
            {harmonyAnalysis.tips[Math.floor(practiceTime / 30) % harmonyAnalysis.tips.length]}
          </p>
        </div>
      )}
    </div>
  )
}
