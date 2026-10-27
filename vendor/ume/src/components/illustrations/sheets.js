/**
 * Sheets: seven ledger sheets stacked on a clipboard, and the newest sheet
 * floating just above them, its dashed drop guides falling to where it lands.
 * The pointer's x scrubs the gap between the sheets on one spring; its y picks
 * a sheet, which takes the bright edge. Each sheet is ruled like a ledger page
 * and has one corner folded over, so it reads as paper. At rest the stack is
 * slightly exploded and the new sheet is bright. The slider is the widest gap.
 *
 * The pattern: scrub and pick. A spring for the gap; the pick reads the
 * spring's target, never its position, so a sheet moving under a still pointer
 * cannot flip the choice.
 */
import HL from "./hairline-kernel.js";

const {
  Cam, clamp, fillet, fit, hull, lerp, open, poly, proj, prism, rings, ringAt, rrect, run, seg,
  facing, spring, stepS, disposer, mk, pointer, put, register, solid,
} = HL;

const N = 7, W = 72, D = 92, T = 1.2, F = 16, AIR = 18, GMIN = 1.6, GMAX = 12, REST = 0.36;
const BX0 = -8, BY0 = -40, BX1 = W + 8, BY1 = D + 8, BH = 4, CX = W / 2;
const ROWS = [22, 32, 42, 52, 62, 72, 82], COLS = [16, W - 22], HEAD = 12;

/** The sheet's outline, a ledger page with its nearest corner folded over; four samples a vertex. */
const OUT = fillet([[0, 0], [W, 0], [W, D - F], [W - F, D], [0, D]], [2, 2, 1, 1, 2], 3);
const FLAP = fillet([[W, D - F], [W - F, D], [W - F, D - F]], [1, 1, 1.6], 3);

/** Sheet paths at height z: the opaque body, its thickness, the ruling, the fold and the silhouette. */
function sheet(P, z) {
  const zt = z + T, at = (p, h) => P(p[0], p[1], h);
  const top = OUT.map((p) => at(p, zt)), bot = OUT.map((p) => at(p, z));
  const body = poly(hull(top.concat(bot)));
  const xEnd = (y) => Math.min(W - 6, W + D - F - y - 2);
  return {
    body,
    edge: open(top.slice(5, 19)),
    rules: ROWS.map((y) => seg(P(6, y, zt), P(xEnd(y), y, zt))).join("") +
      COLS.map((x) => seg(P(x, HEAD, zt), P(x, D - 6, zt))).join(""),
    head: seg(P(6, HEAD, zt), P(W - 6, HEAD, zt)),
    flap: poly(FLAP.map((p) => at(p, zt))),
  };
}

