/**
 * Inline: a cast inline-four on an engine stand. Four bores open in the head,
 * a piston crown in each, a spark plug standing out of the rocker cover over
 * each, its lead running back to the loom. A crank pulley closes one end and
 * the exhaust manifold runs down the near side. Cylinder 3 is dead: its lead
 * is off and lies on the deck, its bare plug tip is the rest mark. The pointer
 * picks a cylinder: it fires, its piston kicks up and its plug flashes, and
 * the firing ripples outwards to its neighbours, staggered, but it dies at the
 * dead cylinder, so the engine never catches. The slider is the stagger.
 *
 * The pattern: one of many. A tween per piston, a stagger by distance, and a
 * hit test on the row's rest line, which never moves.
 */
import HL from "./hairline-kernel.js";

const {
  Cam, circ, clamp, facing, fit, hull, open, poly, proj, prism, ringAt, rings, rrect, run,
  tween, tset, tval, tdone, disposer, flatDot, mk, place, pointer, put, register, solid,
} = HL;

const N = 4, PITCH = 28, L = N * PITCH, XC = (i) => 14 + i * PITCH, DEAD = 2;
const DECK = 44, BY = 5, BORE = 8.4, PIST = 7.2, COV = 51, PY = -11, LOOM = -15.5;
const REST = [6.5, 2.2, 0.6, 4.6], KICK = 12;
const AX = { z: (u, v, w) => [u, v, w], x: (u, v, w) => [w, u, v], y: (u, v, w) => [u, w, v] };

