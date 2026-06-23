export class Synthesizer {
  private ctx: AudioContext;
  private masterGain: GainNode;
  private isMuted: boolean = false;
  private themeInterval: number | null = null;
  private isPlayingTheme: boolean = false;
  private currentLevel: number = 1;
  private bgmAudio: HTMLAudioElement | null = null;
  private bgmSource: MediaElementAudioSourceNode | null = null;

  constructor() {
    this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = 0.2; // Master volume
    this.masterGain.connect(this.ctx.destination);
    

    this.bgmAudio = new Audio('./theme.mp3');
    this.bgmAudio.loop = true;
    (this.bgmAudio as any).preservesPitch = false;
    (this.bgmAudio as any).mozPreservesPitch = false;
    (this.bgmAudio as any).webkitPreservesPitch = false;
    try {
      this.bgmSource = this.ctx.createMediaElementSource(this.bgmAudio);
      this.bgmSource.connect(this.masterGain);
    } catch (e) {
      console.warn("Failed to connect MP3 source:", e);
    }
  }

  setLevel(level: number) {
    this.currentLevel = level;
    // Map level to speed/pitch
    // e.g. start at 1.0 at level 1, +0.05 per level
    const targetSpeed = Math.min(1.0 + (level - 1) * 0.05, 1.5);
    
    if (this.bgmAudio) {
      const startSpeed = this.bgmAudio.playbackRate || Math.min(1.0 + (level - 2) * 0.05, 1.5);
      const startTime = performance.now();
      const duration = 10000; // 10 seconds smooth morph
      
      const animate = (now: number) => {
        let p = (now - startTime) / duration;
        if (p > 1) p = 1;
        // Ease in-out
        const easedP = p < 0.5 ? 2 * p * p : -1 + (4 - 2 * p) * p;
        if (this.bgmAudio) {
          this.bgmAudio.playbackRate = startSpeed + (targetSpeed - startSpeed) * easedP;
        }
        if (p < 1) requestAnimationFrame(animate);
      };
      requestAnimationFrame(animate);
    }
  }

  resume() {
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  playPlaceSound() {
    if (this.isMuted) return;
    this.resume();
    const now = this.ctx.currentTime;

    // Heavy FM-like click and thump
    const thump = this.ctx.createOscillator();
    const thumpGain = this.ctx.createGain();
    thump.type = 'square';
    
    // lowpass filter sweep
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(1000, now);
    filter.frequency.exponentialRampToValueAtTime(50, now + 0.15);

    thump.connect(filter);
    filter.connect(thumpGain);
    thumpGain.connect(this.masterGain);

    thump.frequency.setValueAtTime(150, now);
    thump.frequency.exponentialRampToValueAtTime(10, now + 0.1);
    
    thumpGain.gain.setValueAtTime(0.6, now);
    thumpGain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);

    thump.start(now);
    thump.stop(now + 0.15);

    // High tech chime
    const chime = this.ctx.createOscillator();
    const chimeGain = this.ctx.createGain();
    chime.type = 'triangle';
    chime.connect(chimeGain).connect(this.masterGain);

    chime.frequency.setValueAtTime(1200, now);
    chime.frequency.exponentialRampToValueAtTime(100, now + 0.2);
    
    chimeGain.gain.setValueAtTime(0.2, now);
    chimeGain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);

    chime.start(now);
    chime.stop(now + 0.2);
  }

  playHardDropSound() {
    if (this.isMuted) return;
    this.resume();
    const now = this.ctx.currentTime;
    
    // Hard drop thump (deeper and more resonant than place sound)
    const thump = this.ctx.createOscillator();
    const thumpGain = this.ctx.createGain();
    thump.type = 'square';
    
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(400, now);
    filter.frequency.exponentialRampToValueAtTime(30, now + 0.3);

    thump.connect(filter);
    filter.connect(thumpGain);
    thumpGain.connect(this.masterGain);

    thump.frequency.setValueAtTime(100, now);
    thump.frequency.exponentialRampToValueAtTime(10, now + 0.2);
    
    thumpGain.gain.setValueAtTime(1.0, now);
    thumpGain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);

    thump.start(now);
    thump.stop(now + 0.3);

    // Add some noise burst
    const bufferSize = this.ctx.sampleRate * 0.2;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
    }
    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;
    
    const noiseFilter = this.ctx.createBiquadFilter();
    noiseFilter.type = 'bandpass';
    noiseFilter.frequency.setValueAtTime(500, now);
    noiseFilter.Q.value = 1;

    const noiseGain = this.ctx.createGain();
    noiseGain.gain.setValueAtTime(0.5, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);

    noise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(this.masterGain);

    noise.start(now);
    noise.stop(now + 0.2);
  }

  playShiftSound() {
    if (this.isMuted) return;
    this.resume();
    const now = this.ctx.currentTime;
    
    // Sci-fi swoop for grid shift
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    
    osc.type = 'sine'; // Smooth futuristic tone
    osc.connect(gain).connect(this.masterGain);

    osc.frequency.setValueAtTime(800, now);
    osc.frequency.exponentialRampToValueAtTime(200, now + 0.15);
    
    gain.gain.setValueAtTime(0.3, now);
    gain.gain.linearRampToValueAtTime(0, now + 0.15);

    osc.start(now);
    osc.stop(now + 0.15);
  }

  playSingularitySound() {
    if (this.isMuted) return;
    this.resume();
    const t = this.ctx.currentTime;
    
    // Huge sci-fi riser & collapse
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(100, t);
    filter.frequency.exponentialRampToValueAtTime(8000, t + 0.5); // rise up
    filter.frequency.exponentialRampToValueAtTime(100, t + 1.2); // collapse down
    
    osc.connect(filter).connect(gain).connect(this.masterGain);

    osc.frequency.setValueAtTime(50, t);
    osc.frequency.exponentialRampToValueAtTime(400, t + 0.5); // rise
    osc.frequency.exponentialRampToValueAtTime(20, t + 1.2); // drop
    
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.8, t + 0.5);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 1.2);

    osc.start(t);
    osc.stop(t + 1.2);
    
    // Sub rumble
    const sub = this.ctx.createOscillator();
    const subGain = this.ctx.createGain();
    sub.type = 'sine';
    sub.connect(subGain).connect(this.masterGain);
    
    sub.frequency.setValueAtTime(60, t);
    sub.frequency.exponentialRampToValueAtTime(120, t + 0.5); 
    sub.frequency.exponentialRampToValueAtTime(20, t + 1.5); 
    
    subGain.gain.setValueAtTime(0.5, t);
    subGain.gain.linearRampToValueAtTime(1.0, t + 0.5);
    subGain.gain.exponentialRampToValueAtTime(0.01, t + 1.5);
    
    sub.start(t);
    sub.stop(t + 1.5);
  }

  playClearSound() {
    if (this.isMuted) return;
    this.resume();
    const t = this.ctx.currentTime;
    
    // Add a huge cosmic delay
    const delay = this.ctx.createDelay();
    delay.delayTime.value = 0.3; // 300ms
    const feedback = this.ctx.createGain();
    feedback.gain.value = 0.4;
    
    delay.connect(feedback);
    feedback.connect(delay);
    
    const delayLevel = this.ctx.createGain();
    delayLevel.gain.value = 0.5;
    delay.connect(delayLevel);
    delayLevel.connect(this.masterGain);

    // Massive chord stabs
    [523.25, 659.25, 783.99, 1046.50].forEach((freq) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sawtooth';
      
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(5000, t);
      filter.frequency.exponentialRampToValueAtTime(200, t + 0.6);
      
      osc.connect(filter).connect(gain);
      gain.connect(this.masterGain);
      gain.connect(delay); // connect to echo

      osc.frequency.setValueAtTime(freq, t);
      
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.25, t + 0.05); // quick attack
      gain.gain.exponentialRampToValueAtTime(0.01, t + 0.6); // long decay

      osc.start(t);
      osc.stop(t + 0.6);
    });

    // Sub bass drop
    const sub = this.ctx.createOscillator();
    const subGain = this.ctx.createGain();
    sub.type = 'sine';
    sub.connect(subGain).connect(this.masterGain);
    
    sub.frequency.setValueAtTime(130.81, t); // C3
    sub.frequency.exponentialRampToValueAtTime(32.7, t + 0.5); // C1
    
    subGain.gain.setValueAtTime(0.5, t);
    subGain.gain.linearRampToValueAtTime(0, t + 0.6);
    
    sub.start(t);
    sub.stop(t + 0.6);
  }

  playGameOverSound() {
    if (this.isMuted) return;
    this.resume();
    this.stopTheme();

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.frequency.setValueAtTime(300, t);
    osc.frequency.exponentialRampToValueAtTime(50, t + 1);

    gain.gain.setValueAtTime(0.3, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 1);

    osc.start(t);
    osc.stop(t + 1);
  }

  playTheme() {
    if (this.isMuted || this.isPlayingTheme) return;
    this.resume();
    this.isPlayingTheme = true;

    if (this.bgmAudio) {
      this.bgmAudio.currentTime = 0;
      this.bgmAudio.playbackRate = Math.min(1.0 + (this.currentLevel - 1) * 0.05, 1.5);
      this.bgmAudio.play().catch((e) => {
        console.warn("Could not play MP3, falling back to synthetic theme:", e);
        this.playSyntheticTheme();
      });
    } else {
      this.playSyntheticTheme();
    }
  }

  playSyntheticTheme() {
    // Korobeiniki frequencies in a 16th note sequence
    const melody = [
      { f: 659.25, step: 4 }, // E5 (quarter note)
      { f: 493.88, step: 2 }, // B4 (eighth)
      { f: 523.25, step: 2 }, // C5
      { f: 587.33, step: 4 }, // D5
      { f: 523.25, step: 2 }, // C5
      { f: 493.88, step: 2 }, // B4
      { f: 440.00, step: 4 }, // A4
      { f: 440.00, step: 2 }, // A4
      { f: 523.25, step: 2 }, // C5
      { f: 659.25, step: 4 }, // E5
      { f: 587.33, step: 2 }, // D5
      { f: 523.25, step: 2 }, // C5
      { f: 493.88, step: 6 }, // B4 (dotted quarter)
      { f: 523.25, step: 2 }, // C5
      { f: 587.33, step: 4 }, // D5
      { f: 659.25, step: 4 }, // E5
      { f: 523.25, step: 4 }, // C5
      { f: 440.00, step: 4 }, // A4
      { f: 440.00, step: 8 }, // A4
    ]; // Total steps = 64 (4 bars of 16 steps)

    let currentStep = 0;
    let currentMelodyIdx = 0;
    let stepsRemainingInMelody = melody[0].step;

    const playNextNote = () => {
      if (!this.isPlayingTheme) return;
      
      const now = this.ctx.currentTime;
      const speedMultiplier = Math.min(1.0 + (this.currentLevel - 1) * 0.05, 1.5);
      const currentTickDuration = 0.12 / speedMultiplier;
      
      // Kick drum on every 4th step (4 on the floor)
      if (currentStep % 4 === 0) {
        const kick = this.ctx.createOscillator();
        const kGain = this.ctx.createGain();
        kick.type = 'sine';
        kick.connect(kGain);
        kGain.connect(this.masterGain);
        
        kick.frequency.setValueAtTime(150, now);
        kick.frequency.exponentialRampToValueAtTime(0.01, now + 0.1); // punchy drop
        kGain.gain.setValueAtTime(0.8, now);
        kGain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
        kick.start(now);
        kick.stop(now + 0.1);
      } else if (currentStep % 2 === 0) {
         // Hi hat every 2nd step offset
         const noise = this.ctx.createBufferSource();
         const buffer = this.ctx.createBuffer(1, this.ctx.sampleRate * 0.05, this.ctx.sampleRate);
         const data = buffer.getChannelData(0);
         for (let i = 0; i < buffer.length; i++) data[i] = Math.random() * 2 - 1;
         noise.buffer = buffer;
         
         const filter = this.ctx.createBiquadFilter();
         filter.type = 'highpass';
         filter.frequency.value = 7000;
         
         const hGain = this.ctx.createGain();
         hGain.gain.setValueAtTime(0.2, now);
         hGain.gain.exponentialRampToValueAtTime(0.01, now + 0.05);
         
         noise.connect(filter).connect(hGain).connect(this.masterGain);
         noise.start(now);
         noise.stop(now + 0.05);
      }

      // Bassline pulse on 8th notes
      if (currentStep % 2 === 0) {
        const bassFreq = [164.81, 110.00, 146.83, 110.00][Math.floor(currentStep / 16)]; // E, A, D, A
        const bOsc = this.ctx.createOscillator();
        const bGain = this.ctx.createGain();
        bOsc.type = 'sawtooth';
        
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(400, now);
        filter.frequency.exponentialRampToValueAtTime(100, now + 0.1);
        
        bOsc.connect(filter).connect(bGain).connect(this.masterGain);
        bOsc.frequency.value = bassFreq / 2; // drop octave
        
        bGain.gain.setValueAtTime(0.3, now);
        bGain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
        
        bOsc.start(now);
        bOsc.stop(now + 0.2);
      }

      // Melody
      if (stepsRemainingInMelody === melody[currentMelodyIdx].step) {
        const note = melody[currentMelodyIdx];
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'square'; // chiptune techno
        
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(2000, now);
        filter.frequency.exponentialRampToValueAtTime(800, now + note.step * currentTickDuration);
        
        osc.connect(filter).connect(gain).connect(this.masterGain);
        osc.frequency.value = note.f;
        
        gain.gain.setValueAtTime(0.1, now);
        gain.gain.setTargetAtTime(0.05, now + 0.05, 0.1);
        gain.gain.linearRampToValueAtTime(0.0, now + note.step * currentTickDuration - 0.05);

        osc.start(now);
        osc.stop(now + note.step * currentTickDuration);
      }
      
      stepsRemainingInMelody--;
      if (stepsRemainingInMelody <= 0) {
        currentMelodyIdx = (currentMelodyIdx + 1) % melody.length;
        stepsRemainingInMelody = melody[currentMelodyIdx].step;
      }

      currentStep = (currentStep + 1) % 64;
      
      this.themeInterval = window.setTimeout(playNextNote, currentTickDuration * 1000);
    };

    playNextNote();
  }

  stopTheme() {
    this.isPlayingTheme = false;
    if (this.themeInterval !== null) {
      clearTimeout(this.themeInterval);
      this.themeInterval = null;
    }
    if (this.bgmAudio) {
      this.bgmAudio.pause();
    }
  }
  toggleMute() {
    this.isMuted = !this.isMuted;
    if (this.isMuted) {
      this.stopTheme();
      this.masterGain.gain.setValueAtTime(0, this.ctx.currentTime);
    } else {
      this.masterGain.gain.setValueAtTime(0.2, this.ctx.currentTime);
      // Let it wait till next startGame or manually resume
    }
    return this.isMuted;
  }
}

export const synth = new Synthesizer();
