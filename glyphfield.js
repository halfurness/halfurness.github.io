/* Glyphfield: a spinning ASCII torus drawn on a <canvas>. No dependencies. */
(() => {
  const hash = (n) => { n = Math.imul(n ^ (n >>> 16), 0x45d9f3b); n = Math.imul(n ^ (n >>> 16), 0x45d9f3b); return ((n ^ (n >>> 16)) >>> 0) / 4294967296; };

  function Glyphfield(canvas, options) {
    const cfg = Object.assign({
      size: 12, speed: 1, fps: 30, glow: false, scatter: false, dark: true, start: 6, origin: [0.5, 0.5],
      font: '"JetBrains Mono", ui-monospace, Menlo, Consolas, monospace',
    }, options);
    const ctx = canvas.getContext('2d', { alpha: false });
    const LEVELS = 12, calm = matchMedia('(prefers-reduced-motion: reduce)');
    let o, atlas, chars, key = '', px, cw, ch, pad, W, H, raf = 0, last = 0, seen = true;

    const rgb = (h) => { const n = parseInt(h.slice(1), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; };
    function tone(u) {
      const s = cfg.colors, p = u * (s.length - 1), k = Math.min(s.length - 2, Math.floor(p));
      const a = rgb(s[k]), b = rgb(s[k + 1]), f = p - k;
      return 'rgb(' + a.map((c, j) => Math.round(c + (b[j] - c) * f)) + ')';
    }

    // Draw every glyph at every colour level once. Frames then only copy sprites.
    function sprites() {
      const k = [px, cfg.glyphs, cfg.colors, cfg.glow, cfg.scatter, cfg.font].join('|');
      if (k === key) return;
      key = k;
      chars = Array.from(cfg.scatter ? cfg.glyphs : cfg.glyphs.replace(/^ +/, ''));
      pad = cfg.glow ? Math.round(ch * 0.45) : 0;
      const aw = cw + pad * 2, ah = ch + pad * 2;
      atlas = document.createElement('canvas');
      atlas.width = aw * chars.length;
      atlas.height = ah * LEVELS;
      const a = atlas.getContext('2d');
      a.font = px + 'px ' + cfg.font;
      a.textAlign = 'center';
      a.textBaseline = 'middle';
      a.shadowBlur = pad * 0.8;
      for (let l = 0; l < LEVELS; l++) {
        a.fillStyle = a.shadowColor = tone(l / (LEVELS - 1));
        for (let g = 0; g < chars.length; g++) a.fillText(chars[g], g * aw + pad + cw / 2, l * ah + pad + ch / 2);
      }
    }

    function layout() {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      W = canvas.width = Math.max(1, Math.round(canvas.clientWidth * dpr));
      H = canvas.height = Math.max(1, Math.round(canvas.clientHeight * dpr));
      px = Math.round(cfg.size * dpr);
      cw = Math.max(2, Math.round(px * 0.62));
      ch = Math.round(px * 1.2);
      const cols = Math.ceil(W / cw), rows = Math.ceil(H / ch), n = cols * rows, S = Math.min(W, H) / 2;
      const [ox, oy] = typeof cfg.origin === 'function' ? cfg.origin(W, H) : cfg.origin;
      o = {
        cols, rows, n, v: new Float32Array(n), z: new Float32Array(n),
        cw: cw / S, ch: ch / S, ax: W * ox / S, ay: H * oy / S, t: o ? o.t : cfg.start, dt: 0,
      };
      sprites();
    }

    function draw() {
      cfg.pattern(o);
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = cfg.bg;
      ctx.fillRect(0, 0, W, H);
      if (cfg.glow) ctx.globalCompositeOperation = cfg.dark ? 'screen' : 'multiply';
      const v = o.v, n = chars.length, aw = cw + pad * 2, ah = ch + pad * 2, tick = o.t * 1.7;
      for (let y = 0, i = 0; y < o.rows; y++) {
        for (let x = 0; x < o.cols; x++, i++) {
          let val = v[i], g;
          if (!(val > 0.03)) continue;
          if (val > 1) val = 1;
          if (cfg.scatter) {
            if (val < 0.12) continue;
            g = (hash(i * 7919 + Math.floor(tick + hash(i) * 9)) * n) | 0;
          } else if ((g = Math.round(val * n) - 1) < 0) continue;
          const l = Math.min(LEVELS - 1, (val * LEVELS) | 0);
          ctx.drawImage(atlas, g * aw, l * ah, aw, ah, x * cw - pad, y * ch - pad, aw, ah);
        }
      }
    }

    const live = () => !!o && seen && !document.hidden && !calm.matches;
    function frame(now) {
      raf = 0;
      if (!live()) return;
      raf = requestAnimationFrame(frame);
      if (last && now - last < 1000 / cfg.fps - 2) return;
      o.dt = last ? Math.min(0.1, (now - last) / 1000) * cfg.speed : 0;
      o.t += o.dt;
      last = now;
      draw();
    }
    function wake() {
      if (raf || !live()) return;
      last = 0;
      raf = requestAnimationFrame(frame);
    }

    // Redraw on resize; animate only while `watch` (default: the canvas) is on screen.
    new ResizeObserver(() => { layout(); draw(); wake(); }).observe(canvas);
    new IntersectionObserver((e) => { seen = e[e.length - 1].isIntersecting; wake(); }).observe(cfg.watch || canvas);
    document.addEventListener('visibilitychange', wake);
    if (calm.addEventListener) calm.addEventListener('change', wake);
    if (document.fonts) document.fonts.load(Math.round(cfg.size) + 'px ' + cfg.font).then(() => { key = ''; if (o) { sprites(); draw(); } }, () => {});
  }

  // After Andy Sloane's donut.c: a z-buffered torus with Lambert shading.
  function torus(o) {
    const v = o.v, zb = o.z, t = o.t, A = t * 0.8, B = t * 0.45;
    const cA = Math.cos(A), sA = Math.sin(A), cB = Math.cos(B), sB = Math.sin(B);
    const cells = 1 / Math.min(o.cw, o.ch);
    const nt = Math.ceil(Math.max(36, cells * 2.4)), np = Math.ceil(Math.max(90, cells * 7));
    if (!o.ring || o.ring.length !== np * 2) {
      o.ring = new Float32Array(np * 2);
      for (let k = 0; k < np; k++) { o.ring[k * 2] = Math.cos(k / np * 6.2832); o.ring[k * 2 + 1] = Math.sin(k / np * 6.2832); }
    }
    const ring = o.ring, K = 1.35;
    v.fill(0);
    zb.fill(0);
    for (let j = 0; j < nt; j++) {
      const th = j / nt * 6.2832, ct = Math.cos(th), st = Math.sin(th);
      const hx = 2 + ct, hy = st; // a circle of radius 1, two units out from the axis
      for (let k = 0; k < np; k++) {
        const cp = ring[k * 2], sp = ring[k * 2 + 1];
        const x = hx * (cB * cp + sA * sB * sp) - hy * cA * sB;
        const y = hx * (sB * cp - sA * cB * sp) + hy * cA * cB;
        const iz = 1 / (5 + cA * hx * sp + hy * sA); // viewer sits five units back
        const cx = Math.floor((K * x * iz + o.ax) / o.cw), cy = Math.floor((o.ay - K * y * iz) / o.ch);
        if (cx < 0 || cy < 0 || cx >= o.cols || cy >= o.rows) continue;
        const i = cy * o.cols + cx;
        if (iz <= zb[i]) continue;
        zb[i] = iz;
        const L = cp * ct * sB - cA * ct * sp - sA * st + cB * (cA * st - ct * sA * sp);
        v[i] = L > 0 ? 0.14 + L * 0.61 : 0.08;
      }
    }
  }

  const canvas = document.getElementById('field');
  if (!canvas) return;
  Glyphfield(canvas, {
    pattern: torus,
    glyphs: '01',
    scatter: true,
    bg: '#0c0320',
    colors: ['#2a0b52', '#8a1fbf', '#ff2a8a', '#ffd166'],
    glow: true,
    speed: 0.7,
    // Landscape: sit the torus right of centre so the name has room bottom-left.
    origin: (w, h) => (w / h > 1.2 ? [0.64, 0.46] : [0.5, 0.4]),
    watch: document.getElementById('welcome'),
  });
})();
