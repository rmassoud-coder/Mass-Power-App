/**
 * ThermalDoc → 384-px-wide 1-bit dithered bitmap.
 */
import type { MonoBitmap } from './catPrinter';
import type { ThermalDoc } from './thermalDoc';

export interface RasterizeOptions {
  width?: number;
  darkness?: number;
  timeoutMs?: number;
}

type PendingReq = {
  resolve: (b: MonoBitmap) => void;
  reject: (e: Error) => void;
  timer: any;
};

let _hostReady = false;
let _injectJs: ((js: string) => void) | null = null;
const _pending = new Map<string, PendingReq>();

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
  // catPrinter.ts expects LSB-first packed rows (it does its own row-reverse +
  // bit-mirror to convert). Do not change this without also updating catPrinter.ts.
  var MSB_FIRST = false;

  function send(obj) {
    try {
      if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
        window.ReactNativeWebView.postMessage(JSON.stringify(obj));
      }
    } catch (e) {}
  }

  function fontFor(size, bold, family) {
    var fam = (family === 'mono') ? '"Courier New", "Menlo", monospace' : '"Arial Black", "Arial", sans-serif';
    return (bold ? 'bold ' : '') + size + 'px ' + fam;
  }

  var DESIGN = {
    margin: 12, frameThickness: 4, dividerThickness: 3,
    titleSize: 27, headerSize: 28, labelSize: 20, valueSize: 22, checkboxSize: 18, smallSize: 17
  };

  // 🔥 FORCE DEEP BLACK: Removed thin strokes, replaced with multi-layer overlapping fill
  function boldText(ctx, text, x, y, weight) {
    ctx.fillStyle = '#000000';
    ctx.fillText(text, x, y);
    ctx.fillText(text, x + 0.5, y);
    ctx.fillText(text, x, y + 0.5);
    ctx.fillText(text, x, y);
  }

  function measureOps(ctx, ops, width) {
    var total = DESIGN.margin * 2;
    for (var i = 0; i < ops.length; i++) {
      var op = ops[i];
      var h = 0;
      switch (op.t) {
        case 'shop_title': op.__size = DESIGN.titleSize; op.__font = fontFor(DESIGN.titleSize, true, 'sans'); h = DESIGN.titleSize + 14; break;
        case 'header': op.__size = op.size ? Math.round(op.size * 1.1) + 4 : DESIGN.headerSize; op.__font = fontFor(op.__size, true, 'sans'); h = op.__size + 14; break;
        case 'label_value': op.__labelSize = DESIGN.labelSize; op.__valueSize = DESIGN.valueSize; op.__labelFont = fontFor(DESIGN.labelSize, true, 'sans'); op.__valueFont = fontFor(DESIGN.valueSize, true, 'sans'); h = Math.max(DESIGN.labelSize, DESIGN.valueSize) + 8; break;
        case 'divider': h = 8 + (op.thick || DESIGN.dividerThickness); break;
        case 'space': h = Math.max(0, op.h || 8); break;
        case 'checkbox': op.__size = op.size ? Math.round(op.size * 1.1) + 2 : DESIGN.checkboxSize; op.__font = fontFor(op.__size, true, 'sans'); h = Math.max(26, op.__size) + 8; break;
        case 'footer': op.__size = op.size ? Math.round(op.size * 1.1) + 2 : DESIGN.smallSize; op.__font = fontFor(op.__size, false, 'sans'); h = op.__size + 8; break;
        case 'image': op.__h = op.__imgH || 80; h = op.__h; break;
        default: h = 0;
      }
      op.__h = h;
      total += h;
    }
    return total;
  }

  function loadImages(ops) {
    var promises = [];
    ops.forEach(function (op) {
      if (op.t === 'image' && op.url) {
        promises.push(new Promise(function (resolve) {
          var img = new Image();
          img.crossOrigin = 'Anonymous';
          img.onload = function () {
            var imgWidth = op.width || 60;
            var scale = imgWidth / img.width;
            op.__img = img;
            op.__imgW = imgWidth;
            op.__imgH = Math.round(img.height * scale);
            resolve();
          };
          img.onerror = function () {
            op.__img = null;
            resolve();
          };
          img.src = op.url;
        }));
      }
    });
    return Promise.all(promises);
  }

  function drawOps(ctx, ops, width, startY) {
    var y = startY;
    for (var i = 0; i < ops.length; i++) {
      var op = ops[i];
      switch (op.t) {
        case 'shop_title':
          ctx.fillStyle = '#000'; ctx.font = op.__font; ctx.textBaseline = 'top'; ctx.textAlign = 'center';
          drawSpacedText(ctx, String(op.text || '').toUpperCase(), width / 2, y, 0, true, 2.4);
          y += op.__h; break;
        case 'header':
          ctx.fillStyle = '#000'; ctx.font = op.__font; ctx.textBaseline = 'top'; ctx.textAlign = 'center';
          var text = String(op.text || '').toUpperCase();
          drawSpacedText(ctx, text, width / 2, y, op.letterSpacing || 2, true, 1.6);
          ctx.fillRect(DESIGN.margin + 10, y + op.__size + 4, width - DESIGN.margin * 2 - 20, 3);
          y += op.__h; break;
        case 'label_value':
          ctx.textBaseline = 'top';
          ctx.fillStyle = '#000'; ctx.font = op.__labelFont; ctx.textAlign = 'left';
          boldText(ctx, String(op.label || '').toUpperCase(), DESIGN.margin + 4, y, 1.4);
          ctx.font = op.__valueFont; ctx.textAlign = 'right';
          var val = String(op.value || '');
          var valX = width - DESIGN.margin - 4;
          if (op.unit) { 
            boldText(ctx, val, valX - ctx.measureText(op.unit).width - 6, y, 1.4);
            ctx.font = fontFor(DESIGN.smallSize, false, 'sans'); boldText(ctx, op.unit, valX, y, 1.2);
          } else boldText(ctx, val, valX, y, 1.4);
          y += op.__h; break;
        case 'divider':
          var thick = op.thick || DESIGN.dividerThickness;
          ctx.fillStyle = '#000';
          if (op.style === 'dashed') {
            for (var dx = DESIGN.margin + 4; dx < width - DESIGN.margin - 4; dx += 8) ctx.fillRect(dx, y + 3, 4, thick);
          } else ctx.fillRect(DESIGN.margin + 4, y + 3, width - DESIGN.margin * 2 - 8, thick);
          y += 8 + thick; break;
        case 'space': y += op.__h; break;
        case 'checkbox':
          var boxSize = 24, bx = DESIGN.margin + 4, by = y + 2;
          ctx.fillStyle = '#000';
          ctx.fillRect(bx, by, boxSize, 2); ctx.fillRect(bx, by + boxSize - 2, boxSize, 2);
          ctx.fillRect(bx, by, 2, boxSize); ctx.fillRect(bx + boxSize - 2, by, 2, boxSize);
          if (op.checked) {
            ctx.beginPath(); ctx.moveTo(bx + 4, by + boxSize / 2); ctx.lineTo(bx + boxSize / 2 - 1, by + boxSize - 5); ctx.lineTo(bx + boxSize - 3, by + 4);
            ctx.strokeStyle = '#000'; ctx.lineWidth = 3; ctx.stroke();
          }
          ctx.font = op.__font; ctx.textBaseline = 'top'; ctx.textAlign = 'left'; ctx.fillStyle = '#000';
          boldText(ctx, String(op.label || '').toUpperCase(), bx + boxSize + 10, by + (boxSize - op.__size) / 2 + 2, 1.4);
          y += op.__h; break;
        case 'image':
          if (op.__img) {
            var imgWidth = op.__imgW || op.width || 60;
            ctx.drawImage(op.__img, (width - imgWidth) / 2, y, imgWidth, op.__imgH);
          }
          y += op.__h;
          y += 24; // Add 3 empty lines (8px each) after logo
          break;
        case 'footer':
          ctx.fillStyle = '#000'; ctx.font = op.__font; ctx.textBaseline = 'top'; ctx.textAlign = 'center';
          boldText(ctx, String(op.text || ''), width / 2, y, 1.2); y += op.__h; break;
        default: y += op.__h;
      }
    }
  }

  // 🔥 SMART WRAP + SHRINK FUNCTION
  function drawSpacedText(ctx, text, x, y, spacing, isCenter, weight) {
    if (!text) return;
    var margin = DESIGN.margin + 4;
    var maxWidth = ctx.canvas.width - (margin * 2);

    var attemptDraw = function(txt, fontSize, sp) {
      ctx.font = fontFor(fontSize, true, 'sans');
      var totalW = 0; 
      for (var i=0; i<txt.length; i++) totalW += ctx.measureText(txt[i]).width + (sp||0);
      totalW -= (sp||0);
      return { width: totalW, height: fontSize };
    };

    // Try original size first
    var size = DESIGN.headerSize;
    var res = attemptDraw(text, size, spacing);
    
    // If too wide, shrink font size until it fits
    while (res.width > maxWidth && size > 10) {
      size -= 2;
      res = attemptDraw(text, size, spacing);
    }

    // If it still doesn't fit after shrinking, split into two lines
    if (res.width > maxWidth) {
      var half = Math.floor(text.length / 2);
      var bestSplit = half;
      for (var k = 1; k < text.length; k++) {
        if (text[k] === ' ' || text[k] === '-') {
          if (Math.abs(k - half) < Math.abs(bestSplit - half)) bestSplit = k;
        }
      }
      var line1 = text.substring(0, bestSplit).trim();
      var line2 = text.substring(bestSplit).trim();
      
      var res1 = attemptDraw(line1, size, spacing);
      var res2 = attemptDraw(line2, size, spacing);
      var cx1 = isCenter ? (x - res1.width / 2) : x;
      var cx2 = isCenter ? (x - res2.width / 2) : x;
      
      ctx.font = fontFor(size, true, 'sans');
      for (var j=0; j<line1.length; j++) { boldText(ctx, line1[j], cx1, y, weight); cx1 += ctx.measureText(line1[j]).width + (spacing||0); }
      var line2Y = y + size + 4;
      for (var j=0; j<line2.length; j++) { boldText(ctx, line2[j], cx2, line2Y, weight); cx2 += ctx.measureText(line2[j]).width + (spacing||0); }
      return;
    }

    // Draw normal (shrunk or original)
    var cx = isCenter ? (x - res.width / 2) : x;
    ctx.font = fontFor(size, true, 'sans');
    for (var j=0; j<text.length; j++) {
      boldText(ctx, text[j], cx, y, weight);
      cx += ctx.measureText(text[j]).width + (spacing||0);
    }
  }

  // 🔥 FIX: Supersampling with output width preserved (384px)
  function ditherAndPack(cv, darkness) {
    var w = cv.width, h = cv.height;
    var ctx = cv.getContext('2d');
    var img = ctx.getImageData(0, 0, w, h);
    var d = img.data;

    // Correct darkness mapping: higher darkness = lower threshold = more black
    var shift = ({1:-10, 2:0, 3:10, 4:20, 5:30})[darkness] || 10;
    var threshold = 128 + shift;

    // 🔥 FIX: Use 5x5 neighborhood averaging for better thin stroke preservation
    var outW = w; // Keep original width
    var outH = h; // Keep original height
    var bw = new Uint8Array(outW * outH);

    for (var y = 0; y < outH; y++) {
      for (var x = 0; x < outW; x++) {
        var sum = 0;
        var count = 0;
        // Average 5x5 block for this pixel (radius = 2)
        for (var oy = -2; oy <= 2; oy++) {
          for (var ox = -2; ox <= 2; ox++) {
            var srcX = x + ox;
            var srcY = y + oy;
            if (srcX < 0 || srcX >= w || srcY < 0 || srcY >= h) continue;
            var idx = (srcY * w + srcX) * 4;
            var a = d[idx + 3] / 255;
            var yVal = 0.299 * (d[idx] * a + 255 * (1 - a)) + 0.587 * (d[idx+1] * a + 255 * (1 - a)) + 0.114 * (d[idx+2] * a + 255 * (1 - a));
            sum += yVal;
            count++;
          }
        }
        var avg = sum / count;
        bw[y * outW + x] = (avg < threshold) ? 1 : 0;
      }
    }

    var bytesPerRow = Math.ceil(outW / 8);
    var rowsB64 = new Array(outH);
    for (var Y = 0; Y < outH; Y++) {
      var row = new Uint8Array(bytesPerRow);
      for (var X = 0; X < outW; X++) {
        if (bw[Y * outW + X]) {
          var bitPos = MSB_FIRST ? (7 - (X & 7)) : (X & 7);
          row[X >> 3] |= (1 << bitPos);
        }
      }
      var s = '';
      for (var k = 0; k < row.length; k++) s += String.fromCharCode(row[k]);
      rowsB64[Y] = btoa(s);
    }
    return { width: outW, height: outH, rowsBase64: rowsB64 };
  }

  window.__rasterizeDoc__ = function (payloadJson) {
    var payload = JSON.parse(payloadJson);
    var id = payload.id;
    var width = payload.width || 384;
    var doc = payload.doc || { ops: [] };
    var ops = (doc.ops || []).slice();

    loadImages(ops).then(function () {
      try {
        var cv = document.getElementById('cv');
        var ctx = cv.getContext('2d');

        var leadRows = Math.max(0, doc.leadRows || 0);
        var totalH = measureOps(ctx, ops, width);
        var feed = Math.max(0, doc.feedRows || 0);
        var canvasH = leadRows + totalH + feed;

        cv.width = width; cv.height = canvasH;
        ctx = cv.getContext('2d');
        ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, width, canvasH);

        if (doc.frame) {
          ctx.fillStyle = '#000';
          var thick = DESIGN.frameThickness;
          var contentH = totalH;
          ctx.fillRect(thick/2, leadRows + thick/2, width - thick, thick);
          ctx.fillRect(thick/2, leadRows + contentH - thick - thick/2, width - thick, thick);
          ctx.fillRect(thick/2, leadRows + thick/2, thick, contentH - thick);
          ctx.fillRect(width - thick - thick/2, leadRows + thick/2, thick, contentH - thick);
        }

        drawOps(ctx, ops, width, leadRows + DESIGN.margin);

        var bmp = ditherAndPack(cv, payload.darkness || 3);
        send({ id: id, ok: true, width: bmp.width, height: bmp.height, rowsBase64: bmp.rowsBase64 });
      } catch (e) {
        send({ id: id, ok: false, error: 'Rasterizer error: ' + (e && e.message || e) });
      }
    });
  };
})();
</script>
</body></html>`;
}
