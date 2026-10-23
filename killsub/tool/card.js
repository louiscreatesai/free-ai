/* CANCEL: draws the shareable result card on a canvas. No network, no external fonts. */
(function (g) {
  'use strict';
  const C = (g.Cancel = g.Cancel || {});

  const W = 1080;
  const H = 1350;
  const FONT = 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
  const HANDLE = '@louiscreates.ai';
  const MAX_NAMES = 6;

  function fitFont(ctx, text, maxWidth, startPx, weight) {
    let px = startPx;
    for (; px > 40; px -= 6) {
      ctx.font = `${weight} ${px}px ${FONT}`;
      if (ctx.measureText(text).width <= maxWidth) break;
    }
    return px;
  }

  function clip(ctx, text, maxWidth) {
    if (ctx.measureText(text).width <= maxWidth) return text;
    let t = text;
    while (t.length > 1 && ctx.measureText(`${t}...`).width > maxWidth) t = t.slice(0, -1);
    return `${t}...`;
  }

  /**
   * data: { yearly, currency, saved, names: [{name, yearly}] | null, count, isDemo }
   */
  function drawCard(canvas, data) {
    const ctx = canvas.getContext('2d');
    const money = (n) => C.fmt.money(n, data.currency, false);
    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#0a0b0e');
    bg.addColorStop(1, '#1d0c09');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);
    const glow = ctx.createRadialGradient(W / 2, 560, 40, W / 2, 560, 620);
    glow.addColorStop(0, 'rgba(255,83,64,0.35)');
    glow.addColorStop(1, 'rgba(255,83,64,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, W, H);

    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = '#f4f5f7';
    ctx.font = `900 40px ${FONT}`;
    ctx.fillText('C A N C E L', W / 2, 120);
    if (data.isDemo) {
      ctx.fillStyle = '#fbbf24';
      ctx.fillRect(W - 300, 70, 240, 60);
      ctx.fillStyle = '#231a00';
      ctx.font = `900 30px ${FONT}`;
      ctx.fillText('DEMO DATA', W - 180, 111);
    }

    ctx.fillStyle = '#9ba2ae';
    ctx.font = `700 54px ${FONT}`;
    ctx.fillText('I pay', W / 2, 330);

    const numText = money(data.yearly);
    const px = fitFont(ctx, numText, 900, 300, 900);
    const numGrad = ctx.createLinearGradient(0, 380, 0, 380 + px);
    numGrad.addColorStop(0, '#ffffff');
    numGrad.addColorStop(0.5, '#ff9a3c');
    numGrad.addColorStop(1, '#ff5340');
    ctx.fillStyle = numGrad;
    ctx.font = `900 ${px}px ${FONT}`;
    const numY = 330 + 40 + px * 0.82;
    ctx.fillText(numText, W / 2, numY);

    ctx.fillStyle = '#f4f5f7';
    ctx.font = `800 58px ${FONT}`;
    ctx.fillText('a year for things', W / 2, numY + 120);
    ctx.fillText('I forgot about', W / 2, numY + 190);

    let y = numY + 280;
    if (data.saved > 0) {
      ctx.fillStyle = '#34d399';
      ctx.font = `800 46px ${FONT}`;
      ctx.fillText(`Killing my picks saves ${money(data.saved)} a year`, W / 2, y);
      y += 70;
    }

    if (data.names && data.names.length) {
      ctx.textAlign = 'left';
      data.names.slice(0, MAX_NAMES).forEach((row, i) => {
        const rowY = y + 30 + i * 62;
        if (rowY > H - 150) return;
        ctx.fillStyle = '#f4f5f7';
        ctx.font = `700 40px ${FONT}`;
        ctx.fillText(clip(ctx, row.name, 600), 120, rowY);
        ctx.textAlign = 'right';
        ctx.fillStyle = '#ff9a3c';
        ctx.fillText(`${money(row.yearly)}/yr`, W - 120, rowY);
        ctx.textAlign = 'left';
      });
      ctx.textAlign = 'center';
    } else {
      ctx.fillStyle = '#9ba2ae';
      ctx.font = `600 40px ${FONT}`;
      const n = data.count || 0;
      ctx.fillText(`${n} charge${n === 1 ? '' : 's'} renewing on their own`, W / 2, Math.min(y + 20, H - 170));
    }

    ctx.textAlign = 'center';
    ctx.fillStyle = '#9ba2ae';
    ctx.font = `600 34px ${FONT}`;
    ctx.fillText(HANDLE, W / 2, H - 70);
  }

  C.drawCard = drawCard;
  C.HANDLE = HANDLE;
  if (typeof module !== 'undefined' && module.exports) module.exports = C;
})(typeof window !== 'undefined' ? window : globalThis);
