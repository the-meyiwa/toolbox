#!/usr/bin/env node
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, meshopt, prune, simplify, weld } from '@gltf-transform/functions';
import { MeshoptDecoder, MeshoptEncoder, MeshoptSimplifier } from 'meshoptimizer';
import draco3d from 'draco3dgltf';
import { readFile, writeFile, mkdir, stat } from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';

const io = new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({
    'meshopt.decoder': MeshoptDecoder, 'meshopt.encoder': MeshoptEncoder,
    'draco3d.decoder': await draco3d.createDecoderModule(),
    'draco3d.encoder': await draco3d.createEncoderModule()
  });

function slug(value) {
  return String(value || 'geometry').normalize('NFKD').replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_|_$/g, '').toLowerCase() || 'geometry';
}

function matchRule(name, rule) {
  const value = rule.caseSensitive ? name : name.toLowerCase();
  const pattern = rule.caseSensitive ? rule.match : String(rule.match).toLowerCase();
  if (rule.type === 'exact') return value === pattern;
  if (rule.type === 'prefix') return value.startsWith(pattern);
  if (rule.type === 'includes') return value.includes(pattern);
  if (rule.type === 'regex') return new RegExp(rule.match, rule.flags || 'i').test(name);
  throw new Error(`Unknown mapping rule type ${rule.type}.`);
}

function countTriangles(document) {
  let total = 0;
  for (const mesh of document.getRoot().listMeshes()) for (const primitive of mesh.listPrimitives()) {
    total += (primitive.getIndices()?.getCount() || primitive.getAttribute('POSITION')?.getCount() || 0) / 3;
  }
  return Math.round(total);
}

function nodeSignature(node) {
  const mesh = node.getMesh();
  const materials = mesh?.listPrimitives().map(primitive => primitive.getMaterial()?.getName()).filter(Boolean) || [];
  return [node.getName(), mesh?.getName(), ...materials].filter(Boolean).join(' | ');
}

function assertDefinition(definition) {
  for (const field of ['id', 'make', 'model', 'displayName', 'accuracy']) {
    if (!definition.vehicle?.[field]) throw new Error(`Definition requires vehicle.${field}.`);
  }
  for (const field of ['spdx', 'creator', 'sourceUrl', 'licenseUrl', 'attribution']) {
    if (!definition.license?.[field]) throw new Error(`Definition requires license.${field}.`);
  }
  if (!['CC0-1.0', 'CC-BY-4.0'].includes(definition.license.spdx)) {
    throw new Error('Ingestion accepts only CC0-1.0 or CC-BY-4.0 assets.');
  }
}

async function inspect(input) {
  const document = await io.read(input);
  const rows = [];
  for (const node of document.getRoot().listNodes()) if (node.getMesh()) {
    rows.push({ node: node.getName() || '(unnamed)', mesh: node.getMesh().getName() || '(unnamed)', materials: node.getMesh().listPrimitives().map(item => item.getMaterial()?.getName()).filter(Boolean), primitives: node.getMesh().listPrimitives().length });
  }
  console.log(JSON.stringify({ input, triangles: countTriangles(document), meshNodes: rows.length, nodes: rows }, null, 2));
}

