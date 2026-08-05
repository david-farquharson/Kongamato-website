# WebGL Hero — Performance Optimization

**Date:** 2026-08-05
**Commit:** `d2187fc` — *Optimize WebGL hero for low-end GPUs (Intel integrated)*
**Goal:** Stop the site running slowly on Windows office machines with Intel **integrated** GPUs, without degrading discrete-GPU machines.

---

## 1. The bottleneck

The hero is a three.js scene whose terrain is drawn as an **additive-blended wireframe**. Wireframe rendering emits 3 line segments per triangle:

| Model | Triangles | What's drawn |
|---|---|---|
| Terrain (`rugged_mountain_landscape`) | 581,385 | wireframe → **~1.74M line segments / frame** |
| Aircraft (`synergy_full`) | 76,896 | solid, lit (minor by comparison) |

Two properties of that terrain make it brutal on Intel integrated GPUs specifically:

1. **Line primitives** — iGPUs are slow at line rasterization.
2. **Additive blending + `depthWrite:false`** — every line fragment is a framebuffer read‑modify‑write with no depth rejection, so cost scales with **how many pixels each line covers** (fill‑rate bound). High‑DPI screens multiply this.

So the two levers that matter are **(a) fewer/shorter lines** and **(b) fewer pixels per line**.

---

## 2. What changed

### A. Mesh decimation — fewer lines *and* smaller downloads

