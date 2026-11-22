/*
 * app.js — UI wiring for the Christmas lottery site.
 *
 * Loads config + results, handles tab switching, the example demo, the official
 * draw flow, and the previous-years viewer. All draw logic lives in draw.js.
 */

(function () {
  "use strict";

  var state = {
    config: null, // { participants, forbiddenPairs, duckCharacters }
    results: {}, // { "2025": { giver: receiver, ... }, ... }
    officialYear: null,
    officialAssignment: null,
  };

  // --- helpers -------------------------------------------------------------

  function $(id) {
    return document.getElementById(id);
  }

  function renderAssignment(listEl, assignment) {
    listEl.innerHTML = "";
    Object.keys(assignment).forEach(function (giver) {
      var li = document.createElement("li");
      var g = document.createElement("span");
      g.className = "giver";
      g.textContent = giver;
      var r = document.createElement("span");
      r.className = "receiver";
      r.textContent = assignment[giver];
      li.appendChild(g);
      li.appendChild(document.createTextNode(" gives to "));
      li.appendChild(r);
      listEl.appendChild(li);
    });
  }

  function years() {
    return Object.keys(state.results)
      .map(Number)
      .sort(function (a, b) {
        return a - b;
      });
  }

  function nextOfficialYear() {
    var ys = years();
    return ys.length ? ys[ys.length - 1] + 1 : new Date().getFullYear();
  }

  function previousYearAssignment(year) {
    return state.results[String(year - 1)] || {};
  }

  // --- tabs ----------------------------------------------------------------

  function initTabs() {
    var tabs = document.querySelectorAll(".tab");
    tabs.forEach(function (tab) {
      tab.addEventListener("click", function () {
        tabs.forEach(function (t) {
          t.classList.remove("active");
        });
        document.querySelectorAll(".panel").forEach(function (p) {
          p.classList.remove("active");
        });
        tab.classList.add("active");
        $("tab-" + tab.dataset.tab).classList.add("active");
      });
    });
  }

  // --- example tab ---------------------------------------------------------

  function initExample() {
    $("example-generate").addEventListener("click", function () {
      var ducks = state.config.duckCharacters;
      // Plain demo: a random derangement, no history or forbidden pairs.
      var assignment = window.LotteryDraw.drawAssignment(ducks, {});
      if (assignment) {
        renderAssignment($("example-result"), assignment);
      } else {
        $("example-result").innerHTML = "<li>Could not generate an example.</li>";
      }
    });
  }

  // --- official draw tab ---------------------------------------------------

  function initOfficial() {
    state.officialYear = nextOfficialYear();

    // Fill in every year placeholder and header.
    $("official-year").textContent = state.officialYear;
    document.querySelectorAll(".year-ref").forEach(function (el) {
      el.textContent = state.officialYear;
    });

    if (state.results[String(state.officialYear)]) {
      $("official-already").hidden = false;
    }

    var box = $("official-confirm-box");
    var drawBtn = $("official-draw");

    // The draw for a given year may not be run before October 1 of that year.
    var earliest = new Date(state.officialYear, 9, 1); // month 9 = October
    var tooEarly = new Date() < earliest;
    if (tooEarly) {
      $("official-tooearly").hidden = false;
      box.disabled = true;
    }

    box.addEventListener("change", function () {
      drawBtn.disabled = !box.checked;
    });

    drawBtn.addEventListener("click", function () {
      if (tooEarly || !box.checked) return;
      if (!window.confirm("Are you sure?")) return;

      var assignment = window.LotteryDraw.drawAssignment(
        state.config.participants,
        {
          forbiddenUndirected: state.config.forbiddenPairs,
          lastYearAssignment: previousYearAssignment(state.officialYear),
        }
      );

      if (!assignment) {
        window.alert(
          "Could not find a valid draw that satisfies all the rules. " +
            "Please check the forbidden pairs and last year's result."
        );
        return;
      }

      state.officialAssignment = assignment;
      renderAssignment($("official-result"), assignment);
      $("official-output").hidden = false;
    });

    $("official-download").addEventListener("click", function () {
      if (!state.officialAssignment) return;
      var merged = {};
      years().forEach(function (y) {
        merged[String(y)] = state.results[String(y)];
      });
      merged[String(state.officialYear)] = state.officialAssignment;

      var blob = new Blob([JSON.stringify(merged, null, 2) + "\n"], {
        type: "application/json",
      });
      var url = URL.createObjectURL(blob);
      var a = document.createElement("a");
      a.href = url;
      a.download = "results.json";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    });
  }

  // --- previous years tab --------------------------------------------------

  function initPrevious() {
    var select = $("previous-year");
    var resultList = $("previous-result");

    function render() {
      var assignment = state.results[select.value];
      if (assignment) {
        renderAssignment(resultList, assignment);
      } else {
        resultList.innerHTML = "";
      }
    }

    var ys = years();
    select.innerHTML = "";
    ys.slice()
      .reverse()
      .forEach(function (y) {
        var opt = document.createElement("option");
        opt.value = String(y);
        opt.textContent = String(y);
        select.appendChild(opt);
      });

    select.addEventListener("change", render);
    render();
  }

  // --- bootstrap -----------------------------------------------------------

  function loadJSON(path) {
    return fetch(path).then(function (r) {
      if (!r.ok) throw new Error("Failed to load " + path);
      return r.json();
    });
  }

  function init() {
    initTabs();
    Promise.all([loadJSON("data/config.json"), loadJSON("data/results.json")])
      .then(function (res) {
        state.config = res[0];
        state.results = res[1] || {};
        initExample();
        initOfficial();
        initPrevious();
      })
      .catch(function (err) {
        document.querySelector("main").innerHTML =
          '<section class="panel active"><h2>Could not load data</h2><p>' +
          err.message +
          " — if you are viewing this as a local file, serve it with a web " +
          "server (e.g. <code>python3 -m http.server</code>).</p></section>";
      });
  }

  document.addEventListener("DOMContentLoaded", init);
})();
