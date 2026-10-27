/**
 * Drawer: a filing cabinet, its top drawer pulled open. Nine places for hanging files run front to back, each folder
 * hooked on the rails by its rod, a tab at its left, middle or right; one place is empty, a dashed outline where it hung.
 * The pointer picks a place: a glass glides over it and that folder lifts out, its neighbours parting, staggered outwards.
 * Over the gap nothing lifts. At rest the glass waits over the gap, its rim the bright mark, and the folders either side
 * swing into it. The slider is the stagger, in ms.
 */
import HL from "./hairline-kernel.js";

const {
  Cam, circ, clamp, facing, fillet, fit, hull, open, poly, prism, proj, rad, ringAt, rings, rrect, run, seg,
  tdone, tset, tval, tween, disposer, mk, pointer, put, register, solid,
} = HL;

const N = 9, GAP = 3, G = 5, CW = 44, CD = 50, CH = 72, ZS = 36;                       // places; the cabinet: width, depth, height, drawer split
const DX0 = 3.5, DX1 = CW - 3.5, WT = 1.4, ZB = 40, ZT = 65, YF = 98, FT = 2.5, PZ0 = 37.5, PZ1 = 69; // the open drawer, its front panel
const FX0 = 7.5, FW = 29, FH = 20, HB = 2.4, RB = 1.6, TW = 8.5, TH = 4.5, TABS = [1.2, 10.25, 19.3], TK = 0.9;
const ZTF = ZT + RB, LIFT = 16, SHIFT = 1.4, ZL = 92, RO = 11, RW = 3, RT = 2.4;          // the folders' top; the lift; the glass
const HUES = ["sky", "teal", "amber", "sky", "amber", "teal", "sky", "teal", "amber"];
const LEAN = (i) => (i === GAP - 1 ? 9 : i === GAP + 1 ? -7 : i < GAP ? 2 : -1.5);       // rest: the folders swing into the gap
const yAt = (i) => CD + 4 + i * G, t0At = (i) => TABS[(N - 1 - i) % 3];
const aim = (i) => over(FX0 + t0At(i) + TW / 2, yAt(i), ZTF + TH / 2 + (i === GAP ? 0 : LIFT)); // the lens frames the tab
/** The glass centre, on its plane, that sits on screen over the world point (x, y, z): exact for the 45° 2:1 camera. */
const over = (x, y, z) => [x + 1.2247 * (ZL - z), y + 1.2247 * (ZL - z)];

const area = (p) => p.reduce((s, a, k) => { const b = p[(k + 1) % p.length]; return s + a[0] * b[1] - b[0] * a[1]; }, 0);
const side = (p, q, s, sg) => sg * ((q[0] - p[0]) * (s[1] - p[1]) - (q[1] - p[1]) * (s[0] - p[0]));
const inside = (s, b) => { const sg = Math.sign(area(b)); return b.every((p, k) => side(p, b[(k + 1) % b.length], s, sg) >= 0); };
/** The convex polygon a, clipped to the convex polygon b. */
function clip(a, b) {
  const sg = Math.sign(area(b));
  for (let k = 0; k < b.length && a.length; k++) {
    const p = b[k], q = b[(k + 1) % b.length], src = a;
    a = [];
    src.forEach((s, m) => {
      const e = src[(m + 1) % src.length], fs = side(p, q, s, sg), fe = side(p, q, e, sg);
      if (fs >= 0) a.push(s);
      if ((fs >= 0) !== (fe >= 0)) { const t = fs / (fs - fe); a.push([s[0] + (e[0] - s[0]) * t, s[1] + (e[1] - s[1]) * t]); }
    });
  }
  return a;
}
/** A thin solid between two parallel faces, map(u, v, f) placing its outline on the back (f 0) or front face (f 1); with an inner ring, a ring whose hole stays open. */
function slab(map, outer, inner) {
  const at = (ring, f) => ring.map((q) => map(q.u, q.v, f));
  const oA = at(outer, 0), out = hull(oA.concat(at(outer, 1)));
  const r = { body: poly(out), crease: open(at(run(outer, (q) => inside(map(q.u, q.v, 1), oA)), 1)), wall: "" };
  if (inner) {
    const iA = at(inner, 0), hole = clip(at(inner, 1), iA);
    if (area(hole) * area(out) > 0) hole.reverse();
    r.body += poly(hole);
    r.wall = open(at(run(inner, (q) => !inside(map(q.u, q.v, 1), iA)), 1));
  }
  return r;
}

