/**
 * Canvas: a browser window lying on the desk with a design tool open in it. The
 * title bar has its three lights and an address bar; a layers panel runs down
 * the left, a properties panel down the right, and a floating toolbar sits at
 * the foot of the canvas. On the canvas, a frame holds three layers that float
 * off it, each over its dashed footprint: an avatar circle, an image and a
 * button. The pointer picks a layer, on the canvas or in the layers panel: it
 * lifts, the selection box and its handles move to it, its row lights up and
 * the swatch takes its colour, while the others settle, staggered by distance.
 * The slider is how high the chosen layer lifts. The empty Projects page shows
 * it at the middle of its range.
 *
 * Hit test: each layer's REST top (unproj onto its own rest height, nearest
 * first), then the layer rows on the window's top, which never move.
 */
import HL from "./hairline-kernel.js";

const {
  Cam, circ, clamp, facing, fit, open, poly, prism, proj, rings, ringAt, rrect, seg, unproj,
  tween, tset, tval, tdone, mk, place, pointer, put, register, disposer, solid,
} = HL;

const W = 150, H = 110, ZS = 4, TB = 11, LP = 32, RP = 118, ZF = ZS + 1.2, T = 2.4, STEP = 45;
const shift = (ring, x, y) => ring.map((q) => ({ ...q, u: q.u + x, v: q.v + y }));
const LAYERS = [
  { name: "image", hue: "green", c: [75, 37], rest: 13, box: [47, 25, 103, 49], r: 3 },
  { name: "avatar", hue: "violet", c: [56, 60], R: 7, rest: 7, box: [49, 53, 63, 67] },
  { name: "button", hue: "orange", c: [75, 77], rest: 3, box: [48, 72, 102, 82], r: 5 },
];
const ROWS = [19, 26, 33, 40], SEL = 0, MAXL = 20;
const key = (L, z) => 0.612 * (L.c[0] + L.c[1]) + 0.5 * z;

