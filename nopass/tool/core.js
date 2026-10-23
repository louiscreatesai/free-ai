/* FOLLOWERS core: pure parsing and diff logic. No DOM, no network.
   Works in the browser (window.FollowersCore) and in Node (module.exports). */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.FollowersCore = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var USERNAME_RE = /^[A-Za-z0-9._]{1,30}$/;
  var PROFILE_BASE = 'https://www.instagram.com/';
  var MS_THRESHOLD = 1e12;

  // Known top-level keys in the JSON files (see sources.md for confidence levels).
  var KEY_TO_KIND = {
    relationships_following: 'following',
    relationships_follow_requests_sent: 'pending',
    relationships_unfollowed_users: 'unfollowed',
    relationships_followers: 'followers'
  };

  var KIND_LABEL = {
    followers: 'followers',
    following: 'following',
    pending: 'pending follow requests',
    unfollowed: 'recently unfollowed profiles'
  };

  var FILE_NAME_RE = /^(followers(_\d+)?|following|pending_follow_requests|recently_unfollowed_profiles)(\s*\(\d+\))?\.(json|html?)$/i;

  function FollowersError(code, message) {
    var e = new Error(message);
    e.name = 'FollowersError';
    e.code = code;
    return e;
  }

  function baseName(path) {
    return String(path || '').split(/[\\/]/).pop();
  }

  function isRelevantFileName(path) {
    return FILE_NAME_RE.test(baseName(path));
  }

  function isHtmlName(path) {
    return /\.html?$/i.test(baseName(path));
  }

  function kindFromName(path) {
    var n = baseName(path).toLowerCase();
    if (n.indexOf('pending') !== -1) return 'pending';
    if (n.indexOf('unfollow') !== -1) return 'unfollowed';
    if (n.indexOf('following') !== -1) return 'following';
    if (n.indexOf('follower') !== -1) return 'followers';
    return null;
  }

  function normalizeTimestamp(value) {
    var n = typeof value === 'string' && value.trim() !== '' ? Number(value) : value;
    if (typeof n !== 'number' || !isFinite(n) || n <= 0) return null;
    return Math.floor(n >= MS_THRESHOLD ? n / 1000 : n);
  }

  function usernameFromHref(href) {
    if (typeof href !== 'string') return null;
    var m = /^https?:\/\/(?:www\.)?instagram\.com\/(?:_u\/)?([A-Za-z0-9._]{1,30})\/?(?:[?#].*)?$/i.exec(href.trim());
    return m ? m[1] : null;
  }

  function cleanUsername(value) {
    if (typeof value !== 'string') return null;
    var v = value.trim().replace(/^@/, '');
    return USERNAME_RE.test(v) ? v : null;
  }

  function profileUrl(username) {
    return PROFILE_BASE + username + '/';
  }

  function makeEntry(username, timestamp) {
    return { username: username, href: profileUrl(username), timestamp: timestamp };
  }

  // One JSON list item -> entry or null. The export href is never trusted for the link.
  function toEntry(item) {
    if (!item || typeof item !== 'object') return null;
    var data = Array.isArray(item.string_list_data) ? item.string_list_data[0] : null;
    if (!data || typeof data !== 'object') data = {};
    var username =
      cleanUsername(data.value) ||
      cleanUsername(item.title) ||
      usernameFromHref(data.href);
    if (!username) return null;
    return makeEntry(username, normalizeTimestamp(data.timestamp));
  }

  function dedupe(entries) {
    var seen = Object.create(null);
    var out = [];
    entries.forEach(function (e) {
      var k = e.username.toLowerCase();
      if (seen[k]) return;
      seen[k] = true;
      out.push(e);
    });
    return out;
  }

  // Find the array of items and (if known) the file kind from a parsed JSON value.
  function locateList(data) {
    if (Array.isArray(data)) return { items: data, kind: null };
    if (!data || typeof data !== 'object') {
      throw FollowersError('NOT_A_LIST', 'This JSON file is not a list of accounts.');
    }
    var keys = Object.keys(data).filter(function (k) { return Array.isArray(data[k]); });
    var known = keys.filter(function (k) { return KEY_TO_KIND[k]; });
    if (known.length >= 1) return { items: data[known[0]], kind: KEY_TO_KIND[known[0]] };
    if (keys.length === 1) return { items: data[keys[0]], kind: null };
    throw FollowersError('NOT_A_LIST', 'This JSON file does not contain a list of accounts.');
  }

  // Parse JSON text. Returns { kind, entries, skipped }. kind may be null (use the file name).
  function parseJsonFile(text) {
    var data;
    try {
      data = JSON.parse(String(text).replace(/^﻿/, ''));
    } catch (err) {
      throw FollowersError('BAD_JSON', 'This file is not valid JSON. Pick the JSON export, not the HTML one.');
    }
    var located = locateList(data);
    var entries = [];
    located.items.forEach(function (item) {
      var e = toEntry(item);
      if (e) entries.push(e);
    });
    var skipped = located.items.length - entries.length;
    if (located.items.length > 0 && entries.length === 0) {
      throw FollowersError('NO_USERNAMES', 'No Instagram usernames found in this file. It is probably a different file from the export.');
    }
    return { kind: located.kind, entries: dedupe(entries), skipped: skipped };
  }

  var MONTHS = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 };
  var DATE_RE = /\b([A-Za-z]{3}) (\d{1,2}), (\d{4})(?:,? (\d{1,2}):(\d{2}) ?([AaPp][Mm]))?/;

  // Best-effort English date from the HTML export. Returns seconds (UTC) or null.
  function parseHtmlDate(text) {
    var m = DATE_RE.exec(text);
    if (!m) return null;
    var month = MONTHS[m[1].toLowerCase()];
    if (month === undefined) return null;
    var hour = m[4] ? Number(m[4]) % 12 : 0;
    if (m[6] && m[6].toLowerCase() === 'pm') hour += 12;
    var ms = Date.UTC(Number(m[3]), month, Number(m[2]), hour, m[5] ? Number(m[5]) : 0);
    return isFinite(ms) ? Math.floor(ms / 1000) : null;
  }

  function stripTags(s) {
    return s.replace(/<[^>]*>/g, ' ');
  }

  // Parse the HTML export. Looks for profile links and the date text after each.
  function parseHtmlFile(text) {
    var html = String(text);
    var anchorRe = /<a\b[^>]*?href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
    var hits = [];
    var m;
    while ((m = anchorRe.exec(html)) !== null) {
      var username = usernameFromHref(m[1].replace(/&amp;/g, '&'));
      if (username) hits.push({ username: username, end: anchorRe.lastIndex });
    }
    var entries = hits.map(function (h, i) {
      var nextStart = i + 1 < hits.length ? html.indexOf('<a', h.end) : html.length;
      var slice = html.slice(h.end, nextStart === -1 ? html.length : nextStart);
      return makeEntry(h.username, parseHtmlDate(stripTags(slice)));
    });
    if (entries.length === 0) {
      throw FollowersError('NO_USERNAMES', 'No Instagram profile links found in this HTML file.');
    }
    return { kind: null, entries: dedupe(entries), skipped: 0 };
  }

  // Turn a list of { name, text } into parts + a report. Never throws for a bad single file.
  function ingest(files) {
    var buckets = { followers: [], following: [], pending: [], unfollowed: [] };
    var found = { followers: [], following: [], pending: [], unfollowed: [] };
    var problems = [];
    var skipped = 0;

    (files || []).forEach(function (f) {
      var name = baseName(f && f.name);
      try {
        var parsed = isHtmlName(name) ? parseHtmlFile(f.text) : parseJsonFile(f.text);
        var kind = parsed.kind || kindFromName(name);
        if (!kind) kind = 'followers';
        buckets[kind] = buckets[kind].concat(parsed.entries);
        found[kind].push(name);
        skipped += parsed.skipped;
      } catch (err) {
        if (err.name !== 'FollowersError') throw err;
        problems.push({ name: name, code: err.code, message: err.message });
      }
    });

    var parts = {};
    Object.keys(buckets).forEach(function (k) {
      parts[k] = found[k].length > 0 ? dedupe(buckets[k]) : null;
    });
    return { parts: parts, found: found, problems: problems, skipped: skipped };
  }

  function monthKey(seconds) {
    var d = new Date(seconds * 1000);
    var mm = String(d.getUTCMonth() + 1).padStart(2, '0');
    return d.getUTCFullYear() + '-' + mm;
  }

  function shiftMonth(key, delta) {
    var y = Number(key.slice(0, 4));
    var m = Number(key.slice(5, 7)) - 1 + delta;
    var d = new Date(Date.UTC(y, m, 1));
    return monthKey(d.getTime() / 1000);
  }

  // New entries per month, the last `span` months ending at the latest month in the data.
  function byMonth(entries, span) {
    var n = span || 12;
    var counts = Object.create(null);
    var latest = null;
    (entries || []).forEach(function (e) {
      if (!e.timestamp) return;
      var k = monthKey(e.timestamp);
      counts[k] = (counts[k] || 0) + 1;
      if (latest === null || k > latest) latest = k;
    });
    if (latest === null) return [];
    var out = [];
    for (var i = n - 1; i >= 0; i--) {
      var k = shiftMonth(latest, -i);
      out.push({ month: k, count: counts[k] || 0 });
    }
    return out;
  }

  function newestFirst(entries) {
    return entries
      .map(function (e, i) { return { e: e, i: i }; })
      .sort(function (a, b) {
        var ta = a.e.timestamp || 0;
        var tb = b.e.timestamp || 0;
        return tb - ta || a.i - b.i;
      })
      .map(function (x) { return x.e; });
  }

  function keySet(entries) {
    var s = Object.create(null);
    entries.forEach(function (e) { s[e.username.toLowerCase()] = true; });
    return s;
  }

  function pct(part, whole) {
    return whole > 0 ? Math.round((part / whole) * 100) : 0;
  }

  // The audit. `parts` is the `parts` object from ingest().
  function buildAudit(parts) {
    var followers = parts.followers;
    var following = parts.following;
    var canCompare = !!(followers && following);
    var lists = { notFollowingBack: [], fans: [], mutuals: [], pending: [], unfollowed: [] };

    if (canCompare) {
      var theyFollow = keySet(followers);
      var iFollow = keySet(following);
      lists.notFollowingBack = newestFirst(following.filter(function (e) { return !theyFollow[e.username.toLowerCase()]; }));
      lists.fans = newestFirst(followers.filter(function (e) { return !iFollow[e.username.toLowerCase()]; }));
      lists.mutuals = newestFirst(followers.filter(function (e) { return iFollow[e.username.toLowerCase()]; }));
    }
    lists.pending = newestFirst(parts.pending || []);
    lists.unfollowed = newestFirst(parts.unfollowed || []);

    var counts = {
      followers: followers ? followers.length : null,
      following: following ? following.length : null,
      notFollowingBack: canCompare ? lists.notFollowingBack.length : null,
      fans: canCompare ? lists.fans.length : null,
      mutuals: canCompare ? lists.mutuals.length : null,
      pending: parts.pending ? lists.pending.length : null,
      unfollowed: parts.unfollowed ? lists.unfollowed.length : null
    };

    return {
      hasFollowers: !!followers,
      hasFollowing: !!following,
      canCompare: canCompare,
      counts: counts,
      lists: lists,
      notFollowingBackPct: canCompare ? pct(lists.notFollowingBack.length, following.length) : null,
      monthly: followers ? byMonth(followers, 12) : []
    };
  }

  function csvCell(value) {
    var s = value === null || value === undefined ? '' : String(value);
    if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
    return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }

  function isoDate(seconds) {
    return seconds ? new Date(seconds * 1000).toISOString().slice(0, 10) : '';
  }

  function toCsv(entries, listName) {
    var rows = [['username', 'profile_url', 'list', 'date']];
    entries.forEach(function (e) {
      rows.push([e.username, e.href, listName, isoDate(e.timestamp)]);
    });
    return rows.map(function (r) { return r.map(csvCell).join(','); }).join('\r\n') + '\r\n';
  }

  function toPlainList(entries) {
    return entries.map(function (e) { return e.username; }).join('\n');
  }

  function filterEntries(entries, query) {
    var q = String(query || '').trim().toLowerCase().replace(/^@/, '');
    if (!q) return entries;
    return entries.filter(function (e) { return e.username.toLowerCase().indexOf(q) !== -1; });
  }

  function formatNumber(n) {
    return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }

  // Text for the share card. Contains no handles of other people.
  function cardText(audit) {
    var c = audit.counts;
    if (!audit.canCompare) return null;
    var n = c.notFollowingBack;
    var headline;
    if (n === 0) headline = 'Everyone I follow follows me back';
    else if (n === 1) headline = 'person doesn’t follow me back';
    else headline = 'people don’t follow me back';
    return {
      number: formatNumber(n),
      headline: headline,
      isAll: n === 0,
      sub: 'of the ' + formatNumber(c.following) + ' accounts I follow (' + audit.notFollowingBackPct + '%)',
      stats: [
        { label: 'followers', value: formatNumber(c.followers) },
        { label: 'following', value: formatNumber(c.following) },
        { label: 'mutuals', value: formatNumber(c.mutuals) }
      ]
    };
  }

  function relativeLabel(seconds) {
    if (!seconds) return '';
    var d = new Date(seconds * 1000);
    var names = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return names[d.getUTCMonth()] + ' ' + d.getUTCFullYear();
  }

  return {
    FollowersError: FollowersError,
    KIND_LABEL: KIND_LABEL,
    baseName: baseName,
    isRelevantFileName: isRelevantFileName,
    isHtmlName: isHtmlName,
    kindFromName: kindFromName,
    normalizeTimestamp: normalizeTimestamp,
    usernameFromHref: usernameFromHref,
    parseJsonFile: parseJsonFile,
    parseHtmlFile: parseHtmlFile,
    parseHtmlDate: parseHtmlDate,
    ingest: ingest,
    byMonth: byMonth,
    buildAudit: buildAudit,
    toCsv: toCsv,
    toPlainList: toPlainList,
    filterEntries: filterEntries,
    formatNumber: formatNumber,
    cardText: cardText,
    relativeLabel: relativeLabel
  };
});
