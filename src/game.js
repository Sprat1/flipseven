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
  }

  // Tur başında oyuncu durumunu sıfırlar
  resetRoundState() {
    this.cards = [];
    this.hasSecondChance = false;
    this.status = 'active';
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
    this.roundNumber = 1;
    this.dealerIndex = 0;
    this.logs = [];
    
    this.addLog("🚀 Flip 7 Arena protokolü başlatıldı! Sistem aktif.", 'normal');
    this.startRound();
  }

  // 2. YENİ TUR BAŞLATMA
  startRound() {
    this.gameStatus = 'dealing';
    this.deck.reset();
    this.deck.shuffle();
    
    this.players.forEach(p => p.resetRoundState());
    this.actionState.active = false;
    this.actionState.pendingActionsQueue = [];

    this.addLog(`🛰️ Döngü ${this.roundNumber} başladı! Veri kartları aktarılıyor...`, 'normal');
    this.stateChanged();

    // İlk dağıtım döngüsü (Sırayla 1'er kart dağıtılır)
    this.runInitialDeal();
  }

  // İlk dağıtımı asenkron veya adımsal yöneten fonksiyon
  async runInitialDeal() {
    let dealIndex = (this.dealerIndex + 1) % this.players.length;
    
    for (let i = 0; i < this.players.length; i++) {
      const player = this.players[dealIndex];
      const card = this.deck.draw();
      player.cards.push(card);
      
      this.addLog(`${player.name} başlangıç verisi olarak ${card.getDisplayName()} (${card.getDisplayValue()}) kartını aldı.`, 'normal');
      this.stateChanged();

      // second_chance dağıtımda direkt uygulanır
      if (card.type === 'action' && card.value === 'second_chance') {
        player.hasSecondChance = true;
        this.addLog(`🛡️ ${player.name} başlangıç verisi olarak İkinci Şans kalkanını aldı, otomatik aktif edildi!`, 'normal');
        this.stateChanged();
      }
      // Diğer aksiyon kartları dağıtımı durdurur ve çözüm bekler
      else if (card.type === 'action') {
        this.addLog(`🚨 Dağıtım sırasında aksiyon tetiklendi! ${player.name} aksiyon kartını çalıştırıyor.`, 'normal');
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
      if (player.cards.length === 0) {
        const card = this.deck.draw();
        player.cards.push(card);
        this.addLog(`${player.name} başlangıç verisi olarak ${card.getDisplayName()} (${card.getDisplayValue()}) kartını aldı.`, 'normal');
        this.stateChanged();

        if (card.type === 'action' && card.value === 'second_chance') {
          player.hasSecondChance = true;
          this.addLog(`🛡️ ${player.name} başlangıç verisi olarak İkinci Şans kalkanını aldı, otomatik aktif edildi!`, 'normal');
          this.stateChanged();
        } else if (card.type === 'action') {
          this.addLog(`🚨 Dağıtım sırasında aksiyon tetiklendi! ${player.name} aksiyon kartını çalıştırıyor.`, 'normal');
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
    const card = this.deck.draw();
    
    this.addLog(`${player.name} veri kartı yükledi: ${card.getDisplayName()} (${card.getDisplayValue()})`, 'normal');
    
    this.applyCardToPlayer(player, card);
  }

  // PAS GEÇME (STAY)
  playerStay(playerId) {
    if (this.gameStatus !== 'playing') return;
    if (this.currentPlayerIndex !== playerId) return;

    const player = this.players[playerId];
    player.status = 'stayed';
    
    this.addLog(`${player.name} pas geçerek mevcut veri skorunu kasaya kaydetti.`, 'stay');
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
          
          this.addLog(`🛡️ İkinci Şans koruma kalkanı devrede! ${player.name} sistem hatasından kurtuldu. Çift veri (${card.value}) ve kalkan kartı silindi.`, 'stay');
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
          this.addLog(`⚡ CRITICAL ERROR // BUSTED! ${player.name} aynı sayı rününü (${card.value}) tekrar yükledi ve elendi!`, 'bust');
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
        this.addLog(`🌈 MATRIX ALIGNED // FLIP 7! ${player.name} yanmadan 7 benzersiz kart topladı! Döngü sonlandırılıyor.`, 'flip7');
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
      if (card.value === 'second_chance') {
        player.hasSecondChance = true;
        this.addLog(`${player.name} koruyucu İkinci Şans kalkanını aktif etti.`, 'normal');
        this.stateChanged();
        if (isFlipThreeStep) {
          this.continueFlipThree();
        } else {
          this.moveToNextPlayer();
        }
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
      this.addLog(`🔮 ${sourcePlayer.name} test çektirmesi sırasında başka bir aksiyon kartı (${card.getDisplayName()}) tetikledi, kuyruğa alındı.`, 'normal');
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
    
    this.addLog(`🔮 ${sourcePlayer.name} aksiyon kartı tetikledi: ${card.getDisplayName()}. Hedef taranıyor...`, 'normal');
    this.stateChanged();

    if (sourcePlayer.isAI) {
      setTimeout(() => {
        this.autoResolveAIAction();
      }, 1200);
    }
  }

  // 4. AKSİYON ÇÖZÜMLEME (RESOLVE ACTION)
  resolveAction(targetPlayerId) {
    if (this.gameStatus !== 'action_resolution') return;
    
    const sourcePlayer = this.players[this.actionState.sourcePlayerId];
    const targetPlayer = this.players[targetPlayerId];
    const card = this.actionState.card;
    
    this.actionState.targetPlayerId = targetPlayerId;
    this.addLog(`🔮 ${sourcePlayer.name}, ${card.getDisplayName()} kartını ${targetPlayer.name} üzerinde çalıştırıyor.`, 'normal');

    // A) FREEZE (DONDURMA)
    if (card.value === 'freeze') {
      targetPlayer.status = 'frozen';
      this.addLog(`❄️ ${targetPlayer.name} kilitlendi! Bu tur artık veri yükleyemez, puanı kilitlendi.`, 'freeze');
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
      
      this.addLog(`🛡️ ${sourcePlayer.name}, İkinci Şans koruma kartını ${targetPlayer.name} adlı oyuncuya transfer etti!`, 'normal');
      this.actionState.active = false;
      
      this.finishActionAndContinue();
    }
    
    // C) FLIP THREE (3 KART ÇEKTİRME)
    else if (card.value === 'flip_three') {
      this.actionState.flipsRemaining = 3;
      this.actionState.active = false; // Hedef seçildiği için modal penceresini kapatıyoruz
      this.addLog(`⚔️ ${targetPlayer.name} için 3 kart çekme testi başlatıldı!`, 'normal');
      this.continueFlipThree();
    }
  }

  // Flip Three Döngüsü
  async continueFlipThree() {
    this.stateChanged();
    
    if (this.actionState.flipsRemaining <= 0) {
      this.endFlipThreeAction();
      return;
    }

    const targetPlayer = this.players[this.actionState.targetPlayerId];
    
    if (targetPlayer.status !== 'active') {
      this.endFlipThreeAction();
      return;
    }

    this.actionState.flipsRemaining--;
    await new Promise(resolve => setTimeout(resolve, 800));
    
    const drawnCard = this.deck.draw();
    this.addLog(`⚔️ (Test Yüklemesi) ${targetPlayer.name} desteden çekti: ${drawnCard.getDisplayName()} (${drawnCard.getDisplayValue()})`, 'normal');
    
    this.applyCardToPlayer(targetPlayer, drawnCard, true);
  }

  // Flip Three Aksiyonunu Sonlandırma ve Sıradaki Kuyruğu Yönetme
  finishActionAndContinue() {
    if (this.players.some(p => p.cards.length === 0)) {
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
    this.addLog(`⚔️ Veri yükleme testi tamamlandı.`, 'normal');
    
    if (this.actionState.pendingActionsQueue.length > 0) {
      const nextAct = this.actionState.pendingActionsQueue.shift();
      this.actionState = {
        active: true,
        card: nextAct.card,
        sourcePlayerId: nextAct.sourcePlayerId,
        targetPlayerId: null,
        flipsRemaining: 0,
        cardsFlippedThisAction: [],
        pendingActionsQueue: this.actionState.pendingActionsQueue
      };
      
      this.addLog(`🔮 Kuyruktaki sıradaki aksiyon kartı çalıştırılıyor...`, 'normal');
      this.stateChanged();
      
      if (this.players[nextAct.sourcePlayerId].isAI) {
        setTimeout(() => this.autoResolveAIAction(), 1200);
      }
    } else {
      this.actionState.active = false;
      this.finishActionAndContinue();
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
    this.addLog(`🛰️ Döngü sonu! Veri skorları hesaplanıyor...`, 'normal');

    this.players.forEach(p => {
      if (p.status === 'busted') {
        p.roundScore = 0;
        this.addLog(`❌ ${p.name} hata (Bust) aldığı için bu el skor alamadı.`, 'bust');
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
        
        this.addLog(`🏅 ${p.name} bu döngüde ${p.roundScore} puan kazandı! (Toplam: ${p.score})`, 'stay');
      }
    });

    const winners = this.players.filter(p => p.score >= 200);
    
    if (winners.length > 0) {
      const sorted = [...this.players].sort((a, b) => b.score - a.score);
      const topScore = sorted[0].score;
      const topPlayers = this.players.filter(p => p.score === topScore);
      
      if (topPlayers.length === 1) {
        this.gameStatus = 'game_over';
        this.addLog(`🏆 ARENA TAMAMLANDI! ${topPlayers[0].name} efsanevi 200 puan sınırını aşarak Arena Şampiyonu oldu!`, 'flip7');
      } else {
        this.addLog(`⚔️ Eşitlik var! En yüksek puanı (${topScore}) paylaşan kahramanlar arasında uzatma turu başlatılıyor...`, 'normal');
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
        this.addLog(`💻 AI Analizi (${ai.name}): Matrix hizalanmasına 1 kart kaldı! Riske girip son kartı deniyor...`, 'normal');
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
      if (!ai.hasSecondChance) {
        targetId = ai.id;
      } else {
        const activeWithoutSC = this.players.filter(p => p.status === 'active' && !p.hasSecondChance);
        if (activeWithoutSC.length > 0) {
          const sorted = [...activeWithoutSC].sort((a, b) => a.score - b.score);
          targetId = sorted[0].id;
        } else {
          targetId = ai.id;
        }
      }
    }

    this.resolveAction(targetId);
  }
}
