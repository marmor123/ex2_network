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
# Stage 4 (current): full sweep with the naive WRITE data path.
#   [4.1] make builds server + client (symlink) with zero warnings
#         (-O3 -Wall -Wextra, from a clean tree)
#   [4.2] server executable, client symlink to server
#   [4.3] client role only: ./client 127.0.0.1 with no server listening
#         exits non-zero, prints nothing (stdout and stderr), no hang
#   [4.4] both roles: run the two scripts simultaneously on the pair — the
#         client runs the full sweep (warmup + timed batches of RDMA
#         WRITEs per size, done/ack per size); the server absorbs the
#         WRITEs and acks each done; both exit 0
#   [4.5] client role only: exactly 21 stdout lines matching the ex1 output
#         contract `size\t%.2f\tunit` (sizes 2^0..2^20 ascending), nothing
#         on stderr
#   [4.6] client role only: plausibility — throughput message-rate-bound at
#         small sizes climbing to wire-bound at large sizes (1 MB >= 100x
#         1 B and >= 10 Gbps), never above the 56 Gb/s link rate

set -u

role=server
peer=""
if [ $# -ge 1 ]; then
    role=client
    peer="$1"
fi

stage=4
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

report_unchecked() { # report_unchecked <check> — sweep produced no parseable output
    report "client: $1" FAIL "nothing to check — $nlines line(s)"
}

echo "=== Lab #2 verify: stage $stage ($role side) ==="
[ "$role" = client ] && echo "    peer: $peer"

# --- [4.1] Build gate (both roles) ------------------------------------------

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

# --- [4.3] Graceful failure when no server listens (client role only) -------

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

# --- [4.4] Full sweep run (both roles) ---------------------------------------
#
# Run the two scripts at the same time on the pair: the client streams the
# WRITEs of each of the 21 sizes (warmup + timed batches) and drives one done
# SEND per size; the server absorbs the WRITEs into its buffer and acks every
# done. The server exits 0 only after all 21 dones; the client exits 0 after
# printing the 21 result lines.

if [ "$role" = server ]; then
    out=$(timeout 180 ./server 2>&1)
    rc=$?
    if [ "$rc" -eq 0 ] && [ -z "$out" ]; then
        report "server: full sweep, exit 0, nothing printed" PASS
    elif [ "$rc" -eq 124 ]; then
        report "server: full sweep, exit 0, nothing printed" FAIL \
               "timed out waiting for the client — is the other node's script running?"
    else
        report "server: full sweep, exit 0, nothing printed" FAIL \
               "exit code $rc, output: '$(echo "$out" | head -3)'"
    fi
else
    errf=$(mktemp)
    out=$(timeout 180 ./client "$peer" 2>"$errf")
    rc=$?
    err=$(cat "$errf")
    rm -f "$errf"

    if [ "$rc" -eq 0 ]; then
        report "client: full sweep exits 0" PASS
    elif [ "$rc" -eq 124 ]; then
        report "client: full sweep exits 0" FAIL \
               "timed out — is the server-side script running on $peer?"
    else
        report "client: full sweep exits 0" FAIL \
               "exit code $rc, stdout: '$(echo "$out" | head -3)'"
    fi

    # --- [4.5] Output contract: exactly 21 lines, ex1 format, empty stderr --

    nlines=$(printf '%s\n' "$out" | wc -l)
    if [ "$nlines" -eq 21 ]; then
        report "client: exactly 21 result lines" PASS
    else
        report "client: exactly 21 result lines" FAIL \
               "got $nlines line(s), expected 21"
    fi

    if [ "$nlines" -eq 21 ]; then
        # Each line: integer size, two-decimal value, bps/Kbps/Mbps/Gbps unit.
        bad=$(printf '%s\n' "$out" | awk '
            $1 ~ /^[0-9]+$/ && $2 ~ /^[0-9]+\.[0-9]{2}$/ && \
            $3 ~ /^(bps|Kbps|Mbps|Gbps)$/ { ok++ }
            END { print NR - ok }')
        if [ "$bad" -eq 0 ]; then
            report "client: all lines match size<TAB>value<TAB>unit" PASS
        else
            report "client: all lines match size<TAB>value<TAB>unit" FAIL \
                   "$bad line(s) off-contract"
        fi

        # Sizes ascend 2^0..2^20 — the ex1-identical sweep.
        sizes_bad=$(printf '%s\n' "$out" | awk '
            NR == 1 { if ($1 != 1) bad = 1; prev = 1; next }
            { if ($1 != prev * 2) bad = 1; prev = $1 }
            END { print bad + 0 }')
        if [ "$sizes_bad" -eq 0 ]; then
            report "client: sizes ascend 1 B..1 MB (powers of two)" PASS
        else
            report "client: sizes ascend 1 B..1 MB (powers of two)" FAIL
        fi
    else
        report_unchecked "all lines match size<TAB>value<TAB>unit"
        report_unchecked "sizes ascend 1 B..1 MB (powers of two)"
    fi

    if [ -z "$err" ]; then
        report "client: nothing on stderr" PASS
    else
        report "client: nothing on stderr" FAIL \
               "'$(echo "$err" | head -3)'"
    fi

    # --- [4.6] Plausibility: message-rate-bound at small sizes, wire-bound
    # at large sizes, never above the 56 Gb/s link rate (client role only) --

    if [ "$nlines" -eq 21 ]; then
        stats=$(printf '%s\n' "$out" | awk '
            function gbps(v, u,   m) {
                m = 1;
                if (u == "Kbps")      m = 1000;
                else if (u == "Mbps") m = 1000000;
                else if (u == "Gbps") m = 1000000000;
                return v * m / 1000000000;
            }
            NR == 1  { first = gbps($2 + 0, $3) }
            NR == 21 { last  = gbps($2 + 0, $3) }
            { v = gbps($2 + 0, $3); if (v > max) max = v }
            END { printf "%g %g %g", first, last, max }')
        set -- $stats
        first=$1; last=$2; max=$3

        if awk -v f="$first" -v l="$last" 'BEGIN { exit (l < f * 100) }'; then
            report "client: 1 MB >= 100x 1 B (rate-bound -> wire-bound)" PASS
        else
            report "client: 1 MB >= 100x 1 B (rate-bound -> wire-bound)" FAIL \
                   "1 B: $first Gbps, 1 MB: $last Gbps"
        fi

        if awk -v l="$last" 'BEGIN { exit (l < 10) }'; then
            report "client: 1 MB is wire-bound (>= 10 Gbps)" PASS
        else
            report "client: 1 MB is wire-bound (>= 10 Gbps)" FAIL \
                   "1 MB: $last Gbps"
        fi

        if awk -v m="$max" 'BEGIN { exit (m > 60) }'; then
            report "client: never above the 56 Gb/s link rate" PASS
        else
            report "client: never above the 56 Gb/s link rate" FAIL \
                   "peak $max Gbps exceeds the link rate"
        fi
    else
        report_unchecked "1 MB >= 100x 1 B (rate-bound -> wire-bound)"
        report_unchecked "1 MB is wire-bound (>= 10 Gbps)"
        report_unchecked "never above the 56 Gb/s link rate"
    fi
fi

# --- Summary ----------------------------------------------------------------

echo "---"
echo "Summary: $pass passed, $fail failed (stage $stage, $role side)"
echo "Paste this report back into the dev session."
[ "$fail" -eq 0 ]
