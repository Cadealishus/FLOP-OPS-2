import { el, svg, setText, setStyle, setClass, clamp, damp, ease } from './util.js';
import { LOADOUTS } from '../game/loadouts.js';
import { WEAPON_DEFS } from '../weapons/defs.js';
import { ArmoryPreview } from './armory.js';

export { LOADOUTS } from '../game/loadouts.js';

/**
 * ===========================================================================
 * Front-end screens: the TITLE (mission card + ESF loadout select), the
 * DOUG IS DOWN beat, and the AFTER-ACTION REPORT.
 * ===========================================================================
 *
 * DOM overlays over the HUD chrome. Each fades via a damped `update(rawDt)`
 * driven from the HUD's lateUpdate on UNSCALED time, so they still animate
 * while the game clock is slowed or frozen; nothing uses a CSS transition on a
 * number, which keeps capture frames deterministic.
 *
 * They talk to the rest of the game only through callbacks handed in by the UI
 * system, which turns them into `ui:startRun` / `ui:continue` / `ui:accept` /
 * `ui:restart` / `ui:attract`. The screens never import another subsystem.
 *
 * Tone: the presentation is completely straight. The jokes are in the copy.
 */

/**
 * ESF loadouts. Ids are what `ui:startRun {job}` carries to src/game, which
 * maps them to a weapon and an armour multiplier. `stats` are 0..1 bars for the
 * card, relative to each other, not to any real number.
 */
/** The town's mission card: the fallback when no map registry is published. */
const TOWN_MISSION = [
  ['LOCATION', 'Border town. The square in the middle of it.'],
  ['OBJECTIVE', 'Hold the town square for as long as it takes.'],
  ['DURATION', 'About a wave. (Command estimate.)'],
  ['PLAN', 'Phase one: hold the square. Phase two: Doug.'],
  ['ASSETS', 'Doug.'],
];

/**
 * The map registry, as main.js publishes it on `window.__FLOP_MAPS__`
 * (`{ active, list, select(id) }`, see src/world/maps/index.js). The screens
 * never import the world; without a registry they fall back to the town.
 */
function mapRegistry() {
  const r = globalThis.__FLOP_MAPS__;
  if (r && Array.isArray(r.list) && r.list.length) return r;
  return {
    active: 'town',
    list: [
      {
        id: 'town',
        idx: '01',
        name: 'BORDER TOWN',
        subtitle: 'Border town · the square',
        operation: 'OPERATION TOTAL CONFIDENCE',
        heldNoun: 'The square',
        mission: TOWN_MISSION,
      },
    ],
    select: () => false,
  };
}

/** The active map's registry entry. */
export function activeMap() {
  const r = mapRegistry();
  return r.list.find((m) => m.id === r.active) ?? r.list[0];
}

/** A small top-down plan of a map, from its registry preview rects. */
function mapPreview(parent, m) {
  const pv = m.preview;
  const s = svg('svg', { class: 'ow-mp-plan', viewBox: pv ? pv.box.join(' ') : '0 0 1 1', preserveAspectRatio: 'xMidYMid meet' }, parent);
  if (!pv) return s;
  const fill = { apron: 'rgba(255,255,255,.05)', floor: 'rgba(214,220,226,.34)', block: 'rgba(214,220,226,.16)', plane: 'rgba(236,240,244,.62)', objective: 'currentColor' };
  for (const [x, z, w, d, kind] of pv.rects) {
    const a = { x, y: z, width: w, height: d, fill: fill[kind] ?? fill.block };
    if (kind === 'objective') a.class = 'obj';
    svg('rect', a, s);
  }
  return s;
}

/* Shared damped-fade backbone for a pointer-events overlay. */
function fade(node, shown, open) {
  if (shown < 0.004) {
    setStyle(node, 'display', 'none');
    setStyle(node, 'pointer-events', 'none');
    return;
  }
  setStyle(node, 'display', '');
  setStyle(node, 'pointer-events', open ? 'auto' : 'none');
  setStyle(node, 'opacity', ease.outQuad(shown).toFixed(3));
}

/**
 * Keep a click on a screen from reaching src/core/input, which grabs pointer
 * lock on any left mousedown that bubbles to window. Screens that deploy the
 * player request the lock themselves, inside the click gesture.
 */
function guard(node) {
  node.addEventListener('mousedown', (e) => e.stopPropagation());
}

/** The ESF mark: a plain chevron-over-bar in a square. Not a parody of anything. */
function crest(parent) {
  const s = svg('svg', { viewBox: '0 0 24 24', class: 'ow-crest' }, parent);
  svg('rect', { x: 1, y: 1, width: 22, height: 22, fill: 'none', stroke: 'currentColor', 'stroke-width': 1.5 }, s);
  svg('path', { d: 'M6 13.5 12 8l6 5.5', fill: 'none', stroke: 'currentColor', 'stroke-width': 2.2, 'stroke-linejoin': 'miter' }, s);
  svg('rect', { x: 6, y: 16, width: 12, height: 2.2, fill: 'currentColor' }, s);
  return s;
}

