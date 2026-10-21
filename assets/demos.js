/* index.html only. Loaded with defer.
   One small "show their working" demo per project. Each runs the project's idea
   in miniature, in the browser, with no AI and no network. Example data is
   labelled as such on screen. */
(function () {
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  function h(html) { var t = document.createElement('template'); t.innerHTML = html.trim(); return t.content; }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function shell(el, title, note) {
    el.appendChild(h(
      '<p class="demo-h"><span>Try the idea</span>' + title + '</p>' +
      '<div class="demo-body"></div>' +
      '<p class="demo-note">' + note + '</p>'));
    return el.querySelector('.demo-body');
  }

  var demos = {

    /* Lead Time: guess first, then see the real back-test, misses included. */
    'lead-time': function (el) {
      var b = shell(el, 'Guess, then grade the forecasts', 'The real back-test result. Lead Time shows its misses on the same screen as its hits.');
      b.appendChild(h(
        '<p class="demo-q">It made 4 arrival forecasts that can be strictly checked. How many do you think landed in their window?</p>' +
        '<div class="demo-row" role="group" aria-label="Your guess">' +
        [0, 1, 2, 3, 4].map(function (n) { return '<button type="button" class="dbtn ghost num" data-n="' + n + '">' + n + '</button>'; }).join('') + '</div>' +
        '<div class="lt-grade" role="list" aria-label="The 4 forecasts" hidden>' +
        '<span role="listitem" class="lt-slot"></span><span role="listitem" class="lt-slot"></span><span role="listitem" class="lt-slot"></span><span role="listitem" class="lt-slot"></span></div>' +
        '<p class="demo-out" aria-live="polite"></p>'));
      var grid = b.querySelector('.lt-grade'), slots = grid.querySelectorAll('.lt-slot'), out = b.querySelector('.demo-out');
      var res = ['hit', 'miss', 'miss', 'miss'], timers = [];
      b.querySelectorAll('[data-n]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          timers.forEach(clearTimeout); timers = [];
          var n = +btn.getAttribute('data-n');
          b.querySelectorAll('[data-n]').forEach(function (x) { x.setAttribute('aria-pressed', x === btn); });
          grid.hidden = false; out.textContent = '';
          slots.forEach(function (sl) { sl.className = 'lt-slot'; sl.textContent = ''; });
          slots.forEach(function (sl, i) {
            timers.push(setTimeout(function () {
              sl.textContent = res[i] === 'hit' ? 'Landed' : 'Missed';
              sl.className = 'lt-slot ' + res[i];
              if (i === 3) out.textContent = (n === 1 ? 'Spot on. ' : 'You guessed ' + n + '. ') +
                'It was 1 of 4, and the app says so, right next to the forecasts that worked.';
            }, reduce ? 0 : 250 + i * 380));
          });
        });
      });
    },

    /* Recall: one model proposes with citations, a second checks each one against real history. */
    'recall': function (el) {
      var b = shell(el, 'Watch the second model check the first', 'Example charges and history. In Recall, any citation that isn’t a real transaction is dropped, and an answer left with no evidence isn’t shown.');
      var charges = {
        sats: { label: 'SATS PARK PTE · $14.50', draft: 'Airport parking at Changi, on the same trip as:',
          cites: [['Flight booking · 12 Jun', true], ['Hotel, Bangkok · 13 Jun', true], ['Taxi to Changi · 14 Jun', false]],
          end: '<b>Shown to the member:</b> a possible match, moderate confidence, citing the 2 real transactions.' },
        zxq: { label: 'ZXQ*SVC 0419 · $9.99', draft: 'Probably a streaming subscription, like:',
          cites: [['Streaming plan · May', false]],
          end: '<b>Shown to the member:</b> nothing. No evidence survived, so Recall stays quiet rather than guess.' }
      };
      b.appendChild(h('<div class="demo-row" role="group" aria-label="Pick a charge">' +
        Object.keys(charges).map(function (k) { return '<button type="button" class="dbtn ghost" data-k="' + k + '">' + charges[k].label + '</button>'; }).join('') +
        '</div><div class="rc-out" aria-live="polite"></div>'));
      var out = b.querySelector('.rc-out'), timers = [];
      b.querySelectorAll('[data-k]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          timers.forEach(clearTimeout); timers = [];
          b.querySelectorAll('[data-k]').forEach(function (x) { x.setAttribute('aria-pressed', x === btn); });
          var c = charges[btn.getAttribute('data-k')];
          out.innerHTML = '<p class="step"><span>Model 1 drafts</span>' + c.draft + '</p><ul class="cites">' +
            c.cites.map(function (x) { return '<li>' + x[0] + '</li>'; }).join('') + '</ul><p class="step v"><span>Model 2 checks</span>each citation against the card history</p><p class="rc-end"></p>';
          var lis = out.querySelectorAll('.cites li');
          c.cites.forEach(function (x, i) {
            timers.push(setTimeout(function () { lis[i].className = x[1] ? 'ok' : 'gone'; }, reduce ? 0 : 600 + i * 450));
          });
          timers.push(setTimeout(function () { out.querySelector('.rc-end').innerHTML = c.end; }, reduce ? 0 : 700 + c.cites.length * 450));
        });
      });
    },

    /* Voucher Kaki: same results in any language, and it says when it had to widen. */
    'voucher-kaki': function (el) {
      var b = shell(el, 'Any language, and it admits when it widens', 'Example places. The real app needs 3 results, and lists every step it took to find them.');
      var q = {
        en: ['English', 'chicken rice near Yishun'],
        zh: ['中文', '义顺附近的鸡饭'],
        ms: ['Melayu', 'nasi ayam dekat Yishun'],
        ta: ['தமிழ்', 'யீஷூன் அருகே சிக்கன் ரைஸ்']
      };
      var places = [['Ah Kow Chicken Rice', 380, true], ['Block 846 kopitiam stall', 720, true], ['Golden Hainan Eating House', 1300, false], ['Northpoint food court', 2600, false]];
      var radii = [500, 800, 1500, 3000];
      function km(m) { return m < 1000 ? m + ' m' : (m / 1000) + ' km'; }
      b.appendChild(h('<div class="demo-row" role="group" aria-label="Language">' +
        Object.keys(q).map(function (k, i) { return '<button type="button" class="dbtn ghost" lang="' + k + '" aria-pressed="' + (i === 0) + '" data-k="' + k + '">' + q[k][0] + '</button>'; }).join('') +
        '</div><p class="vk-q"></p>' +
        '<div class="demo-row" role="group" aria-label="Start searching within"><span class="lbl">Start within</span>' +
        radii.slice(0, 3).map(function (r, i) { return '<button type="button" class="dbtn ghost sm" aria-pressed="' + (i === 0) + '" data-r="' + r + '">' + km(r) + '</button>'; }).join('') +
        '</div><div class="vk-res" aria-live="polite"></div>'));
      var qEl = b.querySelector('.vk-q'), res = b.querySelector('.vk-res'), start = 500;
      function run() {
        var r = start, steps = [], found = places.filter(function (p) { return p[1] <= r; });
        while (found.length < 3) {
          r = radii[radii.indexOf(r) + 1];
          steps.push('widened to ' + km(r));
          found = places.filter(function (p) { return p[1] <= r; });
        }
        res.innerHTML = (steps.length ? '<p class="vk-widen"><b>To fill this list I:</b> ' + steps.join(', then ') + '.</p>' : '<p class="vk-widen">All 3 within ' + km(start) + '. Nothing widened.</p>') +
          '<ol class="vk-list">' + found.slice(0, 3).map(function (p) { return '<li><b>' + p[0] + '</b><span>' + km(p[1]) + (p[2] ? ' · local-owned' : '') + '</span></li>'; }).join('') + '</ol>';
      }
      function set(k) { qEl.setAttribute('lang', k); qEl.textContent = '“' + q[k][1] + '”'; }
      b.querySelectorAll('[data-k]').forEach(function (btn) {
        btn.addEventListener('click', function () { b.querySelectorAll('[data-k]').forEach(function (x) { x.setAttribute('aria-pressed', x === btn); }); set(btn.getAttribute('data-k')); });
      });
      b.querySelectorAll('[data-r]').forEach(function (btn) {
        btn.addEventListener('click', function () { b.querySelectorAll('[data-r]').forEach(function (x) { x.setAttribute('aria-pressed', x === btn); }); start = +btn.getAttribute('data-r'); run(); });
      });
      set('en'); run();
    },

    /* AgentShopper: before and after, and the budget is enforced by code, not by the model. */
    'agentshopper': function (el) {
      var b = shell(el, 'Same search, before and after', 'From the app’s demo shoe catalogue. The search: “lightweight shoes for a humid half marathon, under S$200”.');
      var before = [['Terrafirma Anchor Daily', 'S$149'], ['Halcyon Crossover Gym', 'S$159'], ['Terrafirma Loop Indoor', 'S$139']];
      var after = [['Kestrel Drift 3', 'S$179'], ['Vela Aero 9', 'S$199'], ['Vela Halo Breeze', 'S$189']];
      b.appendChild(h('<div class="demo-row" role="group" aria-label="Catalogue content"><button type="button" class="dbtn ghost" aria-pressed="true" data-k="0">Original content</button><button type="button" class="dbtn ghost" aria-pressed="false" data-k="1">AgentShopper</button></div><ol class="as-rank" aria-live="polite"></ol><p class="as-cut" hidden><s>Vela Aero 9 Pro · S$219</s> Removed by code: over the S$200 budget, however well it matched.</p>'));
      var ol = b.querySelector('ol'), cut = b.querySelector('.as-cut');
      function show(list, isAfter) {
        ol.innerHTML = list.map(function (n) { return '<li><b>' + n[0] + '</b><span>' + n[1] + '</span></li>'; }).join('');
        cut.hidden = !isAfter;
        if (!reduce) { ol.classList.remove('swap'); void ol.offsetWidth; ol.classList.add('swap'); }
      }
      show(before, false);
      b.querySelectorAll('[data-k]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          b.querySelectorAll('[data-k]').forEach(function (x) { x.setAttribute('aria-pressed', x === btn); });
          var a = btn.getAttribute('data-k') === '1'; show(a ? after : before, a);
        });
      });
    },

    /* Pinch: an amount stays unknown until the cook says it. */
    'pinch': function (el) {
      var b = shell(el, 'Pin down “a splash”', 'From the app’s example card. Pinch asks once, and never fills in an amount she didn’t say.');
      b.appendChild(h('<ul class="pn-list"><li><span>Milk</span><span class="amt unk" data-i="milk">a splash · unknown</span></li><li><span>Butter, for the pan</span><span class="amt unk">amount unknown</span></li></ul>' +
        '<div class="demo-row"><button type="button" class="dbtn" data-a="ask">Ask her how much</button><button type="button" class="dbtn ghost" data-a="guess">Guess the butter</button></div>' +
        '<p class="demo-out" aria-live="polite"></p>'));
      var out = b.querySelector('.demo-out'), milk = b.querySelector('[data-i="milk"]');
      b.querySelector('[data-a="ask"]').addEventListener('click', function (e) {
        e.currentTarget.disabled = true;
        out.innerHTML = '<q>About ¾ cup. Just enough so it runs off the spoon.</q>';
        milk.className = 'amt ok'; milk.textContent = 'about ¾ cup ✓ her words';
      });
      b.querySelector('[data-a="guess"]').addEventListener('click', function () {
        out.textContent = 'Pinch won’t. She only said “a little butter in the pan”, so it stays on the Still unknown list.';
      });
    },

    /* ChainCheck: the real return thresholds. Never says safe. */
    'chaincheck': function (el) {
      var b = shell(el, 'Check an offer', 'ChainCheck’s real return rule: annualised as (1+p)<sup>n</sup>−1, over 30% a year is red, 15–30% amber. The other two are among its red flags.');
      b.appendChild(h('<div class="cc-form"><label>Promised return <input type="number" inputmode="decimal" min="0" max="100" step="0.5" value="8" aria-label="Promised return, percent"> %</label>' +
        '<label>per <select aria-label="Period"><option value="52">week</option><option value="12">month</option><option value="1">year</option></select></label>' +
        '<label class="chk"><input type="checkbox"> Fee to withdraw</label><label class="chk"><input type="checkbox"> App from a link</label></div>' +
        '<div class="cc-verdict" aria-live="polite"></div>'));
      var inp = b.querySelector('input[type=number]'), sel = b.querySelector('select'), boxes = b.querySelectorAll('.chk input'), out = b.querySelector('.cc-verdict');
      function run() {
        var p = Math.max(0, parseFloat(inp.value) || 0) / 100, n = +sel.value;
        var yr = (Math.pow(1 + p, n) - 1) * 100, flags = [];
        var yrTxt = yr > 99999 ? 'over 99,999%' : Math.round(yr).toLocaleString() + '%';
        if (yr > 30) flags.push(['red', 'Returns of ' + yrTxt + ' a year']);
        else if (yr >= 15) flags.push(['amber', 'Returns of ' + yrTxt + ' a year']);
        if (boxes[0].checked) flags.push(['red', 'A fee to get your own money out']);
        if (boxes[1].checked) flags.push(['red', 'An app installed from a link, not an app store']);
        out.className = 'cc-verdict ' + (flags.length ? 'stop' : 'none');
        out.innerHTML = flags.length
          ? '<b>STOP</b>' + '<ul>' + flags.map(function (f) { return '<li class="' + f[0] + '">' + f[1] + '</li>'; }).join('') + '</ul>'
          : '<b>No red flags found.</b> Verify these yourself before you pay. (It never says safe.)';
      }
      [inp, sel].concat([].slice.call(boxes)).forEach(function (x) { x.addEventListener('input', run); x.addEventListener('change', run); });
      run();
    },

    /* Clause: a sentence only stands if every number in it is in the quoted plan text. */
    'clause': function (el) {
      var b = shell(el, 'Edit the appeal, watch it re-check', 'Example plan text, Clause’s real rule: every number in a sentence must appear in the clause it quotes, or the sentence is greyed out.');
      var source = 'Covered services include outpatient physical therapy, up to 20 visits per calendar year, when medically necessary.';
      var quote = 'outpatient physical therapy, up to 20 visits per calendar year';
      b.appendChild(h('<p class="cl-src"><small>Plan, page 41, §3.2</small><span class="txt"></span></p>' +
        '<label class="cl-edit"><span class="sr-only">Appeal sentence. Try changing a number.</span><textarea rows="2" spellcheck="false">My plan covers up to 20 visits of outpatient physical therapy a year.</textarea></label>' +
        '<div class="cl-res" aria-live="polite"></div>'));
      var ta = b.querySelector('textarea'), res = b.querySelector('.cl-res'), txt = b.querySelector('.txt');
      var i = source.indexOf(quote);
      txt.innerHTML = esc(source.slice(0, i)) + '<mark>' + esc(quote) + '</mark>' + esc(source.slice(i + quote.length));
      var inQuote = quote.match(/\d+(?:\.\d+)?/g) || [];
      function run() {
        var nums = ta.value.match(/\d+(?:\.\d+)?/g) || [];
        var bad = nums.filter(function (n) { return inQuote.indexOf(n) < 0; });
        ta.classList.toggle('fail', bad.length > 0);
        res.className = 'cl-res ' + (bad.length ? 'fail' : 'pass');
        res.innerHTML = '<ul class="nchk">' + (nums.length ? nums.map(function (n) {
          var ok = inQuote.indexOf(n) >= 0;
          return '<li class="' + (ok ? 'ok' : 'no') + '">' + esc(n) + (ok ? ' ✓ in the quote' : ' ✗ not in the quote') + '</li>';
        }).join('') : '<li class="ok">no numbers to check</li>') + '</ul>' +
          '<p>' + (bad.length ? 'Greyed out. Not shown as fact until it matches the plan.' : '✓ Stands, citing Plan p. 41, §3.2.') + '</p>';
      }
      ta.addEventListener('input', run); run();
    },

    /* Fridge Rescue: the real routing rules. */
    'fridge-rescue': function (el) {
      var b = shell(el, 'Rescue, donate, or keep?', 'The app’s real rules. Open a tin or change a count, and the verdict and its reason update.');
      var items = [
        { n: 'Spinach', per: true, days: 1, qty: 1, open: false },
        { n: 'Greek yoghurt', per: true, days: 3, qty: 4, open: false },
        { n: 'Tinned chickpeas', per: false, days: 520, qty: 5, open: false },
        { n: 'Pasta', per: false, days: 300, qty: 1, open: false },
        { n: 'UHT milk', per: false, days: 90, qty: 3, open: true }
      ];
      function route(it) {
        if (it.per) return it.days <= 3
          ? ['rescue', 'Rescue tonight', it.days + (it.days === 1 ? ' day' : ' days') + ' left. Perishable, so never donated: a food bank can’t use it in time.']
          : ['keep', 'Keep', 'More than 3 days left.'];
        if (it.open) return ['keep', 'Keep', 'Opened, so a food bank can’t take it.'];
        if (it.days <= 60) return ['keep', 'Keep', '60 days or less left.'];
        if (it.qty <= 2) return ['keep', 'Keep', 'Only ' + it.qty + ', not surplus.'];
        return ['donate', 'Donate ' + (it.qty - 2) + ', keep 2', 'Sealed, shelf-stable, over 60 days left, more than 2.'];
      }
      b.appendChild(h('<ul class="fr-items"></ul>'));
      var ul = b.querySelector('ul');
      function render() {
        ul.innerHTML = items.map(function (it, i) {
          var r = route(it);
          return '<li><span class="nm">' + it.n + '<small>' + (it.per ? it.days + ' day' + (it.days === 1 ? '' : 's') + ' left' : 'shelf-stable · ' + it.days + ' days') + '</small></span>' +
            '<span class="qty"><button type="button" aria-label="One fewer ' + it.n + '" data-i="' + i + '" data-d="-1">−</button><b>' + it.qty + '</b><button type="button" aria-label="One more ' + it.n + '" data-i="' + i + '" data-d="1">+</button></span>' +
            '<button type="button" class="opn" aria-pressed="' + it.open + '" data-i="' + i + '" data-o>' + (it.open ? 'opened' : 'sealed') + '</button>' +
            '<span class="rt ' + r[0] + '">' + r[1] + '</span><span class="why">' + r[2] + '</span></li>';
        }).join('');
      }
      ul.addEventListener('click', function (e) {
        var t = e.target.closest('button'); if (!t) return;
        var it = items[+t.getAttribute('data-i')];
        if (t.hasAttribute('data-o')) it.open = !it.open;
        else it.qty = Math.max(1, Math.min(9, it.qty + +t.getAttribute('data-d')));
        render();
        var again = ul.querySelector('[data-i="' + t.getAttribute('data-i') + '"]' + (t.hasAttribute('data-o') ? '[data-o]' : '[data-d="' + t.getAttribute('data-d') + '"]'));
        if (again) again.focus();
      });
      render();
    }
  };

  document.querySelectorAll('.demo[data-demo]').forEach(function (el) {
    var f = demos[el.getAttribute('data-demo')];
    if (f) { f(el); el.classList.add('ready'); }
  });
})();
