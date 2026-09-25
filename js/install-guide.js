/* ============================================================
   学海大陆 · 安装到主屏幕引导
   仅手机浏览器（触屏、非 standalone、横屏、未安装）且首次进大厅时，
   延迟 2 秒在底部悬浮显示引导气泡；可「知道了」（本次会话）或「不再提示」（永久）。
   ============================================================ */
(function () {
  'use strict';
  const XH = (window.XH = window.XH || {});
  const $ = function (id) { return document.getElementById(id); };

  const SEEN_KEY = 'xuehai_install_guide_seen'; // sessionStorage：本次会话已「知道了」

  function isTouch() {
    try { return window.matchMedia('(pointer: coarse)').matches; } catch (e) { return false; }
  }
  function isStandalone() {
    try {
      return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
    } catch (e) { return window.navigator.standalone === true; }
  }
  function isPortrait() {
    try { return window.matchMedia('(orientation: portrait)').matches; } catch (e) { return false; }
  }
  function isiOS() {
    return /iPhone|iPad|iPod/i.test((navigator.userAgent || '') + ' ' + (navigator.platform || ''));
  }
  function sget(k) { try { return sessionStorage.getItem(k); } catch (e) { return null; } }
  function sset(k, v) { try { sessionStorage.setItem(k, v); } catch (e) {} }

  let triggered = false; // 本次页面加载内是否已触发过（只触发一次）

  function onHallEnter() {
    if (triggered) return;
    if (XH.tutorial && XH.tutorial.isActive()) return; // 教学期间不打扰
    if (!isTouch()) return;                       // 桌面端不显示
    if (isStandalone()) return;                   // 已安装（standalone）不显示
    if (isPortrait()) return;                     // 竖屏遮罩状态下不显示
    if (XH.state && XH.state.installGuideDismissed) return; // 永久关闭
    if (sget(SEEN_KEY)) return;                   // 本次会话已「知道了」
    triggered = true;
    setTimeout(show, 2000);
  }

  function show() {
    const el = $('install-guide');
    const text = $('install-guide-text');
    if (!el || !text) return;
    text.textContent = isiOS()
      ? '点底部「分享」按钮 →「添加到主屏幕」，即可获得全屏体验。添加后从主屏幕图标进入，无地址栏干扰。'
      : '点浏览器菜单 ⋮ →「添加到主屏幕」，即可获得全屏体验。';
    el.classList.add('open');
  }

  function dismiss(permanent) {
    const el = $('install-guide');
    if (el) el.classList.remove('open');
    if (permanent) {
      if (XH.state) {
        XH.state.installGuideDismissed = true;
        XH.storage.save(XH.state);
      }
    } else {
      sset(SEEN_KEY, '1');
    }
  }

  function bind() {
    const ok = $('btn-guide-ok');
    const never = $('btn-guide-never');
    if (ok) ok.addEventListener('click', function () { dismiss(false); });
    if (never) never.addEventListener('click', function () { dismiss(true); });
  }

  XH.installGuide = { onHallEnter: onHallEnter, bind: bind };
})();
