#!/usr/bin/env bash
#
# Lab #2 verification script — run it on both nodes of a course pair, mirroring
# the benchmark's role dispatch (no host argument = server side, host argument =
# client side):
#
#   ./verify.sh            # on mlxstud01 (server side)
#   ./verify.sh mlxstud01  # on mlxstud02 (client side)
#
# Each stage's checks are run for the role in question, and a structured
# PASS/FAIL report is printed — paste it back into the dev session.
# This script is a dev workflow tool; it is NOT part of the submission archive.
#
# Stage 1 (current): build gate + graceful failure.
#   [1.1] make builds server + client (symlink) with zero warnings
#         (-O3 -Wall -Wextra, from a clean tree)
#   [1.2] client role only: ./client 127.0.0.1 with no server listening
#         exits non-zero, prints nothing (stdout and stderr), no hang

set -u

role=server
peer=""
if [ $# -ge 1 ]; then
    role=client
    peer="$1"
fi

stage=1
pass=0
fail=0

report() { # report <check> <PASS|FAIL> [detail ...]
    local check="$1" status="$2"
    shift 2
    if [ "$status" = PASS ]; then
        pass=$((pass + 1))
    else
        fail=$((fail + 1))
    fi
    printf '[stage %d] %-56s %s\n' "$stage" "$check" "$status"
    for d in "$@"; do
        printf '             %s\n' "$d"
    done
}

echo "=== Lab #2 verify: stage $stage ($role side) ==="
[ "$role" = client ] && echo "    peer: $peer"

# --- [1.1] Build gate (both roles) ------------------------------------------

build_warns=$(make clean >/dev/null 2>&1; make 2>&1 >/dev/null)
if [ $? -eq 0 ] && [ -z "$build_warns" ]; then
    report "make builds server and client with zero warnings" PASS
else
    report "make builds server and client with zero warnings" FAIL \
           "$(echo "$build_warns" | head -5)"
fi

if [ -x server ] && [ -L client ] && [ "$(readlink client)" = server ]; then
    report "server executable, client symlink to server" PASS
else
    report "server executable, client symlink to server" FAIL
fi

# --- [1.2] Graceful failure when no server listens (client role only) -------

if [ "$role" = client ]; then
    out=$(timeout 10 ./client 127.0.0.1 2>&1)
    rc=$?
    if [ "$rc" -eq 124 ]; then
        report "./client 127.0.0.1 fails gracefully (no server)" FAIL \
               "client hung for 10 s — something is listening on the default port on this node?"
    elif [ "$rc" -ne 0 ] && [ -z "$out" ]; then
        report "./client 127.0.0.1 fails gracefully (no server)" PASS
    else
        report "./client 127.0.0.1 fails gracefully (no server)" FAIL \
               "exit code $rc, output: '$(echo "$out" | head -3)'"
    fi
fi

# --- Summary ----------------------------------------------------------------

echo "---"
echo "Summary: $pass passed, $fail failed (stage $stage, $role side)"
echo "Paste this report back into the dev session."
[ "$fail" -eq 0 ]
