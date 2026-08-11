#!/usr/bin/env bash
#
# Lab #2 verification script — stage 6 (T6): the measurement campaign.
# Run it on both nodes of a course pair, mirroring the benchmark's role
# dispatch (no host argument = server side, host argument = client side):
#
#   ./verify.sh               # on mlxstud01 (server side)
#   ./verify.sh mlxstud01     # on mlxstud02 (client side)
#   ./verify.sh --final       # server side, final campaign (mlxstud03/04)
#   ./verify.sh mlxstud03 --final   # client side, final campaign
#
# Each stage's checks are run for the role in question, and a structured
# PASS/FAIL report is printed — paste it back into the dev session.
# This script is a dev workflow tool; it is NOT part of the submission archive.
#
# Stage 6 (current): hardware validation on the fixed parameters (issue #7).
# The -r/-k options are gone — bw.c bakes W=256, K=64 in (the tuning campaign
# agreed with the defaults, ADR-0006/0007) — so the campaign is 3 full sweeps
# with the fixed parameters. The server runs one instance per sweep; the
# client retries connect until the server instance is up, so the two scripts
# need not start at exactly the same time.
#   [6.1] make builds server + client (symlink) with zero warnings
#         (-O3 -Wall -Wextra, from a clean tree); client symlink to server
#   [6.2] client role only: ./client 127.0.0.1 with no server listening
#         exits non-zero, prints nothing (stdout and stderr), no hang
#   [6.3] both roles: all 3 sweeps run — per sweep, exit 0 and the client's
#         output is exactly the 21-line ex1 contract `size\t%.2f\tunit`
#         (sizes 2^0..2^20 ascending), nothing on stderr. A QP error on
#         either side fails its sweep here: bad completions print to stderr
#         and exit non-zero.
#   [6.4] client role only: variance across the 3 sweeps at the large sizes
#         (64 KB and 1 MB) < 1% (coefficient of variation) — the acceptance
#         criterion ">= 3 full sweeps with <1% variance at the large sizes"
#   [6.5] client role only: message-rate-bound scaling — in every sweep,
#         each size 1..32 B doubles throughput within +/-10% (the 5
#         doublings 2^0..2^5), the expected small-size regime
#   [6.6] client role only: the fixed-parameter envelope holds the measured
#         floors (ADR-0004/0005: 256 B and 1 KB >= 5.76 Gbps, the inline
#         plateau; 64 KB and 1 MB >= 34.2 Gbps, the DMA envelope),
#         1 MB >= 100x 1 B, peak never above the 56 Gb/s link rate
#   [6.7] client role only: the record — the per-size mean/CV table of the
#         sweeps (the measured envelope for ADR-0006)
#
# The sweep outputs are kept in a temp dir whose path is printed, so
# individual sweeps can be re-inspected or re-pasted after the fact.

set -u

stage=6

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

# ---------------------------------------------------------------------------
# Parse/compute helpers. Sourced by the script's own checks; also sourceable
# standalone to test the math on synthetic sweeps (dev session, no hardware).
# A sweep file is the client's raw stdout: 21 lines of size<TAB>value<TAB>unit.
# ---------------------------------------------------------------------------

# The Kbps/Mbps/Gbps -> Gbps conversion, shared by the awk helpers below:
# prepend awk_gbps_func to an awk program; gbps($2 + 0, $3) returns the
# sweep line's value in Gbps.
awk_gbps_func='function gbps(v, u, m) {
    m = 1;
    if (u == "Kbps") m = 1000;
    else if (u == "Mbps") m = 1000000;
    else if (u == "Gbps") m = 1000000000;
    return v * m / 1000000000 }'