const fmt = (n) => Math.max(0, Math.round(n || 0)).toLocaleString('en-US');

/* ---------------------------------------------------------------- title --- */

export class AttractScreen {
  /** @param {(loadoutId:string)=>void} onSelect */
  constructor(parent, onSelect) {
    this.onSelect = onSelect;
    this.root = el('div', 'ow-attract', parent);
    guard(this.root);

    // ---- top bar -----------------------------------------------------------
    const top = el('div', 'ow-att-top', this.root);
    const unit = el('div', 'ow-att-unit', top);
    crest(unit);
    el('span', null, unit, 'EXTRA SPECIAL FORCES');
    el('div', 'ow-att-net', top, 'SECURE NET · COMMAND');

    // ---- left column: wordmark + mission card ------------------------------
    const left = el('div', 'ow-att-left', this.root);
    el('div', 'ow-att-title', left, 'FLOP OPS');
    el('div', 'ow-att-rule', left);

    const ms = el('div', 'ow-mission', left);
    const mh = el('div', 'ow-ms-head', ms);
    const map = activeMap();
    el('span', 'ow-ms-tag', mh, `MISSION ${map.idx ?? '01'}`);
    el('span', 'ow-ms-sep', mh);
    el('span', 'ow-ms-tag dim', mh, 'BRIEFING');
    el('div', 'ow-ms-name', ms, map.operation);
    const grid = el('div', 'ow-ms-grid', ms);
    for (const [k, v] of map.mission ?? TOWN_MISSION) {
      el('div', 'k', grid, k);
      el('div', 'v', grid, v);
    }

    // ---- map select --------------------------------------------------------
    // One card per registry map. Picking a different one saves the choice and
    // reloads onto it (a map is a whole level build); the active card is lit.
    const reg = mapRegistry();
    this.maps = reg;
    const mp = el('div', 'ow-att-maps', this.root);
    const mph = el('div', 'ow-lo-head', mp);
    el('span', null, mph, 'MAP');
    el('span', 'ow-lo-hint', mph, reg.list.length > 1 ? 'M OR ↑ ↓ TO CHANGE' : '');
    this.mapCards = [];
    reg.list.forEach((m) => {
      const card = el('div', 'ow-mp-card', mp);
      setClass(card, 'on', m.id === reg.active);
      mapPreview(card, m);
      const tx = el('div', 'ow-mp-text', card);
      const t = el('div', 'ow-lo-top', tx);
      el('span', 'ow-lo-idx', t, m.idx ?? '');
      el('span', 'ow-lo-code', t, m.id === reg.active ? 'SELECTED' : 'AVAILABLE');
      el('div', 'ow-mp-name', tx, m.name);
      el('div', 'ow-lo-kit', tx, m.operation);
      el('div', 'ow-mp-sub', tx, m.subtitle ?? '');
      card.addEventListener('click', () => this._pickMap(m.id));
      this.mapCards.push(card);
    });

    // ---- loadout select ----------------------------------------------------
    const lo = el('div', 'ow-att-loadouts', this.root);
    const lh = el('div', 'ow-lo-head', lo);
    el('span', null, lh, 'SELECT LOADOUT');
    el('span', 'ow-lo-hint', lh, 'CLICK OR PRESS 1 – 3 TO DEPLOY');
    const cards = el('div', 'ow-lo-cards', lo);
    this.cards = [];
    this.kitEls = [];
    LOADOUTS.forEach((L, i) => {
      const card = el('div', 'ow-lo-card', cards);
      const t = el('div', 'ow-lo-top', card);
      el('span', 'ow-lo-idx', t, L.idx);
      el('span', 'ow-lo-code', t, L.code);
      const tick = el('div', 'ow-lo-tick', card);
      const ts = svg('svg', { viewBox: '0 0 20 20' }, tick);
      svg('rect', { x: 0.75, y: 0.75, width: 18.5, height: 18.5, fill: 'none', stroke: '#E9B64A', 'stroke-width': 1.5 }, ts);
      svg('path', { d: 'M5 10.4 8.4 13.6 15 6.6', fill: 'none', stroke: '#E9B64A', 'stroke-width': 2 }, ts);
      el('div', 'ow-lo-name', card, L.name);
      this.kitEls.push(el('div', 'ow-lo-kit', card, L.kit));
      el('div', 'ow-lo-desc', card, L.desc);
      const st = el('div', 'ow-lo-stats', card);
      for (const key in L.stats) {
        const r = el('div', 'ow-lo-stat', st);
        el('span', null, r, key);
        const bar = el('i', null, r);
        const fill = el('b', null, bar);
        fill.style.transform = `scaleX(${L.stats[key].toFixed(3)})`;
        el('em', null, r, String(Math.round(L.stats[key] * 100)));
      }
      el('div', 'ow-lo-cta', card, 'DEPLOY');
      card.addEventListener('mouseenter', () => this._focus(i));
      card.addEventListener('click', () => this._deploy(i));
      this.cards.push(card);
    });

    // ---- footer ------------------------------------------------------------
    const foot = el('div', 'ow-att-foot', this.root);
    this.best = el('div', 'ow-att-best', foot, '');
    el('div', 'ow-att-build', foot, 'FLOP OPS · ESF INTERNAL BUILD');

    this.focus = 0;
    this._focus(0);

    this._onKey = (e) => {
      if (!this.open || e.repeat) return;
      if (e.code === 'Digit1' || e.code === 'Digit2' || e.code === 'Digit3') {
        this._deploy(e.code.charCodeAt(5) - 49);
      } else if (e.code === 'ArrowRight') {
        this._focus((this.focus + 1) % this.cards.length);
      } else if (e.code === 'ArrowLeft') {
        this._focus((this.focus + this.cards.length - 1) % this.cards.length);
      } else if (e.code === 'Enter') {
        this._deploy(this.focus);
      } else if (e.code === 'KeyM' || e.code === 'ArrowDown' || e.code === 'ArrowUp') {
        this._stepMap(e.code === 'ArrowUp' ? -1 : 1);
      }
    };
    addEventListener('keydown', this._onKey);

    this.open = false;
    this.shown = 0;
    setStyle(this.root, 'display', 'none');
  }

