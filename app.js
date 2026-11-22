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
    window.LotteryDraw.chainOrder(assignment).forEach(function (giver) {
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

  // All recorded results plus the freshly drawn official year, as a plain object.
  function mergedResults() {
    var merged = {};
    years().forEach(function (y) {
      merged[String(y)] = state.results[String(y)];
    });
    merged[String(state.officialYear)] = state.officialAssignment;
    return merged;
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
      // Demo: a random derangement, no two-person loops, plus the duck forbidden pairs.
      var assignment = window.LotteryDraw.drawAssignment(ducks, {
        forbiddenUndirected: state.config.duckForbiddenPairs || [],
        forbidMutual: true,
      });
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

    // List the forbidden pairs straight from the config so it stays accurate.
    $("rules-forbidden").textContent = state.config.forbiddenPairs
      .map(function (pair) {
        return pair[0] + " & " + pair[1];
      })
      .join(", ");

    if (state.results[String(state.officialYear)]) {
      $("official-already").hidden = false;
    }

    // Show the most recent published result at the top, until a new draw is run.
    var recorded = years();
    if (recorded.length) {
      var latest = recorded[recorded.length - 1];
      $("official-latest-year").textContent = latest;
      renderAssignment($("official-latest-list"), state.results[String(latest)]);
      $("official-latest").hidden = false;
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

      var name = $("official-name").value.trim();
      if (!name) {
        window.alert("Please type your name before running the official draw.");
        return;
      }
      if ($("official-password").value !== "pepper") {
        window.alert("Wrong password.");
        return;
      }

      if (!window.confirm("Are you sure?")) return;

      var assignment = window.LotteryDraw.drawAssignment(
        state.config.participants,
        {
          forbiddenUndirected: state.config.forbiddenPairs,
          lastYearAssignment: previousYearAssignment(state.officialYear),
          forbidMutual: true,
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
      state.officialName = name;
      $("official-instigator").textContent = "🎅 Official draw run by " + name;
      renderAssignment($("official-result"), assignment);
      $("official-output").hidden = false;
      // A fresh draw replaces the previously-published result at the top.
      $("official-latest").hidden = true;
    });

    $("official-download").addEventListener("click", function () {
      if (!state.officialAssignment) return;
      var blob = new Blob([JSON.stringify(mergedResults(), null, 2) + "\n"], {
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

    $("official-publish").addEventListener("click", function () {
      publishToRepo();
    });
  }

  // --- one-click publish via the GitHub API --------------------------------

  function setPublishStatus(message, kind) {
    var el = $("official-publish-status");
    el.hidden = false;
    el.textContent = message;
    el.className = "publish-status" + (kind ? " " + kind : "");
  }

  // Base64-encode a UTF-8 string (GitHub wants base64 file content).
  function toBase64(str) {
    return btoa(unescape(encodeURIComponent(str)));
  }

  function publishToRepo() {
    if (!state.officialAssignment) return;
    var repo = state.config.repo;
    if (!repo) {
      setPublishStatus("No repository is configured for publishing.", "error");
      return;
    }
    var token = $("official-token").value.trim();
    if (!token) {
      setPublishStatus("Please paste a GitHub token first.", "error");
      return;
    }

    var apiBase =
      "https://api.github.com/repos/" + repo.owner + "/" + repo.name;
    var contentsUrl =
      apiBase + "/contents/" + repo.path + "?ref=" + repo.branch;
    var headers = {
      Authorization: "Bearer " + token,
      Accept: "application/vnd.github+json",
    };

    setPublishStatus("Publishing…", null);
    $("official-publish").disabled = true;

    // Fetch the current file's SHA (required to update it), then PUT the update.
    fetch(contentsUrl, { headers: headers })
      .then(function (r) {
        if (r.status === 404) return { sha: undefined };
        if (!r.ok) throw new Error("GitHub said " + r.status + " reading the file");
        return r.json();
      })
      .then(function (meta) {
        var body = {
          message:
            "Add " +
            state.officialYear +
            " lottery result (run by " +
            (state.officialName || "unknown") +
            ")",
          content: toBase64(JSON.stringify(mergedResults(), null, 2) + "\n"),
          branch: repo.branch,
        };
        if (meta.sha) body.sha = meta.sha;

        return fetch(apiBase + "/contents/" + repo.path, {
          method: "PUT",
          headers: headers,
          body: JSON.stringify(body),
        });
      })
      .then(function (r) {
        return r.json().then(function (data) {
          return { ok: r.ok, status: r.status, data: data };
        });
      })
      .then(function (res) {
        if (!res.ok) {
          throw new Error(
            (res.data && res.data.message) || "GitHub said " + res.status
          );
        }
        // Reflect it locally so Previous years shows it right away.
        state.results[String(state.officialYear)] = state.officialAssignment;
        if (state.refreshPrevious) state.refreshPrevious();
        setPublishStatus(
          "✅ Published! Everyone will see the " +
            state.officialYear +
            " result within a minute (it's already in Previous years here).",
          "success"
        );
      })
      .catch(function (err) {
        $("official-publish").disabled = false;
        setPublishStatus("❌ Could not publish: " + err.message, "error");
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

    function populate() {
      var current = select.value;
      select.innerHTML = "";
      years()
        .reverse()
        .forEach(function (y) {
          var opt = document.createElement("option");
          opt.value = String(y);
          opt.textContent = String(y);
          select.appendChild(opt);
        });
      if (current) select.value = current;
      render();
    }

    select.addEventListener("change", render);
    populate();

    // Let the publish flow refresh the list when a new year is added.
    state.refreshPrevious = populate;
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
