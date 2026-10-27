/**
 * Server: a rack cabinet on four small feet, holding seven blades. Each blade
 * shows what makes it a server: an ear with a pull handle at each side, a row
 * of vent slots, and status LEDs. One blade, u5, is broken: it sits half out
 * and askew, its LED is the rose one, and a cable hangs loose from its port.
 * The pointer picks a blade; it slides out like a drawer and its neighbours
 * follow a little, staggered by distance. The slider is how far it slides.
 *
 * Hit test: the pointer's line of sight against each blade's REST front face
 * (and the broken blade's rest top), nearest face first, so a drawer sliding
 * out from under a still pointer cannot flip the choice.
 */
import HL from "./hairline-kernel.js";

const {
  Cam, circ, clamp, fit, open, poly, prism, proj, rad, rings, rrect, seg, unproj, facing,
  tween, tset, tval, tdone, mk, place, pointer, put, register, disposer, solid,
} = HL;

const N = 7, U = 9, H = 8, D = 40, WD = 64, BRK = 4, BO = 12, YAW = rad(-5), STEP = 45;
const REST = [0, 0.5, 0, 1.1, BO, 1.7, 0.4];
const ZT = N * U, CH = 7, PB = 4, FH = 3, X0 = -D - 5, X1 = 1, PY = WD - 19;
const MAXO = 32;

/** Blade-local (lx back from the face, ly across) to world, for a blade out by o and turned by th. */
function xf(o, th, lx, ly) {
  const c = Math.cos(th), s = Math.sin(th), dy = ly - WD / 2;
  return [o + lx * c - dy * s, WD / 2 + lx * s + dy * c];
}
const turn = (ring, o, th) => ring.map((q) => {
  const [u, v] = xf(o, th, q.u, q.v), c = Math.cos(th), s = Math.sin(th);
  return { u, v, nu: q.nu * c - q.nv * s, nv: q.nu * s + q.nv * c };
});
const shift = (ring, x, y) => ring.map((q) => ({ ...q, u: q.u + x, v: q.v + y }));

