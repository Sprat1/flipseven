// FLIP 7 - P2P Ağ İletişim Yöneticisi (WebRTC / PeerJS)

export class NetworkManager {
  constructor(game, ui) {
    this.game = game;
    this.ui = ui;
    
    this.peer = null;
    this.isHost = false;
    this.roomId = null; // Gösterilecek kısa oda kodu (örn: X9Y2)
    this.peerId = null;  // PeerJS'in bağlandığı tam ID (flip7-arena-X9Y2)
    this.myNick = '';
    this.myPlayerId = null; // Client ise, Host tarafından atanan id
    
    this.connections = []; // Host için: tüm bağlanan istemciler
    this.hostConn = null;  // Client için: host ile olan tek bağlantı
    
    // Lobi oyuncu listesi
    this.lobbyPlayers = [];

    // Katılım (join) için bağlantı zaman aşımı zamanlayıcısı
    this.connectTimeout = null;

    this.statusCallback = () => {};

    // PeerJS / WebRTC ICE yapılandırması.
    // Varsayılan PeerJS TURN'ü yalnızca UDP 3478 kullanır; kurumsal güvenlik
    // duvarları bunu engeller. TCP/443 ve TLS üzerinden TURN ekleyerek kısıtlı
    // ağlarda da bağlantı kurulabilmesini sağlıyoruz.
    // Not: openrelay ücretsiz/genel bir TURN servisidir; üretimde kendi TURN
    // sunucunuzu kullanmanız daha güvenilir olur.
    this.peerConfig = {
      config: {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:openrelay.metered.ca:80' },
          { urls: 'turn:openrelay.metered.ca:80', username: 'openrelayproject', credential: 'openrelayproject' },
          { urls: 'turn:openrelay.metered.ca:443', username: 'openrelayproject', credential: 'openrelayproject' },
          { urls: 'turn:openrelay.metered.ca:443?transport=tcp', username: 'openrelayproject', credential: 'openrelayproject' }
        ]
      }
    };
  }

  setStatus(text, badgeClass) {
    this.statusCallback(text, badgeClass);
  }

  // Oda kodu üretir (4 haneli rastgele büyük harf ve sayılar)
  generateRoomCode() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 4; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  }

  // 1. ODA OLUŞTURMA (HOST)
  createRoom(nick) {
    this.isHost = true;
    this.myNick = nick;
    this.roomId = this.generateRoomCode();
    this.peerId = `flip7-arena-${this.roomId}`;
    this.connections = [];
    
    this.lobbyPlayers = [{ id: 0, name: nick, isHost: true, peerId: this.peerId }];
    
    this.setStatus("Ağ sunucusuna bağlanılıyor...", "connecting");
    
    // PeerJS İstemcisi Başlatılıyor
    this.peer = new Peer(this.peerId, this.peerConfig);
    
    this.peer.on('open', (id) => {
      this.setStatus("Lobi Aktif / Bağlantı Hazır", "online");
      this.ui.updateLobby(this.roomId, this.lobbyPlayers, true);
    });

    this.peer.on('error', (err) => {
      console.error("PeerJS Hatası:", err);
      if (err.type === 'unavailable-id') {
        // Eğer bu ID kullanılıyorsa tekrar dene
        this.createRoom(nick);
      } else {
        alert("Bağlantı Hatası: " + err.message);
        this.setStatus("Hata oluştu", "offline");
        // Butonları tekrar aktif et
        this.ui.dom.createRoomBtn.disabled = false;
        this.ui.dom.joinRoomBtn.disabled = false;
      }
    });

    // İstemcilerin bağlantı isteklerini dinle
    this.peer.on('connection', (conn) => {
      this.handleIncomingConnection(conn);
    });
  }

  handleIncomingConnection(conn) {
    conn.on('open', () => {
      // Bağlantı açıldığında paketleri dinle
      conn.on('data', (data) => {
        this.handleHostReceivedData(conn, data);
      });
    });

    conn.on('close', () => {
      this.handleConnectionDisconnect(conn);
    });
    
    conn.on('error', (err) => {
      console.error("Bağlantı hatası:", err);
      this.handleConnectionDisconnect(conn);
    });
  }

  // Host'un gelen verileri işlediği kısım
  handleHostReceivedData(conn, data) {
    // A) OYUNA KATILMA İSTEĞİ (JOIN)
    if (data.type === 'JOIN') {
      // Oyun başladıktan sonra katılım kabul edilmez
      if (this.game.gameStatus !== 'setup') {
        conn.send({ type: 'JOIN_REJECT', message: 'Oyun çoktan başladı. Bu odaya şu an katılamazsınız.' });
        setTimeout(() => conn.close(), 300);
        return;
      }

      if (this.lobbyPlayers.length >= 5) {
        conn.send({ type: 'JOIN_REJECT', message: 'Lobi dolu (Maksimum 5 oyuncu).' });
        setTimeout(() => conn.close(), 300);
        return;
      }

      // Nick çakışmasını önle (aynı isimli iki oyuncu kafa karışıklığı yaratır)
      const baseName = (data.name || 'Misafir').toString().trim().substring(0, 15) || 'Misafir';
      let uniqueName = baseName;
      let suffix = 2;
      while (this.lobbyPlayers.some(p => p.name === uniqueName)) {
        uniqueName = `${baseName} ${suffix++}`;
      }

      // Oyuncuyu lobiye ekle
      const newPlayerId = this.lobbyPlayers.length;
      const newPlayer = {
        id: newPlayerId,
        name: uniqueName,
        isHost: false,
        peerId: conn.peer
      };

      this.lobbyPlayers.push(newPlayer);
      this.connections.push({ conn, playerId: newPlayerId, name: uniqueName });

      // Onay, oyuncu id'sini ve (gerekirse tekilleştirilmiş) ismi gönder
      conn.send({
        type: 'JOIN_ACK',
        playerId: newPlayerId,
        yourName: uniqueName,
        hostName: this.myNick
      });

      this.game.addLog(`${uniqueName} odaya bağlandı.`, 'normal');

      // Herkese lobi güncellemesini broadcast et
      this.broadcastLobbyUpdate();
    }

    // B) OYUNCU HAMLESİ (ACTION)
    else if (data.type === 'ACTION') {
      // Oyuncu kimliği client beyanına değil, bağlantı eşlemesine göre belirlenir
      const sender = this.connections.find(c => c.conn.peer === conn.peer);
      if (!sender) return;
      const playerId = Number(sender.playerId);

      if (this.game.currentPlayerIndex !== playerId || this.game.gameStatus !== 'playing') {
        return; // Geçersiz hamle
      }

      if (data.action === 'hit') {
        this.game.playerHit(playerId);
      } else if (data.action === 'stay') {
        this.game.playerStay(playerId);
      }

      this.broadcastGameState();
    }

    // C) AKSİYON HEDEFİ SEÇİMİ (RESOLVE_ACTION)
    else if (data.type === 'RESOLVE_ACTION') {
      // Yalnızca aksiyon kartının sahibi hedef seçebilir
      const sender = this.connections.find(c => c.conn.peer === conn.peer);
      if (!sender) return;
      if (this.game.gameStatus !== 'action_resolution' || !this.game.actionState.active) return;
      if (Number(this.game.actionState.sourcePlayerId) !== Number(sender.playerId)) return;

      this.game.resolveAction(Number(data.targetId));

      this.broadcastGameState();
    }
  }

  // Bağlantı koptuğunda
  handleConnectionDisconnect(conn) {
    const idx = this.connections.findIndex(c => c.conn.peer === conn.peer);
    if (idx === -1) return;

    const disconnected = this.connections[idx];
    this.connections.splice(idx, 1);

    if (this.game.gameStatus === 'setup') {
      // Lobide: oyuncuyu çıkar, id'leri yeniden indeksle ve herkese güncel id'sini bildir
      this.game.addLog(`${disconnected.name} lobiden ayrıldı.`, 'normal');
      this.lobbyPlayers = this.lobbyPlayers.filter(p => p.peerId !== conn.peer);
      this.lobbyPlayers.forEach((p, index) => {
        p.id = index;
      });
      this.broadcastLobbyUpdate();
    } else {
      // Oyun içinde: id'ler sabittir; oyuncuyu koltuk numarası üzerinden pasifize et
      // (isimle arama yapılmaz — aynı isimli oyuncular yanlış eşleşebilirdi)
      this.game.handlePlayerDisconnect(Number(disconnected.playerId));
      this.broadcastGameState();
    }
  }

  // 2. ODAYA KATILMA (CLIENT)
  joinRoom(nick, code) {
    this.isHost = false;
    this.myNick = nick;
    this.roomId = code.trim().toUpperCase();
    this.peerId = `flip7-arena-client-${Math.random().toString(36).substr(2, 5)}`;
    
    this.setStatus("Siber ağa bağlanılıyor...", "connecting");

    this.peer = new Peer(this.peerId, this.peerConfig);

    // Bağlantı 18 sn içinde kurulamazsa: WebRTC engellenmiş/oda yok demektir.
    // Kullanıcıyı "Odaya bağlanılıyor"da sonsuza dek bekletmek yerine net hata göster.
    this.connectTimeout = setTimeout(() => {
      if (!this.hostConn || !this.hostConn.open) {
        this.abortJoin(
          "Odaya bağlanılamadı. Oda kodu yanlış olabilir ya da ağınız/güvenlik " +
          "duvarınız WebRTC (P2P) bağlantısını engelliyor olabilir. Farklı bir ağ " +
          "(örn. mobil hotspot) deneyebilir veya oda kodunu kontrol edebilirsiniz."
        );
      }
    }, 18000);

    this.peer.on('open', () => {
      const hostPeerId = `flip7-arena-${this.roomId}`;
      this.setStatus(`Odaya bağlanılıyor: ${this.roomId}`, "connecting");

      this.hostConn = this.peer.connect(hostPeerId);

      this.hostConn.on('open', () => {
        clearTimeout(this.connectTimeout);
        this.setStatus("Odaya Bağlanıldı. Giriş yapılıyor...", "connecting");
        // JOIN talebi gönder
        this.hostConn.send({
          type: 'JOIN',
          name: this.myNick
        });
      });

      this.hostConn.on('data', (data) => {
        this.handleClientReceivedData(data);
      });

      this.hostConn.on('close', () => {
        clearTimeout(this.connectTimeout);
        alert("Oda kurucu bağlantıyı kesti veya oda kapandı.");
        window.location.reload();
      });

      this.hostConn.on('error', (err) => {
        console.error("Bağlantı koptu:", err);
        // Henüz hiç bağlanamadıysak: oda yok / WebRTC engelli. Sayfayı yenilemek
        // yerine net hata gösterip formu tekrar aktif et.
        if (!this.hostConn.open) {
          this.abortJoin("Odaya bağlanılamadı. Oda kodunu ve ağ bağlantınızı kontrol edin.");
        } else {
          alert("Oda bağlantısı koptu.");
          window.location.reload();
        }
      });
    });

    this.peer.on('error', (err) => {
      console.error("Bağlantı hatası:", err);
      // 'peer-unavailable' => girilen oda kodunda host yok
      const msg = (err.type === 'peer-unavailable')
        ? `"${this.roomId}" kodlu bir oda bulunamadı. Oda kodunu kontrol edin.`
        : "Bağlantı hatası oluştu: " + (err.message || err.type || err);
      this.abortJoin(msg);
    });
  }

  // Katılım denemesini iptal et: zamanlayıcıyı temizle, peer'ı kapat,
  // hata göster ve kurulum butonlarını tekrar aktif et.
  abortJoin(message) {
    clearTimeout(this.connectTimeout);
    this.setStatus("Bağlantı Başarısız", "offline");
    try { this.peer && this.peer.destroy(); } catch (e) { /* yoksay */ }
    this.ui.dom.createRoomBtn.disabled = false;
    this.ui.dom.joinRoomBtn.disabled = false;
    alert(message);
  }

  // Client'ın gelen verileri işlediği kısım
  handleClientReceivedData(data) {
    // A) ODAYA GİRİŞ ONAYI (JOIN_ACK)
    if (data.type === 'JOIN_ACK') {
      this.myPlayerId = Number(data.playerId);
      if (data.yourName) this.myNick = data.yourName; // Host nick çakışmasını çözmüş olabilir
      this.setStatus("Bağlantı Stabil / Lobide", "online");
    }

    // B) LOBİ GÜNCELLEMESİ (LOBBY_UPDATE)
    else if (data.type === 'LOBBY_UPDATE') {
      // Lobiden ayrılan olunca host id'leri yeniden indeksler; güncel id'mizi alırız
      if (data.yourId !== undefined && data.yourId !== null) {
        this.myPlayerId = Number(data.yourId);
      }
      this.lobbyPlayers = data.players;
      this.ui.updateLobby(this.roomId, this.lobbyPlayers, false);
    }

    // C) OYUN BAŞLADI (START_GAME)
    else if (data.type === 'START_GAME') {
      if (data.playerId !== undefined && data.playerId !== null) {
        this.myPlayerId = Number(data.playerId); // Oyun içi koltuk numarası kesinleşir
      }
      this.ui.dom.setupScreen.classList.remove('active');
      this.ui.dom.gameScreen.classList.add('active');
      document.getElementById('online-badge').style.display = 'inline-block';
    }
    
    // D) OYUN DURUM GÜNCELLEMESİ (STATE_UPDATE)
    else if (data.type === 'STATE_UPDATE') {
      this.syncGameState(data.state);
    }

    // E) ODA DOLU VEYA RED (JOIN_REJECT)
    else if (data.type === 'JOIN_REJECT') {
      alert("Bağlantı Reddedildi: " + data.message);
      window.location.reload();
    }
  }

  // 3. SENKRONİZASYON VE BROADCAST

  // Host lobi listesini yayınlar
  broadcastLobbyUpdate() {
    this.ui.updateLobby(this.roomId, this.lobbyPlayers, true);
    this.connections.forEach(c => {
      // Yeniden indeksleme sonrası bağlantı-oyuncu eşlemesini taze tut ve alıcıya güncel id'sini bildir
      const lobbyPlayer = this.lobbyPlayers.find(p => p.peerId === c.conn.peer);
      if (lobbyPlayer) c.playerId = lobbyPlayer.id;
      c.conn.send({
        type: 'LOBBY_UPDATE',
        players: this.lobbyPlayers,
        yourId: lobbyPlayer ? lobbyPlayer.id : null
      });
    });
  }

  // Host oyunu başlatır
  startOnlineGame(aiCount = 0) {
    if (!this.isHost) return;

    // Toplam oyuncu sayısı (insan + AI) 5'i aşamaz
    const allowedAi = Math.max(0, Math.min(aiCount, 5 - this.lobbyPlayers.length));

    // Oyunu kur
    const playersConfig = this.lobbyPlayers.map(p => {
      return { name: p.name, isAI: false, aiPersonality: 'balanced' };
    });

    // Lobide yapay zekalar eklenmişse ekle
    for (let i = 0; i < allowedAi; i++) {
      playersConfig.push({ name: `AI-Apex-${i+1}`, isAI: true, aiPersonality: i % 2 === 0 ? 'balanced' : 'bold' });
    }

    // İstemcilere ekranı geçmelerini ve oyun içi koltuk numaralarını bildir
    // (oyun kurulmadan önce gönderilir ki ilk STATE_UPDATE'ler doğru kimlikle işlensin)
    this.connections.forEach(c => {
      c.conn.send({ type: 'START_GAME', playerId: c.playerId });
    });

    this.game.setupGame(playersConfig);
    if (allowedAi < aiCount) {
      this.game.addLog(`Oyuncu sınırı 5: yalnızca ${allowedAi} AI eklendi.`, 'normal');
    }

    // Host ekranını oyun alanına geçir
    this.ui.dom.setupScreen.classList.remove('active');
    this.ui.dom.gameScreen.classList.add('active');
    document.getElementById('online-badge').style.display = 'inline-block';

    // İlk oyun durumunu broadcast et
    this.broadcastGameState();
  }

  // actionState'i kartların display alanlarıyla birlikte serileştirir.
  // (PeerJS Card metodlarını düşürdüğü için client'ta isim/ikon kaybolmasın.)
  serializeCardData(c) {
    if (!c) return null;
    return {
      id: c.id, type: c.type, value: c.value,
      displayValue: c.getDisplayValue(),
      displayName: c.getDisplayName(),
      styleClass: c.getStyleClass()
    };
  }

  serializeActionState() {
    const a = this.game.actionState;
    if (!a) return null;
    return {
      active: a.active,
      sourcePlayerId: a.sourcePlayerId,
      targetPlayerId: a.targetPlayerId,
      flipsRemaining: a.flipsRemaining,
      card: a.card ? this.serializeCardData(a.card) : null,
      cardsFlippedThisAction: (a.cardsFlippedThisAction || []).map(c => this.serializeCardData(c)),
      pendingActionsQueue: (a.pendingActionsQueue || []).map(item => ({
        card: this.serializeCardData(item.card),
        sourcePlayerId: item.sourcePlayerId
      }))
    };
  }

  // Oyun durumunu paketleyip istemcilere yollar
  broadcastGameState() {
    if (!this.isHost) return;

    const serializedState = {
      roundNumber: this.game.roundNumber,
      currentPlayerIndex: this.game.currentPlayerIndex,
      gameStatus: this.game.gameStatus,
      deckCount: this.game.deck.count(),
      actionState: this.serializeActionState(),
      logs: this.game.logs,
      players: this.game.players.map(p => {
        return {
          id: p.id,
          name: p.name,
          isAI: p.isAI,
          score: p.score,
          cards: p.cards.map(c => {
            return {
              id: c.id,
              type: c.type,
              value: c.value,
              displayValue: c.getDisplayValue(),
              displayName: c.getDisplayName(),
              styleClass: c.getStyleClass()
            };
          }),
          hasSecondChance: p.hasSecondChance,
          status: p.status,
          roundScore: p.roundScore,
          isFlipped7: p.isFlipped7,
          isDisconnected: p.isDisconnected
        };
      })
    };

    this.connections.forEach(c => {
      c.conn.send({
        type: 'STATE_UPDATE',
        state: serializedState
      });
    });
  }

  // Client Host'tan gelen oyunu senkronize eder
  syncGameState(state) {
    // Arayüz çözümlerken Card nesnesinin metodlarına ihtiyaç duyduğu için actionState.card'ı sarmalıyoruz
    let syncedActionState = null;
    if (state.actionState) {
      syncedActionState = { ...state.actionState };
      if (state.actionState.card) {
        const c = state.actionState.card;
        syncedActionState.card = {
          id: c.id,
          type: c.type,
          value: c.value,
          getDisplayValue: () => c.displayValue || c.value,
          getDisplayName: () => c.displayName || c.value,
          getStyleClass: () => c.styleClass || c.type
        };
      }
    }

    // UI çizimini kolaylaştırmak için gelen state yapısını bir arayüz-oyun sınıfı gibi sararız
    const uiState = {
      roundNumber: state.roundNumber,
      currentPlayerIndex: state.currentPlayerIndex,
      gameStatus: state.gameStatus,
      actionState: syncedActionState,
      logs: state.logs,
      deck: { count: () => state.deckCount },
      players: state.players.map(p => {
        return {
          id: p.id,
          name: p.name,
          isAI: p.isAI,
          score: p.score,
          cards: p.cards.map(c => {
            // Card nesnesini taklit eder
            return {
              id: c.id,
              type: c.type,
              value: c.value,
              getDisplayValue: () => c.displayValue,
              getDisplayName: () => c.displayName,
              getStyleClass: () => c.styleClass
            };
          }),
          hasSecondChance: p.hasSecondChance,
          status: p.status,
          roundScore: p.roundScore,
          isFlipped7: p.isFlipped7,
          isDisconnected: p.isDisconnected,
          getUniqueNumbersCount: () => {
            const numbers = p.cards.filter(c => c.type === 'number').map(c => c.value);
            return new Set(numbers).size;
          }
        };
      }),
      // Durumsal puan hesabı client tarafında da taklit edilir
      calculateTempRoundScore: (player) => {
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
      },
      getCurrentPlayer: () => uiState.players[state.currentPlayerIndex]
    };

    // Client'ın yerel game nesnesini de güncelle ki event listener'lar doğru çalışsın
    this.game.roundNumber = uiState.roundNumber;
    this.game.currentPlayerIndex = uiState.currentPlayerIndex;
    this.game.gameStatus = uiState.gameStatus;
    this.game.actionState = uiState.actionState;
    this.game.logs = uiState.logs;
    this.game.players = uiState.players;
    this.game.deck = uiState.deck;
    this.game.getCurrentPlayer = uiState.getCurrentPlayer;
    this.game.calculateTempRoundScore = uiState.calculateTempRoundScore;

    // UI'a doğrudan bu mock state'i verip render etmesini söyleriz
    this.ui.render(uiState);
  }

  // 4. AĞDAN HAMLE GÖNDERİMİ (NETWORK ACTIONS)
  sendHit() {
    if (this.isHost) {
      this.game.playerHit(this.game.currentPlayerIndex);
      this.broadcastGameState();
    } else {
      this.hostConn.send({
        type: 'ACTION',
        playerId: this.myPlayerId,
        action: 'hit'
      });
    }
  }

  sendStay() {
    if (this.isHost) {
      this.game.playerStay(this.game.currentPlayerIndex);
      this.broadcastGameState();
    } else {
      this.hostConn.send({
        type: 'ACTION',
        playerId: this.myPlayerId,
        action: 'stay'
      });
    }
  }

  sendResolveAction(targetId) {
    if (this.isHost) {
      this.game.resolveAction(targetId);
      this.broadcastGameState();
    } else {
      this.hostConn.send({
        type: 'RESOLVE_ACTION',
        targetId: targetId
      });
    }
  }
}
export default NetworkManager;
