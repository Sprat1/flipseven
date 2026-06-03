// FLIP 7 - Deste ve Kart Sınıfları

export class Card {
  constructor(type, value) {
    this.type = type; // 'number' | 'action' | 'modifier'
    this.value = value; // 0-12 | 'freeze'/'flip_three'/'second_chance' | '+2'/'+4'/'+6'/'+8'/'+10'/'x2'
    this.id = Math.random().toString(36).substr(2, 9); // Benzersiz kart kimliği
  }

  // Arayüzde görüntülenecek simge veya değeri döndürür
  getDisplayValue() {
    if (this.type === 'number') {
      return this.value.toString();
    }
    if (this.type === 'modifier') {
      return this.value; // '+2', 'x2' vb.
    }
    if (this.type === 'action') {
      switch (this.value) {
        case 'freeze': return '❄️';
        case 'flip_three': return '⚔️';
        case 'second_chance': return '🛡️';
        default: return '🔮';
      }
    }
    return '';
  }

  // Arayüzde görüntülenecek Türkçe başlığı döndürür
  getDisplayName() {
    if (this.type === 'number') {
      return `Rün ${this.value}`;
    }
    if (this.type === 'modifier') {
      return this.value === 'x2' ? 'Katlayıcı x2' : `Efsun ${this.value}`;
    }
    if (this.type === 'action') {
      switch (this.value) {
        case 'freeze': return 'Dondur';
        case 'flip_three': return '3 Çektir';
        case 'second_chance': return 'İkinci Şans';
        default: return 'Kadim Rün';
      }
    }
    return '';
  }

  // CSS stili için sınıf adlarını döndürür
  getStyleClass() {
    if (this.type === 'number') {
      return 'number-card';
    }
    if (this.type === 'modifier') {
      return this.value === 'x2' ? 'modifier-card multiplier' : 'modifier-card plus';
    }
    if (this.type === 'action') {
      return `action-card ${this.value.replace(/_/g, '-')}`;
    }
    return '';
  }
}

export class Deck {
  constructor() {
    this.cards = [];
    this.reset();
  }

  // Desteyi 94 orijinal karta göre sıfırlar
  reset() {
    this.cards = [];

    // 1. Sayı Kartları (Toplam 79 adet)
    // 0: 1 adet
    this.cards.push(new Card('number', 0));
    // 1-12 arası sayılar, değerleri kadar kopya içerir (örn: 1'den 1 adet, 12'den 12 adet)
    for (let num = 1; num <= 12; num++) {
      for (let count = 0; count < num; count++) {
        this.cards.push(new Card('number', num));
      }
    }

    // 2. Skor Modifikatör Kartları (Toplam 6 adet)
    const modifiers = ['+2', '+4', '+6', '+8', '+10', 'x2'];
    modifiers.forEach(mod => {
      this.cards.push(new Card('modifier', mod));
    });

    // 3. Aksiyon Kartları (Toplam 9 adet)
    // Freeze (3 adet), Flip Three (3 adet), Second Chance (3 adet)
    for (let i = 0; i < 3; i++) {
      this.cards.push(new Card('action', 'freeze'));
      this.cards.push(new Card('action', 'flip_three'));
      this.cards.push(new Card('action', 'second_chance'));
    }
  }

  // Fisher-Yates Karıştırma Algoritması
  shuffle() {
    for (let i = this.cards.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.cards[i], this.cards[j]] = [this.cards[j], this.cards[i]];
    }
  }

  // Desteden kart çeker
  draw() {
    if (this.cards.length === 0) {
      // Deste bittiyse otomatik olarak yeniden doldur ve karıştır
      // (Flip 7 oyununda biten desteyi karıştırma kuralı vardır)
      this.reset();
      this.shuffle();
    }
    return this.cards.pop();
  }

  // Kalan kart sayısı
  count() {
    return this.cards.length;
  }
}
