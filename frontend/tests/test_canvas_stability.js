/**
 * Frontend Canvas Stability & Error Boundary Automated Test
 * Verifies that the 2D canvas, sprite rendering loop, resize handling,
 * and player physics execute smoothly for 120+ continuous frames with 0 errors.
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

console.log('🧪 Starting DevFestVerse Canvas Stability & Render Loop Test...');

// Mock Full Canvas 2D Context
const createMockContext = () => ({
  fillStyle: '#000',
  strokeStyle: '#000',
  lineWidth: 1,
  font: '10px monospace',
  textAlign: 'left',
  shadowColor: 'transparent',
  shadowBlur: 0,
  clearRect: () => {},
  fillRect: () => {},
  strokeRect: () => {},
  beginPath: () => {},
  closePath: () => {},
  moveTo: () => {},
  lineTo: () => {},
  arc: () => {},
  ellipse: () => {},
  fill: () => {},
  stroke: () => {},
  save: () => {},
  restore: () => {},
  translate: () => {},
  scale: () => {},
  rotate: () => {},
  fillText: () => {},
  strokeText: () => {},
  measureText: (text) => ({ width: (text || '').length * 6 }),
  roundRect: () => {},
  quadraticCurveTo: () => {},
  bezierCurveTo: () => {},
  createRadialGradient: () => ({ addColorStop: () => {} }),
  createLinearGradient: () => ({ addColorStop: () => {} }),
  setLineDash: () => {},
  drawImage: () => {}
});

// Mock Minimal DOM Environment
const mockElement = (id) => ({
  id,
  style: {},
  classList: {
    add: () => {},
    remove: () => {},
    contains: () => false
  },
  innerText: '',
  innerHTML: '',
  value: '',
  dataset: {},
  addEventListener: () => {},
  removeEventListener: () => {},
  offsetWidth: 1280,
  offsetHeight: 720,
  clientWidth: 1280,
  clientHeight: 720,
  getBoundingClientRect: () => ({ left: 0, top: 60, width: 1280, height: 720 })
});

const elements = {};
const getElementById = (id) => {
  if (!elements[id]) {
    elements[id] = mockElement(id);
  }
  return elements[id];
};

const mockCanvas = {
  ...mockElement('gameCanvas'),
  width: 1280,
  height: 720,
  getContext: (type) => (type === '2d' ? createMockContext() : null)
};
elements['gameCanvas'] = mockCanvas;
elements['game-container'] = mockElement('game-container');
elements['studioPreviewCanvas'] = { ...mockElement('studioPreviewCanvas'), width: 120, height: 160, getContext: () => createMockContext() };

const listeners = {};
const sandbox = {
  console: console,
  setTimeout: (fn) => setTimeout(fn, 0),
  clearTimeout: clearTimeout,
  setInterval: () => {},
  clearInterval: () => {},
  requestAnimationFrame: () => {},
  Date: Date,
  Math: Math,
  JSON: JSON,
  Array: Array,
  Object: Object,
  parseInt: parseInt,
  parseFloat: parseFloat,
  document: {
    getElementById: getElementById,
    querySelector: (sel) => mockElement(sel),
    querySelectorAll: () => [],
    createElement: (tag) => mockElement(tag),
    body: mockElement('body'),
    head: mockElement('head')
  },
  window: {
    location: { origin: 'http://localhost:3000' },
    addEventListener: (type, handler) => {
      if (!listeners[type]) listeners[type] = [];
      listeners[type].push(handler);
    },
    innerWidth: 1280,
    innerHeight: 800,
    requestAnimationFrame: () => {}
  },
  navigator: { serviceWorker: { register: () => Promise.resolve() } },
  atob: (str) => Buffer.from(str, 'base64').toString('binary')
};
sandbox.window.document = sandbox.document;

// Load and evaluate app.js
const appJsPath = path.join(__dirname, '../src/app.js');
const code = fs.readFileSync(appJsPath, 'utf8');

const script = new vm.Script(code);
const context = vm.createContext(sandbox);
script.runInContext(context);

console.log('✅ app.js successfully parsed and loaded into VM.');

const gameCanvas = sandbox.document.getElementById('gameCanvas');

// 1. Test Canvas Bounds & Sizing
if (!gameCanvas || gameCanvas.width <= 0 || gameCanvas.height <= 0) {
  throw new Error(`Invalid canvas dimensions: ${gameCanvas?.width}x${gameCanvas?.height}`);
}
console.log(`✅ Canvas initialized with dimensions: ${gameCanvas.width}x${gameCanvas.height}`);

// 2. Test Multi-Resolution Resizing
const resolutions = [
  { w: 1920, h: 1080, name: '1080p Desktop' },
  { w: 1280, h: 720, name: '720p Laptop' },
  { w: 768, h: 1024, name: 'Tablet Portrait' },
  { w: 390, h: 844, name: 'Mobile Smartphone' }
];

for (const res of resolutions) {
  sandbox.document.getElementById('game-container').clientWidth = res.w;
  sandbox.document.getElementById('game-container').clientHeight = res.h;
  vm.runInContext('resizeCanvas()', context);
  
  if (gameCanvas.width < 960 || gameCanvas.height < 540) {
    throw new Error(`Canvas size too small on ${res.name}: ${gameCanvas.width}x${gameCanvas.height}`);
  }
}
console.log('✅ Multi-Resolution resize tests passed (min-bounds enforced).');

// 3. Test 120 Continuous Frames Simulation with simulated key events
const sendKey = (code, isDown) => {
  const handlers = listeners[isDown ? 'keydown' : 'keyup'] || [];
  handlers.forEach(fn => fn({ code, preventDefault: () => {} }));
};

for (let frame = 0; frame < 120; frame++) {
  if (frame === 0) sendKey('KeyD', true);
  if (frame === 30) { sendKey('KeyD', false); sendKey('KeyS', true); }
  if (frame === 60) { sendKey('KeyS', false); sendKey('KeyA', true); }
  if (frame === 90) { sendKey('KeyA', false); sendKey('KeyW', true); }

  vm.runInContext('gameLoop()', context);
}
console.log('✅ 120 frames of continuous animation and physics rendered with 0 errors.');

// 4. Verify Player Coordinates Remained Bounded
const player = vm.runInContext('player', context);
if (player.x < 30 || player.x > gameCanvas.width - 30) {
  throw new Error(`Player X out of bounds: ${player.x}`);
}
if (player.y < 30 || player.y > gameCanvas.height - 30) {
  throw new Error(`Player Y out of bounds: ${player.y}`);
}
console.log(`✅ Player position is safely bounded at (${Math.round(player.x)}, ${Math.round(player.y)}).`);

console.log('🎉 ALL CANVAS STABILITY TESTS PASSED WITH ZERO CRASHES!');
