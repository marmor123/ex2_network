#!/usr/bin/env bash
# Dev harness for verify.sh stage 6 — runs on synthetic sweeps, no hardware.
# Part 1: unit tests of the sourced parse/compute helpers.
# Part 2: end-to-end runs of the full script against stubbed client/server.
set -u

REPO=C:/Users/marmo/ateret/ex2_network
HARNESS=$(mktemp -d)
trap 'echo "harness kept at: $HARNESS"' EXIT

pass=0
fail=0
ok()   { pass=$((pass + 1)); echo "PASS: $1"; }
nok()  { fail=$((fail + 1)); echo "FAIL: $1"; }

# ---------------------------------------------------------------- templates

# The T5 measured envelope (ADR-0005), as the client prints it: size<TAB>v<TAB>unit.
base_sweep() { # base_sweep [<line17-gbps> <line21-gbps>] — perturb 64 KB / 1 MB
    local b64k=${1:-38.22} mb=${2:-36.47}
    local b64k_v mb_v
    b64k_v=$(awk -v v="$b64k" 'BEGIN { printf "%.2f", v * 1000 }')
    mb_v=$(awk -v v="$mb" 'BEGIN { printf "%.2f", v * 1000 }')
    printf '1\t49.60\tMbps\n2\t99.10\tMbps\n4\t198.20\tMbps\n8\t396.30\tMbps\n'
    printf '16\t792.80\tMbps\n32\t1580.00\tMbps\n64\t2650.00\tMbps\n128\t3610.00\tMbps\n'
    printf '256\t5840.00\tMbps\n512\t6290.00\tMbps\n1024\t6550.00\tMbps\n2048\t33500.00\tMbps\n'
    printf '4096\t34500.00\tMbps\n8192\t35500.00\tMbps\n16384\t36500.00\tMbps\n32768\t37500.00\tMbps\n'
    printf '65536\t%s\tMbps\n131072\t37800.00\tMbps\n262144\t37500.00\tMbps\n524288\t37200.00\tMbps\n' "$b64k_v"
    printf '1048576\t%s\tMbps\n' "$mb_v"
}

# ----------------------------------------------------------- part 1: helpers

. "$REPO/verify.sh"

d=$HARNESS/unit
mkdir -p "$d"

# -- cv_at: identical files -> CV 0
base_sweep >"$d/a.out"
base_sweep >"$d/b.out"
base_sweep >"$d/c.out"
set -- $(cv_at 21 "$d/a.out" "$d/b.out" "$d/c.out")
[ "$1" = 36.47 ] && [ "$2" = 0 ] && ok "cv_at: identical sweeps, mean 36.47, CV 0" \
    || nok "cv_at identical: got '$1 $2'"

# -- cv_at: <1% (36.5/36.7/36.9 at 1 MB)
base_sweep >"$d/p1.out"; base_sweep 38.22 36.5 >"$d/p2.out"; base_sweep 38.22 36.9 >"$d/p3.out"
set -- $(cv_at 21 "$d/p1.out" "$d/p2.out" "$d/p3.out")
awk -v c="$2" 'BEGIN { exit !(c < 1) }' && ok "cv_at: 0.545% CV (pass band)" \
    || nok "cv_at 0.545%: got '$1 $2'"

# -- cv_at: >1% (36.0/36.7/37.4 at 1 MB)
base_sweep >"$d/q1.out"; base_sweep 38.22 36.0 >"$d/q2.out"; base_sweep 38.22 37.4 >"$d/q3.out"
set -- $(cv_at 21 "$d/q1.out" "$d/q2.out" "$d/q3.out")
awk -v c="$2" 'BEGIN { exit !(c >= 1) }' && ok "cv_at: 1.91% CV (fail band)" \
    || nok "cv_at 1.91%: got '$1 $2'"

# -- contract_detail: good sweep, then failures
[ "$(contract_detail "$d/a.out")" = ok ] && ok "contract: clean sweep" \
    || nok "contract clean: '$(contract_detail "$d/a.out")'"
sed '$d' "$d/a.out" >"$d/short.out"
[ "$(contract_detail "$d/short.out")" != ok ] && ok "contract: 20 lines rejected" \
    || nok "contract 20 lines accepted"
sed 's/^1\t49.60\tMbps/1\t49.6\tMbps/' "$d/a.out" >"$d/fmt.out"
[ "$(contract_detail "$d/fmt.out")" != ok ] && ok "contract: bad format rejected" \
    || nok "contract bad format accepted"
sed '2s/^2\t99.10\tMbps/4\t99.10\tMbps/' "$d/a.out" >"$d/asc.out"
[ "$(contract_detail "$d/asc.out")" != ok ] && ok "contract: non-ascending rejected" \
    || nok "contract non-ascending accepted"

