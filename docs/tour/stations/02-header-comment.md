# The header comment: the whole program in one place

- type: file
- tags: orientation
- lines: 33-67
- skip: no

The tour's primary hypothesis, stated in the file's own words: `bw.c` is a one-binary client-server benchmark that measures how many bytes per second one machine can RDMA WRITE into another. Read this comment before any code — it is the whole program at once.

**What.** One comment, five paragraphs: the roles (one binary, decided by argv), the Stage-5 streaming data path (T5), the control protocol (T3), device init and the handshake, and the template origin.

**How.** Read it as a map. The roles paragraph: no hostname argument = server, hostname = client. The data-path paragraph is the run: the 21-size **size sweep** (2⁰..2²⁰), per size a **warmup batch** then a **timed batch** of RDMA WRITEs posted as K-WR linked lists with **window depth (W)** = 256 and **signal interval (K)** = 64 by default, only the K-th WR signaled (one CQE per K WRs), reclaimed by the **refill** while the window is full, messages ≤ `max_inline_data` sent **inline**; the clock starts at the first timed post and stops at the ack's receive completion (ADR-0003); each size prints the ex1-identical result line. The control paragraph: per size one done SEND and one ack SEND, both riding the data QP (ADR-0001) into the 32-deep **control receive pool**, never refreshed. The init paragraph: the two registrations, QP create → init → RTR → RTS, and the TCP **handshake** of LID/QPN/PSN/GID plus the server's buffer addr/rkey. The last paragraph: adapted from `bw_template.c`.

**Why.** The tour's first stop is the whole-program model — the researched rule that a reader needs the primary hypothesis before the details. If the comment is understood, every later station is a zoom into a claim it already made. The tour legs map 1:1 onto its paragraphs:

:::table
| Header paragraph | What it claims | Tour leg |
|---|---|---|
| Roles by argv | one binary, two roles — no hostname = server | Leg 1 (main, role dispatch) |
| The streaming data path (T5) | the windowed stream, the counts, the clock, the output contract | Leg 4 (the run) |
| The control protocol (T3) | done/ack per size, on the data QP | Leg 5 (the other side) |
| Device init and handshake | context, QP lifecycle, the TCP exchange | Leg 2 (setup), Leg 3 (handshake) |
| Template origin | what was inherited from `bw_template.c` | throughout |
| The whole comment | the claims, revisited with everything understood | Leg 6 (the capstone) |
:::

> **Predict** — Which role does a run with no hostname take?
> **Reveal** — The server. One binary decides by argv: a hostname makes it the client, none makes it the server — you will see that decision at the role dispatch in main, and it is why the server's buffer gets the remote-write key (station 26).

> ⚠ The comment states the design's numbers (W = 256, K = 64, the 32-deep pool) alongside the code's own definitions. The constants at stations 4 and 7 are the code's truth — if the two ever disagree, trust the code.

**Cross-links:** `bw_client_bench`, `bw_server_ctrl_exchange`, `bw_init_ctx`, `bw_close_ctx`, `MSG_COUNTS`
