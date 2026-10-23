/* CANCEL: find recurring charges in a list of transactions. Negative amount = money spent. */
(function (g) {
  'use strict';
  const C = (g.Cancel = g.Cancel || {});

  const DAY = 86400000;
  const toDay = (iso) => Math.round(Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10)) / DAY);
  const fromDay = (d) => new Date(d * DAY).toISOString().slice(0, 10);
  const round2 = (n) => Math.round(n * 100) / 100;

  function addMonths(iso, n) {
    const y = +iso.slice(0, 4);
    const m = +iso.slice(5, 7);
    const day = +iso.slice(8, 10);
    const first = new Date(Date.UTC(y, m - 1 + n, 1));
    const lastDay = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate();
    first.setUTCDate(Math.min(day, lastDay));
    return first.toISOString().slice(0, 10);
  }

  const CADENCES = [
    { name: 'weekly', perYear: 52, lo: 5, hi: 9, minCount: 3, grace: 4 },
    { name: 'monthly', perYear: 12, lo: 26, hi: 35, minCount: 2, grace: 10, months: 1 },
    { name: 'quarterly', perYear: 4, lo: 84, hi: 98, minCount: 2, grace: 21, months: 3 },
    { name: 'yearly', perYear: 1, lo: 350, hi: 380, minCount: 2, grace: 45, months: 12 },
  ];
  const CADENCE_BY_NAME = Object.fromEntries(CADENCES.map((c) => [c.name, c]));

  function nextAfter(lastIso, cadenceName) {
    const cad = CADENCE_BY_NAME[cadenceName];
    return cad.months ? addMonths(lastIso, cad.months) : fromDay(toDay(lastIso) + 7);
  }

  const amountsSame = (a, b) => Math.abs(a - b) <= Math.max(0.75, 0.06 * Math.max(a, b));
  const absAmount = (t) => Math.abs(t.amount);

  /** Does this list of charge days follow weekly / monthly / quarterly / yearly? */
  function testCadence(days) {
    if (days.length < 2) return null;
    const intervals = days.slice(1).map((d, i) => d - days[i]);
    let best = null;
    for (const cad of CADENCES) {
      if (days.length < cad.minCount) continue;
      const okIv = intervals.filter((v) => v >= cad.lo && v <= cad.hi);
      const gaps = intervals.filter((v) => v >= 2 * cad.lo - 1 && v <= 2 * cad.hi + 1 && !(v >= cad.lo && v <= cad.hi)).length;
      if (!okIv.length) continue;
      if (okIv.length / intervals.length < 0.6 || (okIv.length + gaps) / intervals.length < 0.8) continue;
      const mean = okIv.reduce((a, b) => a + b, 0) / okIv.length;
      const sd = Math.sqrt(okIv.reduce((a, b) => a + (b - mean) ** 2, 0) / okIv.length);
      const candidate = { cadence: cad.name, ok: okIv.length, gaps, cv: sd / mean };
      if (!best || candidate.ok > best.ok) best = candidate;
    }
    return best;
  }

  const titleCase = (s) => s.split(' ').map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w)).join(' ');
  const median = (arr) => { const s = [...arr].sort((a, b) => a - b); return s[Math.floor(s.length / 2)]; };

  function clusterByAmount(txs) {
    const sorted = [...txs].sort((a, b) => absAmount(a) - absAmount(b));
    const clusters = [];
    sorted.forEach((t) => {
      const last = clusters[clusters.length - 1];
      const mean = last ? last.reduce((a, x) => a + absAmount(x), 0) / last.length : 0;
      if (last && amountsSame(mean, absAmount(t))) last.push(t); else clusters.push([t]);
    });
    return clusters.map((c) => c.sort((a, b) => (a.date < b.date ? -1 : 1)));
  }

  const isTrialBefore = (single, next) => {
    const nextLevel = median(next.map(absAmount));
    const gap = toDay(next[0].date) - toDay(single.date);
    return absAmount(single) * 3 <= nextLevel && gap >= 0 && gap <= 45;
  };

  /** Join amount clusters that continue each other in time (price changes, trials) into series. */
  function buildSeries(clusters) {
    const ordered = [...clusters].sort((a, b) => (a[0].date < b[0].date ? -1 : 1));
    const out = [];
    let cur = null;
    const flush = () => { if (cur) out.push(cur); cur = null; };
    ordered.forEach((c) => {
      if (!cur) { cur = { txs: c, trial: null }; return; }
      const curEnd = cur.txs[cur.txs.length - 1].date;
      if (c[0].date <= curEnd) { flush(); cur = { txs: c, trial: null }; return; }
      if (cur.txs.length === 1 && !cur.trial && isTrialBefore(cur.txs[0], c)) { cur = { txs: c, trial: cur.txs[0] }; return; }
      const union = [...cur.txs, ...c];
      if (testCadence(union.map((t) => toDay(t.date)))) { cur = { txs: union, trial: cur.trial }; return; }
      flush();
      cur = { txs: c, trial: null };
    });
    flush();
    return out;
  }

  function priceLevels(txs) {
    const levels = [];
    txs.forEach((t) => {
      const a = absAmount(t);
      const last = levels[levels.length - 1];
      if (last && amountsSame(last.last, a)) last.last = a; else levels.push({ first: a, last: a, date: t.date });
    });
    return levels;
  }

  function scoreConfidence(n, cad, known, series, isUnknownWeekly) {
    let c = n >= 5 ? 0.8 : n === 4 ? 0.76 : n === 3 ? 0.62 : (cad.cadence === 'yearly' ? 0.58 : 0.42);
    if (cad.cv < 0.05 && n >= 3) c += 0.04;
    c -= Math.min(0.2, cad.gaps * 0.08);
    const amounts = series.txs.map(absAmount);
    if (Math.max(...amounts) - Math.min(...amounts) < 0.011) c += 0.03;
    if (known) c += 0.08;
    if (isUnknownWeekly) c = Math.min(c, 0.55);
    return Math.max(0.05, Math.min(0.95, round2(c)));
  }

  const labelFor = (c) => (c >= 0.75 ? 'High' : c >= 0.5 ? 'Medium' : 'Low');

  function describeGroup(group) {
    const known = group.known;
    return {
      merchant: known ? known.name : titleCase(group.norm || 'Unknown merchant'),
      category: known ? known.cat : 'Other',
    };
  }

  function makeSeriesItem(series, group, ctx) {
    const days = series.txs.map((t) => toDay(t.date));
    const cad = testCadence(days);
    const n = series.txs.length;
    const cfg = CADENCE_BY_NAME[cad.cadence];
    const levels = priceLevels(series.txs);
    const lastTx = series.txs[n - 1];
    const amount = absAmount(lastTx);
    const lastDate = lastTx.date;
    const nextDate = nextAfter(lastDate, cad.cadence);
    const stopped = ctx.asOf && toDay(ctx.asOf) > toDay(nextDate) + cfg.grace;
    const unknownWeekly = !group.known && cad.cadence === 'weekly';
    const confidence = scoreConfidence(n, cad, group.known, series, unknownWeekly);
    const flags = [];
    if (levels.length > 1) {
      const from = levels[levels.length - 2].last;
      const to = levels[levels.length - 1].last;
      flags.push({ type: to > from ? 'priceUp' : 'priceDown', from, to, date: levels[levels.length - 1].date });
    }
    if (series.trial) flags.push({ type: 'trial', amount: absAmount(series.trial), date: series.trial.date });
    if (cad.gaps > 0) flags.push({ type: 'gaps', count: cad.gaps });
    if (unknownWeekly) flags.push({ type: 'weeklyUnknown' });
    if (stopped) flags.push({ type: 'stopped', lastDate });
    const named = describeGroup(group);
    return {
      id: `${group.key}|${amount.toFixed(2)}|${series.txs[0].date}`,
      kind: 'series',
      merchant: named.merchant,
      category: named.category,
      known: group.known || null,
      cadence: cad.cadence,
      amount: round2(amount),
      yearly: round2(amount * cfg.perYear),
      monthly: round2((amount * cfg.perYear) / 12),
      count: n,
      firstDate: series.txs[0].date,
      lastDate,
      nextDate,
      confidence,
      confidenceLabel: labelFor(confidence),
      status: stopped ? 'stopped' : 'active',
      flags,
      charges: series.txs.map((t) => ({ date: t.date, amount: round2(absAmount(t)) })),
    };
  }

  const MIN_SERIES_SHARE = 0.5;
  const YEARLY_HINT = /\b(annual|yearly|year|renewal|subscription|membership|prime)\b/i;

  function makeOnceItem(tx, group, ctx) {
    const amount = absAmount(tx);
    const looksYearly = ctx.spanDays >= 300;
    const cadence = looksYearly ? 'yearly' : 'monthly';
    const cfg = CADENCE_BY_NAME[cadence];
    const named = describeGroup(group);
    return {
      id: `${group.key}|${amount.toFixed(2)}|${tx.date}|once`,
      kind: 'once',
      merchant: named.merchant,
      category: named.category,
      known: group.known || null,
      cadence,
      amount: round2(amount),
      yearly: round2(amount * cfg.perYear),
      monthly: round2((amount * cfg.perYear) / 12),
      count: 1,
      firstDate: tx.date,
      lastDate: tx.date,
      nextDate: nextAfter(tx.date, cadence),
      confidence: looksYearly ? 0.28 : 0.3,
      confidenceLabel: 'Low',
      status: 'once',
      flags: [{ type: looksYearly ? 'yearlyOnce' : 'monthlyOnce' }],
      charges: [{ date: tx.date, amount: round2(amount) }],
    };
  }

  // ---------- cleaning steps ----------

  function dropDuplicates(spend) {
    const byKey = new Map();
    spend.forEach((t) => { const arr = byKey.get(t.key) || []; arr.push(t); byKey.set(t.key, arr); });
    const kept = [];
    let merged = 0;
    byKey.forEach((arr) => {
      const sorted = [...arr].sort((a, b) => (a.date < b.date ? -1 : 1));
      const out = [];
      sorted.forEach((t) => {
        const prev = out[out.length - 1];
        const close = prev && Math.abs(absAmount(prev) - absAmount(t)) < 0.01 && toDay(t.date) - toDay(prev.date) <= 3;
        if (!close) { out.push(t); return; }
        merged++;
        out[out.length - 1] = prev.pending && !t.pending ? t : (t.pending && !prev.pending ? prev : t);
      });
      kept.push(...out);
    });
    return { kept, merged };
  }

  function dropRefunded(spend, credits) {
    const remaining = [...spend];
    let paired = 0;
    credits.forEach((cr) => {
      const idx = remaining.findIndex((s) => s.key === cr.key
        && Math.abs(absAmount(s) - cr.amount) < 0.011
        && toDay(cr.date) >= toDay(s.date) && toDay(cr.date) - toDay(s.date) <= 60);
      if (idx >= 0) { remaining.splice(idx, 1); paired++; }
    });
    return { remaining, paired };
  }

  function groupByKey(spend) {
    const groups = new Map();
    spend.forEach((t) => {
      const g1 = groups.get(t.key) || { key: t.key, known: t.known, norm: t.norm, txs: [] };
      g1.txs.push(t);
      groups.set(t.key, g1);
    });
    // Unknown merchants: "some gym" absorbs "some gym seattle".
    const unknown = [...groups.values()].filter((x) => !x.known).sort((a, b) => a.norm.split(' ').length - b.norm.split(' ').length);
    const roots = [];
    unknown.forEach((grp) => {
      const root = roots.find((r) => r.norm.length >= 4 && (grp.norm === r.norm || grp.norm.startsWith(`${r.norm} `)));
      if (root) { root.txs.push(...grp.txs); groups.delete(grp.key); } else { roots.push(grp); }
    });
    return [...groups.values()];
  }

  const refundWords = /\b(refund|return|credit|reversal|adjustment)\b/gi;

  function detectRecurring(transactions, opts) {
    const options = opts || {};
    const match = options.matcher || C.buildMatcher(options.known || []);
    const usable = (transactions || []).filter((t) => t && /^\d{4}-\d{2}-\d{2}$/.test(t.date) && Number.isFinite(t.amount) && t.amount !== 0);
    const empty = { items: [], stats: { spanDays: 0, asOf: null, duplicatesMerged: 0, refundsPaired: 0, ignoredNonSub: 0, ignoredEveryday: 0 } };
    if (!usable.length) return empty;
    const dates = usable.map((t) => t.date).sort();
    const asOf = options.asOf || dates[dates.length - 1];
    const spanDays = toDay(dates[dates.length - 1]) - toDay(dates[0]);
    const ctx = { asOf, spanDays };

    let ignoredNonSub = 0;
    let ignoredEveryday = 0;
    const annotate = (t) => {
      const known = match(t.desc, t.desc2);
      const norm = C.normalizeMerchant(t.amount > 0 ? String(t.desc).replace(refundWords, ' ') : t.desc);
      return { ...t, known, norm, key: known ? `k:${known.id}` : `n:${norm}` };
    };
    const all = usable.map(annotate);
    const credits = all.filter((t) => t.amount > 0).map((t) => ({ ...t, amount: t.amount }));
    const spendRaw = [];
    all.filter((t) => t.amount < 0).forEach((t) => {
      const text = `${t.desc} ${t.desc2 || ''} ${t.type || ''}`;
      if (!t.known && C.NON_SUB.test(text)) { ignoredNonSub++; return; }
      if (!t.known && C.EVERYDAY.test(text)) { ignoredEveryday++; return; }
      if (!t.norm) return;
      spendRaw.push(t);
    });
    const dedupe = dropDuplicates(spendRaw);
    const refunds = dropRefunded(dedupe.kept, credits);
    const groups = groupByKey(refunds.remaining);

    const items = [];
    groups.forEach((group) => {
      const used = new Set();
      buildSeries(clusterByAmount(group.txs)).forEach((series) => {
        if (series.txs.length < 2 || !testCadence(series.txs.map((t) => toDay(t.date)))) return;
        // An unknown merchant we pay all the time (ride share, a cafe) can line up by chance. Skip it.
        if (!group.known && series.txs.length / group.txs.length < MIN_SERIES_SHARE) return;
        series.txs.forEach((t) => used.add(t));
        items.push(makeSeriesItem(series, group, ctx));
      });
      if (!items.some((it) => it.id.startsWith(`${group.key}|`))) {
        const leftovers = group.txs.filter((t) => !used.has(t)).sort((a, b) => (a.date < b.date ? 1 : -1));
        const hinted = group.known || YEARLY_HINT.test(`${leftovers[0] ? leftovers[0].desc : ''}`);
        if (leftovers.length && hinted) items.push(makeOnceItem(leftovers[0], group, ctx));
      }
    });
    items.sort((a, b) => b.yearly - a.yearly);
    return {
      items,
      stats: { spanDays, asOf, duplicatesMerged: dedupe.merged, refundsPaired: refunds.paired, ignoredNonSub, ignoredEveryday },
    };
  }

  /** Split items into the sections the UI shows, and total the confident ones. */
  function summarize(items) {
    const confirmed = items.filter((i) => i.kind === 'series' && i.status === 'active' && i.confidence >= 0.5);
    const maybe = items.filter((i) => i.status !== 'stopped' && !confirmed.includes(i));
    const stopped = items.filter((i) => i.status === 'stopped');
    const sum = (list) => round2(list.reduce((a, i) => a + i.yearly, 0));
    return {
      confirmed, maybe, stopped,
      yearly: sum(confirmed), monthly: round2(sum(confirmed) / 12), maybeYearly: sum(maybe),
    };
  }

  function savings(items, selectedIds) {
    const chosen = new Set(selectedIds);
    return round2(items.filter((i) => chosen.has(i.id) && i.status !== 'stopped').reduce((a, i) => a + i.yearly, 0));
  }

  /** Full pipeline: text in, results out. Keeps only the dominant currency if the file mixes several. */
  function analyze(text, opts) {
    const options = opts || {};
    const parsed = C.parseStatement(text, options);
    if (parsed.error) return { error: parsed.error, items: [], meta: parsed.meta, warnings: [], summary: summarize([]) };
    const warnings = [...parsed.warnings];
    let txs = parsed.transactions;
    const withCur = txs.filter((t) => t.currency);
    if (withCur.length) {
      const tally = {};
      withCur.forEach((t) => { tally[t.currency] = (tally[t.currency] || 0) + 1; });
      const top = Object.keys(tally).sort((a, b) => tally[b] - tally[a])[0];
      const others = withCur.length - tally[top];
      if (others > 0) warnings.push(`${others} rows in other currencies were left out. Showing ${top} only.`);
      txs = txs.filter((t) => !t.currency || t.currency === top);
    }
    const result = detectRecurring(txs, { known: options.known, matcher: options.matcher, asOf: options.asOf });
    const merged = result.stats.duplicatesMerged;
    if (merged) warnings.push(`${merged} duplicate or pending row${merged === 1 ? '' : 's'} merged.`);
    return { error: null, meta: parsed.meta, warnings, items: result.items, stats: result.stats, summary: summarize(result.items) };
  }

  Object.assign(C, { detectRecurring, summarize, savings, analyze, testCadence, addMonths, nextAfter, toDay, fromDay });
  if (typeof module !== 'undefined' && module.exports) module.exports = C;
})(typeof window !== 'undefined' ? window : globalThis);
