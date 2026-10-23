/* CANCEL: merchant-name cleanup and known-service matching. */
(function (g) {
  'use strict';
  const C = (g.Cancel = g.Cancel || {});

  const US_STATES = new Set('al ak az ar ca co ct de dc fl ga hi id il in ia ks ky la me md ma mi mn ms mo mt ne nv nh nj nm ny nc nd oh ok or pa ri sc sd tn tx ut vt va wa wv wi wy'.split(' '));
  // State codes that are also everyday words (in, or, me...) are only dropped from longer names.
  const WORDLIKE_STATES = new Set(['in', 'or', 'me', 'de', 'hi', 'ok', 'id', 'la', 'al', 'pa', 'ma', 'co', 'oh']);
  const COUNTRIES = new Set('us usa gb uk ie de nl ca au fr es it lu se dk no fi pt at ch be'.split(' '));
  const LEGAL = new Set('llc inc ltd corp co gmbh bv plc limited sarl sas ab ag pte lp llp'.split(' '));
  const NOISE = new Set(['pending', 'recurring', 'autopay', 'pos', 'visa', 'www', 'debit', 'purchase']);

  const LEADING_PHRASES = [
    /^purchase authorized on \d{1,2}\/\d{1,2}\s*/,
    /^recurring payment authorized on \d{1,2}\/\d{1,2}\s*/,
    /^(debit card purchase|card purchase|checkcard|pos debit|pos purchase|ach debit|ach withdrawal|preauthorized debit|direct debit|standing order|card payment to|payment to|kartenzahlung|lastschrift)\s*[-:]?\s*/,
  ];
  const STAR_PREFIX = /^(paypal|pp|sq|tst|gglpay|sumup|zettle|izettle|stripe)\s*\*\s*/;

  // Reference ids like "1a2b3c4d" flip between digits and letters many times; real names rarely do.
  function digitLetterSwitches(token) {
    let switches = 0;
    for (let i = 1; i < token.length; i++) {
      if (/\d/.test(token[i]) !== /\d/.test(token[i - 1])) switches++;
    }
    return switches;
  }

  /** Strip card numbers, dates, store numbers and city/state tails from a bank description. */
  function normalizeMerchant(desc) {
    let s = String(desc || '').toLowerCase().replace(/[ \t]/g, ' ').trim();
    for (const re of LEADING_PHRASES) s = s.replace(re, '');
    s = s.replace(STAR_PREFIX, '').replace(/^sp\s+(?=\S)/, '');
    s = s.replace(/#\s*\d+/g, ' ').replace(/\*/g, ' ');
    s = s.replace(/\b([a-z0-9-]+)\.(com|net|org|io|co\.uk|co|ai|tv|app|de|nl|ie|fr|es|it|us|uk)\b/g, '$1');
    s = s.replace(/\b\d{1,2}[/.-]\d{1,2}([/.-]\d{2,4})?\b/g, ' ');
    s = s.replace(/\+?\d[\d\s().-]{7,}\d/g, ' ');
    s = s.replace(/[^\p{L}\p{N}& ]+/gu, ' ');
    let tokens = s.split(/\s+/).filter(Boolean).filter((t) => {
      if (NOISE.has(t)) return false;
      if (/^\d{3,}$/.test(t)) return false;
      if (/^x+\d+$/.test(t)) return false;
      if (t.length >= 5 && digitLetterSwitches(t) >= 3) return false;
      return true;
    });
    for (let guard = 0; guard < 4 && tokens.length > 1; guard++) {
      const last = tokens[tokens.length - 1];
      const minTokens = WORDLIKE_STATES.has(last) ? 3 : 2;
      const strippable = COUNTRIES.has(last) || LEGAL.has(last) || (US_STATES.has(last) && tokens.length >= minTokens);
      if (!strippable) break;
      tokens = tokens.slice(0, -1);
    }
    return tokens.join(' ');
  }

  const squash = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9+]/g, '');
  const spaced = (s) => ` ${String(s || '').toLowerCase().replace(/[^a-z0-9+]+/g, ' ').trim()} `;

  function buildMatcher(knownList) {
    const entries = [];
    knownList.forEach((k) => {
      (k.m || []).forEach((pattern) => entries.push({ k, p: squash(pattern), wordy: Boolean(k.w), spacedP: ` ${pattern.toLowerCase().replace(/[^a-z0-9+]+/g, ' ').trim()} ` }));
    });
    entries.sort((a, b) => b.p.length - a.p.length);
    return function match(...texts) {
      const joined = texts.filter(Boolean).join(' ');
      if (!joined) return null;
      const sq = squash(joined);
      const sp = spaced(joined);
      for (const e of entries) {
        if (!e.p) continue;
        if (e.wordy ? sp.includes(e.spacedP) : sq.includes(e.p)) return e.k;
      }
      return null;
    };
  }

  // Things that recur but are not subscriptions you can cancel.
  const NON_SUB = /\b(rent|mortgage|payroll|salary|wages|direct dep(osit)?|dir dep|transfer|trf|xfer|zelle|venmo|cash app|loan|interest|atm|cash withdrawal|overdraft|tax|irs|hmrc|credit card payment|payment thank you|bill pay|standing order|dividend|refund|reversal|top ?up|exchange)\b/i;
  // Frequent everyday spending that can look "weekly" but is not a subscription.
  const EVERYDAY = /\b(starbucks|dunkin|mcdonald'?s?|burger king|wendy'?s?|chipotle|subway|taco bell|chick fil a|domino'?s?|pizza|walmart|target|kroger|safeway|trader joe'?s?|whole foods|aldi|lidl|tesco|sainsbury'?s?|asda|costco|shell|exxon|chevron|bp|mobil|texaco|7 eleven|cvs|walgreens|uber|lyft|doordash|grubhub|amzn mktp|amazon mktp|amazon|ebay|etsy|greggs|pret|tfl|deliveroo|just eat|rewe|edeka|carrefour|albert heijn|supermarket|grocery|cafe|coffee|restaurant|bar|pub|taxi)\b/i;

  C.normalizeMerchant = normalizeMerchant;
  C.buildMatcher = buildMatcher;
  C.NON_SUB = NON_SUB;
  C.EVERYDAY = EVERYDAY;
  if (typeof module !== 'undefined' && module.exports) module.exports = C;
})(typeof window !== 'undefined' ? window : globalThis);
