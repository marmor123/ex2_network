# Lab #2 — Verbs throughput benchmark.
# `make` builds `server` from the single C source; `client` is a symlink to it.
# The role is decided by argv at runtime: no hostname argument = server,
# hostname argument = client (assignment invocation examples).

CC ?= gcc

# The compile gate requires exactly this flag set; pinned so an environment
# CFLAGS cannot silently change what the gate checks.
CFLAGS = -O3 -Wall -Wextra
LDLIBS = -libverbs

all: server client

server: bw.c
	$(CC) $(CFLAGS) -o $@ $< $(LDLIBS)

client: server
	ln -sf server client

clean:
	rm -f server client

.PHONY: all clean
