'use client';

// Usamos uma classe singleton para garantir que o AudioContext só inicialize no browser pós-interação
class RetroAudio {
  private ctx: AudioContext | null = null;
  private bgmOsc: OscillatorNode | null = null;
  private isBgmPlaying = false;

  private init() {
    if (!this.ctx && typeof window !== 'undefined') {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
  }

  // Suspense a BGM se a aba fechar ou o usuário sair
  public stopBGM() {
    if (this.bgmOsc) {
      try { this.bgmOsc.stop(); } catch(e){}
      this.bgmOsc = null;
    }
    this.isBgmPlaying = false;
  }

  // Background Music - Sintetizador ambiente de terror/apocalipse (Drone longo)
  public startBGM() {
    this.init();
    if (!this.ctx || this.isBgmPlaying) return;

    this.isBgmPlaying = true;
    const osc = this.ctx.createOscillator();
    const gainNode = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();

    // Drone sombrio
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(55, this.ctx.currentTime); // Frequência mega baixa (nota A1)
    
    // Filtro modulado
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(100, this.ctx.currentTime);
    filter.Q.value = 5;

    // Modulação (LFO para o volume e filtro)
    const lfo = this.ctx.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.value = 0.1; // Lentidão macabra
    
    const lfoGain = this.ctx.createGain();
    lfoGain.gain.value = 300; 

    lfo.connect(lfoGain);
    lfoGain.connect(filter.frequency);

    gainNode.gain.setValueAtTime(0, this.ctx.currentTime);
    gainNode.gain.linearRampToValueAtTime(0.08, this.ctx.currentTime + 5); // Fade in suave
    
    osc.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(this.ctx.destination);

    osc.start();
    lfo.start();
    this.bgmOsc = osc;
  }

  // Efeito de Tiro estilo 8-bits retro
  public playShootSound() {
    this.init();
    if (!this.ctx) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'square';
    osc.frequency.setValueAtTime(400, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(10, this.ctx.currentTime + 0.1);

    gain.gain.setValueAtTime(0.2, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.1);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start();
    osc.stop(this.ctx.currentTime + 0.1);
  }

  // Zumbi machucado e gemido
  public playZombieHurt() {
    this.init();
    if (!this.ctx) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(120, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(40, this.ctx.currentTime + 0.3);

    gain.gain.setValueAtTime(0.1, this.ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.01, this.ctx.currentTime + 0.3);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start();
    osc.stop(this.ctx.currentTime + 0.3);
  }

  public resume() {
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }
}

export const audioSystem = typeof window !== 'undefined' ? new RetroAudio() : null;
