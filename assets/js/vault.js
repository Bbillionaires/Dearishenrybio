/*!
 * Vault entrance.
 * Sequence: wheel turns counter-clockwise → bolts retract → door swings open on
 * its hinge → the view moves through the doorway into the vault (the hero).
 *
 * - Drag the wheel counter-clockwise (clockwise is resisted), tap/click it,
 *   press Enter/Space or ←, or wait: it opens automatically after a moment.
 * - "Skip intro" (or Esc) goes straight in.
 * - Plays on every visit. No storage flags. Skipped for deep links (#section)
 *   and prefers-reduced-motion (decided in the inline <head> script).
 * - The page behind is inert until the vault is open.
 */
(function () {
  'use strict';
  window.__vaultReady = true;
  var root = document.documentElement;
  var intro = document.getElementById('vault-intro');
  var page = document.querySelector('.page');

  function done() {
    root.classList.remove('vault-active');
    root.classList.add('vault-entered');
    if (intro) intro.hidden = true;
    if (page) page.inert = false;
    state = 'open';
    window.dispatchEvent(new CustomEvent('vault:opened'));
  }

  var state = 'locked';
  if (!intro || !root.classList.contains('vault-active')) {
    if (intro) intro.hidden = true;
    root.classList.add('vault-entered');
    window.__vault = { state: function () { return 'open'; } };
    return;
  }

  var wheel = intro.querySelector('.vault-wheel');
  var skip = intro.querySelector('[data-vault-skip]');
  var angle = 0; // degrees; negative = counter-clockwise
  var TARGET = -450; // one and a quarter turns
  var OPEN_AT = -270; // a three-quarter turn by hand is enough to release it
  var timers = [];
  var later = function (fn, ms) { timers.push(setTimeout(fn, ms)); };
  var autoTimer = 0;
  if (page) page.inert = true;

  function setAngle(a) {
    angle = a;
    wheel.style.transform = 'rotate(' + a + 'deg)';
  }

  function scheduleAuto(ms) {
    clearTimeout(autoTimer);
    autoTimer = setTimeout(open, ms);
  }

  function open() {
    if (state !== 'locked') return;
    state = 'opening';
    clearTimeout(autoTimer);
    intro.classList.add('is-opening');
    var from = angle, to = TARGET;
    var dur = Math.max(700, 2000 * (from - to) / -TARGET);
    var t0 = performance.now();
    (function spin(now) {
      if (state !== 'opening') return;
      var t = Math.min(1, (now - t0) / dur);
      var e = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; // ease-in-out
      setAngle(from + (to - from) * e);
      if (t < 1) requestAnimationFrame(spin);
      else unlock();
    })(t0);
  }

  function unlock() {
    intro.classList.add('is-unlocked');
    later(function () { intro.classList.add('is-open'); }, 520);
    later(function () { intro.classList.add('is-entering'); }, 1650);
    later(done, 2700);
  }

  function skipIntro() {
    if (state === 'open') return;
    state = 'skipping';
    clearTimeout(autoTimer);
    timers.forEach(clearTimeout);
    intro.classList.add('is-skipping');
    setTimeout(done, 380);
  }

  /* ---- drag the wheel counter-clockwise ---- */
  var dragging = false, lastA = 0, moved = 0;
  function pointerAngle(e) {
    var r = wheel.getBoundingClientRect();
    return Math.atan2(e.clientY - (r.top + r.height / 2), e.clientX - (r.left + r.width / 2)) * 180 / Math.PI;
  }
  wheel.addEventListener('pointerdown', function (e) {
    if (state !== 'locked') return;
    dragging = true; moved = 0; lastA = pointerAngle(e);
    clearTimeout(autoTimer);
    try { wheel.setPointerCapture(e.pointerId); } catch (_) { /* noop */ }
    e.preventDefault();
  });
  wheel.addEventListener('pointermove', function (e) {
    if (!dragging || state !== 'locked') return;
    var a = pointerAngle(e), d = a - lastA;
    if (d > 180) d -= 360; else if (d < -180) d += 360;
    lastA = a;
    moved += Math.abs(d);
    // counter-clockwise turns freely; clockwise only unwinds back to the start
    setAngle(Math.max(TARGET, Math.min(0, angle + d)));
    if (angle <= OPEN_AT) { dragging = false; open(); }
  });
  function endDrag() {
    if (!dragging) return;
    dragging = false;
    if (state !== 'locked') return;
    if (moved < 6) open(); // a tap/click opens it
    else scheduleAuto(1800);
  }
  wheel.addEventListener('pointerup', endDrag);
  wheel.addEventListener('pointercancel', endDrag);

  /* ---- keyboard ---- */
  wheel.addEventListener('click', function (e) {
    if (e.detail === 0) open(); // keyboard activation (Enter/Space)
  });
  wheel.addEventListener('keydown', function (e) {
    if (e.key === 'ArrowLeft' && state === 'locked') {
      e.preventDefault();
      clearTimeout(autoTimer);
      setAngle(Math.max(TARGET, angle - 45));
      if (angle <= OPEN_AT) open(); else scheduleAuto(2500);
    }
  });
  intro.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') skipIntro();
    if (e.key === 'Tab') { // keep focus inside the dialog
      var f = [skip, wheel];
      var i = f.indexOf(document.activeElement);
      e.preventDefault();
      f[(i + (e.shiftKey ? f.length - 1 : 1)) % f.length].focus();
    }
  });
  skip.addEventListener('click', skipIntro);

  // Back/forward cache: if a restored page was mid-sequence, finish it.
  window.addEventListener('pageshow', function (e) {
    if (e.persisted && state !== 'locked' && state !== 'open') done();
  });

  window.__vault = { state: function () { return state; }, angle: function () { return angle; }, open: open, skip: skipIntro };

  try { wheel.focus({ preventScroll: true }); } catch (_) { wheel.focus(); }
  scheduleAuto(2400);
})();
