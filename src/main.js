// FLIP 7 - Giriş Noktası ve Başlatıcı

import { Flip7Game } from './game.js';
import { Flip7UI } from './ui.js';

document.addEventListener('DOMContentLoaded', () => {
  const game = new Flip7Game();
  const ui = new Flip7UI(game);
  
  // Hata ayıklama veya test amacıyla konsoldan erişim için global pencereye ekleyelim
  window.flip7 = {
    game,
    ui
  };
  
  console.log("⚔️ Flip 7 - Orta Çağ Hanı Oyunu başarıyla başlatıldı!");
});
