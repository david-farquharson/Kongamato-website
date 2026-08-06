/* ==========================================================
   optimize-meshes.mjs — polygon-reduction pass for the 3D assets
   · Reads the already-optimized (welded/pruned/Draco) *.opt.glb files
   · Decimates geometry with meshoptimizer (borders locked → no cracks)
   · Compacts vertices and re-compresses with Draco
   Run:  node optimize-meshes.mjs            (writes *.opt.glb in place)
         node optimize-meshes.mjs --dry      (writes *.test.glb for review)

   Why a separate script from build-assets.mjs: this path avoids
   @gltf-transform/functions (which eagerly imports the native `sharp`
   module and can fail to load on some machines). It uses only core +
   extensions + meshoptimizer, so it runs anywhere Node does.
   ========================================================== */
import { NodeIO } from '@gltf-transform/core';
import { KHRONOS_EXTENSIONS, KHRDracoMeshCompression } from '@gltf-transform/extensions';
import { MeshoptSimplifier } from 'meshoptimizer';
import draco3d from 'draco3d';
import { statSync } from 'fs';

await MeshoptSimplifier.ready;

const io = new NodeIO()
  .registerExtensions(KHRONOS_EXTENSIONS)
  .registerDependencies({
    'draco3d.decoder': await draco3d.createDecoderModule(),
    'draco3d.encoder': await draco3d.createEncoderModule(),
  });

const DRY = process.argv.includes('--dry');
const fmt = b => (b / 1e6).toFixed(2) + ' MB';
const sizeOf = p => { try { return statSync(p).size; } catch { return 0; } };

/* Decimate one primitive to `ratio` of its triangles, then compact the
   vertex buffer so unused vertices are dropped. Returns [oldTris, newTris]. */
function decimatePrimitive(doc, buffer, prim, ratio, error) {
  const posAcc = prim.getAttribute('POSITION');
  if (!posAcc) return [0, 0];
  const vertCount = posAcc.getCount();
  const position = new Float32Array(posAcc.getArray()); // tightly packed xyz

  // indices (synthesize a trivial range if the prim is non-indexed)
  let idxAcc = prim.getIndices();
  const index = idxAcc
    ? new Uint32Array(idxAcc.getArray())
    : Uint32Array.from({ length: vertCount }, (_, i) => i);

  const oldTris = index.length / 3;
  let target = Math.floor(oldTris * ratio) * 3;
  target = Math.max(target, 3);

  const simplified = MeshoptSimplifier.simplify(
    index, position, 3, target, error, ['LockBorder']);
  const newIndex = simplified[0];
  const newTris = newIndex.length / 3;

  // ---- compact: keep only vertices the new index set references ----
  const used = new Uint8Array(vertCount);
  for (let i = 0; i < newIndex.length; i++) used[newIndex[i]] = 1;
  const remap = new Int32Array(vertCount).fill(-1);
  let n = 0;
  for (let v = 0; v < vertCount; v++) if (used[v]) remap[v] = n++;

  const compactIndex = new Uint32Array(newIndex.length);
  for (let i = 0; i < newIndex.length; i++) compactIndex[i] = remap[newIndex[i]];

  // rebuild every vertex attribute (POSITION, NORMAL, COLOR_*, TEXCOORD_*, …)
  for (const semantic of prim.listSemantics()) {
    const acc = prim.getAttribute(semantic);
    const comps = acc.getElementSize();          // 3 for vec3, 2 for vec2, …
    const src = acc.getArray();
    const dst = new src.constructor(n * comps);
    for (let v = 0; v < vertCount; v++) {
      if (remap[v] < 0) continue;
      const to = remap[v] * comps, from = v * comps;
      for (let c = 0; c < comps; c++) dst[to + c] = src[from + c];
    }
    const na = doc.createAccessor()
      .setType(acc.getType()).setBuffer(buffer)
      .setNormalized(acc.getNormalized()).setArray(dst);
    prim.setAttribute(semantic, na);
  }
  prim.setIndices(doc.createAccessor().setType('SCALAR').setBuffer(buffer).setArray(compactIndex));

  return [oldTris, newTris];
}

/* Decimation replaces each primitive's attribute/index accessors with fresh,
   compacted ones — leaving the originals orphaned in the document. gltf-transform
   still serialises orphaned accessors (uncompressed!), which balloons the output
   to 10× the input. `@gltf-transform/functions`' prune() would remove them, but it
   pulls in the native `sharp` module (same reason build uses this script), so we
   drop orphans by hand: any accessor whose only remaining owner is the Root. */
function pruneOrphanAccessors(root) {
  let removed = 0;
  for (const acc of root.listAccessors()) {
    if (acc.listParents().every(p => p.propertyType === 'Root')) { acc.dispose(); removed++; }
  }
  return removed;
}

async function optimize(src, dst, ratio, error) {
  const doc = await io.read(src);
  const root = doc.getRoot();
  const buffer = root.listBuffers()[0];

  let oldTot = 0, newTot = 0;
  for (const mesh of root.listMeshes())
    for (const prim of mesh.listPrimitives()) {
      const [o, nw] = decimatePrimitive(doc, buffer, prim, ratio, error);
      oldTot += o; newTot += nw;
    }

  pruneOrphanAccessors(root);   // <-- critical: drop the pre-decimation accessors

  // re-compress geometry with Draco (edgebreaker, same as build-assets.mjs)
  doc.createExtension(KHRDracoMeshCompression)
    .setRequired(true)
    .setEncoderOptions({
      method: KHRDracoMeshCompression.EncoderMethod.EDGEBREAKER,
      encodeSpeed: 5, decodeSpeed: 5,
    });

  await io.write(dst, doc);
  return { oldTot, newTot };
}

const out = name => DRY ? name.replace('.opt.glb', '.test.glb') : name;

console.log(`Decimating meshes${DRY ? ' (dry run → *.test.glb)' : ''}...\n`);

const jobs = [
  // terrain: rendered as a wireframe → triangle count == line count. Balanced
  // cut (0.35): dense enough that the flat valley/skirt (~20% of the mesh) keeps
  // subdivision instead of collapsing into big empty triangles + long lines
  // (very visible in light mode), while still ~1/3 the original line count.
  // Borders locked so the 6 chunks never crack apart; tight error preserves the
  // flat regions. Re-run from the ORIGINAL mesh, not an already-decimated file.
  { src: 'assets/rugged_mountain_landscape.opt.glb', ratio: 0.35, error: 0.01, label: 'TERRAIN ' },
  // aircraft: solid, lit hero model — conservative, visually lossless cut.
  { src: 'assets/synergy_full.opt.glb',              ratio: 0.55, error: 0.005, label: 'AIRCRAFT' },
];

for (const j of jobs) {
  const dst = out(j.src);
  const { oldTot, newTot } = await optimize(j.src, dst, j.ratio, j.error);
  console.log(
    `${j.label}  ${Math.round(oldTot).toLocaleString()} → ${Math.round(newTot).toLocaleString()} tris` +
    `  (${(newTot / oldTot * 100).toFixed(1)}%)   ${fmt(sizeOf(j.src))} → ${fmt(sizeOf(dst))}   ${dst}`);
}

console.log('\nDone.');
