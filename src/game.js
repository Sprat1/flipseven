// FLIP 7 - Oyun Mantığı ve Kurallar Motoru

import { Deck, Card } from './deck.js';

export class Player {
  constructor(id, name, isAI = false, aiPersonality = 'balanced') {
    this.id = id;
    this.name = name;
    this.isAI = isAI;
    this.aiPersonality = aiPersonality; // 'cautious' | 'balanced' | 'bold'
    this.score = 0; // Toplam oyun skoru
    
    // Tur bazlı durumlar
    this.cards = [];
    this.hasSecondChance = false;
    this.status = 'active'; // 'active' | 'stayed' | 'busted' | 'frozen'
    this.roundScore = 0;
    this.isFlipped7 = false;
    this.isDisconnected = false; // Bağlantısı kopan oyuncu sonraki turlara katılmaz
  }

  // Tur başında oyuncu durumunu sıfırlar
  resetRoundState() {
    this.cards = [];
    this.hasSecondChance = false;
    this.status = this.isDisconnected ? 'stayed' : 'active';
    this.roundScore = 0;
    this.isFlipped7 = false;
  }

  // Oyuncunun elindeki benzersiz sayı kartlarının sayısını döndürür
  getUniqueNumbersCount() {
    const numbers = this.cards
      .filter(c => c.type === 'number')
      .map(c => c.value);
    return new Set(numbers).size;
  }

  // Oyuncunun elindeki sayı kartlarının listesi
  getNumberValues() {
    return this.cards
      .filter(c => c.type === 'number')
      .map(c => c.value);
  }
}

export class Flip7Game {
  constructor() {
    this.players = [];
    this.deck = new Deck();
    this.currentPlayerIndex = 0;
    this.roundNumber = 1;
    this.dealerIndex = 0;
    this.gameStatus = 'setup'; // 'setup' | 'dealing' | 'playing' | 'action_resolution' | 'round_summary' | 'game_over'
    this.isInitialDealing = false; // İlk dağıtım sürerken true (aksiyon molasından dağıtıma doğru dönebilmek için)
    
    // Aksiyon çözme durumu
    this.actionState = {
      active: false,
      card: null,
      sourcePlayerId: null,
      targetPlayerId: null,
      flipsRemaining: 0,
      cardsFlippedThisAction: [],
      pendingActionsQueue: [] // Flip Three sırasında çekilen aksiyonları sıraya koymak için
    };
    
    this.logs = [];
    this.onStateChange = () => {}; // UI'ı güncellemek için tetiklenecek callback
  }

  // Durum değişikliğini UI'a bildirir
  stateChanged() {
    this.onStateChange(this);
  }

  // Desteden kart çeker; deste tükenip yeni 94'lük deste geldiyse oyuncuları bilgilendirir
  drawCard() {
    const card = this.deck.draw();
    if (this.deck.reshuffled) {
      this.deck.reshuffled = false;
      this.addLog(`Deste tükendi! Yeni karıştırılmış 94'lük deste girdi (kart sayacı sıfırlandı).`, 'normal');
    }
    return card;
  }

  addLog(message, type = 'normal') {
    this.logs.unshift({ message, type, time: new Date() });
    this.stateChanged();
  }

  // 1. OYUN KURULUMU
  setupGame(playersConfig) {
    this.players = playersConfig.map((p, index) => {
      return new Player(index, p.name, p.isAI, p.aiPersonality);
    });
    
    this.deck = new Deck();
    this.deck.shuffle(); // Deste oyun başında bir kez karılır; turlar arası sıfırlanmaz (kart sayımı için)
    this.roundNumber = 1;
    this.dealerIndex = 0;
    this.logs = [];
    
    this.addLog("Oyun başladı! İyi şanslar.", 'normal');
    this.startRound();
  }

