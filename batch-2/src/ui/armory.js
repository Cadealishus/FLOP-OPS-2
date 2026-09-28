import * as THREE from 'three';

/**
 * Menu-time viewer for the exact procedural meshes already built by the live
 * WeaponSystem. Geometry is shared; armory-only neutral studio materials keep
 * the model readable outside the game's custom first-person lighting pass. The
 * armory does not carry a donor GLB, a second catalogue, or placeholder blocks.
 */
export class ArmoryPreview {
  constructor(canvas, ctx) {
    this.canvas = canvas;
    this.ctx = ctx;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(32, 1, 0.01, 20);
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.5));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.25;
    this.renderer.setClearColor(0x000000, 0);

    const key = new THREE.DirectionalLight(0xffe9dc, 4.2);
    key.position.set(-2.5, 3.2, 3.4);
    const fill = new THREE.DirectionalLight(0x91b9ff, 2.0);
    fill.position.set(2.8, 0.5, -2.2);
    const rim = new THREE.DirectionalLight(0xff3434, 2.4);
    rim.position.set(1.5, 2, 3.6);
    this.scene.add(key, fill, rim, new THREE.HemisphereLight(0xb5c9e8, 0x251511, 1.35));

    this.pivot = new THREE.Group();
    this.scene.add(this.pivot);
    this.previewMaterials = new Map();
    this.weaponId = null;
    this.ready = false;
    this.visible = false;
    this._raf = 0;
    this._last = performance.now();
    this._observer = new ResizeObserver(() => this.resize());
    this._observer.observe(canvas);
    this._tick = (now) => {
      if (!this.canvas.isConnected) return;
      const dt = Math.min(0.05, Math.max(0, (now - this._last) / 1000));
      this._last = now;
      if (!this.ready) this._connect();
      if (this.visible && this.ready) {
        this.pivot.rotation.y += dt * 0.16;
        this.renderer.render(this.scene, this.camera);
      }
      this._raf = requestAnimationFrame(this._tick);
    };
    this.resize();
    this._raf = requestAnimationFrame(this._tick);
  }

  _connect() {
    const weapons = this.ctx.peek('weapons');
    if (!weapons?.viewmodel?.weapons?.size) return;
    this.scene.environment = this.ctx.scene?.environment ?? null;
    this.ready = true;
    this.setWeapon(this.weaponId ?? weapons.weaponIds?.[0] ?? 'carbine');
  }

  setWeapon(id) {
    this.weaponId = id;
    if (!this.ready) return;
    const entry = this.ctx.peek('weapons')?.viewmodel?.weapons?.get(id);
    if (!entry) return;
    this.pivot.clear();
    const clone = entry.group.clone(true);
    clone.visible = true;
    clone.traverse((node) => {
      node.visible = true;
      if (node.isMesh) node.material = this._studioMaterial(node.name);
    });
    this.pivot.add(clone);
    this.pivot.rotation.set(-0.08, -0.42, -0.02);
    clone.updateMatrixWorld(true);

    const box = new THREE.Box3().setFromObject(clone);
    const centre = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    clone.position.sub(centre);
    const radius = Math.max(size.x, size.y, size.z) * 0.58;
    const halfV = THREE.MathUtils.degToRad(this.camera.fov * 0.5);
    const distance = radius / Math.tan(halfV * 1.6);
    this.camera.position.set(distance * 0.78, distance * 0.34, distance);
    this.camera.lookAt(0, 0, 0);
    this.camera.updateProjectionMatrix();
  }

  _studioMaterial(name = '') {
    const key = String(name).split('-').at(-1);
    if (this.previewMaterials.has(key)) return this.previewMaterials.get(key);
    const metal = /steel|alu|brass|copper|knurl/.test(key);
    let color = 0x34383d;
    if (/tan/.test(key)) color = 0x786b50;
    else if (/polymer|rubber|cavity|inner|tunnel/.test(key)) color = 0x242628;
    else if (/steel_bright/.test(key)) color = 0x8a9094;
    else if (/brass/.test(key)) color = 0x9b7130;
    else if (/copper/.test(key)) color = 0x87452c;
    const opts = { color, roughness: metal ? 0.34 : 0.68, metalness: metal ? 0.82 : 0.05 };
    if (/glass/.test(key)) Object.assign(opts, { color: 0x36566b, roughness: 0.12, metalness: 0, transparent: true, opacity: 0.58 });
    const material = new THREE.MeshStandardMaterial(opts);
    this.previewMaterials.set(key, material);
    return material;
  }

  setVisible(value) {
    this.visible = !!value;
    if (this.visible) this.resize();
  }

  resize() {
    const w = Math.max(2, this.canvas.clientWidth | 0);
    const h = Math.max(2, this.canvas.clientHeight | 0);
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  dispose() {
    cancelAnimationFrame(this._raf);
    this._observer.disconnect();
    this.pivot.clear();
    for (const material of this.previewMaterials.values()) material.dispose();
    this.previewMaterials.clear();
    this.renderer.dispose();
  }
}