function mount({ stage, svg, read }, value) {
  const bag = disposer();
  let out = value;
  const C = Cam(45, 0.5, 2.2);
  fit(C, [[X0, -7, -PB - FH], [X1, WD + 7, -PB - FH], [X1, -7, -PB - FH], [X0, WD + 7, ZT + CH], [X1, -7, ZT + CH],
    [MAXO, WD + 5, 0], [MAXO, -5, 0], [MAXO, WD + 5, ZT], [X0, -7, ZT + CH]], 200, 166);
  const P = proj(C), front = facing(C);
  const g = mk("g", {}, svg);
  const slab = (x0, y0, x1, y1, r, b, z0, z1) => { const [o, i] = rings(x0, y0, x1, y1, r, b); put(solid(g), prism(P, front, o, i, z0, z1)); };

  // Back to front: feet, plinth, three posts and the back panel; blades; then the near front post and the cap.
  for (const [x, y] of [[X0 + 4, -3], [X0 + 4, WD + 3], [-3, -3], [-3, WD + 3]]) {
    const r = shift(circ(2.6, 24), x, y);
    put(solid(g), prism(P, front, r, null, -PB - FH, -PB));
  }
  slab(X0, -7, X1, WD + 7, 3, 1.4, -PB, 0);
  const post = (x, y) => slab(x, y, x + 2.6, y + 2.6, 1.1, 0.5, 0, ZT);
  post(X0 + 0.5, -7); post(-3.4, -7); post(X0 + 0.5, WD + 4.4);
  slab(X0 + 0.5, -4.4, X0 + 2.5, WD + 4.4, 0.8, 0.5, 0, ZT);

  const blades = [];
  for (let i = 0; i < N; i++) {
    const grp = mk("g", {}, g), el = solid(grp), z0 = i * U, br = i === BRK;
    const b = {
      i, z0, br, el, o: tween(REST[i]), drawn: NaN,
      ears: mk("path", {}, grp), hand: mk("path", { class: "nf lo" }, grp), vent: mk("path", { class: "nf lo" }, grp),
      port: br ? mk("path", { class: "nf" }, grp) : null,
      led: [mk("circle", { r: br ? 1.8 : 1.1, class: br ? "dot c-rose" : "dot m c-green" }, grp), mk("circle", { r: 1.1, class: "dot off" }, grp)],
    };
    blades.push(b);
  }
  post(-3.4, WD + 4.4);
  slab(X0, -7, X1, WD + 7, 3, 1.4, ZT, ZT + CH);
  // the maker's badge on the cap's front, the brand's violet
  const onCap = (ring) => poly(ring.map((q) => P(X1, q.u, q.v)));
  mk("path", { class: "c-violet tint", d: onCap(rrect(WD / 2 - 10, ZT + 2, WD / 2 + 10, ZT + CH - 2, 1.4, 3)) }, g);
  const cable = mk("path", { class: "nf" }, g), plug = mk("path", {}, g);

  const [ring, inner] = rings(-D, 0, 0, WD, 2.2, 1.2);
  const face = (o, th, z0) => (ly, z) => P(...xf(o, th, 0, ly), z0 + z);
  const rr = (F, u0, v0, u1, v1, r) => poly(rrect(u0, v0, u1, v1, r, 3).map((q) => F(q.u, q.v)));

  function drawBlade(b, o) {
    const th = b.br ? YAW : 0, F = face(o, th, b.z0);
    put(b.el, prism(P, front, turn(ring, o, th), turn(inner, o, th), b.z0, b.z0 + H));
    b.ears.setAttribute("d", rr(F, -4.2, 0.7, -0.4, H - 0.7, 1.2) + rr(F, WD + 0.4, 0.7, WD + 4.2, H - 0.7, 1.2));
    b.hand.setAttribute("d", rr(F, -3.3, 1.9, -1.3, H - 1.9, 0.9) + rr(F, WD + 1.3, 1.9, WD + 3.3, H - 1.9, 0.9));
    let v = "";
    for (let k = 0; k < 8; k++) v += rr(F, 9 + k * 3.6, 2.3, 11 + k * 3.6, H - 2.3, 1);
    b.vent.setAttribute("d", v);
    if (b.port) b.port.setAttribute("d", rr(F, PY - 2.6, 2.4, PY + 2.6, H - 2.4, 0.8));
    place(b.led[0], F(WD - 5.5, H / 2));
    place(b.led[1], F(WD - 9.5, H / 2));
  }

  /** The loose cable: out of the broken blade's port, drooping in front of the blades below, its plug hanging free. */
  function drawCable(now) {
    const o = tval(blades[BRK].o, now), [px, py] = xf(o, YAW, 0, PY), pz = BRK * U + H / 2;
    let below = 0;
    for (let i = 1; i < BRK; i++) below = Math.max(below, tval(blades[i].o, now));
    const xb = Math.max(px + 5, below + 4), Q = [[px, py, pz], [px + 7, py, pz - 1], [xb + 1, py - 3, pz - 13], [xb, py - 5, pz - 21]];
    const pts = [];
    for (let k = 0; k <= 16; k++) {
      const t = k / 16, w = [(1 - t) ** 3, 3 * t * (1 - t) ** 2, 3 * t * t * (1 - t), t ** 3];
      pts.push(P(...[0, 1, 2].map((a) => w.reduce((s, wk, j) => s + wk * Q[j][a], 0))));
    }
    cable.setAttribute("d", open(pts));
    const [ex, ey, ez] = Q[3];
    plug.setAttribute("d", poly(rrect(ey - 1.7, ez - 5.5, ey + 1.7, ez, 0.8, 3).map((q) => P(ex, q.u, q.v))) +
      seg(P(ex, ey - 0.8, ez - 5.5), P(ex, ey - 0.8, ez - 7)) + seg(P(ex, ey + 0.8, ez - 5.5), P(ex, ey + 0.8, ez - 7)));
  }

  let cabled = NaN;
  const B = register(stage, (_dt, now) => {
    let moving = false;
    for (const b of blades) {
      const o = tval(b.o, now);
      if (o !== b.drawn) { b.drawn = o; drawBlade(b, o); }
      if (!tdone(b.o, now)) moving = true;
    }
    const key = blades.slice(1, BRK + 1).map((b) => b.drawn).join();
    if (key !== cabled) { cabled = key; drawCable(now); }
    return moving;
  });
  bag.add(B.unregister);

  // Faces nearest the viewer first: the broken blade's rest face sits out in front of the rest.
  const ORDER = blades.map((b) => b.i).sort((a, c) => REST[c] - REST[a]);
  function hit([sx, sy]) {
    const t = unproj(C, sx, sy, BRK * U + H);
    if (t[0] > 0.5 && t[0] < BO && t[1] > 0 && t[1] < WD) return BRK;
    const a = unproj(C, sx, sy, 0), b = unproj(C, sx, sy, 1);
    for (const i of ORDER) {
      const z = (REST[i] - a[0]) / (b[0] - a[0]), y = a[1] + (b[1] - a[1]) * z;
      if (z > i * U - 0.6 && z < i * U + H + 0.6 && y > -5 && y < WD + 5) return i;
    }
    return -1;
  }

  let act = -2;
  /** Pulls blade a out (-1 lets go); the neighbours follow a little, spreading out from it. */
  function setActive(a) {
    if (a === act) return;
    const now = performance.now(), from = a >= 0 ? a : act;
    act = a;
    blades.forEach((b, i) => {
      const d = Math.abs(i - from);
      let to = REST[i];
      if (a >= 0 && i === a) to = b.br ? BO + out * 0.5 : out;
      else if (a >= 0 && d <= 2) to = REST[i] + clamp(out * 0.2 * 0.45 ** (d - 1), 0, 6);
      tset(b.o, to, now, d * STEP);
      b.el.sil.classList.toggle("hi", i === a);
      if (!b.br) { b.led[0].classList.toggle("m", i !== a); b.led[1].classList.toggle("off", i !== a); }
    });
    blades[BRK].led[0].classList.toggle("m", a >= 0 && a !== BRK);
    read.textContent = a < 0 ? "rest" : `u${a + 1} ${a === BRK ? "down" : "ok"}`;
    B.wake();
  }
  setActive(-1);

  bag.add(pointer(stage, { move: (p) => setActive(hit(p)), leave: () => setActive(-1) }));
  bag.add(() => svg.replaceChildren());

  return {
    set: (v) => {
      out = v;
      if (act >= 0) { const a = act; act = -2; setActive(a); }
    },
    destroy: bag.dispose,
  };
}

export default {
  name: "server",
  means: "A server rack with one blade pulled out askew: the pointer picks a blade, and it slides out like a drawer.",
  rules: [1, 2, 5, 6],
  range: [16, 24, 32],
  mount,
};
