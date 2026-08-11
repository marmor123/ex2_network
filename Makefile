# Lab #2 — Verbs throughput benchmark.
# `make` builds `server` from the single C source; `client` is a symlink to it.
# The role is decided by argv at runtime: no hostname argument = server,
# hostname argument = client (assignment invocation examples).

CC ?= gcc

# The compile gate requires this flag set; pinned so an environment CFLAGS
# cannot silently change what the gate checks. The -march/-mtune=native pair
# targets the build machine, so build on the node the benchmark runs on.
CFLAGS = -O3 -Wall -Wextra -march=native -mtune=native -flto -funroll-loops
LDLIBS = -libverbs

all: server client

server: bw.c
	$(CC) $(CFLAGS) -o $@ $< $(LDLIBS)

client: server
	ln -sf server client

clean:
	rm -f server client

.PHONY: all clean
