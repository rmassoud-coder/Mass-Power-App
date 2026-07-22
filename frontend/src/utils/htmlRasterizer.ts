/**
 * HTML → 384-px-wide 1-bit dithered bitmap.
 *
 * Design:
 *   - A single hidden <WebView> is mounted at the app root via
 *     <HtmlRasterizerHost />. It hosts a bootstrap HTML page that owns a
 *     rendering <div> plus a <canvas>.
 *   - Native RN code calls `rasterizeHtml(html, opts)` and awaits a
 *     Promise<MonoBitmap>. The request is dispatched to the WebView via
 *     `injectJavaScript`. The WebView renders the HTML, snaps it to canvas,
 *     applies Floyd–Steinberg dithering, then postMessages the packed rows
 *     back to native.
 *
 * The rasterizer is a no-op on web (Cat Printer BLE isn't reachable there
 * anyway) and simply throws — callers should fall back to the OS print flow.
 */
import type { MonoBitmap } from './catPrinter';

export interface RasterizeOptions {
  /** Target width in pixels. PD01/GT01 = 384. */
  width?: number;
  /**
   * Extra "boost" applied to every pixel before dithering to make the print
   * darker (1..5). 1 = very light, 3 = normal, 5 = very dark.
   */
  darkness?: number;
  /** Max seconds to wait for the WebView to respond. */
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
    // Host went away — reject anything still waiting
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
  try {
    payload = JSON.parse(raw);
  } catch {
    return;
  }
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

/**
 * Rasterize the supplied HTML into a 384-px-wide monochrome bitmap.
 * The Promise resolves when the WebView finishes rendering + dithering.
 */
export function rasterizeHtml(html: string, opts: RasterizeOptions = {}): Promise<MonoBitmap> {
  const width = opts.width ?? 384;
  const darkness = Math.max(1, Math.min(5, Math.round(opts.darkness ?? 3)));
  const timeoutMs = opts.timeoutMs ?? 20000;

  if (!_injectJs) {
    return Promise.reject(new Error('Rasterizer host not mounted'));
  }

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

  // JSON-encode payload safely for injection
  const payload = JSON.stringify({ id, html, width, darkness });
  const js = `window.__rasterize__(${JSON.stringify(payload)}); true;`;
  try {
    _injectJs(js);
  } catch (e: any) {
    _pending.delete(id);
    return Promise.reject(new Error('Failed to inject rasterizer request: ' + (e?.message || e)));
  }

  return p;
}

/* -------------------------------------------------------------------------- */
/*                    Bootstrap HTML for the hidden WebView                   */
/* -------------------------------------------------------------------------- */

/**
 * Returns the full HTML document that the hidden WebView loads once.
 *
 * The document exposes:
 *   window.__rasterize__(payloadJson): void — kicks off a render+dither job
 *
 * When done, it posts a JSON message back:
 *   { id, ok:true, width, height, rowsBase64: string[] }
 *   { id, ok:false, error: string }
 */
export function getRasterizerHostHtml(): string {
  return `<!DOCTYPE html>
<html><head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<style>
  html, body { margin:0; padding:0; background:#fff; }
  /* Container gets sized precisely to the target width so widthPX matches. */
  #stage { display:block; }
</style>
</head>
<body>
<div id="stage"></div>
<canvas id="cv" style="display:none;"></canvas>
<script>
(function () {
  function send(obj) {
    try {
      if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
        window.ReactNativeWebView.postMessage(JSON.stringify(obj));
      }
    } catch (e) {}
  }

  // Wait for all <img> tags inside \`el\` to load (or fail).
  function waitForImages(el) {
    var imgs = el.querySelectorAll('img');
    if (!imgs.length) return Promise.resolve();
    var arr = [];
    for (var i=0; i<imgs.length; i++) (function(im){
      if (im.complete && im.naturalWidth > 0) { arr.push(Promise.resolve()); return; }
      arr.push(new Promise(function(res){
        im.onload = function(){ res(); };
        im.onerror = function(){ res(); };
        // Safety: don't wait forever
        setTimeout(res, 3000);
      }));
    })(imgs[i]);
    return Promise.all(arr);
  }

  /**
   * Render \`html\` into a hidden div sized to \`width\` px, then
   * rasterize via the SVG <foreignObject> trick.
   * Returns a Promise<HTMLCanvasElement>.
   */
  function renderToCanvas(html, width) {
    var stage = document.getElementById('stage');
    stage.style.width = width + 'px';
    stage.style.margin = '0';
    stage.style.padding = '0';
    stage.style.background = '#fff';
    stage.style.color = '#000';
    // Inline wrapper: strip out <html>/<body>/<head> — foreignObject wants
    // XHTML-compatible fragments. We match anything between <body ...> and </body>.
    var body = html;
    var m = html.match(/<body[^>]*>([\\s\\S]*?)<\\/body>/i);
    if (m) body = m[1];
    // Also grab any <style> blocks from <head> so styling survives.
    var styles = '';
    var re = /<style[^>]*>([\\s\\S]*?)<\\/style>/gi;
    var sm;
    while ((sm = re.exec(html)) !== null) styles += sm[1] + '\\n';

    stage.innerHTML =
      '<div id="rp-root" style="width:' + width + 'px; background:#fff; color:#000;">' +
        (styles ? '<style>' + styles + '</style>' : '') +
        body +
      '</div>';

    // Force load of any <img> tags first (they should already be base64,
    // but be defensive).
    return waitForImages(stage).then(function () {
      var root = document.getElementById('rp-root');
      // Take a beat so the browser fully lays out (fonts / img sizes)
      return new Promise(function(res){ requestAnimationFrame(function(){ setTimeout(res, 30); }); })
        .then(function () {
          // Height = measured content height. We clamp to a hard max so a
          // runaway page can't OOM the printer.
          var h = Math.min(4000, Math.max(1, root.scrollHeight));
          // Build a self-contained XHTML document string.
          var htmlNS = 'http://www.w3.org/1999/xhtml';
          var outer = document.createElement('div');
          outer.appendChild(root.cloneNode(true));
          var xhtml =
            '<div xmlns="' + htmlNS + '" style="width:' + width + 'px; background:#fff; color:#000; font-family: -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Arial, sans-serif;">' +
              outer.innerHTML +
            '</div>';

          var svg =
            '<svg xmlns="http://www.w3.org/2000/svg" width="' + width + '" height="' + h + '">' +
              '<foreignObject width="100%" height="100%">' + xhtml + '</foreignObject>' +
            '</svg>';

          var svg64;
          try {
            svg64 = btoa(unescape(encodeURIComponent(svg)));
          } catch (e) {
            return Promise.reject(new Error('encode failed: ' + e.message));
          }

          var img = new Image();
          return new Promise(function (resolve, reject) {
            img.onload = function () {
              var cv = document.getElementById('cv');
              cv.width = width;
              cv.height = h;
              var ctx = cv.getContext('2d');
              ctx.fillStyle = '#ffffff';
              ctx.fillRect(0, 0, width, h);
              try {
                ctx.drawImage(img, 0, 0, width, h);
                resolve(cv);
              } catch (err) {
                reject(new Error('drawImage failed: ' + err.message));
              }
            };
            img.onerror = function () { reject(new Error('SVG image load failed')); };
            img.src = 'data:image/svg+xml;base64,' + svg64;
          });
        });
    });
  }

  /**
   * Floyd–Steinberg dither on a grayscale copy of the canvas, packed to a
   * 1-bit-per-pixel LSB-first byte array per row, base64-encoded for RN.
   *
   * darkness (1..5): shifts the input downward so more pixels burn black.
   */
  function ditherAndPack(cv, darkness) {
    var w = cv.width, h = cv.height;
    var ctx = cv.getContext('2d');
    var img = ctx.getImageData(0, 0, w, h);
    var d = img.data;
    // Grayscale + darkness shift into an Int16Array (we need signed for FS)
    var gray = new Int16Array(w * h);
    var shift = ({1:-30, 2:-15, 3:0, 4:15, 5:30})[darkness] || 0;
    for (var i = 0, p = 0; i < d.length; i += 4, p++) {
      // sRGB luma; alpha-blend transparent pixels with white
      var a = d[i + 3] / 255;
      var r = d[i]     * a + 255 * (1 - a);
      var g = d[i + 1] * a + 255 * (1 - a);
      var b = d[i + 2] * a + 255 * (1 - a);
      var y = 0.299 * r + 0.587 * g + 0.114 * b + shift;
      if (y < 0) y = 0; if (y > 255) y = 255;
      gray[p] = y;
    }

    // Row-based FS dither
    var bytesPerRow = Math.ceil(w / 8);
    var rowsB64 = new Array(h);
    for (var y = 0; y < h; y++) {
      var row = new Uint8Array(bytesPerRow);
      for (var x = 0; x < w; x++) {
        var idx = y * w + x;
        var old = gray[idx];
        var nw = old < 128 ? 0 : 255;
        var err = old - nw;
        gray[idx] = nw;
        // Propagate error (FS coefficients)
        if (x + 1 < w)                gray[idx + 1]         += (err * 7) >> 4;
        if (y + 1 < h) {
          if (x > 0)                  gray[idx + w - 1]     += (err * 3) >> 4;
                                       gray[idx + w]         += (err * 5) >> 4;
          if (x + 1 < w)              gray[idx + w + 1]     += (err * 1) >> 4;
        }
        if (nw === 0) {
          // bit set = burn (black). LSB-first per Cat Printer protocol.
          row[x >> 3] |= (1 << (x & 7));
        }
      }
      // base64 encode this row
      var s = '';
      for (var k = 0; k < row.length; k++) s += String.fromCharCode(row[k]);
      rowsB64[y] = btoa(s);
    }
    return { width: w, height: h, rowsBase64: rowsB64 };
  }

  window.__rasterize__ = function (payloadJson) {
    var payload;
    try { payload = JSON.parse(payloadJson); }
    catch (e) { send({ id: null, ok: false, error: 'bad payload' }); return; }
    var id = payload.id;
    try {
      renderToCanvas(payload.html, payload.width || 384)
        .then(function (cv) {
          try {
            var bmp = ditherAndPack(cv, payload.darkness || 3);
            send({ id: id, ok: true, width: bmp.width, height: bmp.height, rowsBase64: bmp.rowsBase64 });
          } catch (e) {
            send({ id: id, ok: false, error: 'dither failed: ' + (e && e.message || e) });
          }
        })
        .catch(function (e) {
          send({ id: id, ok: false, error: 'render failed: ' + (e && e.message || e) });
        });
    } catch (e) {
      send({ id: id, ok: false, error: 'rasterize failed: ' + (e && e.message || e) });
    }
  };

  // Tell native we're ready in case it wants to preload jobs
  send({ id: '__ready__', ok: true });
})();
</script>
</body></html>`;
}