  // 2. YENİ TUR BAŞLATMA
  startRound() {
    this.gameStatus = 'dealing';
    this.isInitialDealing = true;
    // Deste turlar arasında SIFIRLANMAZ — kartlar tükendikçe azalır (kart sayımı avantajı için).
    // Yeni karıştırılmış 94'lük deste yalnızca tüm kartlar bittiğinde (drawCard içinde) gelir.

    this.players.forEach(p => p.resetRoundState());
    this.actionState.active = false;
    this.actionState.pendingActionsQueue = [];

    this.addLog(`Tur ${this.roundNumber} başladı! Kartlar dağıtılıyor...`, 'normal');
    this.stateChanged();

    // İlk dağıtım döngüsü (Sırayla 1'er kart dağıtılır)
    this.runInitialDeal();
  }

  // İlk dağıtımı asenkron veya adımsal yöneten fonksiyon
  async runInitialDeal() {
    let dealIndex = (this.dealerIndex + 1) % this.players.length;
    
    for (let i = 0; i < this.players.length; i++) {
      const player = this.players[dealIndex];
      if (player.isDisconnected) {
        dealIndex = (dealIndex + 1) % this.players.length;
        continue;
      }
      const card = this.drawCard();
      player.cards.push(card);
      
      this.addLog(`${player.name} başlangıç kartını aldı: ${card.getDisplayName()}`, 'normal');
      this.stateChanged();

      // second_chance dağıtımda direkt uygulanır
      if (card.type === 'action' && card.value === 'second_chance') {
        player.hasSecondChance = true;
        this.addLog(`${player.name} başlangıçta İkinci Şans kartını aldı, otomatik aktif edildi.`, 'normal');
        this.stateChanged();
      }
      // Diğer aksiyon kartları dağıtımı durdurur ve çözüm bekler
      else if (card.type === 'action') {
        this.addLog(`Dağıtımda aksiyon kartı çıktı! ${player.name} kartı kullanıyor.`, 'normal');
        this.gameStatus = 'action_resolution';
        this.actionState = {
          active: true,
          card: card,
          sourcePlayerId: player.id,
          targetPlayerId: null,
          flipsRemaining: 0,
          cardsFlippedThisAction: [],
          pendingActionsQueue: []
        };

        this.stateChanged();

        if (player.isAI) {
          setTimeout(() => {
            this.autoResolveAIAction();
          }, 1200);
        }
        return; // Aksiyon çözülene kadar dağıtımı duraklat
      }

      dealIndex = (dealIndex + 1) % this.players.length;
      await new Promise(resolve => setTimeout(resolve, 300));
    }

    // Sorunsuz bittiyse oyunu başlat
    this.startActiveTurns();
  }

  // Aksiyon çözüldükten sonra dağıtımı sürdür
  async resumeInitialDeal() {
    this.gameStatus = 'dealing';
    this.actionState.active = false;
    this.stateChanged();

    let dealIndex = (this.dealerIndex + 1) % this.players.length;
    
    for (let i = 0; i < this.players.length; i++) {
      const player = this.players[dealIndex];
      if (!player.isDisconnected && player.cards.length === 0) {
        const card = this.drawCard();
        player.cards.push(card);
        this.addLog(`${player.name} başlangıç kartını aldı: ${card.getDisplayName()}`, 'normal');
        this.stateChanged();

        if (card.type === 'action' && card.value === 'second_chance') {
          player.hasSecondChance = true;
          this.addLog(`${player.name} başlangıçta İkinci Şans kartını aldı, otomatik aktif edildi.`, 'normal');
          this.stateChanged();
        } else if (card.type === 'action') {
          this.addLog(`Dağıtımda aksiyon kartı çıktı! ${player.name} kartı kullanıyor.`, 'normal');
          this.gameStatus = 'action_resolution';
          this.actionState = {
            active: true,
            card: card,
            sourcePlayerId: player.id,
            targetPlayerId: null,
            flipsRemaining: 0,
            cardsFlippedThisAction: [],
            pendingActionsQueue: []
          };
          this.stateChanged();

          if (player.isAI) {
            setTimeout(() => {
              this.autoResolveAIAction();
            }, 1200);
          }
          return;
        }
        
        await new Promise(resolve => setTimeout(resolve, 300));
      }
      dealIndex = (dealIndex + 1) % this.players.length;
    }

    this.startActiveTurns();
  }

