// Interior layout editor: a front view of the bays built from the draft design. Every edit is a
// typed operation sent to the backend; the page re-renders from the design that comes back.
// Each drag action also has a button or keyboard equivalent.
import { mountAssistant } from './ai/assistant.js';
import { getCatalog } from './api/client.js';
import { applyDraftOperations, ensureDraft } from './state/draft.js';

const ICONS = { shelf: 'table_rows', rail: 'checkroom', drawer: 'inbox' };
const HINTS = { shelf: 'Adjustable position', rail: 'For hanging clothes', drawer: 'Pull-out storage' };
const ITEM_LOOK = {
  shelf: 'bg-surface-container-highest rounded-sm',
  rail: 'bg-gradient-to-r from-primary/70 via-primary-container to-primary/70 rounded-full',
  drawer: 'bg-surface-container-high rounded shadow-xs',
};
const DRAG_TYPE = 'application/x-wardrobe-component-type';
const DRAG_ID = 'application/x-wardrobe-component-id';
const FINE_STEP_MM = 10;
const GRID_STEP_MM = 50;

const $ = (id) => document.getElementById(id);

function el(tag, className = '', text = '') {
  const node = document.createElement(tag);
  node.className = className;
  node.textContent = text;
  return node;
}

let design = null;
let catalog = null;
let selectedId = null;
let selectedBay = 0;

const step = () => ($('snap').checked ? GRID_STEP_MM : FINE_STEP_MM);
const snap = (value) => Math.round(value / step()) * step();
const items = () => design.components.filter((c) => c.type in catalog.components);
const heightAboveFloor = (item) => item.position_mm.y - design.layout.interior_floor_mm;
const labelOf = (type) => catalog.components[type].label;

async function run(operations, selectNew = false) {
  const before = new Set(items().map((item) => item.id));
  $('editor-status').textContent = '';
  try {
    design = await applyDraftOperations(operations);
    if (selectNew) selectedId = items().find((item) => !before.has(item.id))?.id ?? selectedId;
    if (!items().some((item) => item.id === selectedId)) selectedId = null;
    selectedBay = Math.min(selectedBay, design.layout.bays.length - 1);
  } catch (error) {
    $('editor-status').textContent = error.message;
  }
  render();
}

const add = (type, bay, y) => run([{ op: 'add_component', type, bay, y_mm: Math.max(0, snap(y)) }], true);
const move = (id, change) => run([{ op: 'move_component', id, ...change }]);

// ---------- catalog ----------
function renderCatalog(filter = '') {
  const list = $('catalog-list');
  const entries = Object.entries(catalog.components).filter(([, entry]) => entry.label.toLowerCase().includes(filter.toLowerCase()));
  $('catalog-count').textContent = `${entries.length} components`;
  list.replaceChildren(...entries.map(([type, entry]) => {
    const card = el('div', 'group bg-surface-container-lowest p-3.5 rounded-lg shadow-sm hover:shadow-md transition-all cursor-grab active:cursor-grabbing flex items-center gap-3');
    card.draggable = true;
    card.addEventListener('dragstart', (e) => e.dataTransfer.setData(DRAG_TYPE, type));
    const icon = el('div', 'w-12 h-12 rounded bg-surface-container-high flex items-center justify-center shrink-0');
    const glyph = el('span', 'material-symbols-outlined text-on-surface-variant group-hover:text-primary transition-colors', ICONS[type]);
    glyph.setAttribute('aria-hidden', 'true'); // icon-font ligature, not text
    icon.append(glyph);
    const text = el('div', 'flex flex-col flex-1 min-w-0');
    text.append(el('span', 'font-medium text-xs text-on-surface truncate', entry.label), el('p', 'text-[11px] text-on-surface-variant mt-0.5', HINTS[type]));
    const button = el('button', 'px-2.5 py-1.5 text-xs font-label bg-surface-container hover:bg-surface-container-high text-on-surface rounded', 'Add');
    button.type = 'button';
    button.setAttribute('aria-label', `Add ${entry.label} to bay ${selectedBay + 1}`);
    button.addEventListener('click', () => add(type, selectedBay, type === 'drawer' ? 0 : design.layout.interior_height_mm / 2));
    card.append(icon, text, button);
    return card;
  }));
}

