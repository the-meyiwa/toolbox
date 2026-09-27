#pragma once
struct timespec { long long tv_sec; long tv_nsec; };
#define CLOCK_MONOTONIC 1
static inline int clock_gettime(int c, struct timespec *t) { (void)c; t->tv_sec = 0; t->tv_nsec = 0; return 0; }
