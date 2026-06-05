// FLIP 7 - Canlı Tasarım Paneli (Design Tweaker)
// Sadece URL'de #design varken görünür. Paleti elle ayarlamak içindir.
// Beğenilen değerler "Dışa Aktar" ile alınıp style.css :root içine işlenir.

const COLOR_VARS = [
  { var: '--bg-dark',        label: 'Arka Plan (Koyu)' },
  { var: '--bg-dark-purple', label: 'Arka Plan (Mor)' },
  { var: '--neon-pink',      label: 'Neon Pembe' },
  { var: '--neon-blue',      label: 'Neon Mavi' },
  { var: '--neon-purple',    label: 'Neon Mor' },
  { var: '--neon-green',     label: 'Neon Yeşil' },
  { var: '--neon-yellow',    label: 'Neon Sarı' },
  { var: '--neon-red',       label: 'Neon Kırmızı' },
];

const SLIDER_VARS = [
  { var: '--glass-blur',  label: 'Cam Bulanıklığı', min: 0,  max: 30, step: 1, unit: 'px', fallback: '14px' },
  { var: '--card-radius', label: 'Köşe Yuvarlaklığı', min: 0, max: 28, step: 1, unit: 'px', fallback: '12px' },
];

function cssVar(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

function setVar(name, value) {
  document.documentElement.style.setProperty(name, value);
}

// "14px" -> 14
function numFrom(value, fallback) {
  const n = parseFloat(value);
  return Number.isFinite(n) ? n : parseFloat(fallback);
}

export function initDesignPanel() {
  if (!/(^|[#?&])design\b/i.test(location.hash + location.search)) return;
  if (document.getElementById('design-panel')) return;

  const panel = document.createElement('div');
  panel.id = 'design-panel';
  panel.innerHTML = `
    <style>
      #design-panel {
        position: fixed; top: 16px; right: 16px; z-index: 9999;
        width: 280px; max-height: 90vh; overflow-y: auto;
        background: rgba(10, 11, 18, 0.96);
        border: 1px solid rgba(0, 240, 255, 0.4);
        border-radius: 12px; padding: 16px;
        box-shadow: 0 8px 40px rgba(0,0,0,0.6), 0 0 20px rgba(0,240,255,0.15);
        font-family: 'Outfit','Inter',sans-serif; color: #f1f2f6;
        backdrop-filter: blur(8px);
      }
      #design-panel h3 {
        margin: 0 0 4px; font-size: 1.05rem; color: #00f0ff; letter-spacing: 1px;
      }
      #design-panel .dp-sub { font-size: 0.72rem; color: #a4b0be; margin-bottom: 12px; }
      #design-panel .dp-row {
        display: flex; align-items: center; justify-content: space-between;
        gap: 8px; margin-bottom: 9px;
      }
      #design-panel .dp-row label { font-size: 0.8rem; flex: 1; }
      #design-panel input[type="color"] {
        width: 38px; height: 26px; border: none; border-radius: 5px;
        background: none; cursor: pointer; padding: 0;
      }
      #design-panel .dp-hex {
        font-size: 0.68rem; color: #7f8c9b; width: 56px; text-align: right;
        font-family: monospace;
      }
      #design-panel input[type="range"] { flex: 1; accent-color: #00f0ff; }
      #design-panel .dp-val { font-size: 0.72rem; width: 36px; text-align: right; color: #a4b0be; }
      #design-panel hr { border: none; border-top: 1px solid rgba(255,255,255,0.08); margin: 12px 0; }
      #design-panel .dp-btns { display: flex; gap: 8px; margin-top: 6px; }
      #design-panel button {
        flex: 1; font-family: inherit; font-size: 0.78rem; font-weight: 600;
        padding: 8px; border-radius: 6px; cursor: pointer; border: 1px solid transparent;
        text-transform: uppercase; letter-spacing: 0.5px;
      }
      #design-panel .dp-export { background: #00f0ff; color: #0a0b12; }
      #design-panel .dp-reset { background: rgba(255,56,56,0.15); color: #ff6b6b; border-color: rgba(255,56,56,0.4); }
      #design-panel .dp-close {
        background: transparent; color: #a4b0be; border-color: rgba(255,255,255,0.15); flex: 0 0 auto; width: 30px; padding: 8px 0;
      }
      #design-panel textarea {
        width: 100%; height: 110px; margin-top: 10px; display: none;
        background: #05060c; color: #39ff14; border: 1px solid rgba(255,255,255,0.1);
        border-radius: 6px; font-family: monospace; font-size: 0.7rem; padding: 8px; resize: vertical;
      }
      #design-panel .dp-head { display: flex; justify-content: space-between; align-items: flex-start; }
    </style>
    <div class="dp-head">
      <div>
        <h3>🎨 Tasarım Paneli</h3>
        <div class="dp-sub">Paleti elle ayarla, anında önizle.</div>
      </div>
    </div>
    <div id="dp-colors"></div>
    <hr>
    <div id="dp-sliders"></div>
    <div class="dp-btns">
      <button class="dp-export">Dışa Aktar</button>
      <button class="dp-reset">Sıfırla</button>
      <button class="dp-close" title="Kapat">✕</button>
    </div>
    <textarea readonly spellcheck="false"></textarea>
  `;
  document.body.appendChild(panel);

  const colorsHost = panel.querySelector('#dp-colors');
  COLOR_VARS.forEach(c => {
    const current = cssVar(c.var) || '#000000';
    const row = document.createElement('div');
    row.className = 'dp-row';
    row.innerHTML = `
      <label>${c.label}</label>
      <span class="dp-hex">${current}</span>
      <input type="color" value="${current}" data-var="${c.var}">
    `;
    const input = row.querySelector('input');
    const hex = row.querySelector('.dp-hex');
    input.addEventListener('input', () => {
      setVar(c.var, input.value);
      hex.textContent = input.value;
    });
    colorsHost.appendChild(row);
  });

  const slidersHost = panel.querySelector('#dp-sliders');
  SLIDER_VARS.forEach(s => {
    const current = numFrom(cssVar(s.var), s.fallback);
    const row = document.createElement('div');
    row.className = 'dp-row';
    row.innerHTML = `
      <label>${s.label}</label>
      <input type="range" min="${s.min}" max="${s.max}" step="${s.step}" value="${current}" data-var="${s.var}">
      <span class="dp-val">${current}${s.unit}</span>
    `;
    const input = row.querySelector('input');
    const val = row.querySelector('.dp-val');
    // Değişkeni hemen tanımla ki style.css'teki var(...) kullanımları çalışsın
    setVar(s.var, `${current}${s.unit}`);
    input.addEventListener('input', () => {
      setVar(s.var, `${input.value}${s.unit}`);
      val.textContent = `${input.value}${s.unit}`;
    });
    slidersHost.appendChild(row);
  });

  const textarea = panel.querySelector('textarea');

  panel.querySelector('.dp-export').addEventListener('click', () => {
    const lines = [
      ...COLOR_VARS.map(c => `  ${c.var}: ${cssVar(c.var)};`),
      ...SLIDER_VARS.map(s => `  ${s.var}: ${cssVar(s.var)};`),
    ];
    const out = `:root {\n${lines.join('\n')}\n}`;
    textarea.style.display = 'block';
    textarea.value = out;
    textarea.select();
    if (navigator.clipboard) navigator.clipboard.writeText(out).catch(() => {});
  });

  panel.querySelector('.dp-reset').addEventListener('click', () => {
    [...COLOR_VARS, ...SLIDER_VARS].forEach(v => document.documentElement.style.removeProperty(v.var));
    location.reload();
  });

  panel.querySelector('.dp-close').addEventListener('click', () => panel.remove());
}

export default initDesignPanel;
