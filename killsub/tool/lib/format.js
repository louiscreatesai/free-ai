/* CANCEL: small display helpers shared by the page and the share card. */
(function (g) {
  'use strict';
  const C = (g.Cancel = g.Cancel || {});

  const SYMBOLS = { USD: '$', EUR: '€', GBP: '£' };
  const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  function money(amount, currency, withCents) {
    const sym = SYMBOLS[currency] || SYMBOLS.USD;
    const digits = withCents ? 2 : 0;
    const value = Math.abs(amount);
    const text = value.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits });
    return `${amount < 0 ? '-' : ''}${sym}${text}`;
  }

  function shortDate(iso, includeYear) {
    const m = +iso.slice(5, 7);
    const d = +iso.slice(8, 10);
    return `${MONTH_NAMES[m - 1]} ${d}${includeYear ? `, ${iso.slice(0, 4)}` : ''}`;
  }

  const CADENCE_TEXT = { weekly: 'every week', monthly: 'every month', quarterly: 'every 3 months', yearly: 'every year' };
  const cadenceText = (c) => CADENCE_TEXT[c] || c;

  function flagText(flag, currency, includeYear) {
    const m = (n) => money(n, currency, true);
    switch (flag.type) {
      case 'priceUp': return `Price went up: ${m(flag.from)} to ${m(flag.to)}`;
      case 'priceDown': return `Price went down: ${m(flag.from)} to ${m(flag.to)}`;
      case 'trial': return `A ${m(flag.amount)} trial turned into a paid plan`;
      case 'yearlyOnce': return 'Yearly? Only one charge seen';
      case 'monthlyOnce': return 'Seen once. Your file is short, so probably monthly';
      case 'gaps': return `Skipped ${flag.count === 1 ? 'a charge' : `${flag.count} charges`} in your file`;
      case 'weeklyUnknown': return 'Weekly at an unfamiliar merchant. Could be a habit, not a plan';
      case 'stopped': return `Last charged ${shortDate(flag.lastDate, includeYear)}. May already be cancelled`;
      default: return '';
    }
  }

  C.fmt = { money, shortDate, cadenceText, flagText, SYMBOLS };
  if (typeof module !== 'undefined' && module.exports) module.exports = C;
})(typeof window !== 'undefined' ? window : globalThis);
