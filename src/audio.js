// FLIP 7 - Retro-Synth Ses Sentezleme Motoru

class CyberAudioEngine {
  constructor() {
    this.ctx = null;
  }

  // Tarayıcı güvenlik politikası gereği ses context'ini ilk etkileşimde başlatıyoruz
  init() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  // Beyaz Gürültü Üretici (Hata/Yanma parazitleri için)
  createNoiseBuffer() {
    if (!this.ctx) return null;
    const bufferSize = this.ctx.sampleRate * 1.5; // 1.5 saniyelik gürültü
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    return buffer;
  }

  // 1. Dijital Kart Çevirme Bipi (Digital Click/Bleep)
  playFlip() {
    this.init();
    if (!this.ctx) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    // Hızlı siber klik sesi için frekans yukardan aşağıya hızlıca iner
    osc.frequency.setValueAtTime(880, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(330, this.ctx.currentTime + 0.08);

    gain.gain.setValueAtTime(0.001, this.ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.08, this.ctx.currentTime + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.08);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start();
    osc.stop(this.ctx.currentTime + 0.1);
  }

  // 2. Dijital Yanma Hata Sesi (Bust - Retro 8-bit Downward Sweep & Glitch)
  playBust() {
    this.init();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;

    // Frekansı sertçe düşen testere dişi dalgası (Atari hata sesi)
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(440, now);
    osc.frequency.linearRampToValueAtTime(60, now + 0.5);

    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);

    // Düşük geçişli filtre ile dijital bozulma hissi
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(1000, now);
    filter.frequency.linearRampToValueAtTime(200, now + 0.5);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);
    
    osc.start(now);
    osc.stop(now + 0.5);

    // Dijital gürültü hışırtısı (Glitch)
    const noiseBuffer = this.createNoiseBuffer();
    if (noiseBuffer) {
      const noiseSource = this.ctx.createBufferSource();
      noiseSource.buffer = noiseBuffer;

      const noiseFilter = this.ctx.createBiquadFilter();
      noiseFilter.type = 'bandpass';
      noiseFilter.frequency.setValueAtTime(500, now);
      
      const noiseGain = this.ctx.createGain();
      noiseGain.gain.setValueAtTime(0.12, now);
      noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);

      noiseSource.connect(noiseFilter);
      noiseFilter.connect(noiseGain);
      noiseGain.connect(this.ctx.destination);

      noiseSource.start(now);
      noiseSource.stop(now + 0.4);
    }
  }

  // 3. Dijital Donma Efekti (Freeze - Cyber Ice Chime)
  playFreeze() {
    this.init();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;

    // Yüksek frekanslı, pırıldayan dijital üçgen dalgalar (Siber Buz Çanları)
    const chimes = [1200, 1600, 2000, 2400];
    chimes.forEach((freq, idx) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now + idx * 0.06);
      
      gain.gain.setValueAtTime(0.001, now + idx * 0.06);
      gain.gain.linearRampToValueAtTime(0.06, now + idx * 0.06 + 0.01);
      // Siber tınlama için hafif uzun yankı decay
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.06 + 0.4);
      
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      
      osc.start(now + idx * 0.06);
      osc.stop(now + idx * 0.06 + 0.5);
    });
  }

  // 4. Flip 7 Başarı Sesi (Retro Arcade Win Fanfare)
  playFlip7() {
    this.init();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    
    // Klasik 8-bit retro arcade galibiyet arpeji (Kare dalga)
    const notes = [523.25, 659.25, 783.99, 1046.50, 1318.51, 1567.98, 2093.00];

    notes.forEach((freq, idx) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      
      osc.type = 'square'; // Net 8-bit atari sesi
      osc.frequency.setValueAtTime(freq, now + idx * 0.08);
      
      gain.gain.setValueAtTime(0.001, now + idx * 0.08);
      gain.gain.linearRampToValueAtTime(0.05, now + idx * 0.08 + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.08 + 0.25);
      
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      
      osc.start(now + idx * 0.08);
      osc.stop(now + idx * 0.08 + 0.3);
    });
  }

  // 5. Pas Geçme/Onay Sesi (Stay - Clean Sine Chime)
  playStay() {
    this.init();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;

    // Yumuşak, çift tonlu onay bipi
    const freqs = [587.33, 880.00]; // D5 ve A5
    
    freqs.forEach((freq, idx) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + idx * 0.08);
      
      gain.gain.setValueAtTime(0.001, now + idx * 0.08);
      gain.gain.linearRampToValueAtTime(0.08, now + idx * 0.08 + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.08 + 0.15);
      
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      
      osc.start(now + idx * 0.08);
      osc.stop(now + idx * 0.08 + 0.2);
    });
  }
}

export const audio = new CyberAudioEngine();
export default audio;
