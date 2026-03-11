'use client';
import { Howl } from 'howler';

class AudioManager {
  private bgm: Howl | null = null;
  private shootSfx: Howl | null = null;
  private hurtSfx: Howl | null = null;
  private isBgmPlaying = false;

  constructor() {
    if (typeof window !== 'undefined') {
      // Usando sons de domínio público (para efeito de demonstração de terror 8-bits)
      // Substituir pelas URLs definitivas de assets depois, se tiver!
      this.bgm = new Howl({
        src: ['https://cdn.freesound.org/previews/148/148281_166986-lq.mp3'], // Drone macabro baixo
        loop: true,
        volume: 0.1, // Bem baixinho
      });

      this.shootSfx = new Howl({
        src: ['https://cdn.freesound.org/previews/163/163456_2120259-lq.mp3'], // Gunshot
        volume: 0.2,
      });

      this.hurtSfx = new Howl({
        src: ['https://cdn.freesound.org/previews/68/68261_642459-lq.mp3'], // Zombie Hurt / Groan
        volume: 0.2,
      });
    }
  }

  public startBGM() {
    if (!this.bgm || this.isBgmPlaying) return;
    this.isBgmPlaying = true;
    this.bgm.play();
    this.bgm.fade(0, 0.1, 3000); // Fade in pra não assustar
  }

  public stopBGM() {
    if (!this.bgm) return;
    this.bgm.fade(0.1, 0, 1000);
    this.bgm.once('fade', () => {
      this.bgm?.stop();
    });
    this.isBgmPlaying = false;
  }

  public playShootSound() {
    if (this.shootSfx) {
      this.shootSfx.rate(0.9 + Math.random() * 0.2); // Variação de pitch pra não soar repetitivo
      this.shootSfx.play();
    }
  }

  public playZombieHurt() {
    if (this.hurtSfx) {
      this.hurtSfx.rate(0.8 + Math.random() * 0.4); 
      this.hurtSfx.play();
    }
  }
}

export const audioSystem = typeof window !== 'undefined' ? new AudioManager() : null;