  // Aktif hamlelerin başlaması
  startActiveTurns() {
    this.gameStatus = 'playing';
    this.isInitialDealing = false;
    this.currentPlayerIndex = (this.dealerIndex + 1) % this.players.length;
    
    if (this.getCurrentPlayer().status !== 'active') {
      this.moveToNextPlayer();
    } else {
      this.addLog(`Sıra ${this.getCurrentPlayer().name} oyuncusunda.`, 'normal');
      this.stateChanged();
      
      if (this.getCurrentPlayer().isAI) {
        setTimeout(() => {
          this.handleAITurn();
        }, 1500);
      }
    }
  }

  // KART ÇEKME (HIT)
  playerHit(playerId) {
    if (this.gameStatus !== 'playing') return;
    if (this.currentPlayerIndex !== playerId) return;

    const player = this.players[playerId];
    const card = this.drawCard();
    
    this.addLog(`${player.name} kart çekti: ${card.getDisplayName()}`, 'normal');
    
    this.applyCardToPlayer(player, card);
  }

  // PAS GEÇME (STAY)
  playerStay(playerId) {
    if (this.gameStatus !== 'playing') return;
    if (this.currentPlayerIndex !== playerId) return;

    const player = this.players[playerId];
    player.status = 'stayed';
    
    this.addLog(`${player.name} pas geçti ve tur skorunu kaydetti.`, 'stay');
    this.moveToNextPlayer();
  }

  // Kartı oyuncunun tablosuna işleme ve kuralları denetleme
  applyCardToPlayer(player, card, isFlipThreeStep = false) {
    player.cards.push(card);
    
    // A) SAYI KARTLARI
    if (card.type === 'number') {
      const numbers = player.getNumberValues();
      const count = numbers.filter(v => v === card.value).length;
      
      if (count > 1) {
        // İkinci Şans Korunması
        if (player.hasSecondChance) {
          player.hasSecondChance = false;
          player.cards.pop();
          const idxSC = player.cards.findIndex(c => c.type === 'action' && c.value === 'second_chance');
          if (idxSC !== -1) {
            player.cards.splice(idxSC, 1);
          }
          
          this.addLog(`İkinci Şans devrede! ${player.name} yanmaktan kurtuldu. Çift sayı (${card.value}) ve İkinci Şans kartı atıldı.`, 'stay');
          this.stateChanged();

          // Hit tamamlandı sayılır: Flip Three içindeyse devam et, değilse sıra sonraki oyuncuya geçer
          if (isFlipThreeStep) {
            this.continueFlipThree();
          } else {
            this.moveToNextPlayer();
          }
          return;
        } else {
          // Yandı! (Bust)
          player.status = 'busted';
          this.addLog(`${player.name} aynı sayıyı (${card.value}) tekrar çekti ve yandı!`, 'bust');
          this.stateChanged();
          
          if (isFlipThreeStep) {
            this.endFlipThreeAction();
          } else {
            this.moveToNextPlayer();
          }
          return;
        }
      }

      // Flip 7 kontrolü (7 benzersiz sayı)
      if (player.getUniqueNumbersCount() === 7) {
        player.isFlipped7 = true;
        this.addLog(`FLIP 7! ${player.name} yanmadan 7 farklı sayı topladı! Tur bitiyor.`, 'flip7');
        this.stateChanged();
        this.endRound();
        return;
      }
      
      this.stateChanged();
      if (isFlipThreeStep) {
        this.continueFlipThree();
      } else {
        this.moveToNextPlayer();
      }
    }
    
    // B) MODİFİKATÖR KARTLARI
    else if (card.type === 'modifier') {
      this.stateChanged();
      if (isFlipThreeStep) {
        this.continueFlipThree();
      } else {
        this.moveToNextPlayer();
      }
    }
    
    // C) AKSİYON KARTLARI
    else if (card.type === 'action') {
      if (card.value === 'second_chance' && !player.hasSecondChance) {
        player.hasSecondChance = true;
        this.addLog(`${player.name} İkinci Şans kartını aktif etti.`, 'normal');
        this.stateChanged();
        if (isFlipThreeStep) {
          this.continueFlipThree();
        } else {
          this.moveToNextPlayer();
        }
      } else if (card.value === 'second_chance') {
        // Kural: elinde İkinci Şans varken ikincisini çeken, kartı başka bir oyuncuya devretmek zorundadır
        this.addLog(`${player.name} zaten İkinci Şans'a sahip; fazladan kartı devretmesi gerekiyor.`, 'normal');
        this.enterActionResolution(player, card, isFlipThreeStep);
      } else {
        this.enterActionResolution(player, card, isFlipThreeStep);
      }
    }
  }

