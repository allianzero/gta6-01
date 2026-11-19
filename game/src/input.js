// Palmira Bay — keyboard and mouse input, with edge-triggered presses.
export function createInput(canvas) {
  const input = {
    keys: new Set(),
    pressed: new Set(),
    mouseX: 0, mouseY: 0, mouseDown: false, mousePressed: false,
    anyKey: false,
  };
  const keyName = (e) => e.key.length === 1 ? e.key.toLowerCase() : e.key;
  window.addEventListener('keydown', (e) => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) e.preventDefault();
    const k = keyName(e);
    if (!input.keys.has(k)) input.pressed.add(k);
    input.keys.add(k);
    input.anyKey = true;
  });
  window.addEventListener('keyup', (e) => input.keys.delete(keyName(e)));
  window.addEventListener('blur', () => { input.keys.clear(); input.mouseDown = false; });
  canvas.addEventListener('mousemove', (e) => {
    const r = canvas.getBoundingClientRect();
    input.mouseX = e.clientX - r.left;
    input.mouseY = e.clientY - r.top;
  });
  canvas.addEventListener('mousedown', (e) => {
    if (e.button === 0) { input.mouseDown = true; input.mousePressed = true; }
  });
  window.addEventListener('mouseup', () => { input.mouseDown = false; });
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  return input;
}
export function isDown(input, ...names) {
  return names.some((n) => input.keys.has(n));
}
export function wasPressed(input, ...names) {
  return names.some((n) => input.pressed.has(n));
}
export function endFrameInput(input) {
  input.pressed.clear();
  input.mousePressed = false;
  input.anyKey = false;
}
export function axisInput(input) {
  const x = (isDown(input, 'd', 'ArrowRight') ? 1 : 0) - (isDown(input, 'a', 'ArrowLeft') ? 1 : 0);
  const y = (isDown(input, 's', 'ArrowDown') ? 1 : 0) - (isDown(input, 'w', 'ArrowUp') ? 1 : 0);
  return { x, y };
}
