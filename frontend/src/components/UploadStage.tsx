import { useCallback, useState, useRef, useEffect } from "react";
import { Upload, Music, AlertCircle, Play, Pause } from "lucide-react";
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
  const osmdInstanceRef = useRef<OpenSheetMusicDisplay | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const cursorAudioTimeRef = useRef(0);
  const [musicxml, setMusicxml] = useState<string | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  const syncScoreCursor = useCallback((audioTime: number) => {
    const osmd = osmdInstanceRef.current;
    if (!osmd) return;

    const cursor = osmd.cursor;
    if (audioTime < cursorAudioTimeRef.current) {
      cursor.reset();
      cursor.show();
    }

    // OSMD timestamps are fractions of a whole note. The generated score is
    // fixed at 120 BPM, where a whole note lasts two seconds.
    let steps = 0;
    while (
      !cursor.Iterator.EndReached &&
      cursor.Iterator.CurrentSourceTimestamp.RealValue * 2 < audioTime &&
      steps < 10000
    ) {
      cursor.next();
      steps += 1;
    }
    cursorAudioTimeRef.current = audioTime;

    // Keep the playback cursor about one-third of the way across the visible
    // staff, leaving upcoming notes visible to the right.
    const scoreContainer = osmdRef.current;
    const cursorElement = cursor.cursorElement;
    if (scoreContainer && cursorElement) {
      const containerRect = scoreContainer.getBoundingClientRect();
      const cursorRect = cursorElement.getBoundingClientRect();
      const desiredLeft = containerRect.left + containerRect.width / 3;
      scoreContainer.scrollLeft += cursorRect.left - desiredLeft;
    }
  }, []);

  useEffect(() => {
    if (!musicxml || !osmdRef.current) return;

    let cancelled = false;

    const renderScore = async () => {
      const osmd = new OpenSheetMusicDisplay(osmdRef.current!, {
        autoResize: false,
        followCursor: true,
        renderSingleHorizontalStaffline: true,
      });
      await osmd.load(musicxml);
      if (!cancelled) {
        osmd.render();
        osmd.cursor.reset();
        osmd.cursor.show();
        cursorAudioTimeRef.current = 0;
        osmdInstanceRef.current = osmd;
      }
    };

    renderScore();

    return () => {
      cancelled = true;
      osmdInstanceRef.current = null;
      if (osmdRef.current) {
        osmdRef.current.innerHTML = "";
      }
    };
  }, [musicxml]);

  useEffect(() => {
    if (!isPlaying) {
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      return;
    }

    const updatePlayback = () => {
      const time = audioRef.current?.currentTime ?? 0;
      setCurrentTime(time);
      syncScoreCursor(time);
      animationFrameRef.current = requestAnimationFrame(updatePlayback);
    };
    animationFrameRef.current = requestAnimationFrame(updatePlayback);

    return () => {
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isPlaying, syncScoreCursor]);

  useEffect(() => {
    return () => {
      if (audioUrl) URL.revokeObjectURL(audioUrl);
    };
  }, [audioUrl]);

  const process = useCallback(
    async (file: File) => {
      try {
        setError(null);
        setProgress("Analyzing audio...");
        audioRef.current?.pause();
        setMusicxml(null);
        setAudioFile(file);
        setAudioUrl(URL.createObjectURL(file));
        setCurrentTime(0);
        setDuration(0);
        setIsPlaying(false);
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

  const togglePlayback = async () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (audio.paused) {
      if (audio.ended) audio.currentTime = 0;
      await audio.play();
      setIsPlaying(true);
    } else {
      audio.pause();
      setIsPlaying(false);
    }
  };

  const seekPlayback = (time: number) => {
    if (!audioRef.current) return;
    audioRef.current.currentTime = time;
    setCurrentTime(time);
    syncScoreCursor(time);
  };

  const formatTime = (seconds: number) => {
    if (!Number.isFinite(seconds)) return "0:00";
    const minutes = Math.floor(seconds / 60);
    return `${minutes}:${Math.floor(seconds % 60).toString().padStart(2, "0")}`;
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

      {musicxml && (
        <div className="w-full rounded-2xl bg-white p-4 shadow-lg">
          <div
            id="osmd-container"
            ref={osmdRef}
            className="w-full min-h-[260px] overflow-x-auto overflow-y-hidden"
          />

          {audioUrl && (
            <div className="flex items-center gap-4 rounded-xl bg-mist p-4">
              <audio
                ref={audioRef}
                src={audioUrl}
                preload="metadata"
                onLoadedMetadata={(event) => setDuration(event.currentTarget.duration)}
                onEnded={() => {
                  setIsPlaying(false);
                  setCurrentTime(duration);
                  syncScoreCursor(duration);
                }}
              />
              <button
                type="button"
                onClick={togglePlayback}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-resonance text-white transition hover:scale-105"
                aria-label={isPlaying ? "Pause audio" : "Play audio"}
              >
                {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
              </button>
              <span className="w-12 text-right font-mono text-xs text-silver">
                {formatTime(currentTime)}
              </span>
              <input
                type="range"
                min={0}
                max={duration || 0}
                step={0.01}
                value={Math.min(currentTime, duration || 0)}
                onChange={(event) => seekPlayback(Number(event.target.value))}
                className="min-w-0 flex-1 accent-resonance"
                aria-label="Audio position"
              />
              <span className="w-12 font-mono text-xs text-silver">
                {formatTime(duration)}
              </span>
            </div>
          )}
        </div>
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
