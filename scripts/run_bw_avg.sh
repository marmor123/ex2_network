#!/usr/bin/env bash
#
# Runs the ex2 bw client 10x against a peer node and prints the per-size
# average throughput across the successful runs.
#
# Requires: ~/.ssh/config with a "mlx-stud-02" host entry (ProxyJump via
# bava.cs.huji.ac.il) -- already set up.
#
# IMPORTANT: this is a client/server benchmark (see assignment.md). A fresh
# `./server` instance must be running on the peer node for EACH of the 10
# runs (the server exits after handling one client). Start/restart it on
# the peer manually before each run, or in a loop in another session, e.g.:
#   ssh <peer> 'cd ~/networking/ex2/ex2_network && for i in $(seq 1 10); do ./server; done'
#
# Usage: ./run_bw_avg.sh [peer_host] [n_runs]

set -u

PEER="${1:-mlx-stud-01}"
N="${2:-10}"
REMOTE_DIR="~/networking/ex2/ex2_network"

ssh mlx-stud-02 "bash -s" -- "$PEER" "$N" "$REMOTE_DIR" <<'REMOTE'
set -u
peer="$1"
n="$2"
dir="$3"

cd "$dir" || { echo "cd $dir failed" >&2; exit 1; }

echo "Building..."
make >/tmp/bw_build.log 2>&1 || { echo "make failed:"; cat /tmp/bw_build.log; exit 1; }

outdir=$(mktemp -d)
echo "Running client x$n against $peer (raw outputs: $outdir)"

ok=0
for i in $(seq 1 "$n"); do
    out="$outdir/run.$i.out"
    err="$outdir/run.$i.err"
    attempt=0
    rc=1
    while :; do
        attempt=$((attempt + 1))
        timeout 180 ./client "$peer" >"$out" 2>"$err"
        rc=$?
        [ "$rc" -eq 0 ] && break
        [ -s "$err" ] && break            # real failure, don't retry
        [ "$attempt" -ge 30 ] && break     # gave up waiting for server
        sleep 2
    done
    if [ "$rc" -eq 0 ]; then
        ok=$((ok + 1))
        echo "  run $i/$n: ok"
    else
        echo "  run $i/$n: FAILED (rc=$rc) $(cat "$err" 2>/dev/null | head -1)"
    fi
done

echo "$ok/$n runs succeeded"
echo

awk '
function gbps(v, u, m) {
    m = 1
    if (u == "Kbps") m = 1000
    else if (u == "Mbps") m = 1000000
    else if (u == "Gbps") m = 1000000000
    return v * m / 1000000000
}
{
    size[FNR] = $1
    sum[FNR] += gbps($2 + 0, $3)
    cnt[FNR]++
}
END {
    printf "%-10s %14s %6s\n", "size(B)", "avg(Gbps)", "n"
    for (k = 1; k <= 21; k++) {
        if (cnt[k] > 0) printf "%-10s %14.5f %6d\n", size[k], sum[k] / cnt[k], cnt[k]
    }
}' "$outdir"/run.*.out 2>/dev/null

echo
echo "raw outputs kept on remote host at: $outdir"
REMOTE