  // Aksiyon Kararı Etabına Giriş
  enterActionResolution(sourcePlayer, card, isFlipThreeStep = false) {
    this.gameStatus = 'action_resolution';
    
    if (isFlipThreeStep) {
      this.actionState.pendingActionsQueue.push({
        card: card,
        sourcePlayerId: sourcePlayer.id
      });
      this.addLog(`${sourcePlayer.name} 3 çekme sırasında başka bir aksiyon kartı (${card.getDisplayName()}) çekti, sıraya alındı.`, 'normal');
      this.continueFlipThree();
      return;
    }

    this.actionState = {
      active: true,
      card: card,
      sourcePlayerId: sourcePlayer.id,
      targetPlayerId: null,
      flipsRemaining: 0,
      cardsFlippedThisAction: [],
      pendingActionsQueue: []
    };
    
    this.addLog(`${sourcePlayer.name} aksiyon kartı çekti: ${card.getDisplayName()}. Hedef seçiliyor...`, 'normal');
    this.stateChanged();

    // Başka geçerli hedef yoksa kurala göre otomatik çöz (kilitlenmeyi önler)
    if (this.maybeAutoResolveAction()) return;

    if (sourcePlayer.isAI) {
      setTimeout(() => {
        this.autoResolveAIAction();
      }, 1200);
    }
  }

  // Freeze/Flip Three için geçerli başka hedef kalmadığında otomatik çözümleme.
  // Kural: tek aktif oyuncu kaynaksa kartı kendine uygulamak zorundadır.
  // Döndürür: işlem otomatik çözüldüyse true (çağıran modal/AI adımını atlamalı).
  maybeAutoResolveAction() {
    const st = this.actionState;
    if (!st || !st.active) return false;
    const card = st.card;
    const source = this.players[st.sourcePlayerId];

    // Kart sahibinin bağlantısı koptuysa kart iptal edilir (kilitlenme önlenir)
    if (!source || source.isDisconnected) {
      this.discardActionCard(`${card.getDisplayName()} kartı, sahibi oyundan ayrıldığı için iptal edildi.`);
      return true;
    }

    // İkinci Şans devri: İkinci Şans'ı olmayan aktif bir oyuncu yoksa kart oyun dışı kalır
    if (card.value === 'second_chance') {
      const validTargets = this.players.filter(p => p.id !== source.id && p.status === 'active' && !p.hasSecondChance);
      if (validTargets.length > 0) return false; // Normal şekilde hedef seçilsin
      this.discardActionCard(`Devredilecek uygun oyuncu yok; fazladan İkinci Şans kartı oyun dışı kaldı.`);
      return true;
    }

    if (card.value !== 'freeze' && card.value !== 'flip_three') return false;

    const otherActive = this.players.filter(p => p.id !== source.id && p.status === 'active');
    if (otherActive.length > 0) return false; // İnsan/AI normal şekilde hedef seçsin

    if (source.status === 'active') {
      // Tek aktif oyuncu kaynak: kartı kendine uygulamak zorunda
      this.addLog(`Başka aktif oyuncu yok; ${source.name} ${card.getDisplayName()} kartını kendine uygulamak zorunda.`, 'normal');
      this.resolveAction(source.id);
    } else {
      // Kaynak da aktif değil (örn. Flip Three sırasında yandı) ve başka aktif yok: kart etkisiz düşer
      this.addLog(`${card.getDisplayName()} için uygun hedef kalmadı, kart etkisiz kaldı.`, 'normal');
      st.active = false;
      this.finishActionAndContinue();
    }
    return true;
  }

