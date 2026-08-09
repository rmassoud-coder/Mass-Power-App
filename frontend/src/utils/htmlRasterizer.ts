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
      : '"Arial Black", "Arial", sans-serif';
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

  /* ---------------- GLOBAL OIL STICKER DESIGN SYSTEM ---------------- */
  /* Applies to ALL services - Audi, BMW, Toyota, ANY car */

  var DESIGN = {
    // Margins
    margin: 8,                    // 8px outer margins
    innerMargin: 12,              // 12px inner padding
    
    // Typography - Universal sizing
    titleSize: 26,                // Shop name
    headerSize: 22,               // Vehicle name (ANY car)
    labelSize: 16,                // Labels (OIL:, MILEAGE:, etc)
    valueSize: 18,                // Values (5W-30, 103,000, etc)
    smallSize: 14,                // Units (KM, date)
    checkboxSize: 14,             // Checkbox labels
    
    // Spacing
    lineGap: 3,
    sectionGap: 6,
    dividerGap: 4,
    
    // Borders - Thick and bold
    frameThickness: 4,
    dividerThickness: 2,
    
    // Font families
    fontFamily: '"Arial Black", "Arial", sans-serif',
    monoFamily: '"Courier New", "Menlo", monospace',
    
    // Letter spacing for headers
    titleSpacing: 2,
    headerSpacing: 3,
  };

  /* ---------------- Op sizing (pass 1) ---------------- */

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

  // Compute the y-height each op needs.
  function measureOps(ctx, ops, width) {
    var total = DESIGN.margin * 2; // top+bottom padding
    for (var i = 0; i < ops.length; i++) {
      var op = ops[i];
      var h = 0;
      switch (op.t) {
        case 'shop_title': {
          var size = DESIGN.titleSize;
          var font = fontFor(size, true, 'sans');
          op.__size = size;
          op.__font = font;
          op.__lines = [op.text || ''];
          h = size + 14;
          break;
        }
        case 'header': {
          var sizeH = DESIGN.headerSize;
          op.__size = sizeH;
          op.__font = fontFor(sizeH, true, 'sans');
          h = sizeH + 14;
          break;
        }
        case 'label_value': {
          var labelSize = DESIGN.labelSize;
          var valueSize = DESIGN.valueSize;
          op.__labelSize = labelSize;
          op.__valueSize = valueSize;
          op.__labelFont = fontFor(labelSize, true, 'sans');
          op.__valueFont = fontFor(valueSize, true, 'sans');
          h = Math.max(labelSize, valueSize) + 6;
          break;
        }
        case 'divider': {
          h = 8 + DESIGN.dividerThickness;
          break;
        }
        case 'space': {
          h = Math.max(0, op.h || 8);
          break;
        }
        case 'checkbox': {
          var sizeC = DESIGN.checkboxSize;
          op.__size = sizeC;
          op.__font = fontFor(sizeC, true, 'sans');
          h = Math.max(24, sizeC) + 6;
          break;
        }
        case 'footer': {
          var sizeF = DESIGN.smallSize;
          op.__size = sizeF;
          op.__font = fontFor(sizeF, false, 'sans');
          h = sizeF + 8;
          break;
        }
        default:
          h = 0;
      }
      op.__h = h;
      total += h;
    }
    return total;
  }

  /* ---------------- Draw ops (pass 2) ---------------- */

  function drawOps(ctx, ops, width) {
    var innerW = width - DESIGN.margin * 2;
    var y = DESIGN.margin;
    
    for (var i = 0; i < ops.length; i++) {
      var op = ops[i];
      switch (op.t) {
        case 'shop_title': {
          ctx.fillStyle = '#000';
          ctx.font = op.__font;
          ctx.textBaseline = 'top';
          ctx.textAlign = 'center';
          var text = String(op.text || '').toUpperCase();
          var ls = DESIGN.titleSpacing;
          var totalW = measureSpacedText(ctx, text, ls);
          var x = (width - totalW) / 2;
          drawSpacedText(ctx, text, x, y, ls);
          y += op.__size + 14;
          break;
        }
        case 'header': {
          ctx.fillStyle = '#000';
          ctx.font = op.__font;
          ctx.textBaseline = 'top';
          ctx.textAlign = 'center';
          var head = String(op.text || '').toUpperCase();
          var hsz = op.__size;
          var ls = DESIGN.headerSpacing;
          var hw = measureSpacedText(ctx, head, ls);
          var hx = (width - hw) / 2;
          drawSpacedText(ctx, head, hx, y, ls);
          // Thick underline
          ctx.fillRect(DESIGN.margin + 10, y + hsz + 6, innerW - 20, 3);
          y += hsz + 14;
          break;
        }
        case 'label_value': {
          ctx.textBaseline = 'top';
          var label = String(op.label || '').toUpperCase();
          var value = String(op.value || '');
          var unit = String(op.unit || '');
          
          // Draw label
          ctx.fillStyle = '#000';
          ctx.font = op.__labelFont;
          ctx.textAlign = 'left';
          ctx.fillText(label, DESIGN.margin + 4, y);
          
          // Draw value
          ctx.font = op.__valueFont;
          ctx.textAlign = 'right';
          var valueX = width - DESIGN.margin - 4;
          if (unit) {
            // Draw unit after value
            var valueW = ctx.measureText(value).width;
            ctx.fillText(value, valueX - ctx.measureText(unit).width - 6, y);
            ctx.font = fontFor(DESIGN.smallSize, false, 'sans');
            ctx.fillText(unit, valueX, y + 2);
          } else {
            ctx.fillText(value, valueX, y);
          }
          
          y += op.__h;
          break;
        }
        case 'divider': {
          var thick = DESIGN.dividerThickness;
          ctx.fillStyle = '#000';
          ctx.fillRect(DESIGN.margin + 4, y + 3, innerW - 8, thick);
          y += 8 + thick;
          break;
        }
        case 'space': {
          y += op.__h;
          break;
        }
        case 'checkbox': {
          var boxSize = 20;
          var boxY = y + 2;
          var boxX = DESIGN.margin + 4;
          ctx.fillStyle = '#000';
          // Box outline
          ctx.fillRect(boxX, boxY, boxSize, 2);
          ctx.fillRect(boxX, boxY + boxSize - 2, boxSize, 2);
          ctx.fillRect(boxX, boxY, 2, boxSize);
          ctx.fillRect(boxX + boxSize - 2, boxY, 2, boxSize);
          if (op.checked) {
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
          ctx.textAlign = 'left';
          ctx.fillStyle = '#000';
          ctx.fillText(String(op.label || '').toUpperCase(), boxX + boxSize + 10, boxY + (boxSize - op.__size) / 2 + 2);
          y += op.__h;
          break;
        }
        case 'footer': {
          ctx.fillStyle = '#000';
          ctx.font = op.__font;
          ctx.textBaseline = 'top';
          ctx.textAlign = 'center';
          ctx.fillText(String(op.text || ''), width / 2, y);
          y += op.__h;
          break;
        }
      }
    }
  }

  /* ---------------- THE FIX: Horizontal flip before dithering ---------------- */

  function flipCanvasHorizontally(sourceCanvas, width, height) {
    var flippedCanvas = document.createElement('canvas');
    flippedCanvas.width = width;
    flippedCanvas.height = height;
    var flippedCtx = flippedCanvas.getContext('2d');
    
    // Apply horizontal flip using translate + scale
    flippedCtx.save();
    flippedCtx.translate(width, 0);
    flippedCtx.scale(-1, 1);
    flippedCtx.drawImage(sourceCanvas, 0, 0);
    flippedCtx.restore();
    
    return flippedCanvas;
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
        // STRUCTURALLY SOUND BIT-SHIFTING LOOP - DO NOT MODIFY
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
        
        // Draw frame (4px thick border)
        ctx.fillStyle = '#000';
        var thick = DESIGN.frameThickness;
        ctx.fillRect(thick/2, thick/2, width - thick, thick);              // top
        ctx.fillRect(thick/2, canvasH - thick - thick/2, width - thick, thick); // bottom
        ctx.fillRect(thick/2, thick/2, thick, canvasH - thick);           // left
        ctx.fillRect(width - thick - thick/2, thick/2, thick, canvasH - thick); // right
        
        // Pass 2 — draw
        try {
          drawOps(ctx, ops, width);
        } catch (e) {
          send({ id: id, ok: false, error: 'draw failed: ' + (e && e.message || e) });
          return;
        }

        /* ================================================================
           THE FIX: Flip horizontally at the visual layer
           ================================================================ */
        var flippedCv = flipCanvasHorizontally(cv, width, canvasH);

        // Dither + return using the flipped canvas
        try {
          var bmp = ditherAndPack(flippedCv, payload.darkness || 3);
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
