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
# Stage 5 (current): full sweep with the streaming data path — window,
# batched signaling (K WRs per ibv_post_send), refill-never-empty, and
# IBV_SEND_INLINE (ADR-0002).
#   [5.1] make builds server + client (symlink) with zero warnings
#         (-O3 -Wall -Wextra, from a clean tree)
#   [5.2] server executable, client symlink to server
#   [5.3] client role only: ./client 127.0.0.1 with no server listening
#         exits non-zero, prints nothing (stdout and stderr), no hang
#   [5.4] both roles: run the two scripts simultaneously on the pair — the
#         client runs the full sweep (warmup + timed batches of RDMA
#         WRITEs per size, done/ack per size); the server absorbs the
#         WRITEs and acks each done; both exit 0. A QP error on either
#         side fails this stage here: bad completions print to stderr
#         (bw_wc_bad) and exit non-zero, which [5.4]/[5.5] reject.
#   [5.5] client role only: exactly 21 stdout lines matching the ex1 output
#         contract `size\t%.2f\tunit` (sizes 2^0..2^20 ascending), nothing
#         on stderr
#   [5.6] client role only: plausibility — throughput message-rate-bound at
#         small sizes climbing to wire-bound at large sizes (1 MB >= 100x
#         1 B and >= 10 Gbps), never above the 56 Gb/s link rate
#   [5.7] client role only: A/B vs the T4 naive data path (ADR-0004) — the
#         pipeline pays, never regresses: 256 B and 1 KB hold the inline
#         plateau (~6.4 Gbps measured T4) and 64 KB and 1 MB hold the DMA
#         envelope (~38 Gbps measured T4), each within a 10% band

set -u

