// The cast of Tamarind Coast and their dialogue portraits, drawn on a canvas from a few
// shapes each. Every character is this game's own.

export const CAST = {
  mara: { name: 'MARA QUILL', role: 'Mechanic, driver, our lead', skin: '#d9a066', hair: '#2a1a12', style: 'bob', shirt: '#f4f4f4', back: '#1f6f8b' },
  bo: { name: 'UNCLE BO', role: 'Runs Quill & Sons Auto', skin: '#b9794a', hair: '#d9d9d9', style: 'bald', shirt: '#ffb347', back: '#7a3e12', beard: '#e8e8e8', glasses: true },
  dita: { name: 'DITA MARLO', role: 'Fence at the marina', skin: '#f0c4a0', hair: '#c2255c', style: 'long', shirt: '#22223b', back: '#5f0f40', earrings: true },
  sparks: { name: 'JUN "SPARKS" OKAFOR', role: 'Street racer and tuner', skin: '#7a4a2a', hair: '#101010', style: 'flat', shirt: '#35c9f0', back: '#0b3954', shades: true },
  inez: { name: 'INEZ CALLOWAY', role: 'Reporter, Tamarind Times', skin: '#e3b58a', hair: '#5a3a1a', style: 'bun', shirt: '#e9c46a', back: '#3d405b', glasses: true },
  harrow: { name: 'LT. HARROW', role: 'TCPD, on the take', skin: '#e8c3a4', hair: '#6b6b6b', style: 'flat', shirt: '#1d3f7a', back: '#0b132b', cap: true },
  lasker: { name: 'VICTOR LASKER', role: 'CEO, Halcyon Crest', skin: '#f2d2b6', hair: '#e9e2c9', style: 'slick', shirt: '#14a38b', back: '#022b24', tie: true },
};

/** Paint a character's head-and-shoulders portrait to fill a canvas. */
export function drawPortrait(canvas, key) {
  const who = CAST[key] ?? CAST.mara;
  const c = canvas.getContext('2d');
  const w = canvas.width, h = canvas.height, u = w / 96;
  c.fillStyle = who.back;
  c.fillRect(0, 0, w, h);
  c.fillStyle = 'rgba(255, 255, 255, 0.08)';
  c.beginPath();
  c.arc(w * 0.5, h * 0.42, w * 0.46, 0, Math.PI * 2);
  c.fill();
  // Shoulders, neck, head.
  c.fillStyle = who.shirt;
  c.beginPath();
  c.moveTo(8 * u, h);
  c.quadraticCurveTo(12 * u, 70 * u, 34 * u, 68 * u);
  c.lineTo(62 * u, 68 * u);
  c.quadraticCurveTo(84 * u, 70 * u, 88 * u, h);
  c.fill();
  c.fillStyle = who.skin;
  c.fillRect(40 * u, 56 * u, 16 * u, 16 * u);
  if (who.style === 'long') {
    c.fillStyle = who.hair;
    c.fillRect(24 * u, 22 * u, 48 * u, 52 * u);
  }
  c.fillStyle = who.skin;
  c.beginPath();
  c.ellipse(48 * u, 40 * u, 19 * u, 23 * u, 0, 0, Math.PI * 2);
  c.fill();
  // Hair.
  c.fillStyle = who.hair;
  if (who.style === 'bob' || who.style === 'long') {
    c.beginPath();
    c.ellipse(48 * u, 30 * u, 22 * u, 17 * u, 0, Math.PI, Math.PI * 2);
    c.fill();
    c.fillRect(26 * u, 28 * u, 7 * u, who.style === 'bob' ? 26 * u : 40 * u);
    c.fillRect(63 * u, 28 * u, 7 * u, who.style === 'bob' ? 26 * u : 40 * u);
  } else if (who.style === 'flat' || who.style === 'slick') {
    c.fillRect(29 * u, 15 * u, 38 * u, who.style === 'flat' ? 11 * u : 8 * u);
    c.fillRect(29 * u, 20 * u, 5 * u, 12 * u);
    c.fillRect(62 * u, 20 * u, 5 * u, 12 * u);
  } else if (who.style === 'bun') {
    c.beginPath();
    c.ellipse(48 * u, 26 * u, 20 * u, 12 * u, 0, Math.PI, Math.PI * 2);
    c.fill();
    c.beginPath();
    c.arc(48 * u, 11 * u, 8 * u, 0, Math.PI * 2);
    c.fill();
  } else if (who.style === 'bald') {
    c.fillRect(28 * u, 34 * u, 4 * u, 10 * u);
    c.fillRect(64 * u, 34 * u, 4 * u, 10 * u);
  }
  if (who.cap) {
    c.fillStyle = '#14213d';
    c.fillRect(27 * u, 12 * u, 42 * u, 12 * u);
    c.fillRect(22 * u, 22 * u, 52 * u, 4 * u);
    c.fillStyle = '#ffd21f';
    c.fillRect(45 * u, 14 * u, 6 * u, 6 * u);
  }
  // Face.
  c.fillStyle = '#1b1b1b';
  if (who.shades) {
    c.fillRect(32 * u, 36 * u, 14 * u, 7 * u);
    c.fillRect(50 * u, 36 * u, 14 * u, 7 * u);
    c.fillRect(46 * u, 38 * u, 4 * u, 2 * u);
  } else {
    c.fillRect(37 * u, 38 * u, 5 * u, 4 * u);
    c.fillRect(54 * u, 38 * u, 5 * u, 4 * u);
    c.fillRect(35 * u, 33 * u, 9 * u, 2 * u);
    c.fillRect(52 * u, 33 * u, 9 * u, 2 * u);
  }
  if (who.glasses) {
    c.strokeStyle = '#111';
    c.lineWidth = 2 * u;
    c.strokeRect(33 * u, 35 * u, 12 * u, 9 * u);
    c.strokeRect(51 * u, 35 * u, 12 * u, 9 * u);
    c.beginPath();
    c.moveTo(45 * u, 39 * u);
    c.lineTo(51 * u, 39 * u);
    c.stroke();
  }
  c.fillStyle = 'rgba(0, 0, 0, 0.25)';
  c.fillRect(46 * u, 42 * u, 4 * u, 8 * u);
  c.fillStyle = '#7a2e2e';
  c.fillRect(41 * u, 54 * u, 14 * u, 3 * u);
  if (who.beard) {
    c.fillStyle = who.beard;
    c.beginPath();
    c.ellipse(48 * u, 56 * u, 15 * u, 9 * u, 0, 0, Math.PI);
    c.fill();
    c.fillRect(38 * u, 49 * u, 20 * u, 3 * u);
  }
  if (who.earrings) {
    c.fillStyle = '#ffd21f';
    c.beginPath();
    c.arc(28 * u, 48 * u, 3 * u, 0, Math.PI * 2);
    c.arc(68 * u, 48 * u, 3 * u, 0, Math.PI * 2);
    c.fill();
  }
  if (who.tie) {
    c.fillStyle = '#ffd21f';
    c.beginPath();
    c.moveTo(45 * u, 70 * u);
    c.lineTo(51 * u, 70 * u);
    c.lineTo(53 * u, h);
    c.lineTo(43 * u, h);
    c.fill();
  }
}
