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
# Stage 6 (current): hardware validation & parameter tuning (issue #7).
# The campaign is 9 full sweeps: 3 with the default parameters (W=256, K=64)
# and 2 each of the alternatives (512,64), (256,128), (512,128). The server
# runs one instance per sweep; the client retries connect until the server
# instance is up, so the two scripts need not start at exactly the same time.
#   [6.1] make builds server + client (symlink) with zero warnings
#         (-O3 -Wall -Wextra, from a clean tree); client symlink to server
#   [6.3] client role only: ./client 127.0.0.1 with no server listening
#         exits non-zero, prints nothing (stdout and stderr), no hang
#   [6.4] both roles: all 9 sweeps run — per sweep, exit 0 and the client's
#         output is exactly the 21-line ex1 contract `size\t%.2f\tunit`
#         (sizes 2^0..2^20 ascending), nothing on stderr. A QP error on
#         either side fails its sweep here: bad completions print to stderr
#         and exit non-zero.
#   [6.5] client role only: variance across the 3 default-parameter sweeps
#         at the large sizes (64 KB and 1 MB) < 1% (coefficient of
#         variation) — the acceptance criterion ">= 3 full sweeps with
#         <1% variance at the large sizes"
#   [6.6] client role only: message-rate-bound scaling — in every sweep,
#         each size 1..32 B doubles throughput within +/-10% (the 5
#         doublings 2^0..2^5), the expected small-size regime
#   [6.7] client role only: the default-parameter envelope holds the
#         measured floors (ADR-0004/0005: 256 B and 1 KB >= 5.76 Gbps, the
#         inline plateau; 64 KB and 1 MB >= 34.2 Gbps, the DMA envelope),
#         1 MB >= 100x 1 B, peak never above the 56 Gb/s link rate
#   [6.8] client role only: parameter A/B — no alternative parameter set
#         beats the default's mean at any of the six anchor sizes (1 B,
#         32 B, 256 B, 1 KB, 64 KB, 1 MB) by >= 1%. If one does, the
#         hardware disagrees with the assumed 256/64 and the dev session
#         re-tunes the defaults from these numbers.
#   [6.9] client role only: the record — per-set anchor table and the
#         per-size mean/CV table of the default sweeps (the measured
#         envelope for ADR-0006)
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