  _focus(i) {
    this.focus = i;
    for (let j = 0; j < this.cards.length; j++) setClass(this.cards[j], 'on', j === i);
  }

  _stepMap(dir) {
    const list = this.maps.list;
    if (list.length < 2) return;
    let i = list.findIndex((m) => m.id === this.maps.active);
    i = (i + dir + list.length) % list.length;
    this._pickMap(list[i].id);
  }

  /** Save the choice and reload onto the map. No-op for the active one. */
  _pickMap(id) {
    if (!this.open || id === this.maps.active) return;
    for (let j = 0; j < this.mapCards.length; j++) setClass(this.mapCards[j], 'on', this.maps.list[j].id === id);
    this.maps.select?.(id);
  }

  _deploy(i) {
    if (!this.open || !LOADOUTS[i]) return;
    this._focus(i);
    this.onSelect?.(LOADOUTS[i].id);
  }

  /**
   * Weapon designations from src/weapons (`loadoutInfo()` → def.displayName),
   * so the card reads `HARRIER 556 · ASSAULT RIFLE` from the same source as
   * the HUD. @param {Array<{id:string, displayName:string}>|null} info
   */
  setWeaponNames(info) {
    if (!Array.isArray(info)) return;
    LOADOUTS.forEach((L, i) => {
      const w = info.find((x) => x.id === L.weapon);
      if (w?.displayName) setText(this.kitEls[i], `${w.displayName} · ${L.kit}`);
    });
  }

  /** Local best, shown bottom-left. @param {{score:number, wave:number}|null} b */
  setBest(b) {
    if (!b || !(b.score > 0)) {
      setText(this.best, 'NO PREVIOUS OPERATIONS ON FILE');
      return;
    }
    setText(this.best, `PERSONAL BEST  ${fmt(b.score)}  ·  WAVE ${Math.max(1, b.wave | 0)}`);
  }

  show(instant = false) {
    this.open = true;
    if (instant) this.shown = 1;
    setStyle(this.root, 'display', '');
  }

  hide() {
    this.open = false;
  }

  update(rawDt) {
    this.shown = damp(this.shown, this.open ? 1 : 0, 13, rawDt);
    fade(this.root, this.shown, this.open);
  }

  dispose() {
    removeEventListener('keydown', this._onKey);
    this.root.remove();
  }
}

/* -------------------------------------------------------- redesigned front --- */

const FRONT_TABS = [
  ['play', 'PLAY'],
  ['armory', 'LOADOUT / ARMORY'],
  ['operators', 'OPERATORS'],
  ['settings', 'SETTINGS'],
];

function weaponBars(def, armour = 1) {
  return {
    DAMAGE: clamp((def?.damage ?? 0) / 36, 0, 1),
    RANGE: clamp((def?.maxRange ?? 0) / 430, 0, 1),
    'RATE OF FIRE': clamp((def?.rpm ?? 0) / 1000, 0, 1),
    CONTROL: clamp(1 - (def?.recoil?.pitch ?? 0.01) / 0.016, 0, 1),
    PROTECTION: clamp(armour / 2, 0, 1),
  };
}

function statRows(parent, stats) {
  parent.replaceChildren();
  for (const [name, value] of Object.entries(stats)) {
    const row = el('div', 'fo-stat', parent);
    el('span', null, row, name);
    const track = el('i', null, row);
    const fill = el('b', null, track);
    fill.style.transform = `scaleX(${clamp(value, 0, 1).toFixed(3)})`;
    el('em', null, row, String(Math.round(value * 100)));
  }
}

