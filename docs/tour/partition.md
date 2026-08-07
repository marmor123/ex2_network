# The station partition and tour route for bw.c (ticket #24)

Deliverable of wayfinder ticket **#24 Partition bw.c into stations and draft the tour route**.
Pins: `bw.c` blob `8db18617ff8e69026dbe0502fc438e5b34d89fd4` (branch `tour/partition`, off `prototype/tour-shell` HEAD `3e8772a`); stations are anchored to this file's line numbers and must be re-anchored if `bw.c` moves.

The partition is **flat and exact**: every line 1–1320 is owned by exactly one station; ranges are contiguous and disjoint (verified programmatically, §4). The route (§5) orders the stations per the researched learning path (`docs/research/learning-path.md`, ticket #23): whole-program map first, `main` early and comprehensively, then execution order with definitions attached just-in-time at first use, difficulty ramp, predict-then-confirm, expert escapes.

## 1. Decisions from the review (2026-08-07)

| # | Question | Decision |
|---|---|---|
| Q1 | Capstone placement | **Content station** — owns no lines; the line map stays exact; build ticket #29 gains a "no-anchor station" item; authoring ticket #28 writes it. |
| Q2 | The license / header comment / preamble don't fit function/struct/constant | **Add the `file` station type** — its explanation skeleton carries the "you can skip this" affordance. |
| Q3 | Split the compound functions into phases | **Yes** — 8 compounds become 28 phase stations (see §2). |
| Q4 | Chapter-tag granularity | **9 tags**: orientation, types, handshake, setup, control, data-path, measurement, main, closing. `constants` folds into `setup`, `qp-lifecycle` into `setup`/`handshake`, `teardown` folds into `closing` (with the capstone). No tag has fewer than 2 stations. |
| Q5 | Handshake leg ordering | **The client's thread**: client exchange → QP connect → server exchange (server's mid-exchange connect as the leg's climax). |
| Q6 | The warmup letter-vs-intent gap (audit finding 11) | **Taught loudly** — a full predict-then-confirm block with the arithmetic and the measured evidence, at the clock station (§6). |
| Q7 | Borderline stations too large | **Split everything ≥ ~55 lines**. The four flagged (91/76/63/62) split, and the new largest tier (61/61/60/55/54/52) was split too — the threshold isn't arbitrary. One exception: the `main` option switch stays whole at 55 lines because its card is a *table* (the named table extension block), not prose. Net result: **52 stations** — the charting session's "~50" sizing lands on the code's actual answer. |

## 2. Conventions applied

- **Blank lines** belong to the station that follows them (a block starts on the separator blank).
- **Granularity**: unit stations (one function / struct / constant / file block each) plus **phase stations** from splitting 8 compound functions at blank-line boundaries: `bw_connect_qp` → 2, `bw_exch_dest_client` → 2, `bw_exch_dest_server` → 4, `bw_init_ctx` → 6, the poll pair (`bw_wc_bad` + `bw_poll_until`) → 2, `bw_post_writes` → 2, `bw_client_bench` → 3, `main` → 7. Station titles describe phases, not function names.
- **Station types**: `function`, `struct`, `constant`, `file`.
- **Chapter tags** (multi-valued, 1–2 per station): `orientation`, `types`, `handshake`, `setup`, `control`, `data-path`, `measurement`, `main`, `closing`.
- **Vocabulary**: notes reference CONTEXT.md terms in **bold** — stations must use them verbatim in explanations.
- **Largest stations**: 55 (main's option switch — table card), 47 (server's getaddrinfo/bind), 45 (client's resolve/connect), 42 (the deadline wait, the RTR attrs). Smallest: 12 (the result line and cleanup), 13 (listen and accept) — small but single-story.

## 3. The partition — 52 stations

| # | Station | Type | Lines | Ch. | Rough notes |
|---|---|---|---|---|---|
| 1 | License and provenance | file | 1–32 | orientation | GPL/BSD dual license, the OpenIB heritage. Boilerplate — the tour's first **skip** station (expert-escape demo). |
| 2 | The header comment: the whole program in one place | file | 33–67 | orientation | The primary-hypothesis station: what bw.c measures, one binary/two roles by argv, T5 streaming data path, control protocol (T3), handshake, template origin. **Size sweep**, roles. Predict: "which role does a run with no hostname take?" → server. |
| 3 | The preamble: `_GNU_SOURCE` and the includes | file | 68–90 | orientation | Why `_GNU_SOURCE` must precede every system header (asprintf / srand48 on old glibc); the one include that matters, `infiniband/verbs.h`. Skimmable. |
| 4 | Sizing constants | constant | 91–105 | setup, control | `BUFFER_SIZE` 1 MB (never modified after init → no reuse hazard at full **window depth**); `CTRL_POOL_DEPTH` 32 vs `SWEEP_SIZES` 21 (the pool-covers-the-sweep proof); `CTRL_MSG_LEN` 64. |
| 5 | The counts tables: `MSG_COUNTS` and `WARMUP_COUNTS` | constant | 106–121 | measurement | The ex1-verbatim **counts table**: 21 entries for 2⁰..2²⁰; warmup counts 4–32 — the **warmup batch** concept in isolation (cross-link to the loud treatment at station 41). |
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
| 16 | `bw_connect_qp` (1): the RTR attributes | function | 286–327 | handshake, setup | The QP state machine as beacon, first half: the RTR attr struct (dest_qpn, rq_psn, max_dest_rd_atomic, min_rnr_timer, ah_attr: dlid/sl/src_path_bits/port_num); the GRH conditional (remote GID + local gid index → global addressing, else LID — the course fabric's normal mode); the first `ibv_modify_qp` and its mask. |
| 17 | `bw_connect_qp` (2): RTS — the retry knobs | function | 328–347 | handshake, setup | The second half: timeout 14 / retry_cnt 7 / rnr_retry 7, sq_psn, max_rd_atomic, the second modify. Written role-neutral — the server calls both halves mid-exchange, the client after the exchange. |
| 18 | The client's handshake (1): resolve and connect | function | 348–392 | handshake | `getaddrinfo`, the connect loop; the silent non-zero exit when no server listens — the T1 acceptance criterion, a predict block. |
| 19 | The client's handshake (2): the three address beats | function | 393–424 | handshake | Send our 4-field address → read the server's 6-field message → send `"ready"` before closing (the server keeps the socket open until signaled). JIT: **GID conversion** (13), **wire format** (9), **full read/write** (14), **parse** (15). |
| 20 | The server's handshake (1): getaddrinfo and the bind loop | function | 425–471 | handshake | `AI_PASSIVE`, `SO_REUSEADDR`, the bind loop. The mirror of 18. |
| 21 | The server's handshake (2): listen and accept | function | 472–484 | handshake | `listen(1)` — one connection — and the blocking `accept` where the client arrives. Small but single-story. |
| 22 | The server's handshake (3): the client's address and the mid-exchange connect | function | 485–503 | handshake | Read the client's 4 fields, parse, **connect the QP mid-exchange** (the server's RTR→RTS happens inside the handshake, before it sends its own address) — the leg's climax. Predict: "why is the connect inside the exchange here, when the client's comes after?" |
| 23 | The server's handshake (4): our address, the rkey, and the ready beat | function | 504–536 | handshake | Send 6 fields incl. `buf_addr`/`rkey` (the client's WRITEs land there); check the `"ready"` beat count — the template left it unchecked, flag it. |
| 24 | `bw_init_ctx` (1): the context object and the buffers | function | 537–562 | setup | `calloc` ctx; the 1 MB buffer (`roundup(BUFFER_SIZE, page_size)`, fill `0x7b + is_server` — predict: why a different fill byte per role? so the two sides' buffers are distinguishable); the 64-byte control buffer. JIT: **bw_context** (11), **sizing constants** (4). |
| 25 | `bw_init_ctx` (2): the device and its advertised limits | function | 563–582 | setup | `ibv_open_device`; `ibv_query_device` — mlx4 caps WQEs, so `max_send_wr = window + QP_SLACK` and `max_recv_wr = CTRL_POOL_DEPTH` are clamped by `max_qp_wr` (the device-clamped corner the refill's second loop condition exists for). |
| 26 | `bw_init_ctx` (3): PD, MRs, and the CQ | function | 583–612 | setup | PD; the two registrations — the server's buffer with `IBV_ACCESS_REMOTE_WRITE` (the WRITEs land there), the client's without. Predict: "why only the server's?" The `ibv_reg_mr` **beacon**; CQ sized send+recv. |
| 27 | `bw_init_ctx` (4): creating the QP | function | 613–647 | setup | The inline-declaration step-down loop (1024 → 0 in 64s): mlx4 rejects over-declared `max_inline_data`, no portable query → step until creation succeeds. JIT: **MAX_INLINE_DATA_DECLARE** (8). Predict: "why step down instead of not declaring it?" |
| 28 | `bw_init_ctx` (5): read-back | function | 648–661 | setup | `ibv_query_qp(IBV_QP_CAP)` — the driver may clamp, so the read-back is the runtime `max_inline_data` and `sq_depth` the data path uses. **max_inline_data** defined here. |
| 29 | `bw_init_ctx` (6): INIT | function | 662–683 | setup | The first QP state: pkey_index, port, `qp_access_flags` (REMOTE_READ \| REMOTE_WRITE) — what the peer may do to our memory. |
| 30 | The control receive pool: `bw_post_control_recvs` | function | 684–709 | control | All 32 receives posted once at init, one wr_id, one shared 64-byte area, **never refreshed** — 21 messages per direction consume 21 of 32. **Control receive pool** defined here. JIT: **wr_id taxonomy** (10). |
| 31 | Posting a control SEND: `bw_post_ctrl_send` | function | 710–748 | control | The **done**/**ack** carrier: always signaled; **inline** when `max_inline_data` allows (it always does in practice), else staged in the registered control area with its lkey. |
| 32 | The completion classifier: `bw_wc_bad` | function | 749–767 | control | The first half of the **poll loop**: one CQE, classified — good status and a wr_id whose bit is set in `allowed`, else a protocol error, printed the same way in both poll sites. Reused by the refill. |
| 33 | The wait with a deadline: `bw_poll_until` | function | 768–809 | control | The second half of the **poll loop**: poll one CQE at a time, consume-and-ignore `pass` completions, stop at `want`; the 10 s deadline (CLOCK_MONOTONIC) beats a hung busy poll. |
| 34 | Receiving and verifying: `bw_recv_ctrl` | function | 810–838 | control | Poll for `BW_RECV_WRID`, stamp t1 (the client's clock stop), verify tag + **sequence counter**; mismatch = desynchronized exchange. **Completion barrier** hook: the ack's arrival proves every prior WRITE landed. |
| 35 | `struct bw_data_state` | struct | 839–853 | data-path, types | Per-size stream accounting: `posted` (every WR) and `outstanding` (posted minus refill-reclaimed, exactly K per CQE). Scoped to one size — the ack wait consumes the residuals without touching it. **Watch-out**: the comment's attribution of the "warmup residual" is inaccurate (audit finding 6B — the code is right, the comment isn't; warmup < K generates no CQEs). |
| 36 | The refill: `bw_refill` | function | 854–888 | data-path | **Refill**-never-empty: reclaim ready CQEs only while the window is full (or the SQ is device-shallow), return immediately, repost; K-exact accounting (in-order RC); the final list's CQE stays for the ack wait. JIT: **completion classifier** (32). Hardest station of the run leg. |
| 37 | The streaming writes (1): the stream's frame | function | 889–915 | data-path | The frame of `bw_post_writes`: the inline decision (`size ≤ max_inline_data` → `IBV_SEND_INLINE`, else the registered buffer), the chunk loop, and the **refill** gate before every list. |
| 38 | The streaming writes (2): building and posting each K-WR list | function | 916–949 | data-path | The K-WR linked lists, one `ibv_post_send` each, last list takes the remainder; signal schedule `t % k == 0 || (final && last)`; remote_addr/rkey; posted/outstanding accounting. The `ibv_post_send` **beacon**. Predict: "which WRs of the stream get signaled?" → the K-th and the final one. |
| 39 | The result line: `bw_print_result` | function | 950–965 | measurement | The ex1-identical output contract: `size\t%.2f\tunit`, auto-scaled bps → Gbps, nothing else (verify.sh enforces it). |
| 40 | `bw_client_bench` (1): the K-deep WR arrays | function | 966–990 | measurement, data-path | The arrays reused for every linked list of the sweep — allocated once per run, not per size. |
| 41 | `bw_client_bench` (2): the timed window — warmup, clock, timed batch, done, ack | function | 991–1016 | measurement, data-path | The per-size run: **warmup batch** rides the windowed stream → clock starts at the **first timed post** → **timed batch** → **done** SEND → **ack** receive stops the clock (ADR-0003) → the next size. JIT: **counts tables** (5), **control message** (6), **data state** (35). Contains the loud warmup block (§6). |
| 42 | `bw_client_bench` (3): the result line and the cleanup | function | 1017–1028 | measurement | The elapsed arithmetic (nsec borrow into double), the print call, rc = 0, the frees. JIT: **print_result** (39). |
| 43 | The server's control exchange: `bw_server_ctrl_exchange` | function | 1029–1053 | control | Per size: receive done, verify seq, send ack, consume the ack's own completion before the next done — "it is the guarantee the ack left the HCA". Predict: "why consume the ack's send completion first?" |
| 44 | Teardown: `bw_close_ctx` | function | 1054–1092 | closing | Destroy order QP → CQ → MRs → PD → device, then frees; completions all consumed before teardown (the last ack wait is a barrier). |
| 45 | The usage text | constant | 1093–1112 | main | The runnable face of the option table; reference station, skimmable. |
| 46 | `main` (1): the run's parameters and their defaults | function | 1113–1130 | main | The entry point, read early and comprehensively (the research's main-first rule): the run's parameters and defaults (port 18515, W = `WINDOW_DEFAULT`, K = `SIGNAL_INTERVAL_DEFAULT`, gidx −1) and `srand48` (the seed for the random PSN — cross-link to station 50). JIT: **deadline and slack** (7). |
| 47 | `main` (2): the option table and the getopt loop | function | 1131–1148 | main | The `long_options` table (name → flag → letter) and the `getopt_long` loop that feeds the switch. |
| 48 | `main` (3): the switch — parsing and validating each option | function | 1149–1203 | main | Seven cases, each validated at parse time: the range guards (`port` 0..65535, `window` > 0, `k` ≥ 1, `count` ≥ 1, `ib_port` ≥ 0) — `usage` + exit 1 on violation. The largest station (55 lines) by design: its card is a **table** (option → meaning → guard), not prose. |
| 49 | `main` (4): role dispatch and the device list | function | 1204–1244 | main | Role by argv (`optind == argc - 1` → client; none → server — predict "what makes this process a server?"); the `k ≤ window && k ≤ QP_SLACK` guard (the done-always-fits invariant); `sysconf(_SC_PAGESIZE)`; device list + selection (by name or first found). |
| 50 | `main` (5): context, the receive pool, and the local identity | function | 1245–1277 | main | `bw_init_ctx` → whole control receive pool posted **before the handshake** (RQ can never find itself empty) → the local identity: portinfo, LID, GID (or all-zero for LID mode), `qp_num`, `psn = lrand48() & 0xffffff`. JIT: **bw_dest** (12). |
| 51 | `main` (6): the handshake dispatch and the client's QP connect | function | 1278–1298 | main | The role's exchange: the client's beats, or the server's (which advertises its buffer — the WRITEs land here) — then the client connects its QP (stations 16/17) after the exchange; the server's connect already happened mid-exchange (station 22). The path MTU comes from the port's active MTU. |
| 52 | `main` (7): the run and teardown | function | 1299–1320 | main | Client → `bw_client_bench`; server → `bw_server_ctrl_exchange`; then `bw_close_ctx`, frees, exit code. The tour's route map: each leg below expands a call site of this station. |

## 4. Line-ownership check

Ranges are contiguous and disjoint by construction (each station starts on the separator blank of the block before it); the sum of owned lines is 1320 = the file's length. Verified with a script against `bw.c` (every line 1–1320 matched exactly once).

## 5. The tour route — six legs

Order per `docs/research/learning-path.md`: whole-program model (Brooks's primary hypothesis) → `main` early and comprehensively (Busjahn 2021; Peitek 2020) → execution order with **definitions just-in-time at first use** (Pennington 1987; Ko 2006) → difficulty ramp with isolated elements before the interaction (Sweller 1998; Collins 1989) → predict-then-confirm stations as completion problems (van Merriënboer 1990) → expert escapes (Kalyuga 2003). Station numbers are the partition table's; JIT stations are indented under the station whose first-use site introduces them.

**Leg 0 — The map (orientation).** `2` (the header comment — the whole-program model; its paragraphs map 1:1 onto the legs below) → `1` (license: the tour's **skip** station) → `3` (preamble, skimmable).

**Leg 1 — The spine: main (entry).** `46` (the run's parameters and defaults) → `7` (W and K defined in isolation, JIT at the defaults) → `47` (the option table and the getopt loop) → `48` (the switch — the table card) → `45` (usage, the runnable reference) → `49` (role dispatch; the K guard) → `50` (context, the receive pool, identity) → `12` (**bw_dest**, JIT at the identity) → `51` (the handshake dispatch and the client's QP connect) → `52` (the run and teardown — the route map for legs 2–5). This leg is the research's "experts read the entry point early and comprehensively" — the reader sees the whole run's skeleton before any deep dive.

**Leg 2 — Booting the context (setup).** From `main`'s first call: `11` (**bw_context** — the central data structure the primary hypothesis needs, worth visiting early) → `24` (the context object and the buffers) → `4` (sizing constants, JIT at BUFFER_SIZE) → `25` (the device and its advertised limits) → `26` (PD, MRs, and the CQ) → `27` (creating the QP) → `8` (**max_inline_data** declaration, JIT at the step-down loop) → `28` (read-back — **max_inline_data** defined) → `29` (INIT) → `10` (wr_id taxonomy) → `30` (the control receive pool — **control receive pool** defined). Difficulty: ramps from allocation to the inline-stepping loop.

**Leg 3 — The handshake (handshake + qp-lifecycle).** The client's story first (the active side): `18` (resolve/connect; the silent-exit T1 criterion as a predict block) → `19` (the three beats) → `13` → `9` → `14` → `15` (GID conversions, wire format, full read/write, parse — JIT in beat order) → `16` (RTR attributes) → `17` (RTS — the retry knobs; both written role-neutral). Then the server's mirror: `20` (getaddrinfo and the bind loop) → `21` (listen and accept) → `22` (the client's address and the **mid-exchange connect** — the leg's climax; predict: "why is the connect inside the exchange here, when the client's comes after?") → `23` (our address, the rkey, and the ready beat; the checked beat the template left unchecked).

**Leg 4 — The run: windowed stream and control (data-path, measurement, control).** The client's per-size run, following `bw_client_bench`'s own execution: `40` (the K-deep WR arrays) → `41` (the timed window — the mechanism frame: warmup → timed → done → ack, clock window per ADR-0003; contains the loud warmup block) → `5` (counts tables — the **counts table** and **warmup batch** in isolation, per element-interactivity) → `6` (the control message: tag + seq) → `35` (data state — the accounting) → `37` (the stream's frame: inline decision and the refill gate) → `36` (**refill**, the leg's hardest: the window discipline, K-exact accounting, the device-shallow corner, the final-CQE-for-the-ack-wait rule) → `32` (the completion classifier, JIT at the refill's poll) → `38` (building and posting each K-WR list; the signal schedule) → `31` (the done SEND, always signaled) → `34` (receiving the ack: the deadline, seq verify, the clock stop — **completion barrier** explained) → `33` (the wait with a deadline, JIT at the ack wait) → `42` (the result line and the cleanup) → `39` (**print_result** — the ex1 contract the whole measurement exists to produce).

**Leg 5 — The other side and teardown (control, closing).** `43` (the server's control exchange: done → ack → consume own completion; predict-then-confirm) → `44` (**close_ctx**: the destroy order). Diversity (Collins 1989): teardown, not just the hot path, before the finish.

**Leg 6 — The capstone (content station, chapter `closing`).** The whole run, end to end: the header comment's claims revisited with everything understood; the run's shape (one binary, two roles, the TCP handshake, the QP lifecycle, the windowed stream, the per-size control exchange); the numbers (CONTEXT.md's **Inline** entry: ≤1 KB capped ~6.4 Gbps by the inline path, above that host-interface-bound ~38–42.5 Gbps, ADR-0004/0007) — why the Gbps curve looks the way it does.

**Predict-then-confirm inventory** (the tour's completion problems): 2 (role by argv), 18 (silent exit), 24 (the buffer fill byte), 26 (server-only REMOTE_WRITE), 27 (why step the inline declaration down), 38 (which WRs are signaled), 41 (the warmup gap — the loud one, §6), 43 (why consume the ack's own completion), 49 (why K ≤ min(window, QP_SLACK)), 22 (Leg 3's closing question).

**Expert escapes**: skip stations `1` (license), skim `3` (preamble), `45` (usage, reference); every station's summary line first.

**Beacons to name**: the `ibv_post_send` call (38/31), the poll-CQ loop (32/33/36), the QP state machine (16/17/29), `ibv_reg_mr` (26) — the stereotypical Verbs plan (create QP → post WR → poll CQ) the reader will meet again in other code.

## 6. The warmup gap, taught loudly (Q6 — station 41)

At `bw_client_bench` (2), where the clock actually starts, as a predict-then-confirm block:

> **Before you read on — predict.** The comments — this function's, and the file header's — say the **warmup batch** fills the pipe so the clock starts with the pipe full. The warmup count for this size is **16 WRs**. The window is **W = 256**. When the clock starts, how full is the pipe?
>
> **Confirm — it is not full.** 16 of 256 slots: the pipe is 6% full at t0. The **timed batch** then ramps to depth W over the first ~40 µs of the measured window — under 1% of even the shortest batch (~2–3 ms at 32 B). The measured records say it is invisible: ADR-0006/0007 show each size doubling "within a hair of 2.0" at CV ≤ 0.40%.
>
> **So there are two true statements.** CONTEXT.md states the *intent* — "pipelined with it so the pipe is full when the clock starts" — and the code delivers the *letter*: a ~40 µs ramp-in inside the measured window. The measurement is unaffected. If you ever see these comments and the counts disagree, this is the gap: the comments describe the design's purpose, the counts are the code's actual arithmetic.

The same gap gets a one-line cross-link at station 5 (counts tables), not a second block — one loud treatment, one pointer.

## 7. Remaining review points

1. The three extra splits beyond the flagged four (consistency): the poll pair (`bw_wc_bad`/`bw_poll_until` → 2 stations — a CONTEXT.md concept now spans two stations, each cross-linked to it), `bw_post_writes` (2), `bw_exch_dest_server` (4), `main` (7).
2. Station 48 (main's option switch) kept whole at 55 lines on the table-card rationale. If that rationale fails, it splits at the case boundary (numeric options vs string options + default) — the split point exists.
3. The loud warmup block's wording (§6) — read it and edit as you like.
4. Small stations 21 (13 lines) and 42 (12 lines) are thin but single-story — merge them into their neighbors if they feel thin at authoring.

After approval this ticket closes and authoring tickets #25–#28 unblock.