# cv_at <line> <file...>: mean and coefficient of variation (%, sample sd)
# of the <line>-th value across the files: prints "mean cv".
cv_at() {
    local line="$1"
    shift
    awk -v line="$line" '
        FNR == line { m = 1;
            if ($3 == "Kbps") m = 1000;
            else if ($3 == "Mbps") m = 1000000;
            else if ($3 == "Gbps") m = 1000000000;
            v[++n] = ($2 + 0) * m / 1000000000 }
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
    awk '
        FNR <= 6 { m = 1;
            if ($3 == "Kbps") m = 1000;
            else if ($3 == "Mbps") m = 1000000;
            else if ($3 == "Gbps") m = 1000000000;
            v[FNR] = ($2 + 0) * m / 1000000000 }
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

# The campaign: 3 default sweeps then 2 per alternative set, in this order.
# W and K are client-side; the server runs one instance per sweep, identical
# each time (its flags stay at the defaults).
NSWEEPS=9
NSWEEPS_DEFAULT=3
NSWEEPS_ALT=2
SETS=("256:64" "256:64" "256:64"
      "512:64" "512:64"
      "256:128" "256:128"
      "512:128" "512:128")
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
    echo "    campaign: $NSWEEPS sweeps — $NSWEEPS_DEFAULT default (W=256, K=64)"
    echo "      + $NSWEEPS_ALT each of (512,64), (256,128), (512,128)"
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

# --- [6.3] Graceful failure when no server listens (client role only) -------

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

# --- [6.4] The 9-sweep campaign (both roles) --------------------------------
#
# Server side: one `./server` instance per sweep, in order. Each instance
# exits 0 only after all 21 dones and the teardown beat, printing nothing.
# Client side: one `./client` per sweep with the set's W/K flags (the default
# set gets no flags). The client retries connect until the server instance
# for this sweep is up — the pair's scripts may drift by seconds.

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
        set=${SETS[$((i - 1))]}
        out="$dir/sweep.$i.out"
        err="$dir/sweep.$i.err"
        rcfile="$dir/sweep.$i.rc"
        rc=0
        # The first attempts usually connect instantly; the retry covers the
        # server-side script starting late or its instance cycling.
        for attempt in $(seq 1 60); do
            if [ "$set" = "256:64" ]; then
                timeout 180 ./client "$peer" >"$out" 2>"$err"
            else
                timeout 180 ./client -r "${set%:*}" -k "${set#*:}" \
                    "$peer" >"$out" 2>"$err"
            fi
            rc=$?
            [ "$rc" -eq 0 ] && break
            sleep 2
        done
        echo "$rc" >"$rcfile"

        detail=$(contract_detail "$out")
        err_txt=$(cat "$err")
        if [ "$rc" -eq 0 ] && [ "$detail" = ok ] && [ -z "$err_txt" ]; then
            report "sweep $i/$NSWEEPS (W=${set%:*}, K=${set#*:}): contract OK" PASS
        else
            report "sweep $i/$NSWEEPS (W=${set%:*}, K=${set#*:}): contract OK" FAIL \
                   "rc=$rc contract='$detail' stderr='$(echo "$err_txt" | head -2)'"
        fi
    done

    # The analyses below use only the sweeps that actually produced a valid
    # 21-line contract — a failed sweep is reported above and must not leak
    # garbage into the statistics. The acceptance criteria need 3 valid
    # default sweeps; the A/B needs at least 2 per set.
    valid_defaults=()
    valid_alts=("" "" "")   # one entry per alternative set
    for i in $(seq 1 $NSWEEPS); do
        set=${SETS[$((i - 1))]}
        rc=$(cat "$dir/sweep.$i.rc")
        if [ "$rc" -eq 0 ] && [ "$(contract_detail "$dir/sweep.$i.out")" = ok ]; then
            case "$set" in
                256:64) valid_defaults+=("$dir/sweep.$i.out") ;;
                512:64)  valid_alts[0]+="$dir/sweep.$i.out " ;;
                256:128) valid_alts[1]+="$dir/sweep.$i.out " ;;
                512:128) valid_alts[2]+="$dir/sweep.$i.out " ;;
            esac
        fi
    done
    for j in 0 1 2; do
        valid_alts[$j]=${valid_alts[$j]% }
    done
    alt_labels=("512/64" "256/128" "512/128")
    ndef=${#valid_defaults[@]}
    echo "    valid sweeps: $ndef default, ${#valid_alts[0]} + ${#valid_alts[1]} + ${#valid_alts[2]} alternative"
    if [ "$ndef" -ge 3 ]; then
        report "3 valid default-parameter sweeps" PASS
    else
        report "3 valid default-parameter sweeps" FAIL \
               "only $ndef valid — rerun the campaign (see per-sweep failures above)"
    fi

    # --- [6.5] Variance at the large sizes across the default sweeps -------

    if [ "$ndef" -ge 3 ]; then
        for anchor in "17:64 KB" "21:1 MB"; do
            line=${anchor%%:*}
            label=${anchor#*:}
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

    # --- [6.6] Message-rate-bound scaling, every sweep ----------------------

    for i in $(seq 1 $NSWEEPS); do
        set=${SETS[$((i - 1))]}
        rc=$(cat "$dir/sweep.$i.rc")
        if [ "$rc" -eq 0 ] && [ "$(contract_detail "$dir/sweep.$i.out")" = ok ]; then
            d=$(scaling_1to32 "$dir/sweep.$i.out")
            if [ "$d" = ok ]; then
                report "sweep $i (W=${set%:*}, K=${set#*:}): 1..32 B doubles throughput" PASS
            else
                report "sweep $i (W=${set%:*}, K=${set#*:}): 1..32 B doubles throughput" FAIL \
                       "$d — not message-rate-bound?"
            fi
        else
            report "sweep $i (W=${set%:*}, K=${set#*:}): 1..32 B doubles throughput" FAIL \
                   "sweep invalid — see [6.4]"
        fi
    done

    # --- [6.7] Default envelope holds the measured floors -------------------

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
                  awk '{ m = 1; if ($3 == "Kbps") m = 1000;
                         else if ($3 == "Mbps") m = 1000000;
                         else if ($3 == "Gbps") m = 1000000000;
                         if (($2 + 0) * m / 1000000000 > max)
                             max = ($2 + 0) * m / 1000000000 }
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

    # --- [6.8] Parameter A/B: does the hardware agree with 256/64? ----------

    if [ "$ndef" -ge 3 ]; then
        alt_beats=""
        for j in 0 1 2; do
            [ "${#valid_alts[$j]}" -lt 2 ] && continue
            for ai in "${!ANCHOR_LINES[@]}"; do
                line=${ANCHOR_LINES[$ai]}
                label=${ANCHOR_LABELS[$ai]}
                set -- $(cv_at "$line" "${valid_defaults[@]}")
                dmean=$1
                set -- $(cv_at "$line" ${valid_alts[$j]})
                amean=$1
                if awk -v d="$dmean" -v a="$amean" 'BEGIN { exit !(a > d * 1.01) }'; then
                    alt_beats="$alt_beats $label(${alt_labels[$j]}) def=$dmean alt=$amean"
                fi
            done
        done
        if [ -z "$alt_beats" ]; then
            report "no alternative beats default (W=256, K=64) by >= 1%" PASS \
                   "defaults confirmed on this pair"
        else
            report "no alternative beats default (W=256, K=64) by >= 1%" FAIL \
                   "hardware disagrees with 256/64:$alt_beats"
        fi
    else
        report "no alternative beats default (W=256, K=64) by >= 1%" FAIL \
               "no statistics — see above"
    fi

    # --- [6.9] The record: anchor table and per-size envelope ----------------

    if [ "$ndef" -ge 3 ]; then
        printf '             --- anchor table (Gbps means) ---\n'
        printf '             %-10s %-18s %-14s %-14s %-14s\n' \
               anchor "default(n=$ndef)" "512/64" "256/128" "512/128"
        for ai in "${!ANCHOR_LINES[@]}"; do
            line=${ANCHOR_LINES[$ai]}
            label=${ANCHOR_LABELS[$ai]}
            set -- $(cv_at "$line" "${valid_defaults[@]}")
            printf '             %-10s %-18s' "$label" "$1"
            for j in 0 1 2; do
                if [ "${#valid_alts[$j]}" -ge 2 ]; then
                    set -- $(cv_at "$line" ${valid_alts[$j]})
                    printf ' %-14s' "$1"
                else
                    printf ' %-14s' "-"
                fi
            done
            printf '\n'
        done

        printf '             --- default sweep envelope (mean, CV) ---\n'
        for line in $(seq 1 21); do
            size=$(sed -n "${line}p" "${valid_defaults[0]}" | cut -f1)
            set -- $(cv_at "$line" "${valid_defaults[@]}")
            printf '             size %-7s %12.5f Gbps  CV %5.2f%%\n' \
                   "$size" "$1" "$2"
        done
        printf '             ---\n'
    else
        printf '             --- no record: fewer than 3 valid default sweeps ---\n'
    fi
fi

# --- Summary ----------------------------------------------------------------

echo "---"
echo "Summary: $pass passed, $fail failed (stage $stage, $role side)"
echo "Paste this report back into the dev session."
[ "$fail" -eq 0 ]
fi