/**
 * Production front end. It deliberately talks to the game through the same
 * callback/event boundary as the old title screen. The armory clones the live
 * procedural WeaponSystem meshes, and every card is generated from the shared
 * loadout catalogue plus WEAPON_DEFS.
 */
export class FrontEndScreen {
  constructor(parent, onSelect, ctx) {
    this.onSelect = onSelect;
    this.ctx = ctx;
    this.root = el('div', 'ow-attract fo-front', parent);
    guard(this.root);

    const shade = el('div', 'fo-shade', this.root);
    const top = el('header', 'fo-top', shade);
    const brand = el('div', 'fo-brand', top);
    crest(brand);
    const brandText = el('div', null, brand);
    el('b', null, brandText, 'FLOP OPS');
    el('span', null, brandText, 'EXTRA SPECIAL FORCES');
    this.tabs = new Map();
    const nav = el('nav', 'fo-tabs', top);
    for (const [id, label] of FRONT_TABS) {
      const button = el('button', 'fo-tab', nav, label);
      button.type = 'button';
      button.addEventListener('click', () => this.setPage(id));
      this.tabs.set(id, button);
    }
    const profile = el('div', 'fo-profile', top);
    el('span', null, profile, 'OPERATOR');
    el('b', null, profile, 'DOUG');
    el('i', null, profile, '55');

    this.pages = new Map();
    const stage = el('main', 'fo-stage', shade);
    this._buildPlay(el('section', 'fo-page fo-play', stage));
    this._buildArmory(el('section', 'fo-page fo-armory', stage));
    this._buildOperators(el('section', 'fo-page fo-operators', stage));
    this._buildSettings(el('section', 'fo-page fo-settings', stage));

    const foot = el('footer', 'fo-footer', shade);
    this.best = el('div', null, foot, 'NO PREVIOUS OPERATIONS ON FILE');
    el('div', null, foot, 'FLOP OPS · BUILD 8.3 · CONFIDENCE AT MAXIMUM');

    this.maps = mapRegistry();
    this.focus = 0;
    this.page = 'play';
    this._selectKit(0);
    this.setPage('play');

    this._onKey = (e) => {
      if (!this.open || e.repeat) return;
      if (/^Digit[1-4]$/.test(e.code)) {
        const i = Number(e.code.slice(-1)) - 1;
        if (LOADOUTS[i]) this._selectKit(i);
      } else if (e.code === 'Enter' && (this.page === 'play' || this.page === 'armory')) {
        this._deploy();
      } else if (e.code === 'ArrowRight' && this.page === 'armory') {
        this._selectKit((this.focus + 1) % LOADOUTS.length);
      } else if (e.code === 'ArrowLeft' && this.page === 'armory') {
        this._selectKit((this.focus + LOADOUTS.length - 1) % LOADOUTS.length);
      }
    };
    addEventListener('keydown', this._onKey);
    this.open = false;
    this.shown = 0;
    setStyle(this.root, 'display', 'none');
  }

  _buildPlay(page) {
    this.pages.set('play', page);
    const hero = el('div', 'fo-hero', page);
    el('div', 'fo-kicker', hero, 'FLOP OPS / DEPLOYMENT');
    el('h1', null, hero, 'NO PLAN.\nFULL CONFIDENCE.');
    el('p', null, hero, 'Hold the objective, survive the waves, and try not to make Command revise the estimate again.');
    const current = el('div', 'fo-current-kit', hero);
    el('span', null, current, 'SELECTED LOADOUT');
    this.playKitName = el('b', null, current, '');
    this.playKitWeapon = el('small', null, current, '');
    this.playDeploy = el('button', 'fo-deploy', hero, 'DEPLOY');
    this.playDeploy.type = 'button';
    this.playDeploy.addEventListener('click', () => this._deploy());

    const side = el('aside', 'fo-play-side', page);
    const map = activeMap();
    el('div', 'fo-section-label', side, `MISSION ${map.idx ?? '01'} / ACTIVE`);
    el('h2', null, side, map.operation);
    el('p', 'fo-map-sub', side, map.subtitle ?? 'Location withheld due to confidence.');
    const brief = el('div', 'fo-brief', side);
    for (const [key, value] of map.mission ?? TOWN_MISSION) {
      el('b', null, brief, key);
      el('span', null, brief, value);
    }
    el('div', 'fo-section-label fo-map-label', side, 'SELECT MAP');
    const maps = el('div', 'fo-map-list', side);
    this.mapButtons = [];
    const registry = mapRegistry();
    this.maps = registry;
    registry.list.forEach((entry) => {
      const button = el('button', 'fo-map-button', maps);
      button.type = 'button';
      mapPreview(button, entry);
      const copy = el('span', null, button);
      el('b', null, copy, entry.name);
      el('small', null, copy, entry.id === registry.active ? 'ACTIVE OPERATION' : 'LOAD OPERATION');
      button.classList.toggle('on', entry.id === registry.active);
      button.addEventListener('click', () => this._pickMap(entry.id));
      this.mapButtons.push(button);
    });
  }

