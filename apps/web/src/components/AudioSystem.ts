class AudioSystem {
  private ctx: AudioContext | null = null;
  private humOsc: OscillatorNode | null = null;
  private humGain: GainNode | null = null;
  private muted: boolean = true;

  private initContext() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    // Resume context if suspended (common in Chrome/Safari)
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  public setMute(mute: boolean) {
    this.muted = mute;
    this.initContext();
    if (mute) {
      this.stopHum();
    } else {
      this.startHum();
    }
  }

  public isMuted(): boolean {
    return this.muted;
  }

  public playBeep() {
    if (this.muted) return;
    this.initContext();
    if (!this.ctx) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, this.ctx.currentTime); // A5

    gain.gain.setValueAtTime(0.08, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.15);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start();
    osc.stop(this.ctx.currentTime + 0.15);
  }

  public playChime() {
    if (this.muted) return;
    this.initContext();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6 chord

    notes.forEach((freq, index) => {
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now + index * 0.05);

      gain.gain.setValueAtTime(0.05, now + index * 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, now + index * 0.05 + 0.6);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now + index * 0.05);
      osc.stop(now + index * 0.05 + 0.65);
    });
  }

  public playBuzz() {
    if (this.muted) return;
    this.initContext();
    if (!this.ctx) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(110, this.ctx.currentTime); // Low A2

    gain.gain.setValueAtTime(0.08, this.ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.001, this.ctx.currentTime + 0.35);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start();
    osc.stop(this.ctx.currentTime + 0.4);
  }

  public playLock() {
    if (this.muted) return;
    this.initContext();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const noise = this.createNoiseNode();
    const gainOsc = this.ctx.createGain();
    const gainNoise = this.ctx.createGain();

    // Deep pneumatic clank
    osc.type = 'sine';
    osc.frequency.setValueAtTime(120, now);
    osc.frequency.linearRampToValueAtTime(40, now + 0.3);

    gainOsc.gain.setValueAtTime(0.2, now);
    gainOsc.gain.exponentialRampToValueAtTime(0.001, now + 0.3);

    osc.connect(gainOsc);
    gainOsc.connect(this.ctx.destination);

    // Hissing exhaust
    if (noise) {
      gainNoise.gain.setValueAtTime(0.1, now);
      gainNoise.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
      noise.connect(gainNoise);
      gainNoise.connect(this.ctx.destination);
      noise.start(now);
      noise.stop(now + 0.5);
    }

    osc.start(now);
    osc.stop(now + 0.35);
  }

  public playOpen() {
    if (this.muted) return;
    this.initContext();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const noise = this.createNoiseNode();
    const gainNoise = this.ctx.createGain();

    // Ascending atmospheric decompression release
    if (noise) {
      gainNoise.gain.setValueAtTime(0.001, now);
      gainNoise.gain.linearRampToValueAtTime(0.12, now + 0.15);
      gainNoise.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
      noise.connect(gainNoise);
      gainNoise.connect(this.ctx.destination);
      noise.start(now);
      noise.stop(now + 0.65);
    }
  }

  private createNoiseNode(): AudioBufferSourceNode | null {
    if (!this.ctx) return null;
    const bufferSize = this.ctx.sampleRate * 2; // 2 seconds
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    const noiseNode = this.ctx.createBufferSource();
    noiseNode.buffer = buffer;
    return noiseNode;
  }

  private startHum() {
    if (this.muted) return;
    this.initContext();
    if (!this.ctx) return;

    if (this.humOsc) return; // Already running

    this.humOsc = this.ctx.createOscillator();
    this.humGain = this.ctx.createGain();

    // Ambient space hum (sub-drone at 55Hz + modulated sine)
    this.humOsc.type = 'sine';
    this.humOsc.frequency.setValueAtTime(55, this.ctx.currentTime); // Low A1

    this.humGain.gain.setValueAtTime(0.03, this.ctx.currentTime);

    this.humOsc.connect(this.humGain);
    this.humGain.connect(this.ctx.destination);

    this.humOsc.start();
  }

  private stopHum() {
    if (this.humOsc) {
      try {
        this.humOsc.stop();
      } catch (e) {}
      this.humOsc.disconnect();
      this.humGain?.disconnect();
      this.humOsc = null;
      this.humGain = null;
    }
  }
}

export const audioSystem = new AudioSystem();