  // Hedef bekleyen aksiyon kartını sahibinin elinden çıkarıp akışı sürdürür
  discardActionCard(logMessage) {
    const st = this.actionState;
    const source = this.players[st.sourcePlayerId];
    if (source && st.card) {
      const idx = source.cards.findIndex(c => c.id === st.card.id);
      if (idx !== -1) source.cards.splice(idx, 1);
    }
    this.addLog(logMessage, 'normal');
    st.active = false;
    this.finishActionAndContinue();
  }

  // 4. AKSİYON ÇÖZÜMLEME (RESOLVE ACTION)
  resolveAction(targetPlayerId) {
    if (this.gameStatus !== 'action_resolution') return;
    
    const sourcePlayer = this.players[this.actionState.sourcePlayerId];
    const targetPlayer = this.players[targetPlayerId];
    const card = this.actionState.card;

    // Hedef doğrulama: geçersiz/pasif hedefler reddedilir (online'da client hatalı veri gönderebilir)
    if (!targetPlayer) return;
    if ((card.value === 'freeze' || card.value === 'flip_three') && targetPlayer.status !== 'active') return;
    if (card.value === 'second_chance' &&
        (targetPlayer.status !== 'active' || targetPlayer.hasSecondChance || targetPlayer.id === sourcePlayer.id)) return;

    this.actionState.targetPlayerId = targetPlayerId;
    this.addLog(`${sourcePlayer.name}, ${card.getDisplayName()} kartını ${targetPlayer.name} üzerinde kullanıyor.`, 'normal');

    // A) FREEZE (DONDURMA)
    if (card.value === 'freeze') {
      targetPlayer.status = 'frozen';
      this.addLog(`${targetPlayer.name} donduruldu! Bu tur kart çekemez, skoru kilitlendi.`, 'freeze');
      this.actionState.active = false;
      
      this.finishActionAndContinue();
    }
    
    // B) SECOND CHANCE (İKİNCİ ŞANS - Başkasına verme)
    else if (card.value === 'second_chance') {
      const cardIndex = sourcePlayer.cards.findIndex(c => c.id === card.id);
      if (cardIndex !== -1) {
        sourcePlayer.cards.splice(cardIndex, 1);
      }
      targetPlayer.cards.push(card);
      targetPlayer.hasSecondChance = true;
      
      this.addLog(`${sourcePlayer.name}, İkinci Şans kartını ${targetPlayer.name} oyuncusuna verdi.`, 'normal');
      this.actionState.active = false;
      
      this.finishActionAndContinue();
    }
    
    // C) FLIP THREE (3 KART ÇEKTİRME)
    else if (card.value === 'flip_three') {
      this.actionState.flipsRemaining = 3;
      this.actionState.active = false; // Hedef seçildiği için modal penceresini kapatıyoruz
      this.addLog(`${targetPlayer.name} için 3 kart çekme başladı!`, 'normal');
      this.continueFlipThree();
    }
  }

