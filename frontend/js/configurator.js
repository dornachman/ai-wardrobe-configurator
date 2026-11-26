// 3D configurator page: asks the backend for the canonical design and renders it.
// The design returned by the API is the only source of geometry; camera position, open
// doors and hidden doors are view state and never change the design.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

import { mountAssistant } from './ai/assistant.js';
import { applyDraftOperations, ensureDraft } from './state/draft.js';
import { buildWardrobe, disposeWardrobe } from './three/wardrobe.js';

// Example limits, mirrored from the backend catalog only to clamp the inputs before a request.
const LIMITS = { width: [1200, 3600], height: [1800, 2800], depth: [450, 750] };
const DEFAULTS = { width: 2400, height: 2400, depth: 600 };
const EASE = 0.14;
const REQUEST_DELAY_MS = 120;

const $ = (id) => document.getElementById(id);
const clamp = (field, value) => Math.min(LIMITS[field][1], Math.max(LIMITS[field][0], Math.round(value) || DEFAULTS[field]));

const query = new URLSearchParams(location.search);
let view = { doorsOpen: query.get('doors') === 'open', doorsHidden: query.get('doors') === 'hidden' };
let design = null;
let dimensions = { ...DEFAULTS };
let wardrobe = null;
let openness = new Map(); // component id -> { current, target } in 0..1
let cameraGoal = null;
let pending = new Map(); // operation key -> operation, sent together as one batch
let commitTimer = null;

// ---------- scene ----------
const container = $('three-canvas-container');
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xf6f0e8);

const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 1000);
camera.position.set(2.8, 2.0, 3.8);

const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
// WCAG 1.1.1: the canvas is non-text content; every value it shows is also in the side panel as text.
renderer.domElement.setAttribute('role', 'img');
renderer.domElement.setAttribute('aria-label', '3D preview of your wardrobe. Dimensions, bays and materials are listed in the panel beside it.');
container.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.05;
controls.maxPolarAngle = Math.PI / 2 + 0.02;
controls.minDistance = 1.8;
controls.maxDistance = 7.0;
controls.target.set(0, 1.2, 0);
controls.addEventListener('start', () => { cameraGoal = null; });

scene.add(new THREE.AmbientLight(0xfffaea, 2.2));
const sun = new THREE.DirectionalLight(0xfff3e3, 3.2);
sun.position.set(3, 5, 4);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.bias = -0.0004;
Object.assign(sun.shadow.camera, { near: 0.5, far: 12, left: -2.5, right: 2.5, top: 2.5, bottom: -2.5 });
scene.add(sun);
const rim = new THREE.DirectionalLight(0xc2652a, 0.8);
rim.position.set(-4, 3, -3);
scene.add(rim);

const floor = new THREE.Mesh(new THREE.PlaneGeometry(16, 16), new THREE.ShadowMaterial({ opacity: 0.12 }));
floor.rotation.x = -Math.PI / 2;
floor.receiveShadow = true;
scene.add(floor);

const standard = (color, roughness, metalness) => new THREE.MeshStandardMaterial({ color, roughness, metalness });
const PALETTE = {
  carcass: { oak: standard(0xb58c65, 0.65, 0.05), walnut: standard(0x4e3a2e, 0.6, 0.05), linen: standard(0xdcd3c4, 0.85, 0.02) },
  doors: { cashmere: standard(0xe5ded4, 0.45, 0.04), fluted: standard(0xa9825b, 0.6, 0.05), umber: standard(0x3d332d, 0.7, 0.08) },
  handle: standard(0xce9e58, 0.32, 0.82),
  metal: standard(0xb8b2aa, 0.35, 0.4),
};

// ---------- status message ----------
const status = document.createElement('p');
status.className = 'absolute inset-x-0 top-1/2 text-center text-sm text-on-surface-variant pointer-events-none';
status.setAttribute('role', 'status');
container.appendChild(status);

// ---------- design -> scene ----------
function renderDesign() {
  if (wardrobe) {
    scene.remove(wardrobe.group);
    disposeWardrobe(wardrobe.group);
  }
  wardrobe = buildWardrobe(design, {
    carcass: PALETTE.carcass[design.material_selections.carcass],
    door: PALETTE.doors[design.material_selections.doors],
    handle: PALETTE.handle,
    metal: PALETTE.metal,
  });
  // Keep each part's open state across rebuilds; doors follow the shared toggle.
  openness = new Map(wardrobe.movers.map((mover) => {
    const target = mover.type === 'door' ? Number(view.doorsOpen) : (openness.get(mover.id)?.target ?? 0);
    return [mover.id, { current: target, target }];
  }));
  wardrobe.movers.forEach((mover) => {
    mover.apply(openness.get(mover.id).current);
    if (mover.type === 'door') mover.object.visible = !view.doorsHidden;
  });
  scene.add(wardrobe.group);
  controls.target.set(0, design.dimensions_mm.height / 2000, 0);
  updateLabels();
}

