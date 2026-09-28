/**
 * Playable kits shared by the front end and the game loop.
 *
 * Add a weapon to `src/weapons/defs.js` and its builder to the weapon system,
 * then add one row here to expose it in PLAY and ARMORY. Keeping this mapping
 * outside the UI prevents a menu card from silently drifting away from the
 * weapon and armour values the game actually deploys.
 */
export const LOADOUTS = [
  {
    id: 'alpha',
    weapon: 'carbine',
    armour: 1,
    idx: '01',
    code: 'ALPHA',
    name: 'STANDARD ISSUE',
    role: 'ASSAULT CARBINE',
    desc: "Command's first choice. Also its second choice, after a short meeting.",
  },
  {
    id: 'bravo',
    weapon: 'rifle',
    armour: 1,
    idx: '02',
    code: 'BRAVO',
    name: 'LONG ARGUMENT',
    role: 'RIFLE',
    desc: 'A little longer, a little steadier, and approved for disagreements at range.',
  },
  {
    id: 'charlie',
    weapon: 'smg',
    armour: 1,
    idx: '03',
    code: 'CHARLIE',
    name: 'ROOM SERVICE',
    role: 'SUBMACHINE GUN',
    desc: 'Fast handling for rooms, corridors and very compact misunderstandings.',
  },
  {
    id: 'delta',
    weapon: 'pistol',
    armour: 2,
    idx: '04',
    code: 'DELTA',
    name: 'CONTINGENCY',
    role: 'SIDEARM · DOUBLE PLATING',
    desc: 'One pistol, twice the health. Doug has reviewed the maths and found a pistol.',
  },
];

export const DEFAULT_JOB = LOADOUTS[0].id;

export function getLoadout(id) {
  return LOADOUTS.find((kit) => kit.id === id) ?? LOADOUTS[0];
}

export const LOADOUT_ALIASES = Object.fromEntries(LOADOUTS.map((kit) => [kit.weapon, kit.id]));
