/* ==========================================================================
   Static Bloom — app.js
   A single IIFE. No imports/exports, no modules, no dependencies.
   Data lives in data/artworks.json and data/facts.json (relative paths so
   the site works at https://user.github.io/repo/ and on a custom domain).
   ========================================================================== */
(function () {
  "use strict";

  /* ---------------- Config & DOM references ---------------- */

  var KNOWN_TYPES = ["music", "cover", "mixed"]; // also valid filter keys ("all" added below)
  var FILTER_KEYS = ["all"].concat(KNOWN_TYPES);
  var LS_ARTWORK = "artmusic:lastArtworkId";
  var LS_SCROLL = "artmusic:lastScrollY";
  var LS_FILTER = "artmusic:lastFilter";

  var grid = document.getElementById("gallery-grid");
  var galleryStatus = document.getElementById("gallery-status");
  var factList = document.getElementById("fact-list");
  var factsStatus = document.getElementById("facts-status");
  var dialog = document.getElementById("artwork-dialog");
  var dialogTitle = document.getElementById("dialog-title");
  var dialogBody = document.getElementById("dialog-body");
  var dialogCloseBtn = document.getElementById("dialog-close");
  var filterButtons = Array.prototype.slice.call(
    document.querySelectorAll(".filter-btn")
  );
  var resumeSection = document.getElementById("resume");
  var resumeArtworkBtn = document.getElementById("resume-artwork-btn");
  var resumeScrollBtn = document.getElementById("resume-scroll-btn");
  var galleryHeading = document.getElementById("gallery-heading");

  var artworks = [];
  var activeFilter = "all";
  var lastOpener = null; // element that opened the dialog (card or fact button)
  var warnedBadTypes = {}; // show each unrecognized-type warning once per page load

  /* ---------------- Small helpers ---------------- */

  function isSafeHttpsUrl(url) {
    return typeof url === "string" && url.indexOf("https://") === 0;
  }

  // XML-escape text before embedding it inside an SVG string.
  function xmlEscape(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&apos;");
  }

  // Inline SVG data-URI placeholder showing the artwork title, used when a
  // cover image fails to load. The whole SVG string is encodeURIComponent'd
  // so titles with &, <, >, ", ' (or non-ASCII) produce a valid URI.
  function titlePlaceholderDataUri(title) {
    var label = xmlEscape(String(title || "Untitled"));
    var svg =
      '<svg xmlns="http://www.w3.org/2000/svg" width="600" height="600" ' +
      'viewBox="0 0 600 600" role="img">' +
      '<rect width="600" height="600" fill="#f0ece4"/>' +
      '<rect x="12" y="12" width="576" height="576" fill="none" stroke="#a33608" stroke-width="4"/>' +
      '<text x="300" y="300" text-anchor="middle" dominant-baseline="middle" ' +
      'font-family="sans-serif" font-size="34" fill="#1c1b22">' + label + "</text>" +
      "</svg>";
    return "data:image/svg+xml," + encodeURIComponent(svg);
  }

  // Attach an img to the DOM AFTER setting onerror (per spec), clearing the
  // handler first inside the callback to avoid an infinite loop.
  function makeImage(src, alt, className) {
    var img = document.createElement("img");
    if (className) img.className = className;
    img.alt = alt;
    img.loading = "lazy";
    img.decoding = "async";
    img.onerror = function () {
      img.onerror = null; // prevent loop if the fallback also fails
      img.src = titlePlaceholderDataUri(alt);
    };
    img.src = src;
    return img;
  }

  function makeExternalLink(text, url) {
    var a = document.createElement("a");
    a.href = url;
    a.textContent = text;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    return a;
  }

  /* ---------------- localStorage (all access try/catch, fail silently) ---- */

  function lsGet(key) {
    try {
      return window.localStorage.getItem(key);
    } catch (e) {
      return null;
    }
  }

  function lsSet(key, value) {
    try {
      window.localStorage.setItem(key, value);
    } catch (e) {
      /* private mode / quota — ignore */
    }
  }

  function getValidStoredArtworkId() {
    var id = lsGet(LS_ARTWORK);
    if (!id) return null;
    for (var i = 0; i < artworks.length; i++) {
      if (artworks[i].id === id) return id;
    }
    return null;
  }

  function getValidStoredScrollY() {
    var raw = lsGet(LS_SCROLL);
    if (raw === null) return null;
    var n = Number(raw);
    if (Number.isFinite(n) && n >= 0 && n > 0) return n;
    return null;
  }

  function getValidStoredFilter() {
    var f = lsGet(LS_FILTER);
    return FILTER_KEYS.indexOf(f) !== -1 ? f : null;
  }

  /* ---------------- Fetching ---------------- */

  function fetchJson(path) {
    return fetch(path).then(function (res) {
      if (!res.ok) throw new Error("HTTP " + res.status + " for " + path);
      return res.json();
    });
  }

  /* ---------------- Gallery ---------------- */

  function setGalleryMessage(msg) {
    galleryStatus.textContent = msg;
  }

  function buildCard(artwork) {
    var card = document.createElement("button");
    card.type = "button";
    card.className = "card";
    card.setAttribute("aria-label", "Open details for " + artwork.title);
    card.dataset.id = artwork.id;

    card.appendChild(
      makeImage(artwork.coverImage || titlePlaceholderDataUri(artwork.title), artwork.title)
    );

    var body = document.createElement("div");
    body.className = "card-body";

    var h3 = document.createElement("h3");
    h3.className = "card-title";
    h3.textContent = artwork.title;
    body.appendChild(h3);

    var meta = document.createElement("p");
    meta.className = "card-meta";
    meta.textContent = artwork.artist + " · " + artwork.year;
    body.appendChild(meta);

    var badge = document.createElement("span");
    badge.className = "badge";
    badge.textContent = KNOWN_TYPES.indexOf(artwork.type) !== -1
      ? artwork.type
      : "other";
    body.appendChild(badge);

    card.appendChild(body);

    card.addEventListener("click", function () {
      // Persist the last-opened artwork ONLY on genuine card activation,
      // never when the modal is opened from a fact's "View artwork" button.
      lsSet(LS_ARTWORK, artwork.id);
      openDialog(artwork, card);
    });

    return card;
  }

  function renderGallery() {
    var visible = artworks.filter(function (a) {
      if (activeFilter === "all") return true;
      // Unknown types are excluded from the three type filters but kept in All.
      return a.type === activeFilter && KNOWN_TYPES.indexOf(a.type) !== -1;
    });

    grid.textContent = ""; // clear previous cards safely

    if (artworks.length === 0) {
      setGalleryMessage(""); // empty source array uses the grid message below
      var empty = document.createElement("p");
      empty.textContent = "No artworks yet.";
      grid.appendChild(empty);
      return Promise.resolve();
    }

    if (visible.length === 0) {
      setGalleryMessage("No artworks match this filter.");
      return Promise.resolve();
    }

    // Active-filter warnings (unrecognized types) are emitted once per load.
    if (activeFilter === "all") {
      var messages = [];
      artworks.forEach(function (a) {
        if (KNOWN_TYPES.indexOf(a.type) === -1) {
          if (!warnedBadTypes[a.id]) {
            warnedBadTypes[a.id] = true;
          }
          messages.push(
            'Artwork "' + a.title +
            '" has an unrecognized type and is shown under All only.'
          );
        }
      });
      setGalleryMessage(messages.join(" "));
    } else {
      setGalleryMessage("");
    }

    visible.forEach(function (a) {
      grid.appendChild(buildCard(a));
    });

    return Promise.resolve();
  }

  function announceBadTypesOnce() {
    // Guarantee the unrecognized-type notice appears once per page load even
    // if the initial persisted filter is not "all".
    var pending = artworks.filter(function (a) {
      return KNOWN_TYPES.indexOf(a.type) === -1 && !warnedBadTypes[a.id];
    });
    if (pending.length === 0) return;
    var extra = pending.map(function (a) {
      warnedBadTypes[a.id] = true;
      return 'Artwork "' + a.title +
        '" has an unrecognized type and is shown under All only.';
    });
    var current = galleryStatus.textContent;
    galleryStatus.textContent = current
      ? current + " " + extra.join(" ")
      : extra.join(" ");
  }

  /* ---------------- Filters ---------------- */

  function applyFilterUiState() {
    filterButtons.forEach(function (btn) {
      btn.setAttribute(
        "aria-pressed",
        btn.dataset.filter === activeFilter ? "true" : "false"
      );
    });
  }

  function setActiveFilter(filterKey) {
    if (FILTER_KEYS.indexOf(filterKey) === -1) return;
    activeFilter = filterKey;
    lsSet(LS_FILTER, filterKey);
    applyFilterUiState();
    renderGallery();
  }

  filterButtons.forEach(function (btn) {
    btn.addEventListener("click", function () {
      setActiveFilter(btn.dataset.filter);
    });
  });

  /* ---------------- Facts feed ---------------- */

  function findArtwork(id) {
    for (var i = 0; i < artworks.length; i++) {
      if (artworks[i].id === id) return artworks[i];
    }
    return null;
  }

  function renderFacts(facts) {
    factList.textContent = "";

    if (!Array.isArray(facts) || facts.length === 0) {
      factsStatus.textContent = "No facts yet.";
      return Promise.resolve();
    }

    facts.forEach(function (fact) {
      var li = document.createElement("li");
      li.className = "fact-card";

      var h3 = document.createElement("h3");
      h3.textContent = fact.title;
      li.appendChild(h3);

      var p = document.createElement("p");
      p.textContent = fact.body;
      li.appendChild(p);

      var actions = document.createElement("div");
      actions.className = "fact-actions";
      var hasAction = false;

      // "View artwork" only when relatedArtworkId resolves; otherwise omit silently.
      if (fact.relatedArtworkId) {
        var art = findArtwork(fact.relatedArtworkId);
        if (art) {
          var btn = document.createElement("button");
          btn.type = "button";
          btn.className = "view-artwork-btn";
          btn.textContent = "View artwork";
          btn.setAttribute("aria-label", "Open details for " + art.title);
          btn.addEventListener("click", function () {
            // Deliberately NOT storing lastArtworkId here: this is navigation
            // from a fact, not a gallery card click.
            openDialog(art, btn);
          });
          actions.appendChild(btn);
          hasAction = true;
        }
      }

      if (fact.link && isSafeHttpsUrl(fact.link.url) && fact.link.text) {
        actions.appendChild(makeExternalLink(fact.link.text, fact.link.url));
        hasAction = true;
      }

      if (hasAction) li.appendChild(actions);
      factList.appendChild(li);
    });

    return Promise.resolve();
  }

  /* ---------------- Modal ---------------- */

  function populateDialog(artwork) {
    dialogTitle.textContent = artwork.title;
    dialogBody.textContent = "";

    dialogBody.appendChild(
      makeImage(
        artwork.coverImage || titlePlaceholderDataUri(artwork.title),
        artwork.title + " — cover art"
      )
    );

    var dl = document.createElement("dl");
    [
      ["Artist", artwork.artist],
      ["Year", String(artwork.year)],
      ["Type", KNOWN_TYPES.indexOf(artwork.type) !== -1 ? artwork.type : "other"],
      ["Description", artwork.description]
    ].forEach(function (pair) {
      var dt = document.createElement("dt");
      dt.textContent = pair[0];
      var dd = document.createElement("dd");
      dd.textContent = pair[1];
      dl.appendChild(dt);
      dl.appendChild(dd);
    });
    dialogBody.appendChild(dl);

    if (Array.isArray(artwork.facts) && artwork.facts.length > 0) {
      var ul = document.createElement("ul");
      artwork.facts.forEach(function (f) {
        var li = document.createElement("li");
        li.textContent = f;
        ul.appendChild(li);
      });
      dialogBody.appendChild(ul);
    }

    if (Array.isArray(artwork.tags) && artwork.tags.length > 0) {
      var tags = document.createElement("p");
      tags.className = "card-meta";
      tags.textContent = "Tags: " + artwork.tags.join(", ");
      dialogBody.appendChild(tags);
    }

    var links = [];
    if (artwork.links) {
      if (isSafeHttpsUrl(artwork.links.telegram)) {
        links.push(["Telegram", artwork.links.telegram]);
      }
      if (isSafeHttpsUrl(artwork.links.soundcloud)) {
        links.push(["SoundCloud", artwork.links.soundcloud]);
      }
    }
    if (links.length > 0) {
      var ul2 = document.createElement("ul");
      ul2.className = "dialog-links";
      links.forEach(function (pair) {
        var li2 = document.createElement("li");
        li2.appendChild(makeExternalLink("Listen / follow on " + pair[0], pair[1]));
        ul2.appendChild(li2);
      });
      dialogBody.appendChild(ul2);
    }
  }

  function openDialog(artwork, opener) {
    lastOpener = opener || null;
    populateDialog(artwork);
    dialog.showModal();
  }

  function closeDialog() {
    if (dialog.open) dialog.close();
  }

  // Focus restoration per spec: original opener if still connected and
  // focusable; otherwise the active filter button; otherwise the gallery
  // heading (tabindex="-1"). Never focus a detached node and stop there.
  function restoreFocus() {
    if (
      lastOpener &&
      lastOpener.isConnected &&
      typeof lastOpener.focus === "function"
    ) {
      lastOpener.focus();
      return;
    }
    lastOpener = null;

    var pressed = null;
    filterButtons.forEach(function (btn) {
      if (btn.getAttribute("aria-pressed") === "true") pressed = btn;
    });
    if (pressed) {
      pressed.focus();
      return;
    }
    if (galleryHeading) galleryHeading.focus();
  }

  dialog.addEventListener("close", restoreFocus);

  // Backdrop click: because <dialog> itself has padding:0/background:transparent/
  // border:0, any event whose target IS the dialog was a click on the backdrop.
  dialog.addEventListener("click", function (event) {
    if (event.target === dialog) closeDialog();
  });

  dialogCloseBtn.addEventListener("click", closeDialog);
  // Escape closing + native top-layer behaviour come free with <dialog>.

  /* ---------------- Scroll persistence ---------------- */

  function saveScroll() {
    lsSet(LS_SCROLL, String(Math.round(window.scrollY || 0)));
  }

  var scrollTimer = null;
  window.addEventListener("scroll", function () {
    if (scrollTimer) return; // ~150ms throttle
    scrollTimer = setTimeout(function () {
      scrollTimer = null;
      saveScroll();
    }, 150);
  }, { passive: true });

  window.addEventListener("pagehide", saveScroll);
  document.addEventListener("visibilitychange", function () {
    if (document.visibilityState === "hidden") saveScroll();
  });

  /* ---------------- Resume section ---------------- */

  var galleryReady = null; // Promise resolving after first gallery render
  var factsReady = null; // Promise resolving after facts render

  function updateResumeSection(artworksLoaded) {
    var showArtwork = false;
    var storedArtworkId = artworksLoaded ? getValidStoredArtworkId() : null;

    if (storedArtworkId) {
      var art = findArtwork(storedArtworkId);
      resumeArtworkBtn.textContent = "Continue from " + art.title;
      showArtwork = true;
    }

    var storedScrollY = getValidStoredScrollY();
    var showScroll = storedScrollY !== null;
    resumeScrollBtn.hidden = !showScroll;

    resumeArtworkBtn.hidden = !showArtwork;
    resumeSection.hidden = !(showArtwork || showScroll);
  }

  resumeArtworkBtn.addEventListener("click", function () {
    var id = getValidStoredArtworkId();
    if (!id) return;
    var art = findArtwork(id);
    if (!art) return;
    // Opening from the resume button is not a card activation: do not rewrite
    // lastArtworkId, and do not auto-scroll.
    openDialog(art, resumeArtworkBtn);
  });

  resumeScrollBtn.addEventListener("click", function () {
    var y = getValidStoredScrollY();
    if (y === null) return;
    // Restore scroll ONLY on click and ONLY after both render promises settle.
    Promise.all([
      galleryReady || Promise.resolve(),
      factsReady || Promise.resolve()
    ]).then(function () {
      window.scrollTo(0, y);
    });
  });

  /* ---------------- Boot ---------------- */

  function init() {
    // Read + validate the persisted filter BEFORE the first render so the
    // gallery renders exactly once with the restored filter already active.
    var storedFilter = getValidStoredFilter();
    if (storedFilter) activeFilter = storedFilter;
    applyFilterUiState();

    galleryReady = fetchJson("data/artworks.json")
      .then(function (data) {
        artworks = Array.isArray(data) ? data : [];
        return renderGallery().then(function () {
          return true; // artworks loaded OK
        });
      })
      .catch(function () {
        artworks = [];
        setGalleryMessage(
          "Sorry — we couldn't load the gallery right now. Please check your " +
          "connection and reload. Navigation and links below still work."
        );
        return false; // fetch failed
      });

    factsReady = fetchJson("data/facts.json")
      .then(function (data) {
        return renderFacts(Array.isArray(data) ? data : []);
      })
      .catch(function () {
        factsStatus.textContent =
          "Sorry — we couldn't load the facts right now. Reload to try again.";
      });

    // Resume section is gated on the artworks fetch settling (the "Continue
    // from {title}" button needs real artwork data to validate against).
    galleryReady.then(function (loaded) {
      updateResumeSection(loaded);
      if (loaded) announceBadTypesOnce();
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
