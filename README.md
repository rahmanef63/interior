# Rahman 3D Interior — Scroll-driven 3D Interior Walkthrough

A scroll-driven WebGL walkthrough of an L-shaped apartment: start on the floor
plan, descend through the entrance, and orbit each room — switching its
material/colour concept as you pass through. Built with **three.js**, sliced
into framework-agnostic modules and wired up as a **Next.js App Router** client
component.

Live at **interior.rahmanef.com** — `/` is a static marketing page, `/tour` is
the walkthrough. Backend is **Convex Cloud**: email+password auth, per-user
project saves, unlisted share links (`/tour?p=<slug>`), and GLB uploads gated
by the model rules in `docs/GUIDE.md`. Guests persist to localStorage.
Status, model/Blender authoring, and the data contract: `docs/GUIDE.md`.

---

## Why it's structured this way

The renderer is **headless and dependency-injected**: not a single file under
`lib/` imports `three` directly — the `THREE` namespace is passed into
`new WalkthroughEngine({ THREE, … })`. That keeps the whole engine portable
(Next.js, Vite, plain `<script>`, the original design prototype) and makes it
trivial to swap three.js versions or run tests with a mock.

React only does two things: mount a `<canvas>` + overlay DOM, and mirror the
engine's "slow" state (current room, selected concepts) so the overlay
re-renders. Everything per-frame (camera, projections, hero/progress opacity)
is written straight to DOM/WebGL by the engine — React never re-renders on
scroll.

```
interior/
├─ package.json
├─ next.config.js
├─ docs/GUIDE.md               # status, model/Blender authoring, data contract, ops
├─ convex/                     # Convex Cloud backend
│  ├─ schema.js                # authTables + projects (owner, slug, bundle, glb)
│  ├─ auth.js / http.js        # @convex-dev/auth Password provider
│  ├─ projects.js              # save / share / upload / delete + rate limits
│  ├─ admin.js                 # super-admin role (SUPER_ADMIN_EMAILS env)
│  └─ crons.js                 # orphan-GLB garbage collection
└─ src/
   ├─ app/
   │  ├─ layout.jsx            # fonts, metadata, root ConvexClientProvider
   │  ├─ page.jsx              # '/' static marketing page (server component)
   │  ├─ tour/page.jsx         # '/tour' renders <Walkthrough/>
   │  └─ globals.css           # resets, keyframes, tuner control styles
   ├─ components/
   │  ├─ Walkthrough.jsx       # 'use client' — canvas + overlay + engine wiring
   │  └─ HeaderAuth.jsx        # sign in / sign up dropdown in the site header
   ├─ config/
   │  └─ walkthrough.config.js # ⇐ the one file you edit per project
   └─ lib/
      ├─ tokens.js             # shared brand tokens (ink/paper/accent/label)
      ├─ store/local.js        # guest persistence (localStorage, validated)
      ├─ three/
      │  ├─ walkthroughEngine.js  # orchestrator: loop, scroll, perf, tuner glue
      │  ├─ contract.js           # versioned import/export contract (trust boundary)
      │  ├─ modelRules.js         # GLB budgets (tris/textures/bytes)
      │  ├─ scene.js              # ⇐ bespoke geometry for THIS apartment
      │  ├─ builders.js           # primitive + themed-material factory
      │  ├─ lights.js             # sun / hemi / fill rig
      │  ├─ particles.js          # drifting dust
      │  ├─ cameraPath.js         # Catmull-Rom curves + scroll⇄room mapping
      │  ├─ pathFlow.js           # Enscape-style path ribbon + 3D cam markers
      │  ├─ gizmo.js              # XYZ translate gizmo + ray/axis math
      │  └─ cameraTuner.js        # authoring panel (super admin, pure DOM)
      └─ dom/
         ├─ planLabels.js         # floor-plan pins (intro)
         └─ hotspots.js           # clickable material call-outs
```

## Run it

```bash
npm install
npm run dev        # http://localhost:3000 (needs NEXT_PUBLIC_CONVEX_URL for cloud features)
npm run check      # assert-based self-checks (contract round-trip + tamper cases)
```

> `Walkthrough.jsx` is a client component — it owns a WebGL context and scroll
> listeners, so it must not render on the server. It already carries
> `'use client'`. The page is otherwise a normal App Router route.

## Authoring a project

Everything content-related lives in **`src/config/walkthrough.config.js`**:

| Export        | What it controls                                              |
| ------------- | ------------------------------------------------------------ |
| `config`      | camera `fov`, `intro` (top-down pose), and the `waypoints[]` path (`{ pos:[x,y,z], look:[x,y,z], room }`) |
| `CONCEPTS`    | the switchable schemes; `pal` keys are the semantic roles the geometry references (`wall`, `rug`, `uph`, `wood`, `accent`, `metal`, `stone`) |
| `ROOMS`       | room names (drives the side nav + count)                     |
| `PLAN`        | floor-plan label pins shown during the intro                 |
| `HOTSPOTS`    | clickable material call-outs anchored in world space         |
| `DAYLIGHT`    | the Soft / Bright / Dusk lighting presets                    |
| `BRAND`       | wordmark, tagline, colours                                   |

The **3D geometry** of the apartment is the only other per-project file:
`src/lib/three/scene.js`. Rebuild it with the `builders` helpers
(`box`, `cyl`, `add`, `W`, `themedMat`, `staticMat`). Use `themedMat(room, role)`
for anything that should respond to concept switching.

## Authoring the camera path (dev tool)

With `enableTuner` on, a **⚙ Tune Camera** button (bottom-right) opens a panel
with two modes — **✎ Edit** (observe + position the selected camera, with a
docked POV window showing its true shot) and **▷ Preview** (look full-screen
through the camera). Drag the XYZ gizmo, fly-scout (`WASD` + drag), then
**Copy config** to dump a ready-to-paste `export const config = {…}` block back
over `config` in `walkthrough.config.js`. In production the tour renders
`enableTuner={false}` and the tuner unlocks at runtime only for **super admins**
(email allowlist in the `SUPER_ADMIN_EMAILS` Convex env var).

## Component props

```jsx
<Walkthrough
  daylight="Soft"   // 'Soft' | 'Bright' | 'Dusk' (initial; user-switchable in-tour)
  dust               // boolean — drifting dust motes
  reflections        // boolean — glossy clearcoat floor
  enableTuner        // boolean — camera-authoring overlay (super admins get it at runtime)
  io                 // boolean — export/import + cloud-save panel
/>
```

`daylight` / `dust` / `reflections` hot-update without rebuilding the scene
(changing daylight re-bakes the shadow map once).

## Performance notes

- **Baked shadows:** static scene → shadow map rendered once and frozen
  (`shadowMap.autoUpdate = false`); only re-bakes on daylight change.
- **Render-on-demand:** the rAF loop stays alive but only calls
  `renderer.render()` while moving, settling, or tuning. Idle ≈ 0 GPU.
- **No React re-render on scroll:** scroll maps to the camera imperatively;
  React state changes only when the room or a concept actually changes.