# -- scaling_1to32
[ "$(scaling_1to32 "$d/a.out")" = ok ] && ok "scaling: clean sweep doubles 1..32 B" \
    || nok "scaling clean: '$(scaling_1to32 "$d/a.out")'"
# break the 16->32 doubling: 16 B = 792.80, 32 B = 1200.00 (ratio 1.51)
sed 's/^32\t1580.00\tMbps/32\t1200.00\tMbps/' "$d/a.out" >"$d/scale.out"
r=$(scaling_1to32 "$d/scale.out")
[ "$r" != ok ] && ok "scaling: 1.51 ratio rejected ('$r')" || nok "scaling 1.51 accepted"

echo "--- unit: $pass passed, $fail failed"
[ "$fail" -eq 0 ] || { echo "unit failures abort the harness"; exit 1; }

# ----------------------------------------------------------- part 2: e2e

mkdir -p "$HARNESS/bin"
cat >"$HARNESS/bin/sleep" <<'EOF'
#!/usr/bin/env bash
exit 0
EOF
chmod +x "$HARNESS/bin/sleep"

cat >"$HARNESS/bin/make" <<'EOF'
#!/usr/bin/env bash
# stub make: clean deletes the binaries, make rebuilds them from $STUB_SRC
if [ "${1:-}" = clean ]; then
    rm -f server client
    exit 0
fi
cp "$STUB_SRC" server
chmod +x server
ln -sf server client
exit 0
EOF
chmod +x "$HARNESS/bin/make"

cat >"$HARNESS/stub.c" <<'EOF'
#!/usr/bin/env bash
# stub for both roles; sweep behavior driven by $STUB_COUNTER and the
# templates in $STUB_TMPL. Sweep invocations are logged to $STUB_LOG.
if [ "${1:-}" = 127.0.0.1 ]; then
    exit 1          # the [6.3] graceful-failure probe
fi
n=$(cat "$STUB_COUNTER" 2>/dev/null || echo 0)
n=$((n + 1))
echo "$n" >"$STUB_COUNTER"
echo "$*" >>"$STUB_LOG"
if [ "${STUB_INVALID_AT:-}" = "$n" ] && [ -f "$STUB_TMPL/invalid.out" ]; then
    cat "$STUB_TMPL/invalid.out"
elif [ "$n" -le 3 ]; then
    cat "$STUB_TMPL/v$n.out"
else
    case "$*" in
        *"-r 512 -k 64"*)   cat "$STUB_TMPL/alt1.out" ;;
        *"-r 256 -k 128"*)  cat "$STUB_TMPL/alt2.out" ;;
        *"-r 512 -k 128"*)  cat "$STUB_TMPL/alt3.out" ;;
        *)                  cat "$STUB_TMPL/default.out" ;;
    esac
fi
exit 0
EOF
chmod +x "$HARNESS/stub.c"

run_verify() { # run_verify <case-dir> <expect-exit> [expect-lines...]
    local casedir=$1 expect=$2
    shift 2
    mkdir -p "$casedir/scratch"
    local out
    out=$(cd "$casedir/scratch" && \
          env ${EXTRA_ENV:+$EXTRA_ENV} STUB_SRC="$HARNESS/stub.c" STUB_COUNTER="$casedir/counter" \
          STUB_TMPL="$casedir/tmpl" STUB_LOG="$casedir/log" \
          PATH="$HARNESS/bin:$PATH" bash "$REPO/verify.sh" mlxstud01 2>&1)
    local rc=$?
    echo "$out" >"$casedir/report.txt"
    [ "$rc" -eq "$expect" ] && ok "case $casedir: exit $rc as expected" \
        || nok "case $casedir: exit $rc, expected $expect"
    for l in "$@"; do
        if echo "$out" | grep -Fq "$l"; then
            ok "case $casedir: report contains '$l'"
        else
            nok "case $casedir: report missing '$l'"
        fi
    done
    echo "--- $casedir report tail ---"
    echo "$out" | tail -12
}

# ---- case A: everything passes ---------------------------------------------
mkdir -p "$HARNESS/A/tmpl"
base_sweep                 >"$HARNESS/A/tmpl/v1.out"   # tiny variance at 64 KB/1 MB
base_sweep 38.2 36.45      >"$HARNESS/A/tmpl/v2.out"
base_sweep 38.24 36.49     >"$HARNESS/A/tmpl/v3.out"
base_sweep                 >"$HARNESS/A/tmpl/default.out"
base_sweep                 >"$HARNESS/A/tmpl/alt1.out"
base_sweep                 >"$HARNESS/A/tmpl/alt2.out"
base_sweep                 >"$HARNESS/A/tmpl/alt3.out"

