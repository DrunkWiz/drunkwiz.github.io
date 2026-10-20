/* index.html only. Loaded with defer. */
/* Tear-off receipt with a shaped post slot.
   Mouse: grab the receipt anywhere and drag sideways; the tear follows the cursor.
   If the torn edge has the same shape as the slot's lip (at any height on the
   receipt), the piece slides into the slot; otherwise it falls away.
   Touch, pen and keyboard: a tap (or Enter) lets the printer tear the slot's shape
   for you at that height. Hard mode turns that help off, tightens the fit and
   uses trickier shapes. A new receipt, with a new slot shape, prints after each tear. */
(function () {
  var sheet = document.querySelector('.sheet');
  var receipt = sheet.querySelector('.receipt');
  var hint = document.querySelector('.tear-hint');
  var status = document.querySelector('.printer [role="status"]');
  var post = document.querySelector('.post');
  var postSvg = post.querySelector('svg');
  var postCount = post.querySelector('.post-count');
  var postName = post.querySelector('.post-name');
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var fine = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  var modeBtn = document.querySelector('.mode-btn');
  var hard = false;
  try { hard = localStorage.getItem('vk-hard') === '1'; } catch (e) {}
  function hintText() {
    if (hard) return fine ? 'Hard mode: tear the slot shape freehand.' : 'Hard mode: swipe the slot shape freehand.';
    return fine ? "Tear it in the slot's shape, any height." : "Swipe sideways in the slot's shape, or tap.";
  }

  var REPRINT_AFTER = 3500; // ms after a tear before a new receipt prints
  var STEP = 3;             // px between points on the torn edge
  var SPEED = 18;           // max px the tear advances per frame
  var FOLLOW = 0.5;         // how tightly the tear follows the cursor up and down (0 to 1)
  var FIT = { normal: 8.5, hard: 6.5 }; // how far off (px, on average) a tear can be and still fit
  var LIP = 30;             // y of the slot's lip inside the slot drawing
  var NS = 'http://www.w3.org/2000/svg';
  // Other scripts (sound, the pinboard) listen for these instead of reaching in here.
  function emit(name, detail) { document.dispatchEvent(new CustomEvent('receipt:' + name, { detail: detail || {} })); }

  // Slot shapes: heights (px, + is lower) at evenly spaced points across the receipt.
  // Smooth shapes are curved between points; sharp ones (lin) use straight segments.
  var SHAPES = {
    normal: [
      { name: 'wave',        v: [20, -20, 20, -20, 20] },
      { name: 'hill',        v: [18, 14, -22, 14, 18] },
      { name: 'valley',      v: [-20, 2, 22, 2, -20] },
      { name: 'step',        v: [-18, -18, -18, 18, 18, 18] },
      { name: 'ramp',        v: [-20, -20, 20, 20] },
      { name: 'plateau',     v: [16, 16, -20, -20, 16, 16] },
      { name: 'notch',       v: [-16, -16, 20, 20, -16, -16] },
      { name: 'twin peaks',  v: [18, -20, 12, -20, 18] },
      { name: 'swoop',       v: [-24, 18, 22, 16, -6] },
      { name: 'ledge',       v: [20, 20, 20, -20, -20, 20] },
    ],
    hard: [
      { name: 'zigzag',      v: [-18, 18, -18, 18, -18, 18, -18], lin: true },
      { name: 'stairs',      v: [-21, -21, -7, -7, 7, 7, 21, 21], lin: true },
      { name: 'crown',       v: [-20, 18, -4, 18, -4, 18, -20], lin: true },
      { name: 'lightning',   v: [-22, 8, -6, 22], lin: true },
      { name: 'ripple',      v: [16, -16, 16, -16, 16, -16, 16, -16, 16] },
      { name: 'tooth',       v: [-16, -16, 20, -16, -16], lin: true },
      { name: 'castle',      v: [16, 16, -18, -18, 16, 16, -18, -18, 16, 16], lin: true },
      { name: 'spike',       v: [14, 14, 14, -22, 14, 14, 14], lin: true },
    ],
  };
  function pool() { return SHAPES[hard ? 'hard' : 'normal']; }
  function pick() {
    var list = pool(), next;
    do { next = list[Math.floor(Math.random() * list.length)]; } while (list.length > 1 && next === shape);
    return next;
  }
  var shape = null;
  shape = pick();

  var state = reduce ? 'idle' : 'printing'; // printing | idle | gone
  var count = 1, posted = 0, tear = null, drag = null, auto = null, raf = 0, lastType = 'mouse';

  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function poly(pts) {
    return 'polygon(' + pts.map(function (p) { return p[0].toFixed(1) + 'px ' + p[1].toFixed(1) + 'px'; }).join(',') + ')';
  }
  function strip(el) {
    ['tabindex', 'role', 'aria-label'].forEach(function (a) { el.removeAttribute(a); });
    el.setAttribute('aria-hidden', 'true');
    el.classList.remove('printing');
  }
  // Shape height at u (0 = left edge, 1 = right edge), smoothly interpolated.
  function prof(u) {
    var v = shape.v, n = v.length - 1, pos = clamp(u, 0, 1) * n, i = Math.min(n - 1, Math.floor(pos)), f = pos - i;
    var s = shape.lin ? f : (1 - Math.cos(f * Math.PI)) / 2;
    return v[i] + (v[i + 1] - v[i]) * s;
  }
  function W() { return receipt.offsetWidth; }
  // Where the printer's own tear goes: the slot shape, anchored at height y0 at x0,
  // and kept on the paper.
  function anchorFor(x0, y0) {
    var w = W(), H = receipt.offsetHeight, lo = Infinity, hi = -Infinity;
    for (var x = 0; x <= w; x += 4) { var v = prof(x / w); lo = Math.min(lo, v); hi = Math.max(hi, v); }
    return clamp(y0 - prof(x0 / w), 16 - lo, H - 36 - hi);
  }

  function drawShape() {
    var w = W(), lip = [], top = [];

    // The slot: a dark opening whose bottom edge (the lip) has the same shape.
    var pad = 10;
    postSvg.setAttribute('viewBox', (-pad) + ' 0 ' + (w + pad * 2) + ' 64');
    for (var px = -pad; px <= w + pad; px += 4) {
      var y = LIP + prof(px / w);
      lip.push([px, y]);
      top.push([px, y - 16]);
    }
    var hole = top.concat(lip.slice().reverse()).map(function (p) { return p[0].toFixed(1) + ',' + p[1].toFixed(1); }).join(' ');
    var rim = lip.map(function (p) { return p[0].toFixed(1) + ',' + p[1].toFixed(1); }).join(' ');
    var lipTop = top.map(function (p) { return p[0].toFixed(1) + ',' + p[1].toFixed(1); }).join(' ');
    postSvg.querySelector('.p-hole').setAttribute('points', hole);
    postSvg.querySelector('.p-rim').setAttribute('points', rim);
    postSvg.querySelector('.p-top').setAttribute('points', lipTop);
    postName.textContent = shape.name;
  }

  function fringe() {
    var svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('class', 'fringe');
    svg.setAttribute('aria-hidden', 'true');
    ['f-shade', 'f-hi'].forEach(function (c) {
      var line = document.createElementNS(NS, 'polyline');
      line.setAttribute('class', c);
      svg.appendChild(line);
    });
    return svg;
  }
  function setFringe(svg, pts, off) {
    var lines = svg.querySelectorAll('polyline');
    lines[0].setAttribute('points', pts.map(function (p) { return p[0] + ',' + (p[1] + off * 2.4); }).join(' '));
    lines[1].setAttribute('points', pts.map(function (p) { return p[0] + ',' + (p[1] + off); }).join(' '));
  }

  receipt.addEventListener('animationend', function (e) {
    if (e.animationName !== 'print') return;
    receipt.classList.remove('printing');
    state = 'idle';
    hint.textContent = hintText();
  });

  function begin(dir, y) {
    var w = W(), H = receipt.offsetHeight;
    var stub = receipt.cloneNode(true);       // the part that stays in the printer
    strip(stub);
    stub.classList.add('stub');
    var sf = fringe(); stub.appendChild(sf);
    var pf = fringe(); receipt.appendChild(pf);
    sheet.appendChild(stub);
    sheet.classList.add('tearing');
    var x0 = dir > 0 ? 0 : w;
    y = clamp(y, 16, H - 36);
    tear = { dir: dir, W: w, H: H, tipX: x0, tipY: y, wob: 0, pts: [[x0, y]], stub: stub, sf: sf, pf: pf };
    draw();
    emit('tearstart');
  }

  // Move the tip of the tear toward (tx, ty). With follow, the printer tears neatly
  // in the slot's shape instead. Returns true once the tear reaches the far edge.
  function extend(tx, ty, follow) {
    var t = tear, moved = 0;
    while (moved < SPEED) {
      var left = t.dir > 0 ? tx - t.tipX : t.tipX - tx;
      if (left < STEP) break;
      t.tipX = clamp(t.tipX + t.dir * STEP, 0, t.W);
      moved += STEP;
      if (follow) t.tipY = t.anchor + prof(t.tipX / t.W);
      else t.tipY += (clamp(ty, 16, t.H - 36) - t.tipY) * FOLLOW;   // the tear lags the hand a little
      t.wob = clamp(t.wob + (Math.random() - 0.5) * 1.7, -2.8, 2.8); // slow wander of the fibres
      t.pts.push([t.tipX, t.tipY + t.wob + (Math.random() - 0.5) * 1.5]);
      if (t.tipX === 0 || t.tipX === t.W) break;
    }
    draw();
    return t.tipX === (t.dir > 0 ? t.W : 0);
  }

  function draw() {
    var t = tear, start = t.dir > 0 ? 0 : t.W, far = t.dir > 0 ? t.W : 0;
    var done = t.tipX === far;
    var lower = [], upper = [];
    t.pts.forEach(function (p) {
      var gap = Math.min(5, Math.abs(t.tipX - p[0]) * 0.03); // the tear opens wider behind the tip
      lower.push([p[0], p[1] + gap * 0.75]);
      upper.push([p[0], p[1] - gap * 0.25]);
    });
    var bottom = lower.concat(done ? [] : [[far, t.tipY]]).concat([[far, t.H + 30], [start, t.H + 30]]);
    var top = [[start, -30], [far, -30]].concat(done ? [] : [[far, t.tipY]]).concat(upper.slice().reverse());
    receipt.style.clipPath = poly(bottom);
    t.stub.style.clipPath = poly(top);
    setFringe(t.pf, lower, 1.1);
    setFringe(t.sf, upper, -1.1);
  }

  function loop() {
    if (raf) return;
    raf = requestAnimationFrame(function step() {
      raf = 0;
      if (!tear) return;
      var target = drag ? drag : auto;
      if (!target) return;
      var edge = tear.dir > 0 ? tear.W + 10 : -10;
      if (auto && !auto.follow) auto.y += (Math.random() - 0.5) * 6;
      var doneNow = auto
        ? extend(edge, auto.y, auto.follow)
        : extend(target.x, target.y, false);
      if (doneNow) { finish(); return; }
      raf = requestAnimationFrame(step);
    });
  }

  // Torn edge y at x, read off the tear's points.
  function edgeAt(pts, x) {
    for (var i = 1; i < pts.length; i++) {
      var a = pts[i - 1], b = pts[i];
      if ((x - a[0]) * (x - b[0]) <= 0) {
        var f = b[0] === a[0] ? 0 : (x - a[0]) / (b[0] - a[0]);
        return a[1] + (b[1] - a[1]) * f;
      }
    }
    return pts[pts.length - 1][1];
  }
  // How closely the torn edge matches the slot's shape. Height doesn't matter, only shape.
  function score(t) {
    var pts = t.pts.slice().sort(function (a, b) { return a[0] - b[0]; });
    var diffs = [], n = 24;
    for (var k = 0; k < n; k++) {
      var x = t.W * (0.04 + 0.92 * k / (n - 1));
      diffs.push(edgeAt(pts, x) - prof(x / t.W));
    }
    var mean = diffs.reduce(function (s, d) { return s + d; }, 0) / n;
    var rms = Math.sqrt(diffs.reduce(function (s, d) { return s + (d - mean) * (d - mean); }, 0) / n);
    return { rms: rms, fits: rms <= FIT[hard ? 'hard' : 'normal'], pct: Math.round(clamp(1 - rms / 24, 0, 1) * 100) };
  }

  function finish() {
    var t = tear;
    tear = null; drag = null; auto = null; state = 'gone';
    sheet.classList.remove('grabbing');
    var s = score(t);
    emit('torn', { fits: s.fits, pct: s.pct });

    var r = receipt.getBoundingClientRect();
    var wrap = document.createElement('div');
    wrap.className = 'fall';
    wrap.setAttribute('aria-hidden', 'true');
    wrap.style.cssText = 'left:' + r.left + 'px;top:' + r.top + 'px;width:' + r.width + 'px';
    var piece = receipt.cloneNode(true);
    strip(piece);
    wrap.appendChild(piece);
    document.body.appendChild(wrap);

    receipt.style.visibility = 'hidden';
    receipt.style.clipPath = '';
    t.pf.remove();

    if (s.fits) {
      posted += 1;
      hint.textContent = s.pct >= 92 ? 'Perfect fit. Posted.' : 'Posted, ' + s.pct + '% match.';
      status.textContent = 'The torn piece fit the slot and was posted. A new receipt prints in a few seconds.';
      slideIn(wrap, t, r);
    } else {
      hint.textContent = 'No fit, ' + s.pct + '% match. Try again.';
      status.textContent = 'The torn piece did not fit the slot and fell away. A new receipt prints in a few seconds.';
      fallAway(wrap, t, r);
    }

    setTimeout(function () {
      t.stub.style.transition = 'opacity .35s';
      t.stub.style.opacity = '0';
      setTimeout(function () { t.stub.remove(); sheet.classList.remove('tearing'); }, 400);
      count += 1;
      receipt.querySelector('.r-no').textContent = String(count).padStart(4, '0');
      shape = pick();
      drawShape();
      receipt.style.visibility = '';
      status.textContent = 'New receipt printed. The slot is now a ' + shape.name + '.';
      if (reduce) {
        state = 'idle';
        hint.textContent = hintText();
      } else {
        state = 'printing';
        hint.textContent = 'Printing a new one…';
        receipt.classList.remove('printing');
        void receipt.offsetWidth; // restart the print animation
        receipt.classList.add('printing');
      }
    }, REPRINT_AFTER);
  }

  function fallAway(wrap, t, r) {
    var last = t.pts[t.pts.length - 1];
    wrap.style.transformOrigin = last[0] + 'px ' + last[1] + 'px';
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        if (reduce) {
          wrap.style.transition = 'opacity .4s';
          wrap.style.opacity = '0';
        } else {
          var dx = t.dir * (30 + Math.random() * 70);
          var rot = -t.dir * (12 + Math.random() * 22);
          wrap.style.transition = 'transform 1.3s cubic-bezier(.45,0,.9,.55)';
          wrap.style.transform = 'translate(' + dx.toFixed(0) + 'px,' + (window.innerHeight + r.height).toFixed(0) + 'px) rotate(' + rot.toFixed(0) + 'deg)';
        }
      });
    });
    setTimeout(function () { wrap.remove(); }, 1500);
  }

  // Slide the piece straight down behind the slot's lip, so it disappears into the slot.
  function slideIn(wrap, t, r) {
    var pr = postSvg.getBoundingClientRect();
    var vb = postSvg.viewBox.baseVal, k = pr.width / vb.width;
    var w = t.W;
    // Page y of the lip at receipt x.
    function lipPage(x) { return pr.top + (LIP + prof(x / w)) * k; }
    var pts = t.pts.slice().sort(function (a, b) { return a[0] - b[0]; });
    var dist = 0;
    for (var x = 0; x <= w; x += 6) dist = Math.max(dist, lipPage(x) - (r.top + edgeAt(pts, x)));
    dist += 10;
    function clipAt(dy) {
      var c = [[-40, -2000], [w + 40, -2000]];
      for (var x = w + 40; x >= -40; x -= 6) c.push([x, lipPage(x) - r.top - dy]);
      wrap.style.clipPath = poly(c);
      wrap.style.transform = 'translateY(' + dy.toFixed(1) + 'px)';
    }
    function done() {
      wrap.remove();
      postCount.textContent = String(posted).padStart(3, '0');
      var sorted = t.pts.slice().sort(function (a, b) { return a[0] - b[0]; });
      emit('posted', { no: receipt.querySelector('.r-no').textContent, shape: shape.name, pct: score(t).pct,
        edge: sorted.filter(function (p, i) { return i % 4 === 0; }).map(function (p) { return [+(p[0] / t.W).toFixed(3), Math.round(p[1])]; }) });
      post.classList.remove('gulp');
      void post.offsetWidth;
      post.classList.add('gulp');
    }
    if (reduce) { clipAt(dist); done(); return; }
    var t0 = performance.now(), D = 950;
    requestAnimationFrame(function frame(now) {
      var p = clamp((now - t0) / D, 0, 1);
      clipAt(dist * p * p);                  // speeds up as it drops, like it's being pulled in
      if (p < 1) requestAnimationFrame(frame); else done();
    });
  }

  // A click, tap or Enter. Normal mode: the printer tears the slot's shape at that
  // height, so it posts. Hard mode: you get a plain rough tear, no help.
  function rip(localY) {
    if (state !== 'idle') return;
    var dir = Math.random() < 0.5 ? 1 : -1, x0 = dir > 0 ? 0 : W();
    var y0 = localY == null ? receipt.offsetHeight * 0.55 : localY;
    if (!tear) {
      if (hard) begin(dir, y0);
      else { var a = anchorFor(x0, y0); begin(dir, a + prof(x0 / W())); tear.anchor = a; }
    }
    var follow = !hard;
    if (reduce) { while (!extend(tear.dir > 0 ? tear.W + 10 : -10, tear.tipY, follow)) {} finish(); return; }
    auto = { follow: follow, y: tear.tipY };
    loop();
  }

  // Receipt lines with data-goto are shortcuts to their project.
  function jump(el) {
    if (!el || state === 'gone') return false;
    emit('goto', { id: el.getAttribute('data-goto') });
    return true;
  }

  function local(e) {
    var r = receipt.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  // Mouse, finger or pen: drag sideways across the receipt to tear it. The receipt
  // only claims sideways swipes (touch-action: pan-y), so swiping up and down still
  // scrolls the page. A tap or click without dragging lets rip() tear it.
  var suppressClick = false;
  sheet.addEventListener('pointerdown', function (e) {
    lastType = e.pointerType;
    if (state !== 'idle' || auto || drag) return;
    if (e.pointerType === 'mouse') {
      if (e.button !== 0) return;
      e.preventDefault();
    }
    var p = local(e);
    drag = { id: e.pointerId, type: e.pointerType, sx: e.clientX, sy: e.clientY, x: p.x, y: p.y, downY: p.y, moved: false, line: e.target.closest('[data-goto]') };
    try { sheet.setPointerCapture(e.pointerId); } catch (err) {}
    if (e.pointerType === 'mouse') sheet.classList.add('grabbing');
  });
  sheet.addEventListener('pointermove', function (e) {
    if (!drag || e.pointerId !== drag.id) return;
    var p = local(e);
    var dx = e.clientX - drag.sx, dy = e.clientY - drag.sy;
    if (!drag.moved) {
      var need = drag.type === 'mouse' ? 5 : 8;
      if (Math.abs(dx) < need) return;
      if (drag.type !== 'mouse' && Math.abs(dy) > Math.abs(dx)) return; // vertical: let the page scroll
      drag.moved = true;
      if (!tear) begin(dx >= 0 ? 1 : -1, drag.downY);
    }
    if (e.cancelable && drag.type !== 'mouse') e.preventDefault();
    drag.x = p.x; drag.y = p.y;
    loop();
  });
  function release(e) {
    if (!drag || (e && e.pointerId !== drag.id)) return;
    var d = drag;
    drag = null;
    sheet.classList.remove('grabbing');
    if (d.moved) { suppressClick = true; setTimeout(function () { suppressClick = false; }, 400); return; }
    if (d.type === 'mouse' && !tear && !jump(d.line)) rip(d.downY);   // a plain click: see rip(). Taps arrive as click events.
  }
  sheet.addEventListener('pointerup', release);
  sheet.addEventListener('pointercancel', release);   // the browser took over to scroll; keep any partial tear
  sheet.addEventListener('click', function (e) {
    if (lastType === 'mouse' || suppressClick) return;
    if (!tear && jump(e.target.closest('[data-goto]'))) return;
    rip(local(e).y);
  });
  receipt.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); rip(); }
  });
  window.addEventListener('resize', function () { if (!tear && state !== 'gone') drawShape(); });

  function setHard(on) {
    hard = on;
    try { localStorage.setItem('vk-hard', on ? '1' : '0'); } catch (e) {}
    modeBtn.setAttribute('aria-pressed', on ? 'true' : 'false');
    modeBtn.querySelector('.mode-state').textContent = on ? 'on' : 'off';
    if (!tear && state === 'idle') { shape = pick(); drawShape(); }
    if (state !== 'gone') hint.textContent = hintText();
  }
  modeBtn.addEventListener('click', function () { setHard(!hard); });

  setHard(hard);
  drawShape();
  hint.textContent = hintText();
})();
