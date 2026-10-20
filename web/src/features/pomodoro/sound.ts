// F-38: short signals synthesized with Web Audio, no audio files.

let audio: AudioContext | null = null;

/** Must be called from a user action (Start click) so the browser allows sound later. */
export function unlockAudio() {
  try {
    audio ??= new AudioContext();
    if (audio.state === 'suspended') void audio.resume();
  } catch {
    audio = null;
  }
}

export function chime(kind: 'work' | 'rest') {
  if (!audio) return;
  const notes = kind === 'work' ? [880, 698.46, 523.25] : [523.25, 659.25, 783.99];
  const t0 = audio.currentTime + 0.02;
  notes.forEach((freq, i) => {
    if (!audio) return;
    const osc = audio.createOscillator();
    const gain = audio.createGain();
    const s = t0 + i * 0.25;
    osc.type = 'sine';
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.0001, s);
    gain.gain.exponentialRampToValueAtTime(0.3, s + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, s + 0.22);
    osc.connect(gain).connect(audio.destination);
    osc.start(s);
    osc.stop(s + 0.24);
  });
}
