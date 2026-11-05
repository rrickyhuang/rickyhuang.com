(function () {
  var hk = document.querySelector('.hdr .hk'); if (!hk) return;
  var host = hk.parentNode, W = 15;
  var poseParts = Hiker.parts(hk), shuffle = Hiker.shuffle, words = Hiker.words, pickVar = Hiker.pickVar, /* shared with 404.html: hiker.js */
    say = hk.querySelector('.say'), hit = hk.querySelector('.hit');
  var reduce = matchMedia('(prefers-reduced-motion:reduce)').matches;
  /* must match the `@media (max-width:760px)` blocks in styles.css (the single-column layout) */
  var narrow = matchMedia('(max-width:760px)');
  var x = 0, v = 0, dir = 1, dirS = 1, phase = 0, tx = 0, wait = 0, pause = 2.5, mouseX = null, lastMove = -1e9, since = 0, walking = false, frozen = false, hideT = null, prev = performance.now();
  var VMAX_CHASE = 190, VMAX_STROLL = 34, ACC = 220, DEC = 420, K = 1.8, DEAD = 30, REACT = 180;
  /* ---- words. edit freely. lowercase, no apostrophes. ---- */
  var GREET = "hi, thanks for stopping by. stay a while :)";
  var MAIL = 'say hi: <a href="mailto:rky@rickyhuang.com">rky@rickyhuang.com</a>';
  var POOL = (window.HIKER_LINES && window.HIKER_LINES.pool) || ["take the long way round."], NIGHT = (window.HIKER_LINES && window.HIKER_LINES.night) || POOL; /* the lines live in lines.js */
  var PLINES = ["look at this picture i took!", "check out this pic!", "isnt this beautiful?", "look at this shot!", "this is what my camera sees.", "beautiful, eh?", "check it out!", "wanna see a pic i took?", "look at this!", "heres a photo i took!", "i wish i was here again."];
  /* ---- photos. placeholders for now: swap src/title/meta for real ones. ---- */
  var PHOTOS = [];
  /* ---- last film (letterboxd). film.json is refreshed daily by tools/fetch_letterboxd.py; the copy committed in the repo is the fallback if the refresh fails. FILMS stays empty (no film bubble) if film.json can't be loaded. ---- */
  var FILMS = [], filmI = 0, MON = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
  try { fetch('film.json', { cache: 'no-cache' }).then(function (r) { return r.ok ? r.json() : null }).then(function (j) { if (j && j.length) FILMS = j }).catch(function () { }) } catch (e) { }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] }) }
  function stars(r) { if (!r) return ''; return new Array(Math.floor(r) + 1).join('\u2605') + (r % 1 >= .5 ? '\u00BD' : '') }
  function filmHTML() {
    var k = filmI % FILMS.length, f = FILMS[k], lead = k === 0 ? 'last film i watched:' : 'recently watched:', m = /^\d{4}-(\d{2})-(\d{2})/.exec(f.watched || ''); filmI++;
    var meta = [f.rating ? '<span class="st">' + stars(f.rating) + '</span>' : '', f.liked ? '<span class="st">\u2665</span>' : '', f.rewatch ? 'rewatch' : '', m ? MON[+m[1] - 1] + ' ' + (+m[2]) : '', 'letterboxd'].filter(Boolean).join(' &middot; ');
    return '<div class="fm">' + words(lead) + ' <a target="_blank" rel="noopener" href="' + esc(f.url) + '">' + esc(f.title) + '</a><small>' + meta + '</small></div>'
  }
  var capQ = [], lastCap = '';
  var tapN = 0, textQ = [], nightQ = [], photoQ = [], lastText = '', lbOpen = false, lastThumb = null;
  function nextText() { if (!textQ.length) { textQ = shuffle(POOL.slice()); if (textQ[textQ.length - 1] === lastText) { var f = textQ[0]; textQ[0] = textQ[textQ.length - 1]; textQ[textQ.length - 1] = f } } lastText = textQ.pop(); return lastText }
  /* egg hints (lines.js: hints.<egg>): about 1 in 5 taps (day or night), drawn only from eggs that have not been stamped yet. keys match the egg names (trail, fog, night, rain). */
  var HINTS = (window.HIKER_LINES && window.HIKER_LINES.hints) || {}, HINT_CHANCE = .2, hintQ = [], lastHint = '';
  function nextHint() {
    var open = []; Object.keys(HINTS).forEach(function (k) { if (!TL.have[k] && HINTS[k]) HINTS[k].forEach(function (t) { open.push(t) }) });
    if (!open.length) return null;
    hintQ = hintQ.filter(function (t) { return open.indexOf(t) > -1 }); /* drop hints whose egg was just found */
    if (!hintQ.length) { hintQ = shuffle(open.slice()); if (hintQ.length > 1 && hintQ[hintQ.length - 1] === lastHint) { var f = hintQ[0]; hintQ[0] = hintQ[hintQ.length - 1]; hintQ[hintQ.length - 1] = f } }
    lastHint = hintQ.pop(); return lastHint
  }
  function nextNight() { if (!nightQ.length) nightQ = shuffle(NIGHT.slice()); return nightQ.pop() }
  function nextCap() { if (!capQ.length) { capQ = shuffle(PLINES.slice()); if (capQ[capQ.length - 1] === lastCap) { var f = capQ[0]; capQ[0] = capQ[capQ.length - 1]; capQ[capQ.length - 1] = f } } lastCap = capQ.pop(); return lastCap }
  function nextPhoto() { if (!photoQ.length) photoQ = shuffle(PHOTOS.slice()); return photoQ.pop() }
  /* 84 = room kept clear at the right end of the header for the fern (.pr .hdr .bough in styles.css: 70px wide + right:.2rem + a little air); it is display:none in the narrow layout, so nothing is reserved there */
  function hw() { return Math.max(0, host.clientWidth - W - (narrow.matches ? 0 : 84)) }
  function clamp(a, lo, hi) { return Math.max(lo, Math.min(hi, a)) }
  function pick() { var t; for (var i = 0; i < 6; i++) { t = Math.random() * hw(); if (Math.abs(t - x) > 50) break } tx = t }
  addEventListener('pointermove', function (e) { if (e.pointerType === 'touch') return; mouseX = e.clientX - host.getBoundingClientRect().left - W / 2; lastMove = performance.now() }, { passive: true });
  x = Math.random() * hw(); pick();
  function arm(ms) { clearTimeout(hideT); hideT = setTimeout(hide, ms) }
  function show() {
    tapN++;
    if (typeof egg === 'function' && tapN % 15 === 0) { egg(); return }
    var html, ph = null, ms;
    if (tapN === 1) { html = words(GREET); ms = 4600 }
    else if (tapN % 10 === 0) { html = MAIL; ms = 6500 }
    else if (FILMS.length && tapN % 7 === 0) { html = filmHTML(); ms = 7500 }
    else if (PHOTOS.length && tapN % 3 === 0) {
      ph = nextPhoto();
      html = '<div class="pm"><button class="thumb" type="button" aria-label="open photo"><img alt="" src="' + ph.src + '"></button><span>' + nextCap() + '<small>tap to open</small></span></div>'; ms = 7500
    }
    else { var t = (Math.random() < HINT_CHANCE && nextHint()) || (nightEl ? nextNight() : nextText()); html = words(t); ms = Math.max(3400, 2400 + t.length * 50) }
    speak(html, ms, ph)
  }
  function speak(html, ms, ph) {
    if (typeof pop === 'function') pop();
    var vname = pickVar();
    say.className = 'say' + (ph ? ' has-photo' : ''); say.innerHTML = html; hk.classList.add('talk'); frozen = true;
    var bw = say.offsetWidth, c = x + W / 2, off = (Math.random() * 2 - 1) * 34, L = c - bw / 2 + off, bx = off;
    if (L < 0) bx += -L; else if (L + bw > host.clientWidth) bx -= (L + bw - host.clientWidth);
    var rot = (Math.random() < .5 ? -1 : 1) * (1 + Math.random() * 2.2);
    say.style.setProperty('--rot', rot.toFixed(1) + 'deg'); hk.style.setProperty('--bx', bx.toFixed(0) + 'px');
    say.className = 'say v-' + vname + (ph ? ' has-photo' : '');
    hk.classList.remove('hop'); void hk.offsetWidth; hk.classList.add('hop');
    if (ph) { var th = say.querySelector('.thumb'); th.addEventListener('click', function (e) { e.stopPropagation(); openPhoto(ph, th) }) }
    arm(ms)
  }
  function hide() { if (lbOpen) return; hk.classList.remove('talk'); frozen = false }

  /* ---- easter eggs ---- */
  var lastPX = -1, lastPY = -1, eggs = {}, trailUndo = null, trailCtx = null, nightEl = null, nightEnd = null, fogEnd = null, rainEnd = null, rainDone = false;
  function el(tag, cls, html) { var e = document.createElement(tag); e.className = cls; if (html != null) e.innerHTML = html; return e }
  function gone(n, ms) { n.classList.add('out'); setTimeout(function () { if (n.parentNode) n.parentNode.removeChild(n) }, ms || 700) }
  function below(n) { nightEl && nightEl.parentNode ? document.body.insertBefore(n, nightEl) : document.body.appendChild(n) } /* things that live "in the world" go under the night layer so only the torch reveals them */
  function timers() { var t = []; return { at: function (fn, ms) { t.push(setTimeout(fn, ms)) }, clear: function () { t.forEach(clearTimeout); t = [] } } }
  var GLOWSVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3C6.4 3 2.8 7.1 2.8 11.6c0 .7.5 1.2 1.2 1.2h16c.7 0 1.2-.5 1.2-1.2C21.2 7.1 17.6 3 12 3z" class="cp"/><path d="M9.4 13.4h5.2l-.7 7c-.1.6-.5 1-1.1 1h-1.6c-.6 0-1-.4-1.100-1z" class="st"/><path d="M4.600 12.900h14.800" class="gl"/><path d="M6.500 11.700v2M9 11.500v2.300M11.400 11.400v2.400M13.800 11.400v2.400M16.200 11.500v2.300M18.300 11.700v2" class="gt"/></svg>';
  var REM = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
  /* how dark it is at a distance from a torch hole (matches the mask in css) */
  function dk(d, a, b, c) { a *= REM; b *= REM; c *= REM; return d < a ? 0 : d < b ? .5 * (d - a) / (b - a) : d < c ? .5 + .5 * (d - b) / (c - b) : 1 }
  function startEgg(n) { if (Object.prototype.hasOwnProperty.call(eggs, n) && typeof eggs[n] === 'function') eggs[n]() }
  function egg() { startEgg('trail') }
  function endNight() { var f = nightEnd; nightEnd = null; if (f) f() }
  window.egg = function (n) { startEgg(n) };
  addEventListener('pointerdown', function (e) { lastPX = e.clientX; lastPY = e.clientY }, { passive: true });
  addEventListener('pointermove', function (e) { lastPX = e.clientX; lastPY = e.clientY }, { passive: true });

  /* ---- sound: all synthesized (no files), off by default, remembered ---- */
  var snd = { on: false, ctx: null, nb: null, live: [] };
  try { snd.on = localStorage.getItem('rh-snd') === '1' } catch (e) { }
  function ac() { if (!snd.on) return null; if (!snd.ctx) { var C = window.AudioContext || window.webkitAudioContext; if (!C) return null; try { snd.ctx = new C() } catch (e) { return null } } if (document.hidden) ctxHold(snd.ctx); else ctxGo(snd.ctx); return snd.ctx }
  function tone(f0, f1, dur, vol, type, delay) {
    var c = ac(); if (!c || document.hidden) return; var t = c.currentTime + (delay || 0), o = c.createOscillator(), g = c.createGain(); o.type = type || 'sine'; o.frequency.setValueAtTime(f0, t); if (f1) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + .008); g.gain.exponentialRampToValueAtTime(.0001, t + dur); o.connect(g); g.connect(c.destination); o.start(t); o.stop(t + dur + .05)
  }
  /* silence everything when the page is backgrounded (mobile tab switch / app switch), resume on return */
  /* resume()/suspend() return promises that reject when the browser wants a user gesture (iOS), so swallow those. 'interrupted' is iOS's state after an app switch. */
  function ctxGo(c) { try { if (c.state === 'suspended' || c.state === 'interrupted') { var p = c.resume(); if (p && p.catch) p.catch(function () { }) } } catch (e) { } }
  function ctxHold(c) { try { if (c.state === 'running') { var p = c.suspend(); if (p && p.catch) p.catch(function () { }) } } catch (e) { } }
  /* a context created or asked for while hidden (e.g. rain/fog bed started in a background tab) is held, then resumed here on return */
  function sndHold(e) { var c = snd.ctx; if (!c) return; if (document.hidden || (e && e.type === 'pagehide')) ctxHold(c); else if (snd.on) ctxGo(c) }
  document.addEventListener('visibilitychange', sndHold); addEventListener('pagehide', sndHold); addEventListener('pageshow', sndHold);
  function bed(type, freq, q, vol, fin) {
    var c = ac(); if (!c) return null;
    if (!snd.nb) { var n = c.sampleRate * 2, b = c.createBuffer(1, n, c.sampleRate), d = b.getChannelData(0); for (var i = 0; i < n; i++)d[i] = Math.random() * 2 - 1; snd.nb = b }
    var s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain(); s.buffer = snd.nb; s.loop = true; f.type = type; f.frequency.value = freq; f.Q.value = q;
    g.gain.setValueAtTime(0, c.currentTime); g.gain.linearRampToValueAtTime(vol, c.currentTime + fin); s.connect(f); f.connect(g); g.connect(c.destination); s.start();
    var stop = function (out) { var t = c.currentTime; g.gain.cancelScheduledValues(t); g.gain.setValueAtTime(g.gain.value, t); g.gain.linearRampToValueAtTime(0, t + out); setTimeout(function () { try { s.stop() } catch (e) { } }, out * 1000 + 80); var i = snd.live.indexOf(stop); if (i > -1) snd.live.splice(i, 1) };
    snd.live.push(stop); return stop
  }
  var PENT = [523.25, 587.33, 659.25, 783.99, 880, 987.77, 1174.66];
  function pop() { tone(520 + Math.random() * 260, null, .07, .035, 'triangle') }
  var sfx = {
    thud: function () { tone(130, 44, .3, .2, 'sine'); tone(900, 200, .05, .04, 'square') },
    pip: function () { tone(660, 990, .12, .05, 'triangle') },
    bloop: function (k) { var f = PENT[(Math.random() * PENT.length) | 0]; tone(f, f * 1.015, .2, .03, 'sine', k * .075) },
    lights: function () { tone(880, 660, .06, .05, 'square') }
  };
  (function () {
    var b = el('button', 'snd', '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 9.5v5h3.5l4.500 4v-13l-4.500 4z" fill="currentColor" stroke="none"/><g class="w-on"><path d="M15.500 9a4 4 0 0 1 0 6"/><path d="M18 6.500a8 8 0 0 1 0 11"/></g><g class="w-off"><path d="M16 9.500l5 5M21 9.500l-5 5"/></g></svg>'), pr = document.querySelector('.pl .hdr .lab') || document.body; b.type = 'button';
    function lab() { b.setAttribute('aria-pressed', snd.on ? 'true' : 'false'); b.setAttribute('aria-label', snd.on ? 'sound on (tap to mute)' : 'sound off (tap to turn on)') }
    b.addEventListener('click', function (e) {
      e.stopPropagation(); snd.on = !snd.on; try { localStorage.setItem('rh-snd', snd.on ? '1' : '0') } catch (x) { }
      if (snd.on) { ac(); sfx.pip() } else { snd.live.slice().forEach(function (s) { s(.2) }) } lab()
    });
    lab(); pr.appendChild(b)
  })();

  /* ---- trail complete: flag planted where he stood (stays until clicked), stamp, mushrooms ---- */
  var FLAG = '<svg viewBox="0 0 22 40" width="14" height="26" aria-hidden="true"><path d="M3 39V2" stroke="var(--ink)" stroke-width="1.7" stroke-linecap="round"/><path class="cl" d="M3.6 3C9 .8 12 6 21 3.4V15C12 17.6 9 12.4 3.6 15Z" fill="var(--acc)"/></svg>';
  function shroom() { return '<svg class="em" aria-hidden="true"><use href="#shroom"/></svg>' }
  /* ---- stamps: one per egg. every stamp has the same layout (label, rule, art, date, domain) but its own shape and ink ---- */
  var STAMPS = [
    { k: 'trail', name: 'summited', ink: '#BF4F2D' },
    { k: 'fog', name: 'in a haze', ink: '#6F7C44' },
    { k: 'night', name: 'after dark', ink: '#2E3B21' },
    { k: 'rain', name: 'rain or shine', ink: '#4D7370' }
  ], stampUid = 0;
  function stampOf(k) { for (var i = 0; i < STAMPS.length; i++) if (STAMPS[i].k === k) return STAMPS[i] }
  function oct(r) { var p = []; for (var i = 0; i < 8; i++) { var a = (22.5 + 45 * i) * Math.PI / 180; p.push((100 + r * Math.cos(a)).toFixed(1) + ',' + (100 + r * Math.sin(a)).toFixed(1)) } return p.join(' ') }
  function stampShape(k, a) {
    if (k === 'trail') return '<circle cx="100" cy="100" r="95" ' + a + '/>';
    if (k === 'fog') return '<rect x="8" y="8" width="184" height="184" rx="20" ' + a + '/>';
    if (k === 'night') return '<polygon points="' + oct(95) + '" ' + a + '/>';
    return '<path d="M12 192V100a88 88 0 0 1 176 0V192z" ' + a + '/>'
  }
  /* the big dipper, plotted from real positions [ra deg, dec deg, size]; sky-chart orientation (east on the left) */
  var DIPPER = { dubhe: [165.9, 61.75, 2.6], merak: [165.5, 56.38, 2.2], phecda: [178.5, 53.69, 2.2], megrez: [183.9, 57.03, 1.8], alioth: [193.5, 55.96, 2.8], mizar: [200.98, 54.93, 2.5], alkaid: [206.9, 49.31, 2.6] };
  function dip(n) { var d = DIPPER[n]; return { x: 100 - (d[0] - 186) * .56 * 3.6, y: 118 - (d[1] - 56) * 3.6, r: d[2] } }
  var SF = 'font-family="Young Serif,Georgia,serif"', SS = 'font-family="Instrument Sans,sans-serif" font-weight="600"';
  function stampFoot() {
    var d = new Date().toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' }).toLowerCase();
    return '<text x="100" y="156" text-anchor="middle" ' + SS + ' font-size="9.5" letter-spacing="1.4" fill="currentColor">' + d + '</text><text x="100" y="168" text-anchor="middle" ' + SS + ' font-size="7" letter-spacing="1.8" fill="currentColor" opacity=".8">RICKYHUANG.COM</text>'
  }
  function stampSvg(k) {
    var id = ++stampUid, s = '<svg viewBox="0 0 200 200" aria-hidden="true"><g filter="url(#estink)">';
    s += '<text x="100" y="56" text-anchor="middle" ' + SF + ' font-size="15.5" fill="currentColor">' + stampOf(k).name + '</text><path d="M64 63.500h72" stroke="currentColor" stroke-width="1"/>';
    if (k === 'trail') {
      s += '<circle cx="100" cy="100" r="95" fill="none" stroke="currentColor" stroke-width="3.2"/><circle cx="100" cy="100" r="88.500" fill="none" stroke="currentColor" stroke-width="1"/>'
        + '<g transform="translate(-2,14)"><path d="M70 118l20-30 11 14 8-10 21 26z" fill="currentColor"/><path d="M118 92v-17" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M118.600 75.400c4-1.400 6 1.600 11 .2v7.400c-5 1.400-7-1.600-11-.2z" fill="currentColor"/></g>'
    } else if (k === 'fog') {
      s += '<defs><mask id="sm' + id + '"><rect width="200" height="200" fill="#fff"/><path d="M30 112q17-10 34 0t34 0t34 0t34 0" fill="none" stroke="#000" stroke-width="7"/><path d="M20 128q17-10 34 0t34 0t34 0t34 0t34 0" fill="none" stroke="#000" stroke-width="7"/></mask></defs>'
        + stampShape('fog', 'fill="none" stroke="currentColor" stroke-width="7" stroke-linecap="round" stroke-dasharray="0 11.200"')
        + '<rect x="24" y="24" width="152" height="152" rx="10" fill="none" stroke="currentColor" stroke-width="1.400"/>'
        + '<g transform="translate(0,-6)"><g mask="url(#sm' + id + ')" fill="currentColor"><path d="M62 144l14-38 14 38zM84 144l18-54 18 54zM112 144l13-34 13 34z"/></g><path d="M36 124q16-9 32 0t32 0t32 0t32 0" fill="none" stroke="currentColor" stroke-width="1.600" stroke-linecap="round" opacity=".7"/></g>'
    } else if (k === 'night') {
      var pts = ['alkaid', 'mizar', 'alioth', 'megrez', 'dubhe', 'merak', 'phecda', 'megrez'].map(function (n) { var q = dip(n); return q.x.toFixed(1) + ',' + q.y.toFixed(1) }).join(' '), du = dip('dubhe');
      s += stampShape('night', 'fill="none" stroke="currentColor" stroke-width="3.200" stroke-linejoin="round"') + '<polygon points="' + oct(87) + '" fill="none" stroke="currentColor" stroke-width="1" stroke-linejoin="round"/>'
        + '<path d="M60 76a14 14 0 1 0 9 25a11.500 11.500 0 1 1-9-25z" fill="currentColor"/>'
        + '<path d="M' + du.x.toFixed(1) + ' ' + (du.y - 4).toFixed(1) + 'L143 82" stroke="currentColor" stroke-width="1" stroke-dasharray="1.500 3" fill="none"/>' /* the pointers aim at polaris */
        + '<polyline points="' + pts + '" fill="none" stroke="currentColor" stroke-width="1.200" stroke-linejoin="round" opacity=".85"/><g fill="currentColor">'
        + Object.keys(DIPPER).map(function (n) { var q = dip(n); return '<circle cx="' + q.x.toFixed(1) + '" cy="' + q.y.toFixed(1) + '" r="' + q.r + '"/>' }).join('')
        + '<circle cx="143" cy="76" r="3.400"/><circle cx="88" cy="94" r="1.100"/><circle cx="118" cy="88" r="1.200"/><circle cx="74" cy="106" r="1"/><circle cx="114" cy="144" r="1.200"/><circle cx="160" cy="128" r="1.100"/></g>'
        + '<path d="M143 69v14M136 76h14" stroke="currentColor" stroke-width="1" stroke-linecap="round"/>'
    } else {
      s += stampShape('rain', 'fill="none" stroke="currentColor" stroke-width="3.200" stroke-linejoin="round"') + '<path d="M24 186V100a76 76 0 0 1 152 0V186z" fill="none" stroke="currentColor" stroke-width="1" stroke-linejoin="round"/>'
        + '<g transform="translate(0,-4)"><path d="M62 112a38 38 0 0 1 76 0q-9.500-8-19 0q-9.500-8-19 0q-9.500-8-19 0q-9.500-8-19 0z" fill="currentColor"/><path d="M100 112v26q0 9-8 9" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>'
        + '<g stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M50 88l-3 9M152 84l-3 9M36 118l-3 9M164 114l-3 9M126 136l-3 9M74 138l-3 9"/></g></g>'
    }
    return s + stampFoot() + '</g></svg>'
  }
  /* the big stamp thumping down mid-screen. resolves with its box once it has landed and rested. */
  function bigStamp(kind) {
    var mob = narrow.matches, size = Math.round(Math.min(innerWidth * (mob ? .6 : .68), (mob ? 12 : 15) * REM)), cx = mob ? innerWidth / 2 : innerWidth * .76, cy = innerHeight * (mob ? .27 : .6),
      pl = document.querySelector('.pl'), n = el('div', 'bstamp ' + kind, stampSvg(kind)), box = { n: n, size: size, cx: cx, cy: cy };
    n.style.cssText = 'width:' + size + 'px;height:' + size + 'px;left:' + Math.round(cx - size / 2) + 'px;top:' + Math.round(cy - size / 2) + 'px;color:' + stampOf(kind).ink;
    if (kind === 'night' || (mob && pl && cy < pl.getBoundingClientRect().bottom)) n.classList.add('ondark');
    document.body.appendChild(n);
    if (reduce || !n.animate) { n.style.opacity = '.92'; return Promise.resolve(box) }
    return n.animate([{ opacity: 0, transform: 'scale(2.1) rotate(-2deg)' }, { opacity: .95, transform: 'scale(.95) rotate(-11deg)', offset: .62 }, { transform: 'scale(1.03) rotate(-9deg)', offset: .8 }, { opacity: .92, transform: 'scale(1) rotate(-9deg)' }],
      { duration: 520, easing: 'cubic-bezier(.55,0,.9,.45)', fill: 'forwards' }).finished.then(function () { return new Promise(function (r) { setTimeout(function () { r(box) }, 850) }) })
  }
  /* ---- trail log: a pocket book of the stamps found so far. lives in memory only, so it clears when the visitor leaves or refreshes ---- */
  var TL = { n: 0, total: 0, have: {}, open: false, touched: false, timer: 0, root: null, pill: null }, TLROT = [-7, 5, -4, 8];
  var BOOK = '<svg width="16" height="14" viewBox="0 0 16 14" aria-hidden="true"><path d="M1 2.2C4 1 6.2 1.2 8 2.8 9.8 1.2 12 1 15 2.2V12C12 10.8 9.8 11 8 12.6 6.2 11 4 10.8 1 12z" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/><path d="M8 2.800v9.800" stroke="currentColor" stroke-width="1.300"/></svg>';
  function retrig(n, cls) { n.classList.remove(cls); void n.offsetWidth; n.classList.add(cls) }
  function setOpen(v) { TL.open = v; TL.root.classList.toggle('open', v); TL.pill.setAttribute('aria-expanded', v ? 'true' : 'false') }
  function closeLog() { TL.touched = true; clearTimeout(TL.timer); if (TL.root && TL.open) setOpen(false) }
  function buildLog() {
    var r = el('aside', 'tlog'); r.setAttribute('aria-label', 'trail log'); r.hidden = true;
    r.innerHTML = '<div class="tl-card" id="tl-card"><h4><span class="tl-ttl">trail log</span><i class="tl-cnt">0/4</i></h4><div class="tl-grid">'
      + STAMPS.map(function (s) { return '<div class="tl-cell"><span class="tl-slot" data-k="' + s.k + '"><span class="tl-gh"><svg viewBox="0 0 200 200" aria-hidden="true">' + stampShape(s.k, 'fill="none" stroke="currentColor" stroke-width="6" stroke-dasharray="11 10" stroke-linejoin="round"') + '</svg></span><span class="tl-q">?</span></span><b class="tl-nm tl-unk">?</b></div>' }).join('')
      + '</div></div><button class="tl-pill" type="button" aria-expanded="false" aria-controls="tl-card" aria-label="trail log, 0 of 4 stamps">' + BOOK + '<span class="tl-pc">0/4</span></button><span class="tl-sr" role="status" aria-live="polite"></span>';
    document.body.appendChild(r); TL.root = r; TL.pill = r.querySelector('.tl-pill');
    TL.pill.addEventListener('click', function () { TL.touched = true; clearTimeout(TL.timer); setOpen(!TL.open) });
    document.addEventListener('click', function (e) { if (TL.open && !r.contains(e.target)) closeLog() });
    addEventListener('keydown', function (e) { if (e.key === 'Escape' && TL.open) closeLog() })
  }
  /* the big stamp flies to wherever the log is at the moment it takes off: its slot if the card is open, the pill if not */
  function flyStamp(b, st) {
    var toPill = !TL.open, r = (toPill ? TL.pill : st).getBoundingClientRect(), n = b.n, sc = (toPill ? 14 : r.width) / b.size;
    var dx = r.left + r.width / 2 - b.cx, dy = r.top + r.height / 2 - b.cy;
    if (reduce || !n.animate) return new Promise(function (res) { setTimeout(function () { res(toPill) }, 1400) });
    return n.animate([{ opacity: .92, transform: 'scale(1) rotate(-9deg)' }, { opacity: 1, transform: 'translate(' + dx.toFixed(1) + 'px,' + dy.toFixed(1) + 'px) scale(' + sc.toFixed(3) + ') rotate(' + st.__rot + 'deg)' }],
      { duration: 650, easing: 'cubic-bezier(.6,0,.3,1)', fill: 'forwards' }).finished.then(function () { return toPill })
  }
  /* an egg was found. quiet = the egg already made its own thud */
  function collect(kind, quiet) {
    if (TL.have[kind]) return; TL.have[kind] = 1;
    var first = ++TL.total === 1, s = stampOf(kind), ix = STAMPS.indexOf(s);
    if (!TL.root) buildLog();
    if (first) { TL.touched = false; TL.root.hidden = false; setOpen(true); retrig(TL.root, 'pop') } /* the card opens by itself once, so you see where the stamp goes */
    clearTimeout(TL.timer);
    var slot = TL.root.querySelector('[data-k="' + kind + '"]'), st = el('span', 'tl-st', stampSvg(kind)); st.__rot = TLROT[ix];
    st.style.cssText = 'color:' + s.ink + ';rotate:' + TLROT[ix] + 'deg;opacity:0'; slot.appendChild(st);
    if (!quiet) setTimeout(sfx.thud, 320);
    bigStamp(kind).then(function (b) { return flyStamp(b, st).then(function (toPill) { if (b.n.parentNode) b.n.parentNode.removeChild(b.n); return toPill }) }).then(function (toPill) {
      st.style.opacity = ''; var nm = slot.parentNode.querySelector('.tl-nm'); nm.textContent = s.name; nm.classList.remove('tl-unk'); slot.classList.add('on');
      TL.n++; var c = TL.n + '/4'; TL.root.querySelector('.tl-cnt').textContent = c; TL.pill.querySelector('.tl-pc').textContent = c;
      TL.pill.setAttribute('aria-label', 'trail log, ' + TL.n + ' of 4 stamps'); TL.root.querySelector('.tl-sr').textContent = 'stamp collected: ' + s.name + '. ' + TL.n + ' of 4.';
      if (toPill || !TL.open) retrig(TL.pill, 'bump'); else retrig(st, 'settle');
      if (TL.n === 4) setTimeout(logFull, 500);
      else if (first && !TL.touched) TL.timer = setTimeout(function () { if (!TL.touched) setOpen(false) }, 3000) /* folds itself away after a moment unless you've touched it */
    })
  }
  /* all four found: the card opens (even if it was closed) and is rubber-stamped, the pill goes rust, he hops and the trail blooms. once. */
  function logFull() {
    if (TL.full) return; TL.full = 1; TL.touched = true; clearTimeout(TL.timer); setOpen(true);
    TL.root.classList.add('full'); TL.root.querySelector('.tl-ttl').textContent = 'log full';
    TL.root.querySelector('.tl-grid').appendChild(el('span', 'tl-over', 'all stamped'));
    TL.root.querySelector('.tl-sr').textContent = 'all four stamps collected. trail log full.';
    sfx.pip(); hk.classList.remove('hop'); void hk.offsetWidth; hk.classList.add('hop');
    speak(words('you found everything. im impressed.'), 5200);
    var hr = host.getBoundingClientRect(), spans = [].map.call(host.querySelectorAll('.lab>span'), function (s) { return s.getBoundingClientRect() }), mc = el('span', 'emush'),
      ctx = { mc: mc, fx: x + W / 2, hr: hr, spans: spans, n: 0 }, N = Math.max(6, Math.floor(host.clientWidth / 34)), k = 0;
    host.appendChild(mc);
    for (var i = 0; i < N; i++) { var px = freeSpot(ctx); if (px < 0) continue; sprout(ctx, px, k * 70, k); sfx.bloop(k); k++ }
  }
  function sprout(ctx, px, delay, k) { var s = 9 + Math.random() * 9, m = el('span', '', shroom()).firstChild; m.style.cssText = 'left:' + px.toFixed(0) + 'px;--s:' + s.toFixed(1) + ';--d:' + delay + 'ms;--k:' + k; ctx.mc.appendChild(m); ctx.n++ }
  function freeSpot(ctx) { for (var i = 0; i < 12; i++) { var px = 10 + Math.random() * (host.clientWidth - 20), gx = px + ctx.hr.left, ok = Math.abs(px - ctx.fx) > 16; ctx.spans.forEach(function (r) { if (gx > r.left - 12 && gx < r.right + 12) ok = false }); if (ok) return px } return -1 }
  eggs.trail = function () {
    if (trailUndo) trailUndo();
    var T = timers(), hr = host.getBoundingClientRect(), spans = [].map.call(host.querySelectorAll('.lab>span'), function (s) { return s.getBoundingClientRect() });
    var fx = x + W / 2; spans.forEach(function (r) { var l = r.left - hr.left, rr = r.right - hr.left; if (fx > l - 8 && fx < rr + 8) fx = (fx - l < rr - fx) ? l - 12 : rr + 12 });
    fx = Math.max(8, Math.min(host.clientWidth - 8, fx));
    var flag = el('button', 'eflag', '<span class="fl">' + FLAG + '</span>'), mc = el('span', 'emush'), ctx = { mc: mc, fx: fx, hr: hr, spans: spans, n: 0 };
    flag.type = 'button'; flag.setAttribute('aria-label', 'pull up the flag'); flag.style.left = fx.toFixed(0) + 'px';
    host.appendChild(flag); host.appendChild(mc); sfx.pip();
    T.at(function () { collect('trail', true) }, 450); /* thumps down with the egg's own thud at ~760ms */
    hk.classList.remove('hop'); void hk.offsetWidth; hk.classList.add('hop');
    T.at(function () { speak(words('you made it to the top!'), 4400) }, 250);
    T.at(function () { sfx.thud(); if (reduce) return; var s = document.querySelector('.stage'); if (s && s.animate) s.animate([{ transform: 'none' }, { transform: 'translateY(4px)' }, { transform: 'translateY(-1px)' }, { transform: 'none' }], { duration: 240, easing: 'ease-out' }) }, 760);
    T.at(function () {
      var n = Math.floor(host.clientWidth / 40), i, k = 0; for (i = 0; i < n; i++) {
        var px = (i + .5) / n * host.clientWidth + (Math.random() - .5) * 14, gx = px + hr.left, ok = Math.abs(px - fx) > 14;
        spans.forEach(function (r) { if (gx > r.left - 12 && gx < r.right + 12) ok = false }); if (!ok) continue; sprout(ctx, px, k * 75, k); sfx.bloop(k); k++
      }
    }, 900);
    function undo() { T.clear(); trailUndo = null; trailCtx = null; gone(flag, 450); mc.classList.add('out'); setTimeout(function () { if (mc.parentNode) mc.parentNode.removeChild(mc) }, 1800) }
    trailUndo = undo; trailCtx = ctx; flag.addEventListener('click', function (e) { e.stopPropagation(); undo() })
  };

  /* ---- fog: tickle the fern 3 times. rolls in, lifts. under the night layer if it's dark. ---- */
  eggs.fog = function () {
    if (fogEnd) return;
    var T = timers(), f = el('div', 'efog', '<i></i><i></i><i></i><i></i><i></i>'), nt = !!nightEl, stop = null; below(f); void f.offsetWidth; f.classList.add('in');
    stop = bed('lowpass', 420, .7, .04, 2.5);
    T.at(function () { speak(words(nt || nightEl ? 'fog at night. very spooky.' : 'oh. fog.'), 2800) }, 300);
    T.at(function () { f.classList.add('lift'); if (stop) stop(3.4) }, 5400);
    T.at(function () { speak(words(nightEl ? 'like ships passing in the night.' : 'gone with the wind.'), 4200) }, 7400);
    T.at(function () { collect('fog') }, 1500);
    T.at(function () { fogEnd() }, 9800);
    fogEnd = function () { T.clear(); fogEnd = null; if (stop) stop(.6); gone(f, 1200) }
  };
  var tickles = 0, tickleT = null, TICKLES = 10; /* fern clicks needed for fog */
  document.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('.bough'); if (!b) return;
    tickles++; clearTimeout(tickleT);
    var a = 1 + .4 * (Math.min(tickles, 3) - 1);
    if (b.animate && !reduce) b.animate([{ transform: 'rotate(2deg)' }, { transform: 'rotate(' + (2 - 9 * a) + 'deg)' }, { transform: 'rotate(' + (2 + 8 * a) + 'deg)' }, { transform: 'rotate(' + (2 - 5 * a) + 'deg)' }, { transform: 'rotate(' + (2 + 3 * a) + 'deg)' }, { transform: 'rotate(2deg)' }], { duration: 900, easing: 'ease-out' });
    tone(900 + Math.min(tickles, 10) * 70, null, .1, .03, 'triangle');
    if (tickles >= TICKLES) { tickles = 0; startEgg('fog') } else tickleT = setTimeout(function () { tickles = 0 }, 4000)
  });

  /* ---- night: click every web link once; stays dark until the odd mushroom in the about section is tapped (below) ---- */
  eggs.night = function () {
    if (nightEnd) return;
    unlockNight();
    var T = timers(), d = el('div', 'edark'), g2 = el('div', 'eff efa'), layers = [g2], ffs = [], fw = 0, fvh = 0, fdh = 0, ro = null, i, beam = el('i', 'ebeam'), lamp = el('i', 'elamp'), glows = [], alive = true, raf = 0, cr = null, lastG = performance.now() / 1000, nextMote = 0;
    for (i = 0; i < 40; i++) { var ff = el('i', 'ff'); ff.style.cssText = 'left:' + (Math.random() * 96 + 2).toFixed(0) + '%;top:0;--dx:' + ((Math.random() * 80 - 40) | 0) + 'px;--dy:' + ((Math.random() * 60 - 30) | 0) + 'px;--t:' + (5 + Math.random() * 5).toFixed(1) + 's;--w:' + (1.6 + Math.random() * 2.4).toFixed(1) + 's;animation-delay:' + (-Math.random() * 6).toFixed(1) + 's,' + (-Math.random() * 3).toFixed(1) + 's'; ff.__b = Math.random(); ffs.push(ff); g2.appendChild(ff) }
    /* fireflies live in document space (native scroll) and are spread over the whole page height */
    /* only re-layout when the width or the page height changes: mobile toolbars resize innerHeight while scrolling, which would make the fireflies jump */
    function layoutFF() { var dh = Math.max(document.documentElement.scrollHeight, innerHeight); if (innerWidth !== fw) { fw = innerWidth; fvh = innerHeight } else if (dh === fdh) return; fdh = dh; var n = Math.min(ffs.length, Math.max(8, Math.round(dh / fvh * 8))); for (var k = 0; k < ffs.length; k++) { ffs[k].style.top = (ffs[k].__b * dh).toFixed(0) + 'px'; ffs[k].style.display = k < n ? '' : 'none' } }
    layoutFF(); addEventListener('resize', layoutFF); if (window.ResizeObserver) { ro = new ResizeObserver(layoutFF); ro.observe(document.body) }
    g2.appendChild(beam); g2.appendChild(lamp);
    /* toggled back on while the last night is still fading out: take over from its current opacity (so no flash, and never two layers) */
    var od = reclaim('.edark.out'), oe = reclaim('.eff.out'); document.body.appendChild(d); layers.forEach(function (l) { document.body.appendChild(l) }); nightEl = d; nmSync();
    if (od) d.style.cssText += ';transition:none;opacity:' + od; if (oe) layers.forEach(function (l) { l.style.cssText += ';transition:none;opacity:' + oe });
    void d.offsetWidth; d.style.transition = d.style.opacity = ''; d.classList.add('in'); layers.forEach(function (l) { l.style.transition = l.style.opacity = ''; l.classList.add('in') });
    function loop() {
      if (!alive) return;
      var r = hk.getBoundingClientRect(), hx = r.left + r.width * .5, hy = r.top + r.height * .5, dd = parseFloat(hk.style.getPropertyValue('--dir')); if (!dd) dd = 1;
      var px = lastPX < 0 ? hx + dd * 90 : lastPX, py = lastPY < 0 ? hy + 90 : lastPY, lx = r.left + r.width * (dd > 0 ? .64 : .36), ly = r.top + r.height * .15;
      d.style.setProperty('--px', px.toFixed(0) + 'px'); d.style.setProperty('--py', py.toFixed(0) + 'px');
      d.style.setProperty('--hx', hx.toFixed(0) + 'px'); d.style.setProperty('--hy', hy.toFixed(0) + 'px');
      beam.style.transform = 'translate(' + (lx + scrollX).toFixed(1) + 'px,' + (ly + scrollY).toFixed(1) + 'px) scaleX(' + dd.toFixed(2) + ')';
      lamp.style.transform = 'translate(' + (lx - 2 + scrollX).toFixed(1) + 'px,' + (ly - 2 + scrollY).toFixed(1) + 'px)';
      /* mushrooms (trail egg + link bullets) glow in the dark. real foxfire: gills brightest, cap dim, stem dark; each one a little different. */
      var ems = [].slice.call(document.querySelectorAll('.emush:not(.out) .em,.links .m')), tt = performance.now() / 1000, dtg = Math.min(.1, tt - lastG); lastG = tt;
      if (nmM) ems.unshift(nmM); /* always index 0, so its glow slot never shifts when trail mushrooms come and go */
      var fe = document.querySelector('.efog:not(.out)'), fg = fe ? (parseFloat(getComputedStyle(fe).opacity) || 0) : 0;
      /* read every rect first, then write: interleaving them forces a layout per mushroom per frame */
      var rects = ems.map(function (e) { return e.getBoundingClientRect() }), sx = scrollX, sy = scrollY;
      while (glows.length < ems.length) {
        var sp = ems[glows.length] === nmM, g = el('i', 'eg' + (sp ? ' sp' : ''), GLOWSVG + '<b class="h2"></b><b class="h1"></b><b class="gr"></b>'), hue = sp ? SPHUE : 140 + Math.random() * 36;
        g.style.setProperty('--hue', hue.toFixed(0)); if (!sp && ems[glows.length].closest && ems[glows.length].closest('.links')) g.className += ' bl'; g.__p = { b: sp ? .95 : .5 + Math.random() * .5, per: 3 + Math.random() * 4.5, ph: Math.random() * 6.28, fl: 0, nf: tt + 3 + Math.random() * 10 }; g2.appendChild(g); glows.push(g)
      }
      while (glows.length > ems.length) { g2.removeChild(glows.pop()) }
      for (var j = 0; j < ems.length; j++) {
        var q = rects[j], mx = q.left + q.width / 2, my = q.top + q.height / 2, gl = glows[j], p = gl.__p,
          D = dk(Math.hypot(mx - px, my - py), 2.6, 6.5, 11.5) * dk(Math.hypot(mx - hx, my - hy), 7, 10.5, 15), lv = Math.max(0, (D - .35) / .65); lv = lv * lv * (1 - .55 * fg);
        if (tt > p.nf) { p.fl = 1; p.nf = tt + 5 + Math.random() * 12 } p.fl = Math.max(0, p.fl - dtg * 2.2);
        var s = Math.sin(tt / p.per * 6.283 + p.ph), pu = .74 + .26 * (s * s * (s < 0 ? .6 : 1) + .2), sz = Math.min(1.25, Math.max(.6, q.width / 16)),
          b = Math.min(1, p.b * sz * pu * (1 - .5 * p.fl)), gs = gl.style;
        gs.width = q.width.toFixed(1) + 'px'; gs.height = q.height.toFixed(1) + 'px'; gs.transform = 'translate(' + (q.left + sx).toFixed(1) + 'px,' + (q.top + sy).toFixed(1) + 'px)'; gs.opacity = lv.toFixed(3); gs.setProperty('--b', b.toFixed(3)); gs.setProperty('--fg', fg.toFixed(3));
        if (lv > .35 && tt > nextMote && q.width > 6 && Math.random() < .35) { nextMote = tt + 1.4 + Math.random() * 2.6; var m = el('i', 'mote'); m.style.cssText = 'left:' + (mx + sx + (Math.random() * 8 - 4)).toFixed(0) + 'px;top:' + (q.top + sy + q.height * .3).toFixed(0) + 'px;--hue:' + gl.style.getPropertyValue('--hue'); g2.appendChild(m); setTimeout(function (n) { return function () { if (n.parentNode) n.parentNode.removeChild(n) } }(m), 5200) }
      }
      raf = requestAnimationFrame(loop)
    }
    loop();
    /* crickets (only when sound is on, and they hush while it rains) */
    cr = setInterval(function () { if (rainEnd || !snd.on) return; var n = 3 + ((Math.random() * 3) | 0); for (var k = 0; k < n; k++)tone(4300, 4300, .05, .008, 'sine', k * .075) }, 2200);
    T.at(function () { speak(words(rainEnd ? 'rainy night. cozy.' : 'getting dark. good thing i packed a headlamp.'), 5200) }, 450);
    T.at(function () { collect('night') }, 1500); /* stamped at sunset, as the light goes */
    nightEnd = function () { alive = false; removeEventListener('resize', layoutFF); if (ro) ro.disconnect(); T.clear(); clearInterval(cr); cancelAnimationFrame(raf); nightEl = null; nmSync(); sfx.lights(); gone(d, 1800); layers.forEach(function (l) { gone(l, 1800) }) }
  };
  /* the odd mushroom in the about section: inert until night has happened once (remembered), then the day/night toggle.
     it glows violet, the others green. */
  var NKEY = 'rh-night', SPHUE = 268, nmBtn = document.querySelector('.nite'), nmM = nmBtn && nmBtn.querySelector('.m'), nmOn = false;
  try { nmOn = localStorage.getItem(NKEY) === '1' } catch (e) { }
  function nmSync() { if (!nmBtn) return; nmBtn.disabled = !nmOn; if (nmOn) nmBtn.removeAttribute('aria-hidden'); else nmBtn.setAttribute('aria-hidden', 'true'); nmBtn.setAttribute('aria-pressed', nightEl ? 'true' : 'false') }
  function unlockNight() { if (nmOn) return; nmOn = true; try { localStorage.setItem(NKEY, '1') } catch (e) { } nmSync(); if (nmBtn) { nmBtn.classList.add('wake'); setTimeout(function () { nmBtn.classList.remove('wake') }, 1000) } }
  function reclaim(sel) { var o = 0;[].forEach.call(document.querySelectorAll(sel), function (n) { o = Math.max(o, parseFloat(getComputedStyle(n).opacity) || 0); if (n.parentNode) n.parentNode.removeChild(n) }); return o }
  nmSync();
  if (nmBtn) nmBtn.addEventListener('click', function () {
    if (!nmOn) return;
    if (nightEnd) { endNight(); speak(words('i love a good sunrise.'), 2600) } else startEgg('night')
  });
  /* every web link once (the email link doesn't count) */
  var LKEY = 'rh-links', links = [].slice.call(document.querySelectorAll('.links a')).filter(function (a) { return !/^mailto:/.test(a.getAttribute('href')) });
  function seen() { try { return JSON.parse(localStorage.getItem(LKEY) || '[]') } catch (e) { return [] } }
  function save(a) { try { localStorage.setItem(LKEY, JSON.stringify(a)) } catch (e) { } }
  links.forEach(function (a) {
    a.addEventListener('click', function () {
      var s = seen(), h = a.getAttribute('href'); if (s.indexOf(h) < 0) s.push(h);
      if (links.every(function (l) { return s.indexOf(l.getAttribute('href')) > -1 })) { save([]); setTimeout(function () { startEgg('night') }, 900) } else save(s)
    })
  });

  /* ---- rain: after 180s of visible time. gentle. ---- */
  var UMB = '<span class="ui"><svg viewBox="0 0 28 26" width="28" height="26" aria-hidden="true"><path d="M14 9.500V21c0 1.800-3 1.800-3 0" stroke="var(--ink)" stroke-width="1.400" fill="none" stroke-linecap="round"/><path d="M1 9.500C3 3.500 8 .8 14 .8S25 3.500 27 9.500q-1.600 1.600-3.250 0q-1.600 1.600-3.250 0q-1.600 1.600-3.250 0q-1.600 1.600-3.250 0q-1.600 1.600-3.250 0q-1.600 1.600-3.250 0q-1.600 1.600-3.250 0q-1.600 1.600-3.250 0z" fill="var(--acc)"/><path d="M14 .8V-.5" stroke="var(--ink)" stroke-width="1.200" stroke-linecap="round"/></svg></span>';
  eggs.rain = function () {
    if (rainEnd) return;
    var T = timers(), c = el('canvas', 'erain'), g = c.getContext('2d'), dpr = Math.min(2, devicePixelRatio || 1), W0 = 0, H0 = 0, drops = [], alive = true, raf = 0, t0 = performance.now(), last = t0, ending = 0, fade = 0, umb = el('span', 'eumb', UMB), stopBed = null, plink = 0, grow = 0, still = 0;
    function size() { W0 = innerWidth; H0 = innerHeight; c.width = W0 * dpr; c.height = H0 * dpr; g.setTransform(dpr, 0, 0, dpr, 0, 0) }
    size(); addEventListener('resize', size);
    var N = Math.round(Math.max(55, Math.min(140, innerWidth * innerHeight / 12000)) * (reduce ? .6 : 1)); /* reduced motion: a still drizzle, fewer streaks, nothing falls */
    for (var i = 0; i < N; i++)drops.push({ x: Math.random() * (W0 + 160) - 40, y: Math.random() * H0, l: 12 + Math.random() * 12, v: 640 + Math.random() * 320, a: .4 + Math.random() * .4 });
    below(c); hk.appendChild(umb); hk.classList.add('rainy'); stopBed = bed('bandpass', 1500, .35, .011, 3);
    T.at(function () { speak(words('rain again?'), 3000) }, 600);
    T.at(function () { collect('rain') }, 1800);
    function loop(t) {
      if (!alive) return; var dt = Math.min(.05, (t - last) / 1000); last = t;
      if (ending) fade = Math.max(0, fade - dt / 4); else fade = Math.min(1, fade + dt / 3);
      g.clearRect(0, 0, W0, H0); g.lineWidth = 1.25; g.strokeStyle = 'rgb(112,150,162)';
      if (reduce) { /* no falling: a faint cool wash, and the streaks are re-scattered every couple of seconds */
        if (t > still) { still = t + 2500; drops.forEach(function (d) { d.x = Math.random() * (W0 + 160) - 40; d.y = Math.random() * H0 }) }
        g.globalAlpha = fade * .07; g.fillStyle = 'rgb(112,150,162)'; g.fillRect(0, 0, W0, H0)
      }
      for (var k = 0; k < drops.length; k++) {
        var d = drops[k]; if (!reduce) { d.y += d.v * dt; d.x -= d.v * dt * .16; if (d.y > H0 + 20) { d.y = -20; d.x = Math.random() * (W0 + 160) - 40 } if (d.x < -40) d.x += W0 + 80 }
        g.globalAlpha = d.a * fade; g.beginPath(); g.moveTo(d.x, d.y); g.lineTo(d.x + d.l * .16, d.y - d.l); g.stroke()
      }
      if (snd.on && t > plink) {
        plink = t + 70 + Math.random() * 170; var rr = Math.random();
        if (rr < .6) tone(2200 + Math.random() * 1200, null, .025, .005 + Math.random() * .005, 'triangle');
        else if (rr < .88) { var pf = 1300 + Math.random() * 900; tone(pf, pf * .82, .06, .01, 'sine') }
        else { var df = 420 + Math.random() * 320; tone(df, df * .42, .11, .018, 'sine') }
      }
      if (trailCtx && trailCtx.mc.parentNode && t > grow && (trailCtx.extra || 0) < 6) { grow = t + 2300; var px = freeSpot(trailCtx); if (px >= 0) { trailCtx.extra = (trailCtx.extra || 0) + 1; sprout(trailCtx, px, 0, 0); sfx.bloop(0) } }
      if (ending && fade <= 0) { finish(); return }
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop);
    T.at(function () { ending = 1; if (stopBed) stopBed(4); speak(words('smells like cedar now.'), 3600) }, 34000);
    function finish() { alive = false; cancelAnimationFrame(raf); removeEventListener('resize', size); T.clear(); rainEnd = null; if (c.parentNode) c.parentNode.removeChild(c); gone(umb, 400); hk.classList.remove('rainy') }
    rainEnd = function () { ending = 1; if (stopBed) stopBed(.5); setTimeout(finish, 300) }
  };
  (function () {
    var ra = 180, m = location.hash.match(/rain=(\d+)/), vis = 0, again = function () { return m ? ra : 480 + Math.round(Math.random() * 120) }; if (m) ra = +m[1];
    /* first shower at ra seconds of visible time, then again every ~8-10 min of visible time (measured from when the last one starts) */
    setInterval(function () { if (document.visibilityState === 'visible') vis++; if (vis >= ra) { if (rainEnd) { vis = ra - 5; return } vis = 0; ra = again(); startEgg('rain') } }, 1000)
  })();

  var hm = location.hash.match(/egg=(\w+)/); if (hm) setTimeout(function () { window.egg(hm[1]) }, 800);

  /* ---- lightbox: the print grows out of its thumbnail ---- */
  var lb = null;
  function ensureLB() {
    if (lb) return lb; lb = document.createElement('div'); lb.className = 'lb'; lb.setAttribute('role', 'dialog'); lb.setAttribute('aria-modal', 'true'); lb.setAttribute('aria-label', 'photo');
    lb.innerHTML = '<div class="lb-bg"></div><figure class="lb-card"><span class="tape"></span><img alt=""><figcaption><span class="t"></span><span class="m"></span></figcaption></figure><span class="lb-hint">tap anywhere to close</span><button class="lb-x" type="button" aria-label="close photo">&times;</button>';
    document.body.appendChild(lb);
    lb.querySelector('.lb-bg').addEventListener('click', closeLB); lb.querySelector('.lb-card').addEventListener('click', closeLB); lb.querySelector('.lb-x').addEventListener('click', closeLB); return lb
  }
  function collapsed(card) {
    var tr = lastThumb.getBoundingClientRect(), cr = card.getBoundingClientRect();
    return 'translate(' + ((tr.left + tr.width / 2) - (cr.left + cr.width / 2)) + 'px,' + ((tr.top + tr.height / 2) - (cr.top + cr.height / 2)) + 'px) scale(' + Math.max(.05, tr.width / card.offsetWidth) + ') rotate(-5deg)'
  }
  function openPhoto(ph, thumb) {
    lbOpen = true; lastThumb = thumb; clearTimeout(hideT); var el = ensureLB(), card = el.querySelector('.lb-card');
    card.style.setProperty('--r', ph.ratio || 1.3333); el.querySelector('img').src = ph.src; el.querySelector('.t').textContent = ph.title; el.querySelector('.m').innerHTML = ph.meta.join('<br>');
    el.classList.remove('closing'); el.classList.add('open');
    /* modal: park the page behind it (inert also keeps Tab inside) and put focus on the close button, which is only drawn while it has keyboard focus */
    var stage = document.querySelector('.stage'); if (stage) stage.inert = true; try { el.querySelector('.lb-x').focus({ preventScroll: true }) } catch (e) { }
    card.style.transition = 'none'; card.style.transform = 'none';
    var start = collapsed(card); card.style.transform = start; void card.offsetWidth;
    card.style.transition = reduce ? 'none' : 'transform .6s cubic-bezier(.3,1.3,.5,1)';
    card.style.transform = 'rotate(' + (Math.random() < .5 ? -1.6 : 1.6) + 'deg)'
  }
  function closeLB() {
    if (!lbOpen) return; var card = lb.querySelector('.lb-card');
    card.style.transition = reduce ? 'none' : 'transform .34s cubic-bezier(.5,0,.8,.4)'; card.style.transform = collapsed(card); lb.classList.add('closing');
    setTimeout(function () { lb.classList.remove('open', 'closing'); lbOpen = false; var stage = document.querySelector('.stage'); if (stage) stage.inert = false; arm(900); try { hit.focus({ preventScroll: true }) } catch (e) { } }, reduce ? 0 : 350)
  }
  hit.addEventListener('click', function (e) { e.stopPropagation(); show() });
  document.addEventListener('click', function (e) { if (!hk.contains(e.target) && !(e.target.closest && e.target.closest('.nite, .bough'))) hide() }); /* the fern talks via the tickle handler, so don't close the bubble it just opened */
  addEventListener('keydown', function (e) { if (e.key === 'Escape') { if (lbOpen) closeLB(); else hide() } });
  say.addEventListener('mouseenter', function () { if (!lbOpen) clearTimeout(hideT) });
  say.addEventListener('mouseleave', function () { if (hk.classList.contains('talk') && !lbOpen) arm(1400) });
  function pose(amp) { Hiker.pose(poseParts, phase, amp, Math.min(1, Math.abs(v) / VMAX_CHASE) * 5) }
  function frame(t) {
    var dt = Math.min(.05, (t - prev) / 1000); prev = t;
    var following = mouseX !== null && t - lastMove < 5000;
    var target = following ? clamp(mouseX, 0, hw()) : tx, dist = target - x, ad = Math.abs(dist);
    if (following) {
      if (!walking) { if (ad > DEAD) { if (!since) since = t; if (t - since > REACT) walking = true } else since = 0 }
      else if (ad < 3) { walking = false; since = 0 }
    } else { walking = ad > 1.5; since = 0 }
    if (frozen) walking = false;
    var vmax = following ? VMAX_CHASE : VMAX_STROLL;
    var desired = walking ? (dist > 0 ? 1 : -1) * Math.min(vmax, ad * K) : 0;
    var a = (Math.abs(desired) > Math.abs(v) && (desired * v >= 0)) ? ACC : DEC;
    v += clamp(desired - v, -a * dt, a * dt);
    x += v * dt; if (x < 0) { x = 0; v = 0 } else if (x > hw()) { x = hw(); v = 0 }
    if (Math.abs(v) > 3) dir = v > 0 ? 1 : -1;
    dirS += (dir - dirS) * Math.min(1, dt * 12);
    phase += Math.abs(v) * dt / 6;
    pose(Math.min(1, Math.abs(v) / 55));
    if (!walking && !following && !frozen && Math.abs(v) < 1) { wait += dt; if (wait > pause) { wait = 0; pause = 2 + Math.random() * 3; pick() } }
    hk.style.setProperty('--x', x.toFixed(1) + 'px'); hk.style.setProperty('--dir', dirS.toFixed(3));
    requestAnimationFrame(frame)
  }
  if (!reduce) requestAnimationFrame(frame); else hk.style.setProperty('--x', '0px');
})();
(function () {
  var loc = document.querySelector('.loc'), b = loc && loc.querySelector('.locb'); if (!b) return;
  function set(o) { loc.classList.toggle('open', o); b.setAttribute('aria-expanded', o ? 'true' : 'false') }
  b.addEventListener('click', function (e) { e.stopPropagation(); set(!loc.classList.contains('open')) });
  document.addEventListener('click', function (e) { if (!loc.contains(e.target)) set(false) });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && loc.classList.contains('open')) { set(false); b.focus() } });
})();
