/* CANCEL: page logic. Everything runs locally and nothing here talks to a server. */
(function () {
  'use strict';
  const C = window.Cancel;
  const $ = (id) => document.getElementById(id);
  const matcher = C.buildMatcher(C.KNOWN);
  const MAX_FILE_BYTES = 25 * 1024 * 1024;
  const COUNT_UP_MS = 1300;
  const reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const state = {
    text: '', opts: { flipSign: false, dateOrder: null }, result: null,
    selected: new Set(), isDemo: false, currency: 'USD', currencyPinned: false, saved: 0, heroShown: 0,
  };

  // ---------- tiny helpers ----------

  function el(tag, cls, text) {
    const node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text !== undefined) node.textContent = text;
    return node;
  }
  const money = (n, cents) => C.fmt.money(n, state.currency, cents);

  function countTo(node, from, to, format) {
    if (node._raf) cancelAnimationFrame(node._raf);
    if (reduceMotion || from === to) { node.textContent = format(to); return; }
    const start = performance.now();
    const step = (now) => {
      const t = Math.min(1, (now - start) / COUNT_UP_MS);
      const eased = 1 - Math.pow(1 - t, 4);
      node.textContent = format(from + (to - from) * eased);
      if (t < 1) node._raf = requestAnimationFrame(step); else node.textContent = format(to);
    };
    node._raf = requestAnimationFrame(step);
  }

  function showError(message) {
    const box = $('error');
    box.textContent = message;
    box.hidden = false;
  }

  function externalRequests() {
    try {
      return performance.getEntriesByType('resource').filter((e) => {
        try { const u = new URL(e.name); return u.protocol !== 'file:' && u.host !== location.host; } catch (err) { return false; }
      }).length;
    } catch (err) { return 0; }
  }

  function updateNetPill() {
    const pill = $('netPill');
    const offline = navigator.onLine === false;
    pill.classList.toggle('offline', offline);
    $('netText').textContent = offline ? 'Offline right now. Still works.' : '100% on your device';
    $('netProof').textContent = `Requests to other sites since this page loaded: ${externalRequests()}`;
  }

  // ---------- ingest ----------

  function ingest(text, isDemo) {
    state.text = text;
    state.isDemo = isDemo;
    state.opts = { flipSign: false, dateOrder: null };
    state.selected = new Set();
    state.currencyPinned = false;
    runAnalysis();
  }

  function runAnalysis() {
    $('error').hidden = true;
    let result;
    try {
      result = C.analyze(state.text, { known: C.KNOWN, matcher, flipSign: state.opts.flipSign, dateOrder: state.opts.dateOrder });
    } catch (err) {
      showError('Something in that file confused me. Try the Paste option, or check it is a plain CSV export.');
      return;
    }
    if (result.error) { showError(result.error); return; }
    state.result = result;
    if (!state.currencyPinned) state.currency = result.meta.currency || 'USD';
    state.saved = 0;
    state.heroShown = 0;
    render(true);
  }

  async function readFile(file) {
    if (!file) return;
    if (file.size > MAX_FILE_BYTES) { showError('That file is bigger than 25 MB. Export a shorter date range.'); return; }
    try {
      const buf = await file.arrayBuffer();
      let text;
      try { text = new TextDecoder('utf-8', { fatal: true }).decode(buf); } catch (err) { text = new TextDecoder('windows-1252').decode(buf); }
      ingest(text, false);
    } catch (err) {
      showError('I could not read that file. Try pasting its text instead.');
    }
  }

  // ---------- rendering ----------

  function cadenceLine(item) {
    const parts = [];
    if (item.known) parts.push(item.category);
    parts.push(`${money(item.amount, true)} ${C.fmt.cadenceText(item.cadence)}`);
    if (item.kind === 'once') parts.push(`seen ${C.fmt.shortDate(item.lastDate, true)}`);
    else if (item.status === 'active') parts.push(`next about ${C.fmt.shortDate(item.nextDate, item.nextDate.slice(0, 4) !== item.lastDate.slice(0, 4))}`);
    return parts.join(' · ');
  }

  function buildMore(item) {
    const box = el('div', 'more');
    box.append(el('h3', '', `Charges seen (${item.count})`));
    const list = el('ul');
    item.charges.slice(-6).forEach((c) => list.append(el('li', '', `${C.fmt.shortDate(c.date, true)}: ${money(c.amount, true)}`)));
    box.append(list);
    const confidencePct = Math.round(item.confidence * 100);
    box.append(el('h3', '', 'Why I think so'));
    box.append(el('div', '', `${confidencePct}% sure. ${item.count} charge${item.count === 1 ? '' : 's'}, ${C.fmt.cadenceText(item.cadence)}${item.known ? ', and the name matches a known service' : ''}.`));
    const known = item.known;
    if (known && known.alts) {
      box.append(el('h3', '', 'Free or cheaper option'));
      known.alts.forEach((a) => {
        const altBox = el('div', 'alt');
        altBox.append(el('b', '', a.name));
        altBox.append(el('div', '', `Catch: ${a.catch}`));
        const link = el('a', '', "Check the vendor's page");
        link.href = a.url; link.target = '_blank'; link.rel = 'noopener noreferrer';
        altBox.append(link);
        box.append(altBox);
      });
    }
    if (known && known.cancel) {
      box.append(el('h3', '', 'How to cancel'));
      const link = el('a', '', 'Official cancel or manage page');
      link.href = known.cancel; link.target = '_blank'; link.rel = 'noopener noreferrer';
      box.append(link);
    }
    return box;
  }

  function buildItem(item) {
    const card = el('article', `item${state.selected.has(item.id) ? ' on' : ''}`);
    const label = el('label', 'pick');
    const input = el('input');
    input.type = 'checkbox';
    input.checked = state.selected.has(item.id);
    input.setAttribute('aria-label', `I'd cancel ${item.merchant}`);
    input.addEventListener('change', () => {
      if (input.checked) state.selected.add(item.id); else state.selected.delete(item.id);
      card.classList.toggle('on', input.checked);
      updateSave();
    });
    const body = el('span', 'meta');
    body.append(el('div', 'name', item.merchant), el('div', 'line2', cadenceLine(item)));
    const badges = el('div', 'badges');
    badges.append(el('span', `badge ${item.confidenceLabel.toLowerCase()}`, `${item.confidenceLabel} confidence`));
    item.flags.forEach((f) => {
      const text = C.fmt.flagText(f, state.currency, true);
      if (text) badges.append(el('span', 'badge flag', text));
    });
    body.append(badges);
    const cost = el('span', 'cost', money(item.yearly, false));
    cost.append(el('small', '', 'per year'));
    label.append(input, el('span', 'box'), body, cost);
    card.append(label);

    const toggle = el('button', 'link', 'Details');
    toggle.type = 'button';
    toggle.setAttribute('aria-expanded', 'false');
    let more = null;
    toggle.addEventListener('click', () => {
      if (more) { more.remove(); more = null; toggle.textContent = 'Details'; toggle.setAttribute('aria-expanded', 'false'); return; }
      more = buildMore(item);
      card.append(more);
      toggle.textContent = 'Hide details';
      toggle.setAttribute('aria-expanded', 'true');
    });
    card.insertBefore(toggle, null);
    return card;
  }

  function fillList(id, items) {
    const box = $(id);
    box.textContent = '';
    items.forEach((it) => box.append(buildItem(it)));
  }

  function describeRead(meta, warnings) {
    const delimiterName = { ',': 'comma', ';': 'semicolon', '\t': 'tab', '|': 'pipe' }[meta.delimiter] || meta.delimiter;
    const orderName = { MDY: 'month/day/year', DMY: 'day/month/year', ISO: 'year-month-day' }[meta.dateOrder] || meta.dateOrder;
    const cols = meta.columns;
    const amountPart = cols.amount ? `Amount column "${cols.amount}"` : `Debit "${cols.debit}" and credit "${cols.credit}" columns`;
    const lines = [
      `Separator: ${delimiterName}. ${meta.hasHeader ? 'Column names found.' : 'No column names, guessed from the data.'}`,
      `Dates "${cols.date}" read as ${orderName} (${meta.dateReason}).`,
      `${amountPart}. Charges are ${meta.positiveIsSpend ? 'positive' : 'negative'} numbers in this file.`,
      `Description "${cols.description}". ${meta.rowCount} rows read. Currency ${meta.currency || 'not stated, showing $'}.`,
    ].concat(warnings);
    const box = $('readBody');
    box.textContent = '';
    lines.forEach((l) => box.append(el('p', '', l)));
  }

  function renderHero(animate) {
    const s = state.result.summary;
    const hero = $('heroNum');
    const fmt = (v) => money(Math.round(v), false);
    if (animate) countTo(hero, 0, s.yearly, fmt); else { hero.textContent = fmt(s.yearly); }
    state.heroShown = s.yearly;
    const sub = $('heroSub');
    sub.textContent = '';
    if (s.confirmed.length) {
      sub.append(`${money(s.monthly, false)} a month across ${s.confirmed.length} recurring charge${s.confirmed.length === 1 ? '' : 's'}`);
    } else {
      sub.append('No repeating charges found with enough confidence.');
    }
    if (s.maybe.length) {
      sub.append(el('br'));
      sub.append(el('span', '', `+ ${s.maybe.length} maybe, worth ${money(s.maybeYearly, false)} a year if real (not counted)`));
    }
  }

  function render(animate) {
    const r = state.result;
    $('intro').hidden = true;
    $('results').hidden = false;
    $('saveBar').hidden = false;
    $('demoBanner').hidden = !state.isDemo;
    renderHero(animate);
    const s = r.summary;
    fillList('listConfirmed', s.confirmed);
    $('maybeWrap').hidden = !s.maybe.length;
    fillList('listMaybe', s.maybe);
    $('stoppedWrap').hidden = !s.stopped.length;
    fillList('listStopped', s.stopped);
    describeRead(r.meta, r.warnings);
    document.querySelectorAll('.chip').forEach((c) => c.setAttribute('aria-pressed', String(c.dataset.cur === state.currency)));
    updateSave(!animate);
    updateNetPill();
    if (animate) window.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' });
  }

  function updateSave(instant) {
    const total = C.savings(state.result.items, state.selected);
    const node = $('saveNum');
    const fmt = (v) => money(Math.round(v), false);
    if (instant) node.textContent = fmt(total); else countTo(node, state.saved, total, fmt);
    state.saved = total;
  }

  // ---------- share card ----------

  function cardData() {
    const s = state.result.summary;
    const showNames = $('showNames').checked;
    return {
      yearly: s.yearly, currency: state.currency, saved: state.saved, count: s.confirmed.length, isDemo: state.isDemo,
      names: showNames ? s.confirmed.map((i) => ({ name: i.merchant, yearly: i.yearly })) : null,
    };
  }

  function openModal() {
    $('modal').hidden = false;
    $('shareMsg').textContent = '';
    C.drawCard($('card'), cardData());
    $('saveImg').focus();
  }

  function canvasBlob() {
    return new Promise((resolve) => $('card').toBlob(resolve, 'image/png'));
  }

  async function saveImage() {
    const blob = await canvasBlob();
    if (!blob) { $('shareMsg').textContent = 'Your browser could not make the image.'; return; }
    const file = new File([blob], 'cancel-card.png', { type: 'image/png' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try { await navigator.share({ files: [file] }); return; } catch (err) { if (err && err.name === 'AbortError') return; }
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'cancel-card.png';
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    $('shareMsg').textContent = 'Saved. The card never touched a server.';
  }

  // ---------- wiring ----------

  function wire() {
    const drop = $('drop');
    $('pick').addEventListener('click', () => $('file').click());
    $('file').addEventListener('change', (e) => { readFile(e.target.files[0]); e.target.value = ''; });
    ['dragenter', 'dragover'].forEach((t) => drop.addEventListener(t, (e) => { e.preventDefault(); drop.classList.add('over'); }));
    ['dragleave', 'drop'].forEach((t) => drop.addEventListener(t, (e) => { e.preventDefault(); drop.classList.remove('over'); }));
    drop.addEventListener('drop', (e) => readFile(e.dataTransfer && e.dataTransfer.files[0]));
    $('pasteToggle').addEventListener('click', () => {
      const box = $('pasteBox');
      box.hidden = !box.hidden;
      $('pasteToggle').setAttribute('aria-expanded', String(!box.hidden));
      if (!box.hidden) $('pasteArea').focus();
    });
    $('analyze').addEventListener('click', () => ingest($('pasteArea').value, false));
    $('demo').addEventListener('click', () => ingest(C.makeDemoCSV(new Date().toISOString().slice(0, 10)), true));
    $('restart').addEventListener('click', () => {
      state.result = null; state.selected = new Set(); $('results').hidden = true; $('saveBar').hidden = true; $('intro').hidden = false;
      window.scrollTo({ top: 0 });
    });
    document.querySelectorAll('.chip').forEach((chip) => chip.addEventListener('click', () => {
      state.currency = chip.dataset.cur; state.currencyPinned = true; render(false);
    }));
    $('swapDates').addEventListener('click', () => {
      const current = state.result.meta.dateOrder;
      state.opts.dateOrder = current === 'DMY' ? 'MDY' : 'DMY';
      state.selected = new Set();
      runAnalysis();
    });
    $('flipSign').addEventListener('click', () => { state.opts.flipSign = !state.opts.flipSign; state.selected = new Set(); runAnalysis(); });
    $('shareBtn').addEventListener('click', openModal);
    $('showNames').addEventListener('change', () => C.drawCard($('card'), cardData()));
    $('saveImg').addEventListener('click', saveImage);
    $('closeModal').addEventListener('click', () => { $('modal').hidden = true; });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') $('modal').hidden = true; });
    window.addEventListener('online', updateNetPill);
    window.addEventListener('offline', updateNetPill);
    updateNetPill();
  }

  wire();
})();
