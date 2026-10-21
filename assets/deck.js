/* projects.html only. Loaded with defer.
   One project per slide. Swipe, use the arrow buttons or keys, or pick a name
   from the ledger or the dots. The deck takes the height of the slide on show,
   so a short write-up doesn't sit in a tall empty box. The URL hash follows the
   slide, so a link like projects.html#clause opens on Clause.
   Without JS it is still a working scroll-snap row. */
(function () {
  var deck = document.querySelector('.deck');
  if (!deck) return;
  var track = deck.querySelector('.deck-track');
  var slides = [].slice.call(track.querySelectorAll('.slide'));
  var dots = [].slice.call(deck.querySelectorAll('.dot'));
  var now = deck.querySelector('.d-now'), name = deck.querySelector('.d-name');
  var prev = deck.querySelector('[data-dir="-1"]'), next = deck.querySelector('[data-dir="1"]');
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var active = -1;
  document.documentElement.classList.add('has-deck');

  function title(i) { var t = slides[i].querySelector('.ttl'); return t ? t.textContent : ''; }
  function fit() {
    if (active < 0) return;
    var cs = getComputedStyle(track);
    track.style.height = (slides[active].offsetHeight + parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom)) + 'px';
  }

  function show(i, fromScroll) {
    i = Math.max(0, Math.min(slides.length - 1, i));
    if (i === active) { fit(); return; }
    active = i;
    slides.forEach(function (s, k) {
      var on = k === i;
      s.setAttribute('aria-label', (k + 1) + ' of ' + slides.length);
      // only the slide on show can be tabbed into; the next button gets you to the others
      if (on) s.removeAttribute('inert'); else s.setAttribute('inert', '');
    });
    dots.forEach(function (d, k) { d.setAttribute('aria-current', k === i ? 'true' : 'false'); });
    now.textContent = i + 1; name.textContent = title(i);
    prev.disabled = i === 0; next.disabled = i === slides.length - 1;
    fit();
    if (history.replaceState) history.replaceState(null, '', '#' + slides[i].id);
    var d = dots[i]; if (d && d.scrollIntoView && d.parentNode.scrollWidth > d.parentNode.clientWidth) {
      d.parentNode.scrollTo({ left: d.offsetLeft - d.parentNode.clientWidth / 2 + d.offsetWidth / 2, behavior: reduce ? 'auto' : 'smooth' });
    }
  }

  function go(i, smooth) {
    i = Math.max(0, Math.min(slides.length - 1, i));
    track.scrollTo({ left: slides[i].offsetLeft, behavior: smooth && !reduce ? 'smooth' : 'auto' });   // the track is positioned, so offsetLeft is within it
    show(i);
  }

  // which slide is on show, from the scroll position
  var raf = 0;
  track.addEventListener('scroll', function () {
    if (raf) return;
    raf = requestAnimationFrame(function () {
      raf = 0;
      var w = slides[0].offsetWidth + parseFloat(getComputedStyle(track).columnGap || 0);
      show(Math.round(track.scrollLeft / w), true);
    });
  }, { passive: true });

  // changing slide from further down a long one starts the next one from its top
  function step(i) { go(i, true); if (deck.getBoundingClientRect().top < -2) deck.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' }); }
  prev.addEventListener('click', function () { step(active - 1); });
  next.addEventListener('click', function () { step(active + 1); });
  dots.forEach(function (d, k) { d.addEventListener('click', function () { step(k); }); });
  track.addEventListener('keydown', function (e) {
    if (e.target !== track) return;           // leave arrow keys alone inside demos and inputs
    if (e.key === 'ArrowRight') { e.preventDefault(); go(active + 1, true); }
    if (e.key === 'ArrowLeft') { e.preventDefault(); go(active - 1, true); }
  });

  // ledger rows and any other #project links on the page open that slide
  document.addEventListener('click', function (e) {
    var a = e.target.closest('a[href^="#"]');
    if (!a) return;
    var k = slides.findIndex(function (s) { return '#' + s.id === a.getAttribute('href'); });
    if (k < 0) return;
    e.preventDefault();
    go(k, false);
    deck.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
    var t = slides[k].querySelector('.ttl'); if (t) { t.setAttribute('tabindex', '-1'); t.focus({ preventScroll: true }); }
  });

  // demos and images change a slide's height after load
  slides.forEach(function (s) { s.querySelectorAll('img').forEach(function (img) { img.addEventListener('load', fit); }); });
  if ('ResizeObserver' in window) slides.forEach(function (s) { new ResizeObserver(function () { if (slides[active] === s) fit(); }).observe(s); });

  // open on the slide named in the URL, if any
  var found = slides.findIndex(function (s) { return '#' + s.id === location.hash; });
  go(Math.max(0, found), false);
  // the browser also jumps to the #id on load, which would hide the controls; land on the deck instead
  if (found >= 0) {
    var land = function () { deck.scrollIntoView({ block: 'start' }); };
    requestAnimationFrame(land);
    window.addEventListener('load', function () { setTimeout(land, 0); });
  }
  window.addEventListener('resize', function () { go(active, false); });
})();
