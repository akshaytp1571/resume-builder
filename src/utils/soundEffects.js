// Ultra-lightweight Web Audio API Sound Synthesizer for Cyberpunk / Futuristic UI Feedback

class SoundSynthesizer {
  constructor() {
    this.ctx = null;
    this.enabled = true;
    try {
      const saved = localStorage.getItem('nexus_ui_sound_enabled');
      if (saved !== null) {
        this.enabled = JSON.parse(saved);
      }
    } catch (e) {}
  }

  init() {
    if (!this.ctx && typeof window !== 'undefined') {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  toggleSound() {
    this.enabled = !this.enabled;
    try {
      localStorage.setItem('nexus_ui_sound_enabled', JSON.stringify(this.enabled));
    } catch (e) {}
    if (this.enabled) {
      this.playBlip(900, 1200, 0.05);
    }
    return this.enabled;
  }

  playBlip(freqStart = 800, freqEnd = 1200, duration = 0.04, volume = 0.035) {
    if (!this.enabled) return;
    try {
      this.init();
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freqStart, this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(freqEnd, this.ctx.currentTime + duration);

      gain.gain.setValueAtTime(volume, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + duration);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start();
      osc.stop(this.ctx.currentTime + duration);
    } catch (e) {}
  }

  playTab() {
    if (!this.enabled) return;
    this.playBlip(550, 850, 0.035, 0.03);
  }

  playAction() {
    if (!this.enabled) return;
    this.playBlip(700, 1400, 0.06, 0.04);
  }

  playSuccess() {
    if (!this.enabled) return;
    try {
      this.init();
      if (!this.ctx) return;
      const now = this.ctx.currentTime;
      [523.25, 659.25, 783.99, 1046.5].forEach((freq, idx) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, now + idx * 0.06);

        gain.gain.setValueAtTime(0.04, now + idx * 0.06);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.06 + 0.25);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start(now + idx * 0.06);
        osc.stop(now + idx * 0.06 + 0.25);
      });
    } catch (e) {}
  }
}

export const sound = new SoundSynthesizer();
