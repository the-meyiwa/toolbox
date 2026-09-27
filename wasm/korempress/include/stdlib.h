#pragma once
#include <stddef.h>
void *malloc(size_t n);
void *calloc(size_t n, size_t s);
void free(void *p);
static inline char *getenv(const char *k) { (void)k; return 0; }
static inline int atoi(const char *s) { int v = 0, neg = 0; if (*s == '-') { neg = 1; s++; } while (*s >= '0' && *s <= '9') v = v * 10 + (*s++ - '0'); return neg ? -v : v; }
