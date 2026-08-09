/**
 * ThermalDoc → 384-px-wide 1-bit dithered bitmap.
 *
 * Design rewrite: the previous version relied on SVG <foreignObject> to
 * rasterize arbitrary HTML in a hidden WebView. That approach turned out to
 * be flaky on real Android WebViews (Huawei, LG etc. return "SVG image load
 * failed"). We now paint the receipt DIRECTLY on a Canvas 2D context, one
 * op at a time. No SVG, no HTML parsing — just deterministic drawing.
 *
 *   • A single hidden <WebView> is mounted at the app root via
 *     <HtmlRasterizerHost />. It hosts a bootstrap page that owns a <canvas>.
 *   • Native RN calls `rasterizeThermalDoc(doc, opts)` → the JSON payload is
 *     injected via `injectJavaScript`, the WebView paints the ops, dithers
 *     to 1-bit rows and posts the base64 rows back.
 */
import type { MonoBitmap } from './catPrinter';
import type { ThermalDoc } from './thermalDoc';

export interface RasterizeOptions {
  /** Target width in pixels. PD01/GT01 = 384. */
  width?: number;
  /** 1..5 darkness (shifts luminance before dithering). */
  darkness?: number;
  /** Max ms to wait for the WebView to respond. */
  timeoutMs?: number;
}

type PendingReq = {
  resolve: (b: MonoBitmap) => void;
  reject: (e: Error) => void;
  timer: any;
};

/* -------------------------------------------------------------------------- */
/*                Module-level bridge (host writes/reads these)               */
/* -------------------------------------------------------------------------- */

let _hostReady = false;
let _injectJs: ((js: string) => void) | null = null;
const _pending = new Map<string, PendingReq>();

/** Called by the RN host component whenever the WebView is mounted/unmounted. */
export function _registerRasterizerHost(injectJs: ((js: string) => void) | null): void {
  _injectJs = injectJs;
  _hostReady = !!injectJs;
  if (!injectJs) {
    _pending.forEach((p) => {
      clearTimeout(p.timer);
      p.reject(new Error('Rasterizer host unmounted'));
    });
    _pending.clear();
  }
}

/** Called by the RN host on every message coming out of the WebView. */
export function _onRasterizerMessage(raw: string): void {
  let payload: any;
  try { payload = JSON.parse(raw); } catch { return; }
  const { id } = payload || {};
  if (!id || !_pending.has(id)) return;
  const p = _pending.get(id)!;
  _pending.delete(id);
  clearTimeout(p.timer);
  if (payload.ok) {
    p.resolve({
      width: payload.width,
      height: payload.height,
      rowsBase64: payload.rowsBase64,
    });
  } else {
    p.reject(new Error(payload.error || 'Rasterizer failed'));
  }
}

export function isRasterizerReady(): boolean {
  return _hostReady && _injectJs != null;
}