async function ingest(input, definitionPath, outputDirectory) {
  const definition = JSON.parse(await readFile(definitionPath, 'utf8'));
  assertDefinition(definition);
  await Promise.all([MeshoptSimplifier.ready, MeshoptEncoder.ready]);
  const document = await io.read(input);
  // Source compression is decoded by NodeIO. Remove its declaration so output is
  // encoded only with Toolbox's standard Meshopt profile.
  document.getRoot().listExtensionsUsed()
    .find(extension => extension.extensionName === 'KHR_draco_mesh_compression')?.dispose();
  const sourceTriangles = countTriangles(document);
  const components = new Map((definition.components || []).map(item => [item.id, { availability: 'available', ...item }]));
  const meshMappings = {};
  const counters = new Map();
  const unmappedMeshes = [];

  for (const node of document.getRoot().listNodes()) {
    if (!node.getMesh()) continue;
    const sourceName = node.getName() || node.getMesh().getName() || 'Unnamed geometry';
    const signature = nodeSignature(node);
    const rule = (definition.rules || []).find(item => matchRule(signature, item));
    const componentId = rule?.componentId || 'unmapped_geometry';
    if (!components.has(componentId)) components.set(componentId, rule ? {
      id: componentId, label: rule.label || sourceName, category: rule.category || 'Exterior',
      availability: 'available', source: definition.license.sourceUrl
    } : {
      id: componentId, label: 'Unmapped geometry', category: 'Unmapped geometry',
      availability: 'geometry-only', source: definition.license.sourceUrl
    });
    if (!rule) unmappedMeshes.push(sourceName);
    const sequence = (counters.get(componentId) || 0) + 1;
    counters.set(componentId, sequence);
    const standardizedName = `tbx_${componentId}_${sequence}`;
    node.setName(standardizedName).setExtras({
      ...node.getExtras(),
      component: { id: componentId, name: components.get(componentId).label, category: components.get(componentId).category }
    });
    meshMappings[standardizedName] = componentId;
  }

  // The technical renderer needs only positions and normals. Presentation attributes are removed.
  for (const mesh of document.getRoot().listMeshes()) for (const primitive of mesh.listPrimitives()) {
    primitive.setMaterial(null);
    for (const semantic of primitive.listSemantics()) {
      if (semantic !== 'POSITION' && semantic !== 'NORMAL') primitive.setAttribute(semantic, null);
    }
  }
  await document.transform(dedup(), prune(), weld());
  const ratio = definition.optimization?.ratio ?? 1;
  if (ratio < 1) await document.transform(simplify({ simplifier: MeshoptSimplifier, ratio, error: definition.optimization?.error ?? 0.001 }));
  await document.transform(prune(), dedup(), meshopt({ encoder: MeshoptEncoder, level: 'high' }));

  let outputTriangles = countTriangles(document);
  if (!outputTriangles) throw new Error('Optimized package contains no triangles.');
  const maxTriangles = definition.optimization?.maxTriangles ?? 250000;
  if (outputTriangles > maxTriangles) throw new Error(`Optimized package has ${outputTriangles} triangles; limit is ${maxTriangles}.`);

  const packageDir = path.resolve(outputDirectory);
  await mkdir(packageDir, { recursive: true });
  const glbName = 'vehicle.glb';
  const glbPath = path.join(packageDir, glbName);
  await io.write(glbPath, document);
  const glb = await readFile(glbPath);
  // Re-read the encoded artifact: compression may discard degenerate triangles.
  outputTriangles = countTriangles(await io.read(glbPath));
  const sha256 = crypto.createHash('sha256').update(glb).digest('hex');
  const unavailable = (definition.unavailableLayers || ['mechanical', 'interior']).map(id => ({ id, available: false }));
  const manifest = {
    schemaVersion: 1, packageVersion: definition.packageVersion || '1.0.0', vehicle: definition.vehicle,
    license: { ...definition.license, modifications: 'Converted to Toolbox Vehicle Package; materials and textures removed; geometry optimized; semantic node tags added.' },
    layers: [{ id: 'exterior', glb: glbName, available: true, triangles: outputTriangles, sha256 }, ...unavailable],
    components: [...components.values()], meshMappings,
    unmappedMeshes: [...new Set(unmappedMeshes)].sort(),
    notes: definition.notes || 'Exterior geometry is available. Mechanical data not present in the source is marked unavailable.',
    ingestion: { sourceTriangles, outputTriangles, tool: 'scripts/vehicle-package.mjs', generatedAt: new Date().toISOString() }
  };
  await writeFile(path.join(packageDir, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
  console.log(JSON.stringify({ package: definition.vehicle.id, sourceTriangles, outputTriangles, bytes: (await stat(glbPath)).size, components: components.size, sha256 }, null, 2));
}

async function validate(packageDirectory) {
  const manifestPath = path.join(packageDirectory, 'manifest.json');
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  assertDefinition(manifest);
  if (manifest.schemaVersion !== 1) throw new Error('Unsupported manifest schema.');
  const availableLayers = manifest.layers.filter(layer => layer.available !== false);
  if (!availableLayers.length) throw new Error('Package has no available layers.');
  const ids = new Set(manifest.components.map(item => item.id));
  for (const id of Object.values(manifest.meshMappings)) if (!ids.has(id)) throw new Error(`Unknown mapped component ${id}.`);
  for (const layer of availableLayers) {
    const bytes = await readFile(path.join(packageDirectory, layer.glb));
    const digest = crypto.createHash('sha256').update(bytes).digest('hex');
    if (digest !== layer.sha256) throw new Error(`Checksum mismatch for ${layer.glb}.`);
    const document = await io.read(path.join(packageDirectory, layer.glb));
    if (countTriangles(document) !== layer.triangles) throw new Error(`Triangle count mismatch for ${layer.glb}.`);
  }
  console.log(`Valid Toolbox Vehicle Package: ${manifest.vehicle.displayName}`);
}

const [command, ...args] = process.argv.slice(2);
if (command === 'inspect' && args.length === 1) await inspect(args[0]);
else if (command === 'ingest' && args.length === 3) await ingest(...args);
else if (command === 'validate' && args.length === 1) await validate(args[0]);
else {
  console.error('Usage:\n  node scripts/vehicle-package.mjs inspect <input.glb>\n  node scripts/vehicle-package.mjs ingest <input.glb> <definition.json> <output-dir>\n  node scripts/vehicle-package.mjs validate <package-dir>');
  process.exitCode = 1;
}
