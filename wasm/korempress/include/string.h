#pragma once
#include <stddef.h>
/* Built with -mbulk-memory, so these lower to memory.copy / memory.fill. */
#define memcpy(d, s, n) __builtin_memcpy((d), (s), (n))
#define memmove(d, s, n) __builtin_memmove((d), (s), (n))
#define memset(d, v, n) __builtin_memset((d), (v), (n))
static inline int memcmp(const void *a, const void *b, size_t n) {
  const unsigned char *x = (const unsigned char *)a, *y = (const unsigned char *)b;
  for (size_t i = 0; i < n; i++) if (x[i] != y[i]) return x[i] - y[i];
  return 0;
}
