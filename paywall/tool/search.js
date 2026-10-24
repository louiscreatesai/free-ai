// PAYWALL search: finds the row for an app you pay for, forgiving case, spaces, punctuation and small typos.
// Works in the browser (window.PaywallSearch) and in Node (module.exports).
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.PaywallSearch = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var MAX_RESULTS = 8;
  var SCORE = { exact: 100, prefix: 80, wordPrefix: 70, contains: 60, typo1: 50, typo2: 40, alt: 30, category: 20 };

  // Lowercase, drop accents and everything that is not a letter or digit ("Cap Cut!" -> "capcut").
  function compact(text) {
    return String(text == null ? '' : text)
      .normalize('NFD').replace(/[̀-ͯ]/g, '')
      .toLowerCase().replace(/\+/g, 'plus').replace(/[^a-z0-9]+/g, '');
  }

  function words(text) {
    return String(text == null ? '' : text)
      .normalize('NFD').replace(/[̀-ͯ]/g, '')
      .toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
  }

  // Damerau-Levenshtein (optimal string alignment), stops early once over the limit.
  function editDistance(a, b, limit) {
    if (a === b) return 0;
    if (Math.abs(a.length - b.length) > limit) return limit + 1;
    var prev2 = null, prev = [], cur, i, j;
    for (j = 0; j <= b.length; j++) prev.push(j);
    for (i = 1; i <= a.length; i++) {
      cur = [i];
      var rowMin = i;
      for (j = 1; j <= b.length; j++) {
        var cost = a[i - 1] === b[j - 1] ? 0 : 1;
        var v = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
        if (prev2 && i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) v = Math.min(v, prev2[j - 2] + 1);
        cur.push(v);
        if (v < rowMin) rowMin = v;
      }
      if (rowMin > limit) return limit + 1;
      prev2 = prev; prev = cur;
    }
    return prev[b.length];
  }

  // How many typos we forgive for a query of this length.
  function typoLimit(length) {
    if (length < 4) return 0;
    if (length < 8) return 1;
    return 2;
  }

  // Every name a row can be found by: each "A / B" part of the paid name, plus its aliases.
  function namesFor(row) {
    var names = String(row.paid || '').split('/').map(function (s) { return s.trim(); }).filter(Boolean);
    return names.concat(row.aliases || []);
  }

  function prepare(rows) {
    if (!Array.isArray(rows)) throw new Error('PAYWALL data must be an array of rows');
    return rows.map(function (row, index) {
      var names = namesFor(row);
      return {
        row: row,
        index: index,
        keys: names.map(compact).filter(Boolean),
        nameWords: names.reduce(function (all, n) { return all.concat(words(n)); }, []),
        altKey: compact(row.alt),
        catKey: compact(row.category)
      };
    });
  }

  function scoreEntry(entry, q, qWords) {
    var best = 0, limit = typoLimit(q.length);
    entry.keys.forEach(function (key) {
      if (key === q) best = Math.max(best, SCORE.exact);
      else if (key.indexOf(q) === 0) best = Math.max(best, SCORE.prefix);
      else if (q.length >= 3 && key.indexOf(q) > 0) best = Math.max(best, SCORE.contains);
      if (best < SCORE.typo1 && limit > 0) {
        var d = editDistance(q, key, limit);
        // also forgive a typo in just the start of a longer name ("photshop" vs "photoshopcc")
        if (d > limit && key.length > q.length) d = editDistance(q, key.slice(0, q.length), limit);
        if (d === 1) best = Math.max(best, SCORE.typo1);
        else if (d <= limit) best = Math.max(best, SCORE.typo2);
      }
    });
    if (best < SCORE.wordPrefix && qWords.length) {
      var allWordsHit = qWords.every(function (w) {
        return entry.nameWords.some(function (nw) { return nw.indexOf(w) === 0 || (w.length >= 4 && editDistance(w, nw, typoLimit(w.length)) <= typoLimit(w.length)); });
      });
      if (allWordsHit) best = Math.max(best, SCORE.wordPrefix);
    }
    if (best === 0 && q.length >= 3 && entry.altKey.indexOf(q) !== -1) best = SCORE.alt;
    if (best === 0 && q.length >= 4 && entry.catKey.indexOf(q) !== -1) best = SCORE.category;
    return best;
  }

  // Returns rows sorted best first. Empty query returns every row in list order.
  function search(prepared, query, maxResults) {
    var limit = maxResults == null ? MAX_RESULTS : maxResults;
    var q = compact(query);
    if (!q) return prepared.map(function (e) { return e.row; });
    var qWords = words(query);
    return prepared
      .map(function (e) { return { e: e, s: scoreEntry(e, q, qWords) }; })
      .filter(function (x) { return x.s > 0; })
      .sort(function (a, b) { return b.s - a.s || a.e.index - b.e.index; })
      .slice(0, limit)
      .map(function (x) { return x.e.row; });
  }

  return { compact: compact, words: words, editDistance: editDistance, typoLimit: typoLimit, prepare: prepare, search: search, MAX_RESULTS: MAX_RESULTS };
});
