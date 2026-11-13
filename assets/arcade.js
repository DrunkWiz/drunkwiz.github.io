/* index.html only. Loaded by extras.js when the arcade shelf scrolls near, after arcade-art.js.
   The arcade shelf: click a machine and the page zooms into it; each one runs a small fishing game.
   Loop: aim, hold to charge, release to cast, wait (fake nibbles), bite, hook, reel on a tension bar,
   catch or lose. Catches go to the fish log (dw-fish) and out as an arcade:catch event; this file
   prints the slip and pins the fish. Nothing is sent anywhere.
   The game keeps its positions from 0 to 1; each machine draws them its own way. */
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
  var AIM_SPEED = 0.45;        // screen widths per second the aim moves while an arrow is held
  var AIM_EDGE = 0.07;         // how close to the screen's sides you can aim
  var LOST_MS = 1500;          // how long a "got away" message stays before you can cast again
  var CARD_LOCK_MS = 700;      // the catch card ignores presses this long, so a held reel doesn't skip it
  var START_PROGRESS = 0.3;    // a hooked fish starts with the meter a third full: a fair start, not a free one
  var BOUNCE = 0.35;           // the catch zone keeps 35% of its speed when it hits the bottom of the bar
  var FISH_PAUSE_MS = [200, 700];   // how long a fish holds still when it pauses
  var SHADOWS = 4;             // fish drifting about in the water, for something to look at
  var FLASH_MS = 80;           // the bite cue: a flash (or the terminal's visible bell) this long
  var STATUS_GAP_MS = 1200;    // screen-reader tension status updates at most this often
  var INT_SCALE_LOSS = 0.25;   // use whole-number scaling unless it would waste more than a quarter of the space
  var TERM_NARROW = 700;       // below this window width the terminal runs in 40 columns: 80 would be 4px letters
  var DESK_NARROW = 600;       // below this the desktop draws at half resolution: shrinking 512 px dithers to mush
  var PAGE_MARGIN = 16;        // gap kept between the machine and the window edge
  var CHROME_H = 36;           // room for the key help line under the machine (the close button floats)
  var TOAST_MS = 4200;         // an unlock toast stays this long: long enough to read twice
  var SPARKLE_MS = 160;        // the shiny rod's glints move on this often

  // How each rarity fights. speed/dashSpeed: bar heights per second. dash, pause: chance per second / per stop.
  // weight: how often it bites, against the others it shares the water with.
  var RARITY = {
    common:   { speed: 0.32, dashSpeed: 0.9, dash: 0.10, pause: 0.40, weight: 14 },   // 5 commons: about 70 together
    uncommon: { speed: 0.45, dashSpeed: 1.2, dash: 0.25, pause: 0.30, weight: 18 },
    rare:     { speed: 0.62, dashSpeed: 1.8, dash: 0.55, pause: 0.18, weight: 7 },    // the hardest regular fight
    night:    { speed: 0.58, dashSpeed: 1.6, dash: 0.45, pause: 0.15, weight: 24 }    // only bites 3:33 to 5:55am, so it bites often then
  };

  // Machines, easiest first. Base difficulty: zone is the catch zone's share of the bar; lift and gravity in
  // bar heights per s²; fill and drain in meters per second; hook is ms to strike after a bite.
  // k: how many screen pixels make one drawing pixel (the desktop has more pixels than the pocket one).
  var MACHINES = {
    pocket: { name: 'Pocket', label: 'Pocket console', draw: 'top', W: 160, H: 144, k: 1,
      hook: 600, zone: 0.32, lift: 2.6, gravity: 1.6, fill: 0.42, drain: 0.24,
      keys: 'Space, Enter or Z: cast, hook, reel. Arrows: aim. X: reel in. Esc: leave.' },
    tv: { name: 'TV game', label: 'TV game', draw: 'side', W: 256, H: 240, k: 1,
      hook: 500, zone: 0.28, lift: 2.8, gravity: 1.8, fill: 0.38, drain: 0.27,
      keys: 'Space, Enter or Z: cast, hook, reel. X: reel in. Esc: leave.' },
    desk: { name: 'Desktop', label: 'Desktop', draw: 'top', W: 512, H: 342, k: 2, onebit: true,
      hook: 420, zone: 0.24, lift: 3.0, gravity: 2.0, fill: 0.34, drain: 0.30,
      keys: 'Point to aim. Hold the mouse button, or Space, to cast, hook and reel. X: reel in. Esc: leave.' },
    term: { name: 'Terminal', label: 'Terminal', draw: 'text', W: 320, H: 150, k: 1, cols: 80,
      hook: 300, zone: 0.22, lift: 3.2, gravity: 2.2, fill: 0.36, drain: 0.28,
      keys: 'Space or Enter: cast, hook, reel. Arrows: aim. X: reel in. Esc: leave.' }
  };
  // On-screen controls in each shell. Each button is [key, label, text].
  var CONTROLS = {
    pocket: '<div class="arc-dpad">' + pad4() + '</div><div class="arc-ab">' + btn('b', 'B: reel in', 'B') + btn('a', 'A: cast, hook, reel', 'A') + '</div>',
    tv: '<div class="arc-pad"><div class="arc-dpad">' + pad4() + '</div><div class="arc-sel" aria-hidden="true"><i></i><i></i></div><div class="arc-ab">' + btn('b', 'B: reel in', 'B') + btn('a', 'A: cast, hook, reel', 'A') + '</div></div>',
    desk: '<div class="arc-mouse">' + btn('a', 'Button: cast, hook, reel', '') + '</div>',
    term: '<div class="arc-keyrow">' + btn('left', 'Aim left', '←') + btn('right', 'Aim right', '→') + btn('a', 'Space: cast, hook, reel', '␣') + btn('a', 'Enter: cast, hook, reel', '↵') + '</div>'
  };
  function btn(k, label, t) { return '<button type="button" tabindex="-1" data-k="' + k + '" aria-label="' + label + '">' + t + '</button>'; }
  function pad4() { return btn('up', 'Up', '') + btn('left', 'Aim left', '') + btn('right', 'Aim right', '') + btn('down', 'Down', '') + '<i aria-hidden="true"></i>'; }

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
  function caughtIn(pond) { return (ART.FISH[pond] || []).filter(function (f) { return log.fish[f.id]; }).length; }
  // The four ponds, in shelf order.
  var PONDS = [{ id: 'pocket', name: 'Pocket' }, { id: 'tv', name: 'TV game' }, { id: 'desk', name: 'Desktop' }, { id: 'term', name: 'Terminal' }];
  function caughtAll() { return PONDS.reduce(function (n, p) { return n + caughtIn(p.id); }, 0); }

  /* ---------------------------------------------------------------- Shelf */
  var shelf = document.querySelector('.arcade');
  function labelShelf() {
    if (!shelf) return;
    shelf.querySelectorAll('.mach').forEach(function (b) {
      var id = b.getAttribute('data-mach'), m = MACHINES[id];
      if (id === 'log') { b.setAttribute('aria-label', 'Fish log. ' + caughtAll() + ' of ' + PONDS.length * 8 + ' caught.'); return; }
      if (!m) return;
      b.disabled = false;
      b.setAttribute('aria-label', m.label + '. Pond: ' + caughtIn(id) + ' of ' + ART.FISH[id].length + ' caught.');
    });
  }
  labelShelf();
  if (shelf) shelf.addEventListener('click', function (e) {
    var b = e.target.closest('.mach');
    if (b && !b.disabled && b.getAttribute('data-mach') !== 'egg') open(b.getAttribute('data-mach'), b);
  });

  /* ---------------------------------------------------------------- The dialog around a machine */
  var dlg = null, shell, cv, ctx, ctl, live, tstat, closeBtn, keysEl, from = null, cur = null, pushed = false, isOpen = false;
  function build() {
    dlg = document.createElement('dialog');
    dlg.className = 'arc';
    dlg.innerHTML =
      '<div class="arc-stage"><div class="arc-shell">' +
        '<div class="arc-bezel"><i class="arc-led" aria-hidden="true"></i><div class="arc-scr"><canvas class="arc-cv" tabindex="0"></canvas></div></div>' +
        '<p class="arc-brand" aria-hidden="true"></p>' +
        '<div class="arc-ctl"></div>' +
      '</div></div>' +
      '<p class="arc-keys"></p>' +
      '<button type="button" class="arc-close">Close</button>' +
      '<p class="sr-only arc-live" aria-live="polite"></p><p class="sr-only arc-tension" role="status"></p>';
    document.body.appendChild(dlg);
    shell = dlg.querySelector('.arc-shell'); cv = dlg.querySelector('.arc-cv'); ctx = cv.getContext('2d'); ctl = dlg.querySelector('.arc-ctl');
    live = dlg.querySelector('.arc-live'); tstat = dlg.querySelector('.arc-tension');
    closeBtn = dlg.querySelector('.arc-close'); keysEl = dlg.querySelector('.arc-keys');
    closeBtn.addEventListener('click', requestClose);
    dlg.addEventListener('cancel', function (e) { e.preventDefault(); requestClose(); });
    dlg.addEventListener('close', function () { if (isOpen) finishClose(); });
    // Clicking the dark area around the machine leaves, like Esc.
    dlg.addEventListener('click', function (e) { if (e.target === dlg || e.target.classList.contains('arc-stage')) requestClose(); });
    // Keep swipes and taps in here from reaching the page's own touch eggs (the Konami swipe).
    ['touchstart', 'touchmove', 'touchend', 'touchcancel'].forEach(function (t) { dlg.addEventListener(t, function (e) { e.stopPropagation(); }, { passive: true }); });
    // On-screen buttons: hold to hold. Delegated, since each machine has its own.
    ctl.addEventListener('pointerdown', function (e) {
      var b = e.target.closest('[data-k]'); if (!b) return;
      e.preventDefault(); try { b.setPointerCapture(e.pointerId); } catch (x) {}
      b.classList.add('down'); press(b.getAttribute('data-k'));
    });
    var up = function (e) { var b = e.target.closest && e.target.closest('[data-k]'); if (b) { b.classList.remove('down'); release(b.getAttribute('data-k')); } };
    ctl.addEventListener('pointerup', up); ctl.addEventListener('pointercancel', up); ctl.addEventListener('lostpointercapture', up);
    ctl.addEventListener('click', function (e) { e.preventDefault(); });
    // The screen itself: point to aim, press and hold like A.
    cv.addEventListener('pointerdown', function (e) {
      e.preventDefault(); cv.focus({ preventScroll: true });
      try { cv.setPointerCapture(e.pointerId); } catch (x) {}
      if (G.state === 'aim') G.aimX = clamp(toLogical(e).x, AIM_EDGE, 1 - AIM_EDGE);
      press('a');
    });
    cv.addEventListener('pointermove', function (e) { if (G.state === 'aim' && e.pointerType === 'mouse') G.aimX = clamp(toLogical(e).x, AIM_EDGE, 1 - AIM_EDGE); });
    var cvUp = function () { release('a'); };
    cv.addEventListener('pointerup', cvUp); cv.addEventListener('pointercancel', cvUp);
    window.addEventListener('resize', function () { if (isOpen) layout(); });
    window.addEventListener('popstate', function () { if (isOpen) { pushed = false; close(); } });
    document.addEventListener('visibilitychange', function () { if (isOpen && !document.hidden) { last = performance.now(); loop(); } });
  }
  function toLogical(e) {
    var r = cv.getBoundingClientRect();
    return { x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height };
  }
  // Fit the screen to the window: whole-number scale when that doesn't waste much, otherwise exact.
  function layout() {
    // Measure the shell around a 1px screen: whatever is left over is the room the screen can have.
    var shut = !dlg.open;
    if (shut) { dlg.style.display = 'flex'; dlg.style.visibility = 'hidden'; }
    cv.style.width = cv.style.height = '1px';
    // Width: only the shell and bezel padding count (the controls can be wider than a tiny screen). Height: everything.
    var pw = function (el) { var c = getComputedStyle(el); return parseFloat(c.paddingLeft) + parseFloat(c.paddingRight); };
    var bx = pw(shell) + pw(cv.parentNode.parentNode), by = shell.offsetHeight - 1;
    if (shut) { dlg.style.display = ''; dlg.style.visibility = ''; }
    var aw = window.innerWidth - PAGE_MARGIN * 2 - bx;
    var ah = window.innerHeight - PAGE_MARGIN * 2 - by - CHROME_H;
    var fit = Math.max(0.3, Math.min(aw / M.W, ah / M.H)), whole = Math.floor(fit);
    var s = whole >= 1 && (fit - whole) / fit <= INT_SCALE_LOSS ? whole : fit;
    cv.style.width = Math.floor(M.W * s) + 'px'; cv.style.height = Math.floor(M.H * s) + 'px';
    cv.style.imageRendering = s < 1 ? 'auto' : '';   // shrinking below 1:1 drops pixels; smooth it instead
  }

  var M = null, PAL = null, PALR = null, K = 1;
  function open(id, btnEl) {
    if (id === 'log') { openLog(btnEl); return; }
    if (isOpen || !MACHINES[id]) return;
    if (!dlg) build();
    cur = id; M = MACHINES[id]; PAL = ART.PAL[id]; K = M.k; from = btnEl || shelf.querySelector('[data-mach="' + id + '"]');
    if (M.draw === 'text') { M.cols = window.innerWidth < TERM_NARROW ? 40 : 80; M.W = M.cols * 4; }
    if (id === 'desk') { var half = window.innerWidth < DESK_NARROW; M.W = half ? 256 : 512; M.H = half ? 171 : 342; M.k = half ? 1 : 2; }
    K = M.k;
    shell.setAttribute('data-m', id);
    ctl.innerHTML = CONTROLS[id];
    dlg.setAttribute('aria-label', M.label + ', fishing game');
    dlg.querySelector('.arc-brand').textContent = M.name.toUpperCase();
    cv.width = M.W; cv.height = M.H; ctx.imageSmoothingEnabled = false;
    PALR = PAL.map(function (c) { return ART.fill(ctx, c); });
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
    document.dispatchEvent(new CustomEvent('arcade:close'));
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

  /* ---------------------------------------------------------------- Game state, all from 0 to 1 */
  var G = {};
  function reset() {
    G = { state: 'boot', t0: performance.now(), aimX: 0.5, power: 0, msg: '', nibbles: [], ripple: [], shadows: [] };
    var pool = ART.FISH[cur].filter(function (f) { return f.rarity === 'common'; });
    for (var i = 0; i < SHADOWS; i++) G.shadows.push({ x: between(0.05, 0.95), y: between(0.05, 0.95), v: (rnd() < 0.5 ? -1 : 1) * between(0.02, 0.06), f: pool[i % pool.length] });
    held = {}; hit = {};
  }
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
    G.shadows.forEach(function (f) { f.x += f.v * dt; if (f.x < 0.03 || f.x > 0.97) { f.v = -f.v; f.x = clamp(f.x, 0.03, 0.97); } });
    if (s === 'boot') {
      if (G.skip || hit.a || hit.b || now - G.t0 > BOOT_MS) { G.state = 'aim'; announce(M.name + ' pond. Hold A to charge, let go to cast.'); }
    } else if (s === 'aim' || s === 'charge') {
      if (held.left) G.aimX -= AIM_SPEED * dt;
      if (held.right) G.aimX += AIM_SPEED * dt;
      G.aimX = clamp(G.aimX, AIM_EDGE, 1 - AIM_EDGE);
      if (s === 'aim') { if (hit.a) { G.state = 'charge'; G.c0 = now; } }
      else {
        var p = ((now - G.c0) / CHARGE_MS) % 2; G.power = p > 1 ? 2 - p : p;
        if (hit.b) G.state = 'aim';
        else if (!held.a) { G.state = 'cast'; G.c0 = now; G.zone = G.power < NEAR_SPLIT ? 'near' : 'far'; G.to = { x: G.aimX, d: G.power }; G.q = 0; }
      }
    } else if (s === 'cast') {
      G.q = Math.min(1, (now - G.c0) / CAST_MS);
      if (G.q >= 1) {
        G.state = 'wait'; G.ripple.push(now);
        var wait = between(WAIT_MIN, WAIT_MAX); G.biteAt = now + wait; G.nibbles = [];
        for (var n = 0; n < NIBBLES_MAX; n++) if (rnd() < NIBBLE_CHANCE) G.nibbles.push(now + between(600, Math.max(700, wait - 700)));
      }
    } else if (s === 'wait') {
      G.nib = G.nibbles.some(function (nt) { return now >= nt && now < nt + NIBBLE_MS; });
      if (hit.a) lose('TOO EARLY.', 'Too early. Nothing on the line.');
      else if (hit.b) G.state = 'aim';
      else if (now >= G.biteAt) { G.fish = pickFish(G.zone); G.state = 'bite'; G.c0 = now; G.ripple.push(now); announce('Bite!'); }
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
    var time = pad(d.getHours()) + ':' + pad(d.getMinutes());
    log.last = { id: f.id, name: f.name, pond: M.name, len: len.toFixed(1), time: time, no: log.n, at: d.getTime() };   // the slip on the shelf
    saveLog();
    checkUnlocks(true);
    G.state = 'card'; G.c0 = now;
    G.card = { f: f, len: len.toFixed(1), time: time, fresh: fresh, no: log.n };
    tstat.textContent = '';
    announce('Caught a ' + f.name + ', ' + len.toFixed(1) + ' cm.' + (fresh ? ' New in the log.' : '') + ' ' + f.desc);
    var img = ART.sprite(cur, f).toDataURL();
    document.dispatchEvent(new CustomEvent('arcade:catch', { detail: {
      id: f.id, name: f.name, rarity: f.rarity, pond: M.name, len: len.toFixed(1), time: time, no: log.n, at: d.getTime(), fresh: fresh, img: img } }));
  }

  /* ---------------------------------------------------------------- Drawing helpers.
     Coordinates are in drawing pixels; K screen pixels make one. Colours are palette indices. */
  function px(x, y, w, h, c) { ctx.fillStyle = PALR[c]; ctx.fillRect(Math.round(x) * K, Math.round(y) * K, Math.round(w) * K, Math.round(h) * K); }
  function line(x0, y0, x1, y1, c) {
    x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
    var dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1, err = dx + dy;
    ctx.fillStyle = PALR[c];
    for (var i = 0; i < 600; i++) {
      ctx.fillRect(x0 * K, y0 * K, K, K);
      if (x0 === x1 && y0 === y1) break;
      var e2 = 2 * err; if (e2 >= dy) { err += dy; x0 += sx; } if (e2 <= dx) { err += dx; y0 += sy; }
    }
  }
  function txt(s, x, y, c, al) { ART.text(ctx, s, Math.round(x) * K, Math.round(y) * K, PALR[c], al, K); }
  function spr(c, x, y, s) { s = (s || 1) * K; ctx.drawImage(c, Math.round(x) * K, Math.round(y) * K, c.width * s, c.height * s); }
  function blink(ms) { return ((performance.now() / (ms || 500)) | 0) % 2 === 0; }
  // The shiny rod: a couple of glints that run up the rod, once every fish is in the log.
  function shiny() { return !!(log.unlocks && log.unlocks.rod); }
  function glints(x0, y0, x1, y1, c) {
    if (!shiny()) return;
    var step = (performance.now() / SPARKLE_MS) | 0, q = (step % 5) / 4;
    px(x0 + (x1 - x0) * q, y0 + (y1 - y0) * q, 1, 1, c);   // a glint running up the rod
    var arm = [1, 2, 3, 2][step % 4];                      // and a star at the tip that breathes
    px(x1 - arm, y1 - 1, arm * 2 + 1, 1, c); px(x1, y1 - 1 - arm, 1, arm * 2 + 1, c);
  }
  function castT() { return G.state === 'cast' ? G.q : 1; }
  function ripples(now, draw) { G.ripple = G.ripple.filter(function (t) { var a = (now - t) / 700; if (a > 1) return false; draw(a); return true; }); }
  // A shared tension bar for the pixel machines. c: [frame, ground, zone, zone edge, fish, meter].
  function bar(x, y, w, h, c, label) {
    px(x - 1, y - 1, w + 2, h + 2, c[0]); px(x, y, w, h, c[1]);
    var zh = Math.round(M.zone * h), zy = y + h - Math.round(G.zy * h) - zh;
    px(x + 1, zy, w - 2, zh, c[2]); px(x + 1, zy, w - 2, 1, c[3]); px(x + 1, zy + zh - 1, w - 2, 1, c[3]);
    var fy = y + h - Math.round(G.fy * h) - 3, fx = x + Math.round(w / 2) - 4;
    px(fx + 2, fy, 7, 5, c[4]); px(fx, fy + 1, 2, 3, c[4]); px(fx + 7, fy + 1, 1, 1, c[1]);
    px(x - 8, y - 1, 5, h + 2, c[0]); px(x - 7, y, 3, h, c[1]);
    var mh = Math.round(G.progress * h); px(x - 7, y + h - mh, 3, mh, c[5]);
  }

  /* ---------------------------------------------------------------- Top-down pond: the pocket and the desktop.
     Shades: 0 lightest, 1 water, 2 bank and shadows, 3 darkest. The desktop's middle shades are dithers. */
  function drawTop(now) {
    var VW = M.W / K, VH = M.H / K, t = now / 1000, s = G.state, one = M.onebit;
    var TOP = 24, NEAR = VH - 40, cx = VW / 2;
    var ax = G.aimX * VW, tip = { x: cx + (ax - cx) * 0.18, y: NEAR };
    if (s === 'boot') {
      px(0, 0, VW, VH, 0);
      var q = Math.min(1, (now - G.t0) / (BOOT_MS * 0.6));
      txt(M.name.toUpperCase(), cx, Math.round(-8 + q * (VH / 2 - 2)), 3, 'center');
      if (q >= 1) txt('FISHING', cx, VH / 2 + 6, 2, 'center');
      return;
    }
    px(0, 0, VW, VH, 1);
    for (var i = 0; i < 16; i++) px(((i * 41 + t * (4 + i % 3)) % (VW + 10)) - 5, 20 + (i * 29) % (NEAR - 14), 3 + (i % 3), 1, 0);
    G.shadows.forEach(function (f) {
      var x = f.x * VW, y = TOP + 4 + f.y * (NEAR - TOP - 8);
      px(x - 3, y, 7, 2, 2); px(x - 2, y - 1, 5, 1, 2); px(f.v > 0 ? x - 5 : x + 4, y, 2, 2, 2);
    });
    // far bank and reeds; the jetty and the angler
    px(0, 10, VW, 6, 2);
    for (var r = 3; r < VW; r += 7) px(r, 7 + (r * 3) % 4, 1, 4, 3);
    px(0, VH - 32, VW, 32, 2);
    for (var pl = VH - 29; pl < VH; pl += 5) px(0, pl, VW, 1, 3);
    spr(ART.sheet('angler', ART.ANGLER, PAL), cx - 6, NEAR + 2);
    line(cx + 4, NEAR + 7, tip.x, tip.y, 3);
    glints(cx + 4, NEAR + 7, tip.x, tip.y, 0);
    // the top bar: dark on the pocket, a white menu bar on the desktop
    if (one) { px(0, 0, VW, 9, 0); px(0, 9, VW, 1, 3); } else px(0, 0, VW, 9, 3);
    txt(M.name + ' pond', 3, 2, one ? 3 : 0);
    txt(caughtIn(cur) + '/' + ART.FISH[cur].length, VW - 3, 2, one ? 3 : 0, 'right');
    var tx = G.to ? G.to.x * VW : ax, ty = G.to ? NEAR - G.to.d * (NEAR - TOP) : NEAR;
    ripples(now, function (a) { var rr = 2 + a * 7; px(tx - rr, ty + 2, rr * 2, 1, 0); });
    if (s === 'aim' || s === 'charge') {
      txt('V', ax, 17, 3, 'center');
      for (var dy = 26; dy < NEAR - 4; dy += 6) px(ax, dy, 1, 2, 2);
      if (s === 'charge') {
        var ly = NEAR - G.power * (NEAR - TOP);
        px(ax - 3, ly, 7, 1, 3); px(ax, ly - 3, 1, 7, 3);
        px(8, VH - 16, 44, 7, 3); px(9, VH - 15, 42, 5, 0); px(9, VH - 15, Math.round(42 * G.power), 5, 2);
        txt(G.power < NEAR_SPLIT ? 'NEAR' : 'FAR', 56, VH - 14, 0);
      } else if (blink()) txt(one ? 'HOLD THE BUTTON TO CAST' : 'HOLD A TO CAST', cx, VH - 13, 0, 'center');
    }
    if (s === 'cast' || s === 'wait' || s === 'bite') {
      var q = castT(), fx = tip.x + (tx - tip.x) * q, fy = tip.y + (ty - tip.y) * q - Math.sin(Math.PI * q) * 22;
      if (s === 'wait') fy += G.nib ? 2 : (Math.sin(t * 3) > 0.6 ? 1 : 0);
      if (s === 'bite') fy += 2;
      line(tip.x, tip.y, fx + 1, fy, 3);
      if (s === 'bite') {
        px(fx - 3, fy + 3, 9, 1, 0);
        spr(ART.sheet('float2', ART.FLOAT.slice(0, 2), PAL), fx, fy + 1);
        if (blink(90)) spr(ART.sheet('bite', ART.BITE, PAL), fx, fy - 9);
      } else spr(ART.sheet('float', ART.FLOAT, PAL), fx, fy);
      if (s === 'wait') txt('WAIT...', cx, VH - 13, 0, 'center');
    }
    if (s === 'bite' && now - G.c0 < FLASH_MS) {
      if (one) { ctx.globalCompositeOperation = 'difference'; ctx.fillStyle = '#FFFFFF'; ctx.fillRect(0, 0, M.W, M.H); ctx.globalCompositeOperation = 'source-over'; }
      else { ctx.globalAlpha = 0.7; px(0, 0, VW, VH, 0); ctx.globalAlpha = 1; }
    }
    if (s === 'reel') {
      line(tip.x, tip.y, tx, ty, 3);
      px(tx - 4 + ((now / 80) | 0) % 3, ty + 1, 9, 1, 0);
      bar(VW - 28, 16, 16, VH - 52, [3, 0, 1, 2, 3, 2]);
      txt(held.a ? 'REEL!' : (one ? 'HOLD' : 'HOLD A'), 8, VH - 13, 0);
    }
    if (s === 'card') topCard();
    if (s === 'lost') { box(cx - 56, VH / 2 - 20, 112, 28); txt(G.msg, cx, VH / 2 - 8, 3, 'center'); }
  }
  function box(x, y, w, h) { px(x, y, w, h, 3); px(x + 1, y + 1, w - 2, h - 2, 0); px(x + 2, y + 2, w - 4, h - 4, 3); px(x + 3, y + 3, w - 6, h - 6, 0); }
  function topCard() {
    var c = G.card, f = c.f, VW = M.W / K, top = Math.round(M.H / K / 2) - 54, cx = VW / 2;
    box(cx - 70, top, 140, 104);
    txt(c.fresh ? 'NEW CATCH!' : 'CAUGHT!', cx, top + 7, 3, 'center');
    var sp = ART.sprite(cur, f), k = sp.width > 28 ? 1 : 2;
    spr(sp, cx - sp.width * k / 2, top + 38 - sp.height * k / 2, k);
    txt(f.name, cx, top + 58, 3, 'center');
    txt(c.len + ' CM', cx, top + 66, 2, 'center');
    if (f.rarity !== 'common') txt(f.rarity, cx, top + 74, 3, 'center');
    txt('NO.' + String(c.no).padStart(3, '0') + '  ' + c.time + '  ' + M.name, cx, top + 84, 2, 'center');
    if (performance.now() - G.c0 > CARD_LOCK_MS) txt(M.onebit ? 'CLICK: OK' : 'A: OK', cx, top + 93, 3, 'center');
  }

  /* ---------------------------------------------------------------- Side view: the TV game, 16 colours.
     0 black, 1 white, 2 grey, 3 dark grey, 4 navy, 5 blue, 6 sky, 7 dark green, 8 green, 9 lime,
     10 brown, 11 orange, 12 yellow, 13 red, 14 pink, 15 purple. */
  var TV_SURF = 110, TV_PIER = 60;
  function tvLand(d) { return TV_PIER + 18 + d * (M.W - TV_PIER - 68); }
  function drawSide(now) {
    var W = M.W, H = M.H, t = now / 1000, s = G.state, SURF = TV_SURF, PIER = TV_PIER;
    if (s === 'boot') {
      px(0, 0, W, H, 0);
      var word = 'TV GAME', q = (now - G.t0) / (BOOT_MS * 0.7), cols = [13, 11, 12, 8, 5, 15, 14];
      for (var i = 0; i < word.length; i++) {
        var y = Math.min(H / 2 - 10, -10 + (q * 1.6 - i * 0.12) * (H / 2));
        ART.text(ctx, word[i], W / 2 - 27 + i * 8, Math.round(y), PALR[cols[i]], 'left', 2);
      }
      if (q > 1 && blink(250)) txt('PRESS A', W / 2, H / 2 + 12, 1, 'center');
      return;
    }
    px(0, 0, W, SURF, 6);
    for (var sy = -12; sy <= 12; sy++) { var sw = Math.round(Math.sqrt(144 - sy * sy)); px(204 - sw, 34 + sy, sw * 2, 1, 12); }
    for (var cl = 0; cl < 3; cl++) { var cx0 = ((cl * 97 + t * 4) % (W + 40)) - 30; px(cx0, 18 + cl * 14, 22, 4, 1); px(cx0 + 4, 15 + cl * 14, 12, 3, 1); }
    for (var x = 0; x < W; x++) { var hh = Math.round(7 + 4 * Math.sin(x / 17) + 3 * Math.sin(x / 7)); px(x, SURF - hh, 1, hh, 7); }
    px(0, SURF, W, H - SURF, 5); px(0, SURF + 54, W, H - SURF - 54, 4);
    px(0, H - 14, W, 14, 10); for (var sd = 3; sd < W; sd += 9) px(sd, H - 10 + (sd % 3), 2, 1, 11);
    for (var i2 = 0; i2 < 12; i2++) px(((i2 * 53 + t * 12) % (W + 10)) - 5, SURF + 3 + (i2 * 7) % 44, 6, 1, 6);
    G.shadows.forEach(function (f) {
      var x = f.x * W, y = SURF + 14 + f.y * (H - SURF - 34), c = y > SURF + 54 ? 3 : 4;
      px(x - 5, y, 11, 3, c); px(f.v > 0 ? x - 8 : x + 6, y - 1, 3, 5, c);
    });
    [8, 30, 52].forEach(function (p) { px(p, SURF - 6, 3, H - 14 - SURF + 6, 3); });
    px(0, SURF - 8, PIER, 4, 10); px(0, SURF - 8, PIER, 1, 11);
    spr(ART.sheet('angler-tv', ART.ANGLER_TV, PAL), PIER - 18, SURF - 24);
    var tip = { x: PIER + 6, y: SURF - 44 };
    line(PIER - 9, SURF - 16, tip.x, tip.y, 10);
    glints(PIER - 9, SURF - 16, tip.x, tip.y, 12);
    txt(M.name + ' pond', 4, 4, 0); txt(caughtIn(cur) + '/' + ART.FISH[cur].length, W - 4, 4, 0, 'right');
    var lx = G.to ? tvLand(G.to.d) : tvLand(0);
    ripples(now, function (a) { var rr = 2 + a * 9; px(lx - rr, SURF, rr * 2, 1, 1); });
    if (s === 'aim' || s === 'charge') {
      if (s === 'charge') {
        var mx = tvLand(G.power); px(mx - 3, SURF - 2, 7, 1, 12); px(mx, SURF - 5, 1, 7, 12);
        px(8, H - 26, 62, 7, 0); px(9, H - 25, 60, 5, 3); px(9, H - 25, Math.round(60 * G.power), 5, 12);
        txt(G.power < NEAR_SPLIT ? 'NEAR' : 'FAR', 74, H - 24, 1);
      } else if (blink()) txt('HOLD A TO CAST', W / 2, H - 24, 1, 'center');
    }
    var fpal = [PAL[1], PAL[1], PAL[13], PAL[0]];
    if (s === 'cast' || s === 'wait' || s === 'bite') {
      var q = castT(), fx = tip.x + (lx - tip.x) * q, fy = tip.y + (SURF - 3 - tip.y) * q - Math.sin(Math.PI * q) * 40;
      if (s === 'wait') fy += G.nib ? 2 : (Math.sin(t * 3) > 0.6 ? 1 : 0);
      if (s === 'bite') fy += 3;
      line(tip.x, tip.y, fx + 1, fy, 1);
      spr(ART.sheet('float', ART.FLOAT, fpal), fx, fy);
      if (s === 'bite' && blink(90)) ART.text(ctx, '!', Math.round(fx), Math.round(fy - 14), PALR[12], 'left', 2);
      if (s === 'wait') txt('WAIT...', W / 2, H - 24, 1, 'center');
    }
    if (s === 'bite' && now - G.c0 < FLASH_MS) { ctx.globalAlpha = 0.6; px(0, 0, W, H, 1); ctx.globalAlpha = 1; }
    if (s === 'reel') {
      line(tip.x, tip.y, lx, SURF, 1);
      px(lx - 5 + ((now / 80) | 0) % 3, SURF, 11, 1, 1);
      bar(W - 28, 24, 18, 176, [0, 3, 8, 9, 11, 12]);
      txt(held.a ? 'REEL!' : 'HOLD A', 8, H - 24, 1);
    }
    if (s === 'card') {
      var c = G.card, f = c.f, top = 54;
      px(W / 2 - 82, top, 164, 116, 0); px(W / 2 - 80, top + 2, 160, 112, 1); px(W / 2 - 80, top + 2, 160, 12, 5);
      txt(c.fresh ? 'NEW CATCH!' : 'CAUGHT!', W / 2, top + 6, 1, 'center');
      var sp = ART.sprite(cur, f); spr(sp, W / 2 - sp.width, top + 44 - sp.height, 2);
      txt(f.name, W / 2, top + 66, 0, 'center'); txt(c.len + ' CM', W / 2, top + 75, 4, 'center');
      if (f.rarity !== 'common') txt(f.rarity, W / 2, top + 84, 13, 'center');
      txt('NO.' + String(c.no).padStart(3, '0') + '  ' + c.time + '  ' + M.name, W / 2, top + 94, 3, 'center');
      if (performance.now() - G.c0 > CARD_LOCK_MS) txt('A: OK', W / 2, top + 104, 5, 'center');
    }
    if (s === 'lost') { px(W / 2 - 62, H / 2 - 22, 124, 26, 0); px(W / 2 - 60, H / 2 - 20, 120, 22, 1); txt(G.msg, W / 2, H / 2 - 11, 13, 'center'); }
  }

  /* ---------------------------------------------------------------- Text: the terminal. 4x6 cells, 25 rows.
     Shades: 0 bright, 1 normal, 2 dim, 3 the tube. Every fish is ASCII: you read it off the screen. */
  function at(c, r, str, shade) { ART.text(ctx, str, c * 4, r * 6 + 1, PALR[shade]); }
  function drawText(now) {
    var C = M.cols, s = G.state, t = now / 1000, mid = Math.floor(C / 2);
    var FAR = 3, NEAR = 18;
    function row(d) { return Math.round(NEAR - d * (NEAR - FAR)); }
    px(0, 0, M.W, M.H, 3);
    if (s === 'boot') {
      var lines = ['TERMINAL READY', 'MEMORY 640K OK', 'LOADING POND', '> FISH'], q = (now - G.t0) / BOOT_MS;
      for (var i = 0; i < lines.length; i++) if (q > i * 0.2) at(1, 1 + i, lines[i], i === 3 ? 0 : 1);
      if (blink(250)) at(1 + lines[3].length + 1, 4, '_', 0);
      return;
    }
    if (s === 'bite' && now - G.c0 < FLASH_MS) { px(0, 0, M.W, M.H, 0); return; }   // the visible bell
    px(0, 0, M.W, 6, 1);
    at(1, 0, M.name + ' pond  ' + caughtIn(cur) + '/' + ART.FISH[cur].length, 3);
    for (var r = 2; r <= NEAR; r++) {
      var off = Math.floor(t * (1 + r % 3));
      for (var c = 0; c < C; c++) if ((Math.imul(c + off + 997, 2654435761) ^ Math.imul(r, 40503)) % 13 === 0) at(c, r, '~', 2);   // scattered, drifting by row
    }
    G.shadows.forEach(function (f, i) {
      var a = f.f.ascii, r = FAR + 1 + Math.floor(f.y * (NEAR - FAR - 2)), c = Math.round(f.x * (C - a.length));
      at(c, r, f.v > 0 ? a : a.split('').reverse().join('').replace(/[<>()\[\]{}]/g, function (ch) { return { '<': '>', '>': '<', '(': ')', ')': '(', '[': ']', ']': '[', '{': '}', '}': '{' }[ch]; }), 2);
    });
    at(0, 19, new Array(C + 1).join('='), 1);
    at(mid, 20, '@', 0); at(mid, 19, '|', 0);
    if (shiny() && blink(SPARKLE_MS * 2)) at(mid + 1, 18, '*', 0);
    var ac = Math.round(G.aimX * (C - 1));
    var tc = G.to ? Math.round(G.to.x * (C - 1)) : ac, tr = G.to ? row(G.to.d) : NEAR;
    function dots(c1, r1) {   // the line, as dots from the rod to the float
      var n = Math.max(Math.abs(c1 - mid), Math.abs(r1 - 18));
      for (var k = 1; k < n; k += 2) at(Math.round(mid + (c1 - mid) * k / n), Math.round(18 + (r1 - 18) * k / n), '.', 2);
    }
    if (s === 'aim' || s === 'charge') {
      at(ac, 1, 'V', 0);
      if (s === 'charge') {
        at(ac, row(G.power), '+', 0);
        var n = Math.round(G.power * 20);
        at(1, 22, 'POWER [' + new Array(n + 1).join('#') + new Array(21 - n).join('-') + '] ' + (G.power < NEAR_SPLIT ? 'NEAR' : 'FAR'), 0);
      } else at(1, 22, 'HOLD SPACE TO CAST' + (blink() ? '_' : ''), 1);
    }
    if (s === 'cast' || s === 'wait' || s === 'bite') {
      var q = castT(), fc = Math.round(mid + (tc - mid) * q), fr = Math.round(18 + (tr - 18) * q - Math.sin(Math.PI * q) * 3);
      dots(fc, fr);
      at(fc, fr, s === 'bite' || G.nib ? 'O' : 'o', 0);
      if (s === 'bite') { at(fc, fr - 1, '!', 0); at(1, 22, '*BEL* STRIKE NOW', 0); }
      if (s === 'wait') at(1, 22, 'WAITING' + (blink() ? '_' : ''), 1);
    }
    if (s === 'reel') {
      dots(tc, tr);
      var a = G.fish.ascii, wig = ((now / 120) | 0) % 2;
      at(clamp(tc - (a.length >> 1) + wig, 0, C - a.length - 8), tr, a, 0);   // the fish on the line, read it if you can
      var bc = C - 4, top = 3, h = 16;
      for (var br = 0; br < h; br++) { at(bc - 1, top + br, '|', 2); at(bc + 1, top + br, '|', 2); }
      var z0 = Math.round(G.zy * (h - 1)), z1 = Math.round((G.zy + M.zone) * (h - 1));
      for (var zr = z0; zr <= z1; zr++) at(bc, top + h - 1 - zr, '#', 1);
      at(bc, top + h - 1 - Math.round(G.fy * (h - 1)), '<', 0);
      var m = Math.round(G.progress * h);
      for (var mr = 0; mr < h; mr++) at(bc - 3, top + h - 1 - mr, mr < m ? '█' : '.', mr < m ? 1 : 2);
      at(1, 22, held.a ? 'REELING...' : 'HOLD SPACE TO REEL', 0);
    }
    if (s === 'card') {
      var cd = G.card, f = cd.f, w = Math.min(C - 4, 34), x0 = Math.floor((C - w) / 2), y0 = 5, rows = 11;
      for (var yy = 0; yy < rows; yy++) at(x0, y0 + yy, yy === 0 || yy === rows - 1 ? '+' + new Array(w - 1).join('-') + '+' : '|' + new Array(w - 1).join(' ') + '|', 1);
      px((x0 + 1) * 4, (y0 + 1) * 6, (w - 2) * 4, (rows - 2) * 6, 3);
      var ctr = function (r, str, sh) { at(x0 + Math.floor((w - str.length) / 2), y0 + r, str, sh); };
      ctr(1, cd.fresh ? 'NEW CATCH' : 'CAUGHT', 0); ctr(3, f.ascii, 0); ctr(5, f.name.toUpperCase(), 0); ctr(6, cd.len + ' CM', 1);
      if (f.rarity !== 'common') ctr(7, f.rarity.toUpperCase(), 0);
      ctr(8, 'NO.' + String(cd.no).padStart(3, '0') + ' ' + cd.time, 2);
      if (performance.now() - G.c0 > CARD_LOCK_MS) at(1, 22, 'PRESS SPACE', 1);
    }
    if (s === 'lost') { at(mid - (G.msg.length >> 1), 10, G.msg, 0); }
  }
  var DRAW = { top: drawTop, side: drawSide, text: drawText };

  /* ---------------------------------------------------------------- Loop: only while a machine is open and the tab is visible */
  var raf = 0, last = 0;
  function loop() {
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(function frame(now) {
      if (!isOpen || document.hidden) return;
      var dt = Math.min(0.05, (now - last) / 1000); last = now;
      update(now, dt);
      DRAW[M.draw](now);
      raf = requestAnimationFrame(frame);
    });
  }

  /* ---------------------------------------------------------------- Catch outputs: slip, pin, log book */
  var SLIP_BARS = 30;          // bars in the decorative stripe at the foot of a slip
  var esc = function (v) { return String(v).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  var printer = document.querySelector('.mini-printer'), slipBox = null, pendingSlip = null;
  // A barcode-like stripe, decoration only: bar widths come from the catch number, so each slip differs.
  function stripe(no) {
    var x = 2, r = (no * 2654435761) >>> 0, out = '';
    for (var i = 0; i < SLIP_BARS; i++) {
      r = (Math.imul(r, 1103515245) + 12345) >>> 0;
      var w = 1 + ((r >>> 16) % 3);
      out += '<rect x="' + x + '" width="' + w + '" height="1"/>';
      x += w + 1 + ((r >>> 20) % 2);
    }
    return '<svg viewBox="0 0 ' + (x + 2) + ' 1" preserveAspectRatio="none" aria-hidden="true">' + out + '</svg>';
  }
  function slip(c, animate) {
    if (!printer) return;
    if (!slipBox) {
      slipBox = document.createElement('div'); slipBox.className = 'mini-slip';
      slipBox.setAttribute('role', 'img');
      printer.appendChild(slipBox);
      printer.closest('.plank').classList.add('has-slip');
    }
    slipBox.innerHTML = '<div class="ms-paper' + (animate && !reduce ? ' printing' : '') + '">' +
      '<b>CATCH #' + String(c.no).padStart(3, '0') + '</b><span>Pond: ' + esc(c.pond) + '</span>' +
      '<span>' + esc(c.name) + ' ' + esc(c.len) + ' cm</span><span>' + esc(c.time) + '</span>' + stripe(c.no) + '</div>';
    slipBox.setAttribute('aria-label', 'Catch slip ' + c.no + ': ' + c.name + ', ' + c.len + ' cm, ' + c.pond + ' pond, ' + c.time);
  }
  if (log.last) slip(log.last, false);
  // The pin goes up straight away; the slip prints once the machine closes, so it is seen printing.
  document.addEventListener('arcade:catch', function (e) {
    var c = e.detail;
    if (window.drunkwizBoard && window.drunkwizBoard.pinCatch) window.drunkwizBoard.pinCatch(c);
    if (isOpen) pendingSlip = c; else slip(c, true);
  });
  document.addEventListener('arcade:close', function () { if (pendingSlip) { slip(pendingSlip, true); pendingSlip = null; } });

  /* The fish log: a book on the shelf. 32 slots, silhouettes until caught, then the sprite, best length and count. */
  var SIL = ['#BDB6A6', '#BDB6A6', '#BDB6A6', '#A69F8F'];   // an uncaught fish is a grey shape on the page
  var book = null, bookFrom = null;
  function rarityWord(r) { return { common: 'Common', uncommon: 'Uncommon', rare: 'Rare', night: 'Night fish, 3:33 to 5:55am' }[r]; }
  function day(t) { var d = new Date(t); return d.getDate() + ' ' + 'Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec'.split(' ')[d.getMonth()] + ' ' + d.getFullYear(); }
  function buildBook() {
    book = document.createElement('dialog');
    book.className = 'flog';
    book.setAttribute('aria-labelledby', 'flog-h');
    book.innerHTML = '<div class="flog-head"><h2 id="flog-h">Fish log</h2><span class="flog-count"></span><button type="button" class="flog-close">Close</button></div>' +
      '<div class="flog-ponds"></div><p class="flog-detail" aria-live="polite"></p>';
    document.body.appendChild(book);
    book.querySelector('.flog-close').addEventListener('click', function () { book.close(); });
    book.addEventListener('click', function (e) {
      if (e.target === book) { book.close(); return; }   // a click on the backdrop
      var b = e.target.closest('.flog-slot'); if (b) detail(b.getAttribute('data-id'));
    });
    book.addEventListener('focusin', function (e) { var b = e.target.closest('.flog-slot'); if (b) detail(b.getAttribute('data-id')); });
    // keep keys pressed in here from reaching the page's own key eggs underneath
    book.addEventListener('keydown', function (e) { if (e.key !== 'Escape') e.stopPropagation(); });
    book.addEventListener('close', function () { if (bookFrom) bookFrom.focus({ preventScroll: true }); });
  }
  function findFish(id) {
    for (var i = 0; i < PONDS.length; i++) {
      var l = ART.FISH[PONDS[i].id] || [];
      for (var j = 0; j < l.length; j++) if (l[j].id === id) return { f: l[j], pond: PONDS[i] };
    }
    return null;
  }
  function detail(id) {
    var out = book.querySelector('.flog-detail'), hit = id && findFish(id), e = hit && log.fish[id];
    if (!hit) { out.textContent = 'Nothing here yet.'; return; }
    if (!e) { out.textContent = 'Not caught yet. ' + rarityWord(hit.f.rarity) + ', ' + hit.pond.name + ' pond, ' + (hit.f.where === 'any' ? 'anywhere' : hit.f.where + ' cast') + '.'; return; }
    out.innerHTML = '<b>' + esc(hit.f.name) + '.</b> ' + esc(hit.f.desc) + ' <span>' + esc(rarityWord(hit.f.rarity)) + ' &middot; best ' + e.best.toFixed(1) + ' cm &middot; caught ' + e.c + '&times; &middot; first on ' + day(e.first) + '</span>';
  }
  function paintBook() {
    book.querySelector('.flog-count').textContent = caughtAll() + ' of ' + PONDS.length * 8;
    book.querySelector('.flog-ponds').innerHTML = PONDS.map(function (p) {
      var list = ART.FISH[p.id] || [], slots = '';
      for (var i = 0; i < 8; i++) {
        var f = list[i], e = f && log.fish[f.id];
        if (!f) { slots += '<li><button type="button" class="flog-slot empty" aria-label="Empty slot"><span class="flog-img"></span><span class="flog-name">&mdash;</span></button></li>'; continue; }
        var src = ART.sprite(p.id, f, e ? null : SIL).toDataURL();
        slots += '<li><button type="button" class="flog-slot' + (e ? ' got r-' + f.rarity : '') + (f.ascii ? ' ascii' : '') + '" data-id="' + f.id + '" aria-label="' +
          (e ? esc(f.name) + ', best ' + e.best.toFixed(1) + ' cm, caught ' + e.c + ' times' : 'Not caught yet') + '">' +
          '<span class="flog-img"><img alt="" src="' + src + '"></span><span class="flog-name">' + (e ? esc(f.name) : '???') + '</span>' +
          (e ? '<span class="flog-best">' + e.best.toFixed(1) + ' cm &middot; &times;' + e.c + '</span>' : '') + '</button></li>';
      }
      return '<section class="flog-pond"><h3>' + esc(p.name) + ' <small>' + caughtIn(p.id) + '/8</small></h3><ol class="flog-grid">' + slots + '</ol></section>';
    }).join('');
    book.querySelector('.flog-detail').textContent = 'Pick a fish.';
  }
  function openLog(btnEl) {
    if (!book) buildBook();
    bookFrom = btnEl || null;
    paintBook();
    book.showModal();
  }

  /* ---------------------------------------------------------------- Unlocks
     Every pond's rare: the egg appears on the shelf. All 32: the shiny rod, and a stamp on the footer receipt.
     Kept in dw-fish (unlocks), so the chime and toast happen once. */
  var CHIME = [784, 988, 1319];   // three rising notes for the egg (Hz)
  var eggBtn = document.querySelector('.mini-egg'), master = document.querySelector('.r-master'), toastQ = [];
  function sound() { try { return localStorage.getItem('dw-sound') !== '0'; } catch (e) { return true; } }
  var actx = null;
  function chime(notes) {
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC || !sound()) return;
    try {
      actx = actx || new AC(); if (actx.state === 'suspended') actx.resume();
      notes.forEach(function (f, i) {
        var t = actx.currentTime + i * 0.12, o = actx.createOscillator(), g = actx.createGain();
        o.type = 'square'; o.frequency.value = f;
        g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.06, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
        o.connect(g).connect(actx.destination); o.start(t); o.stop(t + 0.25);
      });
    } catch (e) {}
  }
  function toast(text) {
    var t = document.createElement('a');
    t.className = 'snap-toast'; t.href = '#board'; t.textContent = text;
    document.body.appendChild(t);
    setTimeout(function () { t.classList.add('out'); }, TOAST_MS);
    setTimeout(function () { t.remove(); }, TOAST_MS + 600);
  }
  // Toasts wait until the machine closes: the open machine covers the page.
  function tell(text) { if (isOpen) toastQ.push(text); else toast(text); }
  document.addEventListener('arcade:close', function () { toastQ.splice(0).forEach(function (t, i) { setTimeout(function () { toast(t); }, 700 + i * 1600); }); });
  function paintUnlocks() {
    var u = log.unlocks || {};
    if (eggBtn) eggBtn.hidden = !u.egg;
    if (master) master.hidden = !u.rod;
  }
  function checkUnlocks(live) {
    log.unlocks = log.unlocks || {};
    var rares = PONDS.every(function (p) { return (ART.FISH[p.id] || []).some(function (f) { return f.rarity === 'rare' && log.fish[f.id]; }); });
    var fresh = [];
    if (rares && !log.unlocks.egg) { log.unlocks.egg = Date.now(); fresh.push('egg'); }
    if (caughtAll() === PONDS.length * 8 && !log.unlocks.rod) { log.unlocks.rod = Date.now(); fresh.push('rod'); }
    if (fresh.length) saveLog();
    paintUnlocks();
    if (!live) return;
    if (fresh.indexOf('egg') >= 0) {
      chime(CHIME);
      announce('Every rare caught. Something has appeared on the shelf.');
      tell('An egg has appeared on the shelf.');
      if (eggBtn && !reduce) eggBtn.classList.add('new');
    }
    if (fresh.indexOf('rod') >= 0) {
      chime(CHIME.concat([1568]));
      announce('All thirty-two caught. Your rod is shiny now.');
      tell('All 32. The rod shines now. The receipt says so too.');
    }
  }
  checkUnlocks(false);
  if (eggBtn) eggBtn.addEventListener('click', function () {
    // The egg's own machine comes in the next stage; for now it only wobbles.
    eggBtn.classList.remove('wobble'); void eggBtn.offsetWidth; if (!reduce) eggBtn.classList.add('wobble');
    toast('It is warm. Something is moving inside.');
  });

  window.drunkwizArcade = {
    open: open,
    close: requestClose,
    seed: function (n) { seed = n >>> 0; },   // for tests: makes bites and fights repeatable
    pick: function (pond, zone) { var c = cur; cur = pond; var f = pickFish(zone); cur = c; return f.id; },   // for tests: what would bite
    state: function () { return { open: isOpen, machine: cur, state: G.state, fish: G.fish && G.fish.id, zy: G.zy, fy: G.fy, zone: M && M.zone, progress: G.progress, power: G.power, msg: G.msg }; }
  };
})();