function mount({ stage, svg, read }, value) {
  const bag = disposer();
  let G = value;
  const ZMAX = N * GMAX + AIR + T;
  const C = Cam(45, 0.5, 1.62);
  fit(C, [[BX0, BY0, -BH], [BX1, BY1, -BH], [BX1, BY0, -BH], [BX0, BY1, -BH], [0, 0, ZMAX], [W, 0, ZMAX], [0, D, ZMAX]], 200, 166);
  const P = proj(C), front = facing(C);
  const g = mk("g", {}, svg);

  // The board, then its clip at the far edge: the spring bar behind, the clip body pressing down in front of it.
  const [br, bi] = rings(BX0, BY0, BX1, BY1, 7, 2);
  put(solid(g), prism(P, front, br, bi, -BH, 0));
  const [sr, si] = rings(CX - 27, -37, CX + 27, -30, 3.2, 0.8);
  put(solid(g), prism(P, front, sr, si, 0, 6.5));
  const foot = rrect(CX - 22, -35, CX + 22, -10, 4, 4), lid = rrect(CX - 20, -35, CX + 20, -21, 3, 4);
  const inner = rrect(CX - 18.8, -33.8, CX + 18.8, -22.2, 1.8, 4);
  put(solid(g), {
    sil: poly(hull(ringAt(P, foot, 0).concat(ringAt(P, lid, 11)))),
    crease: open(ringAt(P, run(inner, front), 11)),
  });

  // Seven sheets bottom to top, then the new sheet's guides, then the new sheet: back to front.
  const sheets = [];
  let guides = null;
  for (let i = 0; i <= N; i++) {
    if (i === N) guides = mk("path", { class: "dash" }, g);
    const grp = mk("g", {}, g), nw = i === N ? " c-violet" : "";
    // the new sheet carries the brand violet: a soft tint, its outline and its header rule
    sheets.push({
      body: mk("path", { class: "fo" + nw + (nw && " tint") }, grp),
      edge: mk("path", { class: "nf lo" }, grp),
      rules: mk("path", { class: "nf lo" }, grp),
      head: mk("path", { class: "nf" + nw }, grp),
      flap: mk("path", {}, grp),
      sil: mk("path", { class: "nf sil" + nw }, grp),
    });
  }

  const gap = spring(G * REST, { eps: 0.01 });
  const zOf = (i, gp) => (i < N ? i * gp : N * gp + AIR);
  let drawn = NaN;
  function draw() {
    if (gap.x === drawn) return;
    drawn = gap.x;
    sheets.forEach((s, i) => {
      const q = sheet(P, zOf(i, gap.x));
      for (const k of ["edge", "rules", "head", "flap"]) s[k].setAttribute("d", q[k]);
      s.body.setAttribute("d", q.body);
      s.sil.setAttribute("d", q.body);
    });
    // drop guides from the new sheet's left, right and folded corners to where it will land
    const zn = zOf(N, gap.x), zl = N * gap.x + T;
    guides.setAttribute("d", [[0, D], [W, 0], [W - F / 2, D - F / 2]].map(([x, y]) => seg(P(x, y, zn), P(x, y, zl))).join(""));
  }

  const B = register(stage, (dt) => { const m = stepS(gap, dt); draw(); return m; });
  bag.add(B.unregister);

  // Hit test: the near edge of every sheet, at the gap's TARGET. The pointer's height above the
  // footprint's near boundary, in world z, says which sheet's visible strip it is over.
  const zU = P(0, 0, 0)[1] - P(0, 0, 1)[1];
  const L0 = P(0, D, 0), N0 = P(W, D, 0), R0 = P(W, 0, 0);
  function nearY(sx) {
    if (sx <= N0[0]) return lerp(L0[1], N0[1], clamp((sx - L0[0]) / (N0[0] - L0[0]), 0, 1));
    return lerp(N0[1], R0[1], clamp((sx - N0[0]) / (R0[0] - N0[0]), 0, 1));
  }
  function pick([sx, sy], gt) {
    const h = (nearY(sx) - sy) / zU;
    let a = 0;
    for (let i = 0; i <= N; i++) if (zOf(i, gt) <= h + 0.5) a = i;
    return a;
  }

  let act = -1, over = null;
  function show(a) {
    const lit = a < 0 ? N : a;
    sheets.forEach((s, i) => { s.sil.classList.toggle("hi", i === lit); });
    read.textContent = a < 0 ? "rest" : a === N ? "new" : `sheet ${a + 1}`;
  }
  function retarget() {
    if (over) gap.t = lerp(GMIN, G, clamp((over[0] - 80) / 240, 0, 1));
    else gap.t = G * REST;
    const a = over ? pick(over, gap.t) : -1;
    if (a !== act) { act = a; show(a); }
    B.wake();
  }
  show(-1);

  bag.add(pointer(stage, {
    move: (p) => { over = p; retarget(); },
    leave: () => { over = null; retarget(); },
  }));
  bag.add(() => svg.replaceChildren());

  return {
    set: (v) => { G = v; retarget(); },
    destroy: bag.dispose,
  };
}

export default {
  name: "sheets",
  means: "Ledger sheets on a clipboard, the newest one dropping in: x spreads the stack, y picks a sheet.",
  rules: [1, 5, 6, 8],
  range: [6, 9, 12],
  mount,
};
