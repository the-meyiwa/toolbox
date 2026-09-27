#!/bin/sh
# Builds public/wasm/kl.wasm from kl.c with plain clang + wasm-ld; no Emscripten.
set -e
cd "$(dirname "$0")"
clang --target=wasm32 -O3 -nostdlib -ffreestanding -mbulk-memory -Iinclude \
  -Wall -Wno-unused-function -Wno-unused-variable -Wno-unused-but-set-variable \
  -Wl,--no-entry -Wl,--export-dynamic -Wl,--initial-memory=16777216 -Wl,--max-memory=2147483648 \
  -o ../../public/wasm/kl.wasm kl_wasm.c
ls -l ../../public/wasm/kl.wasm
