// Web Audio API Procedural Synthesizer for Arcade FPS Horror Game
// Keeps footprint tiny and prevents web latency loading issues.

class SoundSynth {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private musicGain: GainNode | null = null;
  
  private masterVolume: number = 0.5; // Reduced default volume
  private sfxVolume: number = 0.6;    // Reduced SFX volume
  private musicVolume: number = 0.35;  // Reduced music volume

  init() {
    if (this.ctx) return;
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      this.ctx = new AudioCtx();
      
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = this.masterVolume;
      this.masterGain.connect(this.ctx.destination);
      
      this.sfxGain = this.ctx.createGain();
      this.sfxGain.gain.value = this.sfxVolume;
      this.sfxGain.connect(this.masterGain);
      
      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.value = this.musicVolume;
      this.musicGain.connect(this.masterGain);

      // Start gentle procedural background music drone
      this.startAmbientMusic();
    } catch (e) {
      console.warn("Failed to initialize Web Audio API", e);
    }
  }

  setMasterVolume(val: number) {
    this.masterVolume = Math.max(0, Math.min(1, val));
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(this.masterVolume, this.ctx.currentTime, 0.1);
    }
  }

  setSFXVolume(val: number) {
    this.sfxVolume = Math.max(0, Math.min(1, val));
    if (this.sfxGain && this.ctx) {
      this.sfxGain.gain.setTargetAtTime(this.sfxVolume, this.ctx.currentTime, 0.1);
    }
  }

  setMusicVolume(val: number) {
    this.musicVolume = Math.max(0, Math.min(1, val));
    if (this.musicGain && this.ctx) {
      this.musicGain.gain.setTargetAtTime(this.musicVolume, this.ctx.currentTime, 0.1);
    }
  }

  resume() {
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  // Procedure for Pistol Fire: Fast high-frequency transient + envelope decay
  playPistol() {
    this.init();
    this.resume();
    if (!this.ctx || !this.sfxGain) return;

    const now = this.ctx.currentTime;
    
    // Crack metal-snap high-gain noise
    const bufferSize = this.ctx.sampleRate * 0.08; // 80ms snappier
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    
    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;
    
    const noiseFilter = this.ctx.createBiquadFilter();
    noiseFilter.type = 'bandpass';
    noiseFilter.frequency.value = 1400; // sharper snap frequency
    noiseFilter.Q.value = 4;
    
    const noiseGain = this.ctx.createGain();
    noiseGain.gain.setValueAtTime(0.7, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
    
    noise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(this.sfxGain);
    noise.start(now);

    // Deep heavy thumb with a crisp sawtooth click
    const osc = this.ctx.createOscillator();
    const oscGain = this.ctx.createGain();
    
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(380, now);
    osc.frequency.exponentialRampToValueAtTime(45, now + 0.09); // steeper pitch sweep
    
    oscGain.gain.setValueAtTime(0.65, now);
    oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
    
    osc.connect(oscGain);
    oscGain.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.15);

    // Dynamic metallic slide ring
    const slideOsc = this.ctx.createOscillator();
    const slideGain = this.ctx.createGain();
    slideOsc.type = 'sine';
    slideOsc.frequency.setValueAtTime(800, now);
    slideOsc.frequency.exponentialRampToValueAtTime(1200, now + 0.05);
    slideGain.gain.setValueAtTime(0.2, now);
    slideGain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
    slideOsc.connect(slideGain);
    slideGain.connect(this.sfxGain);
    slideOsc.start(now);
    slideOsc.stop(now + 0.1);
  }

  // Procedure for Shotgun Fire: Huge transient, thunder noise + heavy mechanical shock
  playShotgun() {
    this.init();
    this.resume();
    if (!this.ctx || !this.sfxGain) return;

    const now = this.ctx.currentTime;
    
    // Low frequency rumbling noise blast
    const bufferSize = this.ctx.sampleRate * 0.4; // 400ms thunder
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    
    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;
    
    const noiseFilter = this.ctx.createBiquadFilter();
    noiseFilter.type = 'lowpass';
    noiseFilter.frequency.setValueAtTime(600, now);
    noiseFilter.frequency.exponentialRampToValueAtTime(90, now + 0.3);
    
    const noiseGain = this.ctx.createGain();
    noiseGain.gain.setValueAtTime(1.1, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.38);
    
    noise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(this.sfxGain);
    noise.start(now);

    // High frequency hot-gas friction spray
    const spraySource = this.ctx.createBufferSource();
    spraySource.buffer = buffer;
    const sprayFilter = this.ctx.createBiquadFilter();
    sprayFilter.type = 'highpass';
    sprayFilter.frequency.setValueAtTime(2500, now);
    const sprayGain = this.ctx.createGain();
    sprayGain.gain.setValueAtTime(0.4, now);
    sprayGain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
    spraySource.connect(sprayFilter);
    sprayFilter.connect(sprayGain);
    sprayGain.connect(this.sfxGain);
    spraySource.start(now);

    // Low Chest-pounding Sub-Bass Thud
    const osc1 = this.ctx.createOscillator();
    const oscGain1 = this.ctx.createGain();
    osc1.type = 'triangle';
    osc1.frequency.setValueAtTime(150, now);
    osc1.frequency.linearRampToValueAtTime(25, now + 0.22);
    oscGain1.gain.setValueAtTime(1.3, now);
    oscGain1.gain.exponentialRampToValueAtTime(0.001, now + 0.28);
    osc1.connect(oscGain1);
    oscGain1.connect(this.sfxGain);
    osc1.start(now);
    osc1.stop(now + 0.32);

    // Steel mechanical double slap click triggers
    setTimeout(() => this.playReloadClick(0.75), 450);
    setTimeout(() => this.playReloadClick(0.55), 650);
  }

  // Click sounds for weapons reloading
  playReloadClick(pitchMult: number = 1.0) {
    if (!this.ctx || !this.sfxGain) return;
    const now = this.ctx.currentTime;
    
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(1800 * pitchMult, now);
    osc.frequency.exponentialRampToValueAtTime(400 * pitchMult, now + 0.05);
    
    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
    
    osc.connect(gain);
    gain.connect(this.sfxGain);
    
    osc.start(now);
    osc.stop(now + 0.07);
  }

  // Cash Register / buy confirmation ding
  playBuy() {
    this.init();
    this.resume();
    if (!this.ctx || !this.sfxGain) return;
    const now = this.ctx.currentTime;

    const osc1 = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(1200, now);
    osc1.frequency.setValueAtTime(1600, now + 0.04);
    
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(2000, now);
    osc2.frequency.setValueAtTime(2400, now + 0.04);

    gain.gain.setValueAtTime(0.3, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);

    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(this.sfxGain);

    osc1.start(now);
    osc2.start(now);
    osc1.stop(now + 0.65);
    osc2.stop(now + 0.65);
  }

  playSmg() {
    this.init();
    this.resume();
    if (!this.ctx || !this.sfxGain) return;

    const now = this.ctx.currentTime;
    
    // Snappy high-frequency noise transient
    const bufferSize = this.ctx.sampleRate * 0.04; // 40ms snap
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    
    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;
    
    const noiseFilter = this.ctx.createBiquadFilter();
    noiseFilter.type = 'bandpass';
    noiseFilter.frequency.value = 1800; // higher frequency snap
    noiseFilter.Q.value = 5;
    
    const noiseGain = this.ctx.createGain();
    noiseGain.gain.setValueAtTime(0.55, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);
    
    noise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(this.sfxGain);
    noise.start(now);

    // Sawtooth core
    const osc = this.ctx.createOscillator();
    const oscGain = this.ctx.createGain();
    
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(420, now);
    osc.frequency.exponentialRampToValueAtTime(60, now + 0.06);
    
    oscGain.gain.setValueAtTime(0.45, now);
    oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.07);
    
    osc.connect(oscGain);
    oscGain.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.1);
  }

  playPerkPurchase() {
    this.init();
    this.resume();
    if (!this.ctx || !this.sfxGain) return;
    const now = this.ctx.currentTime;
    
    // Ascending powerup synth melody
    const notes = [261.6, 329.6, 392.0, 523.3, 659.3, 784.0, 1046.5]; // C major arpeggio
    notes.forEach((freq, idx) => {
      const pOsc = this.ctx!.createOscillator();
      const pGain = this.ctx!.createGain();
      pOsc.type = 'sine';
      pOsc.frequency.setValueAtTime(freq, now + idx * 0.07);
      pGain.gain.setValueAtTime(0.12, now + idx * 0.07);
      pGain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.07 + 0.18);
      
      pOsc.connect(pGain);
      pGain.connect(this.sfxGain!);
      pOsc.start(now + idx * 0.07);
      pOsc.stop(now + idx * 0.07 + 0.2);
    });

    // Gentle sub-bass swell
    const sub = this.ctx.createOscillator();
    const subGain = this.ctx.createGain();
    sub.type = 'triangle';
    sub.frequency.setValueAtTime(130, now);
    sub.frequency.exponentialRampToValueAtTime(260, now + 0.5);
    subGain.gain.setValueAtTime(0.25, now);
    subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
    sub.connect(subGain);
    subGain.connect(this.sfxGain);
    sub.start(now);
    sub.stop(now + 0.7);
  }

  // Click sound for menu UI buttons
  playClick() {
    this.init();
    this.resume();
    if (!this.ctx || !this.sfxGain) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(400, now);
    osc.frequency.exponentialRampToValueAtTime(100, now + 0.08);
    gain.gain.setValueAtTime(0.3, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.09);
  }

  // Soft high-pitched bloop when hover focus triggers
  playHover() {
    this.init();
    this.resume();
    if (!this.ctx || !this.sfxGain) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(600, now);
    osc.frequency.linearRampToValueAtTime(700, now + 0.04);
    gain.gain.setValueAtTime(0.08, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);
    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.05);
  }

  // Hitmarker "Tink" sound
  playHitmarker() {
    this.init();
    this.resume();
    if (!this.ctx || !this.sfxGain) return;
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(2200, now);
    
    gain.gain.setValueAtTime(0.15, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);

    osc.connect(gain);
    gain.connect(this.sfxGain);

    osc.start(now);
    osc.stop(now + 0.05);
  }

  // Solid thud when hitting zombie / player getting hit
  playHitImpact() {
    if (!this.ctx || !this.sfxGain) return;
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(120, now);
    osc.frequency.linearRampToValueAtTime(40, now + 0.1);

    gain.gain.setValueAtTime(0.5, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

    osc.connect(gain);
    gain.connect(this.sfxGain);

    osc.start(now);
    osc.stop(now + 0.13);
  }

  // Deep creepy wave start chime (Tense bell)
  playWaveStart() {
    this.init();
    this.resume();
    if (!this.ctx || !this.sfxGain) return;
    const now = this.ctx.currentTime;

    const oscBell = this.ctx.createOscillator();
    const oscSub = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    oscBell.type = 'sine';
    oscBell.frequency.setValueAtTime(140, now);
    // Vibrato
    oscBell.frequency.linearRampToValueAtTime(135, now + 1.2);

    oscSub.type = 'triangle';
    oscSub.frequency.setValueAtTime(65, now);

    gain.gain.setValueAtTime(0.6, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 2.5);

    // Apply distortion filter
    const dist = this.ctx.createBiquadFilter();
    dist.type = 'lowpass';
    dist.frequency.value = 280;

    oscBell.connect(dist);
    oscSub.connect(dist);
    dist.connect(gain);
    gain.connect(this.sfxGain);

    oscBell.start(now);
    oscSub.start(now);
    oscBell.stop(now + 2.6);
    oscSub.stop(now + 2.6);
  }

  // Zombie growl synth: Low-pitch sawtooth with vibrato and bandpass filter modulation
  playZombieGrowl() {
    this.init();
    this.resume();
    if (!this.ctx || !this.sfxGain) return;
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const vibrato = this.ctx.createOscillator();
    const vibGain = this.ctx.createGain();
    
    const filter = this.ctx.createBiquadFilter();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(90 + Math.random() * 30, now);
    osc.frequency.linearRampToValueAtTime(50 + Math.random() * 15, now + 0.8);

    vibrato.frequency.setValueAtTime(12, now); // vibrato rate
    vibGain.gain.setValueAtTime(15, now); // vibrato depth

    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(250, now);
    filter.frequency.exponentialRampToValueAtTime(150, now + 0.8);
    filter.Q.value = 5.0;

    gain.gain.setValueAtTime(0.35, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.8);

    vibrato.connect(vibGain);
    vibGain.connect(osc.frequency);
    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxGain);

    vibrato.start(now);
    osc.start(now);
    vibrato.stop(now + 0.85);
    osc.stop(now + 0.85);
  }

  // Tense, crawling ambient horror dark drone playing in background continuously
  private startAmbientMusic() {
    if (!this.ctx || !this.musicGain) return;
    
    const loop = () => {
      if (!this.ctx || !this.musicGain) return;
      const now = this.ctx.currentTime;
      
      const osc1 = this.ctx.createOscillator();
      const osc2 = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      
      osc1.type = 'sawtooth';
      osc1.frequency.setValueAtTime(55, now); // A1
      osc1.frequency.linearRampToValueAtTime(54, now + 8);
      
      osc2.type = 'sawtooth';
      osc2.frequency.setValueAtTime(82.4, now); // E2
      osc2.frequency.linearRampToValueAtTime(83, now + 8);
      
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(90, now);
      filter.frequency.linearRampToValueAtTime(120, now + 4);
      filter.frequency.linearRampToValueAtTime(90, now + 8);
      filter.Q.value = 4.0;
      
      gain.gain.setValueAtTime(0.0, now);
      gain.gain.linearRampToValueAtTime(0.18, now + 2);
      gain.gain.setValueAtTime(0.18, now + 6);
      gain.gain.linearRampToValueAtTime(0.0, now + 8);
      
      osc1.connect(filter);
      osc2.connect(filter);
      filter.connect(gain);
      gain.connect(this.musicGain);
      
      osc1.start(now);
      osc2.start(now);
      osc1.stop(now + 8.1);
      osc2.stop(now + 8.1);
      
      // Schedule next phrase
      setTimeout(loop, 7800);
    };
    
    loop();
  }

  playBoxSpin() {
    this.init();
    this.resume();
    if (!this.ctx || !this.sfxGain) return;
    const now = this.ctx.currentTime;
    
    // Play a sequence of ticking oscillators to simulate spinning weapon select
    for (let i = 0; i < 15; i++) {
      const tickTime = now + i * 0.12;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(800 - i * 15, tickTime);
      gain.gain.setValueAtTime(0.08, tickTime);
      gain.gain.exponentialRampToValueAtTime(0.001, tickTime + 0.05);
      
      osc.connect(gain);
      gain.connect(this.sfxGain);
      osc.start(tickTime);
      osc.stop(tickTime + 0.06);
    }
  }

  playBoxReady() {
    this.init();
    this.resume();
    if (!this.ctx || !this.sfxGain) return;
    const now = this.ctx.currentTime;
    
    // Spooky bell jingle (retro arcade wave)
    const notes = [440, 523.25, 659.25, 783.99, 880, 1046.5]; // A minor arpeggio
    notes.forEach((f, idx) => {
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();
      osc.type = 'sine';
      osc.frequency.value = f;
      gain.gain.setValueAtTime(0.0, now + idx * 0.1);
      gain.gain.linearRampToValueAtTime(0.15, now + idx * 0.1 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.1 + 0.4);
      
      osc.connect(gain);
      gain.connect(this.sfxGain!);
      osc.start(now + idx * 0.1);
      osc.stop(now + idx * 0.1 + 0.45);
    });
  }

  playPageTurn() {
    this.init();
    this.resume();
    if (!this.ctx || !this.sfxGain) return;
    const now = this.ctx.currentTime;
    
    // Page turning paper swoosh using white noise
    const bufferSize = this.ctx.sampleRate * 0.55; 
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    
    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;
    
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(600, now);
    filter.frequency.exponentialRampToValueAtTime(1200, now + 0.5);
    filter.Q.value = 1.5;
    
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.0, now);
    gain.gain.linearRampToValueAtTime(0.2, now + 0.15);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.55);
    
    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxGain);
    
    noise.start(now);
    noise.stop(now + 0.6);
  }

  playBookOpen() {
    this.init();
    this.resume();
    if (!this.ctx || !this.sfxGain) return;
    const now = this.ctx.currentTime;

    // Creepy resonant low wood creak and wind blow
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(120, now);
    osc.frequency.exponentialRampToValueAtTime(45, now + 1.2);

    gain.gain.setValueAtTime(0.35, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 1.4);

    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 1.5);

    // Dust particles crackly noise
    const bufferSize = this.ctx.sampleRate * 0.8;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() > 0.965 ? (Math.random() * 2 - 1) : 0;
    }
    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;
    const noiseGain = this.ctx.createGain();
    noiseGain.gain.setValueAtTime(0.18, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.8);
    noise.connect(noiseGain);
    noiseGain.connect(this.sfxGain);
    noise.start(now);
  }

  playBookWhisper() {
    this.init();
    this.resume();
    if (!this.ctx || !this.sfxGain) return;
    const now = this.ctx.currentTime;

    // Dual low modulated voice-like chanting oscillators
    const osc1 = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    const lfo = this.ctx.createOscillator();
    const lfoGain = this.ctx.createGain();
    const gain = this.ctx.createGain();

    osc1.type = 'sine';
    osc1.frequency.value = 160;
    osc2.type = 'triangle';
    osc2.frequency.value = 215;

    lfo.type = 'sine';
    lfo.frequency.value = 4.0;
    lfoGain.gain.value = 15;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 420;
    filter.Q.value = 2.5;

    gain.gain.setValueAtTime(0.0, now);
    gain.gain.linearRampToValueAtTime(0.25, now + 0.5);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 3.0);

    lfo.connect(lfoGain);
    lfoGain.connect(osc1.frequency);
    lfoGain.connect(osc2.frequency);
    osc1.connect(filter);
    osc2.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxGain);

    lfo.start(now);
    osc1.start(now);
    osc2.start(now);
    lfo.stop(now + 3.1);
    osc1.stop(now + 3.1);
    osc2.stop(now + 3.1);
  }

  playPageFlipQuick() {
    this.init();
    this.resume();
    if (!this.ctx || !this.sfxGain) return;
    const now = this.ctx.currentTime;

    // Rapid fluttering pages sound
    for (let i = 0; i < 11; i++) {
      const timeOffset = now + i * 0.12;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(320 - i * 15, timeOffset);
      gain.gain.setValueAtTime(0.08, timeOffset);
      gain.gain.exponentialRampToValueAtTime(0.001, timeOffset + 0.08);
      
      const f = this.ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = 900;
      
      osc.connect(f);
      f.connect(gain);
      gain.connect(this.sfxGain);
      osc.start(timeOffset);
      osc.stop(timeOffset + 0.1);
    }
  }

  playWonderBlast() {
    this.init();
    this.resume();
    if (!this.ctx || !this.sfxGain) return;
    const now = this.ctx.currentTime;
    
    // High-energy electrical blast: sweep pitch + low swell + crackly high noise
    const osc = this.ctx.createOscillator();
    const subOsc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(1200, now);
    osc.frequency.exponentialRampToValueAtTime(80, now + 0.35);
    
    subOsc.type = 'sine';
    subOsc.frequency.setValueAtTime(80, now);
    subOsc.frequency.linearRampToValueAtTime(30, now + 0.4);
    
    gain.gain.setValueAtTime(0.9, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
    
    // Crinkly electric crackle bandpass noise
    const bufferSize = this.ctx.sampleRate * 0.25;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
       data[i] = Math.random() * 2 - 1;
    }
    const noiseNode = this.ctx.createBufferSource();
    noiseNode.buffer = buffer;
    
    const noiseFilter = this.ctx.createBiquadFilter();
    noiseFilter.type = 'bandpass';
    noiseFilter.frequency.value = 4000;
    noiseFilter.Q.value = 2.0;
    
    const noiseGain = this.ctx.createGain();
    noiseGain.gain.setValueAtTime(0.5, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
    
    noiseNode.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(this.sfxGain);
    
    osc.connect(gain);
    subOsc.connect(gain);
    gain.connect(this.sfxGain);
    
    osc.start(now);
    subOsc.start(now);
    noiseNode.start(now);
    
    osc.stop(now + 0.5);
    subOsc.stop(now + 0.5);
    noiseNode.stop(now + 0.35);
  }
}

export const sound = new SoundSynth();