  _buildArmory(page) {
    this.pages.set('armory', page);
    const list = el('aside', 'fo-weapon-list', page);
    el('div', 'fo-section-label', list, 'ACTIVE ARSENAL');
    el('h2', null, list, 'ARMORY');
    el('p', null, list, 'Real issued weapons. No donor rifles. No attachment supernova.');
    this.weaponButtons = [];
    LOADOUTS.forEach((kit, i) => {
      const def = WEAPON_DEFS[kit.weapon];
      const button = el('button', 'fo-weapon-button', list);
      button.type = 'button';
      el('span', null, button, kit.idx);
      const copy = el('div', null, button);
      el('b', null, copy, def?.displayName ?? kit.weapon.toUpperCase());
      el('small', null, copy, kit.role);
      button.addEventListener('click', () => this._selectKit(i));
      this.weaponButtons.push(button);
    });

    const viewer = el('div', 'fo-weapon-view', page);
    el('div', 'fo-view-label', viewer, 'LIVE PROCEDURAL MODEL · DRAG-FREE INSPECTION');
    const canvas = el('canvas', null, viewer);
    this.preview = new ArmoryPreview(canvas, this.ctx);
    el('div', 'fo-view-floor', viewer);

    const detail = el('aside', 'fo-weapon-detail', page);
    el('div', 'fo-section-label', detail, 'WEAPON PROFILE');
    this.weaponName = el('h2', null, detail, '');
    this.weaponClass = el('div', 'fo-detail-class', detail, '');
    this.weaponBlurb = el('p', null, detail, '');
    this.weaponFacts = el('div', 'fo-facts', detail);
    this.weaponStats = el('div', 'fo-stats', detail);
    const fixed = el('div', 'fo-fixed', detail);
    el('b', null, fixed, 'FIELD CONFIGURATION');
    el('span', null, fixed, 'FIXED / FACTORY-FITTED');
    el('small', null, fixed, 'Attachments stay attached to the weapon. Revolutionary.');
    this.armoryDeploy = el('button', 'fo-deploy', detail, 'EQUIP & DEPLOY');
    this.armoryDeploy.type = 'button';
    this.armoryDeploy.addEventListener('click', () => this._deploy());
  }

  _buildOperators(page) {
    this.pages.set('operators', page);
    const card = el('div', 'fo-operator-card', page);
    el('div', 'fo-op-number', card, '01');
    el('div', 'fo-section-label', card, 'CURRENT OPERATOR / EQUIPPED');
    el('h1', null, card, 'DOUG');
    el('div', 'fo-op-tags', card, 'EXTRA SPECIAL FORCES · LEVEL 55 · AVAILABLE');
    el('p', null, card, 'Command requested one highly trained operator. Procurement found Doug. The mission has been adjusted around this fact.');
    const grid = el('div', 'fo-op-grid', card);
    for (const [k, v] of [
      ['SPECIALTY', 'SHOWING UP'],
      ['STATUS', 'SURPRISINGLY READY'],
      ['PASSIVE', 'TOTAL CONFIDENCE'],
      ['ALTERNATES', 'PENDING BUDGET'],
    ]) {
      el('span', null, grid, k);
      el('b', null, grid, v);
    }
    el('div', 'fo-op-note', card, 'Doug is the complete operator roster for this single-player build. Future operators can be added here without pretending they already exist.');
  }

