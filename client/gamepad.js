// Standard-mapping gamepad (Xbox / PlayStation layout) read once per frame.
// Returns analog sticks plus button states with "pressed this frame" edges.
const prev = [];
const DEAD = .18;
const dz = v => Math.abs(v) < DEAD ? 0 : (v - Math.sign(v) * DEAD) / (1 - DEAD);

export function pollPad() {
  const pads = navigator.getGamepads ? navigator.getGamepads() : [];
  const gp = pads && [...pads].find(p => p && p.connected);
  if (!gp) return null;
  const b = i => !!(gp.buttons[i] && (gp.buttons[i].pressed || gp.buttons[i].value > .5));
  const down = [], edge = [];
  for (let i = 0; i < 17; i++) { down[i] = b(i); edge[i] = down[i] && !prev[i]; prev[i] = down[i]; }
  return {
    mx: dz(gp.axes[0] || 0), my: dz(gp.axes[1] || 0), lx: dz(gp.axes[2] || 0), ly: dz(gp.axes[3] || 0),
    fire: down[7], aim: down[6], jump: edge[0], use: edge[2], hold: down[2], knife: edge[1], swap: edge[3],
    grenade: edge[5], light: edge[4], pause: edge[9], journal: edge[8], sprint: down[10], guide: down[12]   // d-pad up
  };
}
