// Every vehicle that drives in Tamarind Coast: its name, shape, handling and worth.
// All makes and models are this game's own. Speeds are metres per second.

export const VEHICLES = {
  pico: {
    name: 'Pico', kind: 'Compact', body: 'compact', length: 3.7, width: 1.72, height: 1.42,
    maxSpeed: 30, accel: 8.5, grip: 7.5, cornering: 17, mass: 950, health: 90, value: 400,
    paints: [0xff5d73, 0x35c9f0, 0xffd23f, 0x8ac926, 0xffffff, 0xff8c42],
  },
  marlowe: {
    name: 'Marlowe', kind: 'Sedan', body: 'sedan', length: 4.6, width: 1.85, height: 1.42,
    maxSpeed: 34, accel: 9, grip: 7, cornering: 16, mass: 1350, health: 110, value: 650,
    paints: [0x2b2d42, 0x8d99ae, 0xe8edf0, 0x1d3557, 0x6d1f2f, 0x386641, 0xbfc0c0],
  },
  kestrel: {
    name: 'Kestrel GT', kind: 'Sports', body: 'sports', length: 4.4, width: 1.95, height: 1.16,
    maxSpeed: 47, accel: 15, grip: 9, cornering: 21, mass: 1250, health: 95, value: 2400,
    paints: [0xff2e63, 0xffd400, 0x08d9d6, 0xff7b00, 0xf8f9fa, 0x7b2cbf],
  },
  hammerhead: {
    name: 'Hammerhead', kind: 'Muscle', body: 'muscle', length: 4.9, width: 1.98, height: 1.3,
    maxSpeed: 43, accel: 13, grip: 6, cornering: 17, mass: 1600, health: 130, value: 1500,
    paints: [0x111111, 0xd00000, 0xff8500, 0x3a0ca3, 0x2d6a4f],
  },
  corsaire: {
    name: 'Corsaire', kind: 'Convertible', body: 'convertible', length: 4.7, width: 1.9, height: 1.2,
    maxSpeed: 39, accel: 11, grip: 7.5, cornering: 18, mass: 1400, health: 100, value: 1800,
    paints: [0xff70a6, 0x70d6ff, 0xffffff, 0xe9ff70, 0xff9770],
  },
  ridgeback: {
    name: 'Ridgeback', kind: 'Pickup', body: 'pickup', length: 5.3, width: 2, height: 1.78,
    maxSpeed: 31, accel: 8, grip: 6.5, cornering: 15, mass: 2100, health: 160, value: 800,
    paints: [0xb5651d, 0x4a5759, 0xd62828, 0xf1faee, 0x283618],
  },
  boxwell: {
    name: 'Boxwell', kind: 'Van', body: 'van', length: 5.2, width: 2.05, height: 2.3,
    maxSpeed: 27, accel: 6.5, grip: 6, cornering: 13, mass: 2400, health: 170, value: 600,
    paints: [0xffffff, 0xf4d35e, 0x457b9d, 0xdad7cd],
  },
  cabana: {
    name: 'Cabana Cab', kind: 'Taxi', body: 'sedan', length: 4.6, width: 1.85, height: 1.42,
    maxSpeed: 34, accel: 9.5, grip: 7, cornering: 16, mass: 1400, health: 120, value: 500,
    paints: [0xffc300], roofSign: 0xffffff, taxi: true,
  },
  cruiser: {
    name: 'TCPD Cruiser', kind: 'Police', body: 'sedan', length: 4.8, width: 1.92, height: 1.45,
    maxSpeed: 45, accel: 14, grip: 8.5, cornering: 20, mass: 1700, health: 150, value: 0,
    paints: [0xf4f6f8], police: true, stripe: 0x1d3f7a,
  },
  bulwark: {
    name: 'Bulwark', kind: 'Tactical van', body: 'truck', length: 6.2, width: 2.4, height: 2.7,
    maxSpeed: 33, accel: 8, grip: 6.5, cornering: 13, mass: 5200, health: 380, value: 0,
    paints: [0x1f2a36], police: true, stripe: 0xf4f6f8,
  },
  aurelio: {
    name: 'Aurelio S', kind: 'Armoured limo', body: 'sedan', length: 5.4, width: 1.98, height: 1.46,
    maxSpeed: 40, accel: 10, grip: 7, cornering: 16, mass: 3200, health: 520, value: 5000,
    paints: [0x0b0b0d],
  },
};

/** What turns up in traffic in each district, by weight. */
export const TRAFFIC_MIX = {
  default: ['pico', 'pico', 'marlowe', 'marlowe', 'marlowe', 'cabana', 'ridgeback', 'boxwell', 'hammerhead', 'corsaire', 'kestrel'],
  port: ['ridgeback', 'ridgeback', 'boxwell', 'boxwell', 'marlowe', 'pico'],
  glass: ['marlowe', 'marlowe', 'cabana', 'cabana', 'kestrel', 'corsaire', 'pico'],
  sunrow: ['corsaire', 'corsaire', 'kestrel', 'cabana', 'pico', 'marlowe', 'hammerhead'],
  marina: ['kestrel', 'corsaire', 'corsaire', 'marlowe', 'cabana'],
  heights: ['kestrel', 'corsaire', 'marlowe', 'marlowe'],
};

/** Metres per second to the miles per hour the speedometer shows. */
export function toMph(speed) {
  return Math.round(Math.abs(speed) * 2.237);
}