# cv_at <line> <file...>: mean and coefficient of variation (%, sample sd)
# of the <line>-th value across the files: prints "mean cv".
cv_at() {
    local line="$1"
    shift
    # The function snippet and the rules must be ONE awk argument (a second
    # argument would be read as a filename), hence the adjacent strings.
    awk -v line="$line" "$awk_gbps_func"'
        FNR == line { v[++n] = gbps($2 + 0, $3) }
        END {
            for (i = 1; i <= n; i++) { s += v[i]; s2 += v[i] * v[i] }
            mean = (n > 0) ? s / n : 0
            tmp = s2 - n * mean * mean
            sd = (n > 1 && tmp > 0) ? sqrt(tmp / (n - 1)) : 0
            cv = (mean > 0) ? 100 * sd / mean : 100
            printf "%g %g", mean, cv }' "$@"
}

# contract_detail <file>: "ok" or a short reason — exactly 21 lines, every
# line `size<TAB>value<TAB>unit` with value %.2f, sizes 2^0..2^20 ascending.
contract_detail() {
    awk '
        { ok = $1 ~ /^[0-9]+$/ && $2 ~ /^[0-9]+\.[0-9]{2}$/ &&
              $3 ~ /^(bps|Kbps|Mbps|Gbps)$/
          if (NR == 1) { if ($1 != 1) bad = 1 }
          else if ($1 != prev * 2) bad = 1
          prev = $1
          if (!ok) bad = 1 }
        END {
            if (NR != 21) { print NR " lines, expected 21"; exit }
            if (bad) { print "size/format off-contract"; exit }
            print "ok" }' "$1"
}

# scaling_1to32 <file>: "ok" or "off: 2^N -> 2^(N+1) ratio R" — in the
# message-rate-bound regime throughput doubles with size (same msg rate,
# double the bytes), measured to within <1% on the dev pair (ADR-0005).
scaling_1to32() {
    awk "$awk_gbps_func"'
        FNR <= 6 { v[FNR] = gbps($2 + 0, $3) }
        FNR == 6 {
            for (i = 1; i < 6; i++) {
                r = v[i + 1] / v[i]
                if (r < 1.8 || r > 2.2) {
                    printf "off: 2^%d -> 2^%d ratio %g", i - 1, i, r
                    exit
                }
            }
            print "ok" }' "$1"
}

# sweep_valid <rcfile> <outfile>: the sweep exited 0 and produced a clean
# 21-line contract — the gate every analysis below applies.
sweep_valid() {
    [ "$(cat "$1")" -eq 0 ] && [ "$(contract_detail "$2")" = ok ]
}

# ---------------------------------------------------------------------------
# Campaign setup. The whole campaign body is guarded so the file can also be
# sourced (only report() and the helpers above are defined) — the dev session
# sources it to test the parse/compute math on synthetic sweeps.
# ---------------------------------------------------------------------------

if [ "${BASH_SOURCE[0]}" = "$0" ]; then

role=server
peer=""
final=0
for arg in "$@"; do
    case "$arg" in
        --final) final=1 ;;
        *)       if [ -z "$peer" ]; then peer="$arg"; role=client; fi ;;
    esac
done

# The campaign: 3 sweeps with the fixed parameters (W=256, K=64 — baked in,
# the option-era -r/-k are gone). The server runs one instance per sweep,
# identical each time.
NSWEEPS=3
# Six anchor sizes cover the three regimes (ADR-0004): 1 B/32 B message-rate,
# 256 B/1 KB inline plateau, 64 KB/1 MB DMA envelope. Parallel arrays (the
# labels contain spaces, so a word-splitting list would tear them apart).
ANCHOR_LINES=(1 6 9 11 17 21)
ANCHOR_LABELS=("1 B" "32 B" "256 B" "1 KB" "64 KB" "1 MB")

pass=0
fail=0

echo "=== Lab #2 verify: stage $stage ($role side)$([ "$final" = 1 ] && echo ' — FINAL CAMPAIGN') ==="
[ "$role" = client ] && echo "    peer: $peer"
if [ "$role" = client ]; then
    echo "    campaign: $NSWEEPS sweeps (W=256, K=64, fixed)"
fi

# --- [6.1] Build gate (both roles) ------------------------------------------

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

# --- [6.2] Graceful failure when no server listens (client role only) -------

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

