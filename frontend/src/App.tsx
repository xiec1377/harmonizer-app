import { useStore } from "./lib/store";
import { UploadStage, AnalyzingStage } from "./components/UploadStage";
import { HarmonyStage } from "./components/HarmonyStage";
import { PracticeStage } from "./components/PracticeStage";
import { RotateCcw } from "lucide-react";
import { useState } from "react";

function StageIndicator() {
  const { stage } = useStore();
  const stages = [
    { id: "upload", label: "Upload" },
    { id: "harmony", label: "Harmonies" },
    { id: "practice", label: "Practice" },
  ] as const;

  const activeIdx = stages.findIndex(
    (s) => s.id === stage || (stage === "analyzing" && s.id === "upload"),
  );

  return (
    <div className="flex items-center gap-2">
      {stages.map((s, i) => (
        <div key={s.id} className="flex items-center gap-2">
          <div className="flex items-center gap-1.5">
            <div
              className={`w-1.5 h-1.5 rounded-full transition-colors ${
                i <= activeIdx ? "bg-resonance" : "bg-slate"
              }`}
            />
            <span
              className={`text-xs font-mono transition-colors ${
                i === activeIdx
                  ? "text-pearl"
                  : i < activeIdx
                  ? "text-silver"
                  : "text-slate"
              }`}
            >
              {s.label}
            </span>
          </div>
          {i < stages.length - 1 && <div className="w-6 h-px bg-slate" />}
        </div>
      ))}
    </div>
  );
}

// export async function generateHarmony(
//   notes: Note[],
//   chords: ChordSegment[],
//   key: string,
//   mode: string,
//   tempo_bpm: number,
// ): Promise<HarmonyAnalysis> {
//   const { data } = await api.post<HarmonyAnalysis>('/harmony/generate', {
//     notes,
//     chords,
//     key,
//     mode,
//     tempo_bpm,
//   })
//   return data
// }

export default function App() {
  const { stage, reset } = useStore();
  const [notes, setNotes] = useState("");
  const [harmony, setHarmony] = useState("");

  const generateHarmony = async (notes: string, harmony: string) => {
    console.log("GENERATING HARMONY...", notes, harmony);
    const response = await fetch("api/harmony/generate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        notes: notes.split(",").map((n) => n.trim()),
        // chords: [], // You can modify this to include actual chord segments if needed
        // key: 'C', // Replace with actual key if available
        // mode: 'major', // Replace with actual mode if available
        // tempo_bpm: 120, // Replace with actual tempo if available
        harmony: harmony, // Include the selected harmony option
      }),
    });

    const result = await response.json();
    console.log("HARMONY GENERATED:", result);
  };

  return (
    <div className="min-h-screen bg-ink text-pearl font-body">
      {/* Nav */}
      <header className="border-b border-slate/30 backdrop-blur-sm sticky top-0 z-50 bg-ink/80">
        <div className="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-resonance text-lg">♩</span>
            <span className="font-display text-pearl font-bold tracking-tight">
              Harmonia
            </span>
          </div>
          <StageIndicator />
          {stage !== "upload" && (
            <button
              onClick={reset}
              className="flex items-center gap-1.5 text-silver hover:text-pearl text-xs transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              New song
            </button>
          )}
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-4xl mx-auto px-4 py-10">
        {stage === "upload" && <UploadStage />}
        {stage === "analyzing" && <AnalyzingStage />}
        {stage === "harmony" && <HarmonyStage />}
        {stage === "practice" && <PracticeStage />}
        <div className="flex items-center gap-2">
            <input
              type="text"
              placeholder="List of notes, separated by comma"
              className="px-2 py-1 rounded bg-slate/10 text-pearl text-xs font-mono w-64"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
            <div className="flex flex-wrap gap-2">
              {[
                "lower octave",
                "higher octave",
                "lower third",
                "higher third",
                "lower fifth",
                "higher fifth",
                "lower seventh",
                "higher seventh",
              ].map((note) => (
                <button
                  key={note}
                  className="ml-2 px-3 py-1 rounded bg-resonance text-pearl text-xs font-mono hover:bg-resonance/80 transition-colors"
                  onClick={() => setHarmony(note)}
                >
                  {note}
                </button>
              ))}
            </div>
              <button
                className="ml-2 px-3 py-1 rounded bg-resonance text-pearl text-xs font-mono hover:bg-resonance/80 transition-colors"
                onClick={() => generateHarmony(notes, harmony)}
              >
                Submit
              </button>
          </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate/20 mt-20 py-6">
        <p className="text-center text-slate text-xs font-mono">
          Harmonia — AI-powered harmony learning · Built with FastAPI + React +
          OpenAI
        </p>
      </footer>
    </div>
  );
}