function showDesign(next) {
  design = next;
  dimensions = { ...design.dimensions_mm };
  status.textContent = '';
  syncInputs();
  showType();
  showMaterials();
  renderDesign();
}

// Queue an edit; rapid edits of the same kind collapse into the latest one.
function commit(key, operation) {
  pending.set(key, operation);
  clearTimeout(commitTimer);
  commitTimer = setTimeout(async () => {
    const operations = [...pending.values()];
    pending = new Map();
    try {
      showDesign(await applyDraftOperations(operations));
    } catch (error) {
      if (design) showDesign(design); // put the controls back on the last valid design
      status.textContent = `Could not update the design: ${error.message}`;
    }
  }, REQUEST_DELAY_MS);
}

// ---------- labels and inputs ----------
function updateLabels() {
  const { width, height, depth } = design.dimensions_mm;
  const { bays, count } = design.door_configuration;
  $('label-width-overlay').textContent = `${width} mm`;
  $('label-height-overlay').textContent = `${height} mm`;
  $('label-depth-overlay').textContent = `${depth} mm`;
  $('calculated-bay-width-summary').textContent = `${bays} bays`;
  $('bay-badge').textContent = `${bays} bays`;
  design.layout.bays.forEach((bay, i) => {
    const label = $(`bay${i + 1}-width-label`);
    if (label) label.textContent = `${bay.width_mm}mm`;
  });
  $('door-count-text').textContent = `${count} ${design.wardrobe_type} doors`;
}

function syncInputs() {
  Object.keys(LIMITS).forEach((field) => {
    $(`slider-${field}`).value = dimensions[field];
    $(`input-${field}`).value = dimensions[field];
  });
}

function setDimension(field, value) {
  dimensions = { ...dimensions, [field]: clamp(field, value) };
  syncInputs();
  commit('dimensions', { op: 'set_dimensions', dimensions_mm: dimensions });
}

Object.keys(LIMITS).forEach((field) => {
  $(`slider-${field}`).addEventListener('input', (e) => setDimension(field, Number(e.target.value)));
  $(`input-${field}`).addEventListener('change', (e) => setDimension(field, Number(e.target.value)));
});
document.querySelectorAll('[data-step-dim]').forEach((btn) => {
  btn.addEventListener('click', () => setDimension(btn.dataset.stepDim, dimensions[btn.dataset.stepDim] + Number(btn.dataset.step)));
});

const TITLES = {
  carcass: { oak: 'Example Oak finish', walnut: 'Example Walnut finish', linen: 'Example Linen finish' },
  doors: { cashmere: 'Example light finish', fluted: 'Example fluted finish', umber: 'Example dark finish' },
};
function showMaterials() {
  const { carcass, doors } = design.material_selections;
  $('selected-carcass-title').textContent = TITLES.carcass[carcass];
  $('selected-door-title').textContent = TITLES.doors[doors];
  document.querySelectorAll('[data-carcass]').forEach((btn) => {
    btn.classList.toggle('ring-2', btn.dataset.carcass === carcass);
    btn.classList.toggle('ring-primary', btn.dataset.carcass === carcass);
  });
  document.querySelectorAll('input[name="door-finish"]').forEach((radio) => { radio.checked = radio.value === doors; });
}
const setMaterial = (slot, key) => commit(`material:${slot}`, { op: 'set_material', slot, key });
document.querySelectorAll('[data-carcass]').forEach((btn) => btn.addEventListener('click', () => setMaterial('carcass', btn.dataset.carcass)));
document.querySelectorAll('input[name="door-finish"]').forEach((radio) => radio.addEventListener('change', () => setMaterial('doors', radio.value)));

// ---------- wardrobe type ----------
const typeButtons = { hinged: $('type-hinged'), sliding: $('type-sliding') };
function showType() {
  Object.entries(typeButtons).forEach(([key, btn]) => {
    const active = key === design?.wardrobe_type;
    ['bg-surface-container-high', 'text-on-surface', 'font-semibold'].forEach((c) => btn.classList.toggle(c, active));
    btn.classList.toggle('text-on-surface-variant', !active);
  });
}
Object.entries(typeButtons).forEach(([key, btn]) => {
  btn.addEventListener('click', () => commit('type', { op: 'set_wardrobe_type', wardrobe_type: key }));
});

