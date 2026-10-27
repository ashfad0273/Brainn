/* Ume, the Squidx design system (github.com/withsaber/ume), lives in
   vendor/ume: a read-only copy of its packages/ui at one commit. The app
   imports it as @ume/ui/* (vite.config.ts, tsconfig). Installed from ume's
   templates/app; see ume's packages/ui/docs/install.md.

     node scripts/ume.mjs sync               # copy ume's main
     node scripts/ume.mjs sync --ref <sha>   # copy one commit
     node scripts/ume.mjs check              # fail if the copy was edited

   sync reads ume through `gh` (your login locally, UME_TOKEN in the
   ume-sync workflow) and records the commit and a hash of every file in
   vendor/ume/UME_SOURCE.json. check (part of `npm run check`) recomputes the
   hash: a change to Ume goes in ume, never here. It also checks that the app
   depends on every package Ume needs. */

import { execFileSync } from "node:child_process"
import { createHash } from "node:crypto"
import { cpSync, existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join, relative } from "node:path"

const REPO = "withsaber/ume"
const VENDOR = "vendor/ume"
const SOURCE = join(VENDOR, "UME_SOURCE.json")
/* What an app gets from packages/ui: the code, the icons, the rules. Not
   ume's own scripts or its Icon Studio config (the studio runs on ume). */
const KEEP = ["src", "vite", "design", "docs", "package.json"]

function files(dir) {
  return readdirSync(dir)
    .flatMap((name) => {
      const p = join(dir, name)
      return statSync(p).isDirectory() ? files(p) : [p]
    })
    .sort()
}

function hashOf(dir) {
  const h = createHash("sha256")
  for (const f of files(dir)) {
    const rel = relative(dir, f).split("\\").join("/")
    if (rel === "UME_SOURCE.json") continue
    h.update(rel).update("\0").update(readFileSync(f)).update("\0")
  }
  return h.digest("hex")
}

function sync(ref) {
  const gh = (args, opts = {}) => execFileSync("gh", args, { encoding: "utf8", ...opts })
  const commit = gh(["api", `repos/${REPO}/commits/${ref}`, "-q", ".sha"]).trim()
  const tmp = mkdtempSync(join(tmpdir(), "ume-"))
  try {
    const tar = join(tmp, "ume.tar.gz")
    writeFileSync(tar, execFileSync("gh", ["api", `repos/${REPO}/tarball/${commit}`], { maxBuffer: 1 << 28 }))
    execFileSync("tar", ["-xzf", tar, "-C", tmp])
    const root = readdirSync(tmp).find((d) => d !== "ume.tar.gz")
    const pkg = join(tmp, root, "packages/ui")
    rmSync(VENDOR, { recursive: true, force: true })
    for (const name of KEEP) if (existsSync(join(pkg, name))) cpSync(join(pkg, name), join(VENDOR, name), { recursive: true })
  } finally {
    rmSync(tmp, { recursive: true, force: true })
  }
  writeFileSync(SOURCE, JSON.stringify({ repo: REPO, commit, hash: hashOf(VENDOR) }, null, 2) + "\n")
  console.log(`Ume @ ${commit.slice(0, 7)} copied to ${VENDOR}.`)
}

function check() {
  const problems = []
  if (!existsSync(SOURCE)) {
    problems.push(`${SOURCE} is missing: run node scripts/ume.mjs sync`)
  } else {
    const { commit, hash } = JSON.parse(readFileSync(SOURCE, "utf8"))
    if (hashOf(VENDOR) !== hash) {
      problems.push(
        `${VENDOR} differs from ume @ ${commit.slice(0, 7)}. Make the change in ume, then run node scripts/ume.mjs sync.`,
      )
    }
    const needs = JSON.parse(readFileSync(join(VENDOR, "package.json"), "utf8")).dependencies ?? {}
    const has = JSON.parse(readFileSync("package.json", "utf8")).dependencies ?? {}
    for (const name of Object.keys(needs)) if (!has[name]) problems.push(`Ume needs ${name}: add it to dependencies`)
  }
  if (problems.length) {
    console.error(`check-ume: ${problems.length} problem(s):\n`)
    for (const p of problems) console.error(`  ${p}`)
    process.exit(1)
  }
  console.log(`check-ume: ${VENDOR} matches ume.`)
}

const [cmd, ...rest] = process.argv.slice(2)
if (cmd === "sync") {
  const i = rest.indexOf("--ref")
  sync(i >= 0 ? rest[i + 1] : "main")
} else if (cmd === "check") {
  check()
} else {
  console.error("usage: node scripts/ume.mjs sync [--ref <commit>] | check")
  process.exit(2)
}
