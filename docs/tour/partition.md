# The station partition and tour route for bw.c (ticket #24)

Deliverable of wayfinder ticket **#24 Partition bw.c into stations and draft the tour route**.
Pins: `bw.c` blob `8db18617ff8e69026dbe0502fc438e5b34d89fd4` (branch `tour/partition`, off `prototype/tour-shell` HEAD `3e8772a`); stations are anchored to this file's line numbers and must be re-anchored if `bw.c` moves.

The partition is **flat and exact**: every line 1–1320 is owned by exactly one station; ranges are contiguous and disjoint (verified programmatically, see §2). The route (§3) orders the stations per the researched learning path (`docs/research/learning-path.md`, ticket #23): whole-program map first, `main` early and comprehensively, then execution order with definitions attached just-in-time at first use, difficulty ramp, predict-then-confirm, expert escapes.

## 1. Conventions applied

- **Blank lines** belong to the station that follows them (a block starts on the separator blank).
- **Granularity**: function-sized by default; the four compound functions (`bw_init_ctx`, `bw_exch_dest_client`, `bw_exch_dest_server`, `main`) are split at blank-line boundaries into phase stations — the map's "function-sized with finer splits" applied to functions, because a 145-line `bw_init_ctx` or 207-line `main` would otherwise be a station 5× the ~26-line average. Split points are reviewable (§4).
- **Station types**: `function`, `struct`, `constant`, plus `file` for the three file-level blocks (license, header comment, preamble) — the only place the type list is extended; see §4.
- **Chapter tags** (multi-valued, derived from the code's own structure, not the old site): `orientation`, `constants`, `types`, `handshake`, `qp-lifecycle`, `setup`, `control`, `data-path`, `measurement`, `teardown`, `main` — 11 tags, each station carries 1–2.
- **Vocabulary**: notes reference CONTEXT.md terms in **bold** — stations must use them verbatim in explanations.

## 2. The partition — 40 stations

| # | Station | Type | Lines | Ch. | Rough notes |
|---|---|---|---|---|---|
| 1 | License and provenance | file | 1–32 | orientation | GPL/BSD dual license, the OpenIB heritage. Boilerplate — the tour's first **skip** station (expert-escape demo). |
| 2 | The header comment: the whole program in one place | file | 33–67 | orientation | The primary-hypothesis station: what bw.c measures, one binary/two roles by argv, T5 streaming data path, control protocol (T3), handshake, template origin. **Size sweep**, roles. Predict: "which role does a run with no hostname take?" → server. |
| 3 | The preamble: `_GNU_SOURCE` and the includes | constant | 68–90 | orientation | Why `_GNU_SOURCE` must precede every system header (asprintf / srand48 on old glibc); the one include that matters, `infiniband/verbs.h`. Skimmable. |
| 4 | Sizing constants | constant | 91–105 | constants | `BUFFER_SIZE` 1 MB (never modified after init → no reuse hazard at full **window depth**); `CTRL_POOL_DEPTH` 32 vs `SWEEP_SIZES` 21 (the pool-covers-the-sweep proof); `CTRL_MSG_LEN` 64. |
| 5 | The counts tables: `MSG_COUNTS` and `WARMUP_COUNTS` | constant | 106–121 | measurement | The ex1-verbatim **counts table**: 21 entries for 2⁰..2²⁰; warmup counts 4–32 — the **warmup batch** concept in isolation (pipe-filling claim vs counts < W — flag the audit's finding 11 nuance). |
| 6 | The control message: tag and sequence | struct | 122–133 | control, types | 8-byte **control message**: fixed tag + **sequence counter** 0..20; the compile-time-size assert trick (`typedef char arr[cond ? 1 : -1]`). |
| 7 | The control deadline and the SQ slack | constant | 134–149 | control, data-path | `CTRL_POLL_TIMEOUT_SEC` 10 (dead peer → verify.sh's own timeout would fire); `QP_SLACK` 1024 (the done-always-fits invariant); `WINDOW_DEFAULT` 256 / `SIGNAL_INTERVAL_DEFAULT` 64 — first definitions of **window depth (W)** and **signal interval (K)**, isolated from the mechanism. |
| 8 | `MAX_INLINE_DATA_DECLARE` | constant | 150–158 | data-path | The largest declared inline; mlx4 rejects over-declared QPs and no portable query exposes the ceiling → stepped down at creation; the read-back is the runtime value. First touch of **max_inline_data** / **inline**. |
| 9 | The handshake wire format | constant | 159–168 | handshake | `DEST_FMT` / `_SERVER` / `_PARSE` kept in one place so send and parse cannot drift; 128-byte fixed **handshake** messages. |
| 10 | The wr_id taxonomy | constant | 169–184 | control, data-path | The four wr_ids: all 32 **control receive pool** receives share one id (one shared control area — which receive completed never matters); done always signaled; ack signaled so the server consumes its own completion; one id for all data WRITEs. |
| 11 | `struct bw_context` | struct | 185–200 | setup, types | The central object: device, pd, MRs (the 1 MB buffer + control area), cq, qp, buffers, `max_inline_data` / `sq_depth` (negotiated values read back), portinfo. |
| 12 | `struct bw_dest` | struct | 201–211 | handshake, types | The remote's address: lid/qpn/psn/gid + server-only `buf_addr`/`rkey` (zero on the client — the server never touches client memory). |
| 13 | GID conversions: `wire_gid_to_gid` / `gid_to_wire_gid` | function | 212–232 | handshake | The 32-hex-char wire form; endianness via `ntohl`/`htonl` per 32-bit lane; `tmp[9]` trick. |
| 14 | Full-read and full-write: `bw_read_full` / `bw_write_full` | function | 233–260 | handshake | Loop until `len` bytes or stream end; short reads would break the fixed-size parse. |
| 15 | `bw_parse_dest` | function | 261–285 | handshake | `DEST_FMT_PARSE`; the `expect_addr` asymmetry — the client requires all six fields (a truncated server message must not pass with addr/rkey zero), the server accepts four. |
| 16 | `bw_connect_qp`: RTR, then RTS | function | 286–347 | qp-lifecycle | The QP state machine as beacon: RTR attrs (dest_qpn, rq_psn, min_rnr_timer, ah_attr), the GRH conditional (remote GID + local gid index → global addressing, else LID — the course fabric's normal mode); the mask lists; then RTS (timeout 14 / retry 7 / rnr_retry 7, sq_psn). |
| 17 | The client's handshake (1): resolve and connect | function | 348–392 | handshake | `getaddrinfo`, the connect loop; the silent non-zero exit when no server listens — the T1 acceptance criterion, a predict block. |
| 18 | The client's handshake (2): the three address beats | function | 393–424 | handshake | Send our 4-field address → read the server's 6-field message → send `"ready"` before closing (the server keeps the socket open until signaled). JIT: **GID conversion** (13), **wire format** (9), **full read/write** (14), **parse** (15). |
| 19 | The server's handshake (1): listen and accept | function | 425–484 | handshake | `AI_PASSIVE`, `SO_REUSEADDR`, `listen(1)`, `accept`. The mirror of 17. |
| 20 | The server's handshake (2): the exchange | function | 485–536 | handshake | Read the client's 4 fields → **connect QP mid-exchange** (the server's RTR→RTS happens inside the handshake) → send 6 fields incl. `buf_addr`/`rkey` → check the `"ready"` beat count (the template left it unchecked — flag it). |
| 21 | `bw_init_ctx` (1): buffers, device, and the resources | function | 537–612 | setup | Buffer fill `0x7b + is_server`; `ibv_open_device`; the `max_qp_wr` clamp (`max_send_wr = window + QP_SLACK`); PD; MRs — server's buffer with `IBV_ACCESS_REMOTE_WRITE` (the WRITEs land there), client's without; CQ sized send+recv. JIT: **bw_context** (11), **sizing constants** (4). Predict: "why does only the server's buffer carry remote-write permission?" |
| 22 | `bw_init_ctx` (2): creating the QP | function | 613–647 | setup | The inline-declaration step-down loop (1024 → 0 in 64s): mlx4 rejects over-declared `max_inline_data`, no portable query → step until creation succeeds. JIT: **MAX_INLINE_DATA_DECLARE** (8). |
| 23 | `bw_init_ctx` (3): read-back | function | 648–661 | setup | `ibv_query_qp(IBV_QP_CAP)` — the driver may clamp, so the read-back is the runtime `max_inline_data` and `sq_depth` the data path uses. **max_inline_data** defined here. |
| 24 | `bw_init_ctx` (4): INIT | function | 662–683 | setup, qp-lifecycle | The first QP state: pkey_index, port, `qp_access_flags` (REMOTE_READ \| REMOTE_WRITE) — what the peer may do to our memory. |
| 25 | The control receive pool: `bw_post_control_recvs` | function | 684–709 | control | All 32 receives posted once at init, one wr_id, one shared 64-byte area, **never refreshed** — 21 messages per direction consume 21 of 32. **Control receive pool** defined here. JIT: **wr_id taxonomy** (10). |
| 26 | Posting a control SEND: `bw_post_ctrl_send` | function | 710–748 | control | The **done**/**ack** carrier: always signaled; **inline** when `max_inline_data` allows (it always does in practice), else staged in the registered control area with its lkey. |
| 27 | The poll loop: `bw_wc_bad` and `bw_poll_until` | function | 749–809 | control | The shared **poll loop**: one CQE at a time, routed by wr_id bitmask (the data/done/ack taxonomy), `want`/`pass` split; bad status or unexpected wr_id = protocol error; the 10 s deadline beats a hung busy poll. |
| 28 | Receiving and verifying: `bw_recv_ctrl` | function | 810–838 | control | Poll for `BW_RECV_WRID`, stamp t1 (the client's clock stop), verify tag + **sequence counter**; mismatch = desynchronized exchange. **Completion barrier** hook: the ack's arrival proves every prior WRITE landed. |
| 29 | `struct bw_data_state` | struct | 839–853 | data-path, types | Per-size stream accounting: `posted` (every WR) and `outstanding` (posted minus refill-reclaimed, exactly K per CQE). Scoped to one size — the ack wait consumes the residuals without touching it. |
| 30 | The refill: `bw_refill` | function | 854–888 | data-path | **Refill**-never-empty: reclaim ready CQEs only while the window is full (or the SQ is device-shallow), return immediately, repost; K-exact accounting (in-order RC); the final list's CQE stays for the ack wait. **Watch-out (flag it)**: the struct comment's attribution to the "warmup residual" is inaccurate (audit finding 6B) — the code is right, the comment isn't. Hardest station of the run leg. |
| 31 | The streaming writes: `bw_post_writes` | function | 889–949 | data-path | K-WR linked lists, one `ibv_post_send` each, last list takes the remainder; signal schedule `t % k == 0 || (final && last)`; `IBV_SEND_INLINE` when `size ≤ max_inline_data`, else the registered buffer; remote_addr/rkey. The `ibv_post_send` **beacon**. Predict: "which WRs of the stream get signaled?" → the K-th and the final one. |
| 32 | The result line: `bw_print_result` | function | 950–965 | measurement | The ex1-identical output contract: `size\t%.2f\tunit`, auto-scaled bps → Gbps, nothing else (verify.sh enforces it). |
| 33 | `bw_client_bench` | function | 966–1028 | measurement, data-path | The per-size run: **warmup batch** rides the windowed stream → clock starts at the **first timed post** → **timed batch** → **done** SEND → **ack** receive stops the clock (ADR-0003) → elapsed → print. The mechanism station framing the whole leg; JIT: **counts tables** (5), **control message** (6), **data state** (29). |
| 34 | The server's control exchange: `bw_server_ctrl_exchange` | function | 1029–1053 | control | Per size: receive done, verify seq, send ack, consume the ack's own completion before the next done — "it is the guarantee the ack left the HCA". Predict: "why consume the ack's send completion first?" |
| 35 | Teardown: `bw_close_ctx` | function | 1054–1092 | teardown | Destroy order QP → CQ → MRs → PD → device, then frees; completions all consumed before teardown (the last ack wait is a barrier). |
| 36 | The usage text | constant | 1093–1112 | main | The runnable face of the option table; reference station, skimmable. |
| 37 | `main` (1): defaults and the option table | function | 1113–1203 | main | The entry point, read early and comprehensively (the research's main-first rule): defaults W=256/K=64, the `getopt_long` table, the switch with range guards. JIT: **deadline and slack** (7) at the defaults. |
| 38 | `main` (2): role dispatch and the device list | function | 1204–1244 | main | Role by argv (`optind == argc - 1` → client; none → server — predict "what makes this process a server?"); the `k ≤ window && k ≤ QP_SLACK` guard (the done-always-fits invariant); `sysconf(_SC_PAGESIZE)`; device list + selection. |
| 39 | `main` (3): identity and the handshake | function | 1245–1298 | main | `bw_init_ctx` → whole control receive pool posted **before the handshake** (RQ can never find itself empty) → portinfo/LID/GID/`qp_num`/`psn` (`lrand48() & 0xffffff`) → dispatch to the role's exchange → client connects its QP after the exchange. JIT: **bw_dest** (12). |
| 40 | `main` (4): the run and teardown | function | 1299–1320 | main | Client → `bw_client_bench`; server → `bw_server_ctrl_exchange`; then `bw_close_ctx`, frees, exit code. The tour's route map: each leg below expands a call site of this station. |

## 3. Line-ownership check

Ranges are contiguous and disjoint by construction (each station starts on the separator blank of the block before it); the sum of owned lines is 1320 = the file's length. Verified with a script against `bw.c` (every line 1–1320 matched exactly once).

## 4. The tour route — six legs

Order per `docs/research/learning-path.md`: whole-program model (Brooks's primary hypothesis) → `main` early and comprehensively (Busjahn 2021; Peitek 2020) → execution order with **definitions just-in-time at first use** (Pennington 1987; Ko 2006) → difficulty ramp with isolated elements before the interaction (Sweller 1998; Collins 1989) → predict-then-confirm stations as completion problems (van Merriënboer 1990) → expert escapes (Kalyuga 2003). Station numbers are the partition table's.

**Leg 0 — The map (orientation).** `2` (the header comment — the whole-program model; its paragraphs map 1:1 onto the legs below) → `1` (license: the tour's **skip** station) → `3` (preamble, skimmable).

**Leg 1 — The spine: main (entry).** `37` (defaults + options; JIT `7` — W and K defined in isolation, before any mechanism) → `36` (usage, the runnable reference) → `38` (role dispatch; the K guard) → `39` (identity: pool-before-handshake, LID/GID/QPN/PSN; JIT `12`) → `40` (the run and teardown — the route map for legs 2–5). This leg is the research's "experts read the entry point early and comprehensively" — the reader sees the whole run's skeleton before any deep dive.

**Leg 2 — Booting the context (setup).** From `main`'s first call: `11` (**bw_context** — the central data structure the primary hypothesis needs, worth visiting early) → `21` (init_ctx 1: buffers, device, MRs, CQ; JIT `4`) → `22` (QP creation; JIT `8`) → `23` (read-back — **max_inline_data** defined) → `24` (INIT) → `10` (wr_id taxonomy) → `25` (the control receive pool — **control receive pool** defined). Difficulty: ramps from allocation to the inline-stepping loop.

**Leg 3 — The handshake (handshake + qp-lifecycle).** The client's story first (the active side): `17` (resolve/connect; the silent-exit T1 criterion as a predict block) → `18` (the three beats; JIT `13` → `9` → `14` → `15` in beat order) → `16` (**connect_qp**: the RTR→RTS state machine beacon). Then the server's mirror: `19` (listen/accept) → `20` (the exchange; the mid-exchange QP connect re-reads station 16 — a cross-link, not a revisit; the "ready"-beat count check the template lacked). Closing predict: "which side connects its QP while the other is still sending its address?" → the server, at station 20.

**Leg 4 — The run: windowed stream and control (data-path, measurement, control).** The client's per-size run, following `bw_client_bench`'s own execution: `33` (the mechanism frame: warmup → timed → done → ack, clock window per ADR-0003) → JIT `5` (counts tables — the **counts table** and **warmup batch** in isolation, per element-interactivity) → `6` (the control message: tag + seq) → `29` (data state — the accounting) → `31` (streaming writes: K-WR lists, signal schedule — the `ibv_post_send` beacon) → `27` (the poll loop: wc classifier + deadline wait — JIT at the refill's first poll) → `30` (**refill**, the leg's hardest: the window discipline, K-exact accounting, the device-shallow corner, the final-CQE-for-the-ack-wait rule; flag the audit's comment inaccuracy here) → `26` (the done SEND, always signaled) → `28` (receiving the ack: the 10 s deadline, seq verify, the clock stop — **completion barrier** explained: ack arrival proves every WRITE landed) → `32` (the result line — the ex1 contract the whole measurement exists to produce).

**Leg 5 — The other side and teardown (control, teardown).** `34` (the server's control exchange: done → ack → consume own completion; predict-then-confirm) → `35` (**close_ctx**: the destroy order). Diversity (Collins 1989): teardown, not just the hot path, before the finish.

**Leg 6 — The capstone (content station, owns no lines — flag for review).** The whole run, end to end: the header comment's claims revisited with everything understood; the run's shape (one binary, two roles, the TCP handshake, the QP lifecycle, the windowed stream, the per-size control exchange); the numbers (CONTEXT.md's **Inline** entry: ≤1 KB capped ~6.4 Gbps by the inline path, above that host-interface-bound ~38–42.5 Gbps, ADR-0004/0007) — why the Gbps curve looks the way it does.

**Predict-then-confirm inventory** (the tour's completion problems): 2 (role by argv), 17 (silent exit), 21 (server-only REMOTE_WRITE), 22 (why step the inline declaration down), 31 (which WRs are signaled), 33/40 (when the clock starts/stops), 34 (why consume the ack's own completion), 38 (why K ≤ min(window, QP_SLACK)), plus Leg 3's closing question.

**Expert escapes**: skip stations `1` (license), skim `3` (preamble), `36` (usage, reference); every station's summary line first.

**Beacons to name**: the `ibv_post_send` call (31/26), the poll-CQ loop (27/30), the QP state machine (16/24), `ibv_reg_mr` (21) — the stereotypical Verbs plan (create QP → post WR → poll CQ) the reader will meet again in other code.

## 5. Open questions for the review (HITL)

1. **Capstone as a content station** — owns no lines, per CodeTour's content-step precedent. The map's destination names a capstone; the partition convention says every line has one owner, so the capstone stands outside the line map. OK?
2. **Station type `file`** — license, header comment, and preamble don't fit function/struct/constant; extend the type list or fold them elsewhere?
3. **Compound-function splits** — `bw_init_ctx` → 4 phases, `main` → 4, the exchanges → 2 each. Station titles describe phases, not function names. Keep, or restore whole-function stations?
4. **11 chapter tags** — orientation, constants, types, handshake, qp-lifecycle, setup, control, data-path, measurement, teardown, main. Right granularity? (The tour minimap's chapter row.)
5. **Leg 3 ordering** — client's exchange → QP connect → server's exchange (server's connect shown as cross-link into 16). Alternative: both exchanges first, then one visit to 16. The chosen order follows the client's execution; the alternative follows the file. Which reads better?
6. **Warmup nuance flagged** — the audit's finding 11 (warmup 4–32 < W, pipe not literally full at t0) surfaced as a watch-out at station 5. Keep as a watch-out, or omit (it's ~1% measurement noise)?
7. **The station count** — 40, from the code; the map's "~50" was sizing, not a target. Comfortable?

After approval this ticket closes and authoring tickets #25–#28 unblock.
