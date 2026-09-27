/* Just enough stdio for kl.c to compile. The wasm build never reaches the
   CLI (main is renamed away) and its diagnostics go nowhere. */
#pragma once
#include <stddef.h>
typedef struct kl_file FILE;
#define stderr ((FILE *)0)
#define stdout ((FILE *)0)
#define SEEK_SET 0
#define SEEK_END 2
static inline int fprintf(FILE *f, const char *fmt, ...) { (void)f; (void)fmt; return 0; }
static inline int printf(const char *fmt, ...) { (void)fmt; return 0; }
static inline void perror(const char *s) { (void)s; }
static inline FILE *fopen(const char *p, const char *m) { (void)p; (void)m; return 0; }
static inline int fclose(FILE *f) { (void)f; return 0; }
static inline int fseek(FILE *f, long o, int w) { (void)f; (void)o; (void)w; return -1; }
static inline long ftell(FILE *f) { (void)f; return 0; }
static inline size_t fread(void *p, size_t s, size_t n, FILE *f) { (void)p; (void)s; (void)n; (void)f; return 0; }
static inline size_t fwrite(const void *p, size_t s, size_t n, FILE *f) { (void)p; (void)s; (void)n; (void)f; return 0; }
