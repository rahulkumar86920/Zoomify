// Zoomify — Web Audio API Synthesizer for notifications and ringtones
// Works offline, zero external dependencies, zero loading lag.

let audioCtx = null;

function getAudioContext() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (audioCtx.state === "suspended") {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

/**
 * Plays a quick, pleasant "ping" sound for incoming messages.
 */
export function playMessageSound() {
  try {
    const ctx = getAudioContext();
    const now = ctx.currentTime;

    // First note
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = "sine";
    osc1.frequency.setValueAtTime(587.33, now); // D5
    osc1.frequency.exponentialRampToValueAtTime(880, now + 0.1); // A5

    gain1.gain.setValueAtTime(0.1, now);
    gain1.gain.exponentialRampToValueAtTime(0.005, now + 0.15);

    osc1.connect(gain1);
    gain1.connect(ctx.destination);

    osc1.start(now);
    osc1.stop(now + 0.15);

    // Second note slightly delayed
    setTimeout(() => {
      try {
        const now2 = ctx.currentTime;
        const osc2 = ctx.createOscillator();
        const gain2 = ctx.createGain();
        osc2.type = "sine";
        osc2.frequency.setValueAtTime(880, now2); // A5
        osc2.frequency.exponentialRampToValueAtTime(1174.66, now2 + 0.15); // D6

        gain2.gain.setValueAtTime(0.1, now2);
        gain2.gain.exponentialRampToValueAtTime(0.005, now2 + 0.2);

        osc2.connect(gain2);
        gain2.connect(ctx.destination);

        osc2.start(now2);
        osc2.stop(now2 + 0.2);
      } catch (err) {}
    }, 80);
  } catch (e) {
    console.warn("Failed to play message sound:", e);
  }
}

let ringtoneInterval = null;

/**
 * Plays a repeating classic/modern ringtone for incoming calls.
 */
export function startRingtone() {
  if (ringtoneInterval) return; // Already ringing

  const playRing = () => {
    try {
      const ctx = getAudioContext();
      const now = ctx.currentTime;

      // Telephone ring sound is made of two frequencies (e.g. 480Hz and 520Hz) modulated
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gainNode = ctx.createGain();

      osc1.type = "sine";
      osc1.frequency.value = 480;

      osc2.type = "sine";
      osc2.frequency.value = 520;

      gainNode.gain.setValueAtTime(0.08, now);
      // Ring pulse (on-off rapid volume changes)
      for (let t = 0; t < 1.0; t += 0.08) {
        gainNode.gain.setValueAtTime(0.08, now + t);
        gainNode.gain.setValueAtTime(0.0, now + t + 0.04);
      }
      gainNode.gain.setValueAtTime(0.0, now + 1.1);

      osc1.connect(gainNode);
      osc2.connect(gainNode);
      gainNode.connect(ctx.destination);

      osc1.start(now);
      osc2.start(now);

      osc1.stop(now + 1.2);
      osc2.stop(now + 1.2);
    } catch (e) {
      console.warn("Failed to play ringtone pulse:", e);
    }
  };

  playRing();
  ringtoneInterval = setInterval(playRing, 2000);
}

/**
 * Stops the ringtone.
 */
export function stopRingtone() {
  if (ringtoneInterval) {
    clearInterval(ringtoneInterval);
    ringtoneInterval = null;
  }
}
