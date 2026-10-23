/* FOLLOWERS demo data. Synthetic, deterministic, obviously fake handles (demo_*).
   Never contains a real person. Same numbers on every run. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.FollowersDemo = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var ADJ = ['sleepy', 'fuzzy', 'sunny', 'rusty', 'jolly', 'misty', 'quiet', 'lucky', 'bouncy', 'cosmic',
    'dusty', 'frosty', 'gentle', 'hasty', 'icy', 'jazzy', 'kind', 'lazy', 'mellow', 'nimble',
    'odd', 'plucky', 'quirky', 'rapid', 'shiny', 'tiny', 'ultra', 'vivid', 'wobbly', 'zesty',
    'brave', 'crisp', 'dizzy', 'eager', 'fancy', 'grumpy', 'humble', 'inky', 'jumpy', 'keen'];
  var NOUN = ['otter', 'panda', 'falcon', 'walrus', 'llama', 'gecko', 'badger', 'heron', 'koala', 'lemur',
    'moose', 'newt', 'ocelot', 'puffin', 'quokka', 'raven', 'sloth', 'tapir', 'urchin', 'vole',
    'wombat', 'yak', 'zebra', 'beetle', 'cricket', 'dingo', 'ferret', 'goose', 'hippo', 'ibis',
    'jackal', 'kiwi', 'lynx', 'mole', 'narwhal', 'owl', 'pika', 'robin', 'stoat', 'toad'];
  var POOL = ADJ.length * NOUN.length;
  var FOLLOWER_STRIDE = 37; // coprime with 1180
  var STRIDE = 233; // coprime with 1600, so every index maps to a unique handle

  var COUNTS = { mutuals: 588, notFollowingBack: 312, fans: 592, pending: 7, unfollowed: 5 };
  // New followers per month, Oct 2025 .. Sep 2026 (12 values). Older followers fill the 12 months before.
  var RECENT_MONTHS = [38, 52, 41, 67, 96, 58, 74, 131, 189, 92, 63, 47];
  var LAST_MONTH = { year: 2026, month: 8 }; // September 2026 (0-based month)
  var DAY_SECONDS = 86400;

  function handleAt(i) {
    var p = (i * STRIDE) % POOL;
    return 'demo_' + ADJ[p % ADJ.length] + '_' + NOUN[Math.floor(p / ADJ.length)];
  }

  function entry(i, ts) {
    var u = handleAt(i);
    return { username: u, href: 'https://www.instagram.com/' + u + '/', timestamp: ts };
  }

  function monthStart(offsetFromLast) {
    return Date.UTC(LAST_MONTH.year, LAST_MONTH.month - offsetFromLast, 1) / 1000;
  }

  // Timestamp inside a month, spread by index.
  function stamp(offsetFromLast, k) {
    return monthStart(offsetFromLast) + ((k * 5) % 27) * DAY_SECONDS + ((k * 3607) % 80000);
  }

  function followerStamps(total) {
    var stamps = [];
    RECENT_MONTHS.forEach(function (count, idx) {
      for (var k = 0; k < count; k++) stamps.push(stamp(11 - idx, k));
    });
    var older = total - stamps.length;
    for (var j = 0; j < older; j++) stamps.push(stamp(12 + (j % 12), j));
    return stamps;
  }

  function build() {
    var total = COUNTS.mutuals + COUNTS.fans;
    var stamps = followerStamps(total);
    var idx = 0;
    var next = function () { return idx++; };

    var mutualIdx = [], fanIdx = [], nfbIdx = [], pendingIdx = [], unfIdx = [];
    var i;
    for (i = 0; i < COUNTS.mutuals; i++) mutualIdx.push(next());
    for (i = 0; i < COUNTS.fans; i++) fanIdx.push(next());
    for (i = 0; i < COUNTS.notFollowingBack; i++) nfbIdx.push(next());
    for (i = 0; i < COUNTS.pending; i++) pendingIdx.push(next());
    for (i = 0; i < COUNTS.unfollowed; i++) unfIdx.push(next());

    // Mix follow dates across both groups: position k takes stamp (k * 37) mod total (a bijection).
    var followers = mutualIdx.concat(fanIdx).map(function (n, k) {
      return entry(n, stamps[(k * FOLLOWER_STRIDE) % total]);
    });

    var following = mutualIdx.concat(nfbIdx).map(function (n, k) { return entry(n, stamp(k % 30, k)); });
    var pending = pendingIdx.map(function (n, k) { return entry(n, stamp(k % 3, k)); });
    var unfollowed = unfIdx.map(function (n, k) { return entry(n, stamp(k % 4, k + 7)); });

    return { followers: followers, following: following, pending: pending, unfollowed: unfollowed };
  }

  return { build: build, handleAt: handleAt, COUNTS: COUNTS, POOL: POOL };
});
