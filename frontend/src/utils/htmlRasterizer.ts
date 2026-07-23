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

  function fontFor(size, bold) {
    return (bold ? 'bold ' : '') + size + 'px Arial, sans-serif';
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
          var font = fontFor(size, !!op.bold);
          var lines = wrapLines(ctx, op.text || '', font, innerW);
          op.__lines = lines;
          op.__size = size;
          op.__font = font;
          h = lines.length * (size + LINE_GAP);
          break;
        }
        case 'wrap': {
          var size2 = op.size || 20;
          var font2 = fontFor(size2, !!op.bold);
          var lines2 = wrapLines(ctx, op.text || '', font2, innerW);
          op.__lines = lines2;
          op.__size = size2;
          op.__font = font2;
          h = lines2.length * (size2 + LINE_GAP);
          break;
        }
        case 'row': {
          var size3 = op.size || 22;
          var font3 = fontFor(size3, !!op.bold);
          op.__font = font3;
          op.__size = size3;
          h = size3 + LINE_GAP;
          break;
        }
        case 'band': {
          var sizeB = op.size || 24;
          var fontB = fontFor(sizeB, true);
          op.__font = fontB;
          op.__size = sizeB;
          // 6px vertical padding inside the black band
          h = sizeB + 12;
          break;
        }
        case 'header': {
          op.__size = 24;
          op.__font = fontFor(24, true);
          h = 24 + 12; // text + underline gap
          break;
        }
        case 'divider': {
          h = 8;
          break;
        }
        case 'space': {
          h = Math.max(0, op.h || 8);
          break;
        }
        case 'checkbox': {
          var sizeC = op.size || 18;
          op.__size = sizeC;
          op.__font = fontFor(sizeC, true);
          // taller of box (22) and text
          h = Math.max(22, sizeC) + 6;
          break;
        }
        case 'image': {
          var img = op.__img;
          if (!img) { h = 0; break; }
          var maxW = Math.min(innerW, op.maxWidth || innerW);
          var iw = img.width, ih = img.height;
          var scale = maxW / iw;
          if (scale > 1) scale = 1; // never upscale
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
    return total + MARGIN * 2; // top+bottom padding
  }

  /* ---------------- Draw ops (pass 2) ---------------- */

  function drawOps(ctx, ops, width) {
    var innerW = width - MARGIN * 2;
    var y = MARGIN;
    for (var i = 0; i < ops.length; i++) {
      var op = ops[i];
      switch (op.t) {
        case 'text': {
          ctx.fillStyle = '#000';
          ctx.font = op.__font;
          var align = op.align || 'center';
          for (var l = 0; l < op.__lines.length; l++) {
            drawTextLine(ctx, op.__lines[l], MARGIN, y, op.__size, align, innerW);
            y += op.__size + LINE_GAP;
          }
          break;
        }
        case 'wrap': {
          ctx.fillStyle = '#000';
          ctx.font = op.__font;
          var align2 = op.align || 'left';
          for (var l2 = 0; l2 < op.__lines.length; l2++) {
            drawTextLine(ctx, op.__lines[l2], MARGIN, y, op.__size, align2, innerW);
            y += op.__size + LINE_GAP;
          }
          break;
        }
        case 'row': {
          ctx.fillStyle = '#000';
          ctx.font = op.__font;
          ctx.textBaseline = 'top';
          // Clip left+right if too wide by truncating with ellipsis on left.
          var right = String(op.right == null ? '' : op.right);
          var left = String(op.left == null ? '' : op.left);
          var rightW = ctx.measureText(right).width;
          var leftMax = innerW - rightW - 8;
          if (leftMax < 20) leftMax = 20;
          while (ctx.measureText(left).width > leftMax && left.length > 3) {
            left = left.substring(0, left.length - 2) + '…';
          }
          ctx.fillText(left, MARGIN, y);
          ctx.fillText(right, MARGIN + innerW - rightW, y);
          y += op.__size + LINE_GAP;
          break;
        }
        case 'band': {
          var bh = op.__h;
          ctx.fillStyle = '#000';
          ctx.fillRect(0, y, width, bh);
          ctx.fillStyle = '#fff';
          ctx.font = op.__font;
          // If text is wider than innerW, shrink until it fits (down to 12px).
          var text = String(op.text || '');
          var sz = op.__size;
          while (ctx.measureText(text).width > innerW - 6 && sz > 12) {
            sz -= 1;
            ctx.font = fontFor(sz, true);
          }
          var tw = ctx.measureText(text).width;
          ctx.fillText(text, (width - tw) / 2, y + (bh - sz) / 2);
          y += bh;
          break;
        }
        case 'header': {
          ctx.fillStyle = '#000';
          ctx.font = op.__font;
          ctx.textBaseline = 'top';
          var head = String(op.text || '');
          var hsz = op.__size;
          while (ctx.measureText(head).width > innerW - 4 && hsz > 12) {
            hsz -= 1;
            ctx.font = fontFor(hsz, true);
          }
          var hw = ctx.measureText(head).width;
          ctx.fillText(head, (width - hw) / 2, y);
          // Underline
          ctx.fillRect(MARGIN, y + hsz + 4, innerW, 2);
          y += hsz + 12;
          break;
        }
        case 'divider': {
          if ((op.style || 'solid') === 'dashed') {
            ctx.fillStyle = '#000';
            for (var dx = MARGIN; dx < MARGIN + innerW; dx += 8) {
              ctx.fillRect(dx, y + 3, 4, 2);
            }
          } else {
            ctx.fillStyle = '#000';
            ctx.fillRect(MARGIN, y + 3, innerW, 2);
          }
          y += 8;
          break;
        }
        case 'space':
          y += op.__h;
          break;
        case 'checkbox': {
          var boxSize = 20;
          var boxY = y + 2;
          var boxX = MARGIN + 4;
          ctx.fillStyle = '#000';
          // Box outline
          ctx.fillRect(boxX, boxY, boxSize, 2);
          ctx.fillRect(boxX, boxY + boxSize - 2, boxSize, 2);
          ctx.fillRect(boxX, boxY, 2, boxSize);
          ctx.fillRect(boxX + boxSize - 2, boxY, 2, boxSize);
          if (op.checked) {
            // Draw a chunky ✓
            ctx.beginPath();
            ctx.moveTo(boxX + 4, boxY + boxSize / 2);
            ctx.lineTo(boxX + boxSize / 2 - 1, boxY + boxSize - 5);
            ctx.lineTo(boxX + boxSize - 3, boxY + 4);
            ctx.strokeStyle = '#000';
            ctx.lineWidth = 3;
            ctx.stroke();
          }
          ctx.font = op.__font;
          ctx.textBaseline = 'top';
          ctx.fillStyle = '#000';
          ctx.fillText(String(op.label || ''), boxX + boxSize + 8, boxY + (boxSize - op.__size) / 2 + 2);
          y += op.__h;
          break;
        }
        case 'image': {
          if (op.__img) {
            var iw = op.__drawW;
            var ih = op.__drawH;
            var ix = MARGIN;
            if ((op.align || 'center') === 'center') ix = (width - iw) / 2;
            else if (op.align === 'right') ix = width - MARGIN - iw;
            try {
              ctx.drawImage(op.__img, Math.floor(ix), Math.floor(y), iw, ih);
            } catch (e) { /* ignore */ }
            y += ih + 4;
          }
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
    var bytesPerRow = Math.ceil(w / 8);
    var rowsB64 = new Array(h);
    for (var yy = 0; yy < h; yy++) {
      var row = new Uint8Array(bytesPerRow);
      for (var x = 0; x < w; x++) {
        var idx = yy * w + x;
        var old = gray[idx];
        var nw = old < 128 ? 0 : 255;
        var err = old - nw;
        gray[idx] = nw;
        if (x + 1 < w)                gray[idx + 1]         += (err * 7) >> 4;
        if (yy + 1 < h) {
          if (x > 0)                  gray[idx + w - 1]     += (err * 3) >> 4;
                                       gray[idx + w]         += (err * 5) >> 4;
          if (x + 1 < w)              gray[idx + w + 1]     += (err * 1) >> 4;
        }
        if (nw === 0) row[x >> 3] |= (1 << (x & 7));
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
        // Pass 1 — measure
        var totalH = measureOps(ctx, ops, width);
        // Feed rows show up as blank whitespace so paper can be torn off
        var feed = Math.max(0, doc.feedRows || 0);
        var canvasH = totalH + feed;
        cv.width = width;
        cv.height = canvasH;
        ctx = cv.getContext('2d');
        // White background
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, width, canvasH);
        // Pass 2 — draw
        try {
          drawOps(ctx, ops, width);
        } catch (e) {
          send({ id: id, ok: false, error: 'draw failed: ' + (e && e.message || e) });
          return;
        }
        // Dither + return
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
