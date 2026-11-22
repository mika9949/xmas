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

// The seeded 2025 result itself should be a valid derangement with the pairs.
check("seeded 2025 result is a valid derangement", function () {
  var problems = draw.validateAssignment(people, lastYear, {
    forbiddenUndirected: forbidden,
  });
  assert.strictEqual(problems.length, 0, problems.join("; "));
});

console.log(failures === 0 ? "\nAll tests passed." : "\n" + failures + " test(s) FAILED.");
process.exit(failures === 0 ? 0 : 1);
