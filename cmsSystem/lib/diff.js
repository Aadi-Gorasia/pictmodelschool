"use strict";
/**
 * lib/diff.js
 * ---------------------------------------------------------------------------
 * A classic LCS (longest common subsequence) line diff. This is a *textual*
 * diff, not a semantic DOM diff - building a reliable structural HTML diff
 * is a much bigger undertaking, and the spec explicitly allows falling back
 * to "a reliable HTML/text diff rather than pretending to have a full
 * structural diff." This one is genuinely reliable: it's the same algorithm
 * behind most line-based diff tools, just without the fancy output options.
 *
 * Guarded for pathological input: LCS is O(n*m) in time and memory, so
 * enormous files are rejected with a clear reason rather than hanging the
 * process or exhausting memory.
 */

const MAX_LINES_FOR_DIFF = 6000; // ~36M cell DP table at the worst case; comfortably fast for that size

function splitLines(text) {
  return text.replace(/\r\n/g, "\n").split("\n");
}

/**
 * Returns { ops: [{type:'equal'|'add'|'remove', line:string}], truncated:boolean }
 * or throws if inputs are too large to diff safely.
 */
function diffLines(oldText, newText) {
  const a = splitLines(oldText || "");
  const b = splitLines(newText || "");

  if (a.length > MAX_LINES_FOR_DIFF || b.length > MAX_LINES_FOR_DIFF) {
    return {
      ops: [],
      tooLarge: true,
      reason: `One of the documents has more than ${MAX_LINES_FOR_DIFF} lines - too large to line-diff safely. Showing summary stats instead.`,
      stats: { oldLines: a.length, newLines: b.length },
    };
  }

  const n = a.length;
  const m = b.length;
  // dp[i][j] = length of LCS of a[i..n) and b[j..m)
  const dp = new Array(n + 1);
  for (let i = 0; i <= n; i++) dp[i] = new Uint32Array(m + 1);
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }

  const ops = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      ops.push({ type: "equal", line: a[i] });
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      ops.push({ type: "remove", line: a[i] });
      i++;
    } else {
      ops.push({ type: "add", line: b[j] });
      j++;
    }
  }
  while (i < n) {
    ops.push({ type: "remove", line: a[i] });
    i++;
  }
  while (j < m) {
    ops.push({ type: "add", line: b[j] });
    j++;
  }

  const added = ops.filter((o) => o.type === "add").length;
  const removed = ops.filter((o) => o.type === "remove").length;

  return { ops, tooLarge: false, stats: { added, removed, oldLines: n, newLines: m } };
}

module.exports = { diffLines, MAX_LINES_FOR_DIFF };
