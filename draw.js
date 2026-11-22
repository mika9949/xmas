/*
 * draw.js — Christmas lottery (Secret Santa) draw algorithm.
 *
 * Pure logic, no DOM. Works both in the browser (attaches to `window`) and
 * under Node (via `module.exports`) so the same code powers the site and the
 * test suite.
 *
 * A valid draw is a derangement (nobody gives to themselves) that also honours:
 *   - forbiddenUndirected: pairs that may not exchange in EITHER direction.
 *   - lastYearAssignment:  a giver may not give to the same receiver as the
 *                          single immediately-preceding year.
 */

(function (root) {
  "use strict";

  // Fisher–Yates shuffle, returns a new array.
  function shuffle(array) {
    var a = array.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = a[i];
      a[i] = a[j];
      a[j] = tmp;
    }
    return a;
  }

  // Build an undirected-forbidden lookup: forbidden[a] = Set of partners.
  function buildForbidden(forbiddenUndirected) {
    var forbidden = {};
    (forbiddenUndirected || []).forEach(function (pair) {
      var a = pair[0];
      var b = pair[1];
      (forbidden[a] = forbidden[a] || {})[b] = true;
      (forbidden[b] = forbidden[b] || {})[a] = true;
    });
    return forbidden;
  }

  /**
   * Compute a random valid assignment.
   *
   * @param {string[]} people
   * @param {Object}   options
   * @param {Array<[string,string]>} [options.forbiddenUndirected]
   * @param {Object<string,string>}  [options.lastYearAssignment]
   * @param {boolean}  [options.forbidMutual] disallow two-person loops (A->B & B->A).
   * @returns {Object<string,string>|null} giver->receiver map, or null if none exists.
   */
  function drawAssignment(people, options) {
    options = options || {};
    var forbidden = buildForbidden(options.forbiddenUndirected);
    var lastYear = options.lastYearAssignment || {};
    var forbidMutual = !!options.forbidMutual;

    function allowed(giver, receiver) {
      if (giver === receiver) return false;
      if (forbidden[giver] && forbidden[giver][receiver]) return false;
      if (lastYear[giver] === receiver) return false;
      return true;
    }

    // Randomise giver order for variety across runs.
    var givers = shuffle(people);
    var taken = {};
    var assignment = {};

    function backtrack(index) {
      if (index === givers.length) return true;
      var giver = givers[index];
      var candidates = shuffle(people);
      for (var i = 0; i < candidates.length; i++) {
        var receiver = candidates[i];
        if (taken[receiver]) continue;
        if (!allowed(giver, receiver)) continue;
        // No two-person loops: if the receiver already gives to this giver, skip.
        if (forbidMutual && assignment[receiver] === giver) continue;
        taken[receiver] = true;
        assignment[giver] = receiver;
        if (backtrack(index + 1)) return true;
        taken[receiver] = false;
        delete assignment[giver];
      }
      return false;
    }

    return backtrack(0) ? assignment : null;
  }

  /**
   * Order givers by following the gift loops: each row's receiver is the next
   * row's giver. A draw may consist of one or several loops; each loop is listed
   * in turn, and within a loop the last row gives back to that loop's first row.
   */
  function chainOrder(assignment) {
    var visited = {};
    var order = [];
    Object.keys(assignment).forEach(function (start) {
      var cur = start;
      while (cur !== undefined && !visited[cur] && assignment[cur] !== undefined) {
        visited[cur] = true;
        order.push(cur);
        cur = assignment[cur];
      }
    });
    return order;
  }

  /**
   * Validate an assignment against the rules. Returns an array of human-readable
   * problems (empty array = valid).
   */
  function validateAssignment(people, assignment, options) {
    options = options || {};
    var forbidden = buildForbidden(options.forbiddenUndirected);
    var lastYear = options.lastYearAssignment || {};
    var forbidMutual = !!options.forbidMutual;
    var problems = [];

    var receivers = {};
    people.forEach(function (giver) {
      var receiver = assignment[giver];
      if (receiver === undefined) {
        problems.push(giver + " has no receiver");
        return;
      }
      if (receiver === giver) problems.push(giver + " gives to themselves");
      if (forbidden[giver] && forbidden[giver][receiver]) {
        problems.push("forbidden pair: " + giver + " -> " + receiver);
      }
      if (lastYear[giver] === receiver) {
        problems.push("repeat of last year: " + giver + " -> " + receiver);
      }
      // Two-person loop: A gives to B and B gives to A (report once).
      if (forbidMutual && assignment[receiver] === giver && giver < receiver) {
        problems.push("two-person loop: " + giver + " <-> " + receiver);
      }
      receivers[receiver] = (receivers[receiver] || 0) + 1;
    });

    people.forEach(function (person) {
      if (receivers[person] !== 1) {
        problems.push(person + " receives " + (receivers[person] || 0) + " gift(s)");
      }
    });

    return problems;
  }

  var api = {
    drawAssignment: drawAssignment,
    chainOrder: chainOrder,
    validateAssignment: validateAssignment,
    shuffle: shuffle,
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  } else {
    root.LotteryDraw = api;
  }
})(typeof window !== "undefined" ? window : this);
