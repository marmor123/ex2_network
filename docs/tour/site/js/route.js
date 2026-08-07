/* The tour route — the researched learning path. Transcribed verbatim from
 * docs/tour/partition.md §5 (ticket #24), which orders the stations per
 * docs/research/learning-path.md (ticket #23): whole-program model first,
 * main early and comprehensively, then execution order with definitions
 * just-in-time at first use, difficulty ramp, predict-then-confirm, expert
 * escapes. Station ids are the partition numbers (NN, the file prefix);
 * "capstone" is the content station (owns no lines).
 *
 * If the partition's route changes, edit this list and re-run the
 * self-check — it verifies the route covers all 53 stations exactly once.
 */
const TOUR_ROUTE = [
  { leg: "The map",    stations: [2, 1, 3] },
  { leg: "main",       stations: [46, 7, 47, 48, 45, 49, 50, 12, 51, 52] },
  { leg: "Context",    stations: [11, 24, 4, 25, 26, 27, 8, 28, 29, 10, 30] },
  { leg: "Handshake",  stations: [18, 19, 13, 9, 14, 15, 16, 17, 20, 21, 22, 23] },
  { leg: "The run",    stations: [40, 41, 5, 6, 35, 37, 36, 32, 38, 31, 34, 33, 42, 39] },
  { leg: "Teardown",   stations: [43, 44] },
  { leg: "Capstone",   stations: ["capstone"] }
];
