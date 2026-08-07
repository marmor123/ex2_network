# `main` (2): the option table and the getopt loop

- type: function
- tags: main
- lines: 1131-1148
- skip: no

The option table — long name → flag → letter — and the `getopt_long` loop that feeds the switch at station 48, one option per pass.

**What.** A `static struct option long_options[]` with seven entries (`port`→`p`, `ib-dev`→`d`, `ib-port`→`i`, `window`→`r`, `signal-interval`→`k`, `count`→`n`, `gid-idx`→`g`), each with `has_arg = 1`, terminated by a zero entry; then `while (1) { c = getopt_long(argc, argv, "p:d:i:r:k:n:g:", long_options, NULL); if (c == -1) break; ... }`.

**How.** The table is the long-form spelling of the option string: `getopt_long` accepts both `--window=512` and `-r 512`, reporting the letter either way. The loop is the canonical shape — call until `-1`, then switch on the returned letter (station 48). The `static` table is built once, at first call, not per iteration.

**Why.** Two spellings, one handling path: the table and the option string must agree, and keeping both next to the loop makes drift visible — `usage` (station 45) is the third copy of the same list, and all three are maintained together. The `has_arg = 1` on every option is why each case in the switch may read `optarg` unconditionally: the string `"p:d:i:r:k:n:g:"` (every letter followed by `:`) promises each option consumes an argument.

**Cross-links:** `main`, `getopt_long`, `usage`, `long_options`
