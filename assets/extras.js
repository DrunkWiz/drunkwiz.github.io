/* index.html only. Loaded with defer, after receipt.js.
   Printed slips, receipt-line shortcuts, the pinboard of posted tears,
   screens that scroll with the page, tear sound, thermal fade, and the
   card-to-write-up transition. receipt.js tells this file what happened
   through receipt:* events. */
(function () {
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  function store(k, v) { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) { return null; } }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  var DAY = 864e5, now = Date.now();

  /* ---- Printed slips: each top project prints one as it scrolls into view ---- */
  var slips = document.querySelectorAll('.slip');
  if (reduce || !('IntersectionObserver' in window)) slips.forEach(function (s) { s.classList.add('printed'); });
  else {
    var so = new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('printing'); so.unobserve(e.target); } });
    }, { threshold: 0.5 });
    slips.forEach(function (s) { so.observe(s); });
  }

  /* ---- Receipt shortcuts: a project name on the receipt jumps to its card ---- */
  document.addEventListener('receipt:goto', function (e) {
    var t = document.getElementById(e.detail.id);
    if (!t) return;
    t.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
    t.classList.remove('lit'); void t.offsetWidth; t.classList.add('lit');
    var h = t.querySelector('h3') || t.querySelector('h2') || t;
    h.setAttribute('tabindex', '-1'); h.focus({ preventScroll: true });
  });

  /* ---- Thermal fade: older print is fainter and browner, like real thermal paper ---- */
  function age(ts) { return clamp((now - ts) / DAY * 0.008, 0, 0.6); }
  document.querySelectorAll('.printer [data-date]').forEach(function (li) {
    li.style.setProperty('--age', age(Date.parse(li.getAttribute('data-date'))).toFixed(3));
  });

  /* ---- Pinboard: every piece that fits the slot is pinned, showing what it carried ---- */
  var board = document.querySelector('.board'), pins = board && board.querySelector('.pins');
  var empty = board && board.querySelector('.board-empty'), clear = board && board.querySelector('.board-clear');
  var note = document.querySelector('.pinned-note');
  var saved = [];
  try { saved = JSON.parse(store('dw-pins') || '[]') || []; } catch (e) { saved = []; }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function scrap(p) {
    // The posted piece is the part below the tear, so its torn edge is on top.
    var W = 160, TOP = 22, H = 180, ys = p.edge.map(function (q) { return q[1]; });
    var mid = (Math.max.apply(null, ys) + Math.min.apply(null, ys)) / 2;
    function y(v) { return (TOP + (v - mid) * 0.32).toFixed(1); }
    var poly = '0,' + y(p.edge[0][1]) + ' ' + p.edge.map(function (q) { return (q[0] * W).toFixed(1) + ',' + y(q[1]); }).join(' ') +
      ' ' + W + ',' + y(p.edge[p.edge.length - 1][1]) + ' ' + W + ',' + H + ' 0,' + H;
    var lines = (p.lines || []).slice(0, 5);
    var li = document.createElement('li');
    li.className = 'pin';
    li.style.setProperty('--r', (((parseInt(p.no, 10) || 1) * 37) % 11 - 5) + 'deg');
    li.style.setProperty('--age', age(p.at || now).toFixed(3));
    li.innerHTML = '<svg viewBox="0 0 ' + W + ' ' + H + '" aria-hidden="true"><polygon points="' + poly + '"/></svg>' +
      '<div class="pin-txt"><b>No. ' + esc(p.no) + '</b>' +
      (lines.length ? '<ul>' + lines.map(function (l) { return '<li>' + esc(l) + '</li>'; }).join('') + '</ul>' : '<span class="blank">just the tail</span>') +
      '<span class="fit">' + esc(p.shape) + ' &middot; ' + p.pct + '%</span></div><i class="tack" aria-hidden="true"></i>';
    li.setAttribute('aria-label', 'Receipt ' + p.no + ', torn in a ' + p.shape + ' shape, ' + p.pct + '% match' + (lines.length ? ', carrying ' + lines.join(', ') : ''));
    return li;
  }
  function renderBoard(fresh) {
    if (!board) return;
    pins.innerHTML = '';
    saved.forEach(function (p, i) {
      var el = scrap(p);
      if (fresh && i === saved.length - 1 && !reduce) el.classList.add('new');
      pins.appendChild(el);
    });
    empty.hidden = saved.length > 0; clear.hidden = saved.length === 0;
  }
  document.addEventListener('receipt:posted', function (e) {
    if (!board) return;
    var p = e.detail; p.at = Date.now();
    saved.push(p); if (saved.length > 12) saved.shift();
    store('dw-pins', JSON.stringify(saved));
    renderBoard(true);
    if (note) {
      note.textContent = 'No. ' + p.no + ' pinned to the board ↓';
      note.hidden = false;
      clearTimeout(note._t); note._t = setTimeout(function () { note.hidden = true; }, 7000);
    }
  });
  if (clear) clear.addEventListener('click', function () { saved = []; store('dw-pins', '[]'); renderBoard(); });
  renderBoard();

  /* ---- Tall screens scroll with the page, like a screen recording.
     The top of each screen holds still first, so it gets read. ---- */
  var screens = [].slice.call(document.querySelectorAll('main .screen:not(.fit)')).filter(function (s) { return s.querySelector('img'); });
  if (!reduce && screens.length) {
    var ticking = false;
    var update = function () {
      ticking = false;
      var vh = window.innerHeight;
      screens.forEach(function (s) {
        var r = s.getBoundingClientRect();
        if (r.bottom < -200 || r.top > vh + 200) return;
        var p = clamp((vh * 0.85 - r.top) / (vh * 0.6 + r.height), 0, 1);
        p = clamp((p - 0.22) / 0.78, 0, 1);       // hold on the top for a moment
        p = p * p * (3 - 2 * p);                  // ease in and out
        s.style.setProperty('--p', p.toFixed(3));
      });
    };
    document.documentElement.classList.add('scrolly');
    window.addEventListener('scroll', function () { if (!ticking) { ticking = true; requestAnimationFrame(update); } }, { passive: true });
    window.addEventListener('resize', update);
    update();
  }

  /* ---- Paper-rip sound, made on the fly. Loud when the tear moves fast, silent when it stops. ---- */
  var AC = window.AudioContext || window.webkitAudioContext;
  var soundBtn = document.querySelector('.sound-btn');
  if (AC && soundBtn) {
    var on = store('dw-sound') !== '0', ctx = null, rip = null, buf = null;
    soundBtn.hidden = false;
    var paint = function () { soundBtn.setAttribute('aria-pressed', on); soundBtn.querySelector('.mode-state').textContent = on ? 'on' : 'off'; };
    soundBtn.addEventListener('click', function () { on = !on; store('dw-sound', on ? '1' : '0'); paint(); if (!on) stop(); });
    paint();
    var audio = function () { if (!ctx) ctx = new AC(); if (ctx.state === 'suspended') ctx.resume(); return ctx; };
    var noise = function (c) {
      if (buf) return buf;
      buf = c.createBuffer(1, Math.floor(c.sampleRate * 1.5), c.sampleRate);
      var d = buf.getChannelData(0);
      // crackly noise: bursts of grain, like fibres giving way
      for (var i = 0, g = 0; i < d.length; i++) { if (Math.random() < 0.004) g = Math.random(); g *= 0.9993; d[i] = (Math.random() * 2 - 1) * (0.25 + g); }
      return buf;
    };
    var start = function () {
      if (!on) return;
      var c = audio(); stop();
      var src = c.createBufferSource(); src.buffer = noise(c); src.loop = true;
      var bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 2400; bp.Q.value = 0.8;
      var g = c.createGain(); g.gain.value = 0;
      src.connect(bp).connect(g).connect(c.destination); src.start();
      rip = { src: src, g: g, bp: bp };
    };
    var move = function (e) {
      if (!rip) return;
      var t = ctx.currentTime, sp = clamp(e.detail.speed, 0, 1);
      rip.g.gain.cancelScheduledValues(t);
      rip.g.gain.setTargetAtTime(0.05 + sp * 0.17, t, 0.015);   // follow the hand
      rip.g.gain.setTargetAtTime(0, t + 0.06, 0.05);             // and fall silent if it stops
      rip.bp.frequency.setTargetAtTime(1800 + sp * 1600, t, 0.03);
    };
    var stop = function () {
      if (!rip || !ctx) return;
      var r = rip; rip = null;
      r.g.gain.cancelScheduledValues(ctx.currentTime);
      r.g.gain.setTargetAtTime(0, ctx.currentTime, 0.03);
      setTimeout(function () { try { r.src.stop(); } catch (err) {} }, 250);
    };
    var thunk = function () {
      if (!on) return;
      var c = audio(), o = c.createOscillator(), g = c.createGain();
      o.type = 'sine'; o.frequency.setValueAtTime(150, c.currentTime); o.frequency.exponentialRampToValueAtTime(55, c.currentTime + 0.18);
      g.gain.setValueAtTime(0.25, c.currentTime); g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.25);
      o.connect(g).connect(c.destination); o.start(); o.stop(c.currentTime + 0.3);
    };
    document.addEventListener('receipt:tearstart', start);
    document.addEventListener('receipt:tearmove', move);
    document.addEventListener('receipt:torn', stop);
    document.addEventListener('receipt:posted', thunk);
  }

  /* ---- Card -> write-up: the title and screen glide to their place on projects.html ---- */
  function name(card, on) {
    var t = card.querySelector('h3'), s = card.querySelector('.shot');
    if (t) t.style.viewTransitionName = on ? 'p-title' : '';
    if (s) s.style.viewTransitionName = on ? 'p-shot' : '';
  }
  document.addEventListener('click', function (e) {
    var a = e.target.closest('a[href^="projects.html#"]');
    var card = a && a.closest('.feat, .mini');
    if (card) name(card, true);
  });
  window.addEventListener('pageshow', function () {
    document.querySelectorAll('.feat, .mini').forEach(function (c) { name(c, false); });
  });
})();
