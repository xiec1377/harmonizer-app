import { useRef, useEffect } from 'react'
import type { Note } from '../lib/types'

interface NoteTimelineProps {
  melodyNotes: Note[]
  harmonyNotes: Note[]
  currentTime: number
  voiceName: string
}

const MIDI_MIN = 48
const MIDI_MAX = 84
const MIDI_RANGE = MIDI_MAX - MIDI_MIN

export function NoteTimeline({ melodyNotes, harmonyNotes, currentTime, voiceName }: NoteTimelineProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const WINDOW = 8 // seconds visible

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const W = canvas.width
    const H = canvas.height
    ctx.clearRect(0, 0, W, H)

    const tStart = currentTime - 1
    const tEnd = tStart + WINDOW

    const timeToX = (t: number) => ((t - tStart) / WINDOW) * W
    const midiToY = (midi: number) => H - ((midi - MIDI_MIN) / MIDI_RANGE) * H

    // Background grid lines
    ctx.strokeStyle = 'rgba(58,62,74,0.5)'
    ctx.lineWidth = 0.5
    for (let m = MIDI_MIN; m <= MIDI_MAX; m += 3) {
      const y = midiToY(m)
      ctx.beginPath()
      ctx.moveTo(0, y)
      ctx.lineTo(W, y)
      ctx.stroke()
    }

    // Playhead
    const playX = timeToX(currentTime)
    ctx.strokeStyle = 'rgba(200,208,220,0.5)'
    ctx.lineWidth = 1
    ctx.setLineDash([4, 4])
    ctx.beginPath()
    ctx.moveTo(playX, 0)
    ctx.lineTo(playX, H)
    ctx.stroke()
    ctx.setLineDash([])

    // Draw notes helper
    const drawNotes = (notes: Note[], color: string, glowColor: string) => {
      notes.forEach((n) => {
        if (n.end < tStart || n.start > tEnd) return
        const x1 = timeToX(n.start)
        const x2 = timeToX(n.end)
        const y = midiToY(n.midi)
        const w = Math.max(x2 - x1, 4)
        const noteH = Math.max(H / MIDI_RANGE, 4)

        ctx.shadowColor = glowColor
        ctx.shadowBlur = 8
        ctx.fillStyle = color
        ctx.beginPath()
        ctx.roundRect(x1, y - noteH / 2, w, noteH, 3)
        ctx.fill()
        ctx.shadowBlur = 0
      })
    }

    // Melody notes (sky blue)
    drawNotes(melodyNotes, 'rgba(56,189,248,0.6)', 'rgba(56,189,248,0.4)')
    // Harmony notes (violet)
    drawNotes(harmonyNotes, 'rgba(167,139,250,0.75)', 'rgba(167,139,250,0.5)')
  }, [melodyNotes, harmonyNotes, currentTime])

  return (
    <div className="w-full space-y-2">
      <div className="flex items-center justify-between text-xs font-mono text-silver px-1">
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-sm bg-melody inline-block" /> Melody
        </span>
        <span className="text-pearl">{voiceName} harmony</span>
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-sm bg-resonance inline-block" /> Harmony
        </span>
      </div>
      <canvas
        ref={canvasRef}
        width={700}
        height={140}
        className="w-full rounded-xl bg-fog border border-slate/50"
        style={{ imageRendering: 'pixelated' }}
      />
      <div className="flex justify-between text-xs font-mono text-slate px-1">
        <span>B♭2</span>
        <span>C4</span>
        <span>C6</span>
      </div>
    </div>
  )
}
