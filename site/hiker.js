/* The hiker's shared helpers, loaded by index.html (used from app.js) and 404.html.
   Page-specific behaviour (where he walks, how the bubble is placed) stays in each page.
   Paths are written root-relative in 404.html because that page is served from any depth. */
window.Hiker = (function () {
  var VARS = ['pop', 'bump', 'wiggle', 'drop', 'swing'], lastVar = '';
  /* in-place Fisher-Yates */
  function shuffle(a) { for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)), t = a[i]; a[i] = a[j]; a[j] = t } return a }
  /* a speech-bubble entrance animation name (v-<name> in hiker.css), never the same twice running */
  function pickVar() { var r; do { r = VARS[Math.floor(Math.random() * VARS.length)] } while (r === lastVar); lastVar = r; return r }
  /* wrap each word in a span so it can animate in one after another */
  function words(t) { return t.split(' ').map(function (w, i) { return '<span class="w" style="--i:' + i + '">' + w + '</span>' }).join(' ') }
  /* the SVG parts that move when he walks */
  function parts(hk) { return { legL: hk.querySelector('.legL'), legR: hk.querySelector('.legR'), pole: hk.querySelector('.pole'), bodyg: hk.querySelector('.bodyg') } }
  /* walking pose: amp 0..1 scales the stride, lean is the body tilt in degrees */
  function pose(p, phase, amp, lean) {
    var s = Math.sin(phase) * 28 * amp, b = Math.abs(Math.sin(phase)) * 1.3 * amp;
    p.legL.setAttribute('transform', 'rotate(' + s.toFixed(1) + ' 11 22)');
    p.legR.setAttribute('transform', 'rotate(' + (-s).toFixed(1) + ' 11 22)');
    p.pole.setAttribute('transform', 'rotate(' + (-s * .35).toFixed(1) + ' 18.5 17)');
    p.bodyg.setAttribute('transform', 'translate(0 ' + (-b).toFixed(2) + ') rotate(' + lean.toFixed(1) + ' 11 38)')
  }
  return { shuffle: shuffle, pickVar: pickVar, words: words, parts: parts, pose: pose }
})();
