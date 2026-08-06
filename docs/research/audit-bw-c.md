# Audit of bw.c — correctness, edge cases, spec compliance

Wayfinder ticket #10. Primary sources read in full: `CONTEXT.md` (glossary), `assignment.md`, `docs/adr/0001`–`0007`, `bw.c`, `verify.sh`, `Makefile`, `bw_template.c` (the course template), `slides.md`; git history `7185054` (initial) → `HEAD`. Review axes: **Spec** (assignment.md + ADR decisions) and **Standards** (the repo's own documented discipline — the ADRs — plus correctness/edge-case/robustness review), over the whole project from the initial commit.

**Headline verdict: no correctness bugs found. bw.c satisfies the assignment and all seven ADR decisions. Nine of nine audited components are correct; one documentation comment is inaccurate; four optimizable/hardening items are listed (none blocks submission).**

## Per-component verdict table

| # | Component | Verdict | Evidence |
|---|---|---|---|
| 1 | Counts-table fit (`MSG_COUNTS` / `WARMUP_COUNTS`) | **correct** (optimizable: no static assert) | bw.c:111–121 |
| 2 | Sequence counter | **correct** | bw.c:992–996, bw.c:1038–1040, bw.c:830–835 |
| 3 | Control receive pool (32 vs 21) | **correct** | bw.c:99, bw.c:688–709, bw.c:1252 |
| 4 | PSN wrap | **correct** | bw.c:1277 |
| 5 | Inline-size stepping (1024→0) | **correct** (cosmetic errno nit) | bw.c:623–640, bw.c:649–661, bw.c:906–907 |
| 6 | Refill/poll logic | **correct** on course hardware; one unreachable-in-practice hang mode; one inaccurate comment | bw.c:868–888, bw.c:846–849 |
| 7 | Error paths | **correct** overall; parse-validation nits | bw.c:388–392, bw.c:1187–1193, bw.c:641–646 |
| 8 | Client→server symlink | **correct** | Makefile:18–19, verify.sh:198–202 |
| 9 | Timer resolution | **correct** | bw.c:1004, bw.c:1013–1019 |
| 10 | Window/done-fits invariant | **correct** (proved, both un-clamped and clamped cases) | bw.c:871–872, bw.c:1215–1218 |
| 11 | Measurement methodology (warmup < W) | **optimizable** nuance, not a bug | bw.c:1000–1004, CONTEXT.md:12 |
| 12 | CQ depth sizing | **correct** (hardening nit) | bw.c:607–608, bw.c:577–582 |

---

## Detailed findings

### 1. Counts-table fit — correct

- `MSG_COUNTS[SWEEP_SIZES]` has exactly 21 entries (bw.c:111–117) and `WARMUP_COUNTS` exactly 21 (bw.c:119–121), indexed by the size index `seq` 0..20 (bw.c:992–994). Largest value 1,310,720 fits `uint64_t` with no overflow; no size's timed batch is near any arithmetic limit.
- Batch durations are all sane: 1 B ≈ 1.31M WRs ≈ 212 ms at the measured ~6.19M msg/s (ADR-0006), 1 MB = 80 WRs ≈ 16.5 ms at 40.57 Gbps (ADR-0007) — every size well above timer resolution and far below the verify.sh 180 s sweep timeout (verify.sh:230).
- The table is the declared verbatim ex1 converged table (bw.c:107–110); comments label each line with its sizes, and the labels match the values.
- **Optimizable:** nothing checks that the arrays hold exactly `SWEEP_SIZES` entries. An over-long initializer is a compile error, but an under-long one compiles silently and reads zeros (count 0 → a size with no timed WRs). A `_Static_assert(sizeof MSG_COUNTS / sizeof MSG_COUNTS[0] == SWEEP_SIZES)` (and same for WARMUP) would pin the invariant the loop at bw.c:992 depends on.

### 2. Sequence counter — correct

- Client sends `done.seq = seq` for seq 0..20 (bw.c:992, bw.c:995); server sends `ack.seq = seq` (bw.c:1038–1040); both verify the received message's tag **and** seq (bw.c:830–835: `msg.tag != BW_CTRL_TAG || msg.seq != seq` → error exit). A mismatch fails the side that sees it, and the peer is guaranteed to fail too: it hits its own mismatch or the 10 s control deadline (bw.c:139, bw.c:783–808). No way to hang the pair on desync.
- The ack echoes the done's seq because both sides step in lockstep; this is exactly the CONTEXT.md "sequence counter" definition ("a mismatch means the exchange desynchronized") and ADR-0001's protocol.

### 3. Control receive pool (32 vs 21) — correct