  _buildSettings(page) {
    this.pages.set('settings', page);
    const panel = el('div', 'fo-settings-panel', page);
    el('div', 'fo-section-label', panel, 'LIVE GAME SETTINGS');
    el('h1', null, panel, 'SETTINGS');
    el('p', null, panel, 'These controls update the same configuration used in gameplay. No decorative sliders were harmed.');
    const rows = el('div', 'fo-settings-rows', panel);

    const quality = el('div', 'fo-setting-row', rows);
    el('span', null, quality, 'GRAPHICS PRESET');
    const qButtons = el('div', 'fo-choice', quality);
    this.qualityButtons = [];
    for (const name of ['low', 'medium', 'high', 'ultra']) {
      const button = el('button', null, qButtons, name);
      button.type = 'button';
      button.addEventListener('click', () => {
        this.ctx.config.setQuality(name);
        this.ctx.events.emit('ui:quality', { quality: name });
        this._syncSettings();
      });
      this.qualityButtons.push([button, name]);
    }

    this.fovInput = this._settingRange(rows, 'FIELD OF VIEW', 65, 120, 1, this.ctx.config.fov ?? 80, (value) => {
      this.ctx.config.fov = value;
      if (this.ctx.camera) {
        this.ctx.camera.fov = value;
        this.ctx.camera.updateProjectionMatrix();
      }
      this.ctx.events.emit('ui:fov', { value });
    });
    this.sensInput = this._settingRange(rows, 'MOUSE SENSITIVITY', 0.2, 3, 0.05, (this.ctx.config.sensitivity ?? 0.0022) / 0.0022, (value) => {
      this.ctx.config.sensitivity = value * 0.0022;
      this.ctx.events.emit('ui:sensitivity', { value: this.ctx.config.sensitivity, multiplier: value });
    });

    const invert = el('div', 'fo-setting-row', rows);
    el('span', null, invert, 'INVERT LOOK');
    const inv = el('div', 'fo-choice', invert);
    this.invertButtons = [];
    for (const [label, value] of [['off', false], ['on', true]]) {
      const button = el('button', null, inv, label);
      button.type = 'button';
      button.addEventListener('click', () => {
        this.ctx.config.invertY = value;
        this.ctx.events.emit('ui:setting', { key: 'invertY', value });
        this._syncSettings();
      });
      this.invertButtons.push([button, value]);
    }
    const reset = el('button', 'fo-reset', panel, 'RESTORE DEFAULTS');
    reset.type = 'button';
    reset.addEventListener('click', () => {
      this.ctx.config.setQuality('ultra');
      this.ctx.config.fov = 80;
      this.ctx.config.sensitivity = 0.0022;
      this.ctx.config.invertY = false;
      this.fovInput.set(80);
      this.sensInput.set(1);
      if (this.ctx.camera) {
        this.ctx.camera.fov = 80;
        this.ctx.camera.updateProjectionMatrix();
      }
      this.ctx.events.emit('ui:quality', { quality: 'ultra' });
      this.ctx.events.emit('ui:fov', { value: 80 });
      this.ctx.events.emit('ui:sensitivity', { value: 0.0022, multiplier: 1 });
      this.ctx.events.emit('ui:setting', { key: 'invertY', value: false });
      this._syncSettings();
    });
    this._syncSettings();
  }

  _settingRange(parent, label, min, max, step, initial, apply) {
    const row = el('label', 'fo-setting-row fo-range', parent);
    el('span', null, row, label);
    const input = el('input', null, row);
    input.type = 'range';
    input.min = String(min);
    input.max = String(max);
    input.step = String(step);
    const out = el('b', null, row, '');
    const set = (value) => {
      input.value = String(value);
      out.textContent = Number(value).toFixed(step < 1 ? 2 : 0);
    };
    input.addEventListener('input', () => {
      const value = Number(input.value);
      set(value);
      apply(value);
    });
    set(initial);
    return { input, set };
  }

  _syncSettings() {
    for (const [button, name] of this.qualityButtons ?? []) button.classList.toggle('on', this.ctx.config.quality === name);
    for (const [button, value] of this.invertButtons ?? []) button.classList.toggle('on', !!this.ctx.config.invertY === value);
  }

  setPage(id) {
    if (!this.pages.has(id)) id = 'play';
    this.page = id;
    for (const [key, page] of this.pages) page.classList.toggle('on', key === id);
    for (const [key, button] of this.tabs) button.classList.toggle('on', key === id);
    this.preview?.setVisible(id === 'armory' && this.open);
    if (id === 'settings') this._syncSettings();
  }

  _selectKit(index) {
    const kit = LOADOUTS[index] ?? LOADOUTS[0];
    const def = WEAPON_DEFS[kit.weapon] ?? {};
    this.focus = LOADOUTS.indexOf(kit);
    for (let i = 0; i < (this.weaponButtons?.length ?? 0); i++) this.weaponButtons[i].classList.toggle('on', i === this.focus);
    setText(this.playKitName, `${kit.code} / ${kit.name}`);
    setText(this.playKitWeapon, `${def.displayName ?? kit.weapon.toUpperCase()} · ${kit.role}`);
    setText(this.weaponName, def.displayName ?? kit.weapon.toUpperCase());
    setText(this.weaponClass, `${kit.code} LOADOUT · ${kit.role}`);
    setText(this.weaponBlurb, def.blurb ?? kit.desc);
    if (this.weaponFacts) {
      this.weaponFacts.replaceChildren();
      for (const [k, v] of [
        ['CALIBER', def.caliber ?? '—'],
        ['CAPACITY', `${def.magSize ?? 0} ROUNDS`],
        ['CYCLIC RATE', `${def.rpm ?? 0} RPM`],
        ['FIRE MODES', (def.modes ?? []).join(' / ').toUpperCase()],
      ]) {
        el('span', null, this.weaponFacts, k);
        el('b', null, this.weaponFacts, v);
      }
    }
    if (this.weaponStats) statRows(this.weaponStats, weaponBars(def, kit.armour));
    this.preview?.setWeapon(kit.weapon);
  }

  _deploy() {
    if (!this.open) return;
    this.onSelect?.((LOADOUTS[this.focus] ?? LOADOUTS[0]).id);
  }

  _pickMap(id) {
    if (!this.open || id === this.maps.active) return;
    this.maps.select?.(id);
  }