function mount({ stage, svg, read }, value) {
  const bag = disposer();
  let lift = value;
  const C = Cam(45, 0.5, 1.62);
  const top = Math.max(...LAYERS.map((L) => L.rest)) + MAXL + T + ZF;
  fit(C, [[0, 0, 0], [W, H, 0], [W, 0, 0], [0, H, 0], [47, 25, top], [103, 25, top], [0, 0, ZS]], 200, 166);
  const P = proj(C), front = facing(C);
  const g = mk("g", {}, svg);
  const flat = (ring, z) => poly(ringAt(P, ring, z));
  const path = (d, cls, parent = g) => mk("path", { d, class: cls }, parent);

  // The window: a thin slab, then what is printed on its top.
  const [wo, wi] = rings(0, 0, W, H, 7, 1.6);
  put(solid(g), prism(P, front, wo, wi, 0, ZS));
  path(seg(P(1.6, TB, ZS), P(W - 1.6, TB, ZS)) + seg(P(LP, TB, ZS), P(LP, H - 1.6, ZS)) + seg(P(RP, TB, ZS), P(RP, H - 1.6, ZS)), "nf lo");
  ["rose", "amber", "green"].forEach((hue, k) => place(mk("circle", { r: 1.7, class: "dot c-" + hue }, g), P(8 + k * 5.5, 5.5, ZS)));
  path(flat(rrect(34, 3.2, 116, 7.8, 2.3, 4), ZS), "nf lo");
  path(flat(circ(1.1, 12).map((q) => ({ ...q, u: q.u + 38, v: q.v + 5.5 })), ZS), "nf lo");
  // the layers panel: the frame's row, then one indented row per layer
  const rows = ROWS.map((y, k) => path(flat(rrect(k ? 15 : 5, y - 2, 27, y + 2, 2, 3), ZS), "nf lo"));
  LAYERS.forEach((L, k) => path(flat(rrect(9, ROWS[k + 1] - 1.8, 12.6, ROWS[k + 1] + 1.8, L.R ? 1.8 : 0.8, 3), ZS), "nf c-" + L.hue));
  // the properties panel: rows, and the fill swatch beside its value
  [19, 26, 48, 55, 62].forEach((y, k) => path(flat(rrect(122, y - 2, k % 2 ? 136 : 144, y + 2, 2, 3), ZS), "nf lo"));
  const swatch = path(flat(rrect(122, 33.5, 129, 40.5, 1.6, 3), ZS), "");
  path(flat(rrect(132, 35, 144, 39, 2, 3), ZS), "nf lo");
  // the floating toolbar at the canvas's foot, its first tool picked
  const [to, ti] = rings(60, 94, 90, 102.5, 4.2, 0.9);
  put(solid(g), prism(P, front, to, ti, ZS, ZS + 1.4));
  [65.5, 71.5, 77.5, 83.5].forEach((x, k) => place(mk("circle", { r: 1.2, class: k ? "dot off" : "dot m" }, g), P(x, 98.25, ZS + 1.4)));

  // The frame on the canvas, and each layer's dashed footprint on it.
  const [fo, fi] = rings(41, 20, 109, 88, 2, 0.8);
  put(solid(g), prism(P, front, fo, fi, ZS, ZF));
  path([57, 62].map((y, k) => seg(P(68, y, ZF), P(k ? 90 : 101, y, ZF))).join(""), "nf lo");
  for (const L of LAYERS) {
    L.ring = L.R ? shift(circ(L.R, 32), ...L.c) : rings(...L.box, L.r, 1)[0];
    L.inner = L.R ? shift(circ(L.R - 1.4, 32), ...L.c) : rings(...L.box, L.r, 1.2)[1];
    path(flat(L.ring, ZF), "nf dash");
  }

  // The layers, each in its own group so depth order can change as they lift.
  const sg = mk("g", {}, g);
  LAYERS.forEach((L, i) => {
    L.i = i; L.grp = mk("g", {}, sg); L.el = solid(L.grp); L.z = tween(L.rest); L.drawn = NaN;
    L.el.sil.classList.add("c-" + L.hue, "tint");
    // what makes it that layer: the avatar's head and shoulders, the image's hill and sun, the button's label bar
    L.mark = path("", "nf c-" + L.hue, L.grp);
  });
  const box = path("", "nf c-sky");
  const handles = [0, 1, 2, 3].map(() => mk("path", { class: "c-sky" }, g));
  const sel = { g: mk("g", {}, g) };
  sel.g.append(box, ...handles);

  function drawLayer(L, z) {
    const z0 = ZF + z, z1 = z0 + T, [cx, cy] = L.c;
    put(L.el, prism(P, front, L.ring, L.inner, z0, z1));
    let d = "";
    if (L.name === "avatar") {
      const arc = Array.from({ length: 13 }, (_, k) => { const t = Math.PI * (1 + k / 12); return P(cx + 4.4 * Math.cos(t), cy + 5 + 4.4 * Math.sin(t), z1); });
      d = flat(shift(circ(2.3, 16), cx, cy - 1.6), z1) + open(arc);
    } else if (L.name === "image") {
      d = flat(shift(circ(3, 16), cx + 15, cy - 4.5), z1) + open([[cx - 24, cy + 9], [cx - 10, cy - 5], [cx - 1, cy + 4], [cx + 5, cy - 1], [cx + 24, cy + 9]].map(([x, y]) => P(x, y, z1)));
    } else {
      d = flat(rrect(cx - 11, cy - 1.3, cx + 11, cy + 1.3, 1.3, 3), z1);
    }
    L.mark.setAttribute("d", d);
  }

  function drawSel(L, z) {
    const z1 = ZF + z + T, [x0, y0, x1, y1] = L.box, m = 2.5;
    box.setAttribute("d", poly([[x0 - m, y0 - m], [x1 + m, y0 - m], [x1 + m, y1 + m], [x0 - m, y1 + m]].map(([x, y]) => P(x, y, z1))));
    [[x0 - m, y0 - m], [x1 + m, y0 - m], [x1 + m, y1 + m], [x0 - m, y1 + m]].forEach(([x, y], k) =>
      handles[k].setAttribute("d", flat(rrect(x - 1.6, y - 1.6, x + 1.6, y + 1.6, 0.5, 2), z1)));
  }

  let chosen = SEL, order = "";
  const B = register(stage, (_dt, now) => {
    let moving = false;
    for (const L of LAYERS) {
      const z = tval(L.z, now);
      if (z !== L.drawn) { L.drawn = z; drawLayer(L, z); }
      if (!tdone(L.z, now)) moving = true;
    }
    // nearest last; the selection box rides on the chosen layer's group
    const sorted = LAYERS.slice().sort((a, b) => key(a, a.drawn) - key(b, b.drawn));
    const o = sorted.map((L) => L.i).join() + "/" + chosen;
    if (o !== order) {
      order = o;
      sorted.forEach((L, k) => { if (k) sorted[k - 1].grp.after(L.grp); });
      LAYERS[chosen].grp.after(sel.g);
    }
    drawSel(LAYERS[chosen], LAYERS[chosen].drawn);
    return moving;
  });
  bag.add(B.unregister);

  const NEAR = LAYERS.slice().sort((a, b) => key(b, b.rest) - key(a, a.rest));
  function hit([sx, sy]) {
    for (const L of NEAR) {
      const [x, y] = unproj(C, sx, sy, ZF + L.rest + T), [x0, y0, x1, y1] = L.box;
      if (L.R ? Math.hypot(x - L.c[0], y - L.c[1]) < L.R + 3 : x > x0 - 3 && x < x1 + 3 && y > y0 - 3 && y < y1 + 3) return L.i;
    }
    const [x, y] = unproj(C, sx, sy, ZS);
    if (x > 3 && x < 29) for (let k = 1; k < ROWS.length; k++) if (Math.abs(y - ROWS[k]) < 3.5) return k - 1;
    return -1;
  }

  let act = -2;
  /** Picks layer a (-1 lets go): it lifts, the rest settle, spreading out from it. */
  function setActive(a) {
    if (a === act) return;
    const now = performance.now(), from = a >= 0 ? a : Math.max(act, 0);
    act = a;
    chosen = a >= 0 ? a : SEL;
    LAYERS.forEach((L, i) => {
      const to = a < 0 ? L.rest : i === a ? L.rest + lift : clamp(L.rest * 0.4, 1.5, 6);
      tset(L.z, to, now, Math.abs(i - from) * STEP);
      rows[i + 1].classList.toggle("hi", i === chosen);
      rows[i + 1].classList.toggle("lo", i !== chosen);
    });
    swatch.setAttribute("class", "c-" + LAYERS[chosen].hue + " tint");
    read.textContent = a < 0 ? "rest" : LAYERS[a].name;
    B.wake();
  }
  setActive(-1);

  bag.add(pointer(stage, { move: (p) => setActive(hit(p)), leave: () => setActive(-1) }));
  bag.add(() => svg.replaceChildren());

  return {
    set: (v) => {
      lift = v;
      if (act >= 0) { const a = act; act = -2; setActive(a); }
    },
    destroy: bag.dispose,
  };
}

export default {
  name: "canvas",
  means: "A browser open on a design canvas: the pointer picks a layer, and it lifts off the frame with its selection handles.",
  rules: [1, 2, 5, 6],
  range: [8, 14, 20],
  mount,
};
