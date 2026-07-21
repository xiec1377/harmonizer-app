import numpy as np
import struct
from app.models.schemas import PitchFrame
from app.services.audio_service import freq_to_midi, midi_to_note_name, midi_to_freq

# YIN pitch detection constants
YIN_THRESHOLD = 0.15
MIN_FREQ = 80.0   # Hz (low bass)
MAX_FREQ = 1200.0  # Hz (high soprano)


def detect_pitch_yin(pcm_bytes: bytes, sample_rate: int = 44100) -> float | None:
    """
    YIN pitch detection algorithm on raw 16-bit PCM mono bytes.
    Returns fundamental frequency in Hz, or None if no pitch detected.
    """
    if len(pcm_bytes) < 512:
        return None

    # Convert bytes to float32 samples
    n_samples = len(pcm_bytes) // 2
    samples = np.frombuffer(pcm_bytes, dtype=np.int16).astype(np.float32) / 32768.0

    if len(samples) < 512:
        return None

    # RMS gate — ignore silence
    rms = float(np.sqrt(np.mean(samples ** 2)))
    if rms < 0.01:
        return None

    W = min(len(samples) // 2, 1024)
    tau_min = int(sample_rate / MAX_FREQ)
    tau_max = int(sample_rate / MIN_FREQ)
    tau_max = min(tau_max, W - 1)

    if tau_min >= tau_max:
        return None

    # Difference function
    d = np.zeros(tau_max)
    for tau in range(1, tau_max):
        diff = samples[:W] - samples[tau:W + tau]
        d[tau] = np.sum(diff ** 2)

    # Cumulative mean normalized difference
    cmnd = np.zeros(tau_max)
    cmnd[0] = 1.0
    running_sum = 0.0
    for tau in range(1, tau_max):
        running_sum += d[tau]
        if running_sum == 0:
            cmnd[tau] = 1.0
        else:
            cmnd[tau] = d[tau] * tau / running_sum

    # Find first dip below threshold
    tau_est = None
    for tau in range(tau_min, tau_max - 1):
        if cmnd[tau] < YIN_THRESHOLD:
            # Parabolic interpolation for sub-sample accuracy
            if tau > 0 and tau < tau_max - 1:
                s0, s1, s2 = cmnd[tau - 1], cmnd[tau], cmnd[tau + 1]
                denom = 2 * (2 * s1 - s2 - s0)
                if denom != 0:
                    tau_est = tau + (s0 - s2) / denom
                else:
                    tau_est = float(tau)
            else:
                tau_est = float(tau)
            break

    if tau_est is None or tau_est <= 0:
        return None

    return sample_rate / tau_est


def analyze_pitch_frame(
    pcm_bytes: bytes,
    target_notes: list[dict] | None,
    current_time: float,
    sample_rate: int = 44100,
) -> PitchFrame | None:
    """
    Detect pitch in a PCM chunk and compare to the expected harmony note at current_time.
    """
    freq = detect_pitch_yin(pcm_bytes, sample_rate)
    if freq is None:
        return None

    midi_raw = freq_to_midi(freq)
    midi_int = int(round(midi_raw))
    note_name = midi_to_note_name(midi_int)

    # Find the target harmony note active at current_time
    target_midi = None
    if target_notes:
        for note in target_notes:
            if note["start"] <= current_time <= note["end"]:
                target_midi = note["midi"]
                break

    cents_off = 0.0
    in_tune = False

    if target_midi is not None:
        cents_off = (midi_raw - target_midi) * 100
        in_tune = abs(cents_off) <= 25  # ±25 cents = "in tune"

    return PitchFrame(
        frequency=round(freq, 2),
        midi=round(midi_raw, 2),
        note_name=note_name,
        cents_off=round(cents_off, 1),
        target_midi=target_midi,
        in_tune=in_tune,
    )