/** Rasterize a ThermalDoc → mono bitmap. */
export function rasterizeThermalDoc(doc: ThermalDoc, opts: RasterizeOptions = {}): Promise<MonoBitmap> {
  const width = opts.width ?? 384;
  const darkness = Math.max(1, Math.min(5, Math.round(opts.darkness ?? 3)));
  const timeoutMs = opts.timeoutMs ?? 25000;

  if (!_injectJs) return Promise.reject(new Error('Rasterizer host not mounted'));

  const id = `r_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
  const p = new Promise<MonoBitmap>((resolve, reject) => {
    const timer = setTimeout(() => {
      if (_pending.has(id)) {
        _pending.delete(id);
        reject(new Error('Rasterizer timed out'));
      }
    }, timeoutMs);
    _pending.set(id, { resolve, reject, timer });
  });

  const payload = JSON.stringify({ id, doc, width, darkness });
  const js = `window.__rasterizeDoc__(${JSON.stringify(payload)}); true;`;
  try {
    _injectJs(js);
  } catch (e: any) {
    _pending.delete(id);
    return Promise.reject(new Error('Failed to inject rasterizer request: ' + (e?.message || e)));
  }
  return p;
}

/**
 * @deprecated — kept only so old imports don't break. Immediately rejects.
 * New callers should build a ThermalDoc and use rasterizeThermalDoc.
 */
export function rasterizeHtml(_html: string, _opts: RasterizeOptions = {}): Promise<MonoBitmap> {
  return Promise.reject(new Error('HTML rasterization is deprecated — use rasterizeThermalDoc'));
}
/* -------------------------------------------------------------------------- */
/*                    Bootstrap HTML for the hidden WebView                   */
/* -------------------------------------------------------------------------- */

export function getRasterizerHostHtml(): string {
  return `<!DOCTYPE html>
<html><head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<style> html, body { margin:0; padding:0; background:#fff; } canvas { display:none; } </style>
</head>
<body>
<canvas id="cv"></canvas>
<script>
(function () {
  function send(obj) {
    try {
      if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
        window.ReactNativeWebView.postMessage(JSON.stringify(obj));
      }
    } catch (e) {}
  }

  /* ---------------- Text helpers ---------------- */

  function measureText(ctx, text, font) {
    ctx.font = font;
    return ctx.measureText(text).width;
  }

  function fontFor(size, bold, family) {
    var fam = (family === 'mono')
      ? '"Courier New", "Menlo", monospace'
      : 'Arial, "Arial Black", sans-serif';
    return (bold ? 'bold ' : '') + size + 'px ' + fam;
  }

  // Draw a string with per-character letter spacing.
  function drawSpacedText(ctx, text, x, y, letterSpacing) {
    if (!letterSpacing || letterSpacing <= 0) {
      ctx.fillText(text, x, y);
      return ctx.measureText(text).width;
    }
    var cx = x;
    for (var i = 0; i < text.length; i++) {
      var ch = text.charAt(i);
      ctx.fillText(ch, cx, y);
      cx += ctx.measureText(ch).width + letterSpacing;
    }
    return cx - x - letterSpacing; // total width without trailing gap
  }

  function measureSpacedText(ctx, text, letterSpacing) {
    if (!letterSpacing || letterSpacing <= 0) return ctx.measureText(text).width;
    var w = 0;
    for (var i = 0; i < text.length; i++) {
      w += ctx.measureText(text.charAt(i)).width;
    }
    return w + Math.max(0, (text.length - 1)) * letterSpacing;
  }

  // Greedy word-wrap. Returns array of lines that each fit within maxWidth.
  function wrapLines(ctx, text, font, maxWidth) {
    ctx.font = font;
    if (!text) return [''];
    var paragraphs = String(text).split(/\\r?\\n/);
    var out = [];
    for (var p = 0; p < paragraphs.length; p++) {
      var words = paragraphs[p].split(/\\s+/).filter(Boolean);
      if (!words.length) { out.push(''); continue; }
      var line = words[0];
      for (var i = 1; i < words.length; i++) {
        var w = words[i];
        var test = line + ' ' + w;
        if (ctx.measureText(test).width <= maxWidth) {
          line = test;
        } else {
          out.push(line);
          line = w;
        }
      }
      out.push(line);
    }
    return out;
  }

  function drawTextLine(ctx, text, x, y, size, align, maxWidth) {
    ctx.textBaseline = 'top';
    var w = ctx.measureText(text).width;
    var drawX = x;
    if (align === 'center') drawX = x + (maxWidth - w) / 2;
    else if (align === 'right') drawX = x + (maxWidth - w);
    ctx.fillText(text, drawX, y);
  }

  /* ---------------- Op sizing (pass 1) ---------------- */

  var MARGIN = 8;               // horizontal margin in px
  var LINE_GAP = 2;

  // Load one image (data URI) as HTMLImageElement.
  function loadImage(uri) {
    return new Promise(function (resolve) {
      var img = new Image();
      img.onload = function () { resolve(img); };
      img.onerror = function () { resolve(null); };
      img.src = uri;
      // Safety: if it never fires, resolve after 4s
      setTimeout(function () { resolve(null); }, 4000);
    });
  }

  // Preload all images referenced in ops so we know their dimensions before
  // computing total height.
  function preloadImages(ops) {
    var jobs = [];
    for (var i = 0; i < ops.length; i++) {
      if (ops[i] && ops[i].t === 'image' && ops[i].dataUri) {
        (function (op) {
          jobs.push(loadImage(op.dataUri).then(function (im) { op.__img = im; }));
        })(ops[i]);
      }
    }
    return Promise.all(jobs);
  }

  // Compute the y-height each op needs. Also stores the op's cached wrapped
  // lines so pass 2 doesn't recompute.
  function measureOps(ctx, ops, width) {
    var innerW = width - MARGIN * 2;
    var total = 0;
    for (var i = 0; i < ops.length; i++) {
      var op = ops[i];
      var h = 0;
      switch (op.t) {
        case 'text': {
          var size = op.size || 22;
          var font = fontFor(size, !!op.bold, op.family);
          op.__size = size;
          op.__font = font;
          if (op.letterSpacing && op.letterSpacing > 0) {
            op.__lines = [op.text || ''];
          } else {
            op.__lines = wrapLines(ctx, op.text || '', font, innerW);
          }
          var extraUnderline = op.underline && op.underline !== 'none' ? 8 : 0;
          h = op.__lines.length * (size + LINE_GAP) + extraUnderline;
          break;
        }
        case 'wrap': {
          var size2 = op.size || 20;
          var font2 = fontFor(size2, !!op.bold, op.family);
          var lines2 = wrapLines(ctx, op.text || '', font2, innerW);
          op.__lines = lines2;
          op.__size = size2;
          op.__font = font2;
          h = lines2.length * (size2 + LINE_GAP);
          break;
        }
        case 'row': {
          var size3 = op.size || 22;
          var font3 = fontFor(size3, !!op.bold, op.family);
          op.__font = font3;
          op.__size = size3;
          h = size3 + LINE_GAP;
          break;
        }
        case 'band': {
          var sizeB = op.size || 24;
          var fontB = fontFor(sizeB, op.bold === false ? false : true, op.family);
          op.__font = fontB;
          op.__size = sizeB;
          h = sizeB + 14;
          break;
        }
        case 'header': {
          var sizeH = op.size || 24;
          op.__size = sizeH;
          op.__font = fontFor(sizeH, true, op.family);
          h = sizeH + 14;
          break;
        }
        case 'divider': {
          h = 8 + (op.thick || 0);
          break;
        }
        case 'space': {
          h = Math.max(0, op.h || 8);
          break;
        }
        case 'checkbox': {
          var sizeC = op.size || 18;
          op.__size = sizeC;
          op.__font = fontFor(sizeC, true, op.family);
          h = Math.max(24, sizeC) + 6;
          break;
        }
        case 'boxed_text': {
          var sizeBx = op.size || 20;
          op.__size = sizeBx;
          op.__font = fontFor(sizeBx, true);
          var padYBx = op.padY == null ? 6 : op.padY;
          h = sizeBx + padYBx * 2 + 4;
          break;
        }
        case 'image': {
          var img = op.__img;
          if (!img) { h = 0; break; }
          var maxW = Math.min(innerW, op.maxWidth || innerW);
          var iw = img.width, ih = img.height;
          var scale = maxW / iw;
          if (scale > 1) scale = 1;
          op.__drawW = Math.round(iw * scale);
          op.__drawH = Math.round(ih * scale);
          h = op.__drawH + 4;
          break;
        }
        default:
          h = 0;
      }
      op.__h = h;
      total += h;
    }
    return total + MARGIN * 2;
  }
  /* ---------------- Draw ops (pass 2) ---------------- */
   /* ---------------- Draw ops (pass 2) ---------------- */

  function drawOps(ctx, ops, width) {
    var innerW = width - MARGIN * 2;
    var y = MARGIN + 12; // Extra head breathing space inside inner card border

    for (var i = 0; i < ops.length; i++) {
      var op = ops[i];
      if (!op) continue;

      switch (op.t) {
        case 'header': {
          ctx.fillStyle = '#000000';
          // Force heavy enterprise uppercase display style globally
          var headText = String(op.text || '').toUpperCase();
          var hSize = op.size || 24;
          ctx.font = 'black ' + hSize + 'px "Arial Black", sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'top';
          ctx.fillText(headText, width / 2, y);
          y += hSize + 12;
          break;
        }

        case 'boxed_text': {
          ctx.fillStyle = '#000000';
          var boxText = String(op.text || '').toUpperCase();
          var bSize = op.size || 20;
          ctx.font = 'bold ' + bSize + 'px Arial, sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'top';

          var txtW = ctx.measureText(boxText).width;
          var rW = Math.min(innerW, txtW + 24);
          var rX = MARGIN + (innerW - rW) / 2;
          var rH = bSize + 12;

          // Draw the high-contrast boxed banner frame element
          ctx.lineWidth = 2;
          ctx.strokeRect(rX, y, rW, rH);
          ctx.fillText(boxText, width / 2, y + 6);
          y += rH + 14;
          break;
        }

        case 'text': {
          ctx.fillStyle = '#000000';
          var size = op.size || 22;
          ctx.font = (op.bold ? 'bold ' : '') + size + 'px Arial, sans-serif';
          ctx.textBaseline = 'top';
          
          var align = op.align || 'center';
          ctx.textAlign = align;

          for (var l = 0; l < op.__lines.length; l++) {
            var lt = op.__lines[l];
            var lx = width / 2;
            if (align === 'left') lx = MARGIN + 6;
            else if (align === 'right') lx = width - MARGIN - 6;

            ctx.fillText(lt, lx, y);
            y += size + LINE_GAP;
          }
          y += 6;
          break;
        }

        case 'row': {
          ctx.fillStyle = '#000000';
          var rSize = op.size || 22;
          // Apply corporate high-contrast monospace weight across inline key-value pairs
          ctx.font = 'bold ' + rSize + 'px "Courier New", Courier, monospace';
          ctx.textBaseline = 'top';

          var left = String(op.left == null ? '' : op.left).toUpperCase();
          var right = String(op.right == null ? '' : op.right).toUpperCase();

          ctx.textAlign = 'left';
          ctx.fillText(left, MARGIN + 8, y);

          ctx.textAlign = 'right';
          ctx.fillText(right, width - MARGIN - 8, y);
          
          y += rSize + LINE_GAP + 4;
          break;
        }

        case 'divider': {
          ctx.fillStyle = '#000000';
          ctx.lineWidth = op.thick || 2;
          
          if ((op.style || 'solid') === 'dashed') {
            ctx.setLineDash([6, 4]); // Clean, highly visible asset dashes
            ctx.beginPath();
            ctx.moveTo(MARGIN + 4, y + 4);
            ctx.lineTo(width - MARGIN - 4, y + 4);
            ctx.stroke();
            ctx.setLineDash([]); // Clear current matrix offset configuration boundaries
          } else {
            ctx.fillRect(MARGIN + 4, y + 4, innerW - 8, op.thick || 3);
          }
          y += 12;
          break;
        }

        case 'checkbox': {
          var bSz = 18;
          var bX = MARGIN + 8;
          ctx.lineWidth = 2;
          ctx.strokeStyle = '#000000';
          ctx.strokeRect(bX, y + 2, bSz, bSz);

          if (op.checked) {
            ctx.beginPath();
            ctx.moveTo(bX + 3, y + 2 + (bSz / 2));
            ctx.lineTo(bX + (bSz / 2) - 1, y + 2 + bSz - 3);
            ctx.lineTo(bX + bSz - 3, y + 2 + 4);
            ctx.lineWidth = 3;
            ctx.stroke();
          }

          ctx.fillStyle = '#000000';
          var cSize = op.size || 18;
          ctx.font = 'bold ' + cSize + 'px Arial, sans-serif';
          ctx.textAlign = 'left';
          ctx.textBaseline = 'top';
          ctx.fillText(String(op.label || '').toUpperCase(), bX + bSz + 12, y + 2);
          
          y += Math.max(24, cSize) + 8;
          break;
        }

        case 'band': {
          var bH = op.__h;
          ctx.fillStyle = '#000000';
          ctx.fillRect(MARGIN, y, innerW, bH);

          ctx.fillStyle = '#ffffff';
          var bTxtSize = op.size || 24;
          ctx.font = 'bold ' + bTxtSize + 'px Arial, sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(String(op.text || '').toUpperCase(), width / 2, y + (bH / 2));
          
          y += bH + 10;
          break;
        }

        case 'space': {
          y += Math.max(0, op.h || 8);
          break;
        }
      }
    }
  }
    /* ---------------- 1-bit Floyd–Steinberg dither ---------------- */

  function ditherAndPack(cv, darkness) {
    var w = cv.width, h = cv.height;
    var ctx = cv.getContext('2d');
    var img = ctx.getImageData(0, 0, w, h);
    var d = img.data;
    var gray = new Int16Array(w * h);
    var shift = ({1:-30, 2:-15, 3:0, 4:15, 5:30})[darkness] || 0;
    
    for (var i = 0, p = 0; i < d.length; i += 4, p++) {
      var a = d[i + 3] / 255;
      var r = d[i]     * a + 255 * (1 - a);
      var g = d[i + 1] * a + 255 * (1 - a);
      var b = d[i + 2] * a + 255 * (1 - a);
      var y = 0.299 * r + 0.587 * g + 0.114 * b + shift;
      if (y < 0) y = 0; if (y > 255) y = 255;
      gray[p] = y;
    }
    
    for (var yy = 0; yy < h; yy++) {
      for (var xx = 0; xx < w; xx++) {
        var idx = yy * w + xx;
        var old = gray[idx];
        var nw = old < 128 ? 0 : 255;
        var err = old - nw;
        gray[idx] = nw;
        
        if (xx + 1 < w)               gray[idx + 1]         += (err * 7) >> 4;
        if (yy + 1 < h) {
          if (xx > 0)                 gray[idx + w - 1]     += (err * 3) >> 4;
                                       gray[idx + w]         += (err * 5) >> 4;
          if (xx + 1 < w)              gray[idx + w + 1]     += (err * 1) >> 4;
        }
      }
    }

    var bytesPerRow = Math.ceil(w / 8);
    var rowsB64 = new Array(h);
    for (var yy = 0; yy < h; yy++) {
      var row = new Uint8Array(bytesPerRow);
      for (var x = 0; x < w; x++) {
        // --- MEMORY BIT STREAM REFLECTION ---
        var targetX = w - 1 - x;
        var finalPixel = gray[yy * w + targetX];
        
        if (finalPixel === 0) {
          row[x >> 3] |= (1 << (x & 7));
        }
      }
      var s = '';
      for (var k = 0; k < row.length; k++) s += String.fromCharCode(row[k]);
      rowsB64[yy] = btoa(s);
    }
    return { width: w, height: h, rowsBase64: rowsB64 };
  }

  /* ---------------- Public API ---------------- */

  window.__rasterizeDoc__ = function (payloadJson) {
    var payload;
    try { payload = JSON.parse(payloadJson); }
    catch (e) { send({ id: null, ok: false, error: 'bad payload' }); return; }
    var id = payload.id;
    try {
      var width = payload.width || 384;
      var doc = payload.doc || { ops: [] };
      var ops = (doc.ops || []).slice();

      var cv = document.getElementById('cv');
      cv.width = width;
      cv.height = 100;
      var ctx = cv.getContext('2d');

      preloadImages(ops).then(function () {
        var totalH = measureOps(ctx, ops, width);
        var feed = Math.max(0, doc.feedRows || 0);
        var canvasH = totalH + feed;
        
        cv.width = width;
        cv.height = canvasH;
        ctx = cv.getContext('2d');
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, width, canvasH);
        
        try {
          drawOps(ctx, ops, width);
        } catch (e) {
          send({ id: id, ok: false, error: 'draw failed: ' + (e && e.message || e) });
          return;
        }
        
        // --- UNIVERSAL MASS POWER BORDER FRAME ---
        if (doc.frame) {
          ctx.fillStyle = '#000000';
          var thick = 4; 
          ctx.fillRect(0, 0, width, totalH); // Fill solid
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(thick, thick, width - (thick * 2), totalH - (thick * 2)); // Hollow inner content
          
          // Redraw layout cleanly on top of inner spacing bounds
          try { drawOps(ctx, ops, width); } catch (e) { return; }
        }
        
        try {
          var bmp = ditherAndPack(cv, payload.darkness || 3);
          send({ id: id, ok: true, width: bmp.width, height: bmp.height, rowsBase64: bmp.rowsBase64 });
        } catch (e2) {
          send({ id: id, ok: false, error: 'dither failed: ' + (e2 && e2.message || e2) });
        }
      });
    } catch (e) {
      send({ id: id, ok: false, error: 'rasterize failed: ' + (e && e.message || e) });
    }
  };

  send({ id: '__ready__', ok: true });
})();
</script>
</body></html>`;
}

  
