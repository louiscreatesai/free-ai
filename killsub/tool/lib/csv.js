/* CANCEL: statement parsing. Plain module, works in the browser (window.Cancel) and in Node. */
(function (g) {
  'use strict';
  const C = (g.Cancel = g.Cancel || {});

  const MONTHS = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12 };

  // ---------- delimiter + raw CSV ----------

  function parseCSV(text, delimiter) {
    const d = delimiter || ',';
    const rows = [];
    let row = [];
    let field = '';
    let inQuotes = false;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (inQuotes) {
        if (ch === '"') {
          if (text[i + 1] === '"') { field += '"'; i++; } else { inQuotes = false; }
        } else {
          field += ch;
        }
      } else if (ch === '"' && field.trim() === '') {
        inQuotes = true;
        field = '';
      } else if (ch === d) {
        row.push(field); field = '';
      } else if (ch === '\n') {
        row.push(field); rows.push(row); row = []; field = '';
      } else if (ch !== '\r') {
        field += ch;
      }
    }
    if (field !== '' || row.length) { row.push(field); rows.push(row); }
    return rows
      .map((r) => r.map((c) => c.trim()))
      .filter((r) => r.some((c) => c !== ''));
  }

  function detectDelimiter(text) {
    const sample = text.slice(0, 6000);
    let best = ',';
    let bestScore = -1;
    for (const d of [',', ';', '\t', '|']) {
      const rows = parseCSV(sample, d).slice(0, 40);
      if (rows.length < 2) continue;
      const counts = new Map();
      rows.forEach((r) => counts.set(r.length, (counts.get(r.length) || 0) + 1));
      let modeLen = 0;
      let modeFreq = 0;
      counts.forEach((freq, len) => {
        if (freq > modeFreq || (freq === modeFreq && len > modeLen)) { modeFreq = freq; modeLen = len; }
      });
      if (modeLen < 2) continue;
      const score = (modeFreq / rows.length) * 1000 + modeLen;
      if (score > bestScore) { bestScore = score; best = d; }
    }
    return best;
  }

  // ---------- amounts ----------

  const CURRENCY_WORDS = /\b(USD|EUR|GBP|CAD|AUD|CHF|SEK|NOK|DKK|PLN|JPY|CR|DR)\b/gi;

  function parseAmount(raw) {
    if (raw === null || raw === undefined) return null;
    let s = String(raw).trim();
    if (!s) return null;
    let negative = false;
    if (/^\(.*\)$/.test(s)) { negative = true; s = s.slice(1, -1); }
    s = s.replace(CURRENCY_WORDS, '').replace(/[\s\u00a0'\u2019]/g, '').replace(/[$€£¥]/g, '').replace(/[\u2212\u2013]/g, '-');
    if (/-$/.test(s)) { negative = !negative; s = s.slice(0, -1); }
    if (/^-/.test(s)) { negative = !negative; s = s.slice(1); }
    s = s.replace(/^\+/, '');
    if (!/^[\d.,]+$/.test(s) || !/\d/.test(s)) return null;
    const lastDot = s.lastIndexOf('.');
    const lastComma = s.lastIndexOf(',');
    let decimal = null;
    if (lastDot > -1 && lastComma > -1) {
      decimal = lastDot > lastComma ? '.' : ',';
    } else if (lastDot > -1 || lastComma > -1) {
      const sep = lastDot > -1 ? '.' : ',';
      const occurrences = s.split(sep).length - 1;
      const digitsAfter = s.length - s.lastIndexOf(sep) - 1;
      if (occurrences === 1 && digitsAfter !== 3) decimal = sep;
    }
    let normalised = s;
    if (decimal) {
      const thousands = decimal === '.' ? /,/g : /\./g;
      normalised = s.replace(thousands, '').replace(decimal, '.');
    } else {
      normalised = s.replace(/[.,]/g, '');
    }
    if (!/^\d+(\.\d+)?$/.test(normalised)) return null;
    const value = parseFloat(normalised);
    return negative ? -value : value;
  }

  // ---------- dates ----------

  function validDate(y, m, d) {
    if (m < 1 || m > 12 || d < 1 || d > 31) return null;
    const t = new Date(Date.UTC(y, m - 1, d));
    if (t.getUTCFullYear() !== y || t.getUTCMonth() !== m - 1 || t.getUTCDate() !== d) return null;
    return `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  }

  const fullYear = (y) => (y < 100 ? 2000 + y : y);

  function numericDateParts(str) {
    const m = String(str).trim().match(/^(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{2}|\d{4})(?:[T\s,].*)?$/);
    if (!m) return null;
    return { a: +m[1], b: +m[2], y: fullYear(+m[3]), sep: str.trim().match(/[/.\-]/)[0] };
  }

  function parseDate(raw, order) {
    const s = String(raw || '').trim();
    if (!s) return null;
    let m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})(?:[T\s].*)?$/);
    if (m) return validDate(+m[1], +m[2], +m[3]);
    m = s.match(/^(\d{4})(\d{2})(\d{2})$/);
    if (m) return validDate(+m[1], +m[2], +m[3]);
    const p = numericDateParts(s);
    if (p) return (order === 'DMY') ? validDate(p.y, p.b, p.a) : validDate(p.y, p.a, p.b);
    m = s.match(/^(\d{1,2})[\s-]([A-Za-z]{3,9})\.?,?[\s-](\d{2,4})(?:[T\s,].*)?$/);
    if (m && MONTHS[m[2].slice(0, 3).toLowerCase()]) return validDate(fullYear(+m[3]), MONTHS[m[2].slice(0, 3).toLowerCase()], +m[1]);
    m = s.match(/^([A-Za-z]{3,9})\.?\s+(\d{1,2}),?\s+(\d{4})(?:[T\s,].*)?$/);
    if (m && MONTHS[m[1].slice(0, 3).toLowerCase()]) return validDate(+m[3], MONTHS[m[1].slice(0, 3).toLowerCase()], +m[2]);
    return null;
  }

  const looksLikeDate = (s) => parseDate(s, 'MDY') !== null || parseDate(s, 'DMY') !== null;

  function violations(values) {
    let up = 0;
    let down = 0;
    for (let i = 1; i < values.length; i++) {
      if (values[i] < values[i - 1]) up++;
      if (values[i] > values[i - 1]) down++;
    }
    return Math.min(up, down);
  }

  /** Decide MDY vs DMY from the data itself. Returns {order, reason}. */
  function detectDateOrder(strings, hintCurrency) {
    const parts = strings.map(numericDateParts).filter(Boolean);
    if (!parts.length) return { order: 'ISO', reason: 'no ambiguous dates' };
    const firstBig = parts.filter((p) => p.a > 12).length;
    const secondBig = parts.filter((p) => p.b > 12).length;
    if (firstBig > secondBig) return { order: 'DMY', reason: 'a day above 12 comes first' };
    if (secondBig > firstBig) return { order: 'MDY', reason: 'a day above 12 comes second' };
    if (firstBig === 0 && parts.every((p) => p.sep === '.')) return { order: 'DMY', reason: 'dots usually mean day.month.year' };
    const asKey = (order) => parts.map((p) => (order === 'DMY' ? p.y * 10000 + p.b * 100 + p.a : p.y * 10000 + p.a * 100 + p.b));
    const mdy = violations(asKey('MDY'));
    const dmy = violations(asKey('DMY'));
    if (dmy < mdy) return { order: 'DMY', reason: 'rows are in date order only as day/month' };
    if (mdy < dmy) return { order: 'MDY', reason: 'rows are in date order only as month/day' };
    if (hintCurrency === 'EUR' || hintCurrency === 'GBP') return { order: 'DMY', reason: 'ambiguous; EUR/GBP file so day first' };
    return { order: 'MDY', reason: 'ambiguous; assumed US month/day' };
  }

  // ---------- column mapping ----------

  const MIN_ROWS_FOR_VARIETY = 8;
  const norm = (h) => String(h || '').toLowerCase().replace(/\s+/g, ' ').trim();
  const DATE_PRIORITY = [
    /^(transaction|trans\.?) date$/, /^started date$/, /^date$/, /^(booking|buchungs)(date| date|tag)$/, /^buchungstag$/,
    /^posting date$/, /^completed date$/, /^post date$/, /^value date$/, /date|datum|fecha|^data$/,
  ];
  const AMOUNT_PRIORITY = [/^amount$/, /^(transaction )?amount( ?\(.*\))?$/, /^(betrag|montant|importe|bedrag)/, /^(value|sum)$/];
  const DEBIT_RE = /(^debit|withdraw|money out|paid out|outgoing|^soll|ausgabe|expense|charge)/;
  const CREDIT_RE = /(^credit$|^credit amount|deposit|money in|paid in|^haben|incoming|einnahme|income)/;
  const DESC_PRIMARY = /(^name$|merchant|payee|counterparty|empf[aä]nger|auftraggeber|beneficiary|^vendor$)/;
  const DESC_SECONDARY = [
    /(description|narrative|omschrijving|concepto|concept|libell|beschreibung|verwendungszweck|buchungstext)/,
    /(details|memo|reference|^note|^transaction$|text)/,
  ];
  const SKIP_AMOUNT = /(balance|saldo|fee|local|running)/;
  const HEADER_DATE = /date|datum|fecha|buchungstag|valuta/;
  const HEADER_AMOUNT = /amount|betrag|montant|importe|bedrag|debit|credit|money out|money in|withdraw|deposit|soll|haben/;

  function findHeaderIndex(rows) {
    const limit = Math.min(rows.length, 30);
    for (let i = 0; i < limit; i++) {
      const cells = rows[i].map(norm);
      if (cells.some((c) => HEADER_DATE.test(c)) && cells.some((c) => HEADER_AMOUNT.test(c))) return i;
    }
    const first = rows[0];
    const hasData = first.some((c) => looksLikeDate(c)) || first.some((c) => parseAmount(c) !== null && /\d[.,]\d{2}$/.test(c));
    return hasData ? -1 : 0;
  }

  function colRate(body, idx, test) {
    let ok = 0;
    let seen = 0;
    for (const r of body) {
      const v = r[idx];
      if (v === undefined || v === '') continue;
      seen++;
      if (test(v)) ok++;
    }
    return seen ? ok / seen : 0;
  }

  function pickByPriority(header, patterns, accept) {
    for (const re of patterns) {
      for (let i = 0; i < header.length; i++) {
        if (re.test(header[i]) && accept(i)) return i;
      }
    }
    return null;
  }

  function looksLikeDescription(body, idx) {
    const vals = body.map((r) => r[idx]).filter((v) => v);
    if (vals.length < 2) return false;
    if (colRate(body, idx, (v) => parseAmount(v) !== null || looksLikeDate(v)) > 0.5) return false;
    const distinct = new Set(vals.map((v) => v.toLowerCase())).size;
    // Short files can legitimately repeat one merchant. Longer files with 1-2 distinct values are codes like DEBIT/CREDIT.
    const variedEnough = vals.length < MIN_ROWS_FOR_VARIETY || distinct >= 3;
    return variedEnough && vals.reduce((a, v) => a + v.length, 0) / vals.length >= 3;
  }

  function mapByHeader(header, body) {
    const accept = (test) => (i) => colRate(body, i, test) >= 0.6;
    const date = pickByPriority(header, DATE_PRIORITY, accept(looksLikeDate));
    const isNum = (v) => parseAmount(v) !== null;
    const amount = pickByPriority(header, AMOUNT_PRIORITY, (i) => !SKIP_AMOUNT.test(header[i]) && colRate(body, i, isNum) >= 0.6);
    let debit = null;
    let credit = null;
    if (amount === null) {
      debit = header.findIndex((h, i) => DEBIT_RE.test(h) && !SKIP_AMOUNT.test(h) && colRate(body, i, isNum) >= 0.5);
      credit = header.findIndex((h, i) => CREDIT_RE.test(h) && !SKIP_AMOUNT.test(h) && colRate(body, i, isNum) >= 0.5);
      debit = debit < 0 ? null : debit;
      credit = credit < 0 ? null : credit;
    }
    const descOk = (i) => looksLikeDescription(body, i);
    const primary = pickByPriority(header, [DESC_PRIMARY], descOk);
    const secondaryPick = (skip) => {
      for (const re of DESC_SECONDARY) {
        for (let i = 0; i < header.length; i++) {
          if (i !== skip && re.test(header[i]) && descOk(i)) return i;
        }
      }
      return null;
    };
    const desc = primary !== null ? primary : secondaryPick(-1);
    const desc2 = secondaryPick(desc === null ? -1 : desc);
    const find = (re) => { const i = header.findIndex((h) => re.test(h)); return i < 0 ? null : i; };
    return {
      date, amount, debit, credit, desc, desc2: desc2 === desc ? null : desc2,
      currency: find(/^(currency|w[aä]hrung|devise|ccy)$/), state: find(/^(state|status)$/), type: find(/^(type|transaction type|art)$/),
      dateAlt: header.map((h, i) => (i !== date && HEADER_DATE.test(h) && colRate(body, i, looksLikeDate) >= 0.3 ? i : -1)).filter((i) => i >= 0),
    };
  }

  function mapByContent(body) {
    const width = Math.max(...body.map((r) => r.length));
    const stats = [];
    for (let i = 0; i < width; i++) {
      stats.push({
        i,
        date: colRate(body, i, looksLikeDate),
        num: colRate(body, i, (v) => parseAmount(v) !== null && !looksLikeDate(v)),
        fill: body.filter((r) => r[i]).length / body.length,
        len: body.reduce((a, r) => a + (r[i] ? r[i].length : 0), 0) / body.length,
      });
    }
    const dateCol = stats.find((s) => s.date >= 0.7);
    const nums = stats.filter((s) => s.num >= 0.5 && (!dateCol || s.i !== dateCol.i));
    let amount = null;
    let debit = null;
    let credit = null;
    if (nums.length >= 2 && nums[0].fill < 0.9 && nums[1].fill < 0.9 && nums[0].fill + nums[1].fill <= 1.15) {
      debit = nums[0].i; credit = nums[1].i;
    } else if (nums.length) {
      amount = nums[0].i;
    }
    const used = new Set([dateCol && dateCol.i, amount, debit, credit]);
    const texts = stats.filter((s) => !used.has(s.i) && s.num < 0.5 && s.date < 0.5 && looksLikeDescription(body, s.i)).sort((a, b) => b.len - a.len);
    return {
      date: dateCol ? dateCol.i : null, amount, debit, credit,
      desc: texts.length ? texts[0].i : null, desc2: texts.length > 1 ? texts[1].i : null,
      currency: null, state: null, type: null, dateAlt: [],
    };
  }

  // ---------- currency ----------

  const CURRENCY_CODES = new Set(['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'CHF', 'SEK', 'NOK', 'DKK', 'PLN', 'JPY']);

  function detectCurrency(rows, cols, headerText) {
    if (cols.currency !== null) {
      const tally = new Map();
      rows.forEach((r) => { const c = (r[cols.currency] || '').toUpperCase(); if (CURRENCY_CODES.has(c)) tally.set(c, (tally.get(c) || 0) + 1); });
      const top = [...tally.entries()].sort((a, b) => b[1] - a[1])[0];
      if (top) return top[0];
    }
    const cells = [cols.amount, cols.debit, cols.credit].filter((i) => i !== null);
    const sample = rows.slice(0, 60).map((r) => cells.map((i) => r[i] || '').join(' ')).join(' ');
    if (/€/.test(sample)) return 'EUR';
    if (/£/.test(sample)) return 'GBP';
    if (/\$/.test(sample)) return 'USD';
    const m = String(headerText || '').toUpperCase().match(/\b(USD|EUR|GBP)\b/);
    return m ? m[1] : null;
  }

  // ---------- statement ----------

  const BAD_STATE = /(revert|declin|fail|cancel|reject)/i;

  function decideSpendSign(values, flip) {
    let pos = 0;
    let neg = 0;
    values.forEach((v) => { if (v > 0) pos++; else if (v < 0) neg++; });
    let positiveIsSpend = neg === 0 ? pos > 0 : pos > neg;
    if (flip) positiveIsSpend = !positiveIsSpend;
    return positiveIsSpend;
  }

  function fail(error) {
    return { transactions: [], meta: {}, warnings: [], error };
  }

  function parseStatement(text, opts) {
    const options = opts || {};
    const clean = String(text || '').replace(/^﻿/, '');
    if (!clean.trim()) return fail('Nothing to read yet. Choose a file or paste some text.');
    const delimiter = options.delimiter || detectDelimiter(clean);
    const rows = parseCSV(clean, delimiter);
    if (rows.length < 2) return fail('That looks like a single line. I need one row per transaction.');
    const headerIdx = findHeaderIndex(rows);
    const header = headerIdx >= 0 ? rows[headerIdx].map(norm) : null;
    const body = rows.slice(headerIdx + 1);
    if (!body.length) return fail('I found column names but no transactions under them.');

    let cols = header ? mapByHeader(header, body) : mapByContent(body);
    const incomplete = (c) => c.date === null || (c.amount === null && c.debit === null && c.credit === null) || c.desc === null;
    if (incomplete(cols)) cols = mapByContent(body);
    if (incomplete(cols)) {
      return fail('I could not find a date, an amount and a description column. Check that the file is a transaction export.');
    }

    const dateCells = body.map((r) => r[cols.date]).filter(Boolean);
    const provisionalCurrency = detectCurrency(body, cols, header ? header.join(' ') : '');
    const detected = options.dateOrder ? { order: options.dateOrder, reason: 'chosen by you' } : detectDateOrder(dateCells, provisionalCurrency);
    const order = detected.order === 'ISO' ? 'MDY' : detected.order;

    const warnings = [];
    let skipped = 0;
    const raw = [];
    for (const r of body) {
      let date = parseDate(r[cols.date], order);
      for (let k = 0; !date && k < cols.dateAlt.length; k++) date = parseDate(r[cols.dateAlt[k]], order);
      const state = cols.state !== null ? r[cols.state] || '' : '';
      if (BAD_STATE.test(state)) { skipped++; continue; }
      let amount = null;
      let split = false;
      if (cols.amount !== null) {
        amount = parseAmount(r[cols.amount]);
      } else {
        const d = cols.debit !== null ? parseAmount(r[cols.debit]) : null;
        const c = cols.credit !== null ? parseAmount(r[cols.credit]) : null;
        split = true;
        if (d !== null && d !== 0) amount = -Math.abs(d);
        else if (c !== null && c !== 0) amount = Math.abs(c);
      }
      if (!date || amount === null) { skipped++; continue; }
      const desc = r[cols.desc] || '';
      const desc2 = cols.desc2 !== null ? r[cols.desc2] || '' : '';
      raw.push({
        date, amount, split, desc, desc2,
        currency: cols.currency !== null ? (r[cols.currency] || '').toUpperCase() : '',
        pending: /pending/i.test(state) || /\bpending\b/i.test(desc),
        type: cols.type !== null ? r[cols.type] || '' : '',
      });
    }
    if (!raw.length) return fail('I could read the columns but none of the rows had both a valid date and amount.');

    let positiveIsSpend = false;
    if (cols.amount !== null) positiveIsSpend = decideSpendSign(raw.map((t) => t.amount), options.flipSign);
    else if (options.flipSign) positiveIsSpend = true;
    const transactions = raw
      .map((t) => ({
        date: t.date,
        amount: positiveIsSpend ? -t.amount : t.amount,
        desc: t.desc, desc2: t.desc2, currency: t.currency, pending: t.pending, type: t.type,
      }))
      .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));

    if (skipped) warnings.push(`${skipped} row${skipped === 1 ? '' : 's'} skipped (no valid date or amount, or declined/reverted).`);
    const currency = detectCurrency(body, cols, header ? header.join(' ') : '');
    const names = (i) => (i === null || i === undefined ? null : (header ? header[i] : `column ${i + 1}`));
    return {
      transactions,
      warnings,
      error: null,
      meta: {
        delimiter, hasHeader: headerIdx >= 0, headerRow: headerIdx, dateOrder: detected.order, dateReason: detected.reason,
        currency, positiveIsSpend, rowCount: raw.length, skipped,
        columns: { date: names(cols.date), amount: names(cols.amount), debit: names(cols.debit), credit: names(cols.credit), description: names(cols.desc) },
      },
    };
  }

  Object.assign(C, { parseCSV, detectDelimiter, parseAmount, parseDate, detectDateOrder, parseStatement, looksLikeDate });
  if (typeof module !== 'undefined' && module.exports) module.exports = C;
})(typeof window !== 'undefined' ? window : globalThis);
