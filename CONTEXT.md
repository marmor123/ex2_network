# Verbs Throughput Benchmark

A client-server benchmark that measures unidirectional (client → server) throughput over InfiniBand RDMA WRITE, mirroring the protocol and output of the TCP exercise (ex1) on the course ConnectX-3 hardware. The client drives all data and timing; the server's only data-path role is absorbing WRITEs into its registered buffer.

## Language

**Timed batch**:
The `MSG_COUNTS[i]` RDMA WRITEs of one size whose transmission is timed; its elapsed time defines the throughput number for that size.
_Avoid_: iteration, run, test

**Warmup batch**:
The `WARMUP_COUNTS[i]` WRITEs sent before the timed batch, pipelined with it so the pipe is full when the clock starts.
_Avoid_: pre-test, priming

**Size sweep**:
The 21 message sizes (2⁰ to 2²⁰ bytes) measured in one run, ascending; one warmup + timed batch per size.
_Avoid_: loop, sequence

**Counts table**:
The per-size timed and warmup message counts, inherited from ex1's convergence experiments (throughput variance < 1% between doubled counts).
_Avoid_: iteration counts, message numbers

**Window depth (W)**:
The number of outstanding (posted, not yet completed) data WRs the SQ is allowed to hold; the pipeline never drains below it.
_Avoid_: tx_depth, queue size

**Signal interval (K)**:
Every K-th data WR is signaled (generates a CQE); completions are therefore accounted in multiples of K, exactly, because RC completions are in-order.
_Avoid_: batch size, poll period

**Refill**:
The send-loop discipline of reclaiming only the CQEs that are ready and reposting immediately, so the SQ never empties and the NIC never idles.
_Avoid_: drain, wait-for-all

**Control message**:
One of the two SENDs exchanged per size on the data QP: the done and the ack. The only messages in the run besides data WRITEs.
_Avoid_: handshake, ping, signal

**Done**:
The client's control message signaling the end of a size's timed batch; arriving via RC on the same QP, its receive completion proves every prior WRITE landed.
_Avoid_: finish, notify

**Ack**:
The server's control message back; its receive completion on the client stops the clock. Sent with `IBV_WR_SEND` per the assignment.
_Avoid_: reply, response, confirmation

**Completion barrier**:
The property that ack arrival implies all of the size's WRITEs are written in server memory — guaranteed by RC in-order delivery of the done SEND that precedes it.
_Avoid_: sync, round-trip

**Inline**:
Sending a message's data inside the WQE at post time (`IBV_SEND_INLINE`) instead of DMA-reading it from a buffer; used for every message ≤ `max_inline_data`.
_Avoid_: zero-copy, copy-less

**max_inline_data**:
The device-advertised inline limit, queried at runtime and declared at QP creation (mlx4 fails QP creation if the request exceeds it).
_Avoid_: inline size, inline limit

**Handshake**:
The one-time TCP exchange of QP addresses (LID/QPN/PSN/GID) and the server's buffer addr/rkey before any data flows. The only use of TCP in the run.
_Avoid_: connection, setup, negotiation

**Control receive pool**:
The 32 receive WRs each side posts once at init to absorb all 21 per-direction control messages; never refreshed.
_Avoid_: receives, RQ depth
