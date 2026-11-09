/* index.html only. Loaded with defer, after receipt.js and extras.js.
   Easter eggs, none of them announced on the page:
   - a receipt in the developer console
   - type a kopitiam order anywhere ("kopi o kosong peng") and it prints on the receipt
   - a kopi card that stamps every posted receipt; ten stamps earn a kopi on me
   - after midnight (the visitor's own clock) the shop is closing: lights dim, LAST ORDER, slow printing
   - shake a phone to feed a fresh receipt
   - press D for digicam mode
   - the camera in the footer is a photobooth that prints you as a thermal photo
   Nothing here sends anything anywhere. The camera image never leaves the browser. */
(function () {
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var P = window.drunkwizPrinter;
  function store(k, v) { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) { return null; } }
  function typing(e) {
    var t = e.target;
    return t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName));
  }
  // run fn once the printer is free (it may be mid-print or mid-tear)
  function whenIdle(fn, tries) {
    tries = tries || 0;
    if (!P) return;
    if (P.idle()) { fn(); return; }
    if (tries < 40) setTimeout(function () { whenIdle(fn, tries + 1); }, 250);
  }
  function say(msg) { var s = document.querySelector('.printer [role="status"]'); if (s) s.textContent = msg; }

  /* ---------------------------------------------------------------- 1. For developers */
  try {
    var rec = [
      '┌──────────────────────────────┐',
      '│          drunkwiz            │',
      '│  Receipt no. DEV-0001        │',
      '├──────────────────────────────┤',
      '│  Reading the source     ✓    │',
      '│  Curiosity              1x   │',
      '├──────────────────────────────┤',
      '│  Say hi:                     │',
      '│  github.com/DrunkWiz         │',
      '└──────────────────────────────┘'
    ].join('\n');
    console.log('%c' + rec, 'font:13px/1.35 ui-monospace,Menlo,Consolas,monospace;color:#34333A;background:#FBFAF5;padding:10px 12px');
    console.log('%cPS. Try typing a kopi order on the page. Or press D. Or come back after midnight.', 'font:12px ui-monospace,monospace;color:#C9372F');
  } catch (e) {}

  /* ---------------------------------------------------------------- 2. Kopitiam orders */
  // Base drinks and prices (S$, roughly a 2026 kopitiam), then what each word does to it.
  var BASE = { 'kopi': ['Kopi', 1.5, 'coffee, condensed milk'], 'teh': ['Teh', 1.5, 'tea, condensed milk'],
    'teh tarik': ['Teh tarik', 1.8, 'pulled milk tea'], 'teh halia': ['Teh halia', 1.8, 'ginger milk tea'],
    'milo': ['Milo', 1.8, 'chocolate malt'], 'milo dinosaur': ['Milo dinosaur', 3.5, 'with a hill of Milo powder on top'],
    'yuan yang': ['Yuan yang', 1.7, 'coffee and tea, mixed'], 'bandung': ['Bandung', 2.0, 'rose syrup and milk'] };
  var MOD = { 'o': [-0.2, 'black'], 'c': [0.1, 'evaporated milk'], 'kosong': [0, 'no sugar'], 'siew dai': [0, 'less sweet'],
    'ga dai': [0, 'extra sweet'], 'gao': [0.2, 'extra strong'], 'po': [0, 'weak'], 'peng': [0.4, 'iced'] };
  var ORDER = /(milo dinosaur|teh tarik|teh halia|yuan yang|bandung|kopi|teh|milo)((?: (?:o|c|kosong|siew dai|ga dai|gao|po|peng))*)$/;
  var buf = '', bufTimer = 0;
  function money(x) { return '$' + x.toFixed(2); }
  function addOrder(base, mods) {
    var b = BASE[base], price = b[1], notes = [], name = b[0];
    var desc = b[2];
    mods.forEach(function (m) {
      var d = MOD[m]; price += d[0];
      name += ' ' + m.split(' ').map(function (w) { return w[0].toUpperCase() + w.slice(1); }).join(' ');
      notes.push(d[1]);
    });
    if (mods.indexOf('o') >= 0 || mods.indexOf('c') >= 0) desc = desc.replace(/, condensed milk|milk tea/, function (x) { return x === 'milk tea' ? 'tea' : ''; });
    var R = P.receipt, box = R.querySelector('.r-orders');
    if (!box) {
      box = document.createElement('div');
      box.className = 'r-orders';
      box.innerHTML = '<hr class="r-rule"><ul class="r-list"></ul><ul class="r-list"><li class="r-sub"><span>Drinks</span><span class="r-drinks">$0.00</span></li></ul>';
      R.querySelector('.r-rule').insertAdjacentElement('beforebegin', box);
    }
    var ul = box.querySelector('ul'), li = document.createElement('li');
    li.className = 'r-drink'; li.setAttribute('data-price', price.toFixed(2));
    li.innerHTML = '<span class="r-item">' + name + '<small>' + [desc].concat(notes).filter(Boolean).join(', ') + '</small></span><span>' + money(price) + '</span>';
    ul.appendChild(li);
    while (ul.children.length > 4) ul.removeChild(ul.firstElementChild);   // a receipt holds four drinks
    var sum = [].reduce.call(ul.children, function (s, x) { return s + parseFloat(x.getAttribute('data-price')); }, 0);
    box.querySelector('.r-drinks').textContent = money(sum);
    P.feed('Order printed: ' + name + ', ' + money(price) + '.');
  }
  document.addEventListener('keydown', function (e) {
    if (typing(e) || e.ctrlKey || e.metaKey || e.altKey || !P) return;
    var k = e.key.length === 1 ? e.key.toLowerCase() : '';
    if (!/[a-z ]/.test(k)) return;
    buf = (buf + k).slice(-40).replace(/ +/g, ' ');
    clearTimeout(bufTimer);
    // wait for a pause, so "kopi o kosong peng" is read as one order, not four
    bufTimer = setTimeout(function () {
      var m = buf.trim().match(ORDER);
      buf = '';
      if (!m) return;
      var mods = (m[2] || '').trim() ? m[2].trim().match(/siew dai|ga dai|kosong|peng|gao|po|o|c/g) : [];
      if (/^(milo|milo dinosaur|bandung|yuan yang|teh tarik|teh halia)$/.test(m[1])) mods = mods.filter(function (x) { return x !== 'o' && x !== 'c'; });
      whenIdle(function () { addOrder(m[1], mods); });
    }, 900);
  });
  // drinks belong to the receipt they were printed on
  document.addEventListener('receipt:fresh', function () {
    var o = P && P.receipt.querySelector('.r-orders'); if (o) o.remove();
    var ph = P && P.receipt.querySelector('.r-photo'); if (ph) ph.remove();
  });

  /* ---------------------------------------------------------------- 3. Kopi card */
  var card = document.querySelector('.kopi-card');
  if (card) {
    var holes = card.querySelector('.kc-holes'), reward = card.querySelector('.kc-reward'), cnt = card.querySelector('.kc-count');
    for (var i = 0; i < 10; i++) {
      var h = document.createElement('li');
      h.innerHTML = i === 9 ? '<span>FREE</span>' : '<span>' + (i + 1) + '</span>';
      holes.appendChild(h);
    }
    var paintCard = function (fresh) {
      var n = Math.min(10, parseInt(store('dw-stamps') || '0', 10) || 0);
      [].forEach.call(holes.children, function (h, k) {
        var on = k < n;
        h.classList.toggle('on', on);
        h.classList.toggle('new', !!fresh && on && k === n - 1 && !reduce);
      });
      cnt.textContent = n + ' of 10';
      card.setAttribute('aria-label', 'Kopi card, ' + n + ' of 10 stamps');
      reward.hidden = n < 10;
    };
    document.addEventListener('receipt:posted', function () {
      var n = Math.min(10, (parseInt(store('dw-stamps') || '0', 10) || 0) + 1);
      store('dw-stamps', String(n));
      paintCard(true);
    });
    paintCard(false);
  }

  /* ---------------------------------------------------------------- 4. Closing time */
  var hr = new Date().getHours();
  if (hr < 5) {   // midnight to 5am on the visitor's own clock
    document.documentElement.classList.add('after-hours');
    var where = P && P.receipt.querySelector('.r-head > span');
    if (where) where.textContent = 'LAST ORDER';
    if (P && !reduce) P.hint.setAttribute('data-sleepy', '');
  }

  /* ---------------------------------------------------------------- 5. Shake to reprint */
  // iOS asks permission for motion data; an easter egg shouldn't trigger a permission prompt, so it's Android and the like only.
  if (window.DeviceMotionEvent && typeof DeviceMotionEvent.requestPermission !== 'function' && P) {
    var last = 0, prev = null;
    window.addEventListener('devicemotion', function (e) {
      var a = e.accelerationIncludingGravity; if (!a || a.x == null) return;
      if (prev) {
        var jolt = Math.abs(a.x - prev.x) + Math.abs(a.y - prev.y) + Math.abs(a.z - prev.z);
        var now = Date.now();
        if (jolt > 28 && now - last > 2500) { last = now; if (P.idle()) P.feed('Shaken, not torn. A fresh receipt printed.'); }
      }
      prev = { x: a.x, y: a.y, z: a.z };
    });
  }

  /* ---------------------------------------------------------------- 6. Digicam mode */
  var cam = null;
  function stampDate(d) {
    var p = function (n) { return String(n).padStart(2, '0'); };
    return "'" + p(d.getFullYear() % 100) + ' ' + p(d.getMonth() + 1) + ' ' + p(d.getDate());
  }
  function shutterSound() {
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC || store('dw-sound') === '0') return;
    try {
      var c = new AC(), t = c.currentTime;
      [0, 0.07].forEach(function (dt) {   // the two clicks of a mechanical-sounding shutter
        var b = c.createBuffer(1, c.sampleRate * 0.04, c.sampleRate), d = b.getChannelData(0);
        for (var i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 3);
        var s = c.createBufferSource(), g = c.createGain(), f = c.createBiquadFilter();
        f.type = 'highpass'; f.frequency.value = 1500; g.gain.value = 0.35;
        s.buffer = b; s.connect(f).connect(g).connect(c.destination); s.start(t + dt);
      });
      setTimeout(function () { c.close(); }, 600);
    } catch (e) {}
  }
  function flash() {
    shutterSound();
    if (reduce) return;
    var f = document.createElement('div'); f.className = 'dc-flash'; document.body.appendChild(f);
    setTimeout(function () { f.remove(); }, 600);
  }
  function digicam(on) {
    if (on && !cam) {
      cam = document.createElement('div');
      cam.className = 'digicam';
      cam.setAttribute('aria-hidden', 'true');
      cam.innerHTML = '<div class="dc-blur"></div><div class="dc-grain"></div>' +
        '<div class="dc-top"><span class="dc-rec"><i></i>REC</span><span class="dc-mode">P &nbsp;ISO 400 &nbsp;1/60 &nbsp;F2.8</span><span class="dc-bat"><i></i><i></i><i></i></span></div>' +
        '<div class="dc-frame"><i></i><i></i><i></i><i></i></div>' +
        '<div class="dc-bot"><span>[ 2048 ] 7.2M &nbsp;D to exit</span><span class="dc-date">' + stampDate(new Date()) + '</span></div>';
      document.body.appendChild(cam);
      document.documentElement.classList.add('in-digicam');
      say('Digicam mode on. Press D or Escape to leave.');
    } else if (!on && cam) {
      cam.remove(); cam = null;
      document.documentElement.classList.remove('in-digicam');
      say('Digicam mode off.');
    }
  }
  document.addEventListener('keydown', function (e) {
    if (typing(e) || e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key === 'Escape' && cam) { digicam(false); return; }
    // D on its own, after a pause, so it never fires in the middle of an order like "milo dinosaur"
    if (e.key === 'd' || e.key === 'D') { if (cam) digicam(false); else if (buf.trim() === 'd') digicam(true); }
  });
  document.addEventListener('pointerdown', function () { if (cam) flash(); }, true);

  /* ---------------------------------------------------------------- 7. Photobooth */
  var boothBtn = document.querySelector('.booth-btn'), dlg = document.querySelector('.booth');
  if (boothBtn && dlg && P && navigator.mediaDevices && navigator.mediaDevices.getUserMedia && dlg.showModal) {
    boothBtn.hidden = false;
    var video = dlg.querySelector('video'), snap = dlg.querySelector('.booth-snap'), msg = dlg.querySelector('.booth-msg');
    var stream = null;
    var stop = function () { if (stream) { stream.getTracks().forEach(function (t) { t.stop(); }); stream = null; } video.srcObject = null; };
    dlg.querySelector('.booth-date').textContent = stampDate(new Date());
    boothBtn.addEventListener('click', function () {
      msg.textContent = 'Asking for your camera…';
      snap.disabled = true;
      dlg.showModal();
      navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 960 }, height: { ideal: 720 } }, audio: false }).then(function (s) {
        stream = s; video.srcObject = s;
        return video.play();
      }).then(function () {
        msg.textContent = 'Smile. The photo stays in your browser.';
        snap.disabled = false;
        snap.focus();
      }).catch(function () {
        msg.textContent = 'No camera, or permission was declined. Nothing was recorded.';
      });
    });
    dlg.addEventListener('close', stop);
    dlg.querySelector('.booth-close').addEventListener('click', function () { dlg.close(); });

    // Thermal printers print dots, not greys: Atkinson dithering turns the photo into dots.
    var dither = function (w, h) {
      var c = document.createElement('canvas'); c.width = w; c.height = h;
      var x = c.getContext('2d');
      var vw = video.videoWidth, vh = video.videoHeight, want = w / h, sw = vw, sh = vh;
      if (vw / vh > want) sw = vh * want; else sh = vw / want;
      x.translate(w, 0); x.scale(-1, 1);   // mirror, like the preview
      x.drawImage(video, (vw - sw) / 2, (vh - sh) / 2, sw, sh, 0, 0, w, h);
      var img = x.getImageData(0, 0, w, h), d = img.data, g = new Float32Array(w * h);
      for (var i = 0; i < w * h; i++) {
        var v = 0.299 * d[i * 4] + 0.587 * d[i * 4 + 1] + 0.114 * d[i * 4 + 2];
        g[i] = Math.min(255, Math.max(0, (v - 128) * 1.25 + 140));   // a little contrast, a little lift
      }
      for (var y = 0; y < h; y++) for (var xx = 0; xx < w; xx++) {
        var k = y * w + xx, o = g[k], n = o < 128 ? 0 : 255, err = (o - n) / 8;
        g[k] = n;
        [[1, 0], [2, 0], [-1, 1], [0, 1], [1, 1], [0, 2]].forEach(function (q) {
          var X = xx + q[0], Y = y + q[1];
          if (X >= 0 && X < w && Y < h) g[Y * w + X] += err;
        });
      }
      for (var j = 0; j < w * h; j++) { d[j * 4] = d[j * 4 + 1] = d[j * 4 + 2] = g[j] < 128 ? 52 : 251; d[j * 4 + 3] = 255; }
      x.setTransform(1, 0, 0, 1, 0, 0);
      x.putImageData(img, 0, 0);
      return c.toDataURL('image/png');
    };
    snap.addEventListener('click', function () {
      if (!video.videoWidth) return;
      flash();
      var full = dither(256, 192), thumb = dither(96, 72);
      dlg.close();
      var printer = document.querySelector('.printer');
      printer.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'center' });
      whenIdle(function () {
        var R = P.receipt, old = R.querySelector('.r-photo'); if (old) old.remove();
        var fig = document.createElement('figure');
        fig.className = 'r-photo';
        fig.innerHTML = '<img alt="Your photobooth picture, printed in dots" data-thumb="' + thumb + '" src="' + full + '"><figcaption>PHOTOBOOTH &middot; ' + stampDate(new Date()) + '</figcaption>';
        R.querySelector('.barcode').insertAdjacentElement('beforebegin', fig);   // low on the receipt, so an ordinary tear takes it along
        P.feed('Your photo printed on the receipt. Tear it off to keep it on the board.');
      });
    });
  }
})();
