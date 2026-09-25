/* ============================================================
   学海大陆 · 音效系统（audio/ mp3 文件，懒加载）
   统一接口 XH.audio.play('name')；壁炉环境音与血手印蓄力走专用函数。
   静音开关迁入存档 audioMuted，旧 localStorage xuehai_muted 兜底迁移。
   ============================================================ */
(function () {
  'use strict';
  const XH = (window.XH = window.XH || {});

  const MUTE_KEY = 'xuehai_muted';   // 旧静音 key，仅迁移/兜底用
  let ctx = null;      // 保留 master 总线（当前无合成音效，仅占位，便于日后回退/扩展）
  let master = null;
  let muted = false;

  function ensureCtx() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.4;
      master.connect(ctx.destination);
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  /* ---------- 音效注册表（audio/ 目录，懒加载 + 每音效音量系数） ----------
     vol = 基础音量(0–1)，coeff = 音量系数（独立微调档），loop = 循环 */
  const FILE_SFX = {
    click:       { src: 'audio/sfx-click.mp3',       vol: 0.6,  coeff: 1.0 },
    transition:  { src: 'audio/sfx-transition.mp3',  vol: 0.4,  coeff: 1.0 },
    light:       { src: 'audio/sfx-light.mp3',       vol: 0.45, coeff: 1.0 },
    transmit:    { src: 'audio/sfx-transmit.mp3',    vol: 0.35, coeff: 1.0 },
    levelup:     { src: 'audio/sfx-levelup.mp3',     vol: 0.5,  coeff: 1.0 },
    regionclear: { src: 'audio/sfx-regionclear.mp3', vol: 0.5,  coeff: 1.0 },
    conquer:     { src: 'audio/sfx-conquer.mp3',     vol: 0.5,  coeff: 1.0 },
    contract:    { src: 'audio/sfx-contract.mp3',    vol: 0.55, coeff: 1.0 },
    error:       { src: 'audio/sfx-error.mp3',       vol: 0.4,  coeff: 1.0 },
    type:        { src: 'audio/sfx-type.mp3',        vol: 0.3,  coeff: 1.0 },
    charge:      { src: 'audio/sfx-charge.mp3',      vol: 0.4,  coeff: 1.0, loop: true },
    page:        { src: 'audio/sfx-page.mp3',        vol: 0.5,  coeff: 1.5 },
    quill:       { src: 'audio/sfx-quill.mp3',       vol: 0.5,  coeff: 1.0 },
    paper:       { src: 'audio/sfx-paper.mp3',       vol: 0.5,  coeff: 1.0 },
    coin:        { src: 'audio/sfx-coin.mp3',        vol: 0.5,  coeff: 1.0 },
    fireplace:   { src: 'audio/sfx-fireplace.mp3',   vol: 0.3,  coeff: 1.0, loop: true }
  };
  const sfxCache = {};   // name → HTMLAudioElement（懒加载）

  function getSfx(name) {
    const cfg = FILE_SFX[name];
    if (!cfg) return null;
    if (!sfxCache[name]) {
      const a = new Audio(cfg.src);
      a.preload = 'auto';
      a.volume = Math.min(1, (cfg.vol || 0.5) * (cfg.coeff || 1));
      if (cfg.loop) a.loop = true;
      sfxCache[name] = a;
    }
    return sfxCache[name];
  }

  function playSfx(name) {
    if (muted) return;
    const a = getSfx(name);
    if (!a) return;
    a.currentTime = 0;              // 快速重复触发时从头播
    const p = a.play();
    if (p && p.catch) p.catch(function () { /* 自动播放被拦，忽略 */ });
  }

  /* 血手印蓄力：循环播放 + playbackRate 随进度 1.0→2.0 */
  function startChargeSfx() {
    if (muted) return;
    const a = getSfx('charge');
    if (!a) return;
    a.playbackRate = 1.0;
    a.currentTime = 0;
    const p = a.play();
    if (p && p.catch) p.catch(function () {});
  }
  function updateChargeSfx(progress) {
    const a = sfxCache['charge'];
    if (a) {
      const p = Math.min(1, Math.max(0, Number(progress) || 0));
      a.playbackRate = 1.0 + p;
    }
  }
  function stopChargeSfx() {
    const a = sfxCache['charge'];
    if (a) { try { a.pause(); a.currentTime = 0; a.playbackRate = 1.0; } catch (e) {} }
  }

  /* 大厅常驻环境音：壁炉循环，音量 ≤30% */
  function startAmbient() {
    if (muted) return;
    const a = getSfx('fireplace');
    if (!a) return;
    if (a.paused) {
      const p = a.play();
      if (p && p.catch) p.catch(function () {});
    }
  }
  function stopAmbient() {
    const a = sfxCache['fireplace'];
    if (a) { try { a.pause(); a.currentTime = 0; } catch (e) {} }
  }

  /* ---------- 播放接口 ---------- */
  function play(name, param) {
    if (muted) return;
    if (name === 'chargeStart') { startChargeSfx(); return; }
    if (name === 'charge') { updateChargeSfx(param); return; }
    if (name === 'chargeStop') { stopChargeSfx(); return; }
    if (FILE_SFX[name]) { playSfx(name); return; }
  }

  /* ---------- 静音开关 ---------- */
  function applyMuteIcon() {
    const btn = document.getElementById('btn-mute');
    if (btn) btn.classList.toggle('muted', muted);
  }

  function setMuted(m) {
    muted = !!m;
    if (XH.state) {
      XH.state.audioMuted = muted;
      XH.storage.save(XH.state);
    }
    try { localStorage.setItem(MUTE_KEY, muted ? '1' : '0'); } catch (e) {} // 旧 key 兜底
    if (muted) { stopChargeSfx(); stopAmbient(); }
    applyMuteIcon();
  }

  function toggleMute() { setMuted(!muted); }

  function loadMuted() {
    if (XH.state && typeof XH.state.audioMuted === 'boolean') {
      muted = XH.state.audioMuted;
    } else {
      try { muted = localStorage.getItem(MUTE_KEY) === '1'; } catch (e) { muted = false; }
    }
  }

  function init() {
    loadMuted();
    applyMuteIcon();

    const btn = document.getElementById('btn-mute');
    if (btn) btn.addEventListener('click', toggleMute);

    // 通用 UI 点击音（按钮/入口/面包屑/区域卡）
    document.addEventListener('click', function (e) {
      const t = e.target;
      if (!t || !t.closest) return;
      if (t.closest('button') || t.closest('.station') || t.closest('.crumb') || t.closest('.node-card.region')) {
        play('click');
      }
    });

    // 首次交互即初始化 AudioContext（保留 master 总线；当前 mp3 无需，保留以便日后回退/扩展）
    const resume = function () {
      ensureCtx();
      document.removeEventListener('pointerdown', resume);
      document.removeEventListener('keydown', resume);
    };
    document.addEventListener('pointerdown', resume);
    document.addEventListener('keydown', resume);
  }

  XH.audio = { play: play, toggleMute: toggleMute, isMuted: function () { return muted; }, init: init, ensureCtx: ensureCtx, startAmbient: startAmbient, stopAmbient: stopAmbient };
})();
