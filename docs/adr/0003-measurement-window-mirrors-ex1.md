# Measurement window mirrors ex1: clock runs until the ack arrives

The client's clock starts immediately before the first timed WRITE is posted and stops when the ack-receive completion is polled — the entire batch plus the control round trip is inside the measured window, exactly as in ex1 ("the clock runs until the ACK arrives"). The server's ack responsiveness is therefore on the client's clock by design.

This was a real choice: stopping the clock at the last WRITE post would measure only local enqueue rate and is strictly invalid for a throughput number (client-side completion does not imply the server received the data — the assignment's warning), and timing on both sides would produce a different quantity than ex1's. Keeping the ack inside the window preserves byte-identical output and class comparability with ex1's methodology at the cost of adding the control round trip (~10 µs) to every measurement, which is negligible above 1-byte sizes and identical in shape for all of them.

Output is the same 21 lines as ex1: `size\tthroughput\tunit` with units auto-scaled bps → Gbps, and nothing else printed.