/** A hanging folder, upright in its own plane: body, the rod's hooks out at both ends, and a tab at t0. */
const outline = (t0) => fillet(
  [[0, 0], [FW, 0], [FW, FH - RB], [FW + HB, FH - RB], [FW + HB, FH], [t0 + TW, FH], [t0 + TW, FH + TH], [t0, FH + TH], [t0, FH], [-HB, FH], [-HB, FH - RB], [0, FH - RB]],
  [2.5, 2.5, 0.4, 0.5, 0.5, 0.6, 1.8, 1.8, 0.6, 0.5, 0.5, 0.4]);
const tabPlate = (t0) => fillet([[t0, FH], [t0 + TW, FH], [t0 + TW, FH + TH], [t0, FH + TH]], [0.01, 0.01, 1.8, 1.8]);

function mount({ stage, svg, read }, value) {
  const bag = disposer();
  let stag = value;
  const C = Cam(45, 0.5, 2.35);
  const ext = [[0, 0, 0], [CW, 0, 0], [0, CD, 0], [0, 0, CH], [CW, 0, CH], [0, YF + FT, PZ0], [CW, YF + FT, PZ0]];
  for (let i = 0; i < N; i++) {
    ext.push([FX0 - HB, yAt(i), ZTF + LIFT + TH], [FX0 + FW + HB, yAt(i), ZTF + LIFT + TH]);
    const [gx, gy] = aim(i);
    ext.push([gx - RO, gy, ZL + RT], [gx, gy - RO, ZL + RT], [gx + RO + 32, gy, ZL], [gx, gy + RO, ZL]);
  }
  fit(C, ext, 200, 166);
  const P = proj(C), front = facing(C);
  const g = mk("g", {}, svg);
  const block = (x0, y0, x1, y1, r, b, z0, z1) => { const [ring, inn] = rings(x0, y0, x1, y1, r, b); put(solid(g), prism(P, front, ring, inn, z0, z1)); };
  /** A drawer front's empty label holder and its pull, on the face plane y. */
  function fittings(y, lv, hz) {
    const onF = (ring) => poly(ring.map((q) => P(q.u, y, q.v))), cx = CW / 2;
    mk("path", { d: onF(rrect(cx - 6.5, lv - 2.6, cx + 6.5, lv + 2.6, 1.2, 4)), class: "nf" }, g);
    mk("path", { d: onF(rrect(cx - 5.6, lv - 1.7, cx + 5.6, lv + 1.7, 0.6, 3)), class: "nf lo" }, g);
    block(cx - 8, y, cx + 8, y + 2.2, 1, 0.4, hz - 1.5, hz + 1.5);
  }

  // The cabinet, its closed lower drawer, and the slot the top drawer came out of.
  block(0, 0, CW, CD, 3, 1.2, 0, CH);
  mk("path", { d: poly(rrect(1.2, ZS + 1, CW - 1.2, CH - 2.2, 1.5, 4).map((q) => P(q.u, CD, q.v))), class: "nf" }, g);
  block(1.2, CD, CW - 1.2, CD + 1.6, 1.2, 0.5, 2, ZS - 0.6);
  fittings(CD + 1.6, 28.5, 20);

  // The open drawer: its far half, the folders back to front (the gap a dashed outline in its place), its near wall.
  const outer = rrect(DX0, CD, DX1, YF, 2, 5), inner = rrect(DX0 + WT, CD + WT, DX1 - WT, YF - WT, 0.8, 4);
  mk("path", { d: poly(hull(ringAt(P, outer, ZB).concat(ringAt(P, outer, ZT)))), class: "sil" }, g);
  mk("path", { d: poly(ringAt(P, inner, ZT)), class: "nf" }, g);
  mk("path", { d: open(ringAt(P, run(inner, (q) => !front(q)), ZB + 1.5)), class: "nf lo" }, g);

  const fs = [];
  for (let i = 0; i < N; i++) {
    const t0 = t0At(i), shape = outline(t0);
    if (i === GAP) { mk("path", { d: poly(shape.map((p) => P(FX0 + p[0], yAt(i), ZTF - (FH - p[1])))), class: "nf dash c-rose" }, g); continue; }
    const grp = mk("g", {}, g), el = (cls) => mk("path", { class: cls }, grp);
    fs.push({ i, shape, tab: tabPlate(t0), back: el("lo"), body: el("fo"), tp: el("c-" + HUES[i] + " tint"), line: el("nf sil"), rod: el("nf lo"),
      ta: tween(LEAN(i)), tz: tween(0), ty: tween(0), drawn: "" });
  }

  const LR = (a) => (a[0][0] <= a[a.length - 1][0] ? a : a.slice().reverse());
  const iF = LR(ringAt(P, run(inner, front), ZT)), oT = LR(ringAt(P, run(outer, front), ZT)), oB = LR(ringAt(P, run(outer, front), ZB));
  mk("path", { d: poly([...iF, oT[oT.length - 1], ...oB.slice().reverse(), oT[0]]), class: "fo" }, g);
  mk("path", { d: open(oT), class: "nf lo" }, g); mk("path", { d: open(iF), class: "nf" }, g);
  mk("path", { d: open([oT[0], ...oB, oT[oT.length - 1]]), class: "nf sil" }, g);
  block(1.2, YF, CW - 1.2, YF + FT, 1.2, 0.5, PZ0, PZ1);
  fittings(YF + FT, 61.5, 53);

  // The glass, last and highest: rim, ferrule, grip.
  const lens = mk("g", {}, svg), part = (cls) => ({ body: mk("path", { class: cls }, lens), crease: mk("path", { class: "nf lo" }, lens) });
  const rim = part("sil c-violet"), wall = mk("path", { class: "nf lo" }, lens), fer = part("sil"), grip = part("sil");
  const home = aim(GAP), gx = tween(home[0]), gy = tween(home[1]);

  function drawFolder(f, th, lift, dy) {
    if (th + "," + lift + "," + dy === f.drawn) return;
    f.drawn = th + "," + lift + "," + dy;
    const s = Math.sin(rad(th)), c = Math.cos(rad(th)), y = yAt(f.i) + dy;
    // it swings on its rod: the top stays on the rails, the foot moves
    const w = (u, v, o) => P(FX0 + u, y + (FH - v) * s - o, ZTF + lift - (FH - v) * c);
    const d = poly(f.shape.map((p) => w(p[0], p[1], 0)));
    f.back.setAttribute("d", poly(f.shape.map((p) => w(p[0], p[1], TK))));
    f.body.setAttribute("d", d);
    f.tp.setAttribute("d", poly(f.tab.map((p) => w(p[0], p[1], 0))));
    f.line.setAttribute("d", d);
    f.rod.setAttribute("d", seg(w(0.6, FH - RB, 0), w(FW - 0.6, FH - RB, 0)));
  }
  let lensKey = "";
  function drawLens(cx, cy) {
    if (cx + "," + cy === lensKey) return;
    lensKey = cx + "," + cy;
    const flat = (z0, t) => (u, v, f) => P(u, v, z0 + f * t);
    const r = slab((u, v, f) => P(cx + u, cy + v, ZL + f * RT), circ(RO, 64), circ(RO - RW, 64));
    const fx = cx + RO - 0.4, hx = fx + 5.5;
    const fe = slab(flat(ZL - 0.7, RT + 1.4), rrect(fx, cy - 3.6, hx, cy + 3.6, 1, 3));
    const gr = slab(flat(ZL - 0.2, RT + 0.4), fillet([[hx, cy - 2.8], [hx + 26, cy - 3.2], [hx + 26, cy + 3.2], [hx, cy + 2.8]], [0.6, 3, 3, 0.6], 4).map((p) => ({ u: p[0], v: p[1] })));
    [[rim, r], [fer, fe], [grip, gr]].forEach(([el, q]) => { el.body.setAttribute("d", q.body); el.crease.setAttribute("d", q.crease); });
    wall.setAttribute("d", r.wall);
  }

  const B = register(stage, (_dt, now) => {
    let m = false;
    for (const f of fs) {
      drawFolder(f, tval(f.ta, now), tval(f.tz, now), tval(f.ty, now));
      if (!tdone(f.ta, now) || !tdone(f.tz, now) || !tdone(f.ty, now)) m = true;
    }
    drawLens(tval(gx, now), tval(gy, now));
    return m || !tdone(gx, now) || !tdone(gy, now);
  });
  bag.add(B.unregister);

  // Hit test: oblique bands along the places' RESTING top edges, as Riffle's. The folder lifted out also keeps the band
  // it was lifted into (its target pose), so the pointer can follow it up without falling to the folder behind.
  const top = (i) => P(FX0 + FW / 2, yAt(i), ZTF + TH / 2), c0 = top(0), c1 = top(1), dv = [c1[0] - c0[0], c1[1] - c0[1]];
  const px0 = P(0, 0, 0), px1 = P(1, 0, 0), ex = [px1[0] - px0[0], px1[1] - px0[1]];
  const det = dv[0] * ex[1] - dv[1] * ex[0], HALF = FW / 2 + HB + 4, Lh = px0[1] - P(0, 0, LIFT)[1];
  const sr = (x, y) => { const qx = x - c0[0], qy = y - c0[1]; return [(qx * ex[1] - qy * ex[0]) / det, (dv[0] * qy - dv[1] * qx) / det]; };
  let act = -1;
  function hit([x, y]) {
    for (let k = 0; act >= 0 && act !== GAP && k <= 6; k++) { const [s, r] = sr(x, y + (Lh * k) / 6); if (Math.abs(s - act) <= 0.5 && Math.abs(r) <= HALF) return act; }
    const [s, r] = sr(x, y);
    if (Math.abs(r) > HALF || s < -0.6 || s > N - 0.4) return -1;
    return clamp(Math.round(s), 0, N - 1);
  }

  function setActive(a) {
    if (a === act) return;
    const now = performance.now(), from = a >= 0 ? a : act >= 0 ? act : GAP, pick = a >= 0 && a !== GAP;
    act = a;
    for (const f of fs) {
      const d = Math.abs(f.i - from) * stag, on = pick && f.i === a, k = Math.abs(f.i - a);
      tset(f.tz, on ? LIFT : 0, now, d);
      tset(f.ta, pick ? 0 : LEAN(f.i), now, d);
      tset(f.ty, pick && !on ? Math.sign(f.i - a) * SHIFT * clamp(1 - (k - 1) / 3, 0, 1) : 0, now, d);
      f.line.classList.toggle("hi", on);
    }
    const tgt = pick ? aim(a) : home;
    tset(gx, tgt[0], now, 0); tset(gy, tgt[1], now, 0);
    rim.body.classList.toggle("hi", !pick);
    read.textContent = a < 0 ? "rest" : a === GAP ? "missing" : "file " + String(N - a).padStart(2, "0");
    B.wake();
  }

  bag.add(pointer(stage, { move: (p) => setActive(hit(p)), leave: () => setActive(-1) }));
  bag.add(() => svg.replaceChildren());
  rim.body.classList.add("hi"); read.textContent = "rest";
  B.wake();
  return { set: (v) => { stag = v; }, destroy: bag.dispose };
}

export default {
  name: "drawer",
  means: "A glass searches an open file drawer: the folder it finds lifts out, and one place, where a file hung, is empty.",
  rules: [1, 2, 4, 6],
  range: [0, 45, 90],
  mount,
};
