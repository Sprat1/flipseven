// FLIP 7 - Arayüz İşleme ve Etkileşim Motoru

import { audio } from './audio.js';

export class Flip7UI {
  constructor(game) {
    this.game = game;
    this.prevLogCount = 0;
    this.renderedCardIds = new Set(); // Aynı kartların tekrar tekrar animasyon oynamasını engellemek için

    // DOM Elemanları
    this.dom = {
      app: document.getElementById('app'),
      setupScreen: document.getElementById('setup-screen'),
      gameScreen: document.getElementById('game-screen'),
      playerCountSelect: document.getElementById('player-count'),
      playersSetupList: document.getElementById('players-setup-list'),
      startGameBtn: document.getElementById('start-game-btn'),
      
      roundNum: document.getElementById('round-num'),
      playersBoards: document.getElementById('players-boards'),
      drawDeck: document.getElementById('draw-deck'),
      deckCount: document.getElementById('deck-count'),
      activePlayerName: document.getElementById('active-player-name'),
      turnInstructions: document.getElementById('turn-instructions'),
      hitBtn: document.getElementById('hit-btn'),
      stayBtn: document.getElementById('stay-btn'),
      gameLogs: document.getElementById('game-logs'),
      restartGameBtn: document.getElementById('restart-game-btn'),
      
      targetModal: document.getElementById('target-modal'),
      targetModalTitle: document.getElementById('target-modal-title'),
      targetModalDesc: document.getElementById('target-modal-desc'),
      targetButtons: document.getElementById('target-buttons'),
      
      roundModal: document.getElementById('round-modal'),
      roundSummaryTbody: document.getElementById('round-summary-tbody'),
      nextRoundBtn: document.getElementById('next-round-btn'),
      
      gameOverModal: document.getElementById('game-over-modal'),
      winnerName: document.getElementById('winner-name'),
      winnerScore: document.getElementById('winner-score'),
      totalRounds: document.getElementById('total-rounds'),
      playAgainBtn: document.getElementById('play-again-btn')
    };

    this.initEventListeners();
    this.renderSetupRows();
  }

  // 1. OLAY DİNLEYİCİLERİ (EVENT LISTENERS)
  initEventListeners() {
    // Oyuncu sayısı seçildiğinde kurulum formunu güncelle
    this.dom.playerCountSelect.addEventListener('change', () => this.renderSetupRows());

    // Oyunu Başlat
    this.dom.startGameBtn.addEventListener('click', () => {
      audio.init(); // Ses motorunu ilk tıklamada aktifleştir
      const configs = this.getPlayersSetupConfig();
      this.dom.setupScreen.classList.remove('active');
      this.dom.gameScreen.classList.add('active');
      this.game.setupGame(configs);
    });

    // Kart Çek (Hit)
    this.dom.hitBtn.addEventListener('click', () => {
      this.game.playerHit(this.game.currentPlayerIndex);
    });

    // Pas Geç (Stay)
    this.dom.stayBtn.addEventListener('click', () => {
      this.game.playerStay(this.game.currentPlayerIndex);
    });

    // Desteden Kart Çekme Tıklaması (Görsel Deste)
    this.dom.drawDeck.addEventListener('click', () => {
      const activePlayer = this.game.getCurrentPlayer();
      if (activePlayer && !activePlayer.isAI && this.game.gameStatus === 'playing') {
        this.game.playerHit(this.game.currentPlayerIndex);
      }
    });

    // Ana Menü (Restart)
    this.dom.restartGameBtn.addEventListener('click', () => {
      if (confirm("Mevcut arena savaşını sonlandırıp ana menüye dönmek istediğinden emin misin?")) {
        this.resetToSetup();
      }
    });

    // Yeni Tura Geç
    this.dom.nextRoundBtn.addEventListener('click', () => {
      this.dom.roundModal.classList.remove('active');
      this.game.startRound();
    });

    // Yeniden Oyna
    this.dom.playAgainBtn.addEventListener('click', () => {
      this.dom.gameOverModal.classList.remove('active');
      this.resetToSetup();
    });

    // Oyun durum değişikliklerini dinle
    this.game.onStateChange = (game) => this.render(game);
  }