  // Flip Three Döngüsü
  async continueFlipThree() {
    try {
      this.stateChanged();

      if (this.actionState.flipsRemaining <= 0) {
        this.endFlipThreeAction();
        return;
      }

      const targetPlayer = this.players[this.actionState.targetPlayerId];

      if (!targetPlayer || targetPlayer.status !== 'active') {
        this.endFlipThreeAction();
        return;
      }

      this.actionState.flipsRemaining--;
      await new Promise(resolve => setTimeout(resolve, 800));

      const drawnCard = this.drawCard();
      this.addLog(`${targetPlayer.name} desteden çekti: ${drawnCard.getDisplayName()}`, 'normal');

      this.applyCardToPlayer(targetPlayer, drawnCard, true);
    } catch (e) {
      // Sessizce yutulan async hataları görünür kıl (3 kart çek takılması teşhisi)
      this.addLog(`Hata (3 Kart Çek): ${e.message}`, 'bust');
      console.error('continueFlipThree hatası:', e);
    }
  }

  // Aksiyon Sonlandırma ve Sıradaki Kuyruğu Yönetme
  finishActionAndContinue() {
    // Kuyrukta bekleyen aksiyon varsa (Flip Three sırasında çekilenler) önce o çözülür
    if (this.actionState.pendingActionsQueue && this.actionState.pendingActionsQueue.length > 0) {
      const nextAct = this.actionState.pendingActionsQueue.shift();
      this.gameStatus = 'action_resolution';
      this.actionState = {
        active: true,
        card: nextAct.card,
        sourcePlayerId: nextAct.sourcePlayerId,
        targetPlayerId: null,
        flipsRemaining: 0,
        cardsFlippedThisAction: [],
        pendingActionsQueue: this.actionState.pendingActionsQueue
      };

      this.addLog(`Sıradaki aksiyon kartı kullanılıyor...`, 'normal');
      this.stateChanged();

      // Başka geçerli hedef yoksa otomatik çöz (boş modal / kilitlenmeyi önler)
      if (this.maybeAutoResolveAction()) return;

      if (this.players[nextAct.sourcePlayerId].isAI) {
        setTimeout(() => this.autoResolveAIAction(), 1200);
      }
      return;
    }

    if (this.isInitialDealing) {
      // Aksiyon ilk dağıtım sırasında çıktıysa dağıtıma geri dön
      // (herkes kartını aldıysa resumeInitialDeal startActiveTurns'e geçer; böylece tur doğru oyuncudan başlar)
      this.resumeInitialDeal();
    } else {
      this.gameStatus = 'playing';
      if (this.checkRoundEnd()) {
        this.endRound();
      } else {
        this.moveToNextPlayer();
      }
    }
  }

  endFlipThreeAction() {
    this.addLog(`3 kart çekme tamamlandı.`, 'normal');
    this.actionState.active = false;
    this.finishActionAndContinue();
  }

  // Bağlantısı kopan oyuncuyu oyundan düşürür ve akışın kilitlenmesini önler
  handlePlayerDisconnect(playerId) {
    const player = this.players[playerId];
    if (!player || player.isDisconnected) return;

    player.isDisconnected = true;
    if (player.status === 'active') {
      player.status = 'stayed';
    }
    this.addLog(`${player.name} bağlantısı koptu, oyundan ayrıldı.`, 'bust');

    // Hedef seçimi bekleyen aksiyonun sahibi ayrıldıysa kartı iptal et (modal kilitlenmesin)
    if (this.gameStatus === 'action_resolution' && this.actionState.active &&
        Number(this.actionState.sourcePlayerId) === Number(playerId)) {
      this.discardActionCard(`${this.actionState.card.getDisplayName()} kartı, sahibi ayrıldığı için iptal edildi.`);
      return;
    }

    // Devam eden Flip Three'nin hedefi ayrıldıysa döngü status kontrolünde kendiliğinden sonlanır
    if (this.gameStatus === 'playing' && Number(this.currentPlayerIndex) === Number(playerId)) {
      this.moveToNextPlayer();
    } else {
      this.stateChanged();
    }
  }