role=server
peer=""
if [ $# -ge 1 ]; then
    role=client
    peer="$1"
fi

stage=5
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

# --- [5.1] Build gate (both roles) ------------------------------------------

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

# --- [5.3] Graceful failure when no server listens (client role only) -------

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

# --- [5.4] Full sweep run (both roles) ---------------------------------------
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

    # --- [5.5] Output contract: exactly 21 lines, ex1 format, empty stderr --

    nlines=$(printf '%s\n' "$out" | wc -l)
    if [ "$nlines" -eq 21 ]; then
        report "client: exactly 21 result lines" PASS
        # The evidence: the measured sweep itself, so a PASS can be judged
        # against the raw numbers, not taken on faith.
        printf '             --- sweep output (raw) ---\n'
        printf '%s\n' "$out" | sed 's/^/             /'
        printf '             ---\n'
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

    # --- [5.6] Plausibility: message-rate-bound at small sizes, wire-bound
    # at large sizes, never above the 56 Gb/s link rate; [5.7] the A/B vs
    # the T4 naive envelope (client role only) --

    if [ "$nlines" -eq 21 ]; then
        # Lines 9/11/17/21 are the 256 B, 1 KB, 64 KB and 1 MB sizes
        # (2^0..2^20 ascending).
        stats=$(printf '%s\n' "$out" | awk '
            function gbps(v, u,   m) {
                m = 1;
                if (u == "Kbps")      m = 1000;
                else if (u == "Mbps") m = 1000000;
                else if (u == "Gbps") m = 1000000000;
                return v * m / 1000000000;
            }
            NR == 1  { first = gbps($2 + 0, $3) }
            NR == 9  { r256  = gbps($2 + 0, $3) }
            NR == 11 { kb    = gbps($2 + 0, $3) }
            NR == 17 { b64k  = gbps($2 + 0, $3) }
            NR == 21 { last  = gbps($2 + 0, $3) }
            { v = gbps($2 + 0, $3); if (v > max) max = v }
            END { printf "%g %g %g %g %g %g", first, r256, kb, b64k, last, max }')
        set -- $stats
        first=$1; r256=$2; kb=$3; b64k=$4; last=$5; max=$6

        if awk -v f="$first" -v l="$last" 'BEGIN { exit (l < f * 100) }'; then
            report "client: 1 MB >= 100x 1 B (rate-bound -> wire-bound)" PASS \
                   "1 B: $first Gbps, 1 MB: $last Gbps"
        else
            report "client: 1 MB >= 100x 1 B (rate-bound -> wire-bound)" FAIL \
                   "1 B: $first Gbps, 1 MB: $last Gbps"
        fi

        if awk -v l="$last" 'BEGIN { exit (l < 10) }'; then
            report "client: 1 MB is wire-bound (>= 10 Gbps)" PASS \
                   "1 MB: $last Gbps"
        else
            report "client: 1 MB is wire-bound (>= 10 Gbps)" FAIL \
                   "1 MB: $last Gbps"
        fi

        if awk -v m="$max" 'BEGIN { exit (m > 60) }'; then
            report "client: never above the 56 Gb/s link rate" PASS \
                   "peak: $max Gbps"
        else
            report "client: never above the 56 Gb/s link rate" FAIL \
                   "peak $max Gbps exceeds the link rate"
        fi

        # --- [5.7] A/B vs the T4 naive data path (ADR-0004) -----------------
        # The naive path measured a flat ~6.4 Gbps plateau at 256 B..1 KB
        # (the inline copy) and ~38 Gbps at 2 KB..1 MB (the DMA path), two
        # runs identical to three digits. The pipeline pays, never
        # regresses: hold the plateau at both its edges (256 B, 1 KB) and
        # the DMA envelope at two points — 64 KB engages the full window
        # (644 WRs fill W=256, unlike 1 MB's 84-WR stream), 1 MB anchors
        # the wire-bound rate — each within a 10% band, since shared
        # course nodes can depress a run. The floors guard the measured
        # rates, not the paths: on this stack the HCA inlines small
        # messages regardless of the flag (ADR-0004), so the 1 KB floor
        # holds the plateau, it cannot distinguish inline from DMA.

        if awk -v r256="$r256" 'BEGIN { exit (r256 < 5.76) }'; then
            report "client: 256 B holds the inline plateau (A/B vs naive)" PASS \
                   "256 B: $r256 Gbps (T4 naive: ~6.4)"
        else
            report "client: 256 B holds the inline plateau (A/B vs naive)" FAIL \
                   "256 B: $r256 Gbps (T4 naive: ~6.4)"
        fi

        if awk -v kb="$kb" 'BEGIN { exit (kb < 5.76) }'; then
            report "client: 1 KB holds the inline plateau (A/B vs naive)" PASS \
                   "1 KB: $kb Gbps (T4 naive: ~6.4)"
        else
            report "client: 1 KB holds the inline plateau (A/B vs naive)" FAIL \
                   "1 KB: $kb Gbps (T4 naive: ~6.4)"
        fi

        if awk -v b64k="$b64k" 'BEGIN { exit (b64k < 34.2) }'; then
            report "client: 64 KB holds the DMA envelope (A/B vs naive)" PASS \
                   "64 KB: $b64k Gbps (T4 naive: ~38)"
        else
            report "client: 64 KB holds the DMA envelope (A/B vs naive)" FAIL \
                   "64 KB: $b64k Gbps (T4 naive: ~38)"
        fi

        if awk -v l="$last" 'BEGIN { exit (l < 34.2) }'; then
            report "client: 1 MB holds the DMA envelope (A/B vs naive)" PASS \
                   "1 MB: $last Gbps (T4 naive: ~38)"
        else
            report "client: 1 MB holds the DMA envelope (A/B vs naive)" FAIL \
                   "1 MB: $last Gbps (T4 naive: ~38)"
        fi
    else
        report_unchecked "1 MB >= 100x 1 B (rate-bound -> wire-bound)"
        report_unchecked "1 MB is wire-bound (>= 10 Gbps)"
        report_unchecked "never above the 56 Gb/s link rate"
        report_unchecked "256 B holds the inline plateau (A/B vs naive)"
        report_unchecked "1 KB holds the inline plateau (A/B vs naive)"
        report_unchecked "64 KB holds the DMA envelope (A/B vs naive)"
        report_unchecked "1 MB holds the DMA envelope (A/B vs naive)"
    fi
fi

# --- Summary ----------------------------------------------------------------

echo "---"
echo "Summary: $pass passed, $fail failed (stage $stage, $role side)"
echo "Paste this report back into the dev session."
[ "$fail" -eq 0 ]
