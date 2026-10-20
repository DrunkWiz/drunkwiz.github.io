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

    /* Lead Time: the back-test grades itself, misses included. Counts are the real ones. */
    'lead-time': function (el) {
      var b = shell(el, 'Grade the forecasts', 'The real back-test result. The app publishes its misses on the same screen as its hits.');
      b.appendChild(h(
        '<div class="lt-grade" role="list" aria-label="Forecasts that could be strictly checked">' +
        '<span role="listitem" class="lt-slot">?</span><span role="listitem" class="lt-slot">?</span>' +
        '<span role="listitem" class="lt-slot">?</span><span role="listitem" class="lt-slot">?</span></div>' +
        '<div class="demo-row"><button type="button" class="dbtn">Grade them</button><p class="demo-out" aria-live="polite">4 arrival dates could be strictly checked.</p></div>'));
      var slots = b.querySelectorAll('.lt-slot'), out = b.querySelector('.demo-out'), btn = b.querySelector('button');
      var res = ['hit', 'miss', 'miss', 'miss'];
      btn.addEventListener('click', function () {
        btn.disabled = true;
        slots.forEach(function (s, i) {
          setTimeout(function () {
            s.textContent = res[i] === 'hit' ? 'Landed' : 'Missed';
            s.className = 'lt-slot ' + res[i];
            if (i === 3) out.textContent = '1 of 4 landed in its window. It says so, on screen.';
          }, reduce ? 0 : i * 380);
        });
      });
    },

    /* Recall: proposes a match with citations, or stays quiet. */
    'recall': function (el) {
      var b = shell(el, 'Pick a charge you don’t recognise', 'Example charges. In Recall, a second model checks every citation, and rules code makes any decision that touches money.');
      var charges = {
        sats: { label: 'SATS PARK PTE · $14.50', ans: '<b>Possible match, moderate confidence.</b> Airport parking at Changi, on the same trip as two of your charges:', cite: ['Flight booking · 12 Jun', 'Hotel, Bangkok · 13 Jun'] },
        zxq: { label: 'ZXQ*SVC 0419 · $9.99', ans: '<b>No match.</b> Nothing in your history explains this one, so Recall says nothing rather than guess.', cite: [] }
      };
      b.appendChild(h('<div class="demo-row" role="group" aria-label="Charges">' +
        Object.keys(charges).map(function (k) { return '<button type="button" class="dbtn ghost" data-k="' + k + '">' + charges[k].label + '</button>'; }).join('') +
        '</div><div class="rc-out" aria-live="polite"></div>'));
      var out = b.querySelector('.rc-out');
      b.querySelectorAll('[data-k]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          b.querySelectorAll('[data-k]').forEach(function (x) { x.setAttribute('aria-pressed', x === btn); });
          var c = charges[btn.getAttribute('data-k')];
          out.innerHTML = '<p>' + c.ans + '</p>' + (c.cite.length ? '<ul class="cites">' + c.cite.map(function (x) { return '<li>' + x + '</li>'; }).join('') + '</ul>' : '');
        });
      });
    },

    /* Voucher Kaki: same search in four languages, and it admits when it widens. */
    'voucher-kaki': function (el) {
      var b = shell(el, 'Search in any of four languages', 'Example results. The real app also takes voice, and ranks local-owned shops up.');
      var q = {
        en: ['English', 'chicken rice near Yishun'],
        zh: ['中文', '义顺附近的鸡饭'],
        ms: ['Bahasa Melayu', 'nasi ayam dekat Yishun'],
        ta: ['தமிழ்', 'யீஷூன் அருகே சிக்கன் ரைஸ்']
      };
      b.appendChild(h('<div class="demo-row" role="group" aria-label="Language">' +
        Object.keys(q).map(function (k, i) { return '<button type="button" class="dbtn ghost" lang="' + k + '" aria-pressed="' + (i === 0) + '" data-k="' + k + '">' + q[k][0] + '</button>'; }).join('') +
        '</div><p class="vk-q"></p><p class="vk-widen">Found 2 within 800 m. <b>Widened to 1.5 km</b> to find a third, and told you so.</p>'));
      var out = b.querySelector('.vk-q');
      function set(k) { out.setAttribute('lang', k); out.textContent = '“' + q[k][1] + '”'; }
      set('en');
      b.querySelectorAll('[data-k]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          b.querySelectorAll('[data-k]').forEach(function (x) { x.setAttribute('aria-pressed', x === btn); });
          set(btn.getAttribute('data-k'));
        });
      });
    },

    /* AgentShopper: the same search, before and after. */
    'agentshopper': function (el) {
      var b = shell(el, 'Same search, before and after', 'From the app’s demo shoe catalogue: “lightweight shoes for a humid half marathon, under S$200”.');
      var before = ['Terrafirma Anchor Daily', 'Halcyon Crossover Gym', 'Terrafirma Loop Indoor'];
      var after = ['Kestrel Drift 3', 'Vela Aero 9', 'Vela Halo Breeze'];
      b.appendChild(h('<div class="demo-row" role="group" aria-label="Catalogue content"><button type="button" class="dbtn ghost" aria-pressed="true" data-k="0">Original content</button><button type="button" class="dbtn ghost" aria-pressed="false" data-k="1">AgentShopper</button></div><ol class="as-rank" aria-live="polite"></ol>'));
      var ol = b.querySelector('ol');
      function show(list) { ol.innerHTML = list.map(function (n) { return '<li>' + n + '</li>'; }).join(''); if (!reduce) { ol.classList.remove('swap'); void ol.offsetWidth; ol.classList.add('swap'); } }
      show(before);
      b.querySelectorAll('[data-k]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          b.querySelectorAll('[data-k]').forEach(function (x) { x.setAttribute('aria-pressed', x === btn); });
          show(btn.getAttribute('data-k') === '1' ? after : before);
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

    /* Clause: a sentence only counts if its quote is really in the plan and every number is in the quote. */
    'clause': function (el) {
      var b = shell(el, 'Edit the appeal, watch it re-check', 'Example plan text. Clause’s real check: the quote must appear word for word, and every number in the sentence must appear in the quote.');
      var source = 'Covered services include outpatient physical therapy, up to 20 visits per calendar year, when medically necessary.';
      var quote = 'outpatient physical therapy, up to 20 visits per calendar year';
      b.appendChild(h('<p class="cl-src"><small>Plan, page 41, §3.2</small><span class="txt"></span></p>' +
        '<label class="cl-edit"><span class="sr-only">Appeal sentence</span><textarea rows="2" spellcheck="false">My plan covers up to 20 visits of outpatient physical therapy a year, and I had used 6.</textarea></label>' +
        '<p class="cl-res" aria-live="polite"></p>'));
      var ta = b.querySelector('textarea'), res = b.querySelector('.cl-res'), txt = b.querySelector('.txt');
      var i = source.indexOf(quote);
      txt.innerHTML = esc(source.slice(0, i)) + '<mark>' + esc(quote) + '</mark>' + esc(source.slice(i + quote.length));
      function run() {
        var nums = (ta.value.match(/\d+(?:\.\d+)?/g) || []);
        // numbers the user brings from their own records (visits used) are allowed when phrased as such
        var own = (ta.value.match(/used (\d+)/) || [])[1];
        var bad = nums.filter(function (n) { return n !== own && quote.indexOf(n) < 0; });
        if (bad.length) {
          res.className = 'cl-res fail';
          res.textContent = 'Greyed out: “' + bad[0] + '” isn’t in the quoted clause.';
        } else {
          res.className = 'cl-res pass';
          res.textContent = '✓ Cites Plan p. 41, §3.2. Every number from the plan is in the quote.';
        }
        ta.classList.toggle('fail', !!bad.length);
      }
      ta.addEventListener('input', run); run();
    },

    /* Fridge Rescue: the real routing rules. */
    'fridge-rescue': function (el) {
      var b = shell(el, 'Rescue, donate, or keep?', 'The app’s real rules: rescue perishables within 3 days; donate only unopened, shelf-stable food with over 60 days left and more than 2 of it.');
      var items = [
        { n: 'Spinach', per: true, days: 1, qty: 1, open: false },
        { n: 'Greek yoghurt', per: true, days: 3, qty: 4, open: false },
        { n: 'Tinned chickpeas', per: false, days: 520, qty: 5, open: false },
        { n: 'Pasta', per: false, days: 300, qty: 1, open: false },
        { n: 'UHT milk', per: false, days: 90, qty: 3, open: true }
      ];
      function route(it) {
        if (it.per) return it.days >= 0 && it.days <= 3 ? ['rescue', 'Rescue tonight'] : ['keep', 'Keep'];
        if (!it.open && it.days > 60 && it.qty > 2) return ['donate', 'Donate ' + (it.qty - 2) + ', keep 2'];
        return ['keep', it.open ? 'Keep (opened)' : 'Keep'];
      }
      b.appendChild(h('<ul class="fr-items"></ul>'));
      var ul = b.querySelector('ul');
      function render() {
        ul.innerHTML = items.map(function (it, i) {
          var r = route(it);
          return '<li><span class="nm">' + it.n + '<small>' + (it.per ? it.days + ' day' + (it.days === 1 ? '' : 's') + ' left' : 'shelf-stable · ' + it.days + ' days') + '</small></span>' +
            '<span class="qty"><button type="button" aria-label="One fewer ' + it.n + '" data-i="' + i + '" data-d="-1">−</button><b>' + it.qty + '</b><button type="button" aria-label="One more ' + it.n + '" data-i="' + i + '" data-d="1">+</button></span>' +
            '<button type="button" class="opn" aria-pressed="' + it.open + '" data-i="' + i + '" data-o>' + (it.open ? 'opened' : 'sealed') + '</button>' +
            '<span class="rt ' + r[0] + '">' + r[1] + '</span></li>';
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