  // 5. TUR GEÇİŞLERİ VE TUR SONU KONTROLLERİ
  moveToNextPlayer() {
    if (this.checkRoundEnd()) {
      this.endRound();
      return;
    }

    let nextIndex = this.currentPlayerIndex;
    let loopCount = 0;
    
    do {
      nextIndex = (nextIndex + 1) % this.players.length;
      loopCount++;
    } while (this.players[nextIndex].status !== 'active' && loopCount < this.players.length);

    this.currentPlayerIndex = nextIndex;
    
    this.addLog(`Sıra ${this.getCurrentPlayer().name} oyuncusunda.`, 'normal');
    this.stateChanged();

    if (this.getCurrentPlayer().isAI) {
      setTimeout(() => {
        this.handleAITurn();
      }, 1500);
    }
  }

  checkRoundEnd() {
    const activeCount = this.players.filter(p => p.status === 'active').length;
    return activeCount === 0;
  }

  // TUR SONU PUANLAMA
  endRound() {
    this.gameStatus = 'round_summary';
    this.addLog(`Tur bitti! Skorlar hesaplanıyor...`, 'normal');

    this.players.forEach(p => {
      if (p.status === 'busted') {
        p.roundScore = 0;
        this.addLog(`${p.name} yandığı için bu turda puan alamadı.`, 'bust');
      } else {
        const numSum = p.cards
          .filter(c => c.type === 'number')
          .reduce((sum, c) => sum + c.value, 0);
        
        const hasMultiplier = p.cards.some(c => c.type === 'modifier' && c.value === 'x2');
        let calculated = numSum;
        if (hasMultiplier) {
          calculated = numSum * 2;
        }

        const plusMods = p.cards
          .filter(c => c.type === 'modifier' && c.value !== 'x2')
          .reduce((sum, c) => {
            const val = parseInt(c.value.replace('+', ''));
            return sum + val;
          }, 0);

        calculated += plusMods;

        if (p.isFlipped7) {
          calculated += 15;
        }

        p.roundScore = calculated;
        p.score += p.roundScore;
        
        this.addLog(`${p.name} bu turda ${p.roundScore} puan kazandı! (Toplam: ${p.score})`, 'stay');
      }
    });

    const winners = this.players.filter(p => p.score >= 200);
    
    if (winners.length > 0) {
      const sorted = [...this.players].sort((a, b) => b.score - a.score);
      const topScore = sorted[0].score;
      const topPlayers = this.players.filter(p => p.score === topScore);
      
      if (topPlayers.length === 1) {
        this.gameStatus = 'game_over';
        this.addLog(`Oyun bitti! ${topPlayers[0].name} 200 puanı geçerek şampiyon oldu!`, 'flip7');
      } else {
        this.addLog(`Beraberlik! En yüksek puanı (${topScore}) paylaşan oyuncular için uzatma turu başlıyor...`, 'normal');
        this.roundNumber++;
        this.dealerIndex = (this.dealerIndex + 1) % this.players.length;
      }
    } else {
      this.roundNumber++;
      this.dealerIndex = (this.dealerIndex + 1) % this.players.length;
    }

    this.stateChanged();
  }

  // 6. YAPAY ZEKA MANTIĞI (AI ENGINE)

  getCurrentPlayer() {
    return this.players[this.currentPlayerIndex];
  }