// ---------- front view ----------
function heightFromPointer(event, column, itemHeight) {
  const box = column.getBoundingClientRect();
  const fraction = 1 - (event.clientY - box.top) / box.height;
  return fraction * design.layout.interior_height_mm - itemHeight / 2;
}

function itemButton(item) {
  const interior = design.layout.interior_height_mm;
  const selected = item.id === selectedId;
  const button = el('button', `absolute left-1 right-1 min-h-[8px] flex items-center px-2 cursor-grab ${ITEM_LOOK[item.type]} ${selected ? 'ring-2 ring-primary' : ''}`);
  button.type = 'button';
  button.draggable = true;
  button.style.bottom = `${(heightAboveFloor(item) / interior) * 100}%`;
  button.style.height = `${(item.size_mm.y / interior) * 100}%`;
  button.setAttribute('aria-label', `${labelOf(item.type)}, bay ${item.compartment + 1}, ${heightAboveFloor(item)} mm from base`);
  button.setAttribute('aria-pressed', String(selected));
  if (item.type === 'drawer') button.append(el('span', 'text-[9px] font-medium text-on-surface', 'Drawer'));
  button.addEventListener('dragstart', (e) => e.dataTransfer.setData(DRAG_ID, item.id));
  button.addEventListener('click', (e) => {
    e.stopPropagation();
    selectedId = item.id;
    selectedBay = item.compartment;
    render();
  });
  button.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      e.preventDefault();
      move(item.id, { y_mm: Math.max(0, heightAboveFloor(item) + (e.key === 'ArrowUp' ? step() : -step())) });
    } else if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault();
      run([{ op: 'remove_component', id: item.id }]);
    }
  });
  return button;
}

function renderCanvas() {
  const { width, height } = design.dimensions_mm;
  $('canvas-width').textContent = `Width: ${width} mm`;
  $('canvas-height').textContent = `Height: ${height} mm`;
  $('bays-count').textContent = design.layout.bays.length;
  $('bay-canvas').replaceChildren(...design.layout.bays.map((bay, index) => {
    const active = index === selectedBay;
    const column = el('div', `relative rounded ${active ? 'bg-surface-container-lowest shadow-inner ring-2 ring-primary/40' : 'bg-surface-container'}`);
    column.style.flex = `${bay.width_mm} 1 0`;
    column.append(el('div', `absolute -top-5 left-1/2 -translate-x-1/2 whitespace-nowrap text-[10px] font-mono ${active ? 'text-primary font-bold' : 'text-on-surface-variant font-medium'}`, `Bay ${index + 1} · ${bay.width_mm} mm`));
    items().filter((item) => item.compartment === index).forEach((item) => column.append(itemButton(item)));
    column.addEventListener('click', () => {
      selectedBay = index;
      selectedId = null;
      render();
    });
    column.addEventListener('dragover', (e) => e.preventDefault());
    column.addEventListener('drop', (e) => {
      e.preventDefault();
      selectedBay = index;
      const type = e.dataTransfer.getData(DRAG_TYPE);
      const id = e.dataTransfer.getData(DRAG_ID);
      if (type in catalog.components) {
        add(type, index, heightFromPointer(e, column, catalog.components[type].height_mm));
      } else if (id) {
        const dragged = items().find((item) => item.id === id);
        if (dragged) move(id, { bay: index, y_mm: Math.max(0, snap(heightFromPointer(e, column, dragged.size_mm.y))) });
      }
    });
    return column;
  }));
}

// ---------- properties ----------
function field(labelText, control) {
  const wrap = el('label', 'flex flex-col gap-1 text-xs font-label text-on-surface-variant');
  wrap.append(el('span', '', labelText), control);
  return wrap;
}

