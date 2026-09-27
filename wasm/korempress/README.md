# Korempress `kl` codec for the browser

`kl.c` is the codec from [thatcrazydave/Korempress](https://github.com/thatcrazydave/Korempress)
(MIT, see `LICENSE`), included unchanged. `kl_wasm.c` renames its CLI `main`
away, supplies a small first-fit allocator and exports the entry points;
`include/` holds just enough of a libc for it to compile.

```sh
./build.sh      # plain clang + wasm-ld, no Emscripten → public/wasm/kl.wasm
```

The output is byte-identical to the native build at every level. The PDF
container (`js/lib/korempress/container.js`) is a port of
`container/pdf_container_own_codecs.py` and reads and writes the same `OWN1`
format, so archives move between the browser and the command-line tool
(blocks coded with `cm` are not supported in the browser).
