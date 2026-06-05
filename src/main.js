// FLIP 7 - Giriş Noktası ve Başlatıcı

import { Flip7Game } from './game.js';
import { Flip7UI } from './ui.js';
import { NetworkManager } from './network.js';
import { initDesignPanel } from './designPanel.js';

document.addEventListener('DOMContentLoaded', () => {
  // Tasarım paneli: yalnızca URL'de #design varsa açılır
  initDesignPanel();

  const game = new Flip7Game();
  const ui = new Flip7UI(game);
  const network = new NetworkManager(game, ui);
  
  // Arayüzün ağ yöneticisine erişimini sağla
  ui.network = network;

  // Oyun durumunu ağ üzerinden de senkronize et
  const originalOnStateChange = game.onStateChange;
  game.onStateChange = (gameInstance) => {
    if (originalOnStateChange) {
      originalOnStateChange(gameInstance);
    }
    if (network.isHost) {
      network.broadcastGameState();
    }
  };
  
  // Ağ durumu değişimlerini dinle ve lobi arayüzündeki bağlantı rozetini güncelle
  network.statusCallback = (text, badgeClass) => {
    const badge = ui.dom.connectionStatusText;
    if (badge) {
      badge.textContent = text;
      badge.className = `status-badge ${badgeClass}`;
    }
  };

  // Konsoldan kolay kontrol için global nesneye ekleyelim
  window.flip7 = {
    game,
    ui,
    network
  };
  
  console.log("⚔️ Flip 7 - Çevrimiçi Siber Arena başarıyla başlatıldı!");
});
