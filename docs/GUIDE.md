# Rahman 3D Interior — Working Guide

One doc: project status, how to add a 3D model (Blender → scene), the model/data
contract, and ship/ops discipline. Overview + code layout live in `README.md`.

**Live:** https://interior.rahmanef.com · Convex Cloud prod `veracious-rooster-179`
· deploy = push `main` → Dokploy webhook builds the Docker image.

---

## 1. Status

Positioning is **Option A — honest 3D-walkthrough showcase, not a firm.** Home copy
(hero, Experience/About/How-it-works) presents an interactive three.js walkthrough by
Rahman; no fabricated clients/commissions. Tagline "Apartment Walkthroughs"
everywhere.

**Shipped (don't rebuild):**
- `/` marketing page + header auth (email+password, Convex Auth); `/tour` walkthrough;
  `/gallery` super-admin-curated grid; `/privacy` + `/terms`; `/healthz`.
- Guest localStorage persistence; cloud save/share (`/tour?p=<uuid slug>`); GLB upload
  (client budgets + server size/magic gate); rate limits; orphan-GLB GC cron.
- Named saves, delete/rename, daylight switcher, shared-view badge + "Save a copy",
  reduced-motion gate, escape nav, "Try a sample" model picker.
- **House samples with deep links.** `/tour?demo=<key>` opens a bundled sample
  directly; `/gallery` links to one, so the gallery is never empty before the first
  project is featured. Keys live in `SAMPLES` in `components/Walkthrough.jsx`.
- **`/editor` — the Edit half of Edit / Present.** Free viewport navigation with
  SketchUp's semantics, a CAD toolbar, a ViewCube, and camera Scenes authored by
  eye. Behind a sign-in wall. See §7.
- First-party analytics (Convex counters, no vendor/cookies), per-project OG cards,
  sitemap/robots, `npm run check` (runs the contract self-check).
- Super-admin camera tuner unlocked at runtime on `/tour` (email allowlist).

**Deliberately not built:** in-app hotspot editing (config + tuner cover it), `/work`
case studies (no real projects — would re-add fake facts), CMS/i18n/e-commerce/teams.

**Left — owner actions (not code):**
0. **Pin the super-admin role** (do this first — one command):
   `npx convex run --prod admin:pinSuperAdmin '{"email":"rahmanef63@gmail.com"}'`
   Until a pin exists, the role is granted by email allowlist alone — and sign-up is
   open with no email verification, so anyone who registers an allowlisted address
   first would inherit it. After pinning, the allowlist alone grants nothing.
   Check with `npx convex run --prod admin:listSuperAdmins '{}'`.
1. **Rotate the super-admin password** (old one was exposed in chat):
   `npx convex run --prod admin:adminResetPassword '{"email":"rahmanef63@gmail.com","newPassword":"<new-strong-pw>"}'`
   Resets in place (userId + projects preserved). The 5/hr throttle guards it meanwhile.
2. **Monitoring:** Dokploy → Notifications (build fail alert) + a free uptime monitor
   (UptimeRobot / Better Stack) on `/healthz` (add `?convex=1`, keyword `"convex":true`
   for backend outages).

---

## 2. Run it locally

```bash
npm install
npm run dev        # http://localhost:3000  (cloud features need NEXT_PUBLIC_CONVEX_URL)
npm run check      # assert-based contract self-check (round-trip + tamper cases)
npm run build      # contract check → convex deploy → next build
npm run build:next # frontend only, no backend push
```

### If the Dokploy build fails on the deploy key

The build now prints which sources it checked, before it fails:

```
── convex deploy key ──
   buildkit secret 'convex_deploy_key' : absent
   build arg CONVEX_DEPLOY_KEY        : absent
✗ CONVEX_DEPLOY_KEY is not set, but CONVEX_REQUIRE_DEPLOY=1.
```

Both absent means nothing reached the builder. In Dokploy, open the application →
**Environment** (newer versions have a separate **Build Args** field — use that if
present) and add:

```
CONVEX_DEPLOY_KEY=prod:<deployment>|<secret>
```

from Convex dashboard → Settings → Deploy keys → **Production**. The name must
match exactly. Redeploy; the same block should then read `present`.

**Escape hatch.** If the backend is already deployed and you only need the
frontend out, set `CONVEX_SKIP_DEPLOY=1` instead. The build then skips the Convex
push and says so loudly. It is safe only when the deployed backend already has
every function and table the frontend calls — which, after a release that adds a
Convex table, it does not.

**`npm run build` deploys the Convex backend.** `scripts/build.mjs` runs
`convex deploy --cmd 'npm run build:next' --cmd-url-env-var-name NEXT_PUBLIC_CONVEX_URL`,
so one command pushes the functions/schema and builds the frontend against the URL
that deploy key points at — the frontend can no longer be built against a different
deployment than the one just pushed to.

It branches on the environment:

| environment | behaviour |
|---|---|
| `CONVEX_DEPLOY_KEY` set | push backend + build frontend |
| not set, `CONVEX_REQUIRE_DEPLOY=1` (Docker) | **hard fail** — better than shipping a frontend against an un-pushed backend |
| not set, otherwise (local) | warn, build frontend only; URL falls back to `.env.production` |

`.env.production` carries only the public `NEXT_PUBLIC_CONVEX_URL` — never secrets.

**Still commit `convex/_generated/`.** `convex deploy --cmd` runs the build command
before it regenerates, so `next build` reads whatever is committed. After changing a
`convex/` function's signature, run `npx convex codegen` and commit — otherwise the
frontend builds against a stale API surface. What you no longer have to remember is
the deploy itself.

---

## 3. Add a 3D model (Blender → the scene)

The scene ships as three.js primitives (`src/lib/three/scene.js`). A real modeled
apartment **replaces** them at runtime: import hides the built-in architecture (reversible,
never deleted), keeps the camera path + hotspots, and — if you tag meshes — stays
concept-switchable.

### Two ways in

1. **Load it live (no code).** Open `/editor` (sign-in required), import your `.glb`, set
   the camera path, save it to the cloud and share it. This is the fast Blender iteration
   loop — `/tour` is the present half and carries no authoring tools.
2. **Bundle it as a sample.** Put the file in `public/models/` and add one row to
   `SAMPLES` in `src/components/Walkthrough.jsx`:
   ```js
   const SAMPLES = [
     { key: 'living-room', name: 'Living Room', glb: 'rahman-living-room.glb', project: 'rahman-living-room.json' },
     { key: 'my-room', name: 'My Blender Room', glb: 'my-blender-room.glb' },   // ← add
   ];
   ```
   It is then reachable at `/tour?demo=<key>` through the same upload gate.

**A third way, and the one the showroom uses:** describe the unit as data in
`src/config/units.js` and let `lib/three/apartment.js` build it. That tier is deliberately
low-detail — masses, not joinery — and exists so a unit can later be swapped for a Blender
bake without touching its camera path, rooms or hotspots. A unit's `content` object is
exactly the same shape as a saved project, so the swap is a `.glb` import, not a rewrite.

### Blender export checklist

*File → Export → glTF 2.0*, then:

- [ ] **Format: glTF Binary (.glb)** — one self-contained file, textures embedded. Not
      `.gltf` (it references external `.bin`/images that the app won't resolve → rejected).
- [ ] **+Y up** (Blender's default glTF option — leave it on). A Z-up export lands on its side.
- [ ] **Meters**, **origin at floor level** — the loader adds the model at identity, no
      re-orient, no scale. cm/inch arrives the wrong size.
- [ ] **Compression: Draco** (in the export panel) — geometry shrinks 5–10×, usually the
      difference between 25 MB and comfortably under the 10 MB cap. Or run
      `gltf-transform optimize in.glb out.glb` (meshopt + texture compression in one pass).
      Draco, KTX2/Basis and meshopt are **all** decoded by the viewer
      (`src/lib/three/glbLoader.js`); the decoders are self-hosted in `/public/draco`
      and `/public/basis` and only fetched when a compressed model actually arrives.
      *(Before that loader existed this checklist was a trap: it told you to compress,
      and the viewer then rejected the result with a raw three.js error.)*
- [ ] Textures **embedded, none external**; resize any side > 2048 px
      (`gltf-transform resize --width 2048 --height 2048 in.glb out.glb`).
- [ ] Consolidate materials to stay **≤ 16 textures**.

### Fit the scene's footprint

So the existing `config.waypoints` camera path and world-anchored hotspots still frame the
right things, author to the same envelope (three.js frame: right-handed, **Y-up, meters**):

- Footprint: L-shaped loft roughly `x: -5 … 19`, `z: -15 … 9`, `y: 0 … 3.4` (ceiling).
- Finished floor at **`y = 0`** (furniture rests `y > 0`).
- Room anchors: Living (0) `x≈-2, z≈-1` · Kitchen (1) `x≈12, z≈-1` · Bedroom (2) `x≈12, z≈-11`.

Different footprint? The model still loads — just re-author the path with the in-tour
**Camera Tuner** (⚙, super-admin) and **Copy config** back into `walkthrough.config.js`.

### Make it concept-switchable (optional)

Concept switching retargets materials grouped by `{ room, role }`. Tag meshes in Blender via
**custom properties** (glTF exports them to `extras`, which three reads as `userData`):

```js
mesh.userData = { room: 0|1|2, role: 'wall'|'rug'|'uph'|'wood'|'accent'|'metal'|'stone' }
```

On import the app reads each tagged mesh's current concept color, tints it, and registers it
so `chooseConcept` drives it exactly like a primitive. Untagged meshes render static (correct
for fixed architecture / glazing / props). Concept tweening lerps **only `material.color`**
(textures/normals kept), so give role-tagged surfaces a neutral/white base texture (or none)
so the tint reads true. One material per `{room, role}` cluster — clone shared materials so
one tag never drives another room.

---

## 4. Model limits (the trust boundary)

The uploader checks these on the client **before** your model touches the scene, and fails
closed. Three layers, and it is worth knowing which is which:

1. `contract.js` `MODEL_LIMITS` — the byte budget (**10 MB**), shared with the server.
2. `modelRules.js` `MODEL_RULES` + `validateModel` — extension (**`.glb` only**) and the
   per-model geometry/texture budget, after parsing.
3. `convex/projects.js attachGlb` — server-side re-check of the stored size **and** the
   `glTF` magic bytes. The magic sniff lives here, not in `contract.js`.

The effective user-facing rules:

| Rule | Limit | Kind |
|------|-------|------|
| File format | `.glb` only | **Reject** |
| File size | ≤ 10 MB | **Reject** |
| Triangles | ≤ 150,000 | **Reject** |
| Largest texture side | ≤ 2048 px | **Reject** |
| Texture count | ≤ 16 | **Reject** |
| Any limit past 80% used | — | **Warn** (still loads) |

Why they're strict: it's a **scroll-driven** scene — the whole model downloads up front and
the GPU redraws it every frame as the camera moves, so it must be small and light on a phone.
`gltf-transform optimize` usually clears every limit at once. Hard rejects block the import
and leave your current scene untouched; warnings (past 80%) just flag you're near a ceiling.

Import is **safe by construction**: GLB is inert data (geometry + materials + JSON, never
code), size-capped before parsing, parsed from an in-memory buffer with **no external URI
fetch** (no SSRF), and only the whitelisted `userData.{room,role}` tags influence anything —
and those only pick a palette color.

### From the `3d-model` Blender pipeline

The sibling `3d-model` repo bakes AO to an atlas and emits three JSON files. Two scripts
bridge it to this app:

| script | produces | how to use it |
|---|---|---|
| `blender_export_interior_app.py` | `interior_app.glb` | splits the baked mesh per material and writes `{room, role}` custom properties, so concept switching drives the imported model. Run it in Blender right after `bake_hybrid.py`. |
| `make_project_bundle.py` | `interior-project.json` | converts `camera_path.json` + `hotspots.json` + `concepts.json` into a contract bundle: the camera path and hotspots travel with the model, not just the geometry. |

Import the JSON first (**Import ·json**), then the GLB (**Import ·glb**).

Two details that bite if you skip them:

- Export with `export_extras=True` or the `{room, role}` tags never reach glTF `extras`,
  and the model loads but stays static under concept switching.
- Tag **per mesh**. The app reads `o.userData.room/role` and clones `o.material`; on a
  mesh merged across materials `o.material` is an array and the tag is ignored.

`gltf-transform` preserves node `extras`, so the usual `webp` + `meshopt` pass is safe
(verified: 4.5 MB → 587 KB with all 11 tags intact).

---

## 4b. Where the front-end code lives

`app/page.jsx` used to be ~1000 lines with every list written inline. The split:

| file | holds |
|---|---|
| `content/home.js` | every copy list on the marketing pages (nav, Experience, Concept Studies, About, How-it-works, footer links). **Edit copy here, not in JSX.** |
| `components/site/SiteNav.jsx` | the sticky header. `active` marks the current item, `onHome={false}` rewrites `#anchor` → `/#anchor`. Used by `/` and `/gallery`. |
| `components/site/SiteFooter.jsx` | the four-column footer + colophon row. |
| `components/site/SectionHead.jsx` | the "No. 02 · FIG. A" header block. |
| `components/site/PlanMotif.jsx` | the two decorative floor-plan SVGs. |
| `lib/ui/sheet.js` | `sheetX` (page margin), `serif`, `PAPER_MUTED`. |
| `lib/tokens.js` | brand colours + the `label` type style. |

**`content/home.js` imports the 3D config on purpose.** `CONCEPT_NAMES` and
`PLAN_NAMES` are derived from `config/walkthrough.config.js` so the home page can
never advertise a concept the tour does not have — and the module throws at load
time (i.e. the build fails) if `WORK` names a concept that is not in the config.

### Adding a house sample

1. Put `<name>.glb` in `public/models/` (and `<name>.json` if it carries its own
   camera path/hotspots — see §4).
2. Add an entry to `SAMPLES` in `components/Walkthrough.jsx`:
   `{ key: 'my-room', name: 'My Room', glb: 'my-room.glb', project: 'my-room.json' }`
3. `/tour?demo=my-room` now opens it. Add a tile to `HOUSE` in `app/gallery/page.jsx`
   if it should appear in the gallery.

A sample **with** a `project` swaps the whole walkthrough (waypoints, hotspots,
concepts) then loads the model; a bare one drops geometry into the current scene.
The default camera path is authored for the three-room loft, so a differently-shaped
model without a project will frame the wrong things.

---

## 5. Data contract (project bundles)

A **project** is the plain JSON that authors the walkthrough — no code. `SCHEMA_ID =
'rahman3d.walkthrough'`, contract `1.1.0`, defined in `src/lib/three/contract.js` (zero deps,
JSDoc types). `validateProject()` is the import trust boundary: **never throws**, fail-closed,
whitelist-normalizes to the 8 keys, and reports every error as a string. Cap: 4 MB JSON.

The 8 keys (canonical order):

```js
['config', 'CONCEPTS', 'ROOMS', 'PLAN', 'HOTSPOTS', 'ROOM_COLORS', 'DAYLIGHT', 'BRAND']
```

Editable per project in `src/config/walkthrough.config.js`:

| Key | Controls |
|-----|----------|
| `config` | camera `fov`, `intro` top-down pose, `waypoints[]` path (`{pos,look,room}`), and (1.1.0, optional) `concepts[]` — which scheme each room is showing |
| `CONCEPTS` | switchable schemes; each `pal` carries the 7 roles the geometry references |
| `ROOMS` | room names (drives nav + count) |
| `PLAN` | floor-plan label pins (intro) |
| `HOTSPOTS` | world-anchored material call-outs |
| `ROOM_COLORS` | per-room accent chips |
| `DAYLIGHT` | the Soft / Bright / Dusk lighting presets |
| `BRAND` | wordmark, tagline, colours |

**Cross-reference invariants** (a structurally-valid doc must still satisfy): every
`waypoint.room` / `HOTSPOTS[i].room` is an integer in `[0, ROOMS.length)`; every
`CONCEPTS[i].pal` carries all 7 roles (`wall, rug, uph, wood, accent, metal, stone`) as valid
hex; `DAYLIGHT` has all three of `Soft`/`Bright`/`Dusk`. Array caps: waypoints 512, HOTSPOTS
256, ROOMS 64, CONCEPTS 32, PLAN 128, ROOM_COLORS 64.

Full field tables + the error-string catalogue live in the `contract.js` JSDoc — the code is
the source of truth; `npm run check` runs its round-trip + tamper self-check.

---

## 6. Ship & ops discipline

- **Deploy = `git push origin main`** → Dokploy webhook builds. No GitHub Actions.
- **The image build pushes Convex too.** Dokploy must supply `CONVEX_DEPLOY_KEY` to the
  **builder stage** (Convex dashboard → Settings → Deploy keys → Production). Preferred is
  a BuildKit secret, which never enters a layer or the build cache:

  ```
  DOCKER_BUILDKIT=1 docker build --secret id=convex_deploy_key,env=CONVEX_DEPLOY_KEY .
  ```

  If the platform cannot mount secrets, `--build-arg CONVEX_DEPLOY_KEY=…` works. The
  final `runner` stage never receives it so it is absent from the shipped image, but it
  is recorded in the builder stage's layer history on the build host.

  The builder sets `CONVEX_REQUIRE_DEPLOY=1`, so a missing key fails the build loudly
  instead of quietly producing a frontend against a stale backend.
- **`npm run check` now gates the build** — the contract self-check runs first and a
  regression stops the build. It used to exist but nothing ever ran it.
- **Never regress these** (all shipped and broke the tour before, documented in project memory):
  don't code-split `<Walkthrough>` behind `next/dynamic({ssr:false})`; keep the `/tour`
  `<canvas>` React `key`; keep one root `ConvexClientProvider`.
- **Cost:** `/gallery` is `force-static` + `revalidate` (Convex `fetchQuery` is no-store and
  would otherwise bail the page to dynamic); `/tour` stays dynamic (needs `?p=`). OG cards
  1-day cache (slug-keyed, projects rename).

### Backups & monitoring

- **Backup** (store off-box, treat as secret, never commit):
  `npx convex export --prod --path ~/interior-backups/interior-$(date +%F).zip --include-file-storage`
  Weekly cron needs a prod `CONVEX_DEPLOY_KEY` on the VPS. Scheduled/retained snapshots in the
  Convex dashboard are a paid-plan feature — verify the tier.
- **Monitor:** `/healthz` → `{ok:true}`; `/healthz?convex=1` also pings Convex and returns
  **503** when Convex is unreachable, so a plain status-code monitor alarms without having to
  match on body text. Wire Dokploy build notifications + an uptime monitor (see §1 owner action 2).

### Accepted risks (product decisions, not bugs)

- **Open signup + per-owner storage** grows with account count (Sybil). Kept open on purpose;
  orphan-GC + per-user caps + monitoring bound it. Close with email verification / invite gate
  if abused.
- **Password reset is admin-assisted only** until a Resend account + `AUTH_RESEND_KEY` +
  verified domain enable self-serve email reset (`Password({ reset })`).

---

## 7. The editor (`/editor`)

Two modes, one project. **Present** is the scroll walkthrough at `/tour` — what a
client sees, and *only* that: export, import, reset and the sample picker all live
in the editor now, because that is the only place a project can actually be saved.
What `/tour` keeps is the walkthrough, the concept and daylight switches, room
navigation, and — for a signed-in owner — one **Edit this walkthrough** link back
to `/editor?p=<slug>`. `?p=` and `?demo=` still work; they just have no buttons.

**Edit** is `/editor`: a fixed viewport with a camera the author drives. They are separate engines on purpose (`editorEngine.js` vs
`walkthroughEngine.js`): the walkthrough's entire state machine *is* the page
scroll, and bolting free orbit onto it would put `if (editing)` at the top of every
method.

### Navigation

|  | SketchUp scheme (default) | AutoCAD scheme |
|---|---|---|
| Middle drag | orbit | pan |
| Shift + middle drag | pan | orbit |
| Scroll | zoom **toward the cursor** | zoom toward the cursor |

Switchable in the right-hand panel. Both are offered because the middle button is
the one thing the two applications genuinely disagree on, and guessing wrong makes
an experienced user think the viewport is broken.

Every gesture is also reachable with the **left button** by picking a tool first —
laptops and trackpads have no middle button, and that is most first visits.

| Tool | Key | Does |
|---|---|---|
| Select | Space | click a scene marker to select it |
| Orbit | O | spin about the point you grabbed |
| Pan | H | slide the view |
| Zoom | Z | drag up/down to move in and out |
| Look Around | L | turn your head without moving |
| Walk | W | W A S D to walk, drag to steer, Shift to run |
| Position Camera | P | click the floor to stand there at eye height |
| Zoom Extents | Shift+Z | frame the whole model |

The status bar always names the active tool and what the mouse does — it is the
answer to "how do I move around", permanently on screen instead of in a help page.

**What you orbit around is the point of the whole thing.** `OrbitControls` spins
about a fixed invisible target, so the model swings away as soon as you look at a
corner. `sketchupControls.js` raycasts the point under the cursor when the drag
begins and pivots about that, and freezes it for the duration of the drag. The
wheel does the same. Neither behaviour is configurable in OrbitControls, which is
why it is not used.

### Scenes

The contract's `config.waypoints` are surfaced as **Scenes** — SketchUp's own word
for a saved camera. They are drawn in the model as numbered cones with a stalk to
the floor and a dashed path in order, because a camera you cannot see is a camera
you cannot adjust. Author them by eye: frame the shot, then **Add scene from this
view**. `Update scene` overwrites the selected one.

Deleting stops at two. The contract needs `>= 2` waypoints (the path divides by
`N-1` and `roomAt()` indexes `round(q*(N-1))`), so the button disables rather than
letting you save a bundle that cannot be opened.

### Projects (CRUD)

The left panel is the project browser. **New**, **Copy**, **Rename**, **Delete**,
and a list of your own projects to open. `/editor?p=<slug>` opens one directly.

**No Convex changes were needed for any of it** — `save`, `mine`, `getBySlug` and
`remove` already covered the surface, so nothing here requires a backend migration.

Two decisions worth knowing:

- **Copy re-uploads the model** instead of pointing a second document at the same
  storage id. Two documents sharing one blob means deleting either project deletes
  the other's model, and refcounting storage is not worth a copy button.
- **Rename re-sends the bundle.** `save` is the only writer, so the name and the
  data can never drift apart.

Opening a project revalidates its bundle through `validateProject` — a stored
bundle is not automatically trustworthy, because it may predate a contract change.
If it fails, the error is shown and the project you were editing is left alone.

Changing project data (scenes, fov, concepts, model) marks the project unsaved:
the Save button becomes `Save *`, the panel and status bar say so, and closing the
tab asks for confirmation. Camera moves and tool changes do **not** count — an
"unsaved" warning that fires when you merely looked around is a warning people
learn to click through.

Each project change gets a **fresh canvas**. A WebGL context cannot be recreated
on a canvas whose previous context was disposed; reusing it throws "Cannot read
properties of null (reading 'precision')" and blanks the viewport. The tour hit
this first; the editor keys the canvas for the same reason, and `verify_editor.py`
asserts the viewport still renders after New.

### Present

`Present` opens the walkthrough in a new tab. A saved project goes to
`/tour?p=<slug>`; unsaved work is written to the same localStorage draft that the
tour already restores on load, so Present never shows something other than what is
on screen.

### The test harness

`/editor` is behind a Convex sign-in wall, and a headless container has no route to
Convex, so `Authenticated` can never be true there. `/dev-editor` mounts the same
`<Editor />` without the gate and **only exists when the build sets
`EDITOR_TEST_HARNESS=1`**:

```bash
EDITOR_TEST_HARNESS=1 npm run build:next   # /dev-editor exists
npm run build:next                          # /dev-editor is a 404 (verified)
```

The gate itself is tested against the real route: an unauthenticated visitor must
get the wall, not a canvas.

---

## 8. Auditing the camera path

`/tour` is only as good as its waypoints, and the bad ones are exactly the ones you
scroll past without stopping. Measure instead of squinting:

```bash
npm run audit:path              # report
node scripts/audit-path.mjs --suggest   # + candidate fixes for the flagged ones
```

It builds the scene headlessly (three's Raycaster needs no WebGL) and reports three
things per waypoint:

| metric | means |
|---|---|
| **dist** | how far the centre ray travels before it hits something. Under 2.5 m the frame is one surface. |
| **pitch** | a steeply tilted look reads as a stumble. |
| **subjects** | distinct meshes touched by a 5×3 fan across the frame. |

**Subjects is the one that matters**, and it is why distance alone was not enough:
a shot can sit a comfortable 4 m from its target and still be a blank wall, because
nothing else is in view. Counting how many different things the frame touches is a
better proxy for "is there anything to look at" than any single ray.

`--suggest` does a local search per flagged waypoint. It keeps the path's shape (the
eye may drift ≤ 0.9 m, stays at head height) and enforces two constraints that took
two attempts to get right:

- **clearance** — the eye must not end up inside geometry. Without it the search
  happily parked the camera in the kitchen's far wall.
- **direction of travel** — a shot facing back down the path is not a better shot.
  The tour is a walk; turning round mid-corridor reads as a mistake however much
  furniture it frames.

It prints candidates. A human still decides, and then *looks at the render* — the
numbers say the frame is full, not that it is good.

This round took the path from 1 wall-stare / 2 blank frames / 1 steep pitch to zero
of each, mean sightline 5.71 → 6.51 m, mean subjects 3.8 → 5.3.

### Two testing footguns worth remembering

- **The harness flag is baked at build time.** Flipping `EDITOR_TEST_HARNESS`
  without `rm -rf .next` gets you the *cached* render of the previous flag, so
  `/dev-editor` 404s while you swear it should not.
- **`next build --output standalone` does not copy `public/` or `.next/static`.**
  Without them the server still serves HTML — just no JavaScript. The page looks
  alive, is dead, and every render-diff test quietly reports 0.0/255 while blaming
  code that is fine. All three verification scripts now stage those directories and
  refuse to start if the copy did not land.
