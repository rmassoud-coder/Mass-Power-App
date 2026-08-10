/**
 * ThermalDoc → 384-px-wide 1-bit dithered bitmap.
 * 
 * FIX: Removed canvas-level horizontal flip. Added support for 'image' ops.
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
  function send(obj) {
    try {
      if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
        window.ReactNativeWebView.postMessage(JSON.stringify(obj));
      }
    } catch (e) {}
  }

  // Standard helper functions
  function fontFor(size, bold, family) {
    var fam = (family === 'mono') ? '"Courier New", "Menlo", monospace' : '"Arial Black", "Arial", sans-serif';
    return (bold ? 'bold ' : '') + size + 'px ' + fam;
  }

  // Design constants
  var DESIGN = {
    margin: 12, // Increased margin to prevent text bleeding
    frameThickness: 3, 
    dividerThickness: 2,
    titleSize: 22, // Reduced size to prevent bleeding
    headerSize: 24, 
    labelSize: 16, 
    valueSize: 18, 
    checkboxSize: 14, 
    smallSize: 14
  };

  // --- MEASURE OPS ---
  function measureOps(ctx, ops, width) {
    var total = DESIGN.margin * 2;
    for (var i = 0; i < ops.length; i++) {
      var op = ops[i];
      var h = 0;
      switch (op.t) {
        case 'shop_title':
          op.__size = DESIGN.titleSize; op.__font = fontFor(DESIGN.titleSize, true, 'sans');
          h = DESIGN.titleSize + 14; break;
        case 'header':
          op.__size = op.size || DESIGN.headerSize; op.__font = fontFor(op.__size, true, 'sans');
          h = op.__size + 14; break;
        case 'label_value':
          op.__labelSize = DESIGN.labelSize; op.__valueSize = DESIGN.valueSize;
          op.__labelFont = fontFor(DESIGN.labelSize, true, 'sans'); op.__valueFont = fontFor(DESIGN.valueSize, true, 'sans');
          h = Math.max(DESIGN.labelSize, DESIGN.valueSize) + 6; break;
        case 'divider': h = 8 + (op.thick || DESIGN.dividerThickness); break;
        case 'space': h = Math.max(0, op.h || 8); break;
        case 'checkbox':
          op.__size = op.size || DESIGN.checkboxSize; op.__font = fontFor(op.__size, true, 'sans');
          h = Math.max(24, op.__size) + 6; break;
        case 'footer':
          op.__size = op.size || DESIGN.smallSize; op.__font = fontFor(op.__size, false, 'sans');
          h = op.__size + 8; break;
        case 'image': 
          // Reserve space for the logo
          op.__h = 80; 
          h = 80; break;
        default: h = 0;
      }
      op.__h = h;
      total += h;
    }
    return total;
  }

  // --- DRAW OPS ---
  function drawOps(ctx, ops, width) {
    var y = DESIGN.margin;
    for (var i = 0; i < ops.length; i++) {
      var op = ops[i];
      switch (op.t) {
        case 'shop_title':
          ctx.fillStyle = '#000'; ctx.font = op.__font; ctx.textBaseline = 'top'; ctx.textAlign = 'center';
          drawSpacedText(ctx, String(op.text || '').toUpperCase(), width / 2, y, 0, true);
          y += op.__h; break;
        case 'header':
          ctx.fillStyle = '#000'; ctx.font = op.__font; ctx.textBaseline = 'top'; ctx.textAlign = 'center';
          var text = String(op.text || '').toUpperCase();
          drawSpacedText(ctx, text, width / 2, y, op.letterSpacing || 2, true);
          ctx.fillRect(DESIGN.margin + 10, y + op.__size + 4, width - DESIGN.margin * 2 - 20, 3);
          y += op.__h; break;
        case 'label_value':
          ctx.textBaseline = 'top';
          ctx.fillStyle = '#000'; ctx.font = op.__labelFont; ctx.textAlign = 'left';
          ctx.fillText(String(op.label || '').toUpperCase(), DESIGN.margin + 4, y);
          ctx.font = op.__valueFont; ctx.textAlign = 'right';
          var val = String(op.value || '');
          var valX = width - DESIGN.margin - 4;
          if (op.unit) { 
            ctx.fillText(val, valX - ctx.measureText(op.unit).width - 6, y);
            ctx.font = fontFor(DESIGN.smallSize, false, 'sans'); ctx.fillText(op.unit, valX, y);
          } else ctx.fillText(val, valX, y);
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
          var boxSize = 20, bx = DESIGN.margin + 4, by = y + 2;
          ctx.fillStyle = '#000';
          ctx.fillRect(bx, by, boxSize, 2); ctx.fillRect(bx, by + boxSize - 2, boxSize, 2);
          ctx.fillRect(bx, by, 2, boxSize); ctx.fillRect(bx + boxSize - 2, by, 2, boxSize);
          if (op.checked) {
            ctx.beginPath(); ctx.moveTo(bx + 4, by + boxSize / 2); ctx.lineTo(bx + boxSize / 2 - 1, by + boxSize - 5); ctx.lineTo(bx + boxSize - 3, by + 4);
            ctx.strokeStyle = '#000'; ctx.lineWidth = 3; ctx.stroke();
          }
          ctx.font = op.__font; ctx.textBaseline = 'top'; ctx.textAlign = 'left'; ctx.fillStyle = '#000';
          ctx.fillText(String(op.label || '').toUpperCase(), bx + boxSize + 10, by + (boxSize - op.__size) / 2 + 2);
          y += op.__h; break;
        case 'image':
          if (op.dataUri) {
            var img = new Image();
            img.onload = function() {
              var imgWidth = op.width || 60;
              var scale = imgWidth / img.width;
              ctx.drawImage(img, (width - imgWidth) / 2, y, imgWidth, img.height * scale);
            };
            img.src = op.dataUri;
          }
          y += op.__h; break;
        case 'footer':
          ctx.fillStyle = '#000'; ctx.font = op.__font; ctx.textBaseline = 'top'; ctx.textAlign = 'center';
          ctx.fillText(String(op.text || ''), width / 2, y); y += op.__h; break;
        default: y += op.__h;
      }
    }
  }

  function drawSpacedText(ctx, text, x, y, spacing, isCenter) {
    if (!text) return;
    var cx = x; 
    if (isCenter) {
      var totalW = 0; for (var i=0; i<text.length; i++) totalW += ctx.measureText(text[i]).width + (spacing||0);
      totalW -= (spacing||0);
      cx = x - totalW / 2;
    }
    for (var j=0; j<text.length; j++) {
      ctx.fillText(text[j], cx, y);
      cx += ctx.measureText(text[j]).width + (spacing||0);
    }
  }

  // --- DITHER ---
  function ditherAndPack(cv, darkness) {
    var w = cv.width, h = cv.height;
    var ctx = cv.getContext('2d');
    var img = ctx.getImageData(0, 0, w, h);
    var d = img.data;
    var gray = new Int16Array(w * h);
    var shift = ({1:-30, 2:-15, 3:0, 4:15, 5:30})[darkness] || 0;
    for (var i = 0, p = 0; i < d.length; i += 4, p++) {
      var a = d[i + 3] / 255;
      var y = 0.299 * (d[i] * a + 255 * (1 - a)) + 0.587 * (d[i+1] * a + 255 * (1 - a)) + 0.114 * (d[i+2] * a + 255 * (1 - a)) + shift;
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
        if (x + 1 < w) gray[idx + 1] += (err * 7) >> 4;
        if (yy + 1 < h) {
          if (x > 0) gray[idx + w - 1] += (err * 3) >> 4;
          gray[idx + w] += (err * 5) >> 4;
          if (x + 1 < w) gray[idx + w + 1] += (err * 1) >> 4;
        }
        if (nw === 0) row[x >> 3] |= (1 << (x & 7));
      }
      var s = '';
      for (var k = 0; k < row.length; k++) s += String.fromCharCode(row[k]);
      rowsB64[yy] = btoa(s);
    }
    return { width: w, height: h, rowsBase64: rowsB64 };
  }

  // --- BOOTSTRAP ---
  window.__rasterizeDoc__ = function (payloadJson) {
    var payload = JSON.parse(payloadJson);
    var id = payload.id;
    try {
      var width = payload.width || 384;
      var doc = payload.doc || { ops: [] };
      var ops = (doc.ops || []).slice();
      var cv = document.getElementById('cv');
      var ctx = cv.getContext('2d');
      
      var totalH = measureOps(ctx, ops, width);
      var feed = Math.max(0, doc.feedRows || 0);
      var canvasH = totalH + feed;
      
      cv.width = width; cv.height = canvasH;
      ctx = cv.getContext('2d');
      ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, width, canvasH);
      
      if (doc.frame) {
        ctx.fillStyle = '#000';
        var thick = DESIGN.frameThickness;
        ctx.fillRect(thick/2, thick/2, width - thick, thick);
        ctx.fillRect(thick/2, canvasH - thick - thick/2, width - thick, thick);
        ctx.fillRect(thick/2, thick/2, thick, canvasH - thick);
        ctx.fillRect(width - thick - thick/2, thick/2, thick, canvasH - thick);
      }
      
      drawOps(ctx, ops, width);
      
      var bmp = ditherAndPack(cv, payload.darkness || 3);
      send({ id: id, ok: true, width: bmp.width, height: bmp.height, rowsBase64: bmp.rowsBase64 });
    } catch (e) {
      send({ id: id, ok: false, error: 'Rasterizer error: ' + (e && e.message || e) });
    }
  };
})();
</script>
</body></html>`;
}
