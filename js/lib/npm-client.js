/* ============================================================
   TOOLBOX — Official NPM Registry Client & Package Engine
   Directly queries https://registry.npmjs.org for live package manifests,
   resolves versions, dependencies, license metadata, and generates
   in-browser ESM CDN bundles.
   ============================================================ */

/**
 * Parses package specifiers like 'lodash', 'lodash@^4.17.21', or '@scope/pkg@1.0.0'
 */
export function parsePackageSpec(rawSpec) {
  const spec = String(rawSpec || '').trim();
  if (!spec) return { name: '', version: 'latest', raw: '' };

  if (spec.startsWith('@')) {
    const slashIdx = spec.indexOf('/');
    if (slashIdx === -1) {
      return { name: spec, version: 'latest', raw: spec };
    }
    const atIdx = spec.indexOf('@', slashIdx);
    if (atIdx !== -1) {
      return {
        name: spec.slice(0, atIdx),
        version: spec.slice(atIdx + 1) || 'latest',
        raw: spec
      };
    }
    return { name: spec, version: 'latest', raw: spec };
  }

  const atIdx = spec.indexOf('@');
  if (atIdx !== -1) {
    return {
      name: spec.slice(0, atIdx),
      version: spec.slice(atIdx + 1) || 'latest',
      raw: spec
    };
  }

  return { name: spec, version: 'latest', raw: spec };
}

/**
 * Queries official npm registry for live package metadata with CDN fallbacks.
 */
export async function fetchPackageMetadata(rawSpec) {
  const { name, version: requestedVersion } = parsePackageSpec(rawSpec);
  if (!name) throw new Error('Package name is required.');

  const encodedName = name.startsWith('@')
    ? `@${encodeURIComponent(name.slice(1))}`
    : encodeURIComponent(name);

  const startMs = Date.now();
  let registryUrl = `https://registry.npmjs.org/${encodedName}`;

  try {
    const res = await fetch(registryUrl, {
      headers: { Accept: 'application/json' }
    });

    if (res.ok) {
      const data = await res.json();
      const distTags = data['dist-tags'] || {};
      const versions = data.versions || {};

      let resolvedVer = requestedVersion;
      if (distTags[requestedVersion]) {
        resolvedVer = distTags[requestedVersion];
      } else if (requestedVersion === 'latest' || !versions[requestedVersion]) {
        resolvedVer = distTags.latest || Object.keys(versions).pop() || '1.0.0';
      }

      const verData = versions[resolvedVer] || data;
      const durationMs = Date.now() - startMs;

      return {
        success: true,
        source: 'registry.npmjs.org',
        url: registryUrl,
        durationMs,
        name: data.name || name,
        version: resolvedVer,
        description: verData.description || data.description || '',
        license: verData.license || data.license || 'MIT',
        homepage: verData.homepage || data.homepage || `https://www.npmjs.com/package/${name}`,
        dependencies: verData.dependencies || {},
        devDependencies: verData.devDependencies || {},
        dist: verData.dist || {},
        tarball: verData.dist?.tarball || '',
        esmUrl: `https://esm.sh/${name}@${resolvedVer}`,
        unpkgUrl: `https://unpkg.com/${name}@${resolvedVer}`
      };
    }
  } catch (err) {
    // Fall back to jsDelivr / unpkg
  }

  // Fallback 1: unpkg package.json
  try {
    const unpkgUrl = `https://unpkg.com/${name}@${requestedVersion || 'latest'}/package.json`;
    const res = await fetch(unpkgUrl);
    if (res.ok) {
      const pkgJson = await res.json();
      const durationMs = Date.now() - startMs;
      return {
        success: true,
        source: 'unpkg.com',
        url: unpkgUrl,
        durationMs,
        name: pkgJson.name || name,
        version: pkgJson.version || requestedVersion || '1.0.0',
        description: pkgJson.description || '',
        license: pkgJson.license || 'MIT',
        homepage: pkgJson.homepage || `https://www.npmjs.com/package/${name}`,
        dependencies: pkgJson.dependencies || {},
        devDependencies: pkgJson.devDependencies || {},
        dist: {},
        tarball: '',
        esmUrl: `https://esm.sh/${name}@${pkgJson.version || requestedVersion}`,
        unpkgUrl: `https://unpkg.com/${name}@${pkgJson.version || requestedVersion}`
      };
    }
  } catch {}

  throw new Error(`Package '${name}' not found on official npm registry or fallback CDNs.`);
}

/**
 * Searches the official npm registry for matching packages.
 */
export async function searchNpmPackages(query, size = 10) {
  const q = String(query || '').trim();
  if (!q) return [];

  const url = `https://registry.npmjs.org/-/v1/search?text=${encodeURIComponent(q)}&size=${size}`;
  try {
    const res = await fetch(url);
    if (!res.ok) return [];
    const data = await res.json();
    return (data.objects || []).map(obj => {
      const pkg = obj.package || {};
      return {
        name: pkg.name,
        version: pkg.version,
        description: pkg.description || '',
        keywords: pkg.keywords || [],
        publisher: pkg.publisher?.username || '',
        date: pkg.date || '',
        links: pkg.links || {}
      };
    });
  } catch {
    return [];
  }
}

/**
 * Extracts non-relative imported package names from JavaScript / JSX / TSX source.
 */
export function extractPackageImports(code) {
  if (!code || typeof code !== 'string') return [];
  const pkgs = new Set();

  // Match import ... from 'package-name' or import 'package-name'
  const importRegex = /(?:import\s+(?:[\w*\s{},]*\s+from\s+)?['"]([^'"]+)['"])|(?:require\(['"]([^'"]+)['"]\))/g;
  let match;
  while ((match = importRegex.exec(code)) !== null) {
    const raw = match[1] || match[2];
    if (raw && !raw.startsWith('.') && !raw.startsWith('/') && !raw.startsWith('http')) {
      // Normalize scoped or subpath imports: e.g. 'lodash/chunk' -> 'lodash'
      let pkgName = raw;
      if (pkgName.startsWith('@')) {
        const parts = pkgName.split('/');
        pkgName = parts.slice(0, 2).join('/');
      } else {
        pkgName = pkgName.split('/')[0];
      }
      if (pkgName) pkgs.add(pkgName);
    }
  }

  return Array.from(pkgs);
}

/**
 * Builds standard importmap object mapping workspace packages to esm.sh CDN bundles.
 */
export function buildImportMap(packages = {}) {
  const imports = {
    react: 'https://esm.sh/react@18',
    'react/': 'https://esm.sh/react@18/',
    'react-dom': 'https://esm.sh/react-dom@18',
    'react-dom/': 'https://esm.sh/react-dom@18/',
    'react-dom/client': 'https://esm.sh/react-dom@18/client'
  };

  const pkgEntries = Array.isArray(packages)
    ? packages.map(p => [typeof p === 'string' ? p : p.name, typeof p === 'string' ? 'latest' : (p.version || 'latest')])
    : Object.entries(packages);

  for (const [name, verOrObj] of pkgEntries) {
    if (!name || name === 'react' || name === 'react-dom') continue;
    const ver = typeof verOrObj === 'string' ? verOrObj.replace(/^[~^]/, '') : (verOrObj?.version || 'latest');
    imports[name] = `https://esm.sh/${name}@${ver}`;
    imports[`${name}/`] = `https://esm.sh/${name}@${ver}/`;
  }

  return { imports };
}
