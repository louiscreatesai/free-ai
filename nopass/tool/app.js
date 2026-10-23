/* FOLLOWERS UI glue. Everything runs locally. No network calls, no storage. */
(function () {
  'use strict';
  var Core = window.FollowersCore;
  var Zip = window.FollowersZip;
  var Demo = window.FollowersDemo;

  var PAGE_SIZE = 30;
  var COUNT_UP_MS = 1100;
  var TAB_COPY = {
    notFollowingBack: { csv: 'not_following_back', empty: 'Nobody. Everyone you follow follows you back.', help: 'You follow them. They do not follow you.', date: 'You followed' },
    fans: { csv: 'fans', empty: 'No fans without a follow back.', help: 'They follow you. You do not follow them.', date: 'Followed you' },
    mutuals: { csv: 'mutuals', empty: 'No mutuals found.', help: 'You follow each other.', date: 'Followed you' }
  };
  var state = { audit: null, tab: 'notFollowingBack', query: '', shown: PAGE_SIZE, isDemo: false, cardBlob: null, cardUrl: null };

  function $(id) { return document.getElementById(id); }
  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined) n.textContent = text;
    return n;
  }
  function fmt(n) { return Core.formatNumber(n); }

  var toastTimer = null;
  function toast(msg) {
    var t = $('toast');
    t.textContent = msg;
    t.classList.add('on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.classList.remove('on'); }, 1800);
  }

  /* ---------- reading files ---------- */
  async function readOne(file) {
    var head = new Uint8Array(await file.slice(0, 4).arrayBuffer());
    if (Zip.looksLikeZip(head)) {
      var res = await Zip.readTexts(Zip.readerFromBlob(file), Core.isRelevantFileName);
      return { files: res.files, zipName: file.name, zipEntries: res.totalEntries, zipEmpty: res.files.length === 0 };
    }
    return { files: [{ name: file.name, text: await file.text() }] };
  }

  async function readAll(fileList) {
    var files = [];
    var problems = [];
    var list = Array.prototype.slice.call(fileList);
    for (var i = 0; i < list.length; i++) {
      try {
        var r = await readOne(list[i]);
        files = files.concat(r.files);
        if (r.zipEmpty) problems.push({ name: r.zipName, message: 'This zip has no followers or following files (it holds ' + fmt(r.zipEntries) + ' file' + (r.zipEntries === 1 ? '' : 's') + ', none of them the right ones). When you request the export, tick "Followers and following", and choose JSON.' });
      } catch (err) {
        problems.push({ name: list[i].name, message: err.name === 'ZipError' ? err.message : 'Could not read this file.' });
      }
    }
    return { files: files, problems: problems };
  }

  function showProblems(box, problems) {
    box.textContent = '';
    problems.forEach(function (p) {
      var d = el('div', 'err');
      d.appendChild(el('b', '', p.name || 'File'));
      d.appendChild(document.createTextNode(p.message));
      box.appendChild(d);
    });
  }

  var WRONG_FILE_HELP = 'Look for followers_1.json and following.json in the followers_and_following folder of your export, or just drop the whole .zip.';

  async function handleFiles(fileList) {
    if (!fileList || !fileList.length) return;
    $('landingMsg').textContent = '';
    var read = await readAll(fileList);
    var ing = Core.ingest(read.files);
    var problems = read.problems.concat(ing.problems);
    var hasData = ing.parts.followers || ing.parts.following;
    if (!hasData) {
      if (problems.length === 0) problems.push({ name: 'No files found', message: 'I could not find followers or following files. ' + WRONG_FILE_HELP });
      else problems.push({ name: 'Tip', message: WRONG_FILE_HELP });
      showProblems($('landingMsg'), problems);
      return;
    }
    show(Core.buildAudit(ing.parts), { isDemo: false, found: ing.found, problems: problems, skipped: ing.skipped });
  }

  /* ---------- rendering ---------- */
  function hueFor(name) {
    var h = 0;
    for (var i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % 360;
    return h;
  }

  function personRow(e, dateLabel) {
    var a = el('a', 'person');
    a.href = e.href;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    var av = el('div', 'av', e.username.replace(/[^A-Za-z0-9]/g, '').charAt(0) || '?');
    av.style.background = 'hsl(' + hueFor(e.username) + ' 85% 70%)';
    var pn = el('div', 'pn');
    pn.appendChild(el('b', '', '@' + e.username));
    var when = Core.relativeLabel(e.timestamp);
    pn.appendChild(el('span', '', when ? dateLabel + ' ' + when : 'Open profile'));
    a.appendChild(av);
    a.appendChild(pn);
    a.appendChild(el('div', 'go', '↗'));
    return a;
  }

  function fillList(box, entries, dateLabel) {
    box.textContent = '';
    var frag = document.createDocumentFragment();
    entries.forEach(function (e) { frag.appendChild(personRow(e, dateLabel)); });
    box.appendChild(frag);
  }

  function currentEntries() {
    return Core.filterEntries(state.audit.lists[state.tab], state.query);
  }

  function renderList() {
    var all = state.audit.lists[state.tab];
    var found = currentEntries();
    var copy = TAB_COPY[state.tab];
    var box = $('list');
    if (!state.audit.canCompare) {
      box.textContent = '';
      box.appendChild(el('div', 'empty', 'Add both the followers and following files to compare them.'));
      $('more').hidden = true;
      return;
    }
    if (found.length === 0) {
      box.textContent = '';
      box.appendChild(el('div', 'empty', all.length === 0 ? copy.empty : 'No match for "' + state.query + '".'));
      $('more').hidden = true;
      return;
    }
    fillList(box, found.slice(0, state.shown), copy.date);
    var left = found.length - state.shown;
    $('more').hidden = left <= 0;
    $('more').textContent = 'Show ' + Math.min(PAGE_SIZE, left) + ' more (' + fmt(left) + ' left)';
  }

  function setTab(name) {
    state.tab = name;
    state.shown = PAGE_SIZE;
    Array.prototype.forEach.call($('tabs').children, function (b) {
      b.setAttribute('aria-selected', String(b.dataset.tab === name));
    });
    $('tabHelp').textContent = TAB_COPY[name].help;
    renderList();
  }

  function countUp(node, to, done) {
    var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce || to < 2) { node.textContent = fmt(to); if (done) done(); return; }
    var t0 = performance.now();
    function frame(now) {
      var p = Math.min(1, (now - t0) / COUNT_UP_MS);
      var eased = 1 - Math.pow(1 - p, 3);
      node.textContent = fmt(Math.round(to * eased));
      if (p < 1) requestAnimationFrame(frame);
      else if (done) done();
    }
    requestAnimationFrame(frame);
  }

  function renderHero(audit) {
    var c = audit.counts;
    var num = $('heroNum');
    var meter = $('meter');
    meter.style.width = '0';
    if (audit.canCompare) {
      num.className = 'num';
      $('heroWhat').textContent = c.notFollowingBack === 1 ? "person doesn't follow you back" : "people don't follow you back";
      $('heroOf').textContent = 'out of ' + fmt(c.following) + ' accounts you follow (' + audit.notFollowingBackPct + '%)';
      countUp(num, c.notFollowingBack);
      requestAnimationFrame(function () { meter.style.width = audit.notFollowingBackPct + '%'; });
      return;
    }
    var only = audit.hasFollowers ? c.followers : c.following;
    num.className = 'num neutral';
    $('heroWhat').textContent = audit.hasFollowers ? 'followers found' : 'accounts you follow found';
    $('heroOf').textContent = audit.hasFollowers ? 'Add following.json to see who does not follow you back.' : 'Add followers_1.json (and followers_2.json, if any) to compare.';
    countUp(num, only);
  }

  function renderChart(audit) {
    var data = audit.monthly;
    $('monthCard').hidden = data.length === 0;
    if (data.length === 0) return;
    var max = Math.max.apply(null, data.map(function (d) { return d.count; })) || 1;
    var chart = $('chart');
    var axis = $('axis');
    chart.textContent = '';
    axis.textContent = '';
    var names = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    var peak = data.reduce(function (a, d) { return d.count > a.count ? d : a; }, data[0]);
    data.forEach(function (d) {
      var bar = el('div', 'bar');
      bar.appendChild(el('em', '', d.count ? String(d.count) : ''));
      var fill = el('i', d === peak && d.count > 0 ? 'peak' : '');
      fill.style.height = Math.max(2, Math.round((d.count / max) * 118)) + 'px';
      bar.appendChild(fill);
      chart.appendChild(bar);
      axis.appendChild(el('span', '', names[Number(d.month.slice(5, 7)) - 1]));
    });
    var total = data.reduce(function (s, d) { return s + d.count; }, 0);
    chart.setAttribute('aria-label', 'New followers per month, last 12 months, total ' + total);
    $('chartNote').textContent = total === 0 ? 'No follow dates in this file.' :
      'Biggest month: ' + Core.relativeLabel(Date.UTC(Number(peak.month.slice(0, 4)), Number(peak.month.slice(5, 7)) - 1, 1) / 1000) + ' with ' + fmt(peak.count) + ' new followers.';
  }

  function renderExtra(boxId, nId, listId, entries, label) {
    var box = $(boxId);
    box.hidden = entries === null;
    if (entries === null) return;
    $(nId).textContent = fmt(entries.length);
    fillList($(listId), entries.slice(0, PAGE_SIZE), label);
    if (entries.length === 0) $(listId).appendChild(el('div', 'empty', 'None in this export.'));
  }

  function renderFound(found, skipped) {
    var box = $('found');
    box.textContent = '';
    var kinds = ['followers', 'following', 'pending', 'unfollowed'];
    kinds.forEach(function (k) {
      if (!found[k].length) return;
      var c = el('span', 'chip');
      c.appendChild(el('b', '', '✓ '));
      c.appendChild(document.createTextNode(found[k].length > 1 ? found[k].length + ' ' + Core.KIND_LABEL[k] + ' files' : Core.KIND_LABEL[k]));
      box.appendChild(c);
    });
    if (skipped) box.appendChild(el('span', 'chip', skipped + ' entries skipped (no username)'));
  }

  function show(audit, meta) {
    state.audit = audit;
    state.isDemo = meta.isDemo;
    state.query = '';
    $('search').value = '';
    revokeCard();
    $('landing').hidden = true;
    $('results').hidden = false;
    $('demoBadge').hidden = !meta.isDemo;
    $('privacyPill').textContent = meta.isDemo ? 'Demo data' : 'Stays on your device';
    showProblems($('resultMsg'), meta.problems || []);
    if (audit.canCompare === false) {
      var n = el('div', 'note', 'Only one of the two lists was found, so I cannot compare yet. ' + WRONG_FILE_HELP);
      $('resultMsg').appendChild(n);
    }
    var c = audit.counts;
    $('tNfb').textContent = c.notFollowingBack === null ? '-' : fmt(c.notFollowingBack);
    $('tFans').textContent = c.fans === null ? '-' : fmt(c.fans);
    $('tMut').textContent = c.mutuals === null ? '-' : fmt(c.mutuals);
    renderHero(audit);
    renderChart(audit);
    renderExtra('pendingBox', 'pendingN', 'pendingList', c.pending === null ? null : audit.lists.pending, 'Requested');
    renderExtra('unfBox', 'unfN', 'unfList', c.unfollowed === null ? null : audit.lists.unfollowed, 'Unfollowed');
    renderFound(meta.found || { followers: [], following: [], pending: [], unfollowed: [] }, meta.skipped);
    $('cardImg').hidden = true;
    $('cardBtns').hidden = true;
    $('shareCard').hidden = !audit.canCompare;
    setTab('notFollowingBack');
    window.scrollTo(0, 0);
  }

  /* ---------- copy / csv ---------- */
  async function copyList() {
    var text = Core.toPlainList(currentEntries());
    if (!text) { toast('Nothing to copy'); return; }
    try {
      await navigator.clipboard.writeText(text);
    } catch (err) {
      var ta = el('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      var ok = false;
      try { ok = document.execCommand('copy'); } catch (e2) { ok = false; }
      document.body.removeChild(ta);
      if (!ok) { toast('Copy blocked. Use Download CSV'); return; }
    }
    toast('Copied ' + fmt(currentEntries().length) + ' usernames');
  }

  function downloadBlob(blob, name) {
    var url = URL.createObjectURL(blob);
    var a = el('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
  }

  function downloadCsv() {
    var entries = currentEntries();
    if (!entries.length) { toast('Nothing to download'); return; }
    var name = TAB_COPY[state.tab].csv;
    downloadBlob(new Blob([Core.toCsv(entries, name)], { type: 'text/csv;charset=utf-8' }), 'followers_' + name + '.csv');
  }

  /* ---------- share card ---------- */
  var CARD_W = 1080;
  var CARD_H = 1350;
  var CARD_FONT = '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", Roboto, Helvetica, Arial, sans-serif';

  function wrapLines(ctx, text, maxWidth) {
    var words = text.split(' ');
    var lines = [];
    var line = '';
    words.forEach(function (w) {
      var test = line ? line + ' ' + w : w;
      if (ctx.measureText(test).width > maxWidth && line) { lines.push(line); line = w; } else { line = test; }
    });
    if (line) lines.push(line);
    return lines;
  }

  function drawCard(audit, isDemo) {
    var t = Core.cardText(audit);
    var cv = document.createElement('canvas');
    cv.width = CARD_W;
    cv.height = CARD_H;
    var ctx = cv.getContext('2d');
    var g = ctx.createLinearGradient(0, 0, 0, CARD_H);
    g.addColorStop(0, '#12121b');
    g.addColorStop(1, '#0a0a0f');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, CARD_W, CARD_H);
    ctx.textAlign = 'center';

    ctx.fillStyle = '#c8ff3d';
    ctx.font = '900 40px ' + CARD_FONT;
    ctx.fillText('F O L L O W E R S', CARD_W / 2, 130);

    var y = 640;
    if (!t.isAll) {
      var size = t.number.length > 4 ? 300 : 380;
      ctx.fillStyle = '#ff5d73';
      ctx.font = '900 ' + size + 'px ' + CARD_FONT;
      ctx.fillText(t.number, CARD_W / 2, 560);
      ctx.fillStyle = '#f5f5f8';
      ctx.font = '800 68px ' + CARD_FONT;
      y = 680;
      wrapLines(ctx, t.headline, 900).forEach(function (l, i) { ctx.fillText(l, CARD_W / 2, y + i * 82); });
      ctx.fillStyle = '#a0a0b4';
      ctx.font = '500 40px ' + CARD_FONT;
      ctx.fillText(t.sub, CARD_W / 2, 850);
    } else {
      ctx.fillStyle = '#c8ff3d';
      ctx.font = '900 110px ' + CARD_FONT;
      wrapLines(ctx, t.headline, 900).forEach(function (l, i) { ctx.fillText(l, CARD_W / 2, 520 + i * 130); });
      ctx.fillStyle = '#a0a0b4';
      ctx.font = '500 40px ' + CARD_FONT;
      ctx.fillText(t.sub, CARD_W / 2, 850);
    }

    // meter
    var mx = 190, mw = 700, my = 905;
    ctx.fillStyle = '#242433';
    ctx.beginPath(); ctx.roundRect(mx, my, mw, 18, 9); ctx.fill();
    if (audit.notFollowingBackPct > 0) {
      ctx.fillStyle = '#ff5d73';
      ctx.beginPath(); ctx.roundRect(mx, my, Math.max(18, mw * audit.notFollowingBackPct / 100), 18, 9); ctx.fill();
    }

    // stats
    var colW = 300;
    t.stats.forEach(function (s, i) {
      var cx = CARD_W / 2 + (i - 1) * colW;
      ctx.fillStyle = '#f5f5f8';
      ctx.font = '800 64px ' + CARD_FONT;
      ctx.fillText(s.value, cx, 1070);
      ctx.fillStyle = '#a0a0b4';
      ctx.font = '500 32px ' + CARD_FONT;
      ctx.fillText(s.label, cx, 1118);
    });

    ctx.fillStyle = '#a0a0b4';
    ctx.font = '500 34px ' + CARD_FONT;
    ctx.fillText(isDemo ? 'Demo data. Not a real account.' : 'Checked in my browser. No password.', CARD_W / 2, 1220);
    ctx.fillStyle = '#6f6f86';
    ctx.font = '600 30px ' + CARD_FONT;
    ctx.fillText('@louiscreates.ai', CARD_W / 2, 1290);
    return cv;
  }

  function revokeCard() {
    if (state.cardUrl) URL.revokeObjectURL(state.cardUrl);
    state.cardUrl = null;
    state.cardBlob = null;
  }

  function makeCard() {
    var cv = drawCard(state.audit, state.isDemo);
    cv.toBlob(function (blob) {
      if (!blob) { toast('Could not make the card'); return; }
      revokeCard();
      state.cardBlob = blob;
      state.cardUrl = URL.createObjectURL(blob);
      $('cardImg').src = state.cardUrl;
      $('cardImg').hidden = false;
      $('cardBtns').hidden = false;
      $('cardImg').scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 'image/png');
  }

  async function shareCard() {
    if (!state.cardBlob) return;
    var file = new File([state.cardBlob], 'followers-card.png', { type: 'image/png' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try { await navigator.share({ files: [file] }); return; } catch (err) { if (err && err.name === 'AbortError') return; }
    }
    downloadBlob(state.cardBlob, 'followers-card.png');
    toast('Saved the image');
  }

  /* ---------- wiring ---------- */
  function reset() {
    state.audit = null;
    revokeCard();
    $('results').hidden = true;
    $('landing').hidden = false;
    $('landingMsg').textContent = '';
    $('privacyPill').textContent = 'No login. No upload.';
    $('file').value = '';
    window.scrollTo(0, 0);
  }

  function init() {
    var drop = $('drop');
    $('pick').addEventListener('click', function () { $('file').click(); });
    $('file').addEventListener('change', function (e) { handleFiles(e.target.files); });
    ['dragenter', 'dragover'].forEach(function (ev) {
      document.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.add('over'); });
    });
    ['dragleave', 'drop'].forEach(function (ev) {
      document.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.remove('over'); });
    });
    document.addEventListener('drop', function (e) { if (e.dataTransfer) handleFiles(e.dataTransfer.files); });

    $('demo').addEventListener('click', function () {
      var parts = Demo.build();
      var found = { followers: ['demo'], following: ['demo'], pending: ['demo'], unfollowed: ['demo'] };
      show(Core.buildAudit(parts), { isDemo: true, found: found, problems: [], skipped: 0 });
    });
    $('tabs').addEventListener('click', function (e) {
      var b = e.target.closest('.tab');
      if (b) setTab(b.dataset.tab);
    });
    $('search').addEventListener('input', function (e) {
      state.query = e.target.value;
      state.shown = PAGE_SIZE;
      renderList();
    });
    $('more').addEventListener('click', function () { state.shown += PAGE_SIZE; renderList(); });
    $('copy').addEventListener('click', copyList);
    $('csv').addEventListener('click', downloadCsv);
    $('makeCard').addEventListener('click', makeCard);
    $('shareBtn').addEventListener('click', shareCard);
    $('saveBtn').addEventListener('click', function () { if (state.cardBlob) downloadBlob(state.cardBlob, 'followers-card.png'); });
    $('again').addEventListener('click', reset);
  }

  init();
})();