// ---------- doors and drawers (view state only) ----------
function showDoorState() {
  $('door-action-text').textContent = view.doorsOpen ? 'Close Doors' : 'Open Doors';
  $('btn-inspect-interior').classList.toggle('bg-primary', view.doorsHidden);
  $('btn-inspect-interior').classList.toggle('text-on-primary', view.doorsHidden);
}

function toggleDoors() {
  view = { ...view, doorsOpen: !view.doorsOpen };
  wardrobe?.movers.filter((m) => m.type === 'door').forEach((m) => { openness.get(m.id).target = Number(view.doorsOpen); });
  showDoorState();
}

$('btn-toggle-doors').addEventListener('click', toggleDoors);
$('btn-inspect-interior').addEventListener('click', () => {
  view = { ...view, doorsHidden: !view.doorsHidden };
  wardrobe?.movers.filter((m) => m.type === 'door').forEach((m) => { m.object.visible = !view.doorsHidden; });
  showDoorState();
});

const raycaster = new THREE.Raycaster();
let pressedAt = null;
container.addEventListener('pointerdown', (e) => { pressedAt = [e.clientX, e.clientY]; });
container.addEventListener('pointerup', (e) => {
  // A drag is an orbit, not a click.
  if (!wardrobe || !pressedAt || Math.hypot(e.clientX - pressedAt[0], e.clientY - pressedAt[1]) > 4) return;
  const bounds = container.getBoundingClientRect();
  const pointer = new THREE.Vector2(((e.clientX - bounds.left) / bounds.width) * 2 - 1, -((e.clientY - bounds.top) / bounds.height) * 2 + 1);
  raycaster.setFromCamera(pointer, camera);
  const hit = raycaster.intersectObjects(wardrobe.group.children, true).find((h) => h.object.visible && h.object.parent.visible);
  const mover = hit && wardrobe.movers.find((m) => m.object === hit.object.parent);
  if (!mover) return;
  if (mover.type === 'door') toggleDoors();
  else openness.get(mover.id).target = 1 - openness.get(mover.id).target;
});

// ---------- camera ----------
function setCameraPreset(mode) {
  const h = (design?.dimensions_mm.height ?? DEFAULTS.height) / 1000;
  const positions = { persp: [2.8, h * 0.85, 3.8], front: [0, h / 2, 4.4], bays: [0, h / 2, 2.9], iso: [3.4, h * 1.3, 3.4] };
  cameraGoal = { position: new THREE.Vector3(...positions[mode]), target: new THREE.Vector3(0, h / 2, 0) };
  if (mode === 'bays' && !view.doorsOpen && !view.doorsHidden) toggleDoors();
}
['persp', 'front', 'bays', 'iso'].forEach((mode) => $(`cam-${mode}`).addEventListener('click', () => setCameraPreset(mode)));

$('btn-snapshot').addEventListener('click', () => {
  renderer.render(scene, camera);
  const link = document.createElement('a');
  link.download = `wardrobe-${Date.now()}.png`;
  link.href = renderer.domElement.toDataURL('image/png');
  link.click();
});

// ---------- tabs ----------
const TABS = ['structure', 'materials', 'copilot'];
const ACTIVE_TAB = ['bg-surface-container-lowest', 'text-on-surface', 'font-semibold', 'shadow-sm'];
function switchTab(active) {
  TABS.forEach((tab) => {
    const on = tab === active;
    ACTIVE_TAB.forEach((c) => $(`tab-${tab}-btn`).classList.toggle(c, on));
    $(`tab-${tab}-btn`).classList.toggle('text-on-surface-variant', !on);
    $(`tab-${tab}-content`).classList.toggle('hidden', !on);
    $(`tab-${tab}-content`).classList.toggle('flex', on);
  });
}
TABS.forEach((tab) => $(`tab-${tab}-btn`).addEventListener('click', () => switchTab(tab)));

// ---------- loop ----------
function resize() {
  const { width, height } = container.getBoundingClientRect();
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.setSize(width, height);
}
window.addEventListener('resize', resize);

function frame() {
  requestAnimationFrame(frame);
  wardrobe?.movers.forEach((mover) => {
    const state = openness.get(mover.id);
    if (Math.abs(state.target - state.current) < 0.001) return;
    state.current += (state.target - state.current) * EASE;
    mover.apply(state.current);
  });
  if (cameraGoal) {
    camera.position.lerp(cameraGoal.position, EASE);
    controls.target.lerp(cameraGoal.target, EASE);
    if (camera.position.distanceTo(cameraGoal.position) < 0.005) cameraGoal = null;
  }
  controls.update();
  renderer.render(scene, camera);
}

resize();
showDoorState();
status.textContent = 'Loading design…';
ensureDraft().then(showDesign).then(() => mountAssistant({ onApplied: showDesign })).catch((error) => { status.textContent = `Could not load the design: ${error.message}`; });
frame();
