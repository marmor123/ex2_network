#!/usr/bin/env bash
#
# Re-tests window depth (W) / signal interval (K) for real throughput
# impact -- ADR-0006 measured these invariant before (doubling either
# "nothing moves"), but that predates this session's warmup/CQE-batch
# re-tests, so this re-verifies rather than trusting the old numbers.
# W/K are client-only (see BW_WINDOW/BW_SIGNAL_INTERVAL, main() in bw.c):
# the server never posts data WRs, so no protocol change is needed on
# that side at all -- just run the plain, already-pulled server loop.
#
# Prints a size x (W,K) table of average Gbps across the tested pairs.
# One SSH session covers every pair, so you authenticate once total.
#
# IMPORTANT: needs (pairs x n_runs) fresh ./server instances on the peer
# -- e.g. for the defaults (5 pairs x 10 runs = 50):
#   ssh mlx-stud-01 'cd ~/networking/ex2/ex2_network && for i in $(seq 1 50); do ./server; done'
#
# Usage: ./sweep_wk.sh [peer_host] [n_runs] [W:K ...]
#   ./sweep_wk.sh                                        # default 5 pairs (below)
#   ./sweep_wk.sh mlx-stud-01 5 256:64 512:64 128:32      # custom pairs/n

set -u

PEER="${1:-mlx-stud-01}"
N="${2:-10}"
if [ "$#" -gt 2 ]; then
    PAIRS=("${@:3}")
else
    # 256:64 is today's default; the other three are ADR-0006's original
    # combos (re-tested here); 128:32 is a smaller pipe not tried before.
    PAIRS=(256:64 512:64 256:128 512:128 128:32)
fi
REMOTE_DIR="~/networking/ex2/ex2_network"

echo "Peer: $PEER | runs per pair: $N | W:K pairs: ${PAIRS[*]}"
echo "Needs $(( ${#PAIRS[@]} * N )) fresh ./server instances on $PEER for this sweep."
echo "(Server side needs no code change for this -- the currently pulled/built server is fine.)"
echo

ssh mlx-stud-02 "bash -s" -- "$PEER" "$N" "$REMOTE_DIR" "${PAIRS[@]}" <<'REMOTE'
set -u
peer="$1"; n="$2"; dir="$3"
shift 3
pairs=("$@")

cd "$dir" || { echo "cd $dir failed" >&2; exit 1; }

echo "Building..."
make >/tmp/bw_build.log 2>&1 || { echo "make failed:"; cat /tmp/bw_build.log; exit 1; }

outdir=$(mktemp -d)
result_files=()
labels=()

for pair in "${pairs[@]}"; do
    w="${pair%%:*}"
    k="${pair##*:}"
    lvldir="$outdir/wk_$w-$k"
    mkdir -p "$lvldir"
    echo "=== W=$w K=$k ==="

    ok=0
    for i in $(seq 1 "$n"); do
        out="$lvldir/run.$i.out"
        err="$lvldir/run.$i.err"
        attempt=0
        rc=1
        while :; do
            attempt=$((attempt + 1))
            BW_WINDOW="$w" BW_SIGNAL_INTERVAL="$k" timeout 180 ./client "$peer" >"$out" 2>"$err"
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

    res="$outdir/results.$w-$k.tsv"
    awk '
    function gbps(v, u, m) {
        m = 1
        if (u == "Kbps") m = 1000
        else if (u == "Mbps") m = 1000000
        else if (u == "Gbps") m = 1000000000
        return v * m / 1000000000
    }
    { sum[FNR] += gbps($2 + 0, $3); size[FNR] = $1; cnt[FNR]++ }
    END { for (k2 = 1; k2 <= 21; k2++) if (cnt[k2] > 0) print size[k2], sum[k2] / cnt[k2] }
    ' "$lvldir"/run.*.out 2>/dev/null > "$res"
    result_files+=("$res")
    labels+=("W${w}K${k}")
done

echo
echo "=== per-size average Gbps by (W,K) ==="
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
