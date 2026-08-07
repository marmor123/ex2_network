# The usage text

- type: constant
- tags: main
- lines: 1093-1112
- skip: no

The runnable face of the option table — what `main` prints when parsing fails, and the reference a student runs before the first launch. Skimmable.

**What.** `usage(argv0)` prints the two invocation forms — no hostname starts a server, `<host>` connects to a server — then the seven options with their meanings and defaults: `-p/--port` (18515), `-d/--ib-dev`, `-i/--ib-port`, `-r/--window` (W, default 256), `-k/--signal-interval` (K, default 64, max `min(window, QP_SLACK)`), `-n/--count`, `-g/--gid-idx` (default: LID-based).

**How.** Plain `printf` blocks, no fancy formatting — the option list is hand-aligned, `argv0` interpolated so the invocation lines show the real binary name. Every default matches the declarations in `main` (station 46), and the text spells the same guards the switch enforces (station 48): K is capped at `min(window, QP_SLACK)`, the gid index defaults to LID mode.

**Why.** This is the reference station of the option table: when the switch rejects an option it calls `usage` and exits — the text the user sees *is* the guard's explanation. It is also the tour's skimmable station: everything it says is said again, with the mechanism, at stations 46–49. Skim it now, return to it when a run misbehaves.

**Cross-links:** `usage`, `main`, `WINDOW_DEFAULT`, `SIGNAL_INTERVAL_DEFAULT`, `QP_SLACK`
