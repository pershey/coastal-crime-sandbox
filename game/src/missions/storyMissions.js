// The story of Tamarind Coast in eight missions. Mara Quill keeps her uncle's garage alive
// by taking jobs from the town's fixers, and ends up at war with Halcyon Crest, the
// developer buying up the whole seafront. Each mission is a list of steps the mission
// runner knows how to play: goto, steal, deliver, collect, eliminate, destroy, race,
// survive and loseWanted.
import { CITY, PLACES, kerbPoint } from '../city/cityLayout.js';

const node = (i, j) => ({ x: i * CITY.pitch, z: j * CITY.pitch });
/** The palm avenue along the east side of Saffron Market, where the stalls spill into the street. */
const marketPlaza = { x: 4 * CITY.pitch - 2, z: 4.5 * CITY.pitch };
const quay = { x: CITY.quayX + 44, z: 4.2 * CITY.pitch };
const crestPlaza = { x: 4.5 * CITY.pitch, z: 2.5 * CITY.pitch + 22 };

export const STORY_MISSIONS = [
  {
    id: 'family-business', title: 'FAMILY BUSINESS', contact: 'bo', place: 'garage', reward: { cash: 500, rep: 60 },
    brief: 'Collect the rent Uncle Bo is owed at Saffron Market.',
    intro: [
      ['bo', 'Mara! Halcyon Crest doubled our lease. I need the market rent today.'],
      ['mara', 'Three stalls, three envelopes. Keep the kettle on, Bo.'],
    ],
    steps: [
      { type: 'steal', model: 'pico', paint: 0xffd23f, at: { x: 2.75 * CITY.pitch, z: 6 * CITY.pitch - 5.6, heading: -Math.PI / 2 }, text: 'Take the shop\'s yellow Pico' },
      { type: 'goto', place: 'market', text: 'Drive to Saffron Market' },
      { type: 'collect', spots: [kerbPoint(3, 4, 'e', 0.25), kerbPoint(3, 4, 's', 0.5), kerbPoint(4, 4, 'w', 0.7)], text: 'Collect the rent on foot', say: ['mara', 'Rent day, friends. Bo says hello.'] },
      { type: 'goto', place: 'garage', text: 'Bring the cash back to the garage' },
    ],
    outro: [['bo', 'Every dollar. Take my old P9 - this town is getting rough.']],
    gift: { weapon: 'pistol', ammo: 60 },
  },
  {
    id: 'hot-property', title: 'HOT PROPERTY', contact: 'dita', place: 'marinaClub', reward: { cash: 1200, rep: 90 },
    brief: 'Steal a Kestrel GT from the yacht club for Dita Marlo.',
    intro: [
      ['dita', 'A Crest executive left his Kestrel GT outside the yacht club. I have a buyer.'],
      ['mara', 'Paint stays perfect. Price goes up if the cops get curious.'],
    ],
    steps: [
      { type: 'steal', model: 'kestrel', paint: 0xffd400, at: { x: 7.3 * CITY.pitch, z: 6 * CITY.pitch + 5.6, heading: Math.PI / 2 }, text: 'Steal the yellow Kestrel GT', wanted: 2 },
      { type: 'loseWanted', text: 'Lose the police', say: ['dita', 'Sirens already? Lose them before you come near my lock-up.'] },
      { type: 'deliver', place: 'portLockup', text: 'Deliver the Kestrel to Dock 9' },
    ],
    outro: [['dita', 'Not a scratch. You drive like you were born in one.']],
  },
  {
    id: 'market-forces', title: 'MARKET FORCES', contact: 'bo', place: 'market', reward: { cash: 900, rep: 110 },
    brief: 'Halcyon Crest sent heavies to clear the market. Clear them instead.',
    intro: [
      ['bo', 'Crest sent men in green jackets to "inspect" the stalls. With crowbars.'],
      ['mara', 'Then they can inspect the pavement.'],
    ],
    steps: [
      { type: 'eliminate', kind: 'guard', count: 5, at: marketPlaza, spread: 16, text: 'Take down the Crest heavies' },
      { type: 'loseWanted', stars: 2, text: 'Get clear of the police' },
    ],
    outro: [['bo', 'The stallholders chipped in. Go see the Ammo Shack - you earned a discount on trouble.']],
    gift: { weapon: 'smg', ammo: 120 },
  },
  {
    id: 'night-shift', title: 'NIGHT SHIFT', contact: 'sparks', place: 'raceStart', reward: { cash: 1500, rep: 120 }, hour: 21.2,
    brief: 'Beat Sparks\' time around the boulevard after dark.',
    intro: [
      ['sparks', 'You want my crew watching your back? Beat my lap. Boulevard, market, and home.'],
      ['mara', 'Keys.'],
    ],
    steps: [
      { type: 'steal', model: 'kestrel', paint: 0x08d9d6, at: { x: 6.25 * CITY.pitch, z: 7 * CITY.pitch - 5.6, heading: -Math.PI / 2 }, text: 'Get in Sparks\' Kestrel GT' },
      { type: 'race', seconds: 78, text: 'Hit every checkpoint', checkpoints: [node(5, 7), node(3, 7), node(2, 7), node(2, 5), node(4, 5), node(5, 5), node(5, 7), node(7, 7)] },
    ],
    outro: [['sparks', 'Okay. OKAY. The crew rides with you. Race me any night you like.']],
  },
  {
    id: 'paper-trail', title: 'PAPER TRAIL', contact: 'inez', place: 'crestTower', reward: { cash: 1400, rep: 130 },
    brief: 'Stop a Halcyon Crest courier and take the files for the Tamarind Times.',
    intro: [
      ['inez', 'Crest is moving forged land deeds by courier. A white Boxwell, leaving now.'],
      ['mara', 'You write the story. I will get you the paperwork.'],
    ],
    steps: [
      { type: 'destroy', model: 'boxwell', paint: 0xffffff, at: { x: 4 * CITY.pitch - 3.5, z: 3.2 * CITY.pitch, heading: 0 }, text: 'Wreck the courier van', grab: 'Grab the deeds from the wreck' },
      { type: 'loseWanted', text: 'Lose the police' },
      { type: 'goto', place: 'garage', text: 'Take the deeds to the garage' },
    ],
    outro: [['inez', 'Forged, every one. This goes on the front page.']],
  },
  {
    id: 'dead-in-the-water', title: 'DEAD IN THE WATER', contact: 'dita', place: 'portLockup', reward: { cash: 2200, rep: 160 },
    brief: 'Hit Halcyon Crest\'s shipment on the Port Calder quay.',
    intro: [
      ['dita', 'Crest\'s demolition gear came in on the Calder Star. No gear, no bulldozers.'],
      ['mara', 'Guards?'],
      ['dita', 'Plenty. Bring more bullets than manners.'],
    ],
    steps: [
      { type: 'goto', at: quay, radius: 12, text: 'Go to the quay under the cranes' },
      { type: 'eliminate', kind: 'guard', count: 6, at: quay, spread: 22, text: 'Clear the quay of Crest guards' },
      { type: 'destroyParked', model: 'ridgeback', paint: 0x14a38b, spots: [{ x: quay.x - 8, z: quay.z + 30, heading: 0 }, { x: quay.x + 6, z: quay.z + 52, heading: 0.4 }], text: 'Destroy both Crest supply trucks' },
      { type: 'loseWanted', stars: 3, text: 'Escape the port - lose three stars' },
    ],
    outro: [['dita', 'Half the coast heard that. Take the Breaker - you will need it.']],
    gift: { weapon: 'shotgun', ammo: 40 },
  },
  {
    id: 'glass-houses', title: 'GLASS HOUSES', contact: 'inez', place: 'crestTower', reward: { cash: 3000, rep: 200 },
    brief: 'Hold the plaza of Halcyon Crest Tower while Inez copies the server.',
    intro: [
      ['inez', 'I am inside the tower. I need two minutes on their server and nobody coming up.'],
      ['harrow', 'Quill. Walk away and I forget your name. Last offer.'],
      ['mara', 'Tell Lasker his lieutenant sounds nervous.'],
    ],
    steps: [
      { type: 'eliminate', kind: 'guard', count: 5, extra: { kind: 'enforcer', count: 2 }, at: crestPlaza, spread: 18, text: 'Take out the tower security' },
      { type: 'survive', seconds: 50, stars: 4, text: 'Hold the plaza until Inez is out' },
      { type: 'loseWanted', text: 'Shake the helicopter and escape' },
    ],
    outro: [['inez', 'I have everything. Bribes, forged deeds, Harrow\'s name on the payroll.']],
    gift: { weapon: 'rifle', ammo: 120 },
  },
  {
    id: 'high-tide', title: 'HIGH TIDE', contact: 'bo', place: 'garage', reward: { cash: 10000, rep: 400 }, hour: 17.8,
    brief: 'Victor Lasker is running for the marina. End it on Sunrow Boulevard.',
    intro: [
      ['bo', 'It is all over the Tamarind Times. Lasker is running with the cash.'],
      ['lasker', 'You are a mechanic, Miss Quill. I own the police. I own the road you drive on.'],
      ['mara', 'Then I will take it back one block at a time.'],
    ],
    steps: [
      { type: 'goto', place: 'heightsVilla', text: 'Race to the Lasker Estate' },
      { type: 'destroy', model: 'aurelio', paint: 0x0b0b0d, at: { x: 7 * CITY.pitch - 3.5, z: 2.4 * CITY.pitch, heading: 0 }, text: 'Stop Lasker\'s armoured Aurelio', wanted: 4 },
      { type: 'loseWanted', stars: 5, text: 'Five stars - disappear' },
      { type: 'goto', place: 'garage', text: 'Go home' },
    ],
    outro: [
      ['bo', 'The lease came back. Signed over. The whole seafront, Mara.'],
      ['mara', 'Put the kettle on, Bo. The coast is ours.'],
    ],
  },
];

/** Where a mission's contact waits. */
export function missionPlace(mission) {
  return PLACES[mission.place];
}
