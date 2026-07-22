import { useCallback, useState, useRef, useEffect } from "react";
import { Upload, Music, AlertCircle } from "lucide-react";
import { uploadAudio, generateHarmony } from "../lib/api";
import { useStore } from "../lib/store";
import { OpenSheetMusicDisplay } from "opensheetmusicdisplay";

export function UploadStage() {
  const [dragging, setDragging] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const {
    setStage,
    setAudioAnalysis,
    setAudioFile,
    setHarmonyAnalysis,
    setError,
    error,
  } = useStore();
  const osmdRef = useRef<HTMLDivElement | null>(null);
  const [musicxml, setMusicxml] = useState<string | null>(null);

  useEffect(() => {
    if (!musicxml || !osmdRef.current) return;

    let cancelled = false;

    const renderScore = async () => {
      const osmd = new OpenSheetMusicDisplay(osmdRef.current!);
      await osmd.load(musicxml);
      if (!cancelled) {
        osmd.render();
      }
    };

    renderScore();

    return () => {
      cancelled = true;
      if (osmdRef.current) {
        osmdRef.current.innerHTML = "";
      }
    };
  }, [musicxml]);

  const process = useCallback(
    async (file: File) => {
      try {
        setError(null);
        setProgress("Analyzing audio...");
        // setStage("analyzing");
        console.log("PROCESSING FILE....");

        // try {
        //   setAudioFile(file)
        //   const analysis = await uploadAudio(file)
        //   setAudioAnalysis(analysis)

        //   setProgress('Generating harmonies with AI...')
        //   const harmony = await generateHarmony(
        //     analysis.notes,
        //     analysis.chords,
        //     analysis.key,
        //     analysis.mode,
        //     analysis.tempo_bpm,
        //   )
        //   setHarmonyAnalysis(harmony)
        //   setStage('harmony')
        // } catch (e: unknown) {
        //   const msg = e instanceof Error ? e.message : 'Something went wrong'
        //   setError(msg)
        //   setStage('upload')
        // } finally {
        //   setProgress(null)
        // }

        const formData = new FormData();
        formData.append("file", file);

        const response = await fetch("/api/audio/transcribe", {
          method: "POST",
          body: formData,
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Transcription failed: ${errorText}`);
        }

        const result = await response.json();
        setMusicxml(result.musicxml);
        // setStage("harmony");
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Something went wrong";
        setError(msg);
        setStage("upload");
      } finally {
        setProgress(null);
      }
    },
    [setStage, setAudioAnalysis, setAudioFile, setHarmonyAnalysis, setError],
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) process(file);
    },
    [process],
  );

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) process(file);
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-8 animate-fade-up">
      {/* Hero heading */}
      <div className="text-center space-y-3">
        <h1 className="font-display text-5xl md:text-7xl text-pearl tracking-tight">
          Find your <span className="text-resonance italic">harmony</span>
        </h1>
        <p className="font-body text-silver text-lg max-w-md mx-auto">
          Upload any song. Our AI extracts the melody and builds harmony voices
          tailored to the piece — then listens as you sing along.
        </p>
      </div>

      {/* Drop zone */}
      <div
        className={`
          relative w-full max-w-lg rounded-2xl border-2 border-dashed transition-all duration-200 cursor-pointer
          ${
            dragging
              ? "border-resonance bg-resonance/10 shadow-[0_0_40px_rgba(167,139,250,0.2)]"
              : "border-slate hover:border-resonance/60 hover:bg-mist/40"
          }
        `}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
      >
        <input
          ref={inputRef}
          type="file"
          className="hidden"
          accept=".mp3,.wav,.ogg,.flac,.m4a,.aac"
          onChange={onFileChange}
        />
        <div className="flex flex-col items-center gap-4 py-14 px-8">
          <div
            className={`p-4 rounded-full transition-colors ${
              dragging ? "bg-resonance/20" : "bg-mist"
            }`}
          >
            <Upload
              className={`w-8 h-8 ${
                dragging ? "text-resonance" : "text-silver"
              }`}
            />
          </div>
          <div className="text-center">
            <p className="text-pearl font-medium">Drop an audio file here</p>
            <p className="text-silver text-sm mt-1">
              MP3, WAV, FLAC, OGG, M4A — up to 50 MB
            </p>
          </div>
        </div>
      </div>

      {/* Formats hint */}
      <div className="flex gap-3 flex-wrap justify-center">
        {["MP3", "WAV", "FLAC", "OGG", "M4A"].map((fmt) => (
          <span
            key={fmt}
            className="px-3 py-1 rounded-full bg-mist text-silver text-xs font-mono border border-slate/50"
          >
            {fmt}
          </span>
        ))}
      </div>

      {/* <div ref={osmdRef} id="osmd-container" /> */}
      {musicxml && (
        <div
          id="osmd-container"
          ref={osmdRef}
          style={{ width: "100%", minHeight: "400px" }}
        />
      )}

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 text-ember bg-ember/10 border border-ember/30 rounded-lg px-4 py-3 max-w-lg w-full">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span className="text-sm">{error}</span>
        </div>
      )}
    </div>
  );
}

export function AnalyzingStage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6 animate-fade-up">
      <div className="relative">
        {/* Animated waveform rings */}
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="absolute inset-0 rounded-full border border-resonance/30 animate-ping"
            style={{ animationDelay: `${i * 0.4}s`, animationDuration: "1.8s" }}
          />
        ))}
        <div className="relative z-10 p-6 rounded-full bg-mist border border-slate">
          <Music className="w-10 h-10 text-resonance" />
        </div>
      </div>
      <div className="text-center space-y-2">
        <p className="text-pearl font-display text-2xl">
          Listening to your music...
        </p>
        <p className="text-silver text-sm">
          Extracting melody, chords, key — then asking the AI to compose harmony
          voices
        </p>
      </div>
      {/* Fake progress bar */}
      <div className="w-64 h-1 bg-slate rounded-full overflow-hidden">
        <div className="h-full bg-resonance rounded-full animate-[pulse_2s_ease-in-out_infinite] w-3/4" />
      </div>
    </div>
  );
}