  // 2. GİRİŞ PANELİ SATIRLARI ÜRETİMİ
  renderSetupRows() {
    const count = parseInt(this.dom.playerCountSelect.value);
    this.dom.playersSetupList.innerHTML = '';

    const defaultNames = ['AI-Nexus', 'AI-Vector', 'AI-Matrix', 'AI-Apex', 'AI-Nova'];

    for (let i = 0; i < count; i++) {
      const row = document.createElement('div');
      row.className = 'player-setup-row';

      const label = document.createElement('span');
      label.textContent = `${i + 1}. Oyuncu:`;

      const input = document.createElement('input');
      input.type = 'text';
      input.value = i === 0 ? 'Sen (Arda)' : defaultNames[i % defaultNames.length];
      input.id = `player-name-${i}`;
      input.maxLength = 15;

      const select = document.createElement('select');
      select.id = `player-type-${i}`;
      
      if (i === 0) {
        select.innerHTML = `
          <option value="human" selected>👤 İnsan (Sen)</option>
        `;
      } else {
        select.innerHTML = `
          <option value="human">👤 İnsan (Paslaş)</option>
          <option value="ai-balanced" selected>💻 AI - Dengeli</option>
          <option value="ai-cautious">💻 AI - Temkinli</option>
          <option value="ai-bold">💻 AI - Cesur</option>
        `;
      }

      row.appendChild(label);
      row.appendChild(input);
      row.appendChild(select);
      this.dom.playersSetupList.appendChild(row);
    }
  }

  // Giriş formundan verileri alıp yapılandırma dizisi oluşturur
  getPlayersSetupConfig() {
    const count = parseInt(this.dom.playerCountSelect.value);
    const configs = [];

    for (let i = 0; i < count; i++) {
      const name = document.getElementById(`player-name-${i}`).value.trim() || `Oyuncu ${i + 1}`;
      const typeVal = document.getElementById(`player-type-${i}`).value;
      
      const isAI = typeVal.startsWith('ai-');
      const personality = isAI ? typeVal.replace('ai-', '') : 'balanced';

      configs.push({ name, isAI, aiPersonality: personality });
    }
    return configs;
  }

  // Kurulum ekranına geri sıfırlama
  resetToSetup() {
    this.dom.gameScreen.classList.remove('active');
    this.dom.setupScreen.classList.add('active');
    this.dom.roundModal.classList.remove('active');
    this.dom.gameOverModal.classList.remove('active');
    this.renderedCardIds.clear();
    this.prevLogCount = 0;
  }

  // 3. ANA GÖRSELLEŞTİRME VE SES REAKSİYONU (RENDER)
  render(game) {
    this.renderHeader(game);
    this.renderPlayersBoards(game);
    this.updateControls(game);
    this.renderLogs(game);
    this.renderModals(game);
    this.triggerSounds(game);
  }

  renderHeader(game) {
    this.dom.roundNum.textContent = game.roundNumber;
    this.dom.deckCount.textContent = game.deck.count();
  }

  // Oyuncu masalarını çizme
  renderPlayersBoards(game) {
    this.dom.playersBoards.innerHTML = '';

    game.players.forEach(p => {
      const box = document.createElement('div');
      box.className = `player-box`;
      if (p.id === game.currentPlayerIndex && game.gameStatus === 'playing') {
        box.classList.add('active');
      }
      if (p.status === 'busted') box.classList.add('busted');
      if (p.status === 'frozen') box.classList.add('frozen');
      if (p.status === 'stayed') box.classList.add('stayed');

      // Bilgi Satırı
      const infoRow = document.createElement('div');
      infoRow.className = 'player-info-row';

      const nameTag = document.createElement('span');
      nameTag.className = 'player-name-tag';
      if (p.isAI) nameTag.classList.add('ai-tag');
      
      const activePrefix = (p.id === game.currentPlayerIndex && game.gameStatus === 'playing') ? '⚡ ' : '';
      nameTag.textContent = `${activePrefix}${p.name}`;

      const scoreSummary = document.createElement('div');
      scoreSummary.className = 'player-score-summary';

      const tempScore = game.calculateTempRoundScore(p);
      const uniqueCount = p.getUniqueNumbersCount();
      
      scoreSummary.innerHTML = `
        <span class="current-sum" title="Mevcut döngü skoru">💰 ${tempScore} (${uniqueCount}/7 Kart)</span>
        <span class="total-bank" title="Bankalanmış toplam puan">🏦 ${p.score} Puan</span>
      `;

      infoRow.appendChild(nameTag);
      
      if (p.hasSecondChance) {
        const scShield = document.createElement('span');
        scShield.className = 'second-chance-shield';
        scShield.textContent = '🛡️ İkinci Şans';
        infoRow.appendChild(scShield);
      }

      infoRow.appendChild(scoreSummary);
      box.appendChild(infoRow);

      // Kart Dağıtımı Satırı
      const cardsRow = document.createElement('div');
      cardsRow.className = 'player-cards-row';

      p.cards.forEach((card, index) => {
        const cardWrapper = document.createElement('div');
        cardWrapper.className = 'card-wrapper';
        
        if (!this.renderedCardIds.has(card.id)) {
          cardWrapper.classList.add('deal-animation');
          cardWrapper.style.animationDelay = `${index * 100}ms`;
          this.renderedCardIds.add(card.id);
        }

        const cardInner = document.createElement('div');
        cardInner.className = 'card-inner';

        // Kartın Arkası
        const cardBack = document.createElement('div');
        cardBack.className = 'card-back';
        cardBack.textContent = '👾';

        // Kartın Önü
        const cardFront = document.createElement('div');
        cardFront.className = `card-front ${card.getStyleClass()}`;

        // Kart İkonu (üst köşe)
        const icon = document.createElement('div');
        icon.className = 'card-icon';
        icon.textContent = card.getDisplayValue();

        // Kart Değeri (orta büyük)
        const value = document.createElement('div');
        
        if (card.type === 'number') {
          value.className = 'card-value';
          value.textContent = card.value;
        } else if (card.type === 'modifier') {
          value.className = 'card-value';
          value.textContent = card.value;
        } else {
          value.className = 'card-value';
          value.textContent = card.getDisplayValue();
        }

        // Kart Başlığı (alt kısım)
        const title = document.createElement('div');
        title.className = 'card-title';
        title.textContent = card.getDisplayName();

        cardFront.appendChild(icon);
        cardFront.appendChild(value);
        cardFront.appendChild(title);

        cardInner.appendChild(cardBack);
        cardInner.appendChild(cardFront);
        cardWrapper.appendChild(cardInner);
        cardsRow.appendChild(cardWrapper);

        setTimeout(() => {
          cardWrapper.classList.add('flipped');
        }, 100);
      });

      box.appendChild(cardsRow);
      this.dom.playersBoards.appendChild(box);
    });
  }

