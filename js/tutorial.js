/* ============================================================
   学海大陆 · 阿黛向导式新手教学
   复用 XH.ada 表情/气泡管线（事件订阅 XH.ada.on + 静默 setSilenced），
   分步引导新用户。台词集中在 STEPS 配置里，便于日后修改。
   推进靠真实操作：城池创建 / 委托发布 / 打卡完成 / 反思提交。
   ============================================================ */
(function () {
  'use strict';
  const XH = (window.XH = window.XH || {});
  const $ = function (id) { return document.getElementById(id); };

  /* ============================================================
     步骤配置
     screen:        该步开始时导航到的页面（null 不导航）
     target:        高亮目标选择器（null = 气泡居中）
     expr:          阿黛表情
     text:          台词（≤两句，不得引用未实装功能）
     advanceEvent:  推进事件（ada 触发点 id），完成该操作才推进
     advanceScreen: 推进页面（进入该页即推进）
     skipStep:      是否显示「这一步先跳过」
     ============================================================ */
  const STEPS = [
    { screen: 'screen-hall', target: null, expr: 'smile',
      text: '我是阿黛，你的向导。这片大陆还一片漆黑，让我带你点亮它。',
      advanceEvent: null, advanceScreen: null, skipStep: false },
    { screen: 'screen-hall', target: '.station-map', expr: 'smile',
      text: '先去地图，立下你的第一座城池。',
      advanceEvent: null, advanceScreen: 'screen-continents', skipStep: false },
    { screen: 'screen-continents', target: '#btn-new-continent', expr: 'smile',
      text: '点这里，立下你的第一座城池。',
      advanceEvent: 'continent_created', advanceScreen: null, skipStep: false },
    { screen: 'screen-hall', target: '.station-meditate', expr: 'smile',
      text: '远征前，先在这里定神——想清楚今天为何出发。',
      advanceEvent: 'reflection_done', advanceScreen: null, skipStep: true, hideOnLeave: true },
    { screen: 'screen-hall', target: '.station-board', expr: 'smile',
      text: '给今天的自己下一份委托吧。',
      advanceEvent: 'quest_created', advanceScreen: null, skipStep: false, hideOnLeave: true },
    { screen: 'screen-quests', target: '#checkin-list .node-card', expr: 'smile',
      text: '完成后来这里打卡，领取经验与金币。',
      advanceEvent: 'quest_done', advanceScreen: null, skipStep: false },
    { screen: 'screen-hall', target: '.station-settle', expr: 'smile',
      text: '日落之后，来这里看今天的战报——你走过的每一步，都有地方记着。',
      advanceEvent: 'chronicle_opened', advanceScreen: null, skipStep: true, hideOnLeave: true },
    { screen: null, target: null, expr: 'salute',
      text: '大陆已经亮起第一簇火了。剩下的，交给时间和你。',
      advanceEvent: null, advanceScreen: null, skipStep: false }
  ];

  let currentStep = -1;
  let active = false;
  let pendingTimer = null;
  let offAdvance = null;

  /* ---------- 订阅当前步的推进事件 ---------- */
  function subscribe() {
    unsubscribe();
    const step = STEPS[currentStep];
    if (step && step.advanceEvent && XH.ada && XH.ada.on) {
      offAdvance = XH.ada.on(step.advanceEvent, function () { advance(); });
    }
  }
  function unsubscribe() {
    if (offAdvance) { offAdvance(); offAdvance = null; }
  }

  /* ---------- 表情 + 台词 ---------- */
  function setText(text, expr) {
    $('tutorial-text').textContent = text;
    const img = $('tutorial-ada-img');
    if (img) {
      img.onerror = function () { img.style.display = 'none'; };
      img.style.display = '';
      img.src = 'img/opt/ada-' + expr + '.png';
    }
  }

  /* ---------- 按钮 ---------- */
  function addBtn(container, label, variant, fn) {
    const b = document.createElement('button');
    b.className = 'pixel-btn pixel-btn-sm ' + variant;
    b.textContent = label;
    b.addEventListener('click', fn);
    container.appendChild(b);
  }
  function setButtons(step, index) {
    const actions = $('tutorial-actions');
    actions.innerHTML = '';
    if (index === 0) {
      addBtn(actions, '开始教学', 'pixel-btn', advance);
      addBtn(actions, '跳过教学', 'pixel-btn-ghost', end);
    } else if (index === STEPS.length - 1) {
      addBtn(actions, '完成', 'pixel-btn', end);
    } else if (step.skipStep) {
      addBtn(actions, '这一步先跳过', 'pixel-btn', advance);
      addBtn(actions, '跳过教学', 'pixel-btn-ghost', end);
    } else {
      addBtn(actions, '跳过教学', 'pixel-btn-ghost', end);
    }
  }

  /* ---------- 定位（遮罩洞 + 高亮光圈 + 气泡） ---------- */
  function hideSpotlight() { $('tutorial-spotlight').style.display = 'none'; }
  function showSpotlight() { $('tutorial-spotlight').style.display = 'block'; }
  function hideBubble() { $('tutorial-bubble').style.display = 'none'; }
  function showBubble() {
    const bubble = $('tutorial-bubble');
    const wasHidden = bubble.style.display !== 'flex';
    bubble.style.display = 'flex';
    if (wasHidden) {
      bubble.classList.add('enter');
      setTimeout(function () { bubble.classList.remove('enter'); }, 200);
    }
  }
  function hideMask() {
    hideSpotlight();
    placeBlocker('tutorial-b-top', 0, 0, 0, 0);
    placeBlocker('tutorial-b-bottom', 0, 0, 0, 0);
    placeBlocker('tutorial-b-left', 0, 0, 0, 0);
    placeBlocker('tutorial-b-right', 0, 0, 0, 0);
  }

  function placeBlocker(id, left, top, w, h) {
    const b = $(id);
    b.style.left = left + 'px';
    b.style.top = top + 'px';
    b.style.width = Math.max(0, w) + 'px';
    b.style.height = Math.max(0, h) + 'px';
  }

  function position() {
    const step = STEPS[currentStep];
    if (!step) return;
    const idx = currentStep;               // 异步回调期间可能步进，据此放弃过期定位
    const el = step.target ? document.querySelector(step.target) : null;

    // 无目标：气泡居中
    if (!step.target) {
      drawCentered();
      return;
    }

    // 目标元素不存在 → 告警跳过，绝不软锁死
    if (!el) {
      console.warn('[教学] 目标元素不存在，跳过当前步骤：' + step.target);
      advance();
      return;
    }

    // 先滚入视口中央再定位（程序性滚动，不受 body.tutorial-open 的用户滚动锁限制）
    try {
      el.scrollIntoView({ block: 'center', behavior: 'instant' });
    } catch (e) {
      el.scrollIntoView(true);
    }

    // 滚动结束 / 下一帧再量坐标，防止高亮与气泡错位
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        if (!active || currentStep !== idx) return;
        measureAndDraw(step, el);
      });
    });
  }

  function measureAndDraw(step, el) {
    const r = el.getBoundingClientRect();
    const W = window.innerWidth, H = window.innerHeight;
    const inView = r.width > 0 && r.height > 0 &&
      r.bottom > 0 && r.top < H && r.right > 0 && r.left < W;

    // 兜底升级：滚入后仍不在视口内（极端小屏 / 元素不可见）→ 告警跳过，绝不软锁死
    if (!inView) {
      console.warn('[教学] 目标滚入后仍不在视口内，跳过当前步骤：' + step.target);
      advance();
      return;
    }

    drawSpotlightAndBubble(r);
  }

  function drawCentered() {
    const W = window.innerWidth, H = window.innerHeight;
    placeBlocker('tutorial-b-top', 0, 0, W, H);
    placeBlocker('tutorial-b-bottom', 0, 0, 0, 0);
    placeBlocker('tutorial-b-left', 0, 0, 0, 0);
    placeBlocker('tutorial-b-right', 0, 0, 0, 0);
    hideSpotlight();
    centerBubble();
  }

  function drawSpotlightAndBubble(rect) {
    const W = window.innerWidth, H = window.innerHeight;
    const pad = 8;
    const x0 = rect.left - pad, y0 = rect.top - pad;
    const x1 = rect.right + pad, y1 = rect.bottom + pad;
    placeBlocker('tutorial-b-top', 0, 0, W, y0);
    placeBlocker('tutorial-b-bottom', 0, y1, W, H - y1);
    placeBlocker('tutorial-b-left', 0, y0, x0, y1 - y0);
    placeBlocker('tutorial-b-right', x1, y0, W - x1, y1 - y0);

    const spot = $('tutorial-spotlight');
    spot.style.left = x0 + 'px';
    spot.style.top = y0 + 'px';
    spot.style.width = (x1 - x0) + 'px';
    spot.style.height = (y1 - y0) + 'px';
    showSpotlight();
    positionBubble(rect);
  }

  function positionBubble(rect) {
    const bubble = $('tutorial-bubble');
    showBubble();
    const gap = 12;
    const bw = bubble.offsetWidth, bh = bubble.offsetHeight;
    const W = window.innerWidth, H = window.innerHeight;
    let left = rect.left + rect.width / 2 - bw / 2;
    left = Math.max(8, Math.min(left, W - bw - 8));
    let top = rect.bottom + gap;
    if (top + bh > H - 8) top = rect.top - gap - bh;
    if (top < 8) top = 8;
    bubble.style.left = left + 'px';
    bubble.style.top = top + 'px';
  }

  function centerBubble() {
    const bubble = $('tutorial-bubble');
    showBubble();
    const W = window.innerWidth, H = window.innerHeight;
    bubble.style.left = Math.max(8, (W - bubble.offsetWidth) / 2) + 'px';
    bubble.style.top = Math.max(8, (H - bubble.offsetHeight) / 2) + 'px';
  }

  function pinBubbleTop() {
    const bubble = $('tutorial-bubble');
    showBubble();
    const W = window.innerWidth;
    bubble.style.left = Math.max(8, (W - bubble.offsetWidth) / 2) + 'px';
    bubble.style.top = '8px';
  }

  /* ---------- 渲染 / 推进 / 结束 ---------- */
  function renderStep(index) {
    currentStep = index;
    const step = STEPS[index];
    hideSpotlight();
    hideBubble();
    setText(step.text, step.expr);
    setButtons(step, index);
    subscribe();
    clearTimeout(pendingTimer);
    if (step.screen) XH.ui.showScreen(step.screen);
    pendingTimer = setTimeout(function () {
      pendingTimer = null;
      position();
    }, 680);
  }

  function advance() {
    const next = currentStep + 1;
    if (next >= STEPS.length) { end(); return; }
    if (XH.state) {
      XH.state.tutorial = { step: next, done: false };
      XH.storage.save(XH.state);
    }
    renderStep(next);
  }

  function end() {
    if (XH.state) {
      XH.state.tutorial = { step: 0, done: true };
      XH.storage.save(XH.state);
    }
    dismiss();
  }

  function dismiss() {
    active = false;
    unsubscribe();
    clearTimeout(pendingTimer);
    if (XH.ada) XH.ada.setSilenced(false);
    document.body.classList.remove('tutorial-open');
    const ov = $('tutorial-overlay');
    if (ov) ov.classList.remove('open');
  }

  function start(stepIndex) {
    active = true;
    if (XH.ada) XH.ada.setSilenced(true);
    document.body.classList.add('tutorial-open');
    $('tutorial-overlay').classList.add('open');
    renderStep(stepIndex);
  }

  function onHallEnter() {
    if (active) return;
    const state = XH.state;
    if (!state) return;
    const t = state.tutorial || { step: 0, done: false };
    if (t.done) return;
    start(t.step);
  }

  function onScreen(id) {
    if (!active) return;
    const step = STEPS[currentStep];
    if (!step) return;
    if (step.advanceScreen && step.advanceScreen === id) { advance(); return; }
    // 跨屏步骤：离开大厅进入目标页后，隐藏遮罩高亮、保持气泡等待事件
    if (step.hideOnLeave && step.screen && id !== step.screen) {
      clearTimeout(pendingTimer);
      pendingTimer = setTimeout(function () {
        pendingTimer = null;
        hideMask();
        pinBubbleTop();
      }, 450);
      return;
    }
    // 其余非推进型切换：重新定位（目标失效则由 position 内跳过，防死锁）
    clearTimeout(pendingTimer);
    pendingTimer = setTimeout(function () {
      pendingTimer = null;
      position();
    }, 450);
  }

  function reset() {
    if (XH.state) {
      XH.state.tutorial = { step: 0, done: false };
      XH.storage.save(XH.state);
    }
    start(0);
  }

  function isActive() { return active; }

  XH.tutorial = { onHallEnter: onHallEnter, onScreen: onScreen, reset: reset, isActive: isActive };
})();
