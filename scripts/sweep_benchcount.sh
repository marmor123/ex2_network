#!/usr/bin/env bash
#
# Convergence sweep for the per-size benchmark count (BW_BENCH_COUNTS):
# tries a handful of multipliers of the current MSG_COUNTS table (each
# size scaled proportionally, not a uniform absolute value -- the sizes
# already span a huge range of counts) and prints a size x level table of
# average Gbps, so you can see the smallest multiplier where throughput
# still matches the 1x baseline within ~1% -- the repo's own convergence
# threshold (CONTEXT.md: "variance < 1% between doubled counts").
#
# One SSH session covers every level, so you authenticate once, not once
# per level.
#
# IMPORTANT: needs (levels x n_runs) fresh ./server instances on the peer,
# one consumed per client run -- e.g. for the defaults (5 levels x 10 runs
# = 50):
#   ssh mlx-stud-01 'cd ~/networking/ex2/ex2_network && for i in $(seq 1 50); do ./server; done'
#
# Usage: ./sweep_benchcount.sh [peer_host] [n_runs] [multiplier ...]
#   ./sweep_benchcount.sh                              # mlx-stud-01, 10 runs, 0.125 0.25 0.5 1 2
#   ./sweep_benchcount.sh mlx-stud-01 5 0.25 0.5 1      # custom multipliers/n

set -u

PEER="${1:-mlx-stud-01}"
N="${2:-10}"
if [ "$#" -gt 2 ]; then
    MULTS=("${@:3}")
else
    MULTS=(0.125 0.25 0.5 1 2)
fi
REMOTE_DIR="~/networking/ex2/ex2_network"

echo "Peer: $PEER | runs per level: $N | multipliers: ${MULTS[*]}"
echo "Needs $(( ${#MULTS[@]} * N )) fresh ./server instances on $PEER for this sweep."
echo

ssh mlx-stud-02 "bash -s" -- "$PEER" "$N" "$REMOTE_DIR" "${MULTS[@]}" <<'REMOTE'
set -u
peer="$1"; n="$2"; dir="$3"
shift 3
mults=("$@")

cd "$dir" || { echo "cd $dir failed" >&2; exit 1; }

echo "Building..."
make >/tmp/bw_build.log 2>&1 || { echo "make failed:"; cat /tmp/bw_build.log; exit 1; }

# The bw.c MSG_COUNTS table, verbatim -- kept in sync by hand since this
# script scales it, it doesn't read it from the source.
msg_counts=(1310720 81920 655360 163840 327680 20480 81920 81920 40960 20480
            20480 20480 20480 2560 2560 2560 640 320 160 160 80)

build_csv() { # build_csv <multiplier> -> 21 comma-separated scaled counts
    local mult="$1" i out="" v
    for i in "${!msg_counts[@]}"; do
        v=$(awk -v c="${msg_counts[$i]}" -v m="$mult" 'BEGIN { r = int(c * m + 0.5); print (r < 1) ? 1 : r }')
        out+="$v,"
    done
    echo "${out%,}"
}

outdir=$(mktemp -d)
result_files=()
labels=()

for mult in "${mults[@]}"; do
    csv=$(build_csv "$mult")
    lvldir="$outdir/mult_$mult"
    mkdir -p "$lvldir"
    echo "=== bench multiplier=${mult}x ==="
    echo "  counts: $csv"

    ok=0
    for i in $(seq 1 "$n"); do
        out="$lvldir/run.$i.out"
        err="$lvldir/run.$i.err"
        attempt=0
        rc=1
        while :; do
            attempt=$((attempt + 1))
            BW_BENCH_COUNTS="$csv" timeout 180 ./client "$peer" >"$out" 2>"$err"
            rc=$?
            [ "$rc" -eq 0 ] && break
            [ -s "$err" ] && break
            [ "$attempt" -ge 30 ] && break
            sleep 2
        done
        if [ "$rc" -eq 0 ]; then
            ok=$((ok + 1))
            echo "  run $i/$n: ok"
        else
            echo "  run $i/$n: FAILED (rc=$rc) $(cat "$err" 2>/dev/null | head -1)"
        fi
    done
    echo "  $ok/$n runs succeeded"

    res="$outdir/results.$mult.tsv"
    awk '
    function gbps(v, u, m) {
        m = 1
        if (u == "Kbps") m = 1000
        else if (u == "Mbps") m = 1000000
        else if (u == "Gbps") m = 1000000000
        return v * m / 1000000000
    }
    { sum[FNR] += gbps($2 + 0, $3); size[FNR] = $1; cnt[FNR]++ }
    END { for (k = 1; k <= 21; k++) if (cnt[k] > 0) print size[k], sum[k] / cnt[k] }
    ' "$lvldir"/run.*.out 2>/dev/null > "$res"
    result_files+=("$res")
    labels+=("${mult}x")
done

echo
echo "=== per-size average Gbps by benchmark-count multiplier ==="
labels_str="${labels[*]}"
awk -v levels="$labels_str" '
BEGIN { m = split(levels, L, " ") }
FNR == 1 { f++ }
{ size[FNR] = $1; val[f, FNR] = $2 }
END {
    printf "%-10s", "size(B)"
    for (i = 1; i <= m; i++) printf " %12s", L[i]
    print ""
    for (r = 1; r <= 21; r++) {
        printf "%-10s", size[r]
        for (i = 1; i <= m; i++) printf " %12.5f", val[i, r]
        print ""
    }
}' "${result_files[@]}"

echo
echo "raw outputs kept on remote host at: $outdir"
REMOTE