  // Kontrol Butonlarının Güncellenmesi
  updateControls(game) {
    const activePlayer = game.getCurrentPlayer();
    
    if (game.gameStatus === 'playing') {
      this.dom.activePlayerName.textContent = activePlayer.name;

      if (activePlayer.isAI) {
        this.dom.hitBtn.disabled = true;
        this.dom.stayBtn.disabled = true;
        this.dom.turnInstructions.textContent = `💻 Yapay zeka sistem kartlarını analiz ediyor...`;
      } else {
        this.dom.hitBtn.disabled = false;
        this.dom.stayBtn.disabled = activePlayer.cards.length === 0;
        this.dom.turnInstructions.textContent = `⚡ Karar senin! Desteden bir veri kartı çekebilir ya da puanını bankalayıp sıranı devredebilirsin.`;
      }
    } else {
      this.dom.hitBtn.disabled = true;
      this.dom.stayBtn.disabled = true;
      
      if (game.gameStatus === 'dealing') {
        this.dom.activePlayerName.textContent = "Sistem";
        this.dom.turnInstructions.textContent = `🃏 Kartlar dağıtılıyor...`;
      } else if (game.gameStatus === 'action_resolution') {
        const sourceP = game.players[game.actionState.sourcePlayerId];
        this.dom.activePlayerName.textContent = sourceP.name;
        this.dom.turnInstructions.textContent = `🔮 ${sourceP.name} aksiyon kartını çalıştırıyor...`;
      } else {
        this.dom.activePlayerName.textContent = "-";
        this.dom.turnInstructions.textContent = `Sistem beklemede.`;
      }
    }
  }

  // Oyun Günlüklerinin Yazdırılması
  renderLogs(game) {
    this.dom.gameLogs.innerHTML = '';
    const recentLogs = game.logs.slice(0, 50);
    
    recentLogs.forEach(log => {
      const entry = document.createElement('div');
      entry.className = `log-entry ${log.type}`;
      
      const timeStr = log.time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      entry.innerHTML = `<span style="opacity: 0.4;">[${timeStr}]</span> ${log.message}`;
      
      this.dom.gameLogs.appendChild(entry);
    });
  }

