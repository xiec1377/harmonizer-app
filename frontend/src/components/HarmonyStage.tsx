import { useState } from 'react'
import { ChevronRight, Lightbulb, Music2, Mic } from 'lucide-react'
import { useStore } from '../lib/store'

const VOICE_COLORS: Record<string, string> = {
  Alto: 'text-resonance border-resonance/40 bg-resonance/10',
  Tenor: 'text-melody border-melody/40 bg-melody/10',
  'High Harmony': 'text-gold border-gold/40 bg-gold/10',
  Soprano: 'text-ember border-ember/40 bg-ember/10',
}

const QUALITY_LABELS: Record<string, string> = {
  major: 'Maj',
  minor: 'min',
  dominant7: 'dom7',
  major7: 'maj7',
  minor7: 'min7',
  diminished: 'dim',
}

export function HarmonyStage() {
  const { harmonyAnalysis, audioAnalysis, setStage, setSelectedVoice, selectedVoiceIdx } = useStore()
  const [activeTab, setActiveTab] = useState<'voices' | 'chords' | 'tips'>('voices')

  if (!harmonyAnalysis || !audioAnalysis) return null

  const { voices, chords, key, mode, tempo_bpm, tips, song_context } = harmonyAnalysis

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-fade-up">
      {/* Header row */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h2 className="font-display text-3xl text-pearl">
            {key} <span className="text-silver capitalize">{mode}</span>
          </h2>
          <p className="text-silver text-sm mt-1 font-mono">
            {tempo_bpm.toFixed(0)} BPM · {audioAnalysis.note_count} notes · {audioAnalysis.chord_count} chord segments
          </p>
        </div>
        <button
          onClick={() => { setStage('practice') }}
          className="flex items-center gap-2 bg-resonance text-ink font-semibold px-5 py-2.5 rounded-xl hover:bg-resonance/90 transition-colors shadow-[0_0_20px_rgba(167,139,250,0.3)]"
        >
          <Mic className="w-4 h-4" />
          Practice singing
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Song context */}
      <p className="text-silver text-sm leading-relaxed bg-mist rounded-xl px-5 py-4 border border-slate/50 italic">
        {song_context}
      </p>

      {/* Tabs */}
      <div className="flex gap-1 bg-mist rounded-xl p-1 w-fit">
        {(['voices', 'chords', 'tips'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium capitalize transition-all ${
              activeTab === tab
                ? 'bg-ink text-pearl shadow'
                : 'text-silver hover:text-pearl'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'voices' && (
        <div className="space-y-4">
          {voices.map((voice, i) => {
            const colorCls = VOICE_COLORS[voice.name] || 'text-pearl border-slate/50 bg-mist'
            const isSelected = selectedVoiceIdx === i
            return (
              <div
                key={voice.name}
                onClick={() => setSelectedVoice(i)}
                className={`rounded-2xl border p-5 cursor-pointer transition-all ${colorCls} ${
                  isSelected ? 'shadow-lg ring-1 ring-current/50' : 'opacity-80 hover:opacity-100'
                }`}
              >
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div>
                    <div className="flex items-center gap-2">
                      <Music2 className="w-4 h-4" />
                      <span className="font-semibold text-lg">{voice.name}</span>
                      {isSelected && (
                        <span className="text-xs font-mono bg-current/20 rounded-full px-2 py-0.5">selected for practice</span>
                      )}
                    </div>
                    <p className="text-sm opacity-70 mt-1 font-mono">{voice.interval}</p>
                  </div>
                  <span className="text-xs opacity-60">{voice.notes.length} notes</span>
                </div>
                <p className="text-sm opacity-80 mt-3 leading-relaxed">{voice.description}</p>

                {/* First 12 notes preview */}
                <div className="flex flex-wrap gap-1.5 mt-4">
                  {voice.notes.slice(0, 20).map((n, ni) => (
                    <span
                      key={ni}
                      className="text-xs font-mono bg-current/15 rounded px-1.5 py-0.5"
                    >
                      {n.name}
                    </span>
                  ))}
                  {voice.notes.length > 20 && (
                    <span className="text-xs opacity-50 self-center">+{voice.notes.length - 20} more</span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {activeTab === 'chords' && (
        <div className="space-y-2">
          <p className="text-silver text-sm mb-3">Chord progression detected in the audio:</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
            {chords.slice(0, 40).map((c, i) => (
              <div key={i} className="bg-mist border border-slate/50 rounded-xl p-3 space-y-1">
                <div className="flex items-baseline gap-1">
                  <span className="text-pearl font-display text-xl">{c.root}</span>
                  <span className="text-silver text-xs font-mono">{QUALITY_LABELS[c.quality] || c.quality}</span>
                </div>
                <div className="flex gap-1 flex-wrap">
                  {c.notes.map((n) => (
                    <span key={n} className="text-xs text-silver font-mono">{n}</span>
                  ))}
                </div>
                <p className="text-slate text-xs">{c.start.toFixed(1)}s–{c.end.toFixed(1)}s</p>
              </div>
            ))}
          </div>
          {chords.length > 40 && (
            <p className="text-silver text-xs text-center pt-2">… and {chords.length - 40} more segments</p>
          )}
        </div>
      )}

      {activeTab === 'tips' && (
        <div className="space-y-3">
          {tips.map((tip, i) => (
            <div key={i} className="flex gap-3 bg-mist rounded-xl p-4 border border-slate/50">
              <Lightbulb className="w-4 h-4 text-gold flex-shrink-0 mt-0.5" />
              <p className="text-pearl text-sm leading-relaxed">{tip}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