# Note: the "server executable, client symlink" check fails locally because
# Git Bash `ln -sf` copies instead of symlinking; on the Linux course nodes
# the real Makefile's `ln -sf` makes a real symlink (stage 5's identical
# check passed there). The summary assertions below expect that artifact.
run_verify "$HARNESS/A" 1 \
    "variance < 1% at 64 KB" "variance < 1% at 1 MB" \
    "1..32 B doubles throughput" \
    "default envelope holds measured floors" \
    "no alternative beats default" \
    "Summary: 25 passed, 1 failed"

# stub arg assertions: exactly 3 flagless sweeps, 6 with -r/-k
nopts=$(grep -c '^mlxstud01$' "$HARNESS/A/log" || true)
opts=$(grep -c '^-r ' "$HARNESS/A/log" || true)
[ "$nopts" -eq 3 ] && ok "case A: 3 flagless sweeps" || nok "case A: $nopts flagless"
[ "$opts" -eq 6 ] && ok "case A: 6 flagged sweeps" || nok "case A: $opts flagged"

# ---- case B: variance > 1% at both large sizes + alt1 beats at 1 MB --------
mkdir -p "$HARNESS/B/tmpl"
base_sweep 38.0 36.3       >"$HARNESS/B/tmpl/v1.out"
base_sweep 38.22 36.47     >"$HARNESS/B/tmpl/v2.out"
base_sweep 39.0 37.1       >"$HARNESS/B/tmpl/v3.out"   # 64 KB CV ~1.4%, 1 MB CV ~1.2%
base_sweep                 >"$HARNESS/B/tmpl/default.out"
base_sweep 38.22 37.0      >"$HARNESS/B/tmpl/alt1.out" # 37.0 > 36.47*1.01
base_sweep                 >"$HARNESS/B/tmpl/alt2.out"
base_sweep                 >"$HARNESS/B/tmpl/alt3.out"

EXTRA_ENV=
run_verify "$HARNESS/B" 1 \
    "variance < 1% at 64 KB (n=3)" \
    "hardware disagrees with 256/64" \
    "1 MB(512/64)" \
    "Summary: 22 passed, 4 failed"

# ---- case C: sweeps 2 and 5 fail (rc and contract) -------------------------
mkdir -p "$HARNESS/C/tmpl"
base_sweep >"$HARNESS/C/tmpl/v1.out"
base_sweep >"$HARNESS/C/tmpl/v3.out"
base_sweep >"$HARNESS/C/tmpl/default.out"
base_sweep >"$HARNESS/C/tmpl/alt1.out"
base_sweep >"$HARNESS/C/tmpl/alt2.out"
base_sweep >"$HARNESS/C/tmpl/alt3.out"
# v2 = sweep 2: rc failure; invalid = sweep 9: truncated contract
printf '#!/usr/bin/env bash\nexit 1\n' >"$HARNESS/C/tmpl/v2.out"
sed '$d' "$HARNESS/C/tmpl/default.out" >"$HARNESS/C/tmpl/invalid.out"

EXTRA_ENV="STUB_INVALID_AT=9"
run_verify "$HARNESS/C" 1 \
    "only 2 valid" \
    "no statistics" \
    "sweep 2/9 (W=256, K=64): contract OK" \
    "sweep 9/9 (W=512, K=128): contract OK" \
    "Summary: 16 passed, 10 failed"

# ---- case D: 3 valid defaults but a short alternative set (sweep 9 only) --
# The A/B gate must say "not fully tested", not silently pass.
mkdir -p "$HARNESS/D/tmpl"
base_sweep >"$HARNESS/D/tmpl/v1.out"
base_sweep >"$HARNESS/D/tmpl/v2.out"
base_sweep >"$HARNESS/D/tmpl/v3.out"
base_sweep >"$HARNESS/D/tmpl/default.out"
base_sweep >"$HARNESS/D/tmpl/alt1.out"
base_sweep >"$HARNESS/D/tmpl/alt2.out"
base_sweep >"$HARNESS/D/tmpl/alt3.out"
sed '$d' "$HARNESS/D/tmpl/default.out" >"$HARNESS/D/tmpl/invalid.out"

EXTRA_ENV="STUB_INVALID_AT=9"
run_verify "$HARNESS/D" 1 \
    "3 valid default-parameter sweeps" \
    "not fully tested: 512/128(only 1 valid)" \
    "Summary: 22 passed, 4 failed"

echo "=== harness: $pass passed, $fail failed ==="
[ "$fail" -eq 0 ]