  // Modal pencerelerinin kontrolü
  renderModals(game) {
    // A) HEDEF SEÇİM MODALİ (TARGET MODAL)
    if (game.gameStatus === 'action_resolution' && game.actionState.active) {
      const sourcePlayer = game.players[game.actionState.sourcePlayerId];
      const card = game.actionState.card;

      this.dom.targetModalTitle.textContent = `🔮 Kart Çözümlemesi: ${card.getDisplayName()}`;
      
      if (card.value === 'freeze') {
        this.dom.targetModalDesc.textContent = `${sourcePlayer.name}, hangi rakibinin erişim kanalını kilitlemek (dondurmak) istersin?`;
      } else if (card.value === 'flip_three') {
        this.dom.targetModalDesc.textContent = `${sourcePlayer.name}, veri testi (3 kart çekme) işlemine hangi oyuncuyu sokmak istersin?`;
      } else if (card.value === 'second_chance') {
        this.dom.targetModalDesc.textContent = `${sourcePlayer.name}, bu İkinci Şans koruma kartını kime yönlendirmek istersin? (Kendine de verebilirsin)`;
      }

      this.dom.targetButtons.innerHTML = '';

      game.players.forEach(p => {
        if ((card.value === 'freeze' || card.value === 'flip_three')) {
          const activeRivals = game.players.filter(x => x.id !== sourcePlayer.id && x.status === 'active');
          if (activeRivals.length > 0 && p.id === sourcePlayer.id) return;
          if (p.status !== 'active') return;
        }
        
        if (card.value === 'second_chance' && p.hasSecondChance) {
          const anyoneWithoutSC = game.players.some(x => x.status === 'active' && !x.hasSecondChance);
          if (anyoneWithoutSC) return; 
        }

        const btn = document.createElement('button');
        btn.className = 'cyber-btn primary';
        btn.textContent = p.id === sourcePlayer.id ? `Kendim (${p.name})` : p.name;
        
        if (sourcePlayer.isAI) {
          btn.disabled = true;
        }

        btn.addEventListener('click', () => {
          game.resolveAction(p.id);
        });

        this.dom.targetButtons.appendChild(btn);
      });

      this.dom.targetModal.classList.add('active');
    } else {
      this.dom.targetModal.classList.remove('active');
    }

    // B) TUR RAPORU MODALİ (ROUND SUMMARY MODAL)
    if (game.gameStatus === 'round_summary') {
      this.dom.roundSummaryTbody.innerHTML = '';
      
      game.players.forEach(p => {
        const tr = document.createElement('tr');
        
        const tdName = document.createElement('td');
        tdName.style.fontWeight = 'bold';
        tdName.style.color = '#fff';
        tdName.textContent = p.name;

        const tdCards = document.createElement('td');
        tdCards.textContent = p.cards.map(c => `${c.getDisplayName()}(${c.getDisplayValue()})`).join(', ') || 'Kart yüklenmedi';

        const tdRoundScore = document.createElement('td');
        tdRoundScore.style.fontWeight = 'bold';
        tdRoundScore.style.color = 'var(--neon-blue)';
        tdRoundScore.textContent = p.status === 'busted' ? '💥 0' : `${p.roundScore} Puan`;

        const tdTotalScore = document.createElement('td');
        tdTotalScore.textContent = `${p.score} Puan`;

        const tdStatus = document.createElement('td');
        if (p.status === 'busted') {
          tdStatus.innerHTML = '<span style="color:var(--neon-red);font-weight:bold;">⚡ Busted (Hata)</span>';
        } else if (p.isFlipped7) {
          tdStatus.innerHTML = '<span style="color:var(--neon-yellow);font-weight:bold;">🌈 Flip 7 (+15)</span>';
        } else if (p.status === 'frozen') {
          tdStatus.innerHTML = '<span style="color:var(--neon-blue);font-weight:bold;">❄️ Kilitlendi</span>';
        } else {
          tdStatus.innerHTML = '<span style="color:var(--neon-green);font-weight:bold;">🛡️ Pas Geçti</span>';
        }

        tr.appendChild(tdName);
        tr.appendChild(tdCards);
        tr.appendChild(tdRoundScore);
        tr.appendChild(tdTotalScore);
        tr.appendChild(tdStatus);

        this.dom.roundSummaryTbody.appendChild(tr);
      });

      this.dom.roundModal.classList.add('active');
    } else {
      this.dom.roundModal.classList.remove('active');
    }

    // C) OYUN BİTTİ MODALİ (GAME OVER MODAL)
    if (game.gameStatus === 'game_over') {
      const sorted = [...game.players].sort((a, b) => b.score - a.score);
      const winner = sorted[0];

      this.dom.winnerName.textContent = winner.name;
      this.dom.winnerScore.textContent = winner.score;
      this.dom.totalRounds.textContent = game.roundNumber;

      this.dom.gameOverModal.classList.add('active');
    } else {
      this.dom.gameOverModal.classList.remove('active');
    }
  }

  // 4. SES SENTEZLEME TETİKLEME (REACTIVE AUDIO SYSTEM)
  triggerSounds(game) {
    if (game.logs.length > this.prevLogCount) {
      const latestLog = game.logs[0];
      
      if (latestLog) {
        if (latestLog.type === 'bust') {
          audio.playBust();
          document.body.classList.add('shake-screen');
          setTimeout(() => {
            document.body.classList.remove('shake-screen');
          }, 400);
        } else if (latestLog.type === 'freeze') {
          audio.playFreeze();
        } else if (latestLog.type === 'flip7') {
          audio.playFlip7();
        } else if (latestLog.type === 'stay') {
          audio.playStay();
        } else if (latestLog.message.includes('veri kartı yükledi') || latestLog.message.includes('başlangıç verisi olarak')) {
          audio.playFlip();
        }
      }
      this.prevLogCount = game.logs.length;
    }
  }
}
export default Flip7UI;