# --- [6.3] The 9-sweep campaign (both roles) --------------------------------
#
# Server side: one `./server` instance per sweep, in order. Each instance
# exits 0 only after all 21 dones and the teardown beat, printing nothing.
# Client side: one `./client` per sweep — the parameters are baked in. The
# client retries connect until the server instance for this sweep is up —
# the pair's scripts may drift by seconds.

if [ "$role" = server ]; then
    for i in $(seq 1 $NSWEEPS); do
        out=$(timeout 180 ./server 2>&1)
        rc=$?
        if [ "$rc" -eq 0 ] && [ -z "$out" ]; then
            report "server instance $i/$NSWEEPS: exit 0, nothing printed" PASS
        elif [ "$rc" -eq 124 ]; then
            report "server instance $i/$NSWEEPS: exit 0, nothing printed" FAIL \
                   "timed out waiting for the client — is the other node's script running?"
        else
            report "server instance $i/$NSWEEPS: exit 0, nothing printed" FAIL \
                   "exit code $rc, output: '$(echo "$out" | head -3)'"
        fi
    done
else
    dir=$(mktemp -d)
    echo "    sweep outputs: $dir (re-paste from there if asked)"
    for i in $(seq 1 $NSWEEPS); do
        out="$dir/sweep.$i.out"
        err="$dir/sweep.$i.err"
        rcfile="$dir/sweep.$i.rc"
        rc=0
        # The first attempts usually connect instantly; the retry covers the
        # server-side script starting late or its instance cycling.
        for attempt in $(seq 1 60); do
            timeout 180 ./client "$peer" >"$out" 2>"$err"
            rc=$?
            [ "$rc" -eq 0 ] && break
            # A QP error prints to stderr and must fail this sweep (the
            # [6.2]/[6.3] contract), not be retried; only silent failures —
            # the server instance not up yet — are retried.
            [ -s "$err" ] && break
            sleep 2
        done
        echo "$rc" >"$rcfile"

        detail=$(contract_detail "$out")
        err_txt=$(cat "$err")
        if [ "$rc" -eq 0 ] && [ "$detail" = ok ] && [ -z "$err_txt" ]; then
            report "sweep $i/$NSWEEPS (W=256, K=64): contract OK" PASS
        else
            report "sweep $i/$NSWEEPS (W=256, K=64): contract OK" FAIL \
                   "rc=$rc contract='$detail' stderr='$(echo "$err_txt" | head -2)'"
        fi
    done

    # The analyses below use only the sweeps that actually produced a valid
    # 21-line contract — a failed sweep is reported above and must not leak
    # garbage into the statistics. The acceptance criteria need 3 valid
    # sweeps.
    valid_defaults=()
    for i in $(seq 1 $NSWEEPS); do
        if sweep_valid "$dir/sweep.$i.rc" "$dir/sweep.$i.out"; then
            valid_defaults+=("$dir/sweep.$i.out")
        fi
    done
    ndef=${#valid_defaults[@]}
    echo "    valid sweeps: $ndef"
    if [ "$ndef" -ge 3 ]; then
        report "3 valid sweeps" PASS
    else
        report "3 valid sweeps" FAIL \
               "only $ndef valid — rerun the campaign (see per-sweep failures above)"
    fi

    # --- [6.4] Variance at the large sizes across the default sweeps -------

    if [ "$ndef" -ge 3 ]; then
        for ai in 4 5; do
            line=${ANCHOR_LINES[$ai]}
            label=${ANCHOR_LABELS[$ai]}
            set -- $(cv_at "$line" "${valid_defaults[@]}")
            mean=$1; cv=$2
            if awk -v cv="$cv" 'BEGIN { exit (cv >= 1) }'; then
                report "variance < 1% at $label (n=$ndef)" PASS \
                       "mean $mean Gbps, CV $cv%"
            else
                report "variance < 1% at $label (n=$ndef)" FAIL \
                       "mean $mean Gbps, CV $cv% — shared node? rerun when quiet"
            fi
        done
    else
        report "variance < 1% at 64 KB (n>=3)" FAIL "no statistics — see above"
        report "variance < 1% at 1 MB (n>=3)" FAIL "no statistics — see above"
    fi

    # --- [6.5] Message-rate-bound scaling, every sweep ----------------------

    for i in $(seq 1 $NSWEEPS); do
        if sweep_valid "$dir/sweep.$i.rc" "$dir/sweep.$i.out"; then
            d=$(scaling_1to32 "$dir/sweep.$i.out")
            if [ "$d" = ok ]; then
                report "sweep $i (W=256, K=64): 1..32 B doubles throughput" PASS
            else
                report "sweep $i (W=256, K=64): 1..32 B doubles throughput" FAIL \
                       "$d — not message-rate-bound?"
            fi
        else
            report "sweep $i (W=256, K=64): 1..32 B doubles throughput" FAIL \
                   "sweep invalid — see [6.3]"
        fi
    done

    # --- [6.6] Default envelope holds the measured floors -------------------

    if [ "$ndef" -ge 3 ]; then
        set -- $(cv_at 1 "${valid_defaults[@]}")
        first=$1
        set -- $(cv_at 9 "${valid_defaults[@]}")
        r256=$1
        set -- $(cv_at 11 "${valid_defaults[@]}")
        kb=$1
        set -- $(cv_at 17 "${valid_defaults[@]}")
        b64k=$1
        set -- $(cv_at 21 "${valid_defaults[@]}")
        last=$1
        max=$(for f in "${valid_defaults[@]}"; do
                  awk "$awk_gbps_func"'
                      { if (gbps($2 + 0, $3) > max) max = gbps($2 + 0, $3) }
                      END { print max + 0 }' "$f"
              done | sort -n | tail -1)

        floors_ok=1
        awk -v v="$r256" 'BEGIN { exit (v < 5.76) }' || floors_ok=0
        awk -v v="$kb"   'BEGIN { exit (v < 5.76) }' || floors_ok=0
        awk -v v="$b64k" 'BEGIN { exit (v < 34.2) }' || floors_ok=0
        awk -v v="$last" 'BEGIN { exit (v < 34.2) }' || floors_ok=0
        awk -v f="$first" -v l="$last" 'BEGIN { exit (l < f * 100) }' || floors_ok=0
        awk -v m="$max" 'BEGIN { exit (m > 60) }' || floors_ok=0

        if [ "$floors_ok" -eq 1 ]; then
            report "default envelope holds measured floors (ADR-0004/0005)" PASS \
                   "1 B: $first, 256 B: $r256, 1 KB: $kb, 64 KB: $b64k, 1 MB: $last Gbps, peak: $max"
        else
            report "default envelope holds measured floors (ADR-0004/0005)" FAIL \
                   "1 B: $first, 256 B: $r256, 1 KB: $kb, 64 KB: $b64k, 1 MB: $last Gbps, peak: $max"
        fi
    else
        report "default envelope holds measured floors (ADR-0004/0005)" FAIL \
               "no statistics — see above"
    fi

    # --- [6.7] The record: the per-size envelope -----------------------------

    if [ "$ndef" -ge 3 ]; then
        printf '             --- sweep envelope (mean, CV) ---\n'
        for line in $(seq 1 21); do
            size=$(sed -n "${line}p" "${valid_defaults[0]}" | cut -f1)
            set -- $(cv_at "$line" "${valid_defaults[@]}")
            printf '             size %-7s %12.5f Gbps  CV %5.2f%%\n' \
                   "$size" "$1" "$2"
        done
        printf '             ---\n'
    else
        printf '             --- no record: fewer than 3 valid sweeps ---\n'
    fi
fi

# --- Summary ----------------------------------------------------------------

echo "---"
echo "Summary: $pass passed, $fail failed (stage $stage, $role side)"
echo "Paste this report back into the dev session."
[ "$fail" -eq 0 ]
fi
