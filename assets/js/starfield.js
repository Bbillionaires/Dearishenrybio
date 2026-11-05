/*!
 * Starfield & meteors — single <canvas>, requestAnimationFrame driven.
 *
 * - Hundreds of depth-layered stars with subtle twinkle and parallax drift.
 * - Faint blue/violet nebula pre-rendered once per resize (cheap to composite).
 * - Meteors travel left→right AND right→left with white-gold heads, tapered
 *   amber/orange tails trailing their direction of travel, and fading sparks.
 * - Starts on every visit. No localStorage/sessionStorage "seen" flags.
 * - Restarts after tab visibility restore and back/forward-cache (pageshow),
 *   cleans up on pagehide, handles resize/DPR, scales down on mobile,
 *   and respects prefers-reduced-motion (static sky, no meteors).
 * - Idempotent: calling init twice (e.g. after client-side navigation) reuses
 *   the running instance. window.Starfield.destroy() tears everything down.
 */
(function () {
  'use strict';

  if (window.Starfield && window.Starfield.instance) {
    window.Starfield.instance.mount();
    return;
  }

  var TAU = Math.PI * 2;
  var rand = function (a, b) { return a + Math.random() * (b - a); };
  var mqReduce = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };

  function Sky() {
    this.canvas = null;
    this.ctx = null;
    this.stars = [];
    this.meteors = [];
    this.sparks = [];
    this.raf = 0;
    this.last = 0;
    this.time = 0;
    this.nextMeteor = 0;
    this.running = false;
    this.reduced = !!mqReduce.matches;
    this.w = 0; this.h = 0; this.dpr = 1;
    this.nebula = null;
    this.sprite = null;
    this.frame = this.frame.bind(this);
    this.onResize = this.onResize.bind(this);
    this.onVisibility = this.onVisibility.bind(this);
    this.onPageShow = this.onPageShow.bind(this);
    this.onPageHide = this.onPageHide.bind(this);
    this.onMotionPref = this.onMotionPref.bind(this);
    this.resizeQueued = false;
    this.listening = false;
    this.spawned = { ltr: 0, rtl: 0 };
    this.inView = true;
    this.ro = null;
    this.io = null;
  }

  Sky.prototype.mount = function () {
    var canvas = document.getElementById('starfield');
    if (!canvas) {
      canvas = document.createElement('canvas');
      canvas.id = 'starfield';
      canvas.setAttribute('aria-hidden', 'true');
      document.body.insertBefore(canvas, document.body.firstChild);
    }
    if (canvas !== this.canvas) {
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d', { alpha: false });
      if (!this.ctx) return;
      this.buildSprite();
      this.resize(true);
      this.observe();
    }
    this.listen();
    this.start();
  };

  Sky.prototype.listen = function () {
    if (this.listening) return;
    this.listening = true;
    window.addEventListener('resize', this.onResize, { passive: true });
    document.addEventListener('visibilitychange', this.onVisibility);
    window.addEventListener('pageshow', this.onPageShow);
    window.addEventListener('pagehide', this.onPageHide);
    if (mqReduce.addEventListener) mqReduce.addEventListener('change', this.onMotionPref);
    else if (mqReduce.addListener) mqReduce.addListener(this.onMotionPref);
  };

  // Size to the canvas's container (the hero) and pause while it is off-screen.
  Sky.prototype.observe = function () {
    var self = this, host = this.canvas.parentElement;
    if (this.ro) this.ro.disconnect();
    if (this.io) this.io.disconnect();
    if (window.ResizeObserver && host) { this.ro = new ResizeObserver(function () { self.onResize(); }); this.ro.observe(host); }
    if (window.IntersectionObserver && host) {
      this.io = new IntersectionObserver(function (en) {
        self.inView = en[en.length - 1].isIntersecting;
        if (self.inView) self.start(); else self.stop();
      });
      this.io.observe(host);
    }
  };

  Sky.prototype.destroy = function () {
    this.stop();
    if (this.ro) this.ro.disconnect();
    if (this.io) this.io.disconnect();
    window.removeEventListener('resize', this.onResize);
    document.removeEventListener('visibilitychange', this.onVisibility);
    window.removeEventListener('pageshow', this.onPageShow);
    window.removeEventListener('pagehide', this.onPageHide);
    if (mqReduce.removeEventListener) mqReduce.removeEventListener('change', this.onMotionPref);
    else if (mqReduce.removeListener) mqReduce.removeListener(this.onMotionPref);
    this.listening = false;
    this.meteors.length = 0; this.sparks.length = 0;
    this.canvas = null; this.ctx = null;
    window.Starfield.instance = null;
  };

  /* ---------- sizing ---------- */
  Sky.prototype.isSmall = function () {
    return Math.min(window.innerWidth, window.innerHeight) < 700 || (navigator.hardwareConcurrency || 8) <= 4;
  };

  Sky.prototype.resize = function (force) {
    var host = this.canvas.parentElement === document.body ? null : this.canvas.parentElement;
    var w = host ? host.clientWidth : window.innerWidth, h = host ? host.clientHeight : window.innerHeight;
    if (!w || !h) return;
    var small = this.isSmall();
    var dpr = Math.min(window.devicePixelRatio || 1, small ? 1.5 : 2);
    // Ignore mobile URL-bar height jitter unless the change is significant.
    if (!force && w === this.w && Math.abs(h - this.h) < 120 && dpr === this.dpr) return;
    this.w = w; this.h = h; this.dpr = dpr;
    this.canvas.width = Math.round(w * dpr);
    this.canvas.height = Math.round(h * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.buildStars(small);
    this.buildNebula();
    if (!this.running) this.draw(0);
  };

  Sky.prototype.onResize = function () {
    if (this.resizeQueued) return;
    this.resizeQueued = true;
    var self = this;
    requestAnimationFrame(function () { self.resizeQueued = false; if (self.canvas) self.resize(false); });
  };

  /* ---------- assets ---------- */
  Sky.prototype.buildSprite = function () {
    var s = document.createElement('canvas');
    s.width = s.height = 64;
    var g = s.getContext('2d');
    var grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grd.addColorStop(0, 'rgba(255,255,255,1)');
    grd.addColorStop(0.12, 'rgba(255,255,255,0.85)');
    grd.addColorStop(0.35, 'rgba(200,215,255,0.22)');
    grd.addColorStop(1, 'rgba(200,215,255,0)');
    g.fillStyle = grd;
    g.fillRect(0, 0, 64, 64);
    this.sprite = s;
  };

  Sky.prototype.buildStars = function (small) {
    var area = this.w * this.h;
    var count = Math.round(Math.min(small ? 320 : 720, Math.max(small ? 180 : 260, area / (small ? 2400 : 2100))));
    var tints = ['255,255,255', '255,255,255', '255,255,255', '210,224,255', '190,205,255', '255,240,214', '255,228,196'];
    var stars = [];
    for (var i = 0; i < count; i++) {
      var z = Math.pow(Math.random(), 2.2); // most stars are distant
      stars.push({
        x: Math.random(), y: Math.random(), z: z,
        r: 0.35 + z * 1.45,
        a: 0.28 + z * 0.62 + Math.random() * 0.1,
        tw: rand(0.4, 1.8), ph: Math.random() * TAU, amp: rand(0.08, 0.42),
        tint: tints[(Math.random() * tints.length) | 0],
        glow: z > 0.72 && Math.random() > 0.35,
      });
    }
    this.stars = stars;
  };

  Sky.prototype.buildNebula = function () {
    var n = document.createElement('canvas');
    var scale = 0.5; // render at half-res; it is very soft anyway
    n.width = Math.max(1, Math.round(this.w * scale));
    n.height = Math.max(1, Math.round(this.h * scale));
    var g = n.getContext('2d');
    var W = n.width, H = n.height;
    var bg = g.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#040a1b');
    bg.addColorStop(0.55, '#030712');
    bg.addColorStop(1, '#02050e');
    g.fillStyle = bg;
    g.fillRect(0, 0, W, H);
    var blobs = [
      [0.18, 0.22, 0.55, '37,99,235', 0.10],
      [0.82, 0.35, 0.5, '109,40,217', 0.08],
      [0.6, 0.85, 0.6, '37,99,235', 0.06],
      [0.35, 0.6, 0.4, '139,92,246', 0.05],
      [0.9, 0.05, 0.35, '212,175,55', 0.035],
    ];
    g.globalCompositeOperation = 'lighter';
    for (var i = 0; i < blobs.length; i++) {
      var b = blobs[i], R = b[2] * Math.max(W, H);
      var grd = g.createRadialGradient(b[0] * W, b[1] * H, 0, b[0] * W, b[1] * H, R);
      grd.addColorStop(0, 'rgba(' + b[3] + ',' + b[4] + ')');
      grd.addColorStop(1, 'rgba(' + b[3] + ',0)');
      g.fillStyle = grd;
      g.fillRect(0, 0, W, H);
    }
    this.nebula = n;
  };

  /* ---------- meteors ---------- */
  Sky.prototype.scheduleMeteor = function (now) {
    var small = this.isSmall();
    this.nextMeteor = now + rand(small ? 2.6 : 1.6, small ? 6.5 : 5.2);
  };

  Sky.prototype.spawnMeteor = function () {
    var dir = Math.random() < 0.5 ? 1 : -1; // 1 = left→right, -1 = right→left
    this.spawned[dir === 1 ? 'ltr' : 'rtl']++;
    var w = this.w, h = this.h;
    var angle = rand(14, 38) * Math.PI / 180; // downward slope
    var speed = rand(520, 980) * (Math.min(w, 1400) / 1200 + 0.35);
    var startX = dir === 1 ? rand(-0.08 * w, 0.62 * w) : rand(0.38 * w, 1.08 * w);
    var startY = rand(-0.06 * h, 0.42 * h);
    this.meteors.push({
      x: startX, y: startY,
      vx: Math.cos(angle) * speed * dir, vy: Math.sin(angle) * speed,
      len: rand(110, 260) * (w < 600 ? 0.65 : 1),
      width: rand(1.6, 2.8),
      life: 0, ttl: rand(1.1, 2.1),
      dir: dir,
    });
  };

  Sky.prototype.updateMeteors = function (dt) {
    var m, i, alive = [];
    for (i = 0; i < this.meteors.length; i++) {
      m = this.meteors[i];
      m.life += dt;
      m.x += m.vx * dt;
      m.y += m.vy * dt;
      var fade = this.meteorAlpha(m);
      // sparks shed from the head, drifting slightly backwards
      if (fade > 0.15 && Math.random() < 0.85) {
        var sp = Math.hypot(m.vx, m.vy);
        this.sparks.push({
          x: m.x, y: m.y,
          vx: -m.vx / sp * rand(10, 50) + rand(-14, 14),
          vy: -m.vy / sp * rand(10, 50) + rand(-14, 14) + 8,
          life: 0, ttl: rand(0.35, 0.8), r: rand(0.5, 1.3),
        });
      }
      var off = m.x < -m.len - 60 || m.x > this.w + m.len + 60 || m.y > this.h + m.len;
      if (m.life < m.ttl && !off) alive.push(m);
    }
    this.meteors = alive;

    var s, keep = [];
    for (i = 0; i < this.sparks.length; i++) {
      s = this.sparks[i];
      s.life += dt;
      s.x += s.vx * dt; s.y += s.vy * dt;
      s.vx *= 0.96; s.vy *= 0.96;
      if (s.life < s.ttl) keep.push(s);
    }
    if (keep.length > 400) keep = keep.slice(keep.length - 400);
    this.sparks = keep;
  };

  Sky.prototype.meteorAlpha = function (m) {
    var t = m.life / m.ttl;
    if (t < 0.12) return t / 0.12;
    if (t > 0.7) return Math.max(0, 1 - (t - 0.7) / 0.3);
    return 1;
  };

  Sky.prototype.drawMeteor = function (ctx, m) {
    var alpha = this.meteorAlpha(m);
    if (alpha <= 0) return;
    var sp = Math.hypot(m.vx, m.vy);
    var ux = m.vx / sp, uy = m.vy / sp; // unit direction of travel
    var tx = m.x - ux * m.len, ty = m.y - uy * m.len; // tail trails behind
    var nx = -uy, ny = ux; // normal
    var hw = m.width;

    // tapered tail polygon: wide at the head, a point at the tail
    var grd = ctx.createLinearGradient(m.x, m.y, tx, ty);
    grd.addColorStop(0, 'rgba(255,250,232,' + (0.95 * alpha) + ')');
    grd.addColorStop(0.08, 'rgba(255,226,160,' + (0.85 * alpha) + ')');
    grd.addColorStop(0.35, 'rgba(255,179,71,' + (0.55 * alpha) + ')');
    grd.addColorStop(0.7, 'rgba(255,112,36,' + (0.18 * alpha) + ')');
    grd.addColorStop(1, 'rgba(255,90,20,0)');
    ctx.fillStyle = grd;
    ctx.beginPath();
    ctx.moveTo(m.x + nx * hw, m.y + ny * hw);
    ctx.quadraticCurveTo(m.x - ux * m.len * 0.3 + nx * hw * 0.7, m.y - uy * m.len * 0.3 + ny * hw * 0.7, tx, ty);
    ctx.quadraticCurveTo(m.x - ux * m.len * 0.3 - nx * hw * 0.7, m.y - uy * m.len * 0.3 - ny * hw * 0.7, m.x - nx * hw, m.y - ny * hw);
    ctx.lineTo(m.x + ux * hw * 0.6, m.y + uy * hw * 0.6); // rounded nose, covered by the head glow
    ctx.closePath();
    ctx.fill();

    // soft outer glow along the first part of the tail
    var g2 = ctx.createLinearGradient(m.x, m.y, m.x - ux * m.len * 0.5, m.y - uy * m.len * 0.5);
    g2.addColorStop(0, 'rgba(255,190,90,' + (0.28 * alpha) + ')');
    g2.addColorStop(1, 'rgba(255,140,40,0)');
    ctx.strokeStyle = g2;
    ctx.lineWidth = hw * 4.5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(m.x, m.y);
    ctx.lineTo(m.x - ux * m.len * 0.5, m.y - uy * m.len * 0.5);
    ctx.stroke();

    // bright white-gold head
    var hr = hw * 5;
    var hg = ctx.createRadialGradient(m.x, m.y, 0, m.x, m.y, hr);
    hg.addColorStop(0, 'rgba(255,255,255,' + alpha + ')');
    hg.addColorStop(0.25, 'rgba(255,244,200,' + (0.9 * alpha) + ')');
    hg.addColorStop(0.6, 'rgba(255,200,110,' + (0.25 * alpha) + ')');
    hg.addColorStop(1, 'rgba(255,180,70,0)');
    ctx.fillStyle = hg;
    ctx.beginPath();
    ctx.arc(m.x, m.y, hr, 0, TAU);
    ctx.fill();
  };

  /* ---------- render ---------- */
  Sky.prototype.draw = function (dt) {
    var ctx = this.ctx, w = this.w, h = this.h, t = this.time;
    if (!ctx) return;
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    if (this.nebula) ctx.drawImage(this.nebula, 0, 0, w, h);
    else { ctx.fillStyle = '#030712'; ctx.fillRect(0, 0, w, h); }

    var stars = this.stars, sprite = this.sprite, still = this.reduced;
    for (var i = 0; i < stars.length; i++) {
      var s = stars[i];
      if (!still && dt) {
        s.x += dt * (0.0009 + s.z * 0.0035); // slow parallax drift, nearer = faster
        if (s.x > 1.01) s.x -= 1.02;
      }
      var tw = still ? 1 : 1 - s.amp * (0.5 + 0.5 * Math.sin(t * s.tw + s.ph));
      var a = s.a * tw;
      var x = s.x * w, y = s.y * h;
      if (s.glow) {
        var gs = s.r * 7;
        ctx.globalAlpha = a * 0.55;
        ctx.drawImage(sprite, x - gs / 2, y - gs / 2, gs, gs);
      }
      ctx.globalAlpha = 1;
      ctx.fillStyle = 'rgba(' + s.tint + ',' + a.toFixed(3) + ')';
      if (s.r < 0.9) {
        ctx.fillRect(x, y, s.r * 1.6, s.r * 1.6);
      } else {
        ctx.beginPath();
        ctx.arc(x, y, s.r, 0, TAU);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;

    if (still) return;

    ctx.globalCompositeOperation = 'lighter';
    for (var k = 0; k < this.sparks.length; k++) {
      var p = this.sparks[k], pa = 1 - p.life / p.ttl;
      ctx.fillStyle = 'rgba(255,' + (170 + (pa * 70) | 0) + ',90,' + (pa * 0.75).toFixed(3) + ')';
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r * (0.5 + pa * 0.5), 0, TAU);
      ctx.fill();
    }
    for (var j = 0; j < this.meteors.length; j++) this.drawMeteor(ctx, this.meteors[j]);
    ctx.globalCompositeOperation = 'source-over';
  };

  Sky.prototype.frame = function (ts) {
    if (!this.running) return;
    var now = ts / 1000;
    var dt = this.last ? Math.min(0.05, now - this.last) : 0; // clamp after long pauses
    this.last = now;
    this.time += dt;
    if (!this.reduced) {
      if (!this.nextMeteor) this.scheduleMeteor(this.time - 1.2); // first meteor shortly after load
      if (this.time >= this.nextMeteor) {
        this.spawnMeteor();
        if (Math.random() < 0.18) this.spawnMeteor(); // occasional pair
        this.scheduleMeteor(this.time);
      }
      this.updateMeteors(dt);
    }
    this.draw(dt);
    this.raf = requestAnimationFrame(this.frame);
  };

  Sky.prototype.start = function () {
    if (!this.ctx) return;
    if (this.reduced) { this.stop(); this.draw(0); return; } // static sky, no loop
    if (this.running || document.hidden || !this.inView) return;
    this.running = true;
    this.last = 0;
    this.raf = requestAnimationFrame(this.frame);
  };

  Sky.prototype.stop = function () {
    this.running = false;
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
  };

  Sky.prototype.onVisibility = function () {
    if (document.hidden) this.stop();
    else this.start();
  };

  Sky.prototype.onPageShow = function (e) {
    // Restored from back/forward cache: canvas content is kept, but the rAF loop
    // was frozen. Re-check size and restart.
    if (e && e.persisted) { this.resize(true); this.stop(); }
    this.start();
  };

  Sky.prototype.onPageHide = function () { this.stop(); };

  Sky.prototype.onMotionPref = function (e) {
    this.reduced = !!e.matches;
    this.meteors.length = 0; this.sparks.length = 0;
    this.stop();
    this.start();
  };

  Sky.prototype.state = function () {
    return { inView: this.inView, running: this.running, reduced: this.reduced, stars: this.stars.length, meteors: this.meteors.length, spawned: { ltr: this.spawned.ltr, rtl: this.spawned.rtl }, time: this.time };
  };

  var api = window.Starfield = window.Starfield || {};
  api.instance = new Sky();
  api.destroy = function () { if (api.instance) api.instance.destroy(); };
  api.init = function () { if (!api.instance) api.instance = new Sky(); api.instance.mount(); };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { api.instance.mount(); });
  else api.instance.mount();
})();
