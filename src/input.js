// input.js - keyboard, touch buttons and swipe. attach()/detach() add and remove every listener.
export class Input {
  constructor(h) { this.h = h; this.off = []; this.sx = null; }

  on(t, type, fn, opt) { t.addEventListener(type, fn, opt); this.off.push(() => t.removeEventListener(type, fn, opt)); }

  attach() {
    const h = this.h;
    this.on(window, 'keydown', e => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const active = h.active();
      switch (e.code) {
        case 'ArrowLeft': case 'KeyA': if (active) { e.preventDefault(); if (!e.repeat) h.left(); } break;
        case 'ArrowRight': case 'KeyD': if (active) { e.preventDefault(); if (!e.repeat) h.right(); } break;
        case 'ArrowUp': case 'KeyW': case 'Space': if (active) { e.preventDefault(); h.boost(true); } break;
        case 'Escape': case 'KeyP': if (!e.repeat) h.pause(); break;
        default:
      }
    });
    this.on(window, 'keyup', e => {
      if (['ArrowUp', 'KeyW', 'Space'].includes(e.code)) h.boost(false);
    });
    this.on(window, 'blur', () => h.boost(false));

    // Touch buttons
    document.querySelectorAll('[data-touch]').forEach(el => {
      const kind = el.dataset.touch;
      this.on(el, 'pointerdown', e => {
        e.preventDefault();
        try { el.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
        if (kind === 'left') h.left(); else if (kind === 'right') h.right(); else if (kind === 'boost') h.boost(true);
        el.classList.add('down');
      });
      const up = e => { e.preventDefault(); if (kind === 'boost') h.boost(false); el.classList.remove('down'); };
      this.on(el, 'pointerup', up); this.on(el, 'pointercancel', up); this.on(el, 'lostpointercapture', up);
      this.on(el, 'contextmenu', e => e.preventDefault());
    });

    // Swipe on the game canvas
    const cv = document.getElementById('game');
    if (cv) {
      this.on(cv, 'pointerdown', e => { this.sx = e.clientX; });
      this.on(cv, 'pointerup', e => {
        if (this.sx === null || !h.active()) return;
        const dx = e.clientX - this.sx; this.sx = null;
        if (dx > 35) h.right(); else if (dx < -35) h.left();
      });
      // stop the browser scrolling/zooming while playing
      this.on(cv, 'touchmove', e => e.preventDefault(), { passive: false });
    }
  }

  detach() { this.off.forEach(f => f()); this.off = []; }
}
