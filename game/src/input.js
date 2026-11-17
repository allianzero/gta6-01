// Keyboard and mouse, read as a plain state object each frame.
// Keys are tracked by `code` (KeyW, ArrowUp, Space, ...) so layouts don't matter.

export class Input {
  constructor(canvas) {
    this.keys = new Set();
    /** Keys pressed since the last frame was consumed. */
    this.pressed = new Set();
    this.mouseX = 0;
    this.mouseY = 0;
    this.mouseDown = false;
    this.mouseClicked = false;
    this.canvas = canvas;

    window.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      this.keys.add(e.code);
      this.pressed.add(e.code);
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) {
        e.preventDefault();
      }
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => {
      this.keys.clear();
      this.mouseDown = false;
    });
    canvas.addEventListener('mousemove', (e) => {
      const r = canvas.getBoundingClientRect();
      this.mouseX = e.clientX - r.left;
      this.mouseY = e.clientY - r.top;
    });
    canvas.addEventListener('mousedown', (e) => {
      if (e.button === 0) {
        this.mouseDown = true;
        this.mouseClicked = true;
      }
    });
    window.addEventListener('mouseup', (e) => {
      if (e.button === 0) this.mouseDown = false;
    });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  down(...codes) {
    return codes.some((c) => this.keys.has(c));
  }

  /** True once for the frame the key went down; call after reading it. */
  wasPressed(...codes) {
    return codes.some((c) => this.pressed.has(c));
  }

  /** End-of-frame housekeeping: forget this frame's presses and clicks. */
  endFrame() {
    this.pressed.clear();
    this.mouseClicked = false;
  }

  /** Driving / walking axes, -1..1, from WASD or the arrow keys. */
  axes() {
    const x = (this.down('KeyD', 'ArrowRight') ? 1 : 0) - (this.down('KeyA', 'ArrowLeft') ? 1 : 0);
    const y = (this.down('KeyS', 'ArrowDown') ? 1 : 0) - (this.down('KeyW', 'ArrowUp') ? 1 : 0);
    return { x, y };
  }
}
