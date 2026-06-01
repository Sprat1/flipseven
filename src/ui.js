// FLIP 7 - Arayüz İşleme ve Etkileşim Motoru

import { audio } from './audio.js';

export class Flip7UI {
  constructor(game) {
    this.game = game;
    this.network = null; // main.js tarafından sonradan atanacak
    this.prevLogCount = 0;
    this.renderedCardIds = new Set();

    // DOM Elemanları
    this.dom = {
      app: document.getElementById('app'),
      setupScreen: document.getElementById('setup-screen'),
      gameScreen: document.getElementById('game-screen'),
      playerCountSelect: document.getElementById('player-count'),
      playersSetupList: document.getElementById('players-setup-list'),
      startGameBtn: document.getElementById('start-game-btn'),
      
      // Çevrimiçi Sekme ve Panelleri
      tabLocalBtn: document.getElementById('tab-local-btn'),
      tabOnlineBtn: document.getElementById('tab-online-btn'),
      panelLocal: document.getElementById('panel-local'),
      panelOnline: document.getElementById('panel-online'),
      
      // Online Kurulum Elemanları
      hostNick: document.getElementById('host-nick'),
      createRoomBtn: document.getElementById('create-room-btn'),
      joinNick: document.getElementById('join-nick'),
      joinRoomId: document.getElementById('join-room-id'),
      joinRoomBtn: document.getElementById('join-room-btn'),
      
      // Lobi Elemanları
      lobbyContainer: document.getElementById('lobby-container'),
      lobbyRoomCode: document.getElementById('lobby-room-code'),
      copyCodeBtn: document.getElementById('copy-code-btn'),
      connectionStatusText: document.getElementById('connection-status-text'),
      lobbyPlayerCount: document.getElementById('lobby-player-count'),
      lobbyPlayersList: document.getElementById('lobby-players-list'),
      hostOnlyControls: document.getElementById('host-only-controls'),
      lobbyAiCount: document.getElementById('lobby-ai-count'),
      startOnlineGameBtn: document.getElementById('start-online-game-btn'),
      clientWaitingText: document.getElementById('client-waiting-text'),
      
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
    // Sekmeler arası geçiş
    this.dom.tabLocalBtn.addEventListener('click', () => this.switchTab('local'));
    this.dom.tabOnlineBtn.addEventListener('click', () => this.switchTab('online'));

    // Oyuncu sayısı seçildiğinde yerel kurulum formunu güncelle
    this.dom.playerCountSelect.addEventListener('change', () => this.renderSetupRows());

    // Yerel Oyunu Başlat
    this.dom.startGameBtn.addEventListener('click', () => {
      audio.init();
      const configs = this.getPlayersSetupConfig();
      this.dom.setupScreen.classList.remove('active');
      this.dom.gameScreen.classList.add('active');
      document.getElementById('online-badge').style.display = 'none';
      this.game.setupGame(configs);
    });

    // --- ONLINE İŞLEMLERİ ---
    
    // Oda Oluştur
    this.dom.createRoomBtn.addEventListener('click', () => {
      const nick = this.dom.hostNick.value.trim() || 'HostArda';
      audio.init();
      this.dom.createRoomBtn.disabled = true;
      this.dom.joinRoomBtn.disabled = true;
      this.network.createRoom(nick);
    });

    // Odaya Katıl
    this.dom.joinRoomBtn.addEventListener('click', () => {
      const nick = this.dom.joinNick.value.trim() || 'Misafir';
      const code = this.dom.joinRoomId.value.trim();
      if (!code) {
        alert("Lütfen bir oda kodu girin!");
        return;
      }
      audio.init();
      this.dom.createRoomBtn.disabled = true;
      this.dom.joinRoomBtn.disabled = true;
      this.network.joinRoom(nick, code);
    });

    // Oda Kodunu Kopyala
    this.dom.copyCodeBtn.addEventListener('click', () => {
      const code = this.dom.lobbyRoomCode.textContent;
      if (code && code !== '-') {
        navigator.clipboard.writeText(code);
        alert("Oda kodu panoya kopyalandı: " + code);
      }
    });

    // Çevrimiçi Oyunu Başlat (Sadece Host)
    this.dom.startOnlineGameBtn.addEventListener('click', () => {
      const aiCount = parseInt(this.dom.lobbyAiCount.value);
      this.network.startOnlineGame(aiCount);
    });

    // --- OYUN İÇİ HAMLELERİ ---

    // Kart Çek (Hit)
    this.dom.hitBtn.addEventListener('click', () => {
      if (this.isOnlineGame()) {
        this.network.sendHit();
      } else {
        this.game.playerHit(this.game.currentPlayerIndex);
      }
    });

    // Pas Geç (Stay)
    this.dom.stayBtn.addEventListener('click', () => {
      if (this.isOnlineGame()) {
        this.network.sendStay();
      } else {
        this.game.playerStay(this.game.currentPlayerIndex);
      }
    });

    // Desteden Kart Çekme Tıklaması
    this.dom.drawDeck.addEventListener('click', () => {
      if (this.isOnlineGame()) {
        if (this.isMyTurn() && this.game.gameStatus === 'playing') {
          this.network.sendHit();
        }
      } else {
        const activePlayer = this.game.getCurrentPlayer();
        if (activePlayer && !activePlayer.isAI && this.game.gameStatus === 'playing') {
          this.game.playerHit(this.game.currentPlayerIndex);
        }
      }
    });

    // Ana Menü (Restart)
    this.dom.restartGameBtn.addEventListener('click', () => {
      if (confirm("Mevcut arenayı sonlandırıp ana menüye dönmek istediğinden emin misin?")) {
        if (this.isOnlineGame() && this.network.peer) {
          this.network.peer.destroy();
        }
        this.resetToSetup();
      }
    });

    // Yeni Tura Geç
    this.dom.nextRoundBtn.addEventListener('click', () => {
      this.dom.roundModal.classList.remove('active');
      if (this.isOnlineGame()) {
        if (this.network.isHost) {
          this.game.startRound();
          this.network.broadcastGameState();
        }
      } else {
        this.game.startRound();
      }
    });

    // Yeniden Oyna
    this.dom.playAgainBtn.addEventListener('click', () => {
      this.dom.gameOverModal.classList.remove('active');
      if (this.isOnlineGame() && this.network.peer) {
        this.network.peer.destroy();
      }
      this.resetToSetup();
    });

    // Local oyun durumunu bağla
    this.game.onStateChange = (game) => this.render(game);
  }

  // Çevrimiçi oyun mu kontrolü
  isOnlineGame() {
    return this.network && this.network.peer && !this.network.peer.destroyed;
  }

  // Hamle sırası bende mi kontrolü
  isMyTurn(activeGame) {
    const game = activeGame || this.game;
    if (!this.isOnlineGame()) return true;
    if (this.network.isHost) {
      return Number(game.currentPlayerIndex) === 0;
    } else {
      return Number(game.currentPlayerIndex) === Number(this.network.myPlayerId);
    }
  }

  // Sekmeler Arası Geçiş
  switchTab(tab) {
    if (tab === 'local') {
      this.dom.tabLocalBtn.classList.add('active');
      this.dom.tabOnlineBtn.classList.remove('active');
      this.dom.panelLocal.classList.add('active');
      this.dom.panelOnline.classList.remove('active');
    } else {
      this.dom.tabLocalBtn.classList.remove('active');
      this.dom.tabOnlineBtn.classList.add('active');
      this.dom.panelLocal.classList.remove('active');
      this.dom.panelOnline.classList.add('active');
    }
  }

  // Lobi Ekranını Güncelleme
  updateLobby(roomCode, players, isHost) {
    this.dom.lobbyContainer.style.display = 'block';
    
    // Aynı ekrandan tekrar oda açmayı/katılmayı engellemek için form alanını gizliyoruz
    const setupGrid = document.querySelector('.online-setup-grid');
    if (setupGrid) setupGrid.style.display = 'none';

    this.dom.lobbyRoomCode.textContent = roomCode;
    this.dom.lobbyPlayerCount.textContent = players.length;
    this.dom.lobbyPlayersList.innerHTML = '';

    players.forEach(p => {
      const tag = document.createElement('div');
      tag.className = 'lobby-player-tag';
      
      const isMe = (isHost && p.id === 0) || (!isHost && p.id === this.network.myPlayerId);
      
      if (p.isHost) tag.classList.add('host');
      if (isMe) tag.classList.add('me');

      const nameSpan = document.createElement('span');
      nameSpan.textContent = p.name + (isMe ? ' (Sen)' : '');

      const badge = document.createElement('span');
      badge.className = 'badge';
      badge.textContent = p.isHost ? 'HOST' : 'PLAYER';

      tag.appendChild(nameSpan);
      tag.appendChild(badge);
      this.dom.lobbyPlayersList.appendChild(tag);
    });

    if (isHost) {
      this.dom.hostOnlyControls.style.display = 'flex';
      this.dom.clientWaitingText.style.display = 'none';
      // En az 2 oyuncu olunca oyunu başlatma aktifleşir
      this.dom.startOnlineGameBtn.disabled = players.length < 2;
    } else {
      this.dom.hostOnlyControls.style.display = 'none';
      this.dom.clientWaitingText.style.display = 'block';
    }
  }

  // 2. GİRİŞ PANELİ SATIRLARI ÜRETİMİ (LOCAL)
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

  resetToSetup() {
    this.dom.gameScreen.classList.remove('active');
    this.dom.setupScreen.classList.add('active');
    this.dom.roundModal.classList.remove('active');
    this.dom.gameOverModal.classList.remove('active');
    this.dom.lobbyContainer.style.display = 'none';
    
    // Kurulum formunu ve kilitli butonları sıfırla
    const setupGrid = document.querySelector('.online-setup-grid');
    if (setupGrid) setupGrid.style.display = 'grid';
    this.dom.createRoomBtn.disabled = false;
    this.dom.joinRoomBtn.disabled = false;
    
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
      
      // Online modda diğer oyuncuların adının sonuna (Siz) veya (AI) ekleyelim
      let suffix = '';
      if (this.isOnlineGame()) {
        const isMe = (this.network.isHost && Number(p.id) === 0) || (!this.network.isHost && Number(p.id) === Number(this.network.myPlayerId));
        if (isMe) suffix = ' (Sen)';
      }
      
      nameTag.textContent = `${activePrefix}${p.name}${suffix}`;

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
        // Çevrimiçi oyun kontrolü
        if (this.isOnlineGame()) {
          const isMyTurn = this.isMyTurn(game);
          this.dom.hitBtn.disabled = !isMyTurn;
          this.dom.stayBtn.disabled = !isMyTurn || activePlayer.cards.length === 0;
          
          if (isMyTurn) {
            this.dom.turnInstructions.textContent = `⚡ SIRA SENDE! Desteden bir veri kartı çekebilir ya da puanını bankalayabilirsin.`;
          } else {
            this.dom.turnInstructions.textContent = `🛰️ Sıra ${activePlayer.name} adlı oyuncuda. Hamlesi bekleniyor...`;
          }
        } else {
          // Yerel Oyun
          this.dom.hitBtn.disabled = false;
          this.dom.stayBtn.disabled = activePlayer.cards.length === 0;
          this.dom.turnInstructions.textContent = `⚡ Karar senin! Desteden bir veri kartı çekebilir ya da puanını bankalayıp sıranı devredebilirsin.`;
        }
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
        
        if (game.actionState && game.actionState.flipsRemaining > 0) {
          const targetP = game.players[game.actionState.targetPlayerId];
          this.dom.turnInstructions.textContent = `⚔️ ${sourceP.name}, ${targetP.name} adlı oyuncuya 3 kart çektiriyor (${game.actionState.flipsRemaining} kart kaldı)...`;
        } else {
          if (this.isOnlineGame()) {
            const sourceId = Number(game.actionState.sourcePlayerId);
            const myId = Number(this.network.myPlayerId);
            const isMyAction = (this.network.isHost && sourceId === 0) || 
                               (!this.network.isHost && sourceId === myId);
            if (isMyAction) {
              this.dom.turnInstructions.textContent = `🔮 AKSİYON KARTI ÇEKTİN! Ekrana gelen modal pencereden bir hedef seçmelisin.`;
            } else {
              this.dom.turnInstructions.textContent = `🔮 ${sourceP.name} aksiyon kartını çalıştırıyor. Hedef seçmesi bekleniyor...`;
            }
          } else {
            this.dom.turnInstructions.textContent = `🔮 ${sourceP.name} aksiyon kartını çalıştırıyor...`;
          }
        }
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

      // Sıranın bende olup olmadığını kontrol et
      let isMyAction = true;
      if (this.isOnlineGame()) {
        const sourceId = Number(game.actionState.sourcePlayerId);
        const myId = Number(this.network.myPlayerId);
        isMyAction = (this.network.isHost && sourceId === 0) || 
                     (!this.network.isHost && sourceId === myId);
      }

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
        
        // Eğer aksiyon benim değilse veya AI ise butonları kilitliyoruz
        if (sourcePlayer.isAI || !isMyAction) {
          btn.disabled = true;
        }

        btn.addEventListener('click', () => {
          if (this.isOnlineGame()) {
            this.network.sendResolveAction(p.id);
          } else {
            game.resolveAction(p.id);
          }
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
      
      // Sadece host tura geçebilir butonu aktif olur online'da
      if (this.isOnlineGame()) {
        this.dom.nextRoundBtn.disabled = !this.network.isHost;
        this.dom.nextRoundBtn.textContent = this.network.isHost ? 'Sıradaki Tura Geç' : 'Oda Kurucu Bekleniyor...';
      } else {
        this.dom.nextRoundBtn.disabled = false;
        this.dom.nextRoundBtn.textContent = 'Sıradaki Tura Geç';
      }

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
        if (latestLog.type === 'down' || latestLog.type === 'bust') {
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
