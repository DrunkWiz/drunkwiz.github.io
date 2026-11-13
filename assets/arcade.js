/* index.html only. Loaded by extras.js when the arcade shelf scrolls near, after arcade-art.js.
   The arcade shelf: click a machine and the page zooms into it; each one runs a small fishing game.
   Loop: aim, hold to charge, release to cast, wait (fake nibbles), bite, hook, reel on a tension bar,
   catch or lose. Catches go to the fish log (dw-fish) and out as an arcade:catch event, which the
   slip printer and the board listen for. Nothing is sent anywhere. */
(function () {
  var ART = window.drunkwizArt;
  if (!ART || window.drunkwizArcade) return;
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------------------------------------------------------------- Tuning
     Every number that changes how it plays or looks, with why. */
  var BOOT_MS = 1300;          // made-up boot; the spec caps it at 1.5 s and any key skips it
  var WAIT_MIN = 2000;         // shortest wait for a bite (spec: 2 to 8 s)
  var WAIT_MAX = 8000;         // longest wait for a bite
  var NIBBLES_MAX = 2;         // up to two fake nibbles per wait, so a twitch isn't always a bite
  var NIBBLE_CHANCE = 0.6;     // chance of each possible nibble happening
  var NIBBLE_MS = 260;         // a nibble twitches the float about this long
  var CAST_MS = 450;           // the float's flight; long enough to see, short enough not to wait on
  var CHARGE_MS = 1100;        // empty to full power; then the bar falls back, so holding forever isn't free
  var NEAR_SPLIT = 0.5;        // casts under half power land in the near half of the pond
  var AIM_SPEED = 70;          // logical px per second the aim moves while an arrow is held
  var LOST_MS = 1500;          // how long a "got away" message stays before you can cast again
  var CARD_LOCK_MS = 700;      // the catch card ignores presses this long, so a held reel doesn't skip it
  var START_PROGRESS = 0.3;    // a hooked fish starts with the meter a third full: a fair start, not a free one
  var BOUNCE = 0.35;           // the catch zone keeps 35% of its speed when it hits the bottom of the bar
  var FISH_PAUSE_MS = [200, 700];   // how long a fish holds still when it pauses
  var STATUS_GAP_MS = 1200;    // screen-reader tension status updates at most this often
  var INT_SCALE_LOSS = 0.25;   // use whole-number scaling unless it would waste more than a quarter of the space

  // How each rarity fights. speed/dashSpeed: bar heights per second. dash, pause: chance per second / per stop.
  // weight: how often it bites, against the others it shares the water with.
  var RARITY = {
    common:   { speed: 0.32, dashSpeed: 0.9, dash: 0.10, pause: 0.40, weight: 14 },   // 5 commons: about 70 together
    uncommon: { speed: 0.45, dashSpeed: 1.2, dash: 0.25, pause: 0.30, weight: 18 },
    rare:     { speed: 0.62, dashSpeed: 1.8, dash: 0.55, pause: 0.18, weight: 7 },    // the hardest regular fight
    night:    { speed: 0.58, dashSpeed: 1.6, dash: 0.45, pause: 0.15, weight: 24 }    // only bites 3:33 to 5:55am, so it bites often then
  };

  // Machine base difficulty. zone: catch-zone height as part of the bar. lift/gravity: bar heights per s².
  // fill/drain: meter per second. hook: ms to strike after a bite.
  var MACHINES = {
    pocket: { name: 'Pocket', label: 'Pocket console', pal: 'pocket', W: 160, H: 144, hook: 600, zone: 0.32, lift: 2.6, gravity: 1.6, fill: 0.42, drain: 0.24,
      keys: 'Space, Enter or Z: cast, hook, reel. Arrows: aim. X: reel in. Esc: leave.' }
  };
  var PAGE_MARGIN = 16;        // gap kept between the machine and the window edge
  var CHROME_H = 36;           // room for the key help line under the machine (the close button floats)

  /* ---------------------------------------------------------------- Seeded randomness (tests can fix the seed) */
  var seed = (Date.now() ^ (Math.random() * 1e9)) >>> 0;
  function rnd() {
    seed = (seed + 0x6D2B79F5) | 0;
    var t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  function between(a, b) { return a + (b - a) * rnd(); }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

  // Night fish keep the same hours as closing time (eggs.js), on the visitor's own clock.
  function night() { return window.drunkwizClosing ? window.drunkwizClosing(new Date()) : false; }

  /* ---------------------------------------------------------------- Fish log: dw-fish, versioned */
  var LOG_KEY = 'dw-fish';
  function loadLog() {
    try { var o = JSON.parse(localStorage.getItem(LOG_KEY) || 'null'); if (o && o.v === 1 && o.fish) return o; } catch (e) {}
    return { v: 1, n: 0, feed: 0, fish: {} };   // n: catches ever (numbers the slips); feed: stock for the pet
  }
  var log = loadLog();
  function saveLog() { try { localStorage.setItem(LOG_KEY, JSON.stringify(log)); } catch (e) {} }
  function caughtIn(pond) { return ART.FISH[pond].filter(function (f) { return log.fish[f.id]; }).length; }

  /* ---------------------------------------------------------------- Shelf */
  var shelf = document.querySelector('.arcade');
  function labelShelf() {
    if (!shelf) return;
    shelf.querySelectorAll('.mach').forEach(function (b) {
      var m = MACHINES[b.getAttribute('data-mach')];
      if (!m) return;
      b.disabled = false;
      b.setAttribute('aria-label', m.label + '. Pond: ' + caughtIn(b.getAttribute('data-mach')) + ' of ' + ART.FISH[b.getAttribute('data-mach')].length + ' caught.');
    });
  }
  labelShelf();
  if (shelf) shelf.addEventListener('click', function (e) {
    var b = e.target.closest('.mach');
    if (b && !b.disabled && MACHINES[b.getAttribute('data-mach')]) open(b.getAttribute('data-mach'), b);
  });

  /* ---------------------------------------------------------------- The dialog around a machine */
  var dlg = null, shell, cv, ctx, live, tstat, closeBtn, keysEl, from = null, cur = null, pushed = false, isOpen = false;
  function build() {
    dlg = document.createElement('dialog');
    dlg.className = 'arc';
    dlg.innerHTML =
      '<div class="arc-stage"><div class="arc-shell">' +
        '<div class="arc-bezel"><i class="arc-led" aria-hidden="true"></i><canvas class="arc-cv" tabindex="0"></canvas></div>' +
        '<p class="arc-brand" aria-hidden="true"></p>' +
        '<div class="arc-ctl">' +
          '<div class="arc-dpad">' +
            '<button type="button" tabindex="-1" data-k="up" aria-label="Up"></button><button type="button" tabindex="-1" data-k="left" aria-label="Aim left"></button>' +
            '<button type="button" tabindex="-1" data-k="right" aria-label="Aim right"></button><button type="button" tabindex="-1" data-k="down" aria-label="Down"></button><i aria-hidden="true"></i>' +
          '</div>' +
          '<div class="arc-ab"><button type="button" tabindex="-1" data-k="b" aria-label="B: reel in">B</button><button type="button" tabindex="-1" data-k="a" aria-label="A: cast, hook, reel">A</button></div>' +
        '</div>' +
      '</div></div>' +
      '<p class="arc-keys"></p>' +
      '<button type="button" class="arc-close">Close</button>' +
      '<p class="sr-only arc-live" aria-live="polite"></p><p class="sr-only arc-tension" role="status"></p>';
    document.body.appendChild(dlg);
    shell = dlg.querySelector('.arc-shell'); cv = dlg.querySelector('.arc-cv'); ctx = cv.getContext('2d');
    live = dlg.querySelector('.arc-live'); tstat = dlg.querySelector('.arc-tension');
    closeBtn = dlg.querySelector('.arc-close'); keysEl = dlg.querySelector('.arc-keys');
    closeBtn.addEventListener('click', requestClose);
    dlg.addEventListener('cancel', function (e) { e.preventDefault(); requestClose(); });
    dlg.addEventListener('close', function () { if (isOpen) finishClose(); });
    // Clicking the dark area around the machine leaves, like Esc.
    dlg.addEventListener('click', function (e) { if (e.target === dlg || e.target.classList.contains('arc-stage')) requestClose(); });
    // Keep swipes and taps in here from reaching the page's own touch eggs (the Konami swipe).
    ['touchstart', 'touchmove', 'touchend', 'touchcancel'].forEach(function (t) { dlg.addEventListener(t, function (e) { e.stopPropagation(); }, { passive: true }); });
    // On-screen buttons: hold to hold.
    dlg.querySelectorAll('[data-k]').forEach(function (b) {
      var k = b.getAttribute('data-k');
      b.addEventListener('pointerdown', function (e) { e.preventDefault(); try { b.setPointerCapture(e.pointerId); } catch (x) {} b.classList.add('down'); press(k); });
      var up = function () { b.classList.remove('down'); release(k); };
      b.addEventListener('pointerup', up); b.addEventListener('pointercancel', up); b.addEventListener('lostpointercapture', up);
      b.addEventListener('click', function (e) { e.preventDefault(); });
    });
    // The screen itself: point to aim, press and hold like A.
    cv.addEventListener('pointerdown', function (e) {
      e.preventDefault(); cv.focus({ preventScroll: true });
      try { cv.setPointerCapture(e.pointerId); } catch (x) {}
      if (G.state === 'aim') G.aimX = clamp(toLogical(e).x, 12, M.W - 12);
      press('a');
    });
    cv.addEventListener('pointermove', function (e) { if (G.state === 'aim' && e.pointerType === 'mouse') G.aimX = clamp(toLogical(e).x, 12, M.W - 12); });
    var cvUp = function () { release('a'); };
    cv.addEventListener('pointerup', cvUp); cv.addEventListener('pointercancel', cvUp);
    window.addEventListener('resize', function () { if (isOpen) layout(); });
    window.addEventListener('popstate', function () { if (isOpen) { pushed = false; close(); } });
    document.addEventListener('visibilitychange', function () { if (isOpen && !document.hidden) { last = performance.now(); loop(); } });
  }
  function toLogical(e) {
    var r = cv.getBoundingClientRect();
    return { x: (e.clientX - r.left) / r.width * M.W, y: (e.clientY - r.top) / r.height * M.H };
  }
  // Fit the screen to the window: whole-number scale when that doesn't waste much, otherwise exact.
  function layout() {
    // Measure the shell around a 1px screen: whatever is left over is the room the screen can have.
    var shut = !dlg.open;
    if (shut) { dlg.style.display = 'flex'; dlg.style.visibility = 'hidden'; }
    cv.style.width = cv.style.height = '1px';
    // Width: only the shell and bezel padding count (the controls can be wider than a tiny screen). Height: everything.
    var pw = function (el) { var c = getComputedStyle(el); return parseFloat(c.paddingLeft) + parseFloat(c.paddingRight); };
    var bx = pw(shell) + pw(cv.parentNode), by = shell.offsetHeight - 1;
    if (shut) { dlg.style.display = ''; dlg.style.visibility = ''; }
    var aw = window.innerWidth - PAGE_MARGIN * 2 - bx;
    var ah = window.innerHeight - PAGE_MARGIN * 2 - by - CHROME_H;
    var fit = Math.max(0.5, Math.min(aw / M.W, ah / M.H)), whole = Math.floor(fit);
    var s = whole >= 1 && (fit - whole) / fit <= INT_SCALE_LOSS ? whole : fit;
    cv.style.width = Math.floor(M.W * s) + 'px'; cv.style.height = Math.floor(M.H * s) + 'px';
  }

  var M = null, PAL = null;
  function open(id, btn) {
    if (isOpen || !MACHINES[id]) return;
    if (!dlg) build();
    cur = id; M = MACHINES[id]; PAL = ART.PAL[M.pal]; from = btn || shelf.querySelector('[data-mach="' + id + '"]');
    shell.setAttribute('data-m', id);
    dlg.setAttribute('aria-label', M.label + ', fishing game');
    dlg.querySelector('.arc-brand').textContent = M.name.toUpperCase();
    cv.width = M.W; cv.height = M.H; ctx.imageSmoothingEnabled = false;
    cv.setAttribute('aria-label', M.name + ' pond. ' + M.keys);
    keysEl.textContent = M.keys;
    layout();
    reset();
    isOpen = true;
    var show = function () { dlg.showModal(); cv.focus({ preventScroll: true }); };
    if (reduce || !from) { dlg.classList.add('fade'); show(); }
    else if (document.startViewTransition) {
      // Zoom: the shelf machine and the big one share a name, so the browser morphs one into the other.
      from.style.viewTransitionName = 'arc-mach';
      document.startViewTransition(function () { from.style.viewTransitionName = ''; shell.style.viewTransitionName = 'arc-mach'; show(); })
        .finished.finally(function () { shell.style.viewTransitionName = ''; });
    } else { show(); zoomFrom(); }
    try { history.pushState({ dwArcade: id }, ''); pushed = true; } catch (e) { pushed = false; }
    last = performance.now(); loop();
  }
  // Fallback zoom without view transitions: scale the shell up from where the shelf machine sits.
  function zoomFrom() {
    if (!from || !shell.animate) return;
    var a = from.getBoundingClientRect(), b = shell.getBoundingClientRect();
    var sx = a.width / b.width, dx = a.left + a.width / 2 - (b.left + b.width / 2), dy = a.top + a.height / 2 - (b.top + b.height / 2);
    shell.animate([{ transform: 'translate(' + dx + 'px,' + dy + 'px) scale(' + sx + ')', opacity: 0.4 }, { transform: 'none', opacity: 1 }],
      { duration: 380, easing: 'cubic-bezier(.2,.8,.2,1)' });
  }
  function requestClose() { if (pushed) { pushed = false; history.back(); } else close(); }
  function close() {
    if (!isOpen) return;
    if (reduce || !from || !document.startViewTransition) { dlg.close(); return; }
    shell.style.viewTransitionName = 'arc-mach';
    document.startViewTransition(function () { shell.style.viewTransitionName = ''; from.style.viewTransitionName = 'arc-mach'; dlg.close(); })
      .finished.finally(function () { if (from) from.style.viewTransitionName = ''; });
  }
  function finishClose() {
    isOpen = false; cancelAnimationFrame(raf); held = {};
    dlg.classList.remove('fade');
    labelShelf();
    if (from) from.focus({ preventScroll: true });
  }

  /* ---------------------------------------------------------------- Input */
  var KEYS = { ' ': 'a', Enter: 'a', z: 'a', Z: 'a', x: 'b', X: 'b', Backspace: 'b', ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down' };
  var held = {}, hit = {};
  function press(k) { if (!held[k]) hit[k] = true; held[k] = true; }
  function release(k) { held[k] = false; }
  window.addEventListener('keydown', function (e) {
    if (!isOpen || e.key === 'Escape' || e.key === 'Tab') return;
    if (e.target === closeBtn && (e.key === 'Enter' || e.key === ' ')) return;
    e.stopPropagation();   // keep kopi orders, the Konami code and digicam (D) from firing underneath
    var k = KEYS[e.key];
    if (k) { e.preventDefault(); if (!e.repeat) press(k); }
    else if (G.state === 'boot') G.skip = true;
  }, true);
  window.addEventListener('keyup', function (e) {
    if (!isOpen) return;
    e.stopPropagation();
    var k = KEYS[e.key]; if (k) release(k);
  }, true);

  /* ---------------------------------------------------------------- Game state */
  var G = {};
  function reset() {
    G = { state: 'boot', t0: performance.now(), aimX: M.W / 2, power: 0, msg: '', nibbles: [], ripple: [], shadows: [] };
    for (var i = 0; i < 4; i++) G.shadows.push({ x: between(10, M.W - 10), y: between(28, 100), v: between(-6, 6) || 3 });
    held = {}; hit = {};
  }
  var POND_TOP = 24, POND_NEAR = 104;          // logical y of the far and near edges of the water you can reach
  function landY(p) { return POND_NEAR - p * (POND_NEAR - POND_TOP); }
  function rodTip() { return { x: 80 + (G.aimX - 80) * 0.18, y: 104 }; }

  function pickFish(zone) {
    var nite = night();
    var pool = ART.FISH[cur].filter(function (f) {
      if (f.rarity === 'night' && !nite) return false;   // night fish never bite outside the window
      return f.where === 'any' || f.where === zone;
    });
    var total = pool.reduce(function (s, f) { return s + RARITY[f.rarity].weight; }, 0), r = rnd() * total;
    for (var i = 0; i < pool.length; i++) { r -= RARITY[pool[i].rarity].weight; if (r <= 0) return pool[i]; }
    return pool[pool.length - 1];
  }
  function lose(msg, say) { G.state = 'lost'; G.msg = msg; G.until = performance.now() + LOST_MS; announce(say); }
  function announce(s) { if (live) { live.textContent = ''; setTimeout(function () { live.textContent = s; }, 30); } }

  function update(now, dt) {
    var s = G.state;
    if (s === 'boot') {
      if (G.skip || hit.a || hit.b || now - G.t0 > BOOT_MS) { G.state = 'aim'; announce(M.name + ' pond. Hold A to charge, let go to cast.'); }
    } else if (s === 'aim') {
      if (held.left) G.aimX -= AIM_SPEED * dt;
      if (held.right) G.aimX += AIM_SPEED * dt;
      G.aimX = clamp(G.aimX, 12, M.W - 12);
      if (hit.a) { G.state = 'charge'; G.c0 = now; }
    } else if (s === 'charge') {
      var p = ((now - G.c0) / CHARGE_MS) % 2; G.power = p > 1 ? 2 - p : p;
      if (held.left) G.aimX = clamp(G.aimX - AIM_SPEED * dt, 12, M.W - 12);
      if (held.right) G.aimX = clamp(G.aimX + AIM_SPEED * dt, 12, M.W - 12);
      if (hit.b) G.state = 'aim';
      else if (!held.a) {
        G.state = 'cast'; G.c0 = now; G.zone = G.power < NEAR_SPLIT ? 'near' : 'far';
        G.to = { x: G.aimX, y: landY(G.power) }; G.fl = rodTip();
      }
    } else if (s === 'cast') {
      var q = Math.min(1, (now - G.c0) / CAST_MS), tip = rodTip();
      G.fl = { x: tip.x + (G.to.x - tip.x) * q, y: tip.y + (G.to.y - tip.y) * q - Math.sin(Math.PI * q) * 22 };
      if (q >= 1) {
        G.state = 'wait'; G.fl = { x: G.to.x, y: G.to.y }; G.ripple.push({ x: G.fl.x, y: G.fl.y, t: now });
        var wait = between(WAIT_MIN, WAIT_MAX); G.biteAt = now + wait; G.nibbles = [];
        for (var n = 0; n < NIBBLES_MAX; n++) if (rnd() < NIBBLE_CHANCE) G.nibbles.push(now + between(600, Math.max(700, wait - 700)));
      }
    } else if (s === 'wait') {
      if (hit.a) lose('TOO EARLY.', 'Too early. Nothing on the line.');
      else if (hit.b) G.state = 'aim';
      else if (now >= G.biteAt) {
        G.fish = pickFish(G.zone); G.state = 'bite'; G.c0 = now;
        G.ripple.push({ x: G.fl.x, y: G.fl.y, t: now });
        announce('Bite!');
      }
    } else if (s === 'bite') {
      if (hit.a) startReel(now);
      else if (hit.b) G.state = 'aim';
      else if (now - G.c0 > M.hook) lose('IT GOT AWAY.', 'Too slow. It got away.');
    } else if (s === 'reel') {
      reel(now, dt);
    } else if (s === 'card') {
      if ((hit.a || hit.b) && now - G.c0 > CARD_LOCK_MS) G.state = 'aim';
    } else if (s === 'lost') {
      if (now > G.until || ((hit.a || hit.b) && now > G.until - LOST_MS + 400)) G.state = 'aim';
    }
    hit = {};
  }

  /* ---------------------------------------------------------------- The fight: a vertical bar.
     0 is the bottom, 1 the top. Holding A lifts your zone, letting go lets it fall. The meter fills while
     the fish is inside the zone and drains while it's outside. Full: caught. Empty: the line snaps. */
  function startReel(now) {
    var R = RARITY[G.fish.rarity];
    G.state = 'reel'; G.c0 = now; G.progress = START_PROGRESS;
    G.zy = 0; G.zv = 0; G.fy = between(0.3, 0.7); G.ft = between(0, 1); G.fs = R.speed; G.pause = 0; G.lastStat = 0; G.where = '';
    announce('Hooked. Hold to lift your zone, keep the fish inside it.');
  }
  function reel(now, dt) {
    var R = RARITY[G.fish.rarity], zone = M.zone;
    G.zv += (held.a ? M.lift : -M.gravity) * dt;
    G.zy += G.zv * dt;
    if (G.zy < 0) { G.zy = 0; G.zv = -G.zv * BOUNCE; if (G.zv < 0.05) G.zv = 0; }
    if (G.zy > 1 - zone) { G.zy = 1 - zone; G.zv = 0; }
    if (now >= G.pause) {
      if (rnd() < R.dash * dt) { G.ft = G.fy > 0.5 ? between(0, 0.3) : between(0.7, 1); G.fs = R.dashSpeed; }   // a dash, to the far side
      var d = G.ft - G.fy, step = G.fs * dt;
      if (Math.abs(d) <= step) {
        G.fy = G.ft; G.fs = R.speed; G.ft = between(0.05, 0.95);
        if (rnd() < R.pause) G.pause = now + between(FISH_PAUSE_MS[0], FISH_PAUSE_MS[1]);
      } else G.fy += Math.sign(d) * step;
    }
    var inside = G.fy >= G.zy && G.fy <= G.zy + zone;
    G.progress = clamp(G.progress + (inside ? M.fill : -M.drain) * dt, 0, 1);
    var where = inside ? 'Fish in your zone' : G.fy > G.zy ? 'Fish above your zone' : 'Fish below your zone';
    if (where !== G.where && now - G.lastStat > STATUS_GAP_MS) { G.where = where; G.lastStat = now; tstat.textContent = where; }
    if (G.progress >= 1) caught(now);
    else if (G.progress <= 0) { tstat.textContent = ''; lose('LINE SNAPPED.', 'The line snapped. The ' + G.fish.name + ' got away.'); }
  }
  function pad(n) { return String(n).padStart(2, '0'); }
  function caught(now) {
    var f = G.fish, d = new Date(), len = Math.round(between(f.size[0], f.size[1]) * 10) / 10;
    var e = log.fish[f.id], fresh = !e;
    if (!e) e = log.fish[f.id] = { c: 0, best: 0, first: d.getTime() };
    e.c++; e.best = Math.max(e.best, len); e.last = d.getTime();
    log.n++; log.feed++;
    saveLog();
    G.state = 'card'; G.c0 = now;
    G.card = { f: f, len: len.toFixed(1), time: pad(d.getHours()) + ':' + pad(d.getMinutes()), fresh: fresh, no: log.n };
    tstat.textContent = '';
    announce('Caught a ' + f.name + ', ' + len.toFixed(1) + ' cm.' + (fresh ? ' New in the log.' : '') + ' ' + f.desc);
    var img = ART.sheet(f.id, f.px, PAL).toDataURL();
    document.dispatchEvent(new CustomEvent('arcade:catch', { detail: {
      id: f.id, name: f.name, rarity: f.rarity, pond: M.name, len: len.toFixed(1), time: G.card.time, no: log.n, at: d.getTime(), fresh: fresh, img: img } }));
  }

  /* ---------------------------------------------------------------- Drawing: the pocket screen, 4 shades */
  function px(x, y, w, h, c) { ctx.fillStyle = PAL[c]; ctx.fillRect(Math.round(x), Math.round(y), w, h); }
  function line(x0, y0, x1, y1, c) {
    x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
    var dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1, err = dx + dy;
    ctx.fillStyle = PAL[c];
    for (var i = 0; i < 400; i++) {
      ctx.fillRect(x0, y0, 1, 1);
      if (x0 === x1 && y0 === y1) break;
      var e2 = 2 * err; if (e2 >= dy) { err += dy; x0 += sx; } if (e2 <= dx) { err += dx; y0 += sy; }
    }
  }
  function txt(s, x, y, c, al) { ART.text(ctx, s, x, y, PAL[c], al); }
  function box(x, y, w, h) { px(x, y, w, h, 3); px(x + 1, y + 1, w - 2, h - 2, 0); px(x + 2, y + 2, w - 4, h - 4, 3); px(x + 3, y + 3, w - 6, h - 6, 0); }

  function drawPocket(now) {
    var W = M.W, H = M.H, t = now / 1000, s = G.state;
    if (s === 'boot') {
      px(0, 0, W, H, 0);
      var q = Math.min(1, (now - G.t0) / (BOOT_MS * 0.6));
      txt(M.name.toUpperCase(), W / 2, Math.round(-8 + q * 70), 3, 'center');
      if (q >= 1) txt('FISHING', W / 2, 72, 2, 'center');
      return;
    }
    // water, with slow ripples
    px(0, 0, W, H, 1);
    for (var i = 0; i < 16; i++) {
      var rx = ((i * 41 + t * (4 + i % 3)) % (W + 10)) - 5, ry = 20 + (i * 29) % 90;
      px(rx, ry, 3 + (i % 3), 1, 0);
    }
    // fish shadows drift about
    G.shadows.forEach(function (f) {
      f.x += f.v * (1 / 30); if (f.x < 4 || f.x > W - 4) f.v = -f.v;
      px(f.x - 3, f.y, 7, 2, 2); px(f.x - 2, f.y - 1, 5, 1, 2); px(f.v > 0 ? f.x - 5 : f.x + 4, f.y, 2, 2, 2);
    });
    // far bank and reeds
    px(0, 10, W, 6, 2);
    for (var r = 3; r < W; r += 7) px(r, 7 + (r * 3) % 4, 1, 4, 3);
    // jetty and angler
    px(0, 112, W, H - 112, 2);
    for (var pl = 115; pl < H; pl += 5) px(0, pl, W, 1, 3);
    var tip = rodTip();
    ctx.drawImage(ART.sheet('angler', ART.ANGLER, PAL), 74, 106);
    line(84, 111, tip.x, tip.y, 3);
    // HUD
    px(0, 0, W, 9, 3);
    txt(M.name + ' pond', 3, 2, 0);
    txt(caughtIn(cur) + '/' + ART.FISH[cur].length, W - 3, 2, 0, 'right');
    // ripples where the float landed or something bit
    G.ripple = G.ripple.filter(function (rp) {
      var a = (now - rp.t) / 700; if (a > 1) return false;
      var rr = 2 + a * 7; px(rp.x - rr, rp.y + 2, rr * 2, 1, 0); return true;
    });
    if (s === 'aim' || s === 'charge') {
      // aim: a caret on the far bank, and the landing mark when charging
      txt('V', G.aimX, 17, 3, 'center');
      for (var dy = 26; dy < 100; dy += 6) px(G.aimX, dy, 1, 2, 2);
      if (s === 'charge') {
        var ly = landY(G.power);
        px(G.aimX - 3, ly, 7, 1, 3); px(G.aimX, ly - 3, 1, 7, 3);
        px(8, 128, 44, 7, 3); px(9, 129, 42, 5, 0); px(9, 129, Math.round(42 * G.power), 5, 2);
        txt(G.power < NEAR_SPLIT ? 'NEAR' : 'FAR', 56, 130, 0);
      } else if (((now / 500) | 0) % 2 === 0) txt('HOLD A TO CAST', W / 2, 131, 0, 'center');
    }
    if (s === 'cast' || s === 'wait' || s === 'bite') {
      var fx = G.fl.x, fy = G.fl.y;
      if (s === 'wait') {
        var nib = G.nibbles.some(function (nt) { return now >= nt && now < nt + NIBBLE_MS; });
        fy += nib ? 2 : (Math.sin(t * 3) > 0.6 ? 1 : 0);
      }
      if (s === 'bite') fy += 2;
      line(tip.x, tip.y, fx + 1, fy, 3);
      if (s === 'bite') {
        px(fx - 3, fy + 3, 9, 1, 0);
        ctx.drawImage(ART.sheet('float', ART.FLOAT.slice(0, 2), PAL), Math.round(fx), Math.round(fy + 1));
        if (((now - G.c0) / 90 | 0) % 2 === 0) ctx.drawImage(ART.sheet('bite', ART.BITE, PAL), Math.round(fx), Math.round(fy - 9));
      } else ctx.drawImage(ART.sheet('float', ART.FLOAT, PAL), Math.round(fx), Math.round(fy));
      if (s === 'wait') txt('WAIT...', W / 2, 131, 0, 'center');
    }
    if (s === 'bite' && now - G.c0 < 70) { ctx.globalAlpha = 0.7; px(0, 0, W, H, 0); ctx.globalAlpha = 1; }   // the flash cue
    if (s === 'reel') drawReel(now);
    if (s === 'card') drawCard();
    if (s === 'lost') { box(24, 52, 112, 28); txt(G.msg, W / 2, 64, 3, 'center'); }
  }
  function drawReel(now) {
    var W = M.W, x = 132, y = 16, h = 92, w = 16;
    // taut line from the rod to the water
    var tip = rodTip(); line(tip.x, tip.y, G.to.x, G.to.y, 3);
    px(G.to.x - 4 + ((now / 80) | 0) % 3, G.to.y + 1, 9, 1, 0);
    // the bar
    px(x - 1, y - 1, w + 2, h + 2, 3); px(x, y, w, h, 0);
    var zh = Math.round(M.zone * h), zy = y + h - Math.round(G.zy * h) - zh;
    px(x + 1, zy, w - 2, zh, 1); px(x + 1, zy, w - 2, 1, 2); px(x + 1, zy + zh - 1, w - 2, 1, 2);
    var fy = y + h - Math.round(G.fy * h) - 3;
    px(x + 4, fy, 7, 5, 3); px(x + 2, fy + 1, 2, 3, 3); px(x + 9, fy + 1, 1, 1, 0);
    // the meter
    px(x - 7, y - 1, 5, h + 2, 3); px(x - 6, y, 3, h, 0);
    var mh = Math.round(G.progress * h); px(x - 6, y + h - mh, 3, mh, 2);
    txt(held.a ? 'REEL!' : 'HOLD A', 8, 131, 0);
  }
  function drawCard() {
    var c = G.card, f = c.f, W = M.W;
    box(10, 18, W - 20, 104);
    txt(c.fresh ? 'NEW CATCH!' : 'CAUGHT!', W / 2, 25, 3, 'center');
    var sp = ART.sheet(f.id, f.px, PAL), k = sp.width > 28 ? 1 : 2;
    ctx.drawImage(sp, Math.round(W / 2 - sp.width * k / 2), Math.round(56 - sp.height * k / 2), sp.width * k, sp.height * k);
    txt(f.name, W / 2, 76, 3, 'center');
    txt(c.len + ' CM', W / 2, 84, 2, 'center');
    if (f.rarity !== 'common') txt(f.rarity, W / 2, 92, 3, 'center');
    txt('NO.' + String(c.no).padStart(3, '0') + '  ' + c.time + '  ' + M.name, W / 2, 102, 2, 'center');
    if (performance.now() - G.c0 > CARD_LOCK_MS) txt('A: OK', W / 2, 111, 3, 'center');
  }

  /* ---------------------------------------------------------------- Loop: only while a machine is open and the tab is visible */
  var raf = 0, last = 0;
  function loop() {
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(function frame(now) {
      if (!isOpen || document.hidden) return;
      var dt = Math.min(0.05, (now - last) / 1000); last = now;
      update(now, dt);
      drawPocket(now);
      raf = requestAnimationFrame(frame);
    });
  }

  window.drunkwizArcade = {
    open: open,
    close: requestClose,
    seed: function (n) { seed = n >>> 0; },   // for tests: makes bites and fights repeatable
    state: function () { return { open: isOpen, machine: cur, state: G.state, fish: G.fish && G.fish.id, zy: G.zy, fy: G.fy, zone: M && M.zone, progress: G.progress, power: G.power }; }
  };
})();
