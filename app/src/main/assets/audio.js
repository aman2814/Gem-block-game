(function (global) {
  'use strict';

  const STORAGE_KEY_MUTE = 'gemblock_muted';

  class SoundEngine {
    constructor() {
      this.ctx = null;
      this.noiseBuffer = null;
      try {
        this.muted = localStorage.getItem(STORAGE_KEY_MUTE) === '1';
      } catch (_) {
        this.muted = false;
      }
    }

    ensureContext() {
      if (this.muted) return null;
      if (!this.ctx) {
        const AudioCtx = global.AudioContext || global.webkitAudioContext;
        if (!AudioCtx) return null;
        this.ctx = new AudioCtx();
      }
      if (this.ctx.state === 'suspended') {
        this.ctx.resume().catch(() => {});
      }
      if (!this.noiseBuffer && this.ctx) {
        const len = Math.floor(this.ctx.sampleRate * 0.45);
        const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
        const data = buf.getChannelData(0);
        for (let i = 0; i < len; i++) {
          data[i] = Math.random() * 2 - 1;
        }
        this.noiseBuffer = buf;
      }
      return this.ctx;
    }

    unlock() {
      this.ensureContext();
      try {
        if (global.speechSynthesis && typeof global.speechSynthesis.getVoices === 'function') {
          global.speechSynthesis.getVoices();
        }
      } catch (_) {}
    }

    setMuted(muted) {
      this.muted = Boolean(muted);
      try {
        localStorage.setItem(STORAGE_KEY_MUTE, this.muted ? '1' : '0');
      } catch (_) {}
      if (this.muted) {
        try {
          if (global.speechSynthesis && typeof global.speechSynthesis.cancel === 'function') {
            global.speechSynthesis.cancel();
          }
        } catch (_) {}
        try {
          if (global.AndroidBridge && typeof global.AndroidBridge.stopSpeech === 'function') {
            global.AndroidBridge.stopSpeech();
          }
        } catch (_) {}
      } else {
        this.ensureContext();
      }
    }

    toggleMute() {
      this.setMuted(!this.muted);
      return this.muted;
    }

    isMuted() {
      return this.muted;
    }

    // Soft high-pitched wooden/crystal pop
    playPickup() {
      const ctx = this.ensureContext();
      if (!ctx) return;
      const now = ctx.currentTime;

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(520, now);
      osc.frequency.exponentialRampToValueAtTime(860, now + 0.055);

      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.14, now + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.07);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.075);

      // Tiny crystal overtone
      const chime = ctx.createOscillator();
      const chimeGain = ctx.createGain();
      chime.type = 'triangle';
      chime.frequency.setValueAtTime(1480, now);
      chime.frequency.exponentialRampToValueAtTime(1820, now + 0.045);
      chimeGain.gain.setValueAtTime(0.05, now);
      chimeGain.gain.exponentialRampToValueAtTime(0.001, now + 0.055);
      chime.connect(chimeGain);
      chimeGain.connect(ctx.destination);
      chime.start(now);
      chime.stop(now + 0.06);
    }

    // Tactile low thud + crystalline click
    playPlace() {
      const ctx = this.ensureContext();
      if (!ctx) return;
      const now = ctx.currentTime;

      // Low tactile stone thud
      const thud = ctx.createOscillator();
      const thudGain = ctx.createGain();
      thud.type = 'sine';
      thud.frequency.setValueAtTime(175, now);
      thud.frequency.exponentialRampToValueAtTime(58, now + 0.09);

      thudGain.gain.setValueAtTime(0.24, now);
      thudGain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);

      thud.connect(thudGain);
      thudGain.connect(ctx.destination);
      thud.start(now);
      thud.stop(now + 0.11);

      // Crystalline gem click
      const click = ctx.createOscillator();
      const clickGain = ctx.createGain();
      click.type = 'triangle';
      click.frequency.setValueAtTime(1240, now);
      click.frequency.exponentialRampToValueAtTime(760, now + 0.045);

      clickGain.gain.setValueAtTime(0.11, now);
      clickGain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);

      click.connect(clickGain);
      clickGain.connect(ctx.destination);
      click.start(now);
      click.stop(now + 0.055);
    }

    // Subtle muted low buzz when returning to tray
    playInvalid() {
      const ctx = this.ensureContext();
      if (!ctx) return;
      const now = ctx.currentTime;

      const osc = ctx.createOscillator();
      const filter = ctx.createBiquadFilter();
      const gain = ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(122, now);
      osc.frequency.linearRampToValueAtTime(86, now + 0.13);

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(340, now);

      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.11, now + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.15);
    }

    // Rising harmonic chime + sparkly shatter sweep (scales pitch with lineCount & combo)
    playLineClear(lineCount, comboLevel) {
      const ctx = this.ensureContext();
      if (!ctx) return;
      const now = ctx.currentTime;
      const boost = Math.min(6, (lineCount - 1) + Math.max(0, comboLevel - 1));
      const semitone = Math.pow(2, boost / 12);

      // Sparkle noise shatter sweep
      if (this.noiseBuffer) {
        const src = ctx.createBufferSource();
        src.buffer = this.noiseBuffer;
        const bp = ctx.createBiquadFilter();
        bp.type = 'bandpass';
        bp.Q.value = 2.2;
        bp.frequency.setValueAtTime(1600 * semitone, now);
        bp.frequency.exponentialRampToValueAtTime(5200, now + 0.28);

        const nGain = ctx.createGain();
        nGain.gain.setValueAtTime(0.001, now);
        nGain.gain.linearRampToValueAtTime(0.14, now + 0.03);
        nGain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);

        src.connect(bp);
        bp.connect(nGain);
        nGain.connect(ctx.destination);
        src.start(now);
        src.stop(now + 0.32);
      }

      // Rising harmonic chimes
      const baseFreqs = [523.25, 659.25, 783.99, 1046.5];
      baseFreqs.forEach((f, idx) => {
        const t = now + idx * 0.042;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = idx % 2 === 0 ? 'sine' : 'triangle';
        osc.frequency.setValueAtTime(f * semitone, t);

        gain.gain.setValueAtTime(0.001, t);
        gain.gain.linearRampToValueAtTime(0.13, t + 0.012);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.26);

        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(t);
        osc.stop(t + 0.28);
      });
    }

    // Ascending celebratory synth fanfare + spoken voice callout for 3+ line clears
    playComboCallout(tier) {
      const ctx = this.ensureContext();
      if (!ctx) return;
      const now = ctx.currentTime + 0.04;

      const chords = [
        [523.25, 659.25, 783.99, 1046.5],         // Good (C major)
        [587.33, 739.99, 880.0, 1174.66],         // Wow (D major)
        [659.25, 830.61, 987.77, 1318.51],        // Amazing (E major)
        [783.99, 987.77, 1174.66, 1567.98, 1975.5], // Excellent (G major)
      ];
      const notes = chords[Math.min(chords.length - 1, Math.max(0, tier - 1))];

      notes.forEach((freq, i) => {
        const t = now + i * 0.032;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = i === notes.length - 1 ? 'sine' : 'triangle';
        osc.frequency.setValueAtTime(freq, t);

        gain.gain.setValueAtTime(0.001, t);
        gain.gain.linearRampToValueAtTime(0.095, t + 0.018);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.36);

        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(t);
        osc.stop(t + 0.38);
      });
    }

    speakCallout(word, tier) {
      if (this.muted || !word) return;
      this.playComboCallout(tier || 1);

      const cleanWord = String(word).replace(/!+$/, '');
      const tuningMap = {
        Good: { pitch: 1.15, rate: 1.06 },
        Wow: { pitch: 1.24, rate: 1.02 },
        Amazing: { pitch: 1.32, rate: 1.05 },
        Excellent: { pitch: 1.38, rate: 1.0 },
      };
      const tuning = tuningMap[cleanWord] || { pitch: 1.2, rate: 1.04 };

      let usedWebSpeech = false;
      try {
        const synth = global.speechSynthesis;
        const Utterance = global.SpeechSynthesisUtterance;
        if (synth && typeof Utterance === 'function' && typeof synth.speak === 'function') {
          const voices = typeof synth.getVoices === 'function' ? synth.getVoices() : [];
          // If running inside Android WebView where SpeechSynthesis has 0 voices, prefer Android TTS bridge if present
          const hasBridge = global.AndroidBridge && typeof global.AndroidBridge.speakCallout === 'function';
          if (voices.length > 0 || !hasBridge) {
            synth.cancel();
            const utter = new Utterance(word);
            utter.lang = 'en-US';
            utter.pitch = tuning.pitch;
            utter.rate = tuning.rate;
            utter.volume = 1.0;

            if (voices.length > 0) {
              const preferred =
                voices.find((v) => /^en[-_]/i.test(v.lang) && /female|google|natural|samantha|aria/i.test(v.name)) ||
                voices.find((v) => /^en[-_]/i.test(v.lang));
              if (preferred) utter.voice = preferred;
            }

            synth.speak(utter);
            usedWebSpeech = true;
          }
        }
      } catch (_) {}

      if (!usedWebSpeech) {
        try {
          if (global.AndroidBridge && typeof global.AndroidBridge.speakCallout === 'function') {
            global.AndroidBridge.speakCallout(cleanWord, tuning.pitch, tuning.rate);
          }
        } catch (_) {}
      }
    }

    // Subtle shimmer when color-matched tiles transform
    playColorShift() {
      const ctx = this.ensureContext();
      if (!ctx) return;
      const now = ctx.currentTime + 0.12;
      [1174.66, 1567.98].forEach((freq, idx) => {
        const t = now + idx * 0.055;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, t);
        gain.gain.setValueAtTime(0.001, t);
        gain.gain.linearRampToValueAtTime(0.075, t + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(t);
        osc.stop(t + 0.24);
      });
    }

    // Crisp mechanical/glass tap for UI buttons
    playUiClick() {
      const ctx = this.ensureContext();
      if (!ctx) return;
      const now = ctx.currentTime;

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(980, now);
      osc.frequency.exponentialRampToValueAtTime(520, now + 0.04);

      gain.gain.setValueAtTime(0.14, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.045);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.05);
    }

    // Descending gentle marimba/synth cadence for Grey-Out & Game Over
    playGameOver() {
      const ctx = this.ensureContext();
      if (!ctx) return;
      const now = ctx.currentTime;
      const notes = [440, 392, 349.23, 261.63];

      notes.forEach((freq, i) => {
        const t = now + i * 0.13;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, t);
        osc.frequency.exponentialRampToValueAtTime(freq * 0.97, t + 0.24);

        gain.gain.setValueAtTime(0.001, t);
        gain.gain.linearRampToValueAtTime(0.15, t + 0.014);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.28);

        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(t);
        osc.stop(t + 0.3);
      });
    }

    // Uplifting chime on revive
    playRevive() {
      const ctx = this.ensureContext();
      if (!ctx) return;
      const now = ctx.currentTime;
      const notes = [440, 554.37, 659.25, 880];
      notes.forEach((freq, i) => {
        const t = now + i * 0.055;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, t);
        gain.gain.setValueAtTime(0.001, t);
        gain.gain.linearRampToValueAtTime(0.13, t + 0.015);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(t);
        osc.stop(t + 0.32);
      });
    }
  }

  global.GemAudio = new SoundEngine();
})(window);
