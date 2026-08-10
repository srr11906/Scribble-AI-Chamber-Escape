export class AudioAnalyser {
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private intervalId: any = null;
  private isSpeaking = false;
  private silenceStart: number | null = null;

  constructor(
    private stream: MediaStream,
    private onSpeakingChange: (speaking: boolean) => void,
    private threshold: number = 0.015, // RMS volume threshold
    private debounceTime: number = 1000 // Hysteresis duration in ms
  ) {}

  public start() {
    if (this.intervalId) return;

    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      this.audioContext = new AudioContextClass();
      
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 256;

      this.source = this.audioContext.createMediaStreamSource(this.stream);
      this.source.connect(this.analyser);

      const bufferLength = this.analyser.frequencyBinCount;
      const dataArray = new Float32Array(bufferLength);

      this.intervalId = setInterval(() => {
        if (!this.analyser) return;
        
        this.analyser.getFloatTimeDomainData(dataArray);

        // Calculate Root Mean Square (RMS) volume
        let sumSquares = 0;
        for (let i = 0; i < bufferLength; i++) {
          sumSquares += dataArray[i] * dataArray[i];
        }
        const rms = Math.sqrt(sumSquares / bufferLength);

        const now = Date.now();
        if (rms > this.threshold) {
          this.silenceStart = null;
          if (!this.isSpeaking) {
            this.isSpeaking = true;
            this.onSpeakingChange(true);
          }
        } else {
          if (this.isSpeaking) {
            if (this.silenceStart === null) {
              this.silenceStart = now;
            } else if (now - this.silenceStart > this.debounceTime) {
              this.isSpeaking = false;
              this.silenceStart = null;
              this.onSpeakingChange(false);
            }
          }
        }
      }, 100);
    } catch (e) {
      console.error('Failed to initialize AudioAnalyser:', e);
    }
  }

  public stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    if (this.source) {
      this.source.disconnect();
      this.source = null;
    }

    if (this.analyser) {
      this.analyser.disconnect();
      this.analyser = null;
    }

    if (this.audioContext) {
      if (this.audioContext.state !== 'closed') {
        this.audioContext.close().catch(err => console.warn('Error closing AudioContext:', err));
      }
      this.audioContext = null;
    }

    if (this.isSpeaking) {
      this.isSpeaking = false;
      this.onSpeakingChange(false);
    }
  }
}