function mount({ stage, svg, read }, value) {
  const bag = disposer();
  let stag = value;

  const C = Cam(45, 0.5, 1.72);
  fit(C, [[-10, -28, -3], [L + 16, 36, -3], [L + 16, -28, -3], [-10, 36, -3], [XC(0), PY, 74], [XC(3), BY, DECK + 26], [XC(0), BY - 8, DECK + 28]], 200, 166);
  const P = proj(C), front = facing(C);
  // the direction toward the camera, for solids lying along x or y
  const o = P(0, 0, 0), a = P(1, 0, 0).map((c, k) => c - o[k]), b = P(0, 1, 0).map((c, k) => c - o[k]), d = P(0, 0, 1).map((c, k) => c - o[k]);
  let V = [b[0] * d[1] - d[0] * b[1], d[0] * a[1] - a[0] * d[1], a[0] * b[1] - b[0] * a[1]];
  V = V[2] < 0 ? V.map((c) => -c) : V;

  /** A solid standing along axis ax from c: prism() in a turned frame, or a top smaller than its foot. */
  function body(ax, c, ring, inner, w0, w1, top) {
    const m = AX[ax];
    const Pf = (u, v, w) => { const q = m(u, v, w); return P(c[0] + q[0], c[1] + q[1], c[2] + q[2]); };
    const fr = (s) => { const n = m(s.nu, s.nv, 0); return n[0] * V[0] + n[1] * V[1] + n[2] * V[2] > 0; };
    if (top) return { sil: poly(hull(ringAt(Pf, ring, w0).concat(ringAt(Pf, top, w1)))), crease: open(ringAt(Pf, run(inner, fr), w1)) };
    return prism(Pf, fr, ring, inner, w0, w1);
  }
  const cyl = (R, bb, n = 28) => [circ(R, n), circ(R - bb, n)];
  const g = mk("g", {}, svg);
  const add = (paths, cls) => { const s = solid(g); put(s, paths); if (cls) s.sil.classList.add(...cls.split(" ")); return s; };
  /** A lead: a quadratic curve between two world points, sagging or arching through q. */
  const curve = (A, q, B) => Array.from({ length: 15 }, (_, k) => {
    const t = k / 14, u = 1 - t;
    return P(...[0, 1, 2].map((j) => u * u * A[j] + 2 * u * t * q[j] + t * t * B[j]));
  });

  // The stand: a plate and two pedestals the block is bolted to.
  const [pr, pi] = rings(-10, -28, L + 16, 36, 8, 2);
  add(prism(P, front, pr, pi, -3, 0));
  for (const x0 of [3, L - 21]) { const [r, n] = rings(x0, -25, x0 + 18, 25, 4, 1); add(prism(P, front, r, n, 0, 8)); }
  // The block, cast: its top a little smaller than its foot; then the head over it, a gasket's step proud.
  add(body("z", [0, 0, 0], rrect(0, -20, L, 20, 6, 4), rrect(3.4, -16.6, L - 3.4, 16.6, 3.6, 4), 8, 36, rrect(2, -18, L - 2, 18, 5, 4)));
  const [hr, hi] = rings(1, -19, L - 1, 19, 5, 1.4);
  add(prism(P, front, hr, hi, 36, DECK));
  // head bolts along the near edge of the deck, between the bores
  for (let k = 0; k <= N; k++) place(flatDot(g, C, 0.85, "dot off"), P(k * PITCH, 15.6, DECK));
  // The rocker cover: a band along the top, the brand's touch.
  const [cr, ci] = rings(4, -17, L - 4, -6, 4.5, 1.2);
  add(prism(P, front, cr, ci, DECK, COV), "c-violet tint");
  // the loom rail the leads run back to, lying along the cover's far side
  const [m1, m2] = cyl(1.4, 0.4, 14), RZ = COV + 1.4;
  add(body("x", [5, LOOM, RZ], m1, m2, 0, L - 10));

  const cyls = [];
  const [n1, n2] = cyl(3.2, 0.8, 20), [i1, i2] = cyl(2, 0.6, 18), [t1, t2] = cyl(1.2, 0.4, 14), [b1, b2] = cyl(2.6, 0.7, 18);
  for (let i = 0; i < N; i++) {
    const x = XC(i), pc = [x, PY, COV], dead = i === DEAD;
    // the plug: a hex seat, a long insulator, a terminal
    add(body("z", pc, n1, n2, 0, 2.6));
    add(body("z", pc, i1, i2, 2.6, 11), dead ? "c-rose" : "");
    add(body("z", pc, t1, t2, 11, 14));
    let boot = null, spark;
    if (!dead) {
      // a live lead: the boot pressed over the terminal, the lead arching back to the loom
      mk("path", { class: "nf", d: open(curve([x, PY, COV + 15], [x - 3, PY - 1, COV + 25], [x - 9, LOOM, RZ + 1.2])) }, g);
      boot = add(body("z", pc, b1, b2, 8.5, 15.5));
      spark = mk("circle", { r: 1.5, class: "dot off" }, g);
      place(spark, P(x, PY, COV + 15.9));
    } else {
      // the dead lead: off its plug, over the cover, across the deck and hanging down the side, its boot dangling
      const E = [x + 14.5, 21.6, DECK - 6], D0 = [x + 12, 1, DECK + 0.4];
      boot = { sil: mk("path", { class: "nf c-rose", d: open(curve([x + 5, LOOM, RZ + 1.2], [x + 10, -8, COV + 11], D0).concat(curve(D0, [x + 14, 20.5, DECK + 0.4], E))) }, g) };
      add(body("z", [E[0], E[1], 0], b1, b2, DECK - 12, DECK - 5.5), "c-rose tint");
      spark = mk("circle", { r: 1.7, class: "dot c-rose" }, g);
      place(spark, P(x, PY, COV + 14.5));
    }
    cyls.push({ x, dead, boot, spark, tw: tween(REST[i]), drawn: NaN, lit: false });
  }
  // The bores and their pistons, far to near: the bore, then the crown standing out of it, with its ring grooves.
  const [pr1, pr2] = cyl(PIST, 1, 32), bore = circ(BORE, 32);
  for (const c of cyls) {
    mk("path", { class: "lo", d: poly(ringAt(P, bore.map((q) => ({ ...q, u: q.u + c.x, v: q.v + BY })), DECK)) }, g);
    c.pis = solid(g);
    c.groove = mk("path", { class: "nf lo" }, g);
  }
  function drawPiston(c, h) {
    if (h === c.drawn) return;
    c.drawn = h;
    put(c.pis, body("z", [c.x, BY, DECK], pr1, pr2, 0, h));
    const at = (z) => open(ringAt((u, v, w) => P(c.x + u, BY + v, DECK + w), run(pr1, front), z));
    c.groove.setAttribute("d", (h > 3.6 ? at(h - 1.9) : "") + (h > 5.4 ? at(h - 3.6) : ""));
  }
  // The crank pulley at the near end: two rims round a belt groove, and its hub.
  const [r1, r2] = cyl(15, 1.4, 44), [g1, g2] = cyl(12.6, 1, 40), pz = [L, 0, 22];
  add(body("x", pz, r1, r2, 0, 2.2));
  add(body("x", pz, g1, g2, 2.2, 4.4));
  add(body("x", pz, r1, r2, 4.4, 6.6));
  mk("path", { class: "nf", d: [4.2, 1.7].map((R) => poly(circ(R, 20).map((q) => P(L + 6.6, q.u, 22 + q.v)))).join("") }, g);
  // The exhaust manifold down the near side, in the hot orange: four runners into a log, and a downpipe.
  const [x1, x2] = cyl(3, 0.6, 20), [l1, l2] = cyl(4.6, 1, 28), [d1, d2] = cyl(3.4, 0.7, 20);
  for (let i = 0; i < N; i++) {
    add(body("z", [XC(i), 29, 0], x1, x2, 26, 40), "c-orange tint");
    add(body("y", [XC(i), 0, 40], x1, x2, 19, 32), "c-orange tint");
  }
  add(body("z", [L - 8, 31, 0], d1, d2, 10, 26), "c-orange tint");
  add(body("x", [6, 31, 26], l1, l2, 0, L - 10), "c-orange tint");

  const kickOf = (i, act) => (act < 0 || act === DEAD || (i - DEAD) * (act - DEAD) <= 0 ? 0 : KICK * Math.max(0.45, 1 - 0.28 * Math.abs(i - act)));
  let act = -1;
  const B = register(stage, (_dt, now) => {
    let moving = false;
    cyls.forEach((c, i) => {
      const h = tval(c.tw, now), k = kickOf(i, act);
      drawPiston(c, h);
      // the plug flashes once its piston is past half its kick
      const lit = k > 0 && h - REST[i] > k * 0.5;
      if (lit !== c.lit && !c.dead) {
        c.lit = lit; c.spark.setAttribute("class", lit ? "dot c-amber" : "dot off");
        c.pis.sil.classList.toggle("c-amber", lit); c.pis.sil.classList.toggle("tint", lit);
      }
      if (!tdone(c.tw, now)) moving = true;
    });
    return moving;
  });
  bag.add(B.unregister);

  // Hit test: the pointer's place along the row's rest line, from bore 1 to bore 4. It never moves.
  const s0 = P(XC(0), BY, DECK), s1 = P(XC(N - 1), BY, DECK);
  function hit([px, py]) {
    const dx = s1[0] - s0[0], dy = s1[1] - s0[1], l2 = dx * dx + dy * dy, qx = px - s0[0], qy = py - s0[1];
    const t = ((qx * dx + qy * dy) / l2) * (N - 1), off = Math.abs(qx * dy - qy * dx) / Math.sqrt(l2);
    return t < -0.7 || t > N - 0.3 || off > 58 ? -1 : clamp(Math.round(t), 0, N - 1);
  }
  function setActive(n) {
    if (n === act) return;
    const now = performance.now(), from = n >= 0 ? n : act;
    act = n;
    cyls.forEach((c, i) => {
      tset(c.tw, REST[i] + kickOf(i, n), now, Math.abs(i - from) * stag);
      c.pis.sil.classList.toggle("hi", i === n);
      c.boot.sil.classList.toggle("hi", i === n);
    });
    // the dead plug's bare tip is the rest mark; it gives it up to a live choice
    cyls[DEAD].spark.setAttribute("class", n < 0 || n === DEAD ? "dot c-rose" : "dot off");
    read.textContent = n < 0 ? "rest" : n === DEAD ? "dead" : `cyl ${n + 1}`;
    B.wake();
  }

  bag.add(pointer(stage, { move: (p) => setActive(hit(p)), leave: () => setActive(-1) }));
  bag.add(() => svg.replaceChildren());
  read.textContent = "rest";

  return {
    set: (v) => { stag = v; },
    destroy: bag.dispose,
  };
}

export default {
  name: "inline",
  means: "An inline-four on a stand: pick a cylinder and it fires, the firing ripples outward, and dies at the dead one.",
  rules: [1, 2, 5, 8],
  range: [20, 50, 90],
  mount,
};