- `CTRL_POOL_DEPTH 32` (bw.c:99) is posted once at init (bw.c:688–709) **before** the TCP handshake on both roles (bw.c:1252), satisfying assignment item 3 ("post receive-buffers before the other side sends you a message") and ADR-0001 ("never refreshed").
- 21 dones (server side) and 21 acks (client side) consume 21 of the 32 per side; 11 spare. RC exactly-once delivery means no duplicates consume extra receives.
- All 32 receives share one wr_id `BW_RECV_WRID` (bw.c:696) and one 64-byte `ctrl_buf` (bw.c:690–694). This is safe because at most **one** control message is ever in flight per direction: the client posts done only after the previous ack was received, and the server acks only after the done arrives and never sends a second ack before its ack-send completion is consumed (bw.c:1042–1049). So no second receive can overwrite `ctrl_buf` before the first is read (bw.c:830).
- The shared buffer's SGE is 64 bytes ≥ the 8-byte message (bw.c:100, bw.c:692) — no truncation.

### 4. PSN wrap — correct

- `my_dest.psn = lrand48() & 0xffffff` (bw.c:1277), template-identical. The full sweep is ~2.81M WRs (sum of MSG_COUNTS ≈ 2.814M plus ≤ 32-warmups per size and 21 control SENDs) — far below the 2²⁴ = 16.7M PSN space, so a default run never wraps. RC PSN arithmetic is modular (2²⁴) by design, so even a wrap would be handled by the HCA; the code does no local PSN arithmetic that could break. No issue.
- `-n` override is the only way to exceed 2²⁴ WRs in one size stream (e.g., `-n 17000000` at 1 B); even then the wrap is handled by the hardware (finding 7 keeps the caveat that a *garbage* huge `-n` mis-parse is an indefinite run, but a deliberate huge `-n` completes — see the experiment checklist).

### 5. Inline-size stepping (1024→0) — correct

- The QP-creation loop steps `try_inline` 1024 → 0 in 64-byte steps (bw.c:623–640): 16 attempts, `0` is the last tried, `try_inline <= 0` terminates, and a final `NULL` → clean error. The loop cannot underflow (0 is the floor).
- The created value is read back via `ibv_query_qp(..., IBV_QP_CAP, ...)` (bw.c:649–661) and that read-back is what the data path uses (`size <= ctx->max_inline_data` → `IBV_SEND_INLINE`, bw.c:906–907) — exactly the deviation ADR-0002 records ("declare-then-read-back ... is the runtime max_inline_data the data path uses").
- If the read-back is 0 (a stack that accepts no inline), the fallback is correct: all WRITEs take the DMA path through the registered buffer, and the control SEND stages the message in `ctrl_buf` (bw.c:735–740) — no path assumes inline.
- The inline SGE (`addr = &stack msg`, `lkey = 0`, bw.c:718–722) is safe: the provider copies inline data at post time, so the stack address is valid for the duration of the copy, and mlx4 ignores lkey on the inline path (template precedent, bw_template.c:522–540).
- **Nit:** on failure the error message prints `strerror(errno)` (bw.c:641–646) but `ibv_create_qp` does not reliably set errno — the message may say "Success". Cosmetic; the numeric fields printed are the useful part.

### 6. Refill/poll logic — correct, with two notes

