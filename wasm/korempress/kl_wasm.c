/* WebAssembly entry points for the Korempress `kl` codec.

   kl.c is included unchanged (see LICENSE, MIT, Ogheneovo Segba); its CLI
   `main` is renamed out of the way and the handful of libc calls it makes
   are served by ./include plus the allocator below. Build with ./build.sh. */

#define main kl_cli_main
#include "kl.c"
#undef main

/* ---------- allocator ----------
   An implicit-list first-fit allocator over linear memory. kl makes a few
   dozen large allocations per call, so walking every block is cheap and
   coalescing on the walk keeps level 9 (dozens of passes, each freeing what
   it took) inside a flat footprint instead of growing without bound. */

extern unsigned char __heap_base;
#define HDR 16u
#define PAGE 65536u
static size_t heap_start, heap_end;          /* [start, end) holds blocks */

static inline size_t *hdr(size_t b) { return (size_t *)b; }
#define BSIZE(b) (hdr(b)[0])
#define BUSED(b) (hdr(b)[1])

static int grow_to(size_t end) {
  size_t have = __builtin_wasm_memory_size(0) * PAGE;
  if (end <= have) return 1;
  size_t pages = (end - have + PAGE - 1) / PAGE;
  return __builtin_wasm_memory_grow(0, pages) != (size_t)-1;
}

void *malloc(size_t n) {
  if (!heap_start) { heap_start = heap_end = ((size_t)&__heap_base + 15) & ~(size_t)15; }
  size_t need = ((n + 15) & ~(size_t)15) + HDR;
  if (need < n) return 0;
  size_t last = 0;
  for (size_t b = heap_start; b < heap_end; b += BSIZE(b)) {
    if (!BUSED(b)) {
      size_t nx = b + BSIZE(b);
      while (nx < heap_end && !BUSED(nx)) { BSIZE(b) += BSIZE(nx); nx = b + BSIZE(b); }
      if (BSIZE(b) >= need) {
        if (BSIZE(b) - need >= 64) {
          size_t rest = b + need;
          BSIZE(rest) = BSIZE(b) - need; BUSED(rest) = 0;
          BSIZE(b) = need;
        }
        BUSED(b) = 1;
        return (void *)(b + HDR);
      }
    }
    last = b;
  }
  /* Nothing fits: extend the heap, reusing a free tail block if there is one. */
  size_t b = (last && !BUSED(last)) ? last : heap_end;
  if (!grow_to(b + need)) return 0;
  BSIZE(b) = need; BUSED(b) = 1;
  heap_end = b + need;
  return (void *)(b + HDR);
}

void free(void *p) { if (p) BUSED((size_t)p - HDR) = 0; }

void *calloc(size_t n, size_t s) {
  size_t t = n * s;
  if (s && t / s != n) return 0;
  void *p = malloc(t);
  if (p) __builtin_memset(p, 0, t);
  return p;
}

/* ---------- exports ---------- */

#define EXPORT(name) __attribute__((export_name(#name)))

EXPORT(kl_alloc) void *kl_alloc(size_t n) { return malloc(n); }
EXPORT(kl_free) void kl_free(void *p) { free(p); }
/* Worst case the codec may write for n input bytes; the CLI sizes the same way. */
EXPORT(kl_bound) size_t kl_bound(size_t n) { return n * 2 + 4096; }
EXPORT(kl_encode) size_t kl_encode(const uint8_t *src, size_t n, uint8_t *dst, int level) {
  if (level < 1) level = 1;
  if (level > 9) level = 9;
  return kl_compress(src, n, dst, level);
}
/* Declared length of a block, read before allocating its output. */
EXPORT(kl_raw_length) uint32_t kl_raw_length(const uint8_t *src, size_t n) { return n >= 5 ? ld32(src + 1) : 0; }
EXPORT(kl_decode) size_t kl_decode(const uint8_t *src, size_t n, uint8_t *dst) {
  size_t r = kl_decompress(src, n, dst);
  kl_release();
  return r;
}
