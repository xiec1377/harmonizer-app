import type { PitchFrame } from '../lib/types'

interface PitchMeterProps {
  frame: PitchFrame | null
  isListening: boolean
}

export function PitchMeter({ frame, isListening }: PitchMeterProps) {
  const cents = frame?.cents_off ?? 0
  const inTune = frame?.in_tune ?? false
  const noteName = frame?.note_name ?? '–'
  const targetMidi = frame?.target_midi

  // Needle position: 0 cents = center (50%), clamped ±50 cents → 0–100%
  const needlePct = Math.min(100, Math.max(0, 50 + (cents / 50) * 50))

  // Color: gold=in tune, ember=out of tune, silver=no pitch
  const color = !frame ? '#8892A4' : inTune ? '#FBBF24' : '#F472B6'
  const glowColor = !frame ? 'transparent' : inTune ? 'rgba(251,191,36,0.35)' : 'rgba(244,114,182,0.25)'

  return (
    <div className="flex flex-col items-center gap-4 w-full max-w-sm mx-auto select-none">
      {/* Note name */}
      <div
        className="text-6xl font-display transition-all duration-150"
        style={{ color, textShadow: `0 0 24px ${glowColor}` }}
      >
        {noteName}
      </div>

      {/* Cents readout */}
      <div className="font-mono text-sm" style={{ color }}>
        {frame
          ? inTune
            ? '✓ in tune'
            : `${cents > 0 ? '+' : ''}${cents.toFixed(0)} ¢ ${cents > 0 ? 'sharp' : 'flat'}`
          : isListening ? 'sing a note…' : 'mic off'}
      </div>

      {/* Meter bar */}
      <div className="relative w-full h-3 rounded-full bg-slate overflow-hidden">
        {/* Center marker */}
        <div className="absolute left-1/2 top-0 bottom-0 w-px bg-silver/40 z-10" />
        {/* ±25 cent zones */}
        <div className="absolute left-[37.5%] right-[37.5%] top-0 bottom-0 bg-gold/10 rounded-full" />
        {/* Needle */}
        <div
          className="absolute top-0 bottom-0 w-2 rounded-full transition-all duration-100"
          style={{
            left: `calc(${needlePct}% - 4px)`,
            backgroundColor: color,
            boxShadow: `0 0 8px ${glowColor}`,
          }}
        />
      </div>

      {/* Labels */}
      <div className="flex w-full justify-between text-xs font-mono text-slate px-1">
        <span>flat ♭</span>
        <span className="text-silver/60">center</span>
        <span>♯ sharp</span>
      </div>

      {/* Target note */}
      {targetMidi !== null && targetMidi !== undefined && (
        <div className="text-xs text-silver font-mono">
          Target harmony: <span className="text-resonance">{midiToName(targetMidi)}</span>
        </div>
      )}
    </div>
  )
}

function midiToName(midi: number): string {
  const names = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
  const oct = Math.floor(midi / 12) - 1
  return `${names[midi % 12]}${oct}`
}