The accounting is **exact**:
- Signal schedule: `t % k == 0 || (final && last)` (bw.c:917–920). Every multiple-of-k CQE covers exactly k WRs (positions j·k−k+1..j·k), so the refill's `st->outstanding -= k` per data CQE (bw.c:885) is exact for every CQE it consumes.
- The final-remainder CQE (the stream's last WR when `n % k != 0`) is never consumed by the refill: `bw_refill` runs only at the head of the post loop (bw.c:914), i.e., only before a list is posted, and no list follows the final one — so the remainder CQE necessarily sits in the CQ for the ack wait, which passes data CQEs through (bw.c:1013–1015). `st->outstanding` therefore never goes negative: consuming CQE j·k requires posted ≥ j·k, and reclaimed was (j−1)·k, so outstanding ≥ k before the decrement.
- The per-size reset `struct bw_data_state st = { 0, 0 }` (bw.c:998) is correct because the ack's receive completion is a completion barrier (CONTEXT.md, ADR-0001): all of the size's data and done-send CQEs precede the ack CQE in the CQ (in-order RC), so nothing carries across sizes.
- No-deadline polling with `ne == 0 → continue` (bw.c:880–881) is the intended poll loop; a dead peer yields retry-exceeded **error** CQEs (~0.5 s with timeout 14/retry 7, bw.c:330–331) → `bw_wc_bad` → exit, not a hang.

**Note A (risky edge, unreachable on course hardware):** the second loop condition `st->outstanding + k >= ctx->sq_depth` (bw.c:872) is permanently true when the QP was created with `sq_depth ≤ k` (the `max_qp_wr` clamp at bw.c:577–580). At the first post with outstanding 0, poll returns 0 and the loop spins forever with no deadline (unlike the control polls' 10 s, bw.c:139). Reachable only if `max_qp_wr < k`, with `k ≤ QP_SLACK = 1024` (bw.c:146, bw.c:1215) and `k ≤ window`. The T6 campaign already proves `max_qp_wr ≥ 1536` on both course pairs (sets (512,64), (256,128), (512,128) request `max_send_wr` 1536/1280/1536, and all 9 sweeps per run created QPs and passed — ADR-0006/0007 reports 26/26 and 11/11), so on the course hardware `sq_depth ≥ 1536 > 1024 ≥ k` always and the loop cannot hang. **Hardening:** validate `k < ctx->sq_depth` after the read-back (bw.c:659–660) and refuse or clamp otherwise.

**Note B (inaccurate comment, harmless):** the struct comment claims "the warmup residual and the final list's remainder are covered by the CQEs the ack wait consumes, never by the refill" (bw.c:846–849). Only the **final remainder** CQE is guaranteed ack-wait-consumed. The warmup residual (warmup counts 4–32 < k = 64, so warmups generate zero CQEs) is covered by the first multiple-of-k CQE — e.g. positions 1..64 with warmup 16 — which the refill normally consumes (with exact accounting). The code is right; the comment's attribution is wrong.

### 7. Error paths — correct overall

- Silent non-zero exit with no output when no server listens (bw.c:388–392) is the deliberate T1 acceptance criterion, verified by verify.sh [6.2] (verify.sh:206–218).
- All `bw_exch_dest_*`, `bw_init_ctx`, `bw_post_*`, poll and parse failures return non-zero / NULL and `main` propagates (bw.c:1246–1248, bw.c:1292–1298, bw.c:1303–1310); every error prints to stderr — the verify contract that stderr be empty on success is preserved.
- Handshake short read/write is handled (`bw_read_full`/`bw_write_full`, bw.c:236–260) — an improvement over the template's raw `read`/`write` (bw_template.c:235–246), and the server now checks the client's "ready" beat count (bw.c:522–531) that the template left unchecked (bw_template.c:351).
- Server-side RTR→RTS during the handshake, client-side after (bw.c:1281–1298) — template ordering (bw_template.c:793–806), valid for RC.
- `bw_close_ctx` (bw.c:1055–1092) destroys QP → CQ → MRs → PD → device in order; a failure anywhere returns 1. Completions are all consumed before teardown (the last ack wait is a barrier), so destroying the QP with outstanding WRs never happens.
- **Nits (all process-exit-moot or debug-flag-only):** (a) `-n` uses `strtoull` with no parse-error check (bw.c:1188) — `-n -5` wraps to ~2⁶⁴−4 and starts a run that effectively never ends (only a user-invoked debug flag; verify.sh never passes `-n`); (b) `-r`/`-k`/`-p` use `strtol` with no `endptr` check (bw.c:1152, bw.c:1172, bw.c:1180) — `-r abc` becomes 0 and is rejected by the `<= 0` guard, `-p abc` becomes 0 and binds an ephemeral port instead of erroring; (c) init-failure paths in `bw_init_ctx` leak earlier allocations (bw.c:551–611) — the process exits immediately, so the leak is inert; (d) a peer death mid-handshake can kill the client with SIGPIPE on `write` rather than the graceful path (bw.c:397–413) — template-inherited, and verify.sh's `timeout` still reports the failure.

### 8. Client→server symlink — correct

- `client: server; ln -sf server client` (Makefile:18–19) matches the assignment's build line (`ln -s server client`, assignment.md:15); verify.sh [6.1] checks `-L client` and `readlink client == server` (verify.sh:198–202).
- Role dispatch is by **argc** (hostname argument presence), not `argv[0]` (bw.c:1205–1210, bw.c:1246) — so the symlink is robust by construction: `./client` without args would act as server exactly as the assignment's dispatch intends (same as the template, bw_template.c:717–722).

### 9. Timer resolution — correct

- `CLOCK_MONOTONIC` with nanosecond `timespec` (bw.c:1004, bw.c:1013–1016) — meets assignment item 5 ("seconds may be too low a resolution"). The clock starts before the first timed WRITE is posted (bw.c:1004, after the warmup batch) and stops at the ack-receive completion (bw.c:1013–1016) — exactly ADR-0003's window ("the clock runs until the ack arrives").
- The elapsed arithmetic handles `tv_nsec` borrow correctly (bw.c:1018–1019); `double` precision at ~0.2 s spans is ample. Smallest measured interval (~2–3 ms at 32 B) is orders of magnitude above clock resolution.

### 10. Window/done-fits invariant — correct (proved)

- Un-clamped: `sq_depth = window + QP_SLACK` (bw.c:577, bw.c:146); the refill exits with `outstanding < window && outstanding + k < sq_depth` (bw.c:871–872), so after a K-list post `outstanding ≤ sq_depth − 1`; the done SEND always finds a slot — the guarantee the header comment states (bw.c:970–974) and `main` enforces via `k ≤ window && k ≤ QP_SLACK` (bw.c:1215–1218).
- Clamped (`max_qp_wr`): the same second condition keeps `outstanding ≤ sq_depth − k − 1` before each post → `≤ sq_depth − 1` after — the done still fits. Condition 2 is what makes arbitrary `-r` values safe (the refill then paces at `sq_depth − k`, e.g. `-r 5000` works with no SQ-full `ibv_post_send` failure).
- CQ depth is sized `max_send_wr + max_recv_wr` (bw.c:607–608), the true worst case (`sq_depth` signaled sends + 32 receives); the refill's `outstanding < sq_depth` bound means the CQ can never overflow. **Hardening nit:** the actual CQ capacity after `ibv_create_cq` (a driver may clamp to `max_cqe`) is never checked; on mlx4 the size rounds up, so no practical risk.

### 11. Measurement methodology — optimizable nuance (not a bug)

- Warmup counts are 4–32 WRs (bw.c:119–121), all < the default window W = 256. CONTEXT.md defines the warmup batch as pipelined "so the pipe is full when the clock starts" — with 4–32 WRs in flight at t0 the pipe is *not* full; the timed batch ramps outstanding to W over ~(W − warmup)/6.19M ≈ 39 µs (ADR-0006's measured post rate). That ramp sits inside the measured window, at worst ~1.2% of the shortest batch (32 B, ~3.3 ms) and ~0.02% at 1 B — and ADR-0006/0007 already show it empirically invisible (each size doubles "within a hair of 2.0", CV ≤ 0.40%). The counts table is verbatim ex1's (bw.c:107–110), so this is inherited methodology, identical in shape for every size; ADR-0003 requires ex1-identical methodology.
- **Optimizable:** raising warmup to ≥ W per size (e.g., W + k) would make the "pipe full at clock start" definition literally true; the header comment at bw.c:39–47 and the code comment at bw.c:1000–1004 both present the warmup as filling the pipe, which at these counts it does not. No measurement change expected (the ADR-0006/0007 records are the evidence).

### 12. Output contract — correct

- `bw_print_result` emits exactly `size\t%.2f\tunit` with auto-scaled bps → Gbps and nothing else (bw.c:953–965), byte-identical to the ex1 contract that verify.sh's `contract_detail` enforces (verify.sh:107–119); sizes ascend 2⁰..2²⁰ via `(size_t)1 << seq` (bw.c:993).

---

## Spec / ADR compliance summary

**Assignment (assignment.md):** RDMA WRITE for data (bw.c:929) ✓; ack sent with `IBV_WR_SEND` (bw.c:725, bw.c:1045) ✓; no debug prints (only the 21 contract lines on stdout, errors on stderr) ✓; builds via Makefile to `server` + `client` symlink (Makefile:13–19) ✓; receives posted before the peer can send (bw.c:1252, bw.c:688–709) ✓; `IBV_SEND_INLINE` used whenever possible with the inline limit discovered (bw.c:623–661, bw.c:906–907) ✓; timer resolution adequate (finding 9) ✓; hostname or IP accepted (getaddrinfo, bw.c:367) ✓. No deviations.

**ADRs:** 0001 (control SENDs on the data QP, 32-deep never-refreshed receive pool, TCP only for the handshake) ✓; 0002 (W=256/K=64 defaults, K-WR linked lists per post, refill-never-empty, single registered 1 MB buffer never modified, inline ≤ `max_inline_data` with declare-then-read-back and `max_qp_wr` clamp, `-r`/`-k` tunables) ✓; 0003 (clock from first timed post to ack completion, 21-line ex1 output) ✓; 0004–0007 (measurement records — no code obligations beyond the verified defaults and envelope, all consistent with the code as analyzed). No code-level deviations; the only textual inaccuracy is the refill comment (finding 6, note B).

---

## What the existing records already prove (no new experiment needed)

- `max_qp_wr ≥ 1536` on both course pairs — the T6 campaign's (512,128)/(256,128)/(512,64) sets requested `max_send_wr` 1536/1280/1536 and all sweeps created QPs and passed (ADR-0006: 26/26, 11/11; ADR-0007 same) — which makes finding 6's hang mode unreachable on the course hardware.
- Warmup-shape effects are invisible in practice — ADR-0006/0007 scaling and variance records (finding 11).
- No QP errors in 18 campaign sweeps across both pairs (ADR-0006/0007) — the refill/ack-wait accounting never produced a bad completion or protocol error at any of W×K ∈ {256,512}×{64,128}.