  setWeaponNames() {
    // Names are already sourced directly from WEAPON_DEFS. Kept as a no-op for
    // UiSystem's stable screen interface.
  }

  setBest(record) {
    setText(this.best, record?.score > 0
      ? `PERSONAL BEST ${fmt(record.score)} · WAVE ${Math.max(1, record.wave | 0)}`
      : 'NO PREVIOUS OPERATIONS ON FILE');
  }

  show(instant = false) {
    this.open = true;
    if (instant) this.shown = 1;
    setStyle(this.root, 'display', '');
    this.preview?.setVisible(this.page === 'armory');
  }

  hide() {
    this.open = false;
    this.preview?.setVisible(false);
  }

  update(rawDt) {
    this.shown = damp(this.shown, this.open ? 1 : 0, 13, rawDt);
    fade(this.root, this.shown, this.open);
  }

  dispose() {
    removeEventListener('keydown', this._onKey);
    this.preview?.dispose();
    this.root.remove();
  }
}

/* ---------------------------------------------------------------- death --- */

const DOWN_BODY = {
  canContinue:
    'Command has been notified. Command has approved one (1) additional chance, pending paperwork.',
  final: 'Command has been notified. Command is out of additional chances. Command had one.',
};

export class DeathScreen {
  /** @param {{onContinue:()=>void, onAccept:()=>void}} cbs */
  constructor(parent, { onContinue, onAccept }) {
    this.onContinue = onContinue;
    this.onAccept = onAccept;
    this.root = el('div', 'ow-screen death', parent);
    guard(this.root);
    const band = el('div', 'ow-death', this.root);

    el('div', 'ow-sc-kicker', band, activeMap().operation);
    el('div', 'ow-sc-title', band, 'DOUG IS DOWN');
    this.killer = el('div', 'ow-death-killer', band, '');
    this.body = el('div', 'ow-sc-body', band, DOWN_BODY.canContinue);

    const actions = el('div', 'ow-sc-actions', band);
    this.contBtn = el('button', 'ow-btn primary', actions, 'REQUEST ONE (1) MORE CHANCE');
    this.contBtn.type = 'button';
    this.contBtn.addEventListener('click', () => {
      if (this._settled) return;
      this._settled = true;
      this.onContinue?.();
    });
    this.acceptBtn = el('button', 'ow-sc-ghost', actions, 'ACCEPT THE OUTCOME');
    this.acceptBtn.type = 'button';
    this.acceptBtn.addEventListener('click', () => {
      if (this._settled) return;
      this._settled = true;
      // Emits ui:accept; the report arrives with game:over.
      setStyle(this.acceptBtn, 'opacity', '.4');
      setStyle(this.contBtn, 'opacity', '.4');
      setText(this.acceptBtn, 'FILING REPORT…');
      this.onAccept?.();
    });

    this.open = false;
    this.shown = 0;
    setStyle(this.root, 'display', 'none');
  }

  /** @param {{canContinue?:boolean, killer?:string|null}} opts */
  show({ canContinue = true, killer = null } = {}) {
    this.open = true;
    this._settled = false;
    setStyle(this.contBtn, 'display', canContinue ? '' : 'none');
    setStyle(this.contBtn, 'opacity', '1');
    setStyle(this.acceptBtn, 'opacity', '1');
    setText(this.acceptBtn, canContinue ? 'ACCEPT THE OUTCOME' : 'FILE THE REPORT');
    setText(this.body, canContinue ? DOWN_BODY.canContinue : DOWN_BODY.final);
    if (killer) {
      setText(this.killer, 'KILLED BY  ' + killer);
      setStyle(this.killer, 'display', '');
    } else if (killer === null) {
      setStyle(this.killer, 'display', 'none');
    }
    setStyle(this.root, 'display', '');
  }

  hide() {
    this.open = false;
  }

  update(rawDt) {
    this.shown = damp(this.shown, this.open ? 1 : 0, 15, rawDt);
    fade(this.root, this.shown, this.open);
  }

  dispose() {
    this.root.remove();
  }
}

/* -------------------------------------------------------- after-action --- */

/**
 * Command's assessment. Deterministic from the run's numbers, so the same run
 * always reads the same report.
 */
export function assessment(d = {}) {
  const wave = Math.max(1, Math.round(d.wave ?? 1));
  const held = wave - 1;
  const lines = [];
  const noun = activeMap().heldNoun ?? 'The square';

  if (held <= 0) {
    lines.push(
      `${noun} was held for less than one wave against an estimate of about one wave. Command considers the estimate broadly accurate.`
    );
  } else if (held === 1) {
    lines.push(`${noun} was held for one wave, exactly as estimated. Command would like that noted.`);
  } else if (held <= 3) {
    lines.push(`${noun} was held for ${held} waves against an estimate of about one. Command considers this within tolerance.`);
  } else {
    lines.push(`${noun} was held for ${held} waves. Command's estimate was "about a wave". Command is not taking questions.`);
  }

  let acc = d.accuracy;
  if (acc === null || acc === undefined) {
    lines.push('No rounds were fired. Command admires the restraint.');
  } else {
    if (acc <= 1) acc *= 100;
    const a = Math.round(acc);
    if (a < 20) lines.push(`Accuracy was ${a}%. The remaining rounds are being treated as a message.`);
    else if (a < 45) lines.push(`Accuracy was ${a}%. Ammunition expenditure is within ESF norms, which are generous.`);
    else lines.push(`Accuracy was ${a}%. Command has asked Doug to stop making everyone else look bad.`);
  }

  lines.push(
    d.continued
      ? 'One (1) additional chance was requested and used. It has been filed under "chances".'
      : 'No additional chances were requested. Command is unsure whether to be proud.'
  );
  return lines;
}

