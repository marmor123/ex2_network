#!/usr/bin/env bash
#
# Compares throughput of main (rebuilding WRs per refill) vs
# experiment/prebuilt-wr-list (pre-building the WR linked list once per size).
#
# Builds both binaries:
#   - client_main (from git ref main)
#   - client_prebuilt (from the current working directory / branch)
#
# Runs both against the server for N iterations each and prints a side-by-side
# throughput (Gbps) comparison and % difference per message size.
#
# Usage:
#   ./scripts/compare_prebuilt.sh [peer_host] [n_runs]
#
# Examples:
#   ./scripts/compare_prebuilt.sh mlx-stud-01 10
#   ./scripts/compare_prebuilt.sh mlx-stud-03 5
#

set -u

PEER="${1:-mlx-stud-01}"
N="${2:-10}"
TOTAL_SERVER_RUNS=$(( 2 * N ))

echo "================================================================="
echo "  Verbs Benchmark Comparison: main vs prebuilt-wr-list"
echo "================================================================="
echo "Target Peer Host : $PEER"
echo "Runs per Version : $N (Total runs: $TOTAL_SERVER_RUNS)"
echo
echo "SERVER REQUIREMENT:"
echo "Please ensure the server loop is running on $PEER for $TOTAL_SERVER_RUNS runs:"
echo "  ssh $PEER 'cd ~/networking/ex2/ex2_network && for i in \$(seq 1 $TOTAL_SERVER_RUNS); do ./server; done'"
echo "================================================================="
echo

# 1. Build binaries
TMP_DIR=$(mktemp -d)
trap 'rm -rf "$TMP_DIR"' EXIT

echo "--> [1/4] Compiling client_main from branch 'main'..."
git show main:bw.c > "$TMP_DIR/bw_main.c" 2>/dev/null || {
    echo "Error: Failed to extract bw.c from git ref 'main'." >&2
    exit 1
}
gcc -O3 -Wall -Wextra -o "$TMP_DIR/client_main" "$TMP_DIR/bw_main.c" -libverbs || {
    echo "Error: Failed to compile client_main." >&2
    exit 1
}

echo "--> [2/4] Compiling client_prebuilt from current branch..."
gcc -O3 -Wall -Wextra -o "$TMP_DIR/client_prebuilt" bw.c -libverbs || {
    echo "Error: Failed to compile client_prebuilt." >&2
    exit 1
}

OUT_MAIN="$TMP_DIR/out_main"
OUT_PREBUILT="$TMP_DIR/out_prebuilt"
mkdir -p "$OUT_MAIN" "$OUT_PREBUILT"

# Helper function to run a benchmark binary N times
run_benchmark() {
    local bin_path="$1"
    local label="$2"
    local out_dir="$3"

    echo "--> Running $label (x$N runs against $PEER)..."
    local ok=0
    for i in $(seq 1 "$N"); do
        local out="$out_dir/run.$i.out"
        local err="$out_dir/run.$i.err"
        local attempt=0
        local rc=1
        while :; do
            attempt=$((attempt + 1))
            timeout 180 "$bin_path" "$PEER" >"$out" 2>"$err"
            rc=$?
            [ "$rc" -eq 0 ] && break
            [ -s "$err" ] && break
            [ "$attempt" -ge 30 ] && break
            sleep 2
        done
        if [ "$rc" -eq 0 ]; then
            ok=$((ok + 1))
            echo "    [$label] run $i/$N: OK"
        else
            echo "    [$label] run $i/$N: FAILED (rc=$rc) $(head -n 1 "$err" 2>/dev/null)"
        fi
    done
    echo "    Completed: $ok/$N runs succeeded for $label."
    echo
}

# 2. Run client_main
echo "--> [3/4] Benchmarking 'main'..."
run_benchmark "$TMP_DIR/client_main" "main" "$OUT_MAIN"

# 3. Run client_prebuilt
echo "--> [4/4] Benchmarking 'prebuilt'..."
run_benchmark "$TMP_DIR/client_prebuilt" "prebuilt" "$OUT_PREBUILT"

# 4. Compute and format comparison table
awk '
function gbps(v, u, m) {
    m = 1
    if (u == "Kbps") m = 1000
    else if (u == "Mbps") m = 1000000
    else if (u == "Gbps") m = 1000000000
    return v * m / 1000000000
}
FNR == 1 {
    file_idx++
}
{
    sz = $1
    val = gbps($2 + 0, $3)
    if (file_idx == 1) {
        # main
        size[FNR] = sz
        main_sum[FNR] += val
        main_cnt[FNR]++
    } else {
        # prebuilt
        pre_sum[FNR] += val
        pre_cnt[FNR]++
    }
}
END {
    printf "\n"
    printf "========================================================================\n"
    printf "                     PERFORMANCE COMPARISON RESULTS                     \n"
    printf "========================================================================\n"
    printf "%-10s %14s %16s %16s\n", "size(B)", "main(Gbps)", "prebuilt(Gbps)", "diff(%)"
    printf "%-10s %14s %16s %16s\n", "-------", "----------", "--------------", "-------"

    for (k = 1; k <= 21; k++) {
        if (main_cnt[k] > 0 && pre_cnt[k] > 0) {
            m_avg = main_sum[k] / main_cnt[k]
            p_avg = pre_sum[k] / pre_cnt[k]
            if (m_avg > 0) {
                pct = ((p_avg - m_avg) / m_avg) * 100.0
                printf "%-10s %14.5f %16.5f %+15.2f%%\n", size[k], m_avg, p_avg, pct
            } else {
                printf "%-10s %14.5f %16.5f %16s\n", size[k], m_avg, p_avg, "N/A"
            }
        }
    }
    printf "========================================================================\n"
}
' "$OUT_MAIN"/run.*.out "$OUT_PREBUILT"/run.*.out 2>/dev/null
