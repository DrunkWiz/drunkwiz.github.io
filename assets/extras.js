/* index.html only. Loaded with defer, after receipt.js.
   Printed slips, receipt-line shortcuts, the pinboard of posted tears,
   screens that scroll with the page, tear sound, and thermal fade. */
(function () {
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  function store(k, v) { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) { return null; } }

  /* ---- 1. Each top project prints a slip when it scrolls into view ---- */
  var slips = document.querySelectorAll('.slip');
  if (reduce || !('IntersectionObserver' in window)) slips.forEach(function (s) { s.classList.add('printed'); });
  else {
    var so = new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('printing'); so.unobserve(e.target); } });
    }, { threshold: 0.5 });
    slips.forEach(function (s) { so.observe(s); });
  }

  /* ---- 2. Receipt lines jump to their project ---- */
  document.addEventListener('receipt:goto', function (e) {
    var t = document.getElementById(e.detail.id);
    if (!t) return;
    t.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
    t.classList.remove('lit'); void t.offsetWidth; t.classList.add('lit');
    var h = t.querySelector('h3, h2');
    if (h) { h.setAttribute('tabindex', '-1'); h.focus({ preventScroll: true }); }
  });

  /* ---- 3. Thermal fade: older lines print fainter ---- */
  var now = Date.now();
  document.querySelectorAll('.printer [data-date]').forEach(function (li) {
    var days = Math.max(0, (now - Date.parse(li.getAttribute('data-date'))) / 864e5);
    li.style.setProperty('--age', Math.min(0.5, days * 0.0045).toFixed(3));
  });

  /* ---- 4. Pinboard: every piece that fits the slot gets pinned ---- */
  var board = document.querySelector('.board'), pins = board && board.querySelector('.pins');
  var empty = board && board.querySelector('.board-empty'), clear = board && board.querySelector('.board-clear');
  var saved = [];
  try { saved = JSON.parse(store('dw-pins') || '[]') || []; } catch (e) { saved = []; }
  function scrap(p, fresh) {
    // the posted piece is the part below the tear; draw its torn top edge
    var W = 150, top = 26, ys = p.edge.map(function (q) { return q[1]; });
    var mid = (Math.max.apply(null, ys) + Math.min.apply(null, ys)) / 2;
    var pts = p.edge.map(function (q) { return (q[0] * W).toFixed(1) + ',' + (top + (q[1] - mid) * 0.35).toFixed(1); });
    var poly = '0,' + (top + (p.edge[0][1] - mid) * 0.35).toFixed(1) + ' ' + pts.join(' ') + ' ' + W + ',' + (top + (p.edge[p.edge.length - 1][1] - mid) * 0.35).toFixed(1) + ' ' + W + ',150 0,150';
    var rot = ((parseInt(p.no, 10) * 37) % 11 - 5);
    var li = document.createElement('li');
    li.className = 'pin' + (fresh && !reduce ? ' new' : '');
    li.style.setProperty('--r', rot + 'deg');
    li.innerHTML = '<svg viewBox="0 0 150 150" aria-hidden="true"><polygon points="' + poly + '"/></svg>' +
      '<div class="pin-txt"><b>No. ' + p.no + '</b><span>' + p.shape + ' slot</span><span>' + p.pct + '% match</span></div>' +
      '<i class="tack" aria-hidden="true"></i>';
    li.setAttribute('aria-label', 'Receipt ' + p.no + ', torn in a ' + p.shape + ' shape, ' + p.pct + '% match');
    return li;
  }
  function renderBoard() {
    if (!board) return;
    pins.innerHTML = '';
    saved.forEach(function (p) { pins.appendChild(scrap(p)); });
    empty.hidden = saved.length > 0; clear.hidden = saved.length === 0;
  }
  document.addEventListener('receipt:posted', function (e) {
    if (!board) return;
    saved.push(e.detail); if (saved.length > 12) saved.shift();
    store('dw-pins', JSON.stringify(saved));
    renderBoard();
    var last = pins.lastElementChild; if (last && !reduce) last.classList.add('new');
  });
  if (clear) clear.addEventListener('click', function () { saved = []; store('dw-pins', '[]'); renderBoard(); });
  renderBoard();

  /* ---- 5. Tall screens scroll with the page, like a screen recording ---- */
  var screens = [].slice.call(document.querySelectorAll('main .screen:not(.fit)')).filter(function (s) { return s.querySelector('img'); });
  if (!reduce && screens.length) {
    var ticking = false;
    function update() {
      ticking = false;
      var vh = window.innerHeight;
      screens.forEach(function (s) {
        var r = s.getBoundingClientRect();
        if (r.bottom < -200 || r.top > vh + 200) return;
        // 0 when the screen's top enters at 85% of the viewport, 1 when its bottom passes 25%
        var p = (vh * 0.85 - r.top) / (vh * 0.6 + r.height);
        s.style.setProperty('--p', Math.max(0, Math.min(1, p)).toFixed(3));
      });
    }
    document.documentElement.classList.add('scrolly');
    window.addEventListener('scroll', function () { if (!ticking) { ticking = true; requestAnimationFrame(update); } }, { passive: true });
    window.addEventListener('resize', update);
    update();
  }

  /* ---- 6. Paper-rip sound, made on the fly. Mutable, remembered. ---- */
  var AC = window.AudioContext || window.webkitAudioContext;
  var soundBtn = document.querySelector('.sound-btn');
  if (AC && soundBtn) {
    var on = store('dw-sound') !== '0', ctx = null, rip = null;
    soundBtn.hidden = false;
    function paint() { soundBtn.setAttribute('aria-pressed', on); soundBtn.querySelector('.mode-state').textContent = on ? 'on' : 'off'; }
    soundBtn.addEventListener('click', function () { on = !on; store('dw-sound', on ? '1' : '0'); paint(); if (!on) stop(); });
    paint();
    function audio() { if (!ctx) ctx = new AC(); if (ctx.state === 'suspended') ctx.resume(); return ctx; }
    function noise(c, secs) {
      var buf = c.createBuffer(1, Math.floor(c.sampleRate * secs), c.sampleRate), d = buf.getChannelData(0);
      // crackly noise: bursts of grain, like fibres giving way
      for (var i = 0, g = 0; i < d.length; i++) { if (Math.random() < 0.004) g = Math.random(); g *= 0.9993; d[i] = (Math.random() * 2 - 1) * (0.25 + g); }
      return buf;
    }
    function start() {
      if (!on) return;
      var c = audio(); stop();
      var src = c.createBufferSource(); src.buffer = noise(c, 2.5);
      var bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 2600; bp.Q.value = 0.7;
      var g = c.createGain(); g.gain.setValueAtTime(0, c.currentTime); g.gain.linearRampToValueAtTime(0.16, c.currentTime + 0.05);
      src.connect(bp).connect(g).connect(c.destination); src.start();
      rip = { src: src, g: g };
    }
    function stop() {
      if (!rip || !ctx) return;
      var r = rip; rip = null;
      r.g.gain.cancelScheduledValues(ctx.currentTime);
      r.g.gain.setTargetAtTime(0, ctx.currentTime, 0.03);
      setTimeout(function () { try { r.src.stop(); } catch (e) {} }, 200);
    }
    function thunk() {
      if (!on) return;
      var c = audio(), o = c.createOscillator(), g = c.createGain();
      o.type = 'sine'; o.frequency.setValueAtTime(150, c.currentTime); o.frequency.exponentialRampToValueAtTime(55, c.currentTime + 0.18);
      g.gain.setValueAtTime(0.28, c.currentTime); g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.25);
      o.connect(g).connect(c.destination); o.start(); o.stop(c.currentTime + 0.3);
    }
    document.addEventListener('receipt:tearstart', start);
    document.addEventListener('receipt:torn', stop);
    document.addEventListener('receipt:posted', thunk);
  }

  /* ---- 7. Card -> write-up transition: name only the card being opened ---- */
  document.addEventListener('click', function (e) {
    var a = e.target.closest('a[href^="projects.html#"]');
    if (!a) return;
    var card = a.closest('.feat, .mini');
    if (card) card.style.viewTransitionName = 'project';
  });
  window.addEventListener('pageshow', function () {
    document.querySelectorAll('.feat, .mini').forEach(function (c) { c.style.viewTransitionName = ''; });
  });
})();
