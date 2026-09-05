import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parsePackageSpec,
  extractPackageImports,
  buildImportMap,
  fetchPackageMetadata
} from '../../js/lib/npm-client.js';

test('NPM Client: parsePackageSpec parses standard and scoped package specs', () => {
  assert.deepEqual(parsePackageSpec('lodash'), { name: 'lodash', version: 'latest', raw: 'lodash' });
  assert.deepEqual(parsePackageSpec('canvas-confetti@^1.9.4'), { name: 'canvas-confetti', version: '^1.9.4', raw: 'canvas-confetti@^1.9.4' });
  assert.deepEqual(parsePackageSpec('@types/node@20.0.0'), { name: '@types/node', version: '20.0.0', raw: '@types/node@20.0.0' });
  assert.deepEqual(parsePackageSpec('@scope/pkg'), { name: '@scope/pkg', version: 'latest', raw: '@scope/pkg' });
});

test('NPM Client: extractPackageImports extracts imported non-relative packages', () => {
  const code = `
    import React, { useState } from 'react';
    import confetti from 'canvas-confetti';
    import { chunk } from 'lodash/chunk';
    import './App.css';
    import Header from '../components/Header';
    const axios = require('axios');
  `;
  const imports = extractPackageImports(code);
  assert.ok(imports.includes('react'));
  assert.ok(imports.includes('canvas-confetti'));
  assert.ok(imports.includes('lodash'));
  assert.ok(imports.includes('axios'));
  assert.equal(imports.includes('./App.css'), false);
  assert.equal(imports.includes('../components/Header'), false);
});

test('NPM Client: buildImportMap constructs standard ESM CDN import maps', () => {
  const map = buildImportMap({
    'canvas-confetti': '^1.9.4',
    lodash: '4.17.21'
  });

  assert.equal(map.imports.react, 'https://esm.sh/react@18');
  assert.equal(map.imports['react-dom'], 'https://esm.sh/react-dom@18');
  assert.equal(map.imports['canvas-confetti'], 'https://esm.sh/canvas-confetti@1.9.4');
  assert.equal(map.imports.lodash, 'https://esm.sh/lodash@4.17.21');
  assert.equal(map.imports['lodash/'], 'https://esm.sh/lodash@4.17.21/');
});

test('NPM Client: fetchPackageMetadata queries official registry and extracts manifest', async () => {
  const meta = await fetchPackageMetadata('canvas-confetti');
  assert.equal(meta.success, true);
  assert.equal(meta.name, 'canvas-confetti');
  assert.ok(meta.version, 'Must have resolved version');
  assert.ok(meta.esmUrl.includes('canvas-confetti'), 'Must have esmUrl');
  assert.ok(meta.durationMs >= 0, 'Must record fetch timing');
});
