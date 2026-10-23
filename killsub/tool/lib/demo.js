/* CANCEL: synthetic DEMO statement. Every row is made up. No real account, card or person. */
(function (g) {
  'use strict';
  const C = (g.Cancel = g.Cancel || {});

  const MONTHS_BACK = 14;
  const pad = (n) => String(n).padStart(2, '0');

  function rng(seed) {
    let a = seed;
    return () => {
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  const monthDate = (endIso, monthsBack, day) => {
    const y = +endIso.slice(0, 4);
    const m = +endIso.slice(5, 7);
    const base = new Date(Date.UTC(y, m - 1 - monthsBack, 1));
    const last = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth() + 1, 0)).getUTCDate();
    return `${base.getUTCFullYear()}-${pad(base.getUTCMonth() + 1)}-${pad(Math.min(day, last))}`;
  };
  const addDays = (iso, n) => new Date(Date.parse(`${iso}T00:00:00Z`) + n * 86400000).toISOString().slice(0, 10);

  // id, descriptor, day of month, price steps counted in months back [monthsBackFrom, amount], first month back, last month back
  const DEMO_SUBS = [
    { d: 'NETFLIX.COM', day: 3, from: 13, to: 0, prices: [[13, 15.49], [6, 17.99]] },
    { d: 'SPOTIFY USA', day: 7, from: 13, to: 0, prices: [[13, 11.99]] },
    { d: 'OPENAI *CHATGPT SUBSCR', day: 11, from: 13, to: 0, prices: [[13, 20.0]] },
    { d: 'CLAUDE.AI SUBSCRIPTION', day: 14, from: 10, to: 0, prices: [[10, 20.0]] },
    { d: 'ADOBE *CREATIVE CLOUD', day: 18, from: 13, to: 0, prices: [[13, 22.99]] },
    { d: 'PLANET FITNESS CLUB 0412', day: 20, from: 13, to: 0, prices: [[13, 29.99]] },
    { d: 'AUDIBLE*MEMBERSHIP', day: 22, from: 13, to: 0, prices: [[13, 14.95]] },
    { d: 'APPLE.COM/BILL', day: 25, from: 13, to: 0, prices: [[13, 2.99]] },
    { d: 'HULU', day: 9, from: 13, to: 7, prices: [[13, 17.99]] }, // cancelled months ago
  ];

  function demoRows(endIso) {
    const rand = rng(7);
    const rows = [];
    const add = (date, desc, amount) => { if (date <= endIso) rows.push({ date, desc, amount }); };
    DEMO_SUBS.forEach((s) => {
      for (let mb = s.from; mb >= s.to; mb--) {
        const price = s.prices.filter((p) => p[0] >= mb).pop()[1];
        add(monthDate(endIso, mb, s.day), s.d, -price);
      }
    });
    // free trial that turned into a paid plan
    add(monthDate(endIso, 4, 6), 'CAPCUT SUBSCRIPTION', -0.99);
    for (let mb = 3; mb >= 0; mb--) add(monthDate(endIso, mb, 13), 'CAPCUT SUBSCRIPTION', -9.99);
    // an annual charge that only shows up once
    add(monthDate(endIso, 8, 12), 'CANVA* ANNUAL PLAN', -99.99);
    // pending + posted pair for the latest Spotify charge
    const lastSpotify = rows.filter((r) => r.desc === 'SPOTIFY USA').pop();
    if (lastSpotify) add(addDays(lastSpotify.date, -1), 'SPOTIFY USA PENDING', lastSpotify.amount);
    // refunded one-off
    add(monthDate(endIso, 5, 3), 'SKILLSHARE.COM', -99);
    add(monthDate(endIso, 5, 9), 'SKILLSHARE.COM REFUND', 99);
    // everyday noise and income
    for (let mb = MONTHS_BACK; mb >= 0; mb--) {
      add(monthDate(endIso, mb, 1), 'RENT PAYMENT DEMO APARTMENTS', -1450);
      add(monthDate(endIso, mb, 15), 'DEMO CORP PAYROLL', 3400.5);
    }
    const start = monthDate(endIso, MONTHS_BACK, 1);
    for (let d = start; d <= endIso; d = addDays(d, 1)) {
      const r = rand();
      if (r < 0.16) add(d, 'GROCERY MARKET DEMO #' + (100 + Math.floor(rand() * 9)), -Math.round((18 + rand() * 90) * 100) / 100);
      else if (r < 0.27) add(d, 'COFFEE BAR DEMO', -Math.round((3.5 + rand() * 4) * 100) / 100);
      else if (r < 0.33) add(d, 'RIDE SHARE DEMO TRIP', -Math.round((8 + rand() * 25) * 100) / 100);
    }
    return rows.filter((r) => r.date >= start).sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  }

  /** CSV text of a fake statement ending on endIso (YYYY-MM-DD). */
  function makeDemoCSV(endIso) {
    let balance = 6200;
    const lines = ['Date,Description,Amount,Balance'];
    demoRows(endIso).forEach((r) => {
      balance += r.amount;
      lines.push(`${r.date},"${r.desc}",${r.amount.toFixed(2)},${balance.toFixed(2)}`);
    });
    return `${lines.join('\n')}\n`;
  }

  C.makeDemoCSV = makeDemoCSV;
  if (typeof module !== 'undefined' && module.exports) module.exports = C;
})(typeof window !== 'undefined' ? window : globalThis);
