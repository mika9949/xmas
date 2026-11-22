/*
 * draw.test.js — dependency-free test for the draw algorithm.
 * Run with: node test/draw.test.js
 */

var assert = require("assert");
var fs = require("fs");
var path = require("path");

var draw = require("../draw.js");

var config = JSON.parse(
  fs.readFileSync(path.join(__dirname, "..", "data", "config.json"), "utf8")
);
var results = JSON.parse(
  fs.readFileSync(path.join(__dirname, "..", "data", "results.json"), "utf8")
);

var people = config.participants;
var forbidden = config.forbiddenPairs;
var lastYear = results["2025"];

var failures = 0;
function check(name, fn) {
  try {
    fn();
    console.log("  ok  - " + name);
  } catch (err) {
    failures++;
    console.log("  FAIL - " + name + ": " + err.message);
  }
}

console.log("draw.js tests");

// Repeatedly draw with the full 2026 rule set and verify every result is valid.
check("1000 constrained draws are all valid", function () {
  for (var i = 0; i < 1000; i++) {
    var assignment = draw.drawAssignment(people, {
      forbiddenUndirected: forbidden,
      lastYearAssignment: lastYear,
    });
    assert(assignment !== null, "draw #" + i + " returned null (infeasible)");
    var problems = draw.validateAssignment(people, assignment, {
      forbiddenUndirected: forbidden,
      lastYearAssignment: lastYear,
    });
    assert.strictEqual(
      problems.length,
      0,
      "draw #" + i + " invalid: " + problems.join("; ")
    );
  }
});

// It must be a genuine permutation (everyone gives once, receives once).
check("result is a permutation of the people", function () {
  var assignment = draw.drawAssignment(people, {
    forbiddenUndirected: forbidden,
    lastYearAssignment: lastYear,
  });
  var givers = Object.keys(assignment).sort();
  var receivers = Object.keys(assignment)
    .map(function (g) {
      return assignment[g];
    })
    .sort();
  assert.deepStrictEqual(givers, people.slice().sort(), "givers mismatch");
  assert.deepStrictEqual(receivers, people.slice().sort(), "receivers mismatch");
});

// Randomness: across many draws we should see more than one distinct outcome.
check("produces varied results across runs", function () {
  var seen = {};
  for (var i = 0; i < 200; i++) {
    var a = draw.drawAssignment(people, {
      forbiddenUndirected: forbidden,
      lastYearAssignment: lastYear,
    });
    seen[JSON.stringify(a)] = true;
  }
  assert(Object.keys(seen).length > 1, "all draws were identical");
});

// A genuinely impossible constraint set must return null, not a bad result.
check("returns null when no valid draw exists", function () {
  // Two people who may not give to each other and can't give to themselves.
  var a = draw.drawAssignment(["A", "B"], {
    forbiddenUndirected: [["A", "B"]],
  });
  assert.strictEqual(a, null, "expected null for impossible 2-person case");
});

// With forbidMutual, no two people may give to each other (no two-person loops).
check("forbidMutual produces no two-person loops", function () {
  for (var i = 0; i < 1000; i++) {
    var assignment = draw.drawAssignment(people, {
      forbiddenUndirected: forbidden,
      lastYearAssignment: lastYear,
      forbidMutual: true,
    });
    assert(assignment !== null, "mutual-free draw #" + i + " returned null");

    var problems = draw.validateAssignment(people, assignment, {
      forbiddenUndirected: forbidden,
      lastYearAssignment: lastYear,
      forbidMutual: true,
    });
    assert.strictEqual(problems.length, 0, problems.join("; "));

    // Belt and braces: explicitly confirm no A->B with B->A.
    Object.keys(assignment).forEach(function (g) {
      assert.notStrictEqual(
        assignment[assignment[g]],
        g,
        "two-person loop between " + g + " and " + assignment[g]
      );
    });
  }
});

// validateAssignment should flag a two-person loop when asked.
check("validateAssignment flags a two-person loop", function () {
  var bad = { A: "B", B: "A", C: "D", D: "C" };
  var problems = draw.validateAssignment(["A", "B", "C", "D"], bad, {
    forbidMutual: true,
  });
  assert(
    problems.some(function (p) {
      return p.indexOf("two-person loop") === 0;
    }),
    "expected a two-person-loop problem, got: " + problems.join("; ")
  );
});

// chainOrder lists everyone once, grouped so each receiver leads into the next
// row's giver — works whether the draw is one loop or several.
check("chainOrder lists everyone once in loop order", function () {
  // Use the seeded 2025 result, which is two separate loops.
  var order = draw.chainOrder(lastYear);
  assert.deepStrictEqual(
    order.slice().sort(),
    people.slice().sort(),
    "chainOrder must include everyone exactly once"
  );
  // Each adjacent pair within a loop connects; a receiver either starts the next
  // row or closes its loop back to an earlier (already-listed) giver.
  var seen = {};
  for (var i = 0; i < order.length; i++) {
    var giver = order[i];
    var receiver = lastYear[giver];
    seen[giver] = true;
    var next = order[i + 1];
    assert(
      receiver === next || seen[receiver],
      giver + " -> " + receiver + " neither continues nor closes a loop"
    );
  }
});

// The seeded 2025 result itself should be a valid derangement with the pairs.
check("seeded 2025 result is a valid derangement", function () {
  var problems = draw.validateAssignment(people, lastYear, {
    forbiddenUndirected: forbidden,
  });
  assert.strictEqual(problems.length, 0, problems.join("; "));
});

console.log(failures === 0 ? "\nAll tests passed." : "\n" + failures + " test(s) FAILED.");
process.exit(failures === 0 ? 0 : 1);