  handleAITurn() {
    if (this.gameStatus !== 'playing') return;
    const ai = this.getCurrentPlayer();
    if (!ai.isAI) return;

    const bustProb = this.calculateBustProbability(ai);
    const roundScore = this.calculateTempRoundScore(ai);
    const uniqueCount = ai.getUniqueNumbersCount();
    
    let riskThreshold = 0.35;
    if (ai.aiPersonality === 'cautious') {
      riskThreshold = 0.25;
    } else if (ai.aiPersonality === 'bold') {
      riskThreshold = 0.50;
    }

    if (ai.hasSecondChance) {
      riskThreshold += 0.25;
    }

    const wantsFlip7 = (uniqueCount === 6 && bustProb < 0.70);
    let chooseHit = true;

    if (ai.cards.length === 0) {
      chooseHit = true;
    } else {
      if (wantsFlip7) {
        chooseHit = true;
        this.addLog(`${ai.name} (AI): Flip 7'ye 1 kart kaldı! Riski göze alıp çekiyor...`, 'normal');
      } else if (bustProb >= riskThreshold) {
        chooseHit = false;
      } else if (roundScore >= 35 && bustProb > 0.15) {
        chooseHit = false;
      }
    }

    if (chooseHit) {
      this.playerHit(ai.id);
    } else {
      this.playerStay(ai.id);
    }
  }

  calculateBustProbability(player) {
    const handNumbers = player.getNumberValues();
    if (handNumbers.length === 0) return 0;

    let matchingCardsInDeck = 0;
    this.deck.cards.forEach(card => {
      if (card.type === 'number' && handNumbers.includes(card.value)) {
        matchingCardsInDeck++;
      }
    });

    const totalDeckCards = this.deck.count();
    if (totalDeckCards === 0) return 0;

    return matchingCardsInDeck / totalDeckCards;
  }

  calculateTempRoundScore(player) {
    const numSum = player.cards
      .filter(c => c.type === 'number')
      .reduce((sum, c) => sum + c.value, 0);
    
    const hasMultiplier = player.cards.some(c => c.type === 'modifier' && c.value === 'x2');
    let score = hasMultiplier ? numSum * 2 : numSum;

    const plusMods = player.cards
      .filter(c => c.type === 'modifier' && c.value !== 'x2')
      .reduce((sum, c) => sum + parseInt(c.value.replace('+', '')), 0);

    score += plusMods;
    return score;
  }

  autoResolveAIAction() {
    if (this.gameStatus !== 'action_resolution') return;
    
    const ai = this.players[this.actionState.sourcePlayerId];
    const card = this.actionState.card;
    const otherActivePlayers = this.players.filter(p => p.id !== ai.id && p.status === 'active');
    
    let targetId = ai.id;

    if (card.value === 'freeze') {
      if (otherActivePlayers.length > 0) {
        let highestScore = -1;
        let selectedTarget = otherActivePlayers[0];
        
        otherActivePlayers.forEach(p => {
          const pScore = this.calculateTempRoundScore(p);
          if (pScore > highestScore) {
            highestScore = pScore;
            selectedTarget = p;
          }
        });
        targetId = selectedTarget.id;
      } else {
        targetId = ai.id;
      }
    }
    else if (card.value === 'flip_three') {
      if (otherActivePlayers.length > 0) {
        let highestRisk = -1;
        let selectedTarget = otherActivePlayers[0];
        
        otherActivePlayers.forEach(p => {
          const risk = this.calculateBustProbability(p) * (p.hasSecondChance ? 0.3 : 1.0);
          if (risk > highestRisk) {
            highestRisk = risk;
            selectedTarget = p;
          }
        });
        targetId = selectedTarget.id;
      } else {
        targetId = ai.id;
      }
    }
    else if (card.value === 'second_chance') {
      // Buraya yalnızca elinde zaten İkinci Şans varken gelinir; kart devredilmek zorundadır
      // (uygun hedef yoksa maybeAutoResolveAction kartı çoktan oyun dışı bırakmıştır)
      const activeWithoutSC = this.players.filter(p => p.id !== ai.id && p.status === 'active' && !p.hasSecondChance);
      if (activeWithoutSC.length > 0) {
        const sorted = [...activeWithoutSC].sort((a, b) => a.score - b.score);
        targetId = sorted[0].id;
      }
    }

    this.resolveAction(targetId);
  }
}
