// Keyboard and mouse state. The game asks "is this key held", "was it pressed this frame"
// and "how far did the mouse move", and never touches DOM events itself.

export function createInput(canvas) {
  const held = new Set();
  const pressed = new Set();
  const state = { mouseDX: 0, mouseDY: 0, wheel: 0, fire: false, aim: false, locked: false, enabled: true };

  /** Ask the browser to lock the mouse to the game. Some embedded views refuse; the keys still work. */
  function capturePointer() {
    try {
      const request = canvas.requestPointerLock?.();
      if (request && typeof request.catch === 'function') request.catch(() => {});
    } catch {
      // Pointer lock is optional: Q and E turn the camera without it.
    }
  }

  window.addEventListener('keydown', (event) => {
    if (!held.has(event.code)) pressed.add(event.code);
    held.add(event.code);
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(event.code)) event.preventDefault();
  });
  window.addEventListener('keyup', (event) => held.delete(event.code));
  window.addEventListener('blur', () => { held.clear(); state.fire = false; state.aim = false; });

  canvas.addEventListener('mousedown', (event) => {
    if (!state.enabled) return;
    if (!state.locked) {
      capturePointer();
      return;
    }
    if (event.button === 0) { state.fire = true; pressed.add('MouseLeft'); }
    if (event.button === 2) state.aim = true;
  });
  window.addEventListener('mouseup', (event) => {
    if (event.button === 0) state.fire = false;
    if (event.button === 2) state.aim = false;
  });
  canvas.addEventListener('contextmenu', (event) => event.preventDefault());
  document.addEventListener('pointerlockchange', () => {
    state.locked = document.pointerLockElement === canvas;
    if (!state.locked) { state.fire = false; state.aim = false; }
  });
  document.addEventListener('mousemove', (event) => {
    if (!state.locked) return;
    state.mouseDX += event.movementX;
    state.mouseDY += event.movementY;
  });
  window.addEventListener('wheel', (event) => { state.wheel += Math.sign(event.deltaY); }, { passive: true });

  return {
    state,
    isHeld: (code) => held.has(code),
    wasPressed: (code) => pressed.has(code),
    /** -1, 0 or 1 from a pair of keys (and their arrow-key twins). */
    axis: (negative, positive, altNegative, altPositive) =>
      (held.has(positive) || held.has(altPositive) ? 1 : 0) - (held.has(negative) || held.has(altNegative) ? 1 : 0),
    /** Call once per rendered frame, after the game has read the input. */
    endFrame() {
      pressed.clear();
      state.mouseDX = 0;
      state.mouseDY = 0;
      state.wheel = 0;
    },
    capturePointer,
    releasePointer() {
      if (document.pointerLockElement) document.exitPointerLock();
    },
  };
}
