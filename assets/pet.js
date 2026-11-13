/* index.html only. Loaded by extras.js once the page is idle (when there is a pet to show), or by the egg
   machine when it opens. Needs arcade-art.js first.
   The pet: hatched from the egg on the shelf, fed with catches, it swims across the page behind the content.
   It grows from 1 to 100; past 80 it struggles; at 100 it bursts and leaves a skeleton, and a new egg waits.
   Skeletons drift too, at most 10. Older ones crumble and are remembered on the board (next stage).
   Kept in localStorage (dw-pet). Nothing is sent anywhere. */
(function () {
  var ART = window.drunkwizArt;
  if (!ART || window.drunkwizPet) return;
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------------------------------------------------------------- Tuning */
  var FRAME_MS = 1000 / 30;    // the page canvas draws at 30 fps at most: it's background, not the show
  var SIZE_MAX = 100;          // bursts here
  var WARN_AT = 80;            // from here it sweats, wobbles and swims like it's tired
  var FEED = { common: 1, uncommon: 2, rare: 3, night: 5 };   // size per feed; uncommon sits between common and rare
  var W_MIN = 24;              // sprite width on the page at size 1, in CSS px
  var W_MAX = 160;             // and at size 100
  var SWIM = 36;               // px per second at size 1
  var SWIM_BIG = 0.45;         // a full-size pet swims this much slower
  var TIRED = 0.5;             // and past WARN_AT, this much slower again, in fits and starts
  var BOB_PX = 6;              // how far it bobs up and down
  var EDGE = 12;               // turns this far from the window's sides
  var LANE_EVERY = [6, 14];    // seconds between drifting to a new height on the page
  var SKEL_MAX = 10;           // skeletons kept: one shared canvas has to stay light on a low-end phone
  var SKEL_ALPHA = 0.35;       // skeletons are faint
  var SKEL_SPEED = [8, 16];    // px per second
  var SKEL_W = 64;             // a skeleton's width on the page
  var GONE_MAX = 12;           // remembered pets kept
  var BURST_MS = 1400;         // the explosion on the page
  var FIRST_RUN = ['fish', 'cat', 'lion', 'dragon', 'kraken', 'phoenix'];   // the first six hatch in this order
  var LATER = { fish: 3, cat: 3, lion: 3, kraken: 3, dragon: 1, phoenix: 1 };   // after that, at random; dragon and phoenix are rare
  var NAMES = ['Kopi', 'Kaya', 'Teh', 'Milo', 'Bandung', 'Tiger', 'Botak', 'Ah Boy', 'Lobang', 'Blur', 'Siao', 'Kiasu'];
  var KEY = 'dw-pet';

  /* ---------------------------------------------------------------- State */
  function fresh() { return { v: 1, pet: null, egg: true, hatched: 0, skel: [], gone: [] }; }
  var S;
  try { S = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { S = null; }
  if (!S || S.v !== 1) S = fresh();
  function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} }
  function pick(list) { return list[Math.floor(Math.random() * list.length)]; }
  function nextKind() {
    if (S.hatched < FIRST_RUN.length) return FIRST_RUN[S.hatched];
    var total = 0, k; for (k in LATER) total += LATER[k];
    var r = Math.random() * total;
    for (k in LATER) { r -= LATER[k]; if (r <= 0) return k; }
    return 'fish';
  }
  function card(p, how, at) { return { kind: p.kind, name: p.name, born: p.born, lost: at, fed: p.fed, how: how }; }
  function remember(c) { S.gone.push(c); if (S.gone.length > GONE_MAX) S.gone.shift(); }

  function hatch() {
    if (!S.egg || S.pet) return S.pet;
    var now = Date.now();
    S.pet = { kind: nextKind(), name: pick(NAMES), size: 1, born: now, last: now, fed: 0 };
    S.hatched++; S.egg = false;
    save(); place(true); wake();
    return S.pet;
  }
  function feed(rarity) {
    var p = S.pet; if (!p) return null;
    p.size += FEED[rarity] || 1; p.fed++; p.last = Date.now();
    var out = { size: Math.min(p.size, SIZE_MAX), warn: p.size >= WARN_AT, burst: p.size >= SIZE_MAX, pet: p };
    if (out.burst) burst();
    save(); wake();
    return out;
  }
  // At 100 it bursts: the skeleton stays, the 11th skeleton crumbles and is remembered, and a new egg waits.
  function burst() {
    var p = S.pet, now = Date.now();
    S.skel.push({ kind: p.kind, name: p.name, born: p.born, died: now, fed: p.fed });
    if (S.skel.length > SKEL_MAX) { var old = S.skel.shift(); remember({ kind: old.kind, name: old.name, born: old.born, lost: now, fed: old.fed, how: 'burst' }); }
    pending = { kind: p.kind, size: p.size, x: E.x, y: E.y, dir: E.dir };
    S.pet = null; S.egg = true;
    syncSkel();
  }

  /* ---------------------------------------------------------------- The page canvas, behind everything */
  var cv = null, ctx = null, dpr = 1, vw = 0, vh = 0, raf = 0, lastT = 0, running = false;
  var E = { x: 40, y: 200, dir: 1, lane: 200, laneAt: 0 }, SK = [], parts = [], pending = null;
  function widthFor(size) { return W_MIN + (W_MAX - W_MIN) * Math.min(size, SIZE_MAX) / SIZE_MAX; }
  function ensure() {
    if (cv) return;
    cv = document.createElement('canvas');
    cv.className = 'pet-sea'; cv.setAttribute('aria-hidden', 'true');
    document.body.insertBefore(cv, document.body.firstChild);
    ctx = cv.getContext('2d');
    window.addEventListener('resize', function () { size(); if (reduce) draw(performance.now()); });
    document.addEventListener('visibilitychange', function () { if (!document.hidden) wake(); });
    size();
  }
  function size() {
    dpr = Math.min(2, window.devicePixelRatio || 1); vw = window.innerWidth; vh = window.innerHeight;
    cv.width = Math.round(vw * dpr); cv.height = Math.round(vh * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.imageSmoothingEnabled = false;
  }
  function between(a, b) { return a + Math.random() * (b - a); }
  // Reduced motion: still sprites in fixed spots. Otherwise a starting place and a height to drift to.
  function place(fresh) {
    if (reduce) { E.x = vw - widthFor(S.pet ? S.pet.size : 1) - 24; E.y = vh * 0.7; E.dir = -1; return; }
    if (fresh) { E.x = between(EDGE, Math.max(EDGE, vw - 80)); E.y = E.lane = between(vh * 0.2, vh * 0.8); E.dir = Math.random() < 0.5 ? -1 : 1; }
  }
  function syncSkel() {
    while (SK.length < S.skel.length) SK.push({ x: between(0, vw), y: between(vh * 0.15, vh * 0.85), dir: Math.random() < 0.5 ? -1 : 1, v: between(SKEL_SPEED[0], SKEL_SPEED[1]), ph: Math.random() * 6 });
    while (SK.length > S.skel.length) SK.shift();
    if (reduce) SK.forEach(function (k, i) { k.x = 24 + i * (SKEL_W + 12); k.y = vh - 70; k.dir = 1; });
  }
  function wake() {
    if (!S.pet && !S.skel.length && !parts.length && !pending) { if (cv) ctx.clearRect(0, 0, vw, vh); return; }
    ensure(); syncSkel();
    if (reduce) { draw(performance.now()); return; }
    if (running) return;
    running = true; lastT = performance.now();
    raf = requestAnimationFrame(frame);
  }
  function frame(now) {
    if (document.hidden) { running = false; return; }   // paused while the tab is hidden
    if (now - lastT >= FRAME_MS) {
      var dt = Math.min(0.1, (now - lastT) / 1000); lastT = now;
      step(now, dt); draw(now);
    }
    if (!S.pet && !S.skel.length && !parts.length) { running = false; ctx.clearRect(0, 0, vw, vh); return; }
    raf = requestAnimationFrame(frame);
  }
  function step(now, dt) {
    var p = S.pet;
    if (p) {
      var w = widthFor(p.size), t = now / 1000;
      var v = SWIM * (1 - SWIM_BIG * Math.min(p.size, SIZE_MAX) / SIZE_MAX);
      if (p.size >= WARN_AT) v *= TIRED * (0.3 + 0.7 * Math.abs(Math.sin(t * 1.3)));   // in fits and starts
      E.x += E.dir * v * dt;
      if (E.x < EDGE) { E.x = EDGE; E.dir = 1; }
      if (E.x > vw - w - EDGE) { E.x = vw - w - EDGE; E.dir = -1; }
      if (now > E.laneAt) { E.lane = between(vh * 0.15, vh * 0.85 - w); E.laneAt = now + between(LANE_EVERY[0], LANE_EVERY[1]) * 1000; }
      E.y += (E.lane - E.y) * Math.min(1, 0.25 * dt);
    }
    SK.forEach(function (k) { k.x += k.dir * k.v * dt; if (k.x < -SKEL_W) k.x = vw; if (k.x > vw) k.x = -SKEL_W; });
    parts = parts.filter(function (q) { q.x += q.vx * dt; q.y += q.vy * dt; q.vy += 260 * dt; q.life -= dt; return q.life > 0; });
  }
  function draw(now) {
    ctx.clearRect(0, 0, vw, vh);
    var t = now / 1000;
    ctx.globalAlpha = SKEL_ALPHA;
    SK.forEach(function (k, i) {
      var s = S.skel[i]; if (!s) return;
      var img = ART.pet(s.kind, 'bone', k.dir < 0), sc = SKEL_W / img.width;
      ctx.drawImage(img, Math.round(k.x), Math.round(k.y + (reduce ? 0 : Math.sin(t * 0.7 + k.ph) * 4)), Math.round(img.width * sc), Math.round(img.height * sc));
    });
    ctx.globalAlpha = 1;
    var p = S.pet;
    if (p) {
      var img = ART.pet(p.kind, 'live', E.dir < 0), w = widthFor(p.size), sc = w / img.width, h = img.height * sc;
      var bob = reduce ? 0 : Math.sin(t * 1.6) * BOB_PX, tired = p.size >= WARN_AT;
      ctx.save();
      ctx.translate(Math.round(E.x + w / 2), Math.round(E.y + bob + h / 2));
      if (tired && !reduce) ctx.rotate(Math.sin(t * 9) * 0.07);   // the wobble
      ctx.drawImage(img, Math.round(-w / 2), Math.round(-h / 2), Math.round(w), Math.round(h));
      ctx.restore();
      if (tired) {   // sweat: two drops running off the head
        ctx.fillStyle = '#9FD3F0';
        var d = Math.max(2, Math.round(sc));
        for (var i = 0; i < 2; i++) {
          var q = reduce ? 0.3 : ((t * 1.4 + i * 0.5) % 1);
          var hx = E.x + (E.dir > 0 ? w * 0.75 : w * 0.25) + (i ? d * 3 : -d * 2);
          ctx.fillRect(Math.round(hx), Math.round(E.y + bob + h * 0.05 + q * h * 0.5), d, d * 2);
        }
      }
    }
    parts.forEach(function (q) { ctx.globalAlpha = Math.max(0, Math.min(1, q.life)); ctx.fillStyle = q.c; ctx.fillRect(Math.round(q.x), Math.round(q.y), q.s, q.s); });
    ctx.globalAlpha = 1;
  }
  // The burst on the page plays once the machine is closed, where the pet was swimming.
  function explode() {
    if (!pending) return;
    var b = pending; pending = null;
    if (reduce) { wake(); return; }
    var P = ART.PETS[b.kind], w = widthFor(b.size), sc = w / P.px[0].length;
    P.px.forEach(function (row, y) {
      for (var x = 0; x < row.length; x += 2) {
        var ch = row[x]; if (ch === '.') continue;
        var px = b.x + x * sc, py = b.y + y * sc, a = Math.atan2(py - (b.y + w / 3), px - (b.x + w / 2));
        parts.push({ x: px, y: py, vx: Math.cos(a) * between(60, 220), vy: Math.sin(a) * between(60, 220) - 80, c: P.pal[+ch], s: Math.max(2, Math.round(sc * 1.5)), life: BURST_MS / 1000 * between(0.6, 1) });
      }
    });
    document.dispatchEvent(new CustomEvent('pet:burst', { detail: { kind: b.kind } }));
    wake();
  }
  document.addEventListener('arcade:close', function () { setTimeout(explode, 350); });

  place(true); syncSkel(); wake();

  window.drunkwizPet = {
    get: function () { return JSON.parse(JSON.stringify(S)); },
    hatch: hatch,
    feed: feed,
    WARN_AT: WARN_AT, SIZE_MAX: SIZE_MAX, FEED: FEED,
    where: function () { return { x: E.x, y: E.y, dir: E.dir, w: S.pet ? widthFor(S.pet.size) : 0, skel: SK.length, parts: parts.length }; }   // for tests
  };
})();
