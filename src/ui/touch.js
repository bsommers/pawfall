// Touch overlay: d-pad (left) + jump button (right) + pause button, as DOM elements above the canvas.
// Writes into input.virtual and fires UI actions (so menus and name entry work by touch too). Browser-only; createTouch()
// returns an inert object when there is no document. Shows automatically on touch devices (or ?touch=1).
export function createTouch({ input, root = null, force = false, doc = typeof document !== 'undefined' ? document : null } = {}) {
  const inert = { enabled: false, show() {}, hide() {}, dispose() {}, el: null };
  if (!doc || !input) return inert;
  root = root || doc.getElementById('stage') || doc.body;
  const el = doc.createElement('div');
  el.id = 'touch';
  el.innerHTML = '<div id="dpad" class="tb"><i class="a l"></i><i class="a r"></i><i class="a u"></i><i class="a d"></i><b id="dstick"></b></div>' +
    '<div id="tpause" class="tb">II</div><div id="tjump" class="tb">JUMP</div>';
  root.appendChild(el);
  const dpad = el.querySelector('#dpad'), stick = el.querySelector('#dstick'), jump = el.querySelector('#tjump'), pause = el.querySelector('#tpause');
  let shown = false, dir = { dx: 0, dy: 0 }, padId = null;

  function show(on = true) { shown = on; el.classList.toggle('on', on); if (!on) release(); }
  function release() { input.virtual.dx = 0; input.virtual.dy = 0; input.virtual.jump = false; dir = { dx: 0, dy: 0 }; padId = null; if (stick) stick.style.transform = ''; }
  function setDir(ev) {
    const r = dpad.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    const ox = (ev.clientX - cx) / (r.width / 2), oy = (ev.clientY - cy) / (r.height / 2), dz = 0.28;
    const dx = Math.abs(ox) > dz && Math.abs(ox) >= Math.abs(oy) * 0.7 ? Math.sign(ox) : 0;
    const dy = Math.abs(oy) > dz && Math.abs(oy) > Math.abs(ox) * 0.7 ? Math.sign(oy) : 0;
    if (dx !== dir.dx && dx) input.act(dx < 0 ? 'left' : 'right');
    if (dy !== dir.dy && dy) input.act(dy < 0 ? 'up' : 'down');
    dir = { dx, dy }; input.virtual.dx = dx; input.virtual.dy = dy;
    stick.style.transform = `translate(${Math.max(-1, Math.min(1, ox)) * 22}px, ${Math.max(-1, Math.min(1, oy)) * 22}px)`;
  }
  const on = (n, ev, fn) => n.addEventListener(ev, fn, { passive: false });
  on(dpad, 'pointerdown', (e) => { e.preventDefault(); padId = e.pointerId; dpad.setPointerCapture?.(e.pointerId); setDir(e); });
  on(dpad, 'pointermove', (e) => { if (e.pointerId === padId) { e.preventDefault(); setDir(e); } });
  const endPad = (e) => { if (e.pointerId === padId) { padId = null; dir = { dx: 0, dy: 0 }; input.virtual.dx = 0; input.virtual.dy = 0; stick.style.transform = ''; } };
  on(dpad, 'pointerup', endPad); on(dpad, 'pointercancel', endPad);
  on(jump, 'pointerdown', (e) => { e.preventDefault(); input.virtual.jump = true; input.latchJump(); input.act('confirm'); jump.classList.add('down'); });
  const endJump = () => { input.virtual.jump = false; jump.classList.remove('down'); };
  on(jump, 'pointerup', endJump); on(jump, 'pointercancel', endJump); on(jump, 'pointerleave', endJump);
  on(pause, 'pointerdown', (e) => { e.preventDefault(); input.act('pause'); });

  const coarse = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
  show(force || coarse);
  const first = (e) => { if (e.pointerType === 'touch' && !shown) show(true); };
  doc.addEventListener('pointerdown', first);
  return { enabled: true, show, hide: () => show(false), el, get shown() { return shown; }, dispose() { doc.removeEventListener('pointerdown', first); el.remove(); release(); } };
}
