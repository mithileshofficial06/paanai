// Studio loading animation. Kept as a separate file: Reddit's CSP blocks inline scripts.
(function () {
  var root = document.getElementById('boot');
  var fill = root.querySelector('.bl__fill');
  var labelEl = root.querySelector('.bl__label');
  var pctEl = root.querySelector('.bl__pct');
  var cv = root.querySelector('.bl__canvas');
  var g = cv.getContext('2d');
  var reduced = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ---- Loading progress (the app pushes it forward as it boots) ----
  var p = 0, target = 8, finished = false, gone = false;
  var creep = setInterval(function () { if (target < 55) target += 1.5; }, 120);

  // ---- The throw, as a timeline of pot profiles (radius at 0..1 of the height) ----
  var N = 36;
  function prof(H, fn, hole) { var r = []; for (var i = 0; i <= N; i++) r.push(fn(i / N)); return { H: H, r: r, hole: hole }; }
  function dome(u, k) { return Math.sqrt(Math.max(0, 1 - Math.pow(u, k))); }
  var KEYS = [
    prof(64, function (u) { return 70 * dome(u, 3.2); }, 0),                                   // wedged lump
    prof(104, function (u) { return (54 - 16 * u) * dome(u, 6); }, 0),                         // coned up
    prof(78, function (u) { return 62 - 4 * u; }, 0.62),                                       // opened
    prof(150, function (u) { return 45 - 4 * u + 3 * Math.sin(u * 9); }, 0.8),                  // walls pulled
    prof(162, function (u) { return 34 + 26 * Math.sin(Math.PI * Math.min(1, u * 1.15)) - 6 * u; }, 0.78), // belly
    prof(178, function (u) { var b = 30 + 33 * Math.exp(-Math.pow((u - 0.38) / 0.24, 2)); var n = u > 0.78 ? -10 * Math.sin((u - 0.78) / 0.22 * Math.PI) : 0; return Math.max(16, b + n - (u > 0.6 ? (u - 0.6) * 22 : 0)) + (u > 0.95 ? (u - 0.95) * 120 : 0); }, 0.66) // vase
  ];
  // [start s, key index, label]
  var PHASES = [[0, 0, 'Wedging the clay'], [0.9, 1, 'Centring on the wheel'], [1.9, 2, 'Opening the clay'], [2.8, 3, 'Pulling up the walls'], [4.0, 4, 'Shaping the belly'], [5.0, 5, 'Finishing the lip'], [6.2, 5, 'Into the kiln']];
  var LOOP = 9.2;
  function ease(t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }
  function shapeAt(t) {
    // Blend between consecutive keys over 0.9 s after each phase starts; collapse back at the end.
    var cur = KEYS[0], label = PHASES[0][2], phase = 0;
    for (var i = 0; i < PHASES.length; i++) if (t >= PHASES[i][0]) { phase = i; label = PHASES[i][2]; }
    var a = phase > 0 ? KEYS[PHASES[phase - 1][1]] : KEYS[0], b = KEYS[PHASES[phase][1]];
    var k = ease(Math.min(1, (t - PHASES[phase][0]) / 0.9));
    if (t > 8.5) { a = KEYS[5]; b = KEYS[0]; k = ease(Math.min(1, (t - 8.5) / 0.6)); label = 'Wedging the clay'; phase = 0; }
    var r = []; for (var j = 0; j <= N; j++) r.push(a.r[j] + (b.r[j] - a.r[j]) * k);
    cur = { H: a.H + (b.H - a.H) * k, r: r, hole: a.hole + (b.hole - a.hole) * k };
    return { s: cur, label: label, phase: phase, k: k };
  }

  // ---- Canvas ----
  var W = 0, Hc = 0, dpr = 1;
  function resize() {
    dpr = Math.min(2, window.devicePixelRatio || 1);
    W = cv.clientWidth; Hc = cv.clientHeight;
    cv.width = Math.round(W * dpr); cv.height = Math.round(Hc * dpr);
  }
  resize();
  window.addEventListener('resize', resize);

  var embers = [], drops = [];
  for (var e = 0; e < 26; e++) embers.push({ x: Math.random(), y: Math.random(), v: 0.02 + Math.random() * 0.05, s: 0.6 + Math.random() * 1.6, f: Math.random() * 6 });
  var specks = [];
  for (var s2 = 0; s2 < 34; s2++) specks.push({ a: Math.random() * 6.283, u: 0.04 + Math.random() * 0.9, d: Math.random() });

  function rAt(sh, u) { var x = u * N, i = Math.floor(x), f = x - i; if (i >= N) return sh.r[N]; return sh.r[i] + (sh.r[i + 1] - sh.r[i]) * f; }

  var t0 = performance.now(), last = t0, spin = 0, label = '';
  function draw(now) {
    var dt = Math.min(0.05, (now - last) / 1000); last = now;
    var T = reduced ? 6.0 : ((now - t0) / 1000) % LOOP;
    var st = shapeAt(T), sh = st.s;
    var glaze = reduced ? 1 : Math.max(0, Math.min(1, (T - 6.2) / 1.4)) * (T > 8.5 ? Math.max(0, 1 - (T - 8.5) / 0.4) : 1);
    spin += dt * (st.phase === 0 ? 5 : 9);
    if (st.label !== label) { label = st.label; labelEl.textContent = label; labelEl.style.animation = 'none'; void labelEl.offsetWidth; labelEl.style.animation = ''; }

    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    var cx = W / 2, sc = Math.min(W / 300, Hc / 540), baseY = Hc * 0.68;
    // Backdrop: dark studio, kiln light from below, a lamp from the upper left.
    var bg = g.createLinearGradient(0, 0, 0, Hc); bg.addColorStop(0, '#0a0404'); bg.addColorStop(0.55, '#140707'); bg.addColorStop(1, '#1e0805');
    g.fillStyle = bg; g.fillRect(0, 0, W, Hc);
    var flick = 0.85 + 0.15 * Math.sin(now * 0.011) * Math.sin(now * 0.0047 + 1);
    var kg = g.createRadialGradient(cx, Hc * 1.05, 10, cx, Hc * 1.05, Hc * 0.75);
    kg.addColorStop(0, 'rgba(255, 90, 30,' + (0.45 + glaze * 0.25) * flick + ')'); kg.addColorStop(1, 'rgba(255, 40, 10, 0)');
    g.fillStyle = kg; g.fillRect(0, 0, W, Hc);
    var lg = g.createRadialGradient(W * 0.15, Hc * 0.18, 5, W * 0.15, Hc * 0.18, W * 0.9);
    lg.addColorStop(0, 'rgba(255, 190, 130, 0.10)'); lg.addColorStop(1, 'rgba(255, 190, 130, 0)');
    g.fillStyle = lg; g.fillRect(0, 0, W, Hc);

    // Embers drifting up.
    for (var i = 0; i < embers.length; i++) {
      var m = embers[i]; if (!reduced) { m.y -= m.v * dt; if (m.y < -0.05) { m.y = 1.05; m.x = Math.random(); } }
      var a = (0.35 + 0.65 * Math.abs(Math.sin(now * 0.003 + m.f))) * Math.min(1, (1 - m.y) * 3) * 0.8;
      g.fillStyle = 'rgba(255, ' + (150 + (m.f * 15 | 0)) + ', 60,' + a + ')';
      g.beginPath(); g.arc(m.x * W + Math.sin(now * 0.001 + m.f) * 8, m.y * Hc, m.s, 0, 6.283); g.fill();
    }

    // Wheel: splash pan, head, spinning tool marks.
    var rx = 132 * sc, ry = 30 * sc;
    g.fillStyle = '#0d0706'; g.beginPath(); g.ellipse(cx, baseY + 16 * sc, rx * 1.18, ry * 1.25, 0, 0, 6.283); g.fill();
    g.strokeStyle = 'rgba(255, 90, 40, 0.45)'; g.lineWidth = 1.5; g.stroke();
    g.fillStyle = '#26262b'; g.beginPath(); g.ellipse(cx, baseY + 7 * sc, rx, ry, 0, 0, 6.283); g.fill();
    var hg = g.createLinearGradient(cx - rx, baseY - ry, cx + rx, baseY + ry);
    hg.addColorStop(0, '#5b5b64'); hg.addColorStop(0.45, '#8a8a94'); hg.addColorStop(0.55, '#6c6c76'); hg.addColorStop(1, '#2c2c33');
    g.fillStyle = hg; g.beginPath(); g.ellipse(cx, baseY, rx, ry, 0, 0, 6.283); g.fill();
    g.save(); g.beginPath(); g.ellipse(cx, baseY, rx, ry, 0, 0, 6.283); g.clip();
    // Slip film on the head.
    g.fillStyle = 'rgba(120, 70, 50, 0.35)'; g.beginPath(); g.ellipse(cx, baseY, rx * 0.72, ry * 0.72, 0, 0, 6.283); g.fill();
    g.lineWidth = 2 * sc;
    for (var k = 0; k < 9; k++) {
      var ang = spin + k * 0.698, fr = 0.55 + (k % 3) * 0.14;
      g.strokeStyle = 'rgba(255, 235, 220,' + (0.06 + (k % 2) * 0.05) + ')';
      g.beginPath(); g.ellipse(cx, baseY, rx * fr, ry * fr, 0, ang, ang + 0.5); g.stroke();
    }
    g.restore();

    // Pot (clay or glaze) on the head.
    var Hp = sh.H * sc, top = baseY - Hp;
    var wob = st.phase <= 1 && !reduced ? Math.sin(now * 0.02) * (1 - st.k) * 4 * sc : 0;
    var cx2 = cx + wob;
    g.fillStyle = 'rgba(0,0,0,0.45)'; g.beginPath(); g.ellipse(cx, baseY + 2 * sc, (rAt(sh, 0) + 10) * sc, 9 * sc, 0, 0, 6.283); g.fill();
    g.beginPath();
    g.moveTo(cx2 - rAt(sh, 0) * sc, baseY);
    for (var q = 0; q <= N; q++) { var u = q / N; g.lineTo(cx2 - rAt(sh, u) * sc, baseY - u * Hp); }
    for (var q2 = N; q2 >= 0; q2--) { var u2 = q2 / N; g.lineTo(cx2 + rAt(sh, u2) * sc, baseY - u2 * Hp); }
    g.closePath();
    g.save(); g.clip();
    var maxR = 0; for (var mr = 0; mr <= N; mr++) maxR = Math.max(maxR, sh.r[mr]);
    var bx = cx2 - maxR * sc, bw = maxR * 2 * sc;
    var cl = g.createLinearGradient(bx, 0, bx + bw, 0);
    // Wet clay -> copper red glaze.
    function mix(a2, b2, f) { return Math.round(a2 + (b2 - a2) * f); }
    var c0 = [70, 34, 22], c1 = [168, 102, 70], c2 = [116, 62, 40], c3 = [38, 16, 10];
    var g0 = [52, 6, 8], g1 = [196, 40, 36], g2 = [120, 16, 18], g3 = [26, 3, 4];
    function col(c, gg) { return 'rgb(' + mix(c[0], gg[0], glaze) + ',' + mix(c[1], gg[1], glaze) + ',' + mix(c[2], gg[2], glaze) + ')'; }
    cl.addColorStop(0, col(c3, g3)); cl.addColorStop(0.3, col(c1, g1)); cl.addColorStop(0.62, col(c2, g2)); cl.addColorStop(1, col(c0, g0));
    g.fillStyle = cl; g.fillRect(bx - 4, top - 4, bw + 8, Hp + 8);
    // Throwing rings.
    g.fillStyle = 'rgba(0, 0, 0,' + (0.18 * (1 - glaze * 0.7)) + ')';
    for (var yy = baseY - 5 * sc; yy > top; yy -= 7 * sc) g.fillRect(bx, yy, bw, 1.6 * sc);
    // Edge shading follows the contour.
    g.lineWidth = 16 * sc; g.strokeStyle = 'rgba(10, 3, 2, 0.55)'; g.shadowColor = 'rgba(0,0,0,0.6)'; g.shadowBlur = 14 * sc;
    g.beginPath(); for (var e1 = 0; e1 <= N - 2; e1++) { var ue = e1 / N; g.lineTo(cx2 + rAt(sh, ue) * sc + 4 * sc, baseY - ue * Hp); } g.stroke();
    g.beginPath(); for (var e2 = 0; e2 <= N - 2; e2++) { var uf = e2 / N; g.lineTo(cx2 - rAt(sh, uf) * sc - 4 * sc, baseY - uf * Hp); } g.stroke();
    g.shadowBlur = 0;
    // Wet / glossy highlight streak.
    g.lineWidth = (7 + glaze * 5) * sc; g.strokeStyle = 'rgba(255, 236, 220,' + (0.16 + glaze * 0.22) + ')'; g.lineCap = 'round';
    g.beginPath(); for (var h1 = 1; h1 < N; h1++) { var uh = h1 / N; g.lineTo(cx2 - rAt(sh, uh) * sc * 0.42, baseY - uh * Hp); } g.stroke();
    g.lineWidth = 2 * sc; g.strokeStyle = 'rgba(255, 255, 255,' + (0.1 + glaze * 0.35) + ')';
    g.beginPath(); for (var h2 = 2; h2 < N - 1; h2++) { var ui = h2 / N; g.lineTo(cx2 - rAt(sh, ui) * sc * 0.47, baseY - ui * Hp); } g.stroke();
    // Slip specks turning with the wheel (only the front half shows).
    if (glaze < 0.8) for (var sp = 0; sp < specks.length; sp++) {
      var spk = specks[sp], aa = spk.a + spin * 1.2, cz = Math.cos(aa);
      if (cz <= 0) continue;
      var rr = rAt(sh, spk.u) * sc;
      g.fillStyle = 'rgba(' + (spk.d > 0.5 ? '210,160,130' : '40,18,10') + ',' + (0.35 * cz * (1 - glaze)) + ')';
      g.fillRect(cx2 + Math.sin(aa) * rr - 1.2 * sc, baseY - spk.u * Hp, 2.4 * sc * cz + 0.6, 1.4 * sc);
    }
    g.restore();
    // The mouth: rim ellipse and the dark inside.
    var rTop = rAt(sh, 1) * sc, ryTop = Math.max(2, rTop * 0.22);
    if (sh.hole > 0.02) {
      var inner = rTop * (1 - 0.18 * Math.min(1, sh.hole + 0.2));
      g.fillStyle = col([150, 92, 64], [190, 40, 36]); g.beginPath(); g.ellipse(cx2, top, rTop, ryTop, 0, 0, 6.283); g.fill();
      var ig = g.createRadialGradient(cx2, top + ryTop * 0.4, 1, cx2, top, inner);
      ig.addColorStop(0, '#0c0403'); ig.addColorStop(1, col([60, 28, 18], [70, 8, 8]));
      g.fillStyle = ig; g.beginPath(); g.ellipse(cx2, top + ryTop * 0.08 * sh.hole, inner * Math.min(1, sh.hole * 1.4), ryTop * 0.82 * Math.min(1, sh.hole * 1.4), 0, 0, 6.283); g.fill();
      g.strokeStyle = 'rgba(255, 220, 200,' + (0.25 + glaze * 0.3) + ')'; g.lineWidth = 1.4 * sc;
      g.beginPath(); g.ellipse(cx2, top, rTop, ryTop, 0, Math.PI * 0.05, Math.PI * 0.95); g.stroke();
    } else {
      g.fillStyle = 'rgba(255, 220, 190, 0.12)'; g.beginPath(); g.ellipse(cx2 - rTop * 0.2, top + 6 * sc, rTop * 0.5, 4 * sc, 0, 0, 6.283); g.fill();
    }

    // Fingertips on the wall while throwing, and slip flung from the contact.
    var throwing = st.phase >= 2 && st.phase <= 5 && !reduced;
    if (throwing) {
      var fu = st.phase === 3 ? 0.15 + st.k * 0.75 : st.phase === 4 ? 0.4 : st.phase === 5 ? 0.92 : 0.95;
      var fx = cx2 + rAt(sh, fu) * sc, fy = baseY - fu * Hp;
      // Two fingers reaching in from off-screen (a hand just out of frame), pressing the wall.
      var len = W - fx + 30;
      g.save(); g.translate(fx + 1 * sc, fy); g.rotate(-0.16);
      g.shadowColor = 'rgba(0,0,0,0.6)'; g.shadowBlur = 12 * sc; g.shadowOffsetY = 4 * sc;
      for (var fi = 1; fi >= 0; fi--) {
        var oy = fi * 17 * sc, th = (fi ? 15 : 16.5) * sc;
        var sg = g.createLinearGradient(0, oy - th / 2, 0, oy + th / 2);
        sg.addColorStop(0, '#d79d80'); sg.addColorStop(0.45, '#b77b60'); sg.addColorStop(1, '#7c4b37');
        g.fillStyle = sg;
        g.beginPath(); g.moveTo(th / 2, oy - th / 2); g.lineTo(len, oy - th / 2); g.lineTo(len, oy + th / 2); g.lineTo(th / 2, oy + th / 2);
        g.arc(th / 2, oy, th / 2, Math.PI / 2, Math.PI * 1.5); g.closePath(); g.fill();
      }
      g.shadowBlur = 0; g.shadowOffsetY = 0;
      // Knuckle creases, nail sheen and wet slip on the fingertips.
      g.strokeStyle = 'rgba(90, 50, 36, 0.45)'; g.lineWidth = 1 * sc;
      for (var kn = 0; kn < 2; kn++) { var ky = kn * 17 * sc; g.beginPath(); g.moveTo(30 * sc, ky - 4 * sc); g.quadraticCurveTo(32 * sc, ky, 30 * sc, ky + 4 * sc); g.stroke(); }
      g.fillStyle = 'rgba(255, 230, 215, 0.35)';
      for (var nl = 0; nl < 2; nl++) { g.beginPath(); g.ellipse(10 * sc, nl * 17 * sc - 4.5 * sc, 6 * sc, 1.8 * sc, 0, 0, 6.283); g.fill(); }
      g.fillStyle = 'rgba(150, 90, 62, 0.75)';
      for (var sl = 0; sl < 2; sl++) { g.beginPath(); g.ellipse(5 * sc, sl * 17 * sc + 2 * sc, 5.5 * sc, 5 * sc, 0, 0, 6.283); g.fill(); }
      g.restore();
      if (Math.random() < dt * 18) drops.push({ x: fx, y: fy, vx: (40 + Math.random() * 80) * sc, vy: -(20 + Math.random() * 60) * sc, l: 1 });
    }
    for (var d = drops.length - 1; d >= 0; d--) {
      var dr = drops[d]; dr.vy += 300 * sc * dt; dr.x += dr.vx * dt; dr.y += dr.vy * dt; dr.l -= dt * 1.4;
      if (dr.l <= 0 || dr.y > baseY + 30 * sc) { drops.splice(d, 1); continue; }
      g.fillStyle = 'rgba(150, 92, 66,' + dr.l + ')'; g.beginPath(); g.arc(dr.x, dr.y, 1.6 * sc, 0, 6.283); g.fill();
    }
    // Kiln heat shimmer over the glazed pot.
    if (glaze > 0) {
      var hgl = g.createRadialGradient(cx2, top + Hp * 0.5, 4, cx2, top + Hp * 0.5, Hp);
      hgl.addColorStop(0, 'rgba(255, 140, 60,' + 0.16 * glaze * flick + ')'); hgl.addColorStop(1, 'rgba(255, 80, 20, 0)');
      g.fillStyle = hgl; g.fillRect(0, 0, W, Hc);
    }
  }

  function frame(now) {
    if (gone) return;
    p += (target - p) * 0.08;
    if (target - p < 0.2) p = target;
    fill.style.width = p.toFixed(1) + '%';
    pctEl.textContent = Math.round(p) + '%';
    try { draw(now); } catch (err) { /* never block loading on a drawing error */ }
    if (finished && p >= 99.5) {
      // Fade the loader out completely, THEN fade the studio in (no overlap).
      gone = true;
      root.classList.add('is-done');
      setTimeout(function () { root.remove(); document.body.classList.remove('is-booting'); }, reduced ? 0 : 360);
      return;
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
  window.__boot = {
    to: function (t) { target = Math.max(target, t); },
    done: function () { clearInterval(creep); finished = true; target = 100; }
  };
})();
