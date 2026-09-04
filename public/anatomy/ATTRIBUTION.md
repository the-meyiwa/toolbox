# Anatomy model — source and licence

The `.glb` files in this directory are **derived works** of the
**BodyParts3D** anatomical dataset.

> BodyParts3D, © 2008 Database Center for Life Science (DBCLS),
> licensed under [CC BY-SA 2.1 Japan](https://creativecommons.org/licenses/by-sa/2.1/jp/deed.en).
> Source: <https://lifesciencedb.jp/bp3d/>

## What was changed

The original release ships one binary STL per structure, in millimetres,
as an unindexed triangle soup. The build script (`scripts/anatomy-build.mjs`)
does the following and nothing else to the anatomy itself:

- scales millimetres to metres,
- welds coincident vertices into an indexed mesh,
- computes smooth vertex normals,
- simplifies toward a triangle budget so the set loads on a modest connection,
- groups structures into one GLB per body system,
- applies Draco compression.

No structure has been reshaped, added, or anatomically altered.

## What this means for you

CC BY-SA is a **share-alike** licence. If you redistribute these `.glb`
files, or anything derived from them, you must:

1. **Attribute** the source as shown above, and
2. **Licence the derivative under CC BY-SA** as well.

This obligation attaches to **the model files in this directory only**.
The Toolbox application code is a separate work that merely displays them,
and is not itself made share-alike by their inclusion — the same way that
bundling a CC BY-SA photograph in an application does not relicense the
application's source code.

If you ever need Toolbox to be free of share-alike obligations entirely,
delete this directory and the Anatomy Explorer tool with it.

## Regenerating

```bash
node scripts/anatomy-select.mjs   # downloads source STLs into .anatomy-src (git-ignored)
node scripts/anatomy-build.mjs    # writes the .glb files and index.json here
```

## Accuracy note

BodyParts3D is built from a single adult male dataset. It is a real
anatomical model, not a schematic, but it is one body — proportions and
variants differ between individuals, and it is not a substitute for a
dissection room, a cadaver, or a current clinical atlas.