function renderProperties() {
  const panel = $('properties');
  const item = items().find((candidate) => candidate.id === selectedId);
  if (!item) {
    panel.replaceChildren(el('p', 'text-xs text-on-surface-variant', `Select a component in the front view, or add one from the catalog. New components go to bay ${selectedBay + 1}.`));
    return;
  }
  const max = design.layout.interior_height_mm - item.size_mm.y;
  const title = el('div', 'flex items-center justify-between');
  title.append(el('span', 'font-medium text-xs text-on-surface', labelOf(item.type)),
    el('span', 'text-[10px] font-label uppercase px-2 py-0.5 rounded bg-primary-fixed text-on-primary-fixed font-bold', 'Selected'));

  const position = el('input', 'w-full px-2 py-1 font-mono text-xs bg-surface-container rounded text-on-surface focus:outline-none focus:ring-1 focus:ring-primary');
  Object.assign(position, { type: 'number', min: 0, max, step: step(), value: heightAboveFloor(item) });
  position.addEventListener('change', () => move(item.id, { y_mm: Math.max(0, Math.min(max, Number(position.value) || 0)) }));
  const slider = el('input', 'accent-primary cursor-pointer w-full');
  Object.assign(slider, { type: 'range', min: 0, max, step: step(), value: heightAboveFloor(item) });
  slider.setAttribute('aria-label', 'Position from base');
  slider.addEventListener('change', () => move(item.id, { y_mm: Number(slider.value) }));

  const bays = el('div', 'grid grid-cols-3 gap-1.5');
  design.layout.bays.forEach((_, index) => {
    const current = index === item.compartment;
    const button = el('button', `py-1 text-xs font-label rounded ${current ? 'bg-primary text-on-primary font-medium' : 'bg-surface-container text-on-surface-variant hover:text-on-surface'}`, `Bay ${index + 1}`);
    button.type = 'button';
    button.setAttribute('aria-pressed', String(current));
    button.addEventListener('click', () => { selectedBay = index; move(item.id, { bay: index }); });
    bays.append(button);
  });

  const actions = el('div', 'grid grid-cols-2 gap-2 pt-1');
  const duplicate = el('button', 'px-2.5 py-1.5 text-xs font-label bg-surface-container hover:bg-surface-container-high text-on-surface rounded', 'Duplicate');
  duplicate.type = 'button';
  duplicate.addEventListener('click', () => add(item.type, item.compartment, Math.min(max, heightAboveFloor(item) + item.size_mm.y + GRID_STEP_MM)));
  const remove = el('button', 'px-2.5 py-1.5 text-xs font-label bg-surface-container hover:bg-error-container hover:text-error text-on-surface rounded', 'Remove');
  remove.type = 'button';
  remove.addEventListener('click', () => run([{ op: 'remove_component', id: item.id }]));
  actions.append(duplicate, remove);

  panel.replaceChildren(title, field('Position from base (mm)', position), slider, field('Bay', bays), actions);
}

function render() {
  renderCanvas();
  renderProperties();
  $('accessory-led_lighting').checked = design.accessories.includes('led_lighting');
}

// ---------- controls ----------
$('catalog-search').addEventListener('input', (e) => renderCatalog(e.target.value));
$('bays-minus').addEventListener('click', () => run([{ op: 'set_bays', count: design.layout.bays.length - 1 }]));
$('bays-plus').addEventListener('click', () => run([{ op: 'set_bays', count: design.layout.bays.length + 1 }]));
$('accessory-led_lighting').addEventListener('change', (e) => run([{ op: 'set_accessory', key: 'led_lighting', enabled: e.target.checked }]));
$('snap').addEventListener('change', renderProperties);

$('editor-status').textContent = 'Loading design…';
Promise.all([getCatalog(), ensureDraft()])
  .then(([loadedCatalog, draft]) => {
    catalog = loadedCatalog;
    design = draft;
    $('editor-status').textContent = '';
    renderCatalog();
    render();
    mountAssistant({ onApplied: (next) => { design = next; selectedId = null; render(); } });
  })
  .catch((error) => { $('editor-status').textContent = `Could not load the editor: ${error.message}`; });
