#!/usr/bin/env bash
#
# Convergence sweep for the per-size warmup count (BW_WARMUP_COUNTS): tries
# a handful of structurally meaningful uniform warmup values (same count
# applied to all 21 sizes per level) and prints a size x level table of
# average Gbps, so you can see where increasing warmup stops changing the
# measured throughput -- that's the per-size convergence point. Benchmark
# counts are left at the default MSG_COUNTS table throughout (BW_BENCH_COUNTS
# unset) so only the warmup axis varies.
#
# One SSH session covers every level, so you authenticate once, not once
# per level.
#
# IMPORTANT: needs (levels x n_runs) fresh ./server instances on the peer,
# one consumed per client run -- e.g. for the defaults (5 levels x 10 runs
# = 50):
#   ssh mlx-stud-01 'cd ~/networking/ex2/ex2_network && for i in $(seq 1 50); do ./server; done'
#
# Usage: ./sweep_warmup.sh [peer_host] [n_runs] [level ...]
#   ./sweep_warmup.sh                          # mlx-stud-01, 10 runs, levels 0 64 256 512 1024
#   ./sweep_warmup.sh mlx-stud-01 5 0 128 256  # custom levels/n

set -u

PEER="${1:-mlx-stud-01}"
N="${2:-10}"
if [ "$#" -gt 2 ]; then
    LEVELS=("${@:3}")
else
    LEVELS=(0 64 256 512 1024)
fi
REMOTE_DIR="~/networking/ex2/ex2_network"

echo "Peer: $PEER | runs per level: $N | levels: ${LEVELS[*]}"
echo "Needs $(( ${#LEVELS[@]} * N )) fresh ./server instances on $PEER for this sweep."
echo

ssh mlx-stud-02 "bash -s" -- "$PEER" "$N" "$REMOTE_DIR" "${LEVELS[@]}" <<'REMOTE'
set -u
peer="$1"; n="$2"; dir="$3"
shift 3
levels=("$@")

cd "$dir" || { echo "cd $dir failed" >&2; exit 1; }

echo "Building..."
make >/tmp/bw_build.log 2>&1 || { echo "make failed:"; cat /tmp/bw_build.log; exit 1; }

build_csv() { # build_csv <value> -> 21 comma-separated copies of <value>
    local v="$1" i out=""
    for ((i = 0; i < 21; i++)); do out+="$v,"; done
    echo "${out%,}"
}

outdir=$(mktemp -d)
result_files=()

for lvl in "${levels[@]}"; do
    csv=$(build_csv "$lvl")
    lvldir="$outdir/lvl_$lvl"
    mkdir -p "$lvldir"
    echo "=== warmup=$lvl ==="

    ok=0
    for i in $(seq 1 "$n"); do
        out="$lvldir/run.$i.out"
        err="$lvldir/run.$i.err"
        attempt=0
        rc=1
        while :; do
            attempt=$((attempt + 1))
            BW_WARMUP_COUNTS="$csv" timeout 180 ./client "$peer" >"$out" 2>"$err"
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

    res="$outdir/results.$lvl.tsv"
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
done

echo
echo "=== per-size average Gbps by warmup level ==="
levels_str="${levels[*]}"
awk -v levels="$levels_str" '
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
