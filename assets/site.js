/* Shared by every page. Loaded with defer. */
(function () {
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* Results strip: counted from the receipt, so the receipt is the single source of truth.
     Each receipt line carries data-result (win | second | finalist | shipped) and
     data-count (how many projects the line stands for). */
  var lines = document.querySelectorAll('.printer .r-list [data-result]');
  if (lines.length) {
    var totals = { total: 0, win: 0, second: 0, finalist: 0 };
    lines.forEach(function (li) {
      var n = Number(li.getAttribute('data-count') || 1);
      totals.total += n;
      if (li.dataset.result in totals) totals[li.dataset.result] += n;
    });
    document.querySelectorAll('[data-tally]').forEach(function (el) {
      var target = totals[el.getAttribute('data-tally')] || 0;
      if (el.closest('.receipt')) { el.textContent = target + ' projects'; return; }
      if (reduce) { el.textContent = target; return; }
      // count up in step with the receipt printing (2.2s after a .35s delay)
      var t0 = null, D = 1600, DELAY = 600;
      el.textContent = '0';
      requestAnimationFrame(function frame(now) {
        if (t0 === null) t0 = now + DELAY;
        var p = Math.max(0, Math.min(1, (now - t0) / D));
        el.textContent = Math.round(target * (1 - Math.pow(1 - p, 3)));
        if (p < 1) requestAnimationFrame(frame);
      });
    });
  }

  /* Stamps thunk down once as their card scrolls into view. */
  var stamps = document.querySelectorAll('.stamp[data-thunk]');
  if (!stamps.length) return;
  if (reduce || !('IntersectionObserver' in window)) {
    stamps.forEach(function (s) { s.classList.add('in'); });
    return;
  }
  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      if (!e.isIntersecting) return;
      e.target.classList.add('in');
      io.unobserve(e.target);
    });
  }, { rootMargin: '0px 0px -18% 0px', threshold: 0.6 });
  stamps.forEach(function (s) { io.observe(s); });
})();
