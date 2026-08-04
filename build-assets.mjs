/* ==========================================================
   build-assets.mjs — asset optimizer for the Kongamato site
   · Strips unused terrain textures / UVs / tangents (wireframe only needs POSITION)
   · Draco-compresses geometry
   · Optimizes the aircraft glb (keeps baked colors, still compresses)
   Run:  node build-assets.mjs
   Outputs *.opt.glb next to originals; originals are left untouched.
   ========================================================== */
import { NodeIO } from '@gltf-transform/core';
import { KHRONOS_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, prune, weld, draco } from '@gltf-transform/functions';
import draco3d from 'draco3d';

const io = new NodeIO()
  .registerExtensions(KHRONOS_EXTENSIONS)
  .registerDependencies({
    'draco3d.decoder': await draco3d.createDecoderModule(),
    'draco3d.encoder': await draco3d.createEncoderModule(),
  });

const fmt = b => (b / 1e6).toFixed(2) + ' MB';

/* ---------- 1. TERRAIN: wireframe-only, strip everything but geometry ---------- */
async function buildTerrain() {
  const src = 'assets/rugged_mountain_landscape/rugged_mountain_landscape.gltf';
  const dst = 'assets/rugged_mountain_landscape.opt.glb';
  const doc = await io.read(src);
  const root = doc.getRoot();

  // Drop all materials, textures, images — wireframe uses MeshBasicMaterial in code.
  root.listMaterials().forEach(m => m.dispose());
  root.listTextures().forEach(t => t.dispose());

  // Strip every vertex attribute except POSITION (kills 10 UV sets, tangents, normals).
  for (const mesh of root.listMeshes()) {
    for (const prim of mesh.listPrimitives()) {
      for (const semantic of prim.listSemantics()) {
        if (semantic !== 'POSITION') {
          const acc = prim.getAttribute(semantic);
          prim.setAttribute(semantic, null);
          if (acc && acc.listParents().length <= 1) acc.dispose();
        }
      }
      prim.setMaterial(null);
    }
  }

  await doc.transform(
    weld(),                 // merge identical vertices
    dedup(),                // remove duplicate accessors/meshes
    prune(),                // drop now-orphaned data
    draco({ method: 'edgebreaker' }),
  );

  await io.write(dst, doc);
  return dst;
}

/* ---------- 2. AIRCRAFT: keep baked colors, just compress geometry ---------- */
async function buildAircraft() {
  const src = 'assets/synergy_full.glb';
  const dst = 'assets/synergy_full.opt.glb';
  const doc = await io.read(src);

  await doc.transform(
    weld(),
    dedup(),
    prune(),
    draco({ method: 'edgebreaker' }),
  );

  await io.write(dst, doc);
  return dst;
}

import { statSync } from 'fs';
const sizeOf = p => { try { return statSync(p).size; } catch { return 0; } };

console.log('Building optimized assets...\n');

const terrainSrcBytes =
  sizeOf('assets/rugged_mountain_landscape/scene.bin') +
  sizeOf('assets/rugged_mountain_landscape/textures/DefaultMaterial_baseColor.jpeg') +
  sizeOf('assets/rugged_mountain_landscape/textures/DefaultMaterial_normal.jpeg') +
  sizeOf('assets/rugged_mountain_landscape/textures/DefaultMaterial_metallicRoughness.png') +
  sizeOf('assets/rugged_mountain_landscape/textures/DefaultMaterial_specularf0.png');

const terrainOut = await buildTerrain();
console.log(`TERRAIN  ${fmt(terrainSrcBytes)}  ->  ${fmt(sizeOf(terrainOut))}   (${terrainOut})`);

const aircraftSrc = sizeOf('assets/synergy_full.glb');
const aircraftOut = await buildAircraft();
console.log(`AIRCRAFT ${fmt(aircraftSrc)}  ->  ${fmt(sizeOf(aircraftOut))}   (${aircraftOut})`);

console.log('\nDone.');