export class GameOverScreen {
  /**
   * @param {HTMLElement} parent
   * @param {{onRestart:()=>void, onReturn:()=>void}} cbs
   */
  constructor(parent, cbs = {}) {
    const { onRestart, onReturn } = cbs;
    this.root = el('div', 'ow-screen report', parent);
    guard(this.root);
    const card = el('div', 'ow-report', this.root);

    const head = el('div', 'ow-rp-head', card);
    el('span', 'ow-rp-kicker', head, 'AFTER-ACTION REPORT');
    el('span', 'ow-rp-op', head, activeMap().operation);

    this.title = el('div', 'ow-sc-title', card, 'OPERATION CONCLUDED');

    const sc = el('div', 'ow-rp-score', card);
    this.score = el('div', 'ow-sc-score', sc, '0');
    el('div', 'ow-rp-unit', sc, 'POINTS');
    this.delta = el('div', 'ow-sc-delta', card, '');

    const stats = el('div', 'ow-sc-stats', card);
    this.stat = {};
    for (const [key, label] of [
      ['WAVE', 'WAVE REACHED'],
      ['KILLS', 'HOSTILES NEUTRALISED'],
      ['ACCURACY', 'ACCURACY'],
      ['BEST', 'PERSONAL BEST'],
    ]) {
      const s = el('div', 'ow-sc-stat', stats);
      el('div', 'k', s, label);
      this.stat[key] = el('div', 'v', s, '—');
    }

    const as = el('div', 'ow-rp-assess', card);
    el('div', 'ow-rp-lbl', as, 'COMMAND ASSESSMENT');
    this.assess = [];
    for (let i = 0; i < 3; i++) this.assess.push(el('p', null, as, ''));

    const actions = el('div', 'ow-sc-actions', card);
    this.restartBtn = el('button', 'ow-btn primary', actions, 'REDEPLOY');
    this.restartBtn.type = 'button';
    this.restartBtn.addEventListener('click', () => onRestart?.());
    this.returnBtn = el('button', 'ow-sc-ghost', actions, 'RETURN TO BASE');
    this.returnBtn.type = 'button';
    this.returnBtn.addEventListener('click', () => onReturn?.());

    this.open = false;
    this.shown = 0;
    setStyle(this.root, 'display', 'none');
  }

  /** @param {object} d game:over payload */
  setData(d = {}) {
    const score = Math.max(0, Math.round(d.score ?? 0));
    const best = Math.max(0, Math.round(d.best ?? 0));
    const newBest = !!d.newBest;

    setClass(this.root, 'best', newBest);
    setText(this.title, newBest ? 'NEW PERSONAL BEST' : 'OPERATION CONCLUDED');
    setText(this.score, fmt(score));

    if (newBest) {
      setClass(this.delta, 'miss', false);
      setText(this.delta, 'COMMAND WILL BE TAKING CREDIT FOR THIS');
    } else {
      const gap = Math.max(0, best - score);
      setClass(this.delta, 'miss', gap > 0);
      setText(this.delta, gap > 0 ? `${fmt(gap)} SHORT OF YOUR BEST` : 'MATCHED YOUR PERSONAL BEST');
    }

    let acc = d.accuracy;
    let accTxt = '—';
    if (acc !== null && acc !== undefined) {
      if (acc <= 1) acc *= 100;
      accTxt = Math.round(acc) + '%';
    }
    setText(this.stat.WAVE, Math.max(1, Math.round(d.wave ?? 1)));
    setText(this.stat.KILLS, Math.max(0, Math.round(d.kills ?? 0)));
    setText(this.stat.ACCURACY, accTxt);
    setText(this.stat.BEST, fmt(best));

    const lines = assessment(d);
    for (let i = 0; i < this.assess.length; i++) setText(this.assess[i], lines[i] ?? '');
  }

  show(d) {
    if (d) this.setData(d);
    this.open = true;
    setStyle(this.root, 'display', '');
  }

  hide() {
    this.open = false;
  }

  update(rawDt) {
    this.shown = damp(this.shown, this.open ? 1 : 0, 15, rawDt);
    fade(this.root, this.shown, this.open);
  }

  dispose() {
    this.root.remove();
  }
}
