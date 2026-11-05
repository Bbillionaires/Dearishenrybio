/* De'Aris Henry — site interactions */
(function () {
  'use strict';
  var doc = document.documentElement;
  doc.classList.add('js');
  var CFG = window.SITE_CONFIG || {};
  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var money = function (n) { return '$' + Number(n).toLocaleString('en-US', { maximumFractionDigits: 0 }); };

  /* ---------- Mobile navigation ---------- */
  var toggle = $('.nav-toggle'), nav = $('#site-nav');
  function setNav(open) {
    if (!toggle || !nav) return;
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    nav.classList.toggle('is-open', open);
  }
  if (toggle && nav) {
    toggle.addEventListener('click', function () { setNav(toggle.getAttribute('aria-expanded') !== 'true'); });
    nav.addEventListener('click', function (e) { if (e.target.closest('a')) setNav(false); });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && toggle.getAttribute('aria-expanded') === 'true') { setNav(false); toggle.focus(); }
    });
    window.addEventListener('resize', function () { if (window.innerWidth > 860) setNav(false); }, { passive: true });
  }

  /* ---------- Active section highlighting ---------- */
  var links = $$('#site-nav a[href^="#"]');
  var map = {};
  links.forEach(function (a) { map[a.getAttribute('href').slice(1)] = a; });
  var sections = Object.keys(map).map(function (id) { return document.getElementById(id); }).filter(Boolean);
  if ('IntersectionObserver' in window && sections.length) {
    var current = null;
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) {
          if (current) current.removeAttribute('aria-current');
          current = map[en.target.id];
          if (current) {
            current.setAttribute('aria-current', 'true');
            var ul = current.closest('ul');
            if (window.innerWidth > 860 && ul && ul.scrollWidth > ul.clientWidth + 1) {
              var ar = current.getBoundingClientRect(), ur = ul.getBoundingClientRect();
              ul.scrollTo({ left: ul.scrollLeft + (ar.left - ur.left) - ul.clientWidth / 2 + ar.width / 2, behavior: reduceMotion ? 'auto' : 'smooth' });
            }
          }
        }
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    sections.forEach(function (s) { io.observe(s); });
  }

  /* ---------- Reveal on scroll ---------- */
  var reveals = $$('.reveal');
  if ('IntersectionObserver' in window && !reduceMotion) {
    var ro = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) { if (en.isIntersecting) { en.target.classList.add('is-visible'); ro.unobserve(en.target); } });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.05 });
    reveals.forEach(function (el) { ro.observe(el); });
  } else {
    reveals.forEach(function (el) { el.classList.add('is-visible'); });
  }

  /* ---------- Verified book links ---------- */
  (function bookLinks() {
    var L = CFG.bookLinks || {};
    $$('[data-book]').forEach(function (el) {
      var url = L[el.getAttribute('data-book')];
      var slot = $('.purchase', el);
      if (url && slot && /^https:\/\//.test(url)) {
        var a = document.createElement('a');
        a.href = url; a.className = 'btn'; a.rel = 'noopener'; a.target = '_blank';
        a.textContent = 'Purchase';
        slot.replaceWith(a);
      }
    });
  })();

  /* ---------- Contact links (email only when public) ---------- */
  (function contactLinks() {
    var C = CFG.contact || {};
    var ul = $('#contact-links');
    if (!ul) return;
    var items = [];
    if (C.email && C.showEmail) items.push(['mailto:' + C.email, C.email]);
    if (C.phone) items.push(['tel:' + C.phone.replace(/[^\d+]/g, ''), C.phone]);
    if (C.linkedin && /^https:\/\//.test(C.linkedin)) items.push([C.linkedin, 'LinkedIn profile']);
    items.forEach(function (it) {
      var li = document.createElement('li'), a = document.createElement('a');
      a.href = it[0]; a.textContent = it[1];
      if (/^https/.test(it[0])) { a.target = '_blank'; a.rel = 'noopener'; }
      li.appendChild(a); ul.appendChild(li);
    });
  })();

  /* ---------- Contact form ---------- */
  (function contactForm() {
    var form = $('#contact-form');
    if (!form) return;
    var status = $('#form-status');
    var C = CFG.contact || {};
    var show = function (kind, msg) { status.className = 'form-status is-' + kind; status.textContent = msg; status.focus && status.focus(); };
    var rules = {
      name: function (v) { return v.trim().length >= 2 || 'Please enter your name.'; },
      email: function (v) { return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim()) || 'Please enter a valid email address.'; },
      type: function (v) { return !!v || 'Please choose an opportunity type.'; },
      message: function (v) { return v.trim().length >= 10 || 'Please include a short message (10+ characters).'; },
    };
    function validate(field) {
      var rule = rules[field.name];
      if (!rule) return true;
      var res = rule(field.value);
      var err = document.getElementById(field.id + '-error');
      var ok = res === true;
      field.setAttribute('aria-invalid', ok ? 'false' : 'true');
      if (err) err.textContent = ok ? '' : res;
      return ok;
    }
    $$('input, select, textarea', form).forEach(function (f) {
      f.addEventListener('blur', function () { if (f.value) validate(f); });
      f.addEventListener('input', function () { if (f.getAttribute('aria-invalid') === 'true') validate(f); });
    });

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var fields = $$('input, select, textarea', form).filter(function (f) { return rules[f.name]; });
      var firstBad = null;
      fields.forEach(function (f) { if (!validate(f) && !firstBad) firstBad = f; });
      if (firstBad) { firstBad.focus(); show('error', 'Please correct the highlighted fields.'); return; }
      if (form.elements.website && form.elements.website.value) return; // honeypot

      var data = {
        name: form.elements.name.value.trim(),
        email: form.elements.email.value.trim(),
        company: form.elements.company.value.trim(),
        opportunityType: form.elements.type.value,
        message: form.elements.message.value.trim(),
      };
      var btn = $('button[type="submit"]', form);

      if (C.formEndpoint) {
        btn.disabled = true; btn.textContent = 'Sending…';
        fetch(C.formEndpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify(Object.assign({ _subject: 'Website inquiry — ' + data.opportunityType, _template: 'table', _captcha: 'false', _replyto: data.email }, data)),
        }).then(function (r) {
          if (!r.ok) throw new Error('HTTP ' + r.status);
          return r.json().catch(function () { return {}; });
        }).then(function (res) {
          if (res && (res.success === false || res.success === 'false')) throw new Error(res.message || 'rejected');
          form.reset();
          show('success', 'Thank you, ' + data.name.split(' ')[0] + '. Your message has been sent — I will be in touch.');
        }).catch(function () {
          show('error', 'Your message could not be sent right now. Please try again shortly' + (C.email && C.showEmail ? ' or email ' + C.email + '.' : '.'));
        }).then(function () { btn.disabled = false; btn.textContent = 'Send Message'; });
        return;
      }

      if (C.email) {
        var body = 'Name: ' + data.name + '\nEmail: ' + data.email + (data.company ? '\nCompany: ' + data.company : '') +
          '\nOpportunity type: ' + data.opportunityType + '\n\n' + data.message;
        window.location.href = 'mailto:' + encodeURIComponent(C.email) + '?subject=' +
          encodeURIComponent('Website inquiry — ' + data.opportunityType) + '&body=' + encodeURIComponent(body);
        show('success', 'Your email app should open with the message ready to send.');
        return;
      }

      show('info', 'Thank you — your message is ready, but the contact channel is still being finalized. Please check back soon.');
      if (window.console) console.warn('[contact] Set SITE_CONFIG.contact.formEndpoint or .email in assets/js/site-config.js');
    });
  })();

  /* ---------- International network map ---------- */
  (function worldMap() {
    var wrap = $('#network-map');
    if (!wrap) return;
    var INFO = {
      us: { name: 'United States', text: 'Home base — Jacksonville, Florida. Business development, operations, real estate, and recruiting.' },
      ph: { name: 'Philippines', text: 'Professional connections supporting remote collaboration and talent and vendor relationships.' },
      pl: { name: 'Poland', text: 'Professional connections supporting cross-border networking and multicultural business relationships.' },
    };
    var NS = 'http://www.w3.org/2000/svg';
    var tip = $('.map-tooltip', wrap);
    var stage = $('.map-stage', wrap);

    fetch(wrap.getAttribute('data-src')).then(function (r) {
      if (!r.ok) throw new Error(r.status);
      return r.text();
    }).then(function (txt) {
      stage.innerHTML = txt;
      var svg = $('svg', stage);
      svg.setAttribute('role', 'group');
      svg.setAttribute('aria-label', 'World map with gold connection lines from Jacksonville, Florida to the Philippines and Poland');
      var markers = JSON.parse(svg.getAttribute('data-markers'));

      var defs = document.createElementNS(NS, 'defs');
      defs.innerHTML = '<linearGradient id="arcGrad" x1="0" x2="1"><stop offset="0" stop-color="#E6C778"/><stop offset=".5" stop-color="#FFB347"/><stop offset="1" stop-color="#D4AF37"/></linearGradient>';
      svg.insertBefore(defs, svg.firstChild);

      var arcs = document.createElementNS(NS, 'g');
      [['us', 'pl'], ['us', 'ph'], ['pl', 'ph']].forEach(function (pair, idx) {
        var a = markers[pair[0]], b = markers[pair[1]];
        var mx = (a[0] + b[0]) / 2, my = Math.min(a[1], b[1]) - Math.abs(b[0] - a[0]) * 0.22;
        var d = 'M' + a[0] + ' ' + a[1] + ' Q' + mx + ' ' + my + ' ' + b[0] + ' ' + b[1];
        var glow = document.createElementNS(NS, 'path');
        glow.setAttribute('d', d); glow.setAttribute('class', 'map-arc-glow');
        var p = document.createElementNS(NS, 'path');
        p.setAttribute('d', d); p.setAttribute('class', 'map-arc');
        if (idx === 2) p.setAttribute('stroke-opacity', '.55');
        arcs.appendChild(glow); arcs.appendChild(p);
      });
      svg.appendChild(arcs);
      $$('.map-arc', svg).forEach(function (p, i) {
        var len = Math.ceil(p.getTotalLength());
        p.style.setProperty('--len', len);
        p.style.animationDelay = (i * 0.5) + 's';
      });

      Object.keys(markers).forEach(function (k) {
        var g = document.createElementNS(NS, 'g');
        g.setAttribute('class', 'map-marker');
        g.setAttribute('tabindex', '0');
        g.setAttribute('role', 'button');
        g.setAttribute('data-country', k);
        g.setAttribute('aria-label', INFO[k].name + ': ' + INFO[k].text);
        var x = markers[k][0], y = markers[k][1];
        g.innerHTML = '<circle class="pulse" cx="' + x + '" cy="' + y + '" r="9"/><circle class="ring" cx="' + x + '" cy="' + y + '" r="11" fill="none"/><circle class="dot" cx="' + x + '" cy="' + y + '" r="5"/>';
        svg.appendChild(g);
        var showTip = function () { activate(k, true); };
        g.addEventListener('mouseenter', showTip);
        g.addEventListener('focus', showTip);
        g.addEventListener('click', showTip);
        g.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); showTip(); } });
        g.addEventListener('mouseleave', function () { activate(null); });
        g.addEventListener('blur', function () { activate(null); });
      });

      function activate(k, withTip) {
        $$('.map-country', svg).forEach(function (c) { c.classList.toggle('is-active', c.getAttribute('data-country') === k); });
        $$('.map-legend button', wrap).forEach(function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-country') === k)); });
        if (!k || !withTip) { tip.classList.remove('is-visible'); return; }
        var vb = svg.viewBox.baseVal, rect = svg.getBoundingClientRect(), wr = wrap.getBoundingClientRect();
        var px = rect.left - wr.left + (markers[k][0] / vb.width) * rect.width;
        var py = rect.top - wr.top + (markers[k][1] / vb.height) * rect.height;
        px = Math.max(130, Math.min(wr.width - 130, px));
        tip.style.left = px + 'px'; tip.style.top = py + 'px';
        tip.innerHTML = '<b></b><span></span>';
        tip.firstChild.textContent = INFO[k].name;
        tip.lastChild.textContent = INFO[k].text;
        tip.classList.add('is-visible');
      }

      $$('.map-legend button[data-country]', wrap).forEach(function (b) {
        b.addEventListener('click', function () {
          var k = b.getAttribute('data-country');
          activate(b.getAttribute('aria-pressed') === 'true' ? null : k, true);
        });
      });

      if ('IntersectionObserver' in window) {
        var mo = new IntersectionObserver(function (en) {
          if (en[0].isIntersecting) { wrap.classList.add('is-visible'); mo.disconnect(); }
        }, { threshold: 0.25 });
        mo.observe(wrap);
      } else wrap.classList.add('is-visible');
    }).catch(function () {
      stage.innerHTML = '<p class="map-fallback">Network markets: United States · Philippines · Poland · additional international markets.</p>';
    });
  })();

  /* ---------- Signature draw-on when visible ---------- */
  (function signature() {
    var sig = $('.signature');
    if (!sig) return;
    if (reduceMotion || !('IntersectionObserver' in window)) { sig.classList.add('is-drawn'); return; }
    var so = new IntersectionObserver(function (en) {
      if (en[0].isIntersecting) {
        sig.classList.add('is-drawing');
        so.disconnect();
        setTimeout(function () { sig.classList.add('is-drawn'); }, 5200);
      }
    }, { threshold: 0.4 });
    so.observe(sig);
  })();
})();