`optimize-meshes.mjs` decimates the geometry with `meshoptimizer` (borders locked so the 6 terrain chunks can't crack apart) and re‑compresses with Draco.

| Asset | Triangles | Line segments/frame | File size |
|---|---|---|---|
| Terrain | 581,385 → **87,975** | 1.74M → **~264K** (6.6× fewer) | 0.80 MB → **0.28 MB** |
| Aircraft | 76,896 → **51,506** | (solid) | 0.16 MB → **0.14 MB** |

**Bug fixed along the way:** decimation rebuilds each mesh's vertex/index accessors, which *orphaned* the originals. gltf‑transform serialized those orphans **uncompressed**, ballooning the output to **11 MB**. The normal fix (`prune()` from `@gltf-transform/functions`) can't run on this machine — it pulls in the native `sharp` module, which fails to load on darwin‑arm64. So the script now prunes orphaned accessors by hand before the Draco encode:

```js
for (const acc of root.listAccessors())
  if (acc.listParents().every(p => p.propertyType === 'Root')) acc.dispose();
```

Result: correct 0.28 MB output instead of 11 MB.

### B. Adaptive GPU tiering — fewer pixels on weak hardware

New file **`js/perf.js`** probes the GPU once at startup (via `WEBGL_debug_renderer_info`) and classifies it:

- **LOW tier** if the renderer string matches Intel / SwiftShader / software / llvmpipe / "basic render", **or** it's mobile, **or** `hardwareConcurrency <= 4`, **or** the renderer is hidden (fail‑safe).
- **HIGH tier** otherwise.

| Setting | LOW tier | HIGH tier (unchanged) |
|---|---|---|
| `devicePixelRatio` cap | **1** | 2 |
| MSAA (`antialias`) | **off** | on |
| Frame‑rate cap | **30 fps** | uncapped |
| `powerPreference` | high‑performance | high‑performance |

Why these: DPR 1 is the single biggest fill‑rate win on scaled/HiDPI Windows laptops; MSAA does nothing for 1px lines but costs on iGPUs; a 30 fps cap halves GPU load and is invisible on a slow ambient scene.

`app.js` and `contact-stage.js` now build their renderer with `PERF.makeRenderer()` and gate their animation loop with `PERF.gate(now)`. **Discrete‑GPU machines behave exactly as before.**

### Files touched

```
optimize-meshes.mjs          (new) decimation + Draco, with the orphan-accessor fix
js/perf.js                   (new) GPU tier detection + adaptive renderer/fps
js/app.js                    use PERF.makeRenderer() + fps gate in the render loop
js/contact-stage.js          same, for the contact page background
index.html, contact.html     load js/perf.js after three.min.js
assets/rugged_mountain_landscape.opt.glb   decimated (581k→88k tris)
assets/synergy_full.opt.glb                decimated (77k→52k tris)
```

---

## 3. Verification done

- Decimated `.glb` files round‑trip as valid Draco (correct triangle counts, proper compression ratio).
- All JS syntax‑checked.
- Served locally and screenshotted: scene renders, HUD/copy load, **no GLTF load‑error overlay** (assets decode), and the terrain wireframe is **continuous with no cracks** from the border‑locked decimation.

**Not yet tested:** the LOW‑tier path itself. The dev machine is a discrete/Apple GPU, so it reports HIGH. The low‑tier code is simple and validated, but the real proof is loading it on an actual Intel/Windows machine.

### How to preview locally
```bash
cd "Website templates/Kongamato.v4"
python3 -m http.server 8123
# open http://localhost:8123/
# check the browser console for:  [perf] GPU: … | tier: HIGH/LOW
```
To simulate low‑end quickly, you can temporarily force it in `js/perf.js` (set `lowEnd = true`).

---

## 4. Decisions made (you may want to revisit)

1. **Terrain is now coarser for *everyone*** (single asset, 88K tris). It still looks detailed and the wireframe is faint/background — but high‑end machines also get the reduced mesh. See Option A to keep full detail on high‑end only.
2. **The aircraft (hero model) was decimated too**, near‑losslessly (error 0.005). It renders cheaply either way, so this is optional. See Option B.
3. **`optimize-meshes.mjs` is NOT idempotent** — it overwrites `*.opt.glb` in place, so re‑running re‑decimates the already‑small file. Regenerate originals from `build-assets.mjs`, or `git checkout` them.

---

## 5. Your options / next steps

Ordered roughly by impact‑for‑effort.

### Option A — Keep full‑detail terrain on high‑end (dual assets)
Ship both `rugged_mountain_landscape.opt.glb` (full) and a `.low.glb` (decimated); `scenes.js` picks based on `PERF.lowEnd`.
- **Pro:** high‑end keeps maximum crispness; low‑end still gets the light mesh.
- **Con:** two assets to maintain; a bit more loader logic.
- **Effort:** small.

### Option B — Revert the aircraft to full detail
Comment out the aircraft job in `optimize-meshes.mjs` and `git checkout assets/synergy_full.opt.glb`.
- **When:** if you spot any faceting on the hero. Render cost is negligible either way.
- **Effort:** trivial.

### Option C — Push the terrain decimation harder
Decimation stalled at 15% (not the 10% target) because **LockBorder** locks the shared edges of the 6 separate chunks. Merge/weld the chunks into one mesh first, then only the *outer* boundary is locked and the interior can go much lower (potentially 2–4× fewer lines again).
- **Pro:** biggest remaining render win.
- **Con:** requires welding chunk borders; small risk of seams if borders don't share vertices.
- **Effort:** medium.

### Option D — Reduce additive overdraw on low‑end
On LOW tier, either drop the terrain to `EdgesGeometry` (only sharp edges → far fewer lines, but a different, contour‑like look) or switch its material from additive to normal alpha blending (cheaper fragments).
- **Pro:** attacks the fill cost directly.
- **Con:** changes the aesthetic on weak machines.
- **Effort:** small–medium.

### Option E — Pause rendering when off‑screen / tab hidden
Add a `visibilitychange` guard and/or `IntersectionObserver` so the loop stops when the canvas isn't visible.
- **Pro:** saves battery/GPU; nice on laptops.
- **Con:** minimal; rAF already pauses on hidden tabs in most browsers.
- **Effort:** trivial.

### Option F — Verify on real hardware
Load the deployed site on a genuine Intel‑integrated Windows laptop and read the console `[perf]` line to confirm it lands on the LOW tier and feels smooth. This is the real acceptance test.

---

## 6. Security note

A GitHub Personal Access Token was shared in plaintext to enable the push. **Treat it as compromised and revoke/rotate it** (GitHub → Settings → Developer settings → Personal access tokens). It was used for a single push and was **not** written into `.git/config` (the stored remote URL is tokenless).
