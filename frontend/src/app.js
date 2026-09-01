// Dynamic API Base URL supporting both local dev and production Cloud Run
const API_BASE = window.location.origin.includes('localhost:3000') 
  ? 'http://localhost:8000/api/v1' 
  : `${window.location.origin}/api/v1`;

// --- AUTH & USER STATE ---
let currentUser = {
  id: 'user-partic-1',
  email: 'dev@bangkok.io',
  display_name: 'Pixel Dev',
  role: 'PARTICIPANT',
  verified_ticket: false,
  ticket_ref: null,
  avatar_config: {
    skin_tone: '#FBBF24',
    hair_style: 'short',
    hair_color: '#1E293B',
    outfit_style: 'gdg_hoodie',
    outfit_color: '#4285F4',
    headwear: 'devfest_cap',
    aura: 'none',
    theme: 'devfest-standard'
  }
};

// Studio active configuration (draft state before saving)
let studioConfig = { ...currentUser.avatar_config };

// --- 2D CANVAS GAME ENGINE ---
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

let player = {
  x: 480,
  y: 380,
  targetX: null,
  targetY: null,
  size: 32,
  speed: 4,
  moving: false,
  stepFrame: 0,
  bobFrame: 0,
  direction: 'down', // 'down' | 'up' | 'left' | 'right'
  nearHotspot: null
};

let activeTouchDir = null; // 'up' | 'down' | 'left' | 'right' | null
const keys = {};

window.addEventListener('keydown', (e) => {
  const isTyping = document.activeElement && (
    document.activeElement.tagName === 'INPUT' || 
    document.activeElement.tagName === 'TEXTAREA' || 
    document.activeElement.isContentEditable
  );

  if (e.code === 'KeyE' || e.code === 'Space') {
    if (!isTyping) {
      if (isAnyModalActive()) {
        e.preventDefault();
        closeAllModals();
        return;
      } else if (player.nearHotspot) {
        e.preventDefault();
        triggerHotspotAction(player.nearHotspot);
        return;
      }
    }
  } else if (e.code === 'Escape') {
    if (isAnyModalActive()) {
      e.preventDefault();
      closeAllModals();
      return;
    }
  }

  keys[e.code] = true;
  player.targetX = null;
  player.targetY = null;
});
window.addEventListener('keyup', (e) => { keys[e.code] = false; });

// Interactive Hotspots on the 2D Map
const HOTSPOTS = [
  { id: 'ticket-billboard', type: 'TICKET_BILLBOARD', x: 420, y: 270, width: 130, height: 52, label: '🎫 MAIN TICKET BILLBOARD', sub: 'Verify Ticket to Unlock', color: '#10B981', ringColor: '#34D399' },
  { id: 'builder-zone', type: 'BUILDER_ZONE', x: 260, y: 270, width: 140, height: 52, label: '🛠️ BUILDER ZONE', sub: 'Live App Showcase & Demos', color: '#0284C7', ringColor: '#38BDF8' },
  { id: 'workshop-zone', type: 'WORKSHOP_ZONE', x: 100, y: 190, width: 140, height: 60, label: '💻 WORKSHOP LABS', sub: 'Hands-on Seat Reservation', color: '#8B5CF6', ringColor: '#A78BFA' },
  { id: 'sponsor-google', type: 'SPONSOR_BOOTH', x: 720, y: 190, width: 140, height: 60, label: '🏢 GOOGLE CLOUD BOOTH', sub: 'Vertex AI & Cloud Run Expo', url: 'https://cloud.google.com', color: '#EA4335', ringColor: '#F87171' },
  { id: 'bb-gdg-chapter', type: 'COMMUNITY_BILLBOARD', x: 40, y: 48, width: 85, height: 42, label: '🌐 CHAPTER', sub: 'GDG Cloud BKK', url: 'https://gdg.community.dev/gdg-cloud-bangkok/', color: '#4285F4', ringColor: '#60A5FA' },
  { id: 'bb-fb-page', type: 'COMMUNITY_BILLBOARD', x: 135, y: 48, width: 80, height: 42, label: '📘 FB PAGE', sub: 'Official Page', url: 'https://www.facebook.com/profile.php?id=61583002384772', color: '#1877F2', ringColor: '#60A5FA' },
  { id: 'bb-fb-group', type: 'COMMUNITY_BILLBOARD', x: 225, y: 48, width: 80, height: 42, label: '👥 FB GROUP', sub: 'Developer Group', url: 'https://www.facebook.com/groups/gdgcloudbkk/', color: '#34A853', ringColor: '#4ADE80' },
  { id: 'bb-discord', type: 'COMMUNITY_BILLBOARD', x: 315, y: 48, width: 80, height: 42, label: '💬 DISCORD', sub: 'Community Hub', url: 'https://discord.gg/CBbPpNvmS', color: '#5865F2', ringColor: '#818CF8' },
  { id: 'bb-instagram', type: 'COMMUNITY_BILLBOARD', x: 405, y: 48, width: 85, height: 42, label: '📷 INSTAGRAM', sub: '@gdgcloudbkk', url: 'https://www.instagram.com/gdgcloudbkk', color: '#E1306C', ringColor: '#F472B6' },
  { id: 'bb-youtube', type: 'COMMUNITY_BILLBOARD', x: 500, y: 48, width: 85, height: 42, label: '▶️ YOUTUBE', sub: '@gdgcloudbangkok', url: 'https://www.youtube.com/@gdgcloudbangkok', color: '#FF0000', ringColor: '#F87171' },
  { id: 'stage-screen', type: 'STAGE_SCREEN', x: 600, y: 45, width: 150, height: 48, label: '🎤 MAIN STAGE AGENDA', sub: 'Live Gemini Transcripts', color: '#FBBC04', ringColor: '#FDE047' },
  { id: 'feedback-kiosk', type: 'FEEDBACK_KIOSK', x: 420, y: 460, width: 130, height: 48, label: '📝 EVENT FEEDBACK', sub: 'Rate Talks & Share Ideas', color: '#EC4899', ringColor: '#F472B6' }
];

function resizeCanvas() {
  const container = document.getElementById('game-container');
  if (!container || !canvas) return;

  const w = container.clientWidth || window.innerWidth;
  const h = container.clientHeight || window.innerHeight - 80;

  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = Math.max(960, w);
    canvas.height = Math.max(540, h);
    repositionHotspots(canvas.width, canvas.height);
  }
}

function repositionHotspots(w, h) {
  // Center Main Stage
  const stage = HOTSPOTS.find(s => s.id === 'stage-screen');
  if (stage) { stage.x = Math.floor(w / 2 - 75); stage.y = 45; }

  // Builder Zone (Center-Left)
  const bz = HOTSPOTS.find(s => s.id === 'builder-zone');
  if (bz) { bz.x = Math.floor(w / 2 - 165); bz.y = Math.floor(h / 2 - 26); }

  // Ticket Billboard (Center-Right)
  const ticket = HOTSPOTS.find(s => s.id === 'ticket-billboard');
  if (ticket) { ticket.x = Math.floor(w / 2 + 25); ticket.y = Math.floor(h / 2 - 26); }

  // Center Feedback Kiosk (Bottom)
  const fb = HOTSPOTS.find(s => s.id === 'feedback-kiosk');
  if (fb) { fb.x = Math.floor(w / 2 - 65); fb.y = Math.floor(h - 80); }

  // Workshop Labs (Far Left)
  const ws = HOTSPOTS.find(s => s.id === 'workshop-zone');
  if (ws) { ws.x = 70; ws.y = Math.floor(h / 2 - 30); }

  // Google Booth (Far Right)
  const google = HOTSPOTS.find(s => s.id === 'sponsor-google');
  if (google) { google.x = Math.floor(w - 210); google.y = Math.floor(h / 2 - 30); }
}

window.addEventListener('resize', resizeCanvas);
setTimeout(resizeCanvas, 50);

function updatePlayer() {
  player.moving = false;
  let dx = 0, dy = 0;

  // 1. Check Virtual Touch D-Pad Input
  if (activeTouchDir) {
    player.targetX = null;
    player.targetY = null;
    if (activeTouchDir === 'up') { dy -= 1; player.direction = 'up'; player.moving = true; }
    if (activeTouchDir === 'down') { dy += 1; player.direction = 'down'; player.moving = true; }
    if (activeTouchDir === 'left') { dx -= 1; player.direction = 'left'; player.moving = true; }
    if (activeTouchDir === 'right') { dx += 1; player.direction = 'right'; player.moving = true; }
  }
  // 2. Check Keyboard Controls
  else if (keys['KeyW'] || keys['ArrowUp'] || keys['KeyS'] || keys['ArrowDown'] || keys['KeyA'] || keys['ArrowLeft'] || keys['KeyD'] || keys['ArrowRight']) {
    if (keys['KeyW'] || keys['ArrowUp']) { dy -= 1; player.direction = 'up'; player.moving = true; }
    if (keys['KeyS'] || keys['ArrowDown']) { dy += 1; player.direction = 'down'; player.moving = true; }
    if (keys['KeyA'] || keys['ArrowLeft']) { dx -= 1; player.direction = 'left'; player.moving = true; }
    if (keys['KeyD'] || keys['ArrowRight']) { dx += 1; player.direction = 'right'; player.moving = true; }
  }
  // 3. Check Tap-to-Move Pathing
  else if (player.targetX !== null && player.targetY !== null) {
    const dist = Math.hypot(player.targetX - player.x, player.targetY - player.y);
    if (dist < player.speed) {
      player.x = player.targetX;
      player.y = player.targetY;
      player.targetX = null;
      player.targetY = null;
      player.moving = false;
    } else {
      const angle = Math.atan2(player.targetY - player.y, player.targetX - player.x);
      player.x += Math.cos(angle) * player.speed;
      player.y += Math.sin(angle) * player.speed;
      player.moving = true;
      player.stepFrame += 0.25;

      // Set facing direction based on movement angle
      if (Math.abs(Math.cos(angle)) > Math.abs(Math.sin(angle))) {
        player.direction = Math.cos(angle) > 0 ? 'right' : 'left';
      } else {
        player.direction = Math.sin(angle) > 0 ? 'down' : 'up';
      }
    }
  }

  if (player.moving && !player.targetX) {
    player.x += dx * player.speed;
    player.y += dy * player.speed;
    player.stepFrame += 0.25;
  } else if (!player.moving) {
    player.stepFrame = 0;
    player.bobFrame += 0.08;
  }

  // Canvas bounds
  player.x = Math.max(30, Math.min(canvas.width - 30, player.x));
  player.y = Math.max(30, Math.min(canvas.height - 30, player.y));

  // Check proximity to Hotspots
  let closestSpot = null;
  let minDist = 70;

  HOTSPOTS.forEach(spot => {
    const cx = spot.x + spot.width / 2;
    const cy = spot.y + spot.height / 2;
    const dist = Math.hypot(player.x - cx, player.y - cy);
    if (dist < minDist) {
      closestSpot = spot;
    }
  });

  player.nearHotspot = closestSpot;
  updateProximityHint(closestSpot);
}

function updateProximityHint(spot) {
  const hintEl = document.getElementById('proximity-hint');
  const textEl = document.getElementById('proximity-hint-text');
  const mobileActionBtn = document.getElementById('mobile-action-btn');
  const mobileActionLabel = document.getElementById('mobile-action-label');

  if (spot && !isAnyModalActive()) {
    const rect = canvas.getBoundingClientRect();
    hintEl.style.display = 'block';
    hintEl.style.left = `${rect.left + (player.x / canvas.width) * rect.width}px`;
    hintEl.style.top = `${rect.top + (player.y / canvas.height) * rect.height - 45}px`;
    textEl.innerText = `💬 Press [E] or Click: ${spot.label}`;

    if (mobileActionBtn) {
      mobileActionBtn.classList.add('active-pulse');
      mobileActionLabel.innerText = 'OPEN';
    }
  } else {
    hintEl.style.display = 'none';
    if (mobileActionBtn) {
      mobileActionBtn.classList.remove('active-pulse');
      mobileActionLabel.innerText = 'ACTION';
    }
  }
}

function triggerMobileAction() {
  if (isAnyModalActive()) {
    closeAllModals();
  } else if (player.nearHotspot) {
    triggerHotspotAction(player.nearHotspot);
  } else {
    showToast('Walk close to any booth or billboard to interact! 🚶', '💬');
  }
}

function triggerHotspotAction(spot) {
  if (spot.type === 'TICKET_BILLBOARD') {
    openModal('ticket-modal');
  } else if (spot.type === 'COMMUNITY_BILLBOARD' || spot.type === 'SPONSOR_BOOTH') {
    openBillboardModal(spot.label, spot.url);
  } else if (spot.type === 'WORKSHOP_ZONE') {
    openModal('workshops-modal');
  } else if (spot.type === 'STAGE_SCREEN') {
    openModal('agenda-modal');
  } else if (spot.type === 'FEEDBACK_KIOSK') {
    openModal('feedback-modal');
  } else if (spot.type === 'BUILDER_ZONE') {
    openModal('builder-showcase-modal');
  }
}

// Canvas Pointer handler for direct hotspot clicking and tap-to-move
function handleCanvasPointer(clientX, clientY) {
  const rect = canvas.getBoundingClientRect();
  const clickX = (clientX - rect.left) * (canvas.width / rect.width);
  const clickY = (clientY - rect.top) * (canvas.height / rect.height);

  let clickedHotspot = null;
  HOTSPOTS.forEach(spot => {
    if (clickX >= spot.x && clickX <= spot.x + spot.width && clickY >= spot.y && clickY <= spot.y + spot.height) {
      clickedHotspot = spot;
    }
  });

  if (clickedHotspot) {
    triggerHotspotAction(clickedHotspot);
    player.targetX = null;
    player.targetY = null;
  } else {
    // Tap to Move target
    player.targetX = Math.max(30, Math.min(canvas.width - 30, clickX));
    player.targetY = Math.max(30, Math.min(canvas.height - 30, clickY));
  }
}

canvas.addEventListener('click', (e) => {
  handleCanvasPointer(e.clientX, e.clientY);
});

function initMobileControls() {
  const dpadButtons = document.querySelectorAll('.dpad-btn[data-dir]');
  dpadButtons.forEach(btn => {
    const dir = btn.dataset.dir;
    const start = (e) => {
      e.preventDefault();
      activeTouchDir = dir;
      player.targetX = null;
      player.targetY = null;
      btn.classList.add('pressed');
    };
    const end = (e) => {
      e.preventDefault();
      if (activeTouchDir === dir) activeTouchDir = null;
      btn.classList.remove('pressed');
    };
    btn.addEventListener('touchstart', start, { passive: false });
    btn.addEventListener('touchend', end, { passive: false });
    btn.addEventListener('touchcancel', end, { passive: false });
    btn.addEventListener('mousedown', start);
    btn.addEventListener('mouseup', end);
    btn.addEventListener('mouseleave', end);
  });
}


// --- SPRITE RENDERING ENGINE ---
function drawCharacterSprite(renderCtx, x, y, config, isMoving, stepFrame, bobOffset, direction, scale = 1, showBadge = true, customName = null, customRole = null, customVerified = null) {
  renderCtx.save();
  renderCtx.translate(x, y);
  renderCtx.scale(scale, scale);

  const skin = config.skin_tone || '#FBBF24';
  const hair = config.hair_color || '#1E293B';
  const outfit = config.outfit_color || '#4285F4';
  const hairStyle = config.hair_style || 'short';
  const headwear = config.headwear || 'none';
  const aura = config.aura || 'none';

  // 1. Aura & Companions
  const time = Date.now() * 0.003;
  if (aura === 'cloud_pet') {
    const petX = Math.cos(time) * 22;
    const petY = -34 + Math.sin(time * 2) * 5;
    renderCtx.fillStyle = '#38BDF8';
    renderCtx.beginPath();
    renderCtx.ellipse(petX, petY, 10, 6, 0, 0, Math.PI * 2);
    renderCtx.fill();
    renderCtx.fillStyle = '#E0F2FE';
    renderCtx.beginPath();
    renderCtx.arc(petX - 3, petY - 2, 4, 0, Math.PI * 2);
    renderCtx.arc(petX + 3, petY - 3, 5, 0, Math.PI * 2);
    renderCtx.fill();
    // Pet face
    renderCtx.fillStyle = '#0369A1';
    renderCtx.fillRect(petX - 4, petY - 1, 2, 2);
    renderCtx.fillRect(petX + 2, petY - 1, 2, 2);
  } else if (aura === 'ai_sparkles') {
    const sX1 = Math.sin(time * 3) * 18, sY1 = -28 + Math.cos(time * 2) * 12;
    const sX2 = Math.cos(time * 2.5) * 16, sY2 = -16 + Math.sin(time * 3.5) * 10;
    renderCtx.fillStyle = '#FBBF24';
    renderCtx.fillRect(sX1, sY1, 3, 3);
    renderCtx.fillStyle = '#34D399';
    renderCtx.fillRect(sX2, sY2, 3, 3);
  } else if (aura === 'matrix_glow') {
    renderCtx.strokeStyle = '#10B981';
    renderCtx.lineWidth = 1.5;
    renderCtx.setLineDash([4, 4]);
    renderCtx.beginPath();
    renderCtx.ellipse(0, -12 + bobOffset, 20, 24, 0, 0, Math.PI * 2);
    renderCtx.stroke();
    renderCtx.setLineDash([]);
  }

  // 2. Drop Shadow
  renderCtx.fillStyle = 'rgba(0, 0, 0, 0.4)';
  renderCtx.beginPath();
  renderCtx.ellipse(0, 4, 14, 4.5, 0, 0, Math.PI * 2);
  renderCtx.fill();

  // 3. Legs & Shoes (Walking Animation)
  const legOffset = isMoving ? Math.sin(stepFrame) * 6 : 0;
  renderCtx.fillStyle = '#0F172A'; // pants
  renderCtx.fillRect(-7, -4, 5, 8 + (direction === 'down' ? legOffset : -legOffset));
  renderCtx.fillRect(2, -4, 5, 8 + (direction === 'down' ? -legOffset : legOffset));

  renderCtx.fillStyle = '#334155'; // shoes
  renderCtx.fillRect(-8, 3 + (direction === 'down' ? legOffset : -legOffset), 6, 3);
  renderCtx.fillRect(2, 3 + (direction === 'down' ? -legOffset : legOffset), 6, 3);

  // 4. Torso / Outfit (bobs with head)
  const by = -18 + bobOffset;
  renderCtx.fillStyle = outfit;
  renderCtx.beginPath();
  renderCtx.roundRect(-10, by, 20, 15, 3);
  renderCtx.fill();

  // GDG emblem on chest (front only)
  if (direction === 'down') {
    renderCtx.fillStyle = '#FFFFFF';
    renderCtx.fillRect(-3, by + 4, 6, 4);
    renderCtx.fillStyle = '#4285F4';
    renderCtx.fillRect(-1, by + 5, 2, 2);
  }

  // Arms
  const armOffset = isMoving ? -Math.sin(stepFrame) * 4 : 0;
  renderCtx.fillStyle = outfit;
  renderCtx.fillRect(-13, by + 2 + armOffset, 3, 9);
  renderCtx.fillRect(10, by + 2 - armOffset, 3, 9);
  renderCtx.fillStyle = skin;
  renderCtx.fillRect(-13, by + 10 + armOffset, 3, 3);
  renderCtx.fillRect(10, by + 10 - armOffset, 3, 3);

  // 5. Head & Face
  const hy = -34 + bobOffset;
  renderCtx.fillStyle = skin;
  renderCtx.beginPath();
  renderCtx.roundRect(-9, hy, 18, 16, 4);
  renderCtx.fill();

  // Eyes (based on direction)
  if (direction === 'down') {
    renderCtx.fillStyle = '#0F172A';
    renderCtx.fillRect(-5, hy + 6, 3, 3);
    renderCtx.fillRect(2, hy + 6, 3, 3);
    renderCtx.fillStyle = '#FFFFFF';
    renderCtx.fillRect(-4, hy + 6, 1, 1);
    renderCtx.fillRect(3, hy + 6, 1, 1);
    // Smile
    renderCtx.fillStyle = '#B45309';
    renderCtx.fillRect(-2, hy + 12, 4, 1);
  } else if (direction === 'left') {
    renderCtx.fillStyle = '#0F172A';
    renderCtx.fillRect(-7, hy + 6, 3, 3);
    renderCtx.fillStyle = '#FFFFFF';
    renderCtx.fillRect(-6, hy + 6, 1, 1);
  } else if (direction === 'right') {
    renderCtx.fillStyle = '#0F172A';
    renderCtx.fillRect(4, hy + 6, 3, 3);
    renderCtx.fillStyle = '#FFFFFF';
    renderCtx.fillRect(5, hy + 6, 1, 1);
  }

  // 6. Hair Styles
  renderCtx.fillStyle = hair;
  if (hairStyle === 'short') {
    renderCtx.fillRect(-10, hy - 2, 20, 6);
    if (direction !== 'up') renderCtx.fillRect(-10, hy + 2, 3, 5);
    if (direction !== 'up') renderCtx.fillRect(7, hy + 2, 3, 5);
  } else if (hairStyle === 'spiky') {
    renderCtx.beginPath();
    renderCtx.moveTo(-10, hy + 3);
    renderCtx.lineTo(-8, hy - 7);
    renderCtx.lineTo(-4, hy - 2);
    renderCtx.lineTo(0, hy - 9);
    renderCtx.lineTo(4, hy - 2);
    renderCtx.lineTo(8, hy - 7);
    renderCtx.lineTo(10, hy + 3);
    renderCtx.closePath();
    renderCtx.fill();
  } else if (hairStyle === 'beanie') {
    renderCtx.beginPath();
    renderCtx.ellipse(0, hy + 1, 11, 7, 0, Math.PI, 0);
    renderCtx.fill();
    renderCtx.fillStyle = '#E2E8F0';
    renderCtx.fillRect(-10, hy + 1, 20, 3);
  } else if (hairStyle === 'afro') {
    renderCtx.beginPath();
    renderCtx.arc(0, hy + 2, 13, 0, Math.PI * 2);
    renderCtx.fill();
  } else if (hairStyle === 'ponytail') {
    renderCtx.fillRect(-10, hy - 2, 20, 6);
    renderCtx.fillRect(8, hy, 6, 12);
  } else if (hairStyle === 'mohawk') {
    renderCtx.fillRect(-3, hy - 7, 6, 9);
  }

  // 7. Headwear / Gear
  if (headwear === 'devfest_cap') {
    renderCtx.fillStyle = outfit;
    renderCtx.fillRect(-10, hy - 2, 20, 4);
    if (direction === 'down') renderCtx.fillRect(-8, hy + 1, 16, 3);
    else if (direction === 'left') renderCtx.fillRect(-14, hy + 1, 10, 3);
    else if (direction === 'right') renderCtx.fillRect(4, hy + 1, 10, 3);
    renderCtx.fillStyle = '#FFFFFF';
    renderCtx.fillRect(-2, hy - 1, 4, 2);
  } else if (headwear === 'vr_headset') {
    renderCtx.fillStyle = '#0F172A';
    renderCtx.strokeStyle = '#00E5FF';
    renderCtx.lineWidth = 1.5;
    renderCtx.strokeRect(-9, hy + 4, 18, 7);
    renderCtx.fillRect(-9, hy + 4, 18, 7);
    renderCtx.fillStyle = '#00E5FF';
    renderCtx.fillRect(-6, hy + 6, 4, 3);
    renderCtx.fillRect(2, hy + 6, 4, 3);
  } else if (headwear === 'google_glasses') {
    renderCtx.fillStyle = '#4285F4';
    renderCtx.fillRect(-7, hy + 5, 5, 4);
    renderCtx.fillStyle = '#EA4335';
    renderCtx.fillRect(2, hy + 5, 5, 4);
    renderCtx.strokeStyle = '#FFF';
    renderCtx.lineWidth = 1;
    renderCtx.strokeRect(-7, hy + 5, 5, 4);
    renderCtx.strokeRect(2, hy + 5, 5, 4);
  } else if (headwear === 'headphones') {
    renderCtx.strokeStyle = '#F59E0B';
    renderCtx.lineWidth = 2.5;
    renderCtx.beginPath();
    renderCtx.arc(0, hy + 4, 11, Math.PI, 0);
    renderCtx.stroke();
    renderCtx.fillStyle = '#F59E0B';
    renderCtx.fillRect(-12, hy + 2, 3, 7);
    renderCtx.fillRect(9, hy + 2, 3, 7);
  } else if (headwear === 'astronaut_helmet') {
    renderCtx.strokeStyle = '#E2E8F0';
    renderCtx.lineWidth = 2.5;
    renderCtx.beginPath();
    renderCtx.arc(0, hy + 5, 12, 0, Math.PI * 2);
    renderCtx.stroke();
    renderCtx.fillStyle = 'rgba(0, 229, 255, 0.4)';
    renderCtx.fill();
  } else if (headwear === 'cat_ears') {
    renderCtx.fillStyle = hair;
    renderCtx.beginPath();
    renderCtx.moveTo(-8, hy - 2); renderCtx.lineTo(-5, hy - 9); renderCtx.lineTo(-2, hy - 2);
    renderCtx.moveTo(2, hy - 2); renderCtx.lineTo(5, hy - 9); renderCtx.lineTo(8, hy - 2);
    renderCtx.fill();
  }

// 8. Overhead Nametag & Badges
  if (showBadge) {
    const badgeY = hy - 14;
    const isVerified = (customVerified !== null) ? customVerified : currentUser.verified_ticket;
    const name = customName || currentUser.display_name;
    const role = customRole || currentUser.role;

    if (isVerified) {
      renderCtx.fillStyle = '#10B981';
      renderCtx.font = 'bold 8px JetBrains Mono, monospace';
      renderCtx.textAlign = 'center';
      renderCtx.fillText('✔ VERIFIED', 0, badgeY);
    }
    
    renderCtx.fillStyle = '#FFFFFF';
    renderCtx.font = 'bold 9px JetBrains Mono, monospace';
    renderCtx.textAlign = 'center';
    renderCtx.shadowColor = 'rgba(0,0,0,0.85)';
    renderCtx.shadowBlur = 4;
    renderCtx.fillText(name, 0, badgeY + (isVerified ? 9 : 0));
    renderCtx.shadowBlur = 0;
  }

  renderCtx.restore();
}

function drawSpeechBubble(renderCtx, x, y, text) {
  if (!text) return;
  renderCtx.save();
  renderCtx.font = '600 8.5px JetBrains Mono, monospace';
  const textWidth = renderCtx.measureText(text).width;
  const bubbleW = textWidth + 16;
  const bubbleH = 22;
  const bx = x - bubbleW / 2;
  const by = y - bubbleH;

  // Shadow
  renderCtx.fillStyle = 'rgba(0,0,0,0.4)';
  renderCtx.beginPath();
  renderCtx.roundRect(bx + 2, by + 3, bubbleW, bubbleH, 6);
  renderCtx.fill();

  // Bubble
  renderCtx.fillStyle = 'rgba(15, 23, 42, 0.95)';
  renderCtx.strokeStyle = '#38BDF8';
  renderCtx.lineWidth = 1.2;
  renderCtx.beginPath();
  renderCtx.roundRect(bx, by, bubbleW, bubbleH, 6);
  renderCtx.fill();
  renderCtx.stroke();

  // Tail
  renderCtx.fillStyle = '#0F172A';
  renderCtx.beginPath();
  renderCtx.moveTo(x - 4, by + bubbleH);
  renderCtx.lineTo(x + 4, by + bubbleH);
  renderCtx.lineTo(x, by + bubbleH + 5);
  renderCtx.closePath();
  renderCtx.fill();

  renderCtx.strokeStyle = '#38BDF8';
  renderCtx.beginPath();
  renderCtx.moveTo(x - 4, by + bubbleH);
  renderCtx.lineTo(x, by + bubbleH + 5);
  renderCtx.lineTo(x + 4, by + bubbleH);
  renderCtx.stroke();

  // Text
  renderCtx.fillStyle = '#F8FAFC';
  renderCtx.textAlign = 'center';
  renderCtx.fillText(text, x, by + 14);
  renderCtx.restore();
}

// --- ACTIVE PARTICIPANTS PRESENCE (MULTIPLAYER / NPCS) ---
const OTHER_PARTICIPANTS = [
  {
    id: 'user-spk-1',
    name: 'Dr. Agent',
    role: 'SPEAKER',
    verified: true,
    x: 645,
    y: 85,
    direction: 'down',
    moving: false,
    stepFrame: 0,
    bobFrame: 0.5,
    avatar: {
      skin_tone: '#FBBF24',
      hair_style: 'spiky',
      hair_color: '#3B82F6',
      outfit_style: 'suit',
      outfit_color: '#3B82F6',
      headwear: 'vr_visor',
      aura: 'sparkles'
    },
    speech: '✨ Keynote starting on Gemini 2.0!',
    speechTimer: 240,
    patrol: { minX: 590, maxX: 700, minY: 75, maxY: 95, targetX: 645, targetY: 85, pause: 60 }
  },
  {
    id: 'user-org-1',
    name: 'GDG Lead',
    role: 'ORGANIZER',
    verified: true,
    x: 480,
    y: 215,
    direction: 'down',
    moving: false,
    stepFrame: 0,
    bobFrame: 1.2,
    avatar: {
      skin_tone: '#FCD34D',
      hair_style: 'curly',
      hair_color: '#1E293B',
      outfit_style: 'gdg_hoodie',
      outfit_color: '#EF4444',
      headwear: 'devfest_cap',
      aura: 'matrix'
    },
    speech: '👋 Welcome to DevFest Bangkok!',
    speechTimer: 300,
    patrol: { minX: 430, maxX: 530, minY: 200, maxY: 235, targetX: 480, targetY: 215, pause: 90 }
  },
  {
    id: 'user-staff-1',
    name: 'Alex Staff',
    role: 'STAFF',
    verified: true,
    x: 170,
    y: 225,
    direction: 'right',
    moving: false,
    stepFrame: 0,
    bobFrame: 2.1,
    avatar: {
      skin_tone: '#F59E0B',
      hair_style: 'short',
      hair_color: '#0F172A',
      outfit_style: 'gdg_hoodie',
      outfit_color: '#F59E0B',
      headwear: 'glasses',
      aura: 'none'
    },
    speech: '💻 Workshop Lab seats ready in Room W1!',
    speechTimer: 200,
    patrol: { minX: 130, maxX: 210, minY: 210, maxY: 240, targetX: 170, targetY: 225, pause: 80 }
  },
  {
    id: 'user-partic-2',
    name: 'Sara Cloud',
    role: 'PARTICIPANT',
    verified: true,
    x: 360,
    y: 420,
    direction: 'right',
    moving: false,
    stepFrame: 0,
    bobFrame: 0.8,
    avatar: {
      skin_tone: '#FDE68A',
      hair_style: 'long',
      hair_color: '#EC4899',
      outfit_style: 'tshirt',
      outfit_color: '#10B981',
      headwear: 'headphones',
      aura: 'cloud_pet'
    },
    speech: '☕ This coffee lounge is so cozy!',
    speechTimer: 260,
    patrol: { minX: 330, maxX: 410, minY: 400, maxY: 450, targetX: 360, targetY: 420, pause: 120 }
  },
  {
    id: 'user-partic-3',
    name: 'Neo Dev',
    role: 'PARTICIPANT',
    verified: false,
    x: 780,
    y: 250,
    direction: 'left',
    moving: false,
    stepFrame: 0,
    bobFrame: 1.7,
    avatar: {
      skin_tone: '#D97706',
      hair_style: 'ponytail',
      hair_color: '#F59E0B',
      outfit_style: 'retro_jacket',
      outfit_color: '#8B5CF6',
      headwear: 'cat_ears',
      aura: 'none'
    },
    speech: '🏢 Vertex AI demo at Google booth is awesome!',
    speechTimer: 320,
    patrol: { minX: 740, maxX: 820, minY: 230, maxY: 270, targetX: 780, targetY: 250, pause: 100 }
  }
];

function updateOtherParticipants() {
  OTHER_PARTICIPANTS.forEach(p => {
    p.speechTimer = (p.speechTimer || 0) - 1;
    if (p.speechTimer <= 0) {
      p.speechTimer = Math.floor(Math.random() * 350) + 250;
    }

    // Autonomous wandering in assigned zone
    if (p.patrol) {
      if (p.patrol.pause > 0) {
        p.patrol.pause--;
        p.moving = false;
        p.bobFrame = (p.bobFrame || 0) + 0.06;
      } else {
        const dx = p.patrol.targetX - p.x;
        const dy = p.patrol.targetY - p.y;
        const dist = Math.hypot(dx, dy);

        if (dist < 3) {
          p.x = p.patrol.targetX;
          p.y = p.patrol.targetY;
          p.moving = false;
          p.patrol.pause = Math.floor(Math.random() * 100) + 70;
          p.patrol.targetX = p.patrol.minX + Math.random() * (p.patrol.maxX - p.patrol.minX);
          p.patrol.targetY = p.patrol.minY + Math.random() * (p.patrol.maxY - p.patrol.minY);
        } else {
          const speed = 1.0;
          const angle = Math.atan2(dy, dx);
          p.x += Math.cos(angle) * speed;
          p.y += Math.sin(angle) * speed;
          p.moving = true;
          p.stepFrame = (p.stepFrame || 0) + 0.2;

          if (Math.abs(Math.cos(angle)) > Math.abs(Math.sin(angle))) {
            p.direction = Math.cos(angle) > 0 ? 'right' : 'left';
          } else {
            p.direction = Math.sin(angle) > 0 ? 'down' : 'up';
          }
        }
      }
    }
  });
}

function renderWorld() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const time = Date.now() * 0.002;

  // 1. Tech Campus Floor - Brighter, Modern Tech Venue Slate
  ctx.fillStyle = '#1A243B';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Subtle alternating tech tiles
  for (let x = 0; x < canvas.width; x += 40) {
    for (let y = 0; y < canvas.height; y += 40) {
      if ((x / 40 + y / 40) % 2 === 0) {
        ctx.fillStyle = '#1E2C48';
        ctx.fillRect(x, y, 40, 40);
      }
    }
  }

  // Crisp grid lines
  ctx.strokeStyle = '#283A60';
  ctx.lineWidth = 1;
  for (let x = 0; x < canvas.width; x += 40) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke();
  }
  for (let y = 0; y < canvas.height; y += 40) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke();
  }

  // 2. Bright Ambient Venue Spotlights under Key Areas
  // Stage Spotlight (Warm Gold/Amber Glow)
  const stageGlow = ctx.createRadialGradient(645, 65, 10, 645, 65, 140);
  stageGlow.addColorStop(0, 'rgba(251, 191, 36, 0.25)');
  stageGlow.addColorStop(1, 'rgba(251, 191, 36, 0)');
  ctx.fillStyle = stageGlow;
  ctx.beginPath(); ctx.arc(645, 65, 140, 0, Math.PI * 2); ctx.fill();

  // Google Cloud Booth Spotlight (Google Blue/Cyan Glow)
  const gcpGlow = ctx.createRadialGradient(790, 220, 10, 790, 220, 130);
  gcpGlow.addColorStop(0, 'rgba(66, 133, 244, 0.28)');
  gcpGlow.addColorStop(1, 'rgba(66, 133, 244, 0)');
  ctx.fillStyle = gcpGlow;
  ctx.beginPath(); ctx.arc(790, 220, 130, 0, Math.PI * 2); ctx.fill();

  // Workshop Labs Spotlight (Purple Glow)
  const wsGlow = ctx.createRadialGradient(170, 220, 10, 170, 220, 130);
  wsGlow.addColorStop(0, 'rgba(139, 92, 246, 0.25)');
  wsGlow.addColorStop(1, 'rgba(139, 92, 246, 0)');
  ctx.fillStyle = wsGlow;
  ctx.beginPath(); ctx.arc(170, 220, 130, 0, Math.PI * 2); ctx.fill();

  // Central Ticket Billboard Spotlight (Emerald Glow)
  const ticketGlow = ctx.createRadialGradient(480, 290, 10, 480, 290, 120);
  ticketGlow.addColorStop(0, 'rgba(16, 185, 129, 0.25)');
  ticketGlow.addColorStop(1, 'rgba(16, 185, 129, 0)');
  ctx.fillStyle = ticketGlow;
  ctx.beginPath(); ctx.arc(480, 290, 120, 0, Math.PI * 2); ctx.fill();

  // 3. COZY ZONE 1: Warm Keynote Wooden Stage (North-East)
  ctx.fillStyle = '#3A2010';
  ctx.beginPath();
  ctx.roundRect(540, 24, 210, 80, [10, 10, 6, 6]);
  ctx.fill();
  ctx.strokeStyle = '#B45309';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Wood planks
  ctx.strokeStyle = 'rgba(251, 191, 36, 0.18)';
  for (let py = 36; py < 100; py += 12) {
    ctx.beginPath(); ctx.moveTo(542, py); ctx.lineTo(748, py); ctx.stroke();
  }
  // Stage Footlights (Google 4-Colors)
  const stageLights = ['#4285F4', '#EA4335', '#FBBC05', '#34A853'];
  stageLights.forEach((col, idx) => {
    const lx = 560 + idx * 45;
    ctx.fillStyle = col;
    ctx.beginPath(); ctx.arc(lx, 102, 3.5, 0, Math.PI * 2); ctx.fill();
    // Soft light glow
    ctx.fillStyle = col + '55';
    ctx.beginPath(); ctx.arc(lx, 102, 10 + Math.sin(time * 2 + idx) * 3, 0, Math.PI * 2); ctx.fill();
  });

  // Stage Podium with Microphone
  ctx.fillStyle = '#78350F';
  ctx.fillRect(640, 72, 14, 18);
  ctx.fillStyle = '#E2E8F0';
  ctx.fillRect(646, 62, 2, 10);
  ctx.beginPath(); ctx.arc(647, 60, 3, 0, Math.PI * 2); ctx.fill();

  // 4. COZY ZONE 2: Warm Velvet Lounge & Cafe (South-Center)
  // Large Rounded Area Rug
  ctx.fillStyle = '#1A294A';
  ctx.beginPath();
  ctx.roundRect(280, 360, 400, 145, 20);
  ctx.fill();
  ctx.strokeStyle = '#F59E0B';
  ctx.lineWidth = 1.5;
  ctx.setLineDash([8, 4]);
  ctx.stroke();
  ctx.setLineDash([]);

  // Cozy Sofas
  // Left Sofa (Navy)
  ctx.fillStyle = '#243456';
  ctx.beginPath(); ctx.roundRect(300, 390, 35, 75, 8); ctx.fill();
  ctx.strokeStyle = '#38BDF8'; ctx.lineWidth = 1.5; ctx.stroke();
  ctx.fillStyle = '#162238';
  ctx.fillRect(305, 395, 25, 65);

  // Right Sofa (Emerald Cozy Armchair)
  ctx.fillStyle = '#243456';
  ctx.beginPath(); ctx.roundRect(625, 390, 35, 75, 8); ctx.fill();
  ctx.strokeStyle = '#34D399'; ctx.lineWidth = 1.5; ctx.stroke();
  ctx.fillStyle = '#064E3B';
  ctx.fillRect(630, 395, 25, 65);

  // Center Coffee Table (Wood & Glass)
  ctx.fillStyle = '#92400E';
  ctx.beginPath(); ctx.roundRect(435, 415, 90, 42, 8); ctx.fill();
  ctx.strokeStyle = '#F59E0B'; ctx.lineWidth = 1.5; ctx.stroke();
  ctx.fillStyle = '#B45309';
  ctx.fillRect(440, 420, 80, 32);

  // Laptop on Table
  ctx.fillStyle = '#F1F5F9';
  ctx.fillRect(450, 425, 18, 12);
  ctx.fillStyle = '#38BDF8';
  ctx.fillRect(452, 426, 14, 9); // Glowing screen

  // Steaming Coffee Cups on Table
  ctx.fillStyle = '#FFFFFF';
  ctx.beginPath(); ctx.arc(485, 432, 4, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#78350F';
  ctx.beginPath(); ctx.arc(485, 432, 2.5, 0, Math.PI * 2); ctx.fill();
  // Animated Steam Wisps
  const steamY = (time * 15) % 12;
  ctx.strokeStyle = 'rgba(255,255,255,0.6)';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(485, 427 - steamY);
  ctx.quadraticCurveTo(488, 423 - steamY, 485, 419 - steamY);
  ctx.stroke();

  // Cozy Beanbag Chairs
  ctx.fillStyle = '#A78BFA';
  ctx.beginPath(); ctx.ellipse(370, 455, 14, 11, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#F472B6';
  ctx.beginPath(); ctx.ellipse(590, 455, 14, 11, 0, 0, Math.PI * 2); ctx.fill();

  // 5. Lush Indoor Planters & Monsteras
  const plantPositions = [[275, 365], [680, 365], [75, 485], [885, 485], [515, 30]];
  plantPositions.forEach(([px, py]) => {
    // Ceramic Pot
    ctx.fillStyle = '#D97706';
    ctx.beginPath(); ctx.roundRect(px - 7, py, 14, 14, [2, 2, 6, 6]); ctx.fill();
    ctx.fillStyle = '#B45309';
    ctx.fillRect(px - 8, py, 16, 3);
    // Monstera Green Leaves
    ctx.fillStyle = '#34D399';
    ctx.beginPath(); ctx.ellipse(px - 6, py - 6, 8, 5, -0.4, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(px + 6, py - 6, 8, 5, 0.4, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#10B981';
    ctx.beginPath(); ctx.ellipse(px, py - 10, 6, 9, 0, 0, Math.PI * 2); ctx.fill();
  });

  // 6. Hanging Festive / Fairy String Lights (Top Ceiling Canopy)
  ctx.strokeStyle = 'rgba(255,255,255,0.25)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, 18);
  ctx.quadraticCurveTo(240, 35, 480, 18);
  ctx.quadraticCurveTo(720, 35, 960, 18);
  ctx.stroke();

  // Light Bulbs along string
  for (let lx = 30; lx < 940; lx += 45) {
    const ly = 18 + Math.sin((lx / 960) * Math.PI * 2) * 10;
    const bulbColor = (lx % 90 === 0) ? '#FBBF24' : (lx % 60 === 0) ? '#38BDF8' : '#F472B6';
    ctx.fillStyle = bulbColor;
    ctx.beginPath(); ctx.arc(lx, ly, 3, 0, Math.PI * 2); ctx.fill();
    // Warm Ambient Light Bloom
    ctx.fillStyle = bulbColor + '33';
    ctx.beginPath(); ctx.arc(lx, ly, 8 + Math.sin(time * 3 + lx) * 2, 0, Math.PI * 2); ctx.fill();
  }

  // 7. Floating Ambient Sparkle Dust Particles
  for (let i = 0; i < 20; i++) {
    const partX = (i * 55 + Math.sin(time + i) * 40 + canvas.width) % canvas.width;
    const partY = (i * 32 + Math.cos(time + i * 2) * 30 + canvas.height) % canvas.height;
    ctx.fillStyle = 'rgba(251, 191, 36, 0.4)';
    ctx.beginPath(); ctx.arc(partX, partY, 1.3, 0, Math.PI * 2); ctx.fill();
  }

  // 8. Google Color Circuit Paths on Floor
  ctx.lineWidth = 3.5;
  ctx.strokeStyle = '#3B82F655';
  ctx.beginPath(); ctx.moveTo(100, 100); ctx.lineTo(480, 100); ctx.lineTo(480, 360); ctx.stroke();
  ctx.strokeStyle = '#EF444455';
  ctx.beginPath(); ctx.moveTo(780, 100); ctx.lineTo(480, 100); ctx.stroke();
  ctx.strokeStyle = '#10B98155';
  ctx.beginPath(); ctx.moveTo(170, 290); ctx.lineTo(420, 290); ctx.stroke();

  // 9. Hotspot Holographic Platforms & Billboards
  HOTSPOTS.forEach(spot => {
    const cx = spot.x + spot.width / 2;
    const cy = spot.y + spot.height / 2;

    // Glowing pulsating ring under hotspot
    const pulse = Math.sin(time + spot.x) * 3;
    ctx.fillStyle = spot.ringColor + '33';
    ctx.beginPath();
    ctx.ellipse(cx, cy + spot.height / 2, spot.width / 2 + 10 + pulse, 14 + pulse / 2, 0, 0, Math.PI * 2);
    ctx.fill();

    // Billboard / Booth Box
    ctx.fillStyle = '#111C33';
    ctx.beginPath();
    ctx.roundRect(spot.x, spot.y, spot.width, spot.height, 8);
    ctx.fill();

    ctx.strokeStyle = spot.color;
    ctx.lineWidth = (player.nearHotspot === spot) ? 3 : 1.5;
    ctx.stroke();

    // Top Accent strip
    ctx.fillStyle = spot.color;
    ctx.beginPath();
    ctx.roundRect(spot.x, spot.y, spot.width, 6, [8, 8, 0, 0]);
    ctx.fill();

    // Label Text in Monospace
    ctx.fillStyle = '#FFF';
    ctx.font = 'bold 9.5px JetBrains Mono, monospace';
    ctx.textAlign = 'center';
    ctx.fillText(spot.label, cx, spot.y + spot.height / 2 + (spot.sub ? -2 : 3));

    if (spot.sub) {
      ctx.fillStyle = '#94A3B8';
      ctx.font = '7.5px JetBrains Mono, monospace';
      ctx.fillText(spot.sub, cx, spot.y + spot.height / 2 + 10);
    }
  });

  // 10. Tap-to-Move Glowing Destination Ring
  if (player.targetX !== null && player.targetY !== null) {
    const pulse = (Date.now() * 0.006) % (Math.PI * 2);
    ctx.strokeStyle = '#00E5FF';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(player.targetX, player.targetY, 8 + Math.sin(pulse) * 3, 4 + Math.sin(pulse) * 1.5, 0, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = '#00E5FF66';
    ctx.beginPath();
    ctx.arc(player.targetX, player.targetY, 3, 0, Math.PI * 2);
    ctx.fill();
  }

  // 11. Render Other Active Participants (Multiplayer & NPCs)
  updateOtherParticipants();
  OTHER_PARTICIPANTS.forEach(p => {
    // Dynamic bouncy bobbing when walking + cute breathing bob when idle!
    const pBob = p.moving
      ? -Math.abs(Math.sin((p.stepFrame || 0) * 1.5)) * 4.5
      : Math.sin(p.bobFrame || 0) * 3.5;

    drawCharacterSprite(
      ctx,
      p.x,
      p.y,
      p.avatar,
      p.moving,
      p.stepFrame || 0,
      pBob,
      p.direction || 'down',
      1.05,
      true,
      p.name,
      p.role,
      p.verified
    );

    // Floating Speech Bubble if talking
    if (p.speech && p.speechTimer > 80) {
      drawSpeechBubble(ctx, p.x, p.y - 50, p.speech);
    }
  });

  // 12. Render Local Player Sprite with Bouncy Step Animation!
  const bobOffset = player.moving
    ? -Math.abs(Math.sin(player.stepFrame * 1.5)) * 5
    : Math.sin(player.bobFrame) * 3.5;

  drawCharacterSprite(
    ctx,
    player.x,
    player.y,
    currentUser.avatar_config || studioConfig,
    player.moving,
    player.stepFrame,
    bobOffset,
    player.direction,
    1.1,
    true,
    currentUser.display_name,
    currentUser.role,
    currentUser.verified_ticket
  );

  // 13. Mini-Map Radar on Bottom-Right
  renderRadar();
}

function renderRadar() {
  const radarW = 120, radarH = 70;
  const rx = canvas.width - radarW - 14, ry = canvas.height - radarH - 14;

  ctx.fillStyle = 'rgba(11, 15, 25, 0.85)';
  ctx.strokeStyle = '#23314D';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(rx, ry, radarW, radarH, 6);
  ctx.fill();
  ctx.stroke();

  // Radar Grid
  ctx.strokeStyle = 'rgba(255,255,255,0.05)';
  ctx.strokeRect(rx + 10, ry + 10, radarW - 20, radarH - 20);

  // Radar Hotspot blips
  HOTSPOTS.forEach(spot => {
    const bx = rx + (spot.x / canvas.width) * radarW;
    const by = ry + (spot.y / canvas.height) * radarH;
    ctx.fillStyle = spot.color;
    ctx.fillRect(bx - 1.5, by - 1.5, 3, 3);
  });

  // Player radar blip (pulsing cyan)
  const px = rx + (player.x / canvas.width) * radarW;
  const py = ry + (player.y / canvas.height) * radarH;
  ctx.fillStyle = '#00E5FF';
  ctx.beginPath();
  ctx.arc(px, py, 2.5, 0, Math.PI * 2);
  ctx.fill();
}

function gameLoop() {
  try {
    if (canvas && ctx) {
      updatePlayer();
      renderWorld();
    }
  } catch (err) {
    console.error('Canvas render loop recovered from error:', err);
  }
  if (typeof requestAnimationFrame !== 'undefined') {
    requestAnimationFrame(gameLoop);
  } else if (typeof window !== 'undefined' && window.requestAnimationFrame) {
    window.requestAnimationFrame(gameLoop);
  }
}

// --- CHARACTER STUDIO CUSTOMIZER ---
const SKIN_TONES = ['#FCD34D', '#FBBF24', '#F59E0B', '#D97706', '#B45309', '#78350F', '#93C5FD', '#F472B6'];
const HAIR_COLORS = ['#1E293B', '#F59E0B', '#EF4444', '#3B82F6', '#10B981', '#EC4899', '#8B5CF6', '#FFFFFF'];
const OUTFIT_COLORS = ['#4285F4', '#EA4335', '#FBBC04', '#34A853', '#8B5CF6', '#0F172A', '#EC4899', '#06B6D4'];

const HAIR_STYLES = [
  { id: 'short', name: 'Short Dev' },
  { id: 'spiky', name: 'Spiky Anime' },
  { id: 'beanie', name: 'Dev Beanie' },
  { id: 'afro', name: 'Afro' },
  { id: 'ponytail', name: 'Ponytail' },
  { id: 'mohawk', name: 'Cyber Mohawk' }
];

const OUTFIT_STYLES = [
  { id: 'gdg_hoodie', name: 'GDG Cloud Hoodie' },
  { id: 'devfest_tshirt', name: 'DevFest 2026 Tee' },
  { id: 'cyber_jacket', name: 'Cyberpunk Runner' },
  { id: 'google_tee', name: 'Google Cloud Tee' },
  { id: 'suit', name: 'Keynote Blazer' }
];

const HEADWEAR_ITEMS = [
  { id: 'none', name: 'None' },
  { id: 'devfest_cap', name: '🧢 DevFest Cap' },
  { id: 'vr_headset', name: '🥽 VR Visor' },
  { id: 'google_glasses', name: '👓 Google Glass' },
  { id: 'headphones', name: '🎧 DJ Headphones' },
  { id: 'cat_ears', name: '🐱 Cat Ears' },
  { id: 'astronaut_helmet', name: '🚀 Space Helmet' }
];

const AURA_ITEMS = [
  { id: 'none', name: 'None' },
  { id: 'cloud_pet', name: '☁️ Orbiting Cloud Pet' },
  { id: 'ai_sparkles', name: '✨ AI Energy Sparkles' },
  { id: 'matrix_glow', name: '💻 Matrix Code Aura' }
];

const THEME_PRESETS = [
  { id: 'devfest-std', name: 'DevFest Standard', config: { skin_tone: '#FBBF24', hair_style: 'short', hair_color: '#1E293B', outfit_style: 'gdg_hoodie', outfit_color: '#4285F4', headwear: 'devfest_cap', aura: 'none' } },
  { id: 'gcp-hero', name: 'Google Cloud Hero', config: { skin_tone: '#FCD34D', hair_style: 'spiky', hair_color: '#3B82F6', outfit_style: 'google_tee', outfit_color: '#34A853', headwear: 'google_glasses', aura: 'cloud_pet' } },
  { id: 'cyber-agent', name: 'Cyberpunk Hacker', config: { skin_tone: '#93C5FD', hair_style: 'mohawk', hair_color: '#EC4899', outfit_style: 'cyber_jacket', outfit_color: '#8B5CF6', headwear: 'vr_headset', aura: 'matrix_glow' } },
  { id: 'ai-speaker', name: 'Keynote Speaker', config: { skin_tone: '#F59E0B', hair_style: 'ponytail', hair_color: '#1E293B', outfit_style: 'suit', outfit_color: '#0F172A', headwear: 'headphones', aura: 'ai_sparkles' } }
];

function initStudioControls() {
  // Skin Swatches
  const skinEl = document.getElementById('skin-swatches');
  if (skinEl) {
    skinEl.innerHTML = SKIN_TONES.map(c => `
      <div class="color-swatch ${studioConfig.skin_tone === c ? 'selected' : ''}" style="background: ${c};" onclick="selectStudioOption('skin_tone', '${c}')"></div>
    `).join('');
  }

  // Hair Swatches
  const hairEl = document.getElementById('hair-swatches');
  if (hairEl) {
    hairEl.innerHTML = HAIR_COLORS.map(c => `
      <div class="color-swatch ${studioConfig.hair_color === c ? 'selected' : ''}" style="background: ${c};" onclick="selectStudioOption('hair_color', '${c}')"></div>
    `).join('');
  }

  // Outfit Swatches
  const outfitEl = document.getElementById('outfit-swatches');
  if (outfitEl) {
    outfitEl.innerHTML = OUTFIT_COLORS.map(c => `
      <div class="color-swatch ${studioConfig.outfit_color === c ? 'selected' : ''}" style="background: ${c};" onclick="selectStudioOption('outfit_color', '${c}')"></div>
    `).join('');
  }

  // Hair Style Chips
  const hairStyleEl = document.getElementById('hair-style-chips');
  if (hairStyleEl) {
    hairStyleEl.innerHTML = HAIR_STYLES.map(s => `
      <div class="option-chip ${studioConfig.hair_style === s.id ? 'selected' : ''}" onclick="selectStudioOption('hair_style', '${s.id}')">${s.name}</div>
    `).join('');
  }

  // Outfit Style Chips
  const outfitStyleEl = document.getElementById('outfit-style-chips');
  if (outfitStyleEl) {
    outfitStyleEl.innerHTML = OUTFIT_STYLES.map(s => `
      <div class="option-chip ${studioConfig.outfit_style === s.id ? 'selected' : ''}" onclick="selectStudioOption('outfit_style', '${s.id}')">${s.name}</div>
    `).join('');
  }

  // Headwear Chips
  const headwearEl = document.getElementById('headwear-chips');
  if (headwearEl) {
    headwearEl.innerHTML = HEADWEAR_ITEMS.map(h => `
      <div class="option-chip ${studioConfig.headwear === h.id ? 'selected' : ''}" onclick="selectStudioOption('headwear', '${h.id}')">${h.name}</div>
    `).join('');
  }

  // Aura Chips
  const auraEl = document.getElementById('aura-chips');
  if (auraEl) {
    auraEl.innerHTML = AURA_ITEMS.map(a => `
      <div class="option-chip ${studioConfig.aura === a.id ? 'selected' : ''}" onclick="selectStudioOption('aura', '${a.id}')">${a.name}</div>
    `).join('');
  }

  // Theme Presets
  const themeEl = document.getElementById('theme-presets');
  if (themeEl) {
    themeEl.innerHTML = THEME_PRESETS.map(p => `
      <div class="option-chip" onclick="applyThemePreset('${p.id}')">${p.name}</div>
    `).join('');
  }
}

function selectStudioOption(key, val) {
  studioConfig[key] = val;
  initStudioControls();
}

function applyThemePreset(presetId) {
  const preset = THEME_PRESETS.find(p => p.id === presetId);
  if (preset) {
    studioConfig = { ...studioConfig, ...preset.config };
    initStudioControls();
    showToast(`Loaded "${preset.name}" style preset!`, '✨');
  }
}

function randomizeCharacter() {
  studioConfig = {
    skin_tone: SKIN_TONES[Math.floor(Math.random() * SKIN_TONES.length)],
    hair_style: HAIR_STYLES[Math.floor(Math.random() * HAIR_STYLES.length)].id,
    hair_color: HAIR_COLORS[Math.floor(Math.random() * HAIR_COLORS.length)],
    outfit_style: OUTFIT_STYLES[Math.floor(Math.random() * OUTFIT_STYLES.length)].id,
    outfit_color: OUTFIT_COLORS[Math.floor(Math.random() * OUTFIT_COLORS.length)],
    headwear: HEADWEAR_ITEMS[Math.floor(Math.random() * HEADWEAR_ITEMS.length)].id,
    aura: AURA_ITEMS[Math.floor(Math.random() * AURA_ITEMS.length)].id,
    theme: 'custom-random'
  };
  initStudioControls();
  showToast('Character randomized! 🎲', '🎲');
}

function switchStudioTab(tabId) {
  document.querySelectorAll('.studio-tab-pane').forEach(p => p.style.display = 'none');
  document.querySelectorAll('.studio-tab-btn').forEach(b => b.classList.remove('active'));
  document.getElementById(tabId).style.display = 'block';
  event.target.classList.add('active');
}

// Studio Preview Canvas loop
const previewCanvas = document.getElementById('studioPreviewCanvas');
const previewCtx = previewCanvas ? previewCanvas.getContext('2d') : null;
let studioPreviewFrame = 0;

function studioPreviewLoop() {
  if (previewCanvas && previewCtx) {
    previewCtx.clearRect(0, 0, previewCanvas.width, previewCanvas.height);
    studioPreviewFrame += 0.08;
    const bob = Math.sin(studioPreviewFrame) * 3;
    drawCharacterSprite(
      previewCtx,
      previewCanvas.width / 2,
      previewCanvas.height / 2 + 16,
      studioConfig,
      false,
      0,
      bob,
      'down',
      1.8,
      false
    );
  }
  if (typeof requestAnimationFrame !== 'undefined') {
    requestAnimationFrame(studioPreviewLoop);
  } else if (typeof window !== 'undefined' && window.requestAnimationFrame) {
    window.requestAnimationFrame(studioPreviewLoop);
  }
}

function saveUserSession(user) {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem('devfestverse_user', JSON.stringify(user));
    if (user.avatar_config) {
      localStorage.setItem('devfestverse_avatar', JSON.stringify(user.avatar_config));
    }
  } catch (e) {}
}

async function saveAndApplyAvatar() {
  try {
    const data = await fetchAPI('/avatar/customize', {
      method: 'POST',
      body: JSON.stringify(studioConfig)
    });
    currentUser.avatar_config = { ...studioConfig };
    saveUserSession(currentUser);
    updateUserUI();
    showToast(data.message || '🎉 Avatar design saved to Firestore & applied!', '🎨');
    closeModal('avatar-studio-modal');
  } catch (err) {
    showToast('Error saving avatar configuration.', '⚠️');
  }
}

function useQuickPrompt(text) {
  const input = document.getElementById('ai-avatar-prompt');
  if (input) input.value = text;
  generateWithBrowserLocalAI();
}

async function generateWithBrowserLocalAI() {
  const promptInput = document.getElementById('ai-avatar-prompt');
  const prompt = (promptInput?.value || '').trim();
  if (!prompt) {
    showToast('Please type a prompt for Browser Local AI character synthesis!', '⚠️');
    return;
  }

  showToast('Synthesizing character with Browser Local AI...', '🧠');
  
  let newConfig = { ...studioConfig };
  let usedModel = 'Browser On-Device Local Engine';

  // Check for Chrome Built-in AI (Prompt API / Gemini Nano in Browser)
  if (typeof window !== 'undefined' && window.ai && window.ai.languageModel) {
    try {
      const session = await window.ai.languageModel.create({
        systemPrompt: "You are a 2D pixel avatar designer for DevFest 2026. Given a character description, respond with valid JSON with keys: skin_tone, hair_style, hair_color, outfit_style, outfit_color, headwear, aura, theme"
      });
      const rawRes = await session.prompt(prompt);
      const jsonMatch = rawRes.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        newConfig = { ...newConfig, ...parsed };
        usedModel = 'Chrome Built-in Gemini Nano (window.ai)';
      }
    } catch (e) {
      console.log('Falling back to browser on-device semantic engine');
    }
  }

  // Browser Local Semantic & Rule Pipeline (100% Client-Side)
  const p = prompt.toLowerCase();

  // Headwear mapping
  if (p.includes('cat') || p.includes('neko') || p.includes('ear')) newConfig.headwear = 'cat_ears';
  else if (p.includes('vr') || p.includes('visor') || p.includes('oculus')) newConfig.headwear = 'vr_headset';
  else if (p.includes('glass') || p.includes('spectacle')) newConfig.headwear = 'google_glasses';
  else if (p.includes('headphone') || p.includes('audio') || p.includes('music') || p.includes('lofi') || p.includes('streamer')) newConfig.headwear = 'headphones';
  else if (p.includes('space') || p.includes('astro') || p.includes('helmet')) newConfig.headwear = 'astronaut_helmet';
  else if (p.includes('cap') || p.includes('hat')) newConfig.headwear = 'devfest_cap';

  // Aura mapping
  if (p.includes('matrix') || p.includes('cyber') || p.includes('neon') || p.includes('hack')) newConfig.aura = 'matrix_glow';
  else if (p.includes('sparkle') || p.includes('star') || p.includes('magic') || p.includes('ai') || p.includes('agent')) newConfig.aura = 'ai_sparkles';
  else if (p.includes('cloud') || p.includes('pet') || p.includes('gopher')) newConfig.aura = 'cloud_pet';
  else if (p.includes('fire') || p.includes('flame') || p.includes('burn')) newConfig.aura = 'fire_trail';

  // Hair style mapping
  if (p.includes('spik') || p.includes('anime') || p.includes('punk')) newConfig.hair_style = 'spiky';
  else if (p.includes('afro') || p.includes('curly')) newConfig.hair_style = 'afro';
  else if (p.includes('pony') || p.includes('tail') || p.includes('girl')) newConfig.hair_style = 'ponytail';
  else if (p.includes('beanie')) newConfig.hair_style = 'beanie';
  else if (p.includes('mohawk')) newConfig.hair_style = 'mohawk';
  else if (p.includes('bald') || p.includes('none')) newConfig.hair_style = 'none';
  else newConfig.hair_style = 'short';

  // Hair color mapping
  if (p.includes('blue') || p.includes('cyan')) newConfig.hair_color = '#3B82F6';
  else if (p.includes('pink') || p.includes('magenta')) newConfig.hair_color = '#EC4899';
  else if (p.includes('red') || p.includes('crimson')) newConfig.hair_color = '#EF4444';
  else if (p.includes('green') || p.includes('emerald')) newConfig.hair_color = '#10B981';
  else if (p.includes('purple') || p.includes('violet')) newConfig.hair_color = '#8B5CF6';
  else if (p.includes('blonde') || p.includes('yellow') || p.includes('gold')) newConfig.hair_color = '#F59E0B';
  else if (p.includes('white') || p.includes('silver')) newConfig.hair_color = '#FFFFFF';
  else newConfig.hair_color = '#1E293B';

  // Outfit style mapping
  if (p.includes('hoodie') || p.includes('gdg')) newConfig.outfit_style = 'gdg_hoodie';
  else if (p.includes('jacket') || p.includes('cyber') || p.includes('leather')) newConfig.outfit_style = 'cyber_jacket';
  else if (p.includes('suit') || p.includes('formal') || p.includes('tie')) newConfig.outfit_style = 'suit';
  else newConfig.outfit_style = 'devfest_tshirt';

  // Outfit color mapping
  if (p.includes('blue') || p.includes('google')) newConfig.outfit_color = '#4285F4';
  else if (p.includes('red')) newConfig.outfit_color = '#EA4335';
  else if (p.includes('yellow') || p.includes('gold')) newConfig.outfit_color = '#FBBC04';
  else if (p.includes('green')) newConfig.outfit_color = '#34A853';
  else if (p.includes('purple')) newConfig.outfit_color = '#8B5CF6';
  else if (p.includes('pink')) newConfig.outfit_color = '#EC4899';
  else if (p.includes('dark') || p.includes('black')) newConfig.outfit_color = '#0F172A';

  // Skin tone
  if (p.includes('alien') || p.includes('avatar') || p.includes('blue skin')) newConfig.skin_tone = '#93C5FD';
  else if (p.includes('pink skin')) newConfig.skin_tone = '#F472B6';
  else if (p.includes('dark skin') || p.includes('brown')) newConfig.skin_tone = '#78350F';
  else newConfig.skin_tone = '#FBBF24';

  studioConfig = { ...newConfig, theme: 'browser-local-ai' };
  initStudioControls();
  showToast(`Character generated locally via ${usedModel}! ✨`, '⚡');
}

// Backward compatibility alias
const generateWithGeminiAI = generateWithBrowserLocalAI;

// --- AUTH & GOOGLE ONBOARDING ---
function parseJwt(token) {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(atob(base64).split('').map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)).join(''));
    return JSON.parse(jsonPayload);
  } catch (e) {
    return null;
  }
}

async function handleGoogleCredentialResponse(response) {
  if (!response || !response.credential) return;
  const payload = parseJwt(response.credential);
  const email = payload ? payload.email : `dev.${Math.floor(Math.random() * 1000)}@gmail.com`;
  const name = payload ? payload.name : 'Google Developer';
  const picture = payload ? payload.picture : null;

  try {
    const data = await fetchAPI('/auth/google-login', {
      method: 'POST',
      body: JSON.stringify({
        google_token: response.credential,
        email: email,
        display_name: name,
        avatar_url: picture,
        avatar_config: studioConfig
      })
    });

    if (data.user) {
      currentUser = data.user;
      if (currentUser.avatar_config) {
        studioConfig = { ...currentUser.avatar_config };
        initStudioControls();
      }
      saveUserSession(currentUser);
      updateUserUI();
      closeModal('signin-modal');
      showToast(`Welcome back ${currentUser.display_name}! Signed in via Google & restored your avatar! 🎨`, '🚀');
    }
  } catch (err) {
    showToast('Google Sign-In failed.', '⚠️');
  }
}

async function loginWithGoogle() {
  if (window.google && window.google.accounts && window.google.accounts.id) {
    try {
      window.google.accounts.id.prompt((notification) => {
        if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
          // Fallback to direct demo login if Google One-Tap is dismissed
          loginWithMockGoogle();
        }
      });
      return;
    } catch (e) {
      loginWithMockGoogle();
      return;
    }
  }
  loginWithMockGoogle();
}

async function loginWithMockGoogle() {
  const mockEmail = `dev.${Math.floor(Math.random() * 1000)}@gmail.com`;
  const mockName = `Google Dev ${Math.floor(Math.random() * 1000)}`;

  try {
    const data = await fetchAPI('/auth/google-login', {
      method: 'POST',
      body: JSON.stringify({
        google_token: 'oauth2-token-mock-gdg',
        email: mockEmail,
        display_name: mockName,
        avatar_config: studioConfig
      })
    });

    if (data.user) {
      currentUser = data.user;
      if (currentUser.avatar_config) {
        studioConfig = { ...currentUser.avatar_config };
        initStudioControls();
      }
      saveUserSession(currentUser);
      updateUserUI();
      closeModal('signin-modal');
      showToast(`Welcome back ${currentUser.display_name}! Restored avatar from Firestore! 🎨`, '🚀');
    } else {
      showToast(data.detail || 'Google Sign-in failed', '⚠️');
    }
  } catch (err) {
    showToast('Google Sign-in failed.', '⚠️');
  }
}

function selectDemoAccount(userId, name, role, verified) {
  currentUser.id = userId;
  currentUser.display_name = name.split(' ')[0];
  currentUser.role = role;
  currentUser.verified_ticket = verified;
  
  if (role === 'ORGANIZER') {
    studioConfig = { ...THEME_PRESETS[3].config, outfit_color: '#EF4444' };
  } else if (role === 'STAFF') {
    studioConfig = { ...THEME_PRESETS[0].config, outfit_color: '#F59E0B' };
  } else if (role === 'SPEAKER') {
    studioConfig = { ...THEME_PRESETS[3].config };
  } else {
    studioConfig = { ...THEME_PRESETS[0].config };
  }
  currentUser.avatar_config = { ...studioConfig };

  updateUserUI();
  closeModal('signin-modal');
  showToast(`Switched account to ${name}`, '👤');
  loadWorkshops(); // reload workshops state for the new user account
}

function updateUserUI() {
  document.getElementById('user-display-name').innerText = currentUser.display_name;
  const roleBadge = document.getElementById('user-role-badge');
  roleBadge.innerText = currentUser.role + (currentUser.verified_ticket ? ' (VERIFIED)' : '');
  roleBadge.className = `badge ${currentUser.role.toLowerCase()} ${currentUser.verified_ticket ? 'verified' : ''}`;

  const studioCharName = document.getElementById('studio-char-name');
  if (studioCharName) studioCharName.innerText = currentUser.display_name;
  const studioCharBadge = document.getElementById('studio-char-badge');
  if (studioCharBadge) {
    studioCharBadge.innerText = currentUser.role;
    studioCharBadge.className = `badge ${currentUser.role.toLowerCase()}`;
  }

  const googleSigninText = document.getElementById('google-signin-text');
  if (googleSigninText) {
    googleSigninText.innerText = currentUser.email ? `Switch Account` : `Sign in with Google`;
  }

  // Back Office button visibility - Only visible to ORGANIZER and STAFF
  const backofficeBtn = document.getElementById('backoffice-hud-btn');
  if (backofficeBtn) {
    if (currentUser.role === 'ORGANIZER' || currentUser.role === 'STAFF') {
      backofficeBtn.style.display = 'inline-flex';
    } else {
      backofficeBtn.style.display = 'none';
    }
  }

  const mobileBackofficeBtn = document.getElementById('mobile-backoffice-btn');
  if (mobileBackofficeBtn) {
    if (currentUser.role === 'ORGANIZER' || currentUser.role === 'STAFF') {
      mobileBackofficeBtn.style.display = 'flex';
    } else {
      mobileBackofficeBtn.style.display = 'none';
    }
  }
}

// --- MODALS & NOTIFICATIONS ---
function isAnyModalActive() {
  return document.querySelector('.modal-overlay.active') !== null;
}

function openModal(id) {
  if (id === 'backoffice-modal') {
    if (currentUser.role !== 'ORGANIZER' && currentUser.role !== 'STAFF') {
      showToast('Access restricted: Back Office is only visible and accessible to Organizers & Staff.', '⛔');
      return;
    }
    showAdminTab('users-admin-tab');
    loadBackofficeUsers();
    loadAdminSessions();
    loadAdminFeedback();
  }

  const el = document.getElementById(id);
  if (el) el.classList.add('active');
  if (id === 'avatar-studio-modal') {
    studioConfig = { ...(currentUser.avatar_config || studioConfig) };
    initStudioControls();
  }
  if (id === 'agenda-modal') loadAgenda();
  if (id === 'workshops-modal') loadWorkshops();
  if (id === 'qna-modal') loadQnA();
  if (id === 'bgm-modal') loadBGM();
  if (id === 'feedback-modal') {
    setFeedbackOverallRating(currentOverallStarRating || 5);
    setFeedbackContentRating(currentContentRating || 5);
    setFeedbackVenueRating(currentVenueRating || 5);
    setFeedbackNps(currentNpsScore !== undefined ? currentNpsScore : 10);
  }
  if (id === 'builder-showcase-modal') loadBuilderProjects();
}

function closeModal(id) {
  const el = document.getElementById(id);
  if (el) el.classList.remove('active');
}

function closeAllModals() {
  document.querySelectorAll('.modal-overlay').forEach(m => m.classList.remove('active'));
}

function openBillboardModal(title, url) {
  document.getElementById('billboard-modal-title').innerText = title;
  document.getElementById('billboard-new-tab-btn').href = url;
  const body = document.getElementById('billboard-modal-body');

  if (url.includes('gdg.community.dev')) {
    body.innerHTML = `
      <div style="background:linear-gradient(135deg, rgba(66, 133, 244, 0.15), #0F172A); border:1.5px solid #4285F4; border-radius:14px; padding:24px; text-align:center;">
        <div style="font-size:3rem; margin-bottom:10px;">🌐</div>
        <h3 style="color:#FFF; font-size:1.3rem; margin-bottom:6px;">GDG Cloud Bangkok Official Chapter</h3>
        <p style="color:#94A3B8; font-size:0.85rem; max-width:500px; margin:0 auto 18px;">Join the official Google Developer Groups Cloud Bangkok Chapter to RSVP for upcoming meetups, get official tickets, and connect with 6,000+ local cloud developers & architects.</p>
        <div style="display:flex; justify-content:center; gap:10px; margin-bottom:20px; flex-wrap:wrap;">
          <span style="background:rgba(66,133,244,0.2); color:#60A5FA; border:1px solid rgba(66,133,244,0.4); padding:4px 12px; border-radius:6px; font-size:0.75rem; font-weight:700;">🌟 Official GDG Portal</span>
          <span style="background:rgba(52,168,83,0.2); color:#4ADE80; border:1px solid rgba(52,168,83,0.4); padding:4px 12px; border-radius:6px; font-size:0.75rem; font-weight:700;">🎟️ Event RSVPs & Tickets</span>
          <span style="background:rgba(251,188,4,0.2); color:#FDE047; border:1px solid rgba(251,188,4,0.4); padding:4px 12px; border-radius:6px; font-size:0.75rem; font-weight:700;">🤝 6,000+ Members</span>
        </div>
        <a href="${url}" target="_blank" rel="noopener noreferrer" class="hud-btn primary" style="display:inline-flex; padding:12px 28px; font-size:0.9rem; font-weight:700; text-decoration:none; background:linear-gradient(135deg, #4285F4, #2563EB); border-color:#60A5FA;">
          🌐 Visit GDG Cloud Bangkok Chapter Portal
        </a>
      </div>
    `;
  } else if (url.includes('youtube.com')) {
    // Official YouTube Embed Player (100% permitted by YouTube CSP/X-Frame-Options)
    body.innerHTML = `
      <div style="display:flex; flex-direction:column; gap:16px;">
        <div style="position:relative; padding-bottom:56.25%; height:0; overflow:hidden; border-radius:12px; background:#000; box-shadow:0 8px 24px rgba(0,0,0,0.5);">
          <iframe 
            style="position:absolute; top:0; left:0; width:100%; height:100%; border:0;" 
            src="https://www.youtube-nocookie.com/embed/5qap5aO4i9A?autoplay=1" 
            title="GDG Cloud Bangkok Keynote Video" 
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" 
            allowfullscreen>
          </iframe>
        </div>
        <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px; background:#1A243B; padding:14px 18px; border-radius:10px; border:1px solid var(--card-border);">
          <div style="display:flex; align-items:center; gap:12px;">
            <div style="width:40px; height:40px; border-radius:50%; background:#FF0000; display:flex; align-items:center; justify-content:center; font-size:1.3rem;">▶️</div>
            <div>
              <div style="font-weight:700; font-size:0.95rem; color:#FFF;">GDG Cloud Bangkok YouTube</div>
              <div style="font-size:0.75rem; color:#94A3B8;">Watch talk replays, tech demos, and community workshops</div>
            </div>
          </div>
          <a href="${url}" target="_blank" rel="noopener noreferrer" class="hud-btn" style="background:#EF4444; border-color:#F87171; color:#FFF; text-decoration:none;">
            📺 Subscribe & Watch Channel
          </a>
        </div>
      </div>
    `;
  } else if (url.includes('discord.gg')) {
    body.innerHTML = `
      <div style="background:linear-gradient(135deg, #5865F222, #1E1F22); border:1.5px solid #5865F288; border-radius:14px; padding:24px; text-align:center;">
        <div style="font-size:3rem; margin-bottom:10px;">💬</div>
        <h3 style="color:#FFF; font-size:1.3rem; margin-bottom:6px;">GDG Cloud Bangkok Discord Server</h3>
        <p style="color:#94A3B8; font-size:0.85rem; max-width:480px; margin:0 auto 18px;">Join 4,500+ cloud architects, AI builders, and engineers for real-time discussion, session Q&A, and event networking.</p>
        <div style="display:flex; justify-content:center; gap:12px; margin-bottom:20px;">
          <span style="background:#5865F233; color:#818CF8; border:1px solid #5865F266; padding:4px 10px; border-radius:6px; font-size:0.75rem; font-weight:700;">🟢 1,200+ Online</span>
          <span style="background:#10B98122; color:#34D399; border:1px solid #10B98144; padding:4px 10px; border-radius:6px; font-size:0.75rem; font-weight:700;">✨ #devfest-qa Active</span>
        </div>
        <a href="${url}" target="_blank" rel="noopener noreferrer" class="hud-btn primary" style="display:inline-flex; padding:12px 28px; font-size:0.9rem; font-weight:700; text-decoration:none; background:#5865F2; border-color:#818CF8;">
          🚀 Join Discord Community
        </a>
      </div>
    `;
  } else if (url.includes('facebook.com')) {
    body.innerHTML = `
      <div style="background:linear-gradient(135deg, #1877F222, #0F172A); border:1.5px solid #1877F288; border-radius:14px; padding:24px; text-align:center;">
        <div style="font-size:3rem; margin-bottom:10px;">📘</div>
        <h3 style="color:#FFF; font-size:1.3rem; margin-bottom:6px;">GDG Cloud Bangkok on Facebook</h3>
        <p style="color:#94A3B8; font-size:0.85rem; max-width:480px; margin:0 auto 18px;">Stay up to date with official GDG meetup announcements, photo albums, DevFest updates, and local community discussions.</p>
        <a href="${url}" target="_blank" rel="noopener noreferrer" class="hud-btn primary" style="display:inline-flex; padding:12px 28px; font-size:0.9rem; font-weight:700; text-decoration:none; background:#1877F2; border-color:#60A5FA;">
          👍 Follow & Join on Facebook
        </a>
      </div>
    `;
  } else if (url.includes('instagram.com')) {
    body.innerHTML = `
      <div style="background:linear-gradient(135deg, #E1306C22, #0F172A); border:1.5px solid #E1306C88; border-radius:14px; padding:24px; text-align:center;">
        <div style="font-size:3rem; margin-bottom:10px;">📷</div>
        <h3 style="color:#FFF; font-size:1.3rem; margin-bottom:6px;">@gdgcloudbkk on Instagram</h3>
        <p style="color:#94A3B8; font-size:0.85rem; max-width:480px; margin:0 auto 18px;">Check out live behind-the-scenes event stories, speaker spotlights, and swag giveaways from DevFest Bangkok.</p>
        <a href="${url}" target="_blank" rel="noopener noreferrer" class="hud-btn" style="display:inline-flex; padding:12px 28px; font-size:0.9rem; font-weight:700; text-decoration:none; background:#E1306C; border-color:#F472B6; color:#FFF;">
          📸 Follow on Instagram
        </a>
      </div>
    `;
  } else if (url.includes('cloud.google.com')) {
    body.innerHTML = `
      <div style="background:linear-gradient(135deg, #4285F422, #0F172A); border:1.5px solid #4285F488; border-radius:14px; padding:24px; text-align:center;">
        <div style="font-size:3rem; margin-bottom:10px;">🏢</div>
        <h3 style="color:#FFF; font-size:1.3rem; margin-bottom:6px;">Google Cloud Expo & Vertex AI Booth</h3>
        <p style="color:#94A3B8; font-size:0.85rem; max-width:480px; margin:0 auto 18px;">Explore Google Cloud Run serverless containers, Vertex AI generative agents, BigQuery analytics, and cloud developer documentation.</p>
        <div style="display:flex; justify-content:center; gap:10px; margin-bottom:20px; flex-wrap:wrap;">
          <span style="background:#4285F422; color:#60A5FA; border:1px solid #4285F466; padding:4px 10px; border-radius:6px; font-size:0.75rem;">⚡ Cloud Run</span>
          <span style="background:#34A85322; color:#4ADE80; border:1px solid #34A85366; padding:4px 10px; border-radius:6px; font-size:0.75rem;">🤖 Vertex AI</span>
          <span style="background:#FBBC0422; color:#FDE047; border:1px solid:#FBBC0466; padding:4px 10px; border-radius:6px; font-size:0.75rem;">🔥 Cloud Firestore</span>
        </div>
        <a href="${url}" target="_blank" rel="noopener noreferrer" class="hud-btn primary" style="display:inline-flex; padding:12px 28px; font-size:0.9rem; font-weight:700; text-decoration:none;">
          🚀 Open Google Cloud Platform
        </a>
      </div>
    `;
  } else {
    body.innerHTML = `
      <div style="padding:20px; text-align:center;">
        <p style="color:#94A3B8; margin-bottom:16px;">External link: <a href="${url}" target="_blank" style="color:#38BDF8;">${url}</a></p>
        <a href="${url}" target="_blank" rel="noopener noreferrer" class="hud-btn primary" style="display:inline-flex; text-decoration:none;">
          🔗 Visit Website in New Tab
        </a>
      </div>
    `;
  }

  openModal('billboard-iframe-modal');
}

function showToast(message, icon = 'ℹ️') {
  if (!message || message === 'undefined') return;
  const container = document.getElementById('toast-container');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.innerHTML = `<span>${icon}</span> <span>${message}</span>`;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(50px)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

// --- CLIENT-SIDE FIRESTORE CACHE MANAGER ---
let currentActiveEventId = 'devfest-bangkok-2026';

const ClientCacheManager = {
  memoryCache: new Map(),

  get(key) {
    try {
      const raw = sessionStorage.getItem(`dfv_cache_${key}`);
      if (raw) {
        const item = JSON.parse(raw);
        if (Date.now() - item.timestamp < item.ttl) {
          return item.data;
        }
        sessionStorage.removeItem(`dfv_cache_${key}`);
      }
    } catch (e) {}

    if (this.memoryCache.has(key)) {
      const item = this.memoryCache.get(key);
      if (Date.now() - item.timestamp < item.ttl) {
        return item.data;
      }
      this.memoryCache.delete(key);
    }
    return null;
  },

  set(key, data, ttlSeconds = 300) {
    const item = { timestamp: Date.now(), ttl: ttlSeconds * 1000, data };
    try {
      sessionStorage.setItem(`dfv_cache_${key}`, JSON.stringify(item));
    } catch (e) {}
    this.memoryCache.set(key, item);
  },

  invalidate(pattern) {
    try {
      const keysToRemove = [];
      for (let i = 0; i < sessionStorage.length; i++) {
        const k = sessionStorage.key(i);
        if (k && k.startsWith('dfv_cache_') && (!pattern || k.includes(pattern))) {
          keysToRemove.push(k);
        }
      }
      keysToRemove.forEach(k => sessionStorage.removeItem(k));
    } catch (e) {}

    for (const k of this.memoryCache.keys()) {
      if (!pattern || k.includes(pattern)) {
        this.memoryCache.delete(k);
      }
    }
  },

  clear() {
    this.invalidate();
  }
};

// --- API INTEGRATION HELPERS WITH CACHING & EVENT CONTEXT ---
async function fetchAPI(endpoint, options = {}, bypassCache = false) {
  options.headers = options.headers || {};
  options.headers['x-user-id'] = currentUser.id;
  options.headers['x-event-id'] = currentActiveEventId;
  options.headers['Content-Type'] = 'application/json';

  const method = (options.method || 'GET').toUpperCase();
  const cacheKey = `${currentUser.id}_${currentActiveEventId}_${endpoint}`;

  // Read from Client-side Cache for GET requests unless explicitly bypassed
  if (method === 'GET' && !bypassCache) {
    const cached = ClientCacheManager.get(cacheKey);
    if (cached !== null) {
      return cached;
    }
  }

  const res = await fetch(`${API_BASE}${endpoint}`, options);
  const data = await res.json();

  if (method === 'GET') {
    // Cache GET response (Default TTL 5 minutes)
    ClientCacheManager.set(cacheKey, data, 300);
  } else {
    // Invalidate client cache on any mutating request
    ClientCacheManager.invalidate();
  }

  return data;
}


async function verifyTicket() {
  const ref = document.getElementById('ticket-ref-input').value.trim();
  if (!ref) {
    showToast('Please enter a valid ticket reference!', '⚠️');
    return;
  }
  try {
    const data = await fetchAPI('/tickets/verify', { method: 'POST', body: JSON.stringify({ ticket_ref: ref }) });
    if (data.user) {
      currentUser = data.user;
      updateUserUI();
      showToast('🎉 Official DevFest Ticket verified successfully! Lucky Draw unlocked.', '🎫');
      closeModal('ticket-modal');
    } else {
      showToast(data.detail || data.message || 'Ticket verification failed', '⚠️');
    }
  } catch (err) {
    showToast('Error connecting to ticket verification server.', '⚠️');
  }
}

// --- AGENDA & MULTI-TRACK SYSTEM ---
let currentAgendaTrack = 'ALL';
let agendaSearchQuery = '';
let userFavoriteSessionIds = new Set();
let cachedSessions = [];

async function loadAgenda(trackFilter = null) {
  if (trackFilter !== null) {
    currentAgendaTrack = trackFilter;
  }
  try {
    const [sessionsData, tracksData, favsData] = await Promise.all([
      fetchAPI('/sessions'),
      fetchAPI('/sessions/tracks'),
      fetchAPI('/sessions/favorites')
    ]);

    cachedSessions = Array.isArray(sessionsData) ? sessionsData : [];
    const tracks = tracksData.tracks || ['Main Keynote', 'Track 1: AI & Agents', 'Track 2: Cloud & DevOps', 'Track 3: Web & Frontend'];
    const favIds = (favsData.favorite_session_ids || []).map(String);
    userFavoriteSessionIds = new Set(favIds);

    renderAgendaTrackTabs(tracks);

    let filtered = cachedSessions;
    if (currentAgendaTrack === 'MY_AGENDA') {
      filtered = filtered.filter(s => userFavoriteSessionIds.has(s.id));
    } else if (currentAgendaTrack !== 'ALL') {
      filtered = filtered.filter(s => s.track === currentAgendaTrack);
    }

    if (agendaSearchQuery.trim()) {
      const q = agendaSearchQuery.toLowerCase();
      filtered = filtered.filter(s => 
        (s.title && s.title.toLowerCase().includes(q)) ||
        (s.speaker_name && s.speaker_name.toLowerCase().includes(q)) ||
        (s.description && s.description.toLowerCase().includes(q)) ||
        (s.track && s.track.toLowerCase().includes(q))
      );
    }

    const container = document.getElementById('agenda-list');
    if (!container) return;

    if (filtered.length === 0) {
      if (currentAgendaTrack === 'MY_AGENDA') {
        container.innerHTML = `
          <div style="text-align:center; padding:36px 20px; color:#94A3B8;">
            <span style="font-size:2.5rem; display:block; margin-bottom:10px;">❤️</span>
            <h4 style="color:#FFF; margin-bottom:6px;">No Favorite Sessions in Your Agenda Yet</h4>
            <p style="font-size:0.85rem; max-width:420px; margin:0 auto 16px;">Browse the conference tracks and click the heart icon on any session to create your personalized DevFest schedule!</p>
            <button class="hud-btn primary" style="margin:0 auto;" onclick="loadAgenda('ALL')">Explore All Tracks</button>
          </div>
        `;
      } else {
        container.innerHTML = `
          <div style="text-align:center; padding:30px 20px; color:#94A3B8;">
            <p>No sessions found matching your criteria.</p>
          </div>
        `;
      }
      return;
    }

    container.innerHTML = filtered.map(s => {
      const isFav = userFavoriteSessionIds.has(s.id);
      const trackColor = getTrackColor(s.track);
      return `
        <div class="card-item" style="${isFav ? 'border-color: rgba(239, 68, 68, 0.4); background: linear-gradient(135deg, rgba(30, 41, 59, 0.6), rgba(15, 23, 42, 0.6));' : ''}">
          <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:12px; margin-bottom:8px;">
            <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
              <span class="badge" style="background: ${trackColor}; font-size:0.75rem;">${s.track || 'General Track'}</span>
              <span style="color:#94A3B8; font-size:0.82rem;">⏰ <strong>${s.start_time} - ${s.end_time}</strong></span>
              <span style="color:#64748B; font-size:0.82rem;">| 📍 ${s.room}</span>
            </div>
            <button class="hud-btn" style="padding:4px 10px; border-color:${isFav ? '#EF4444' : 'var(--card-border)'}; background:${isFav ? 'rgba(239, 68, 68, 0.15)' : 'transparent'}; font-size:0.82rem;" onclick="toggleFavoriteSession('${s.id}')" title="${isFav ? 'Remove from My Agenda' : 'Add to My Agenda'}">
              ${isFav ? '❤️ <span style="color:#F87171; font-weight:700;">FAVORITED</span>' : '🤍 <span style="color:#94A3B8;">FAVORITE</span>'}
            </button>
          </div>
          <h4 style="color:#60A5FA; margin-bottom:6px; font-size:1.05rem;">${s.title}</h4>
          <p style="color:#94A3B8; font-size:0.82rem; margin-bottom:8px;">🎤 Speaker: <strong style="color:#E2E8F0;">${s.speaker_name}</strong></p>
          <p style="font-size:0.88rem; line-height:1.45; color:#CBD5E1; margin-bottom:12px;">${s.description}</p>
          <div style="display:flex; gap:10px;">
            <button class="hud-btn primary" onclick="loadTranscripts('${s.id}')">📜 View Gemini Live Transcripts</button>
          </div>
        </div>
      `;
    }).join('');

  } catch (err) {
    console.error('Error loading agenda:', err);
  }
}

function renderAgendaTrackTabs(tracks) {
  const tabsContainer = document.getElementById('agenda-track-tabs');
  if (!tabsContainer) return;
  const favCount = userFavoriteSessionIds.size;

  let html = `
    <button class="option-chip ${currentAgendaTrack === 'ALL' ? 'selected' : ''}" onclick="loadAgenda('ALL')">🌐 All Tracks</button>
    <button class="option-chip ${currentAgendaTrack === 'MY_AGENDA' ? 'selected' : ''}" onclick="loadAgenda('MY_AGENDA')" style="${favCount > 0 ? 'border-color:#EF4444; color:#F87171;' : ''}">⭐ My Agenda (${favCount})</button>
  `;

  tracks.forEach(t => {
    html += `<button class="option-chip ${currentAgendaTrack === t ? 'selected' : ''}" onclick="loadAgenda('${t}')">${t}</button>`;
  });

  tabsContainer.innerHTML = html;
}

function getTrackColor(trackName) {
  if (!trackName) return '#3B82F6';
  if (trackName.includes('AI') || trackName.includes('Agent')) return '#8B5CF6';
  if (trackName.includes('Cloud') || trackName.includes('DevOps')) return '#2563EB';
  if (trackName.includes('Web') || trackName.includes('Frontend')) return '#F59E0B';
  if (trackName.includes('Keynote')) return '#EC4899';
  return '#10B981';
}

function onAgendaSearch(val) {
  agendaSearchQuery = val;
  loadAgenda();
}

async function toggleFavoriteSession(sessionId) {
  try {
    const data = await fetchAPI(`/sessions/${sessionId}/favorite`, { method: 'POST' });
    const msg = data.message || (data.is_favorite ? 'Added to My Agenda! ❤️' : 'Removed from My Agenda');
    showToast(msg, data.is_favorite ? '❤️' : '🤍');
    loadAgenda();
  } catch (err) {
    showToast('Error updating favorite session.', '⚠️');
  }
}

async function loadTranscripts(sessionId) {
  const data = await fetchAPI(`/transcribe/session/${sessionId}`);
  if (!data.transcripts || data.transcripts.length === 0) {
    showToast('No live transcripts recorded for this session yet.', '📜');
    return;
  }
  const text = data.transcripts.map(t => `[${t.speaker_name}] ${t.original_text}\n(TH: ${t.translated_text})`).join('\n\n');
  alert(`📜 Live Transcripts for Session:\n\n${text}`);
}

async function loadWorkshops() {
  try {
    const workshops = await fetchAPI('/workshops');
    const container = document.getElementById('workshops-list');
    if (Array.isArray(workshops)) {
      container.innerHTML = workshops.map(w => {
        const isRegistered = w.attendees && w.attendees.includes(currentUser.id);
        const isFull = w.reserved_count >= w.capacity;

        let actionButtonHtml = '';
        if (isRegistered) {
          actionButtonHtml = `
            <div style="display:flex; align-items:center; gap:10px; margin-top:12px;">
              <span class="badge verified" style="font-size:0.8rem; padding:6px 10px;">✅ Registered</span>
              <button class="hud-btn" style="border-color:#EF4444; color:#F87171; background:rgba(239, 68, 68, 0.12);" onclick="cancelSeat('${w.id}')">❌ Cancel Reservation</button>
            </div>
          `;
        } else if (isFull) {
          actionButtonHtml = `
            <button class="hud-btn" style="margin-top:12px; opacity:0.55; cursor:not-allowed;" disabled>⛔ Workshop Full (30/30)</button>
          `;
        } else {
          actionButtonHtml = `
            <button class="hud-btn primary" style="margin-top:12px;" onclick="reserveSeat('${w.id}')">Reserve Workshop Seat</button>
          `;
        }

        return `
          <div class="card-item" style="${isRegistered ? 'border-color:#10B981;' : ''}">
            <div style="display:flex; justify-content:space-between; align-items:flex-start;">
              <h4 style="color:#A78BFA; margin-bottom:4px;">${w.title}</h4>
              ${isRegistered ? '<span class="badge verified">YOUR SEAT RESERVED</span>' : ''}
            </div>
            <p style="color:#94A3B8; font-size:0.82rem; margin-bottom:8px;">👨‍🏫 Instructor: <strong>${w.instructor}</strong> | 📍 Room ${w.room_code}</p>
            <p style="margin-top:6px; font-size:0.88rem;">Seats Reserved: <strong style="color:${isFull ? '#EF4444' : '#10B981'};">${w.reserved_count} / ${w.capacity}</strong></p>
            ${actionButtonHtml}
          </div>
        `;
      }).join('');
    }
  } catch (err) {
    console.error(err);
  }
}

async function reserveSeat(wsId) {
  try {
    const data = await fetchAPI('/workshops/reserve', { method: 'POST', body: JSON.stringify({ workshop_id: wsId }) });
    const text = data.message || data.detail || 'Reservation processed';
    const pass = data.pass_code ? ` (Pass: ${data.pass_code})` : '';
    showToast(`${text}${pass}`, data.detail ? '⚠️' : '🎟️');
    loadWorkshops();
  } catch (err) {
    showToast('Error reserving workshop seat.', '⚠️');
  }
}

async function cancelSeat(wsId) {
  try {
    const data = await fetchAPI('/workshops/cancel', { method: 'POST', body: JSON.stringify({ workshop_id: wsId }) });
    const text = data.message || data.detail || 'Seat reservation cancelled';
    showToast(text, data.detail ? '⚠️' : 'ℹ️');
    loadWorkshops();
  } catch (err) {
    showToast('Error cancelling workshop reservation.', '⚠️');
  }
}

async function loadQnA() {
  try {
    const questions = await fetchAPI('/qna');
    const container = document.getElementById('qna-list');
    if (Array.isArray(questions)) {
      container.innerHTML = questions.map(q => `
        <div class="card-item">
          <p style="font-size:0.9rem; margin-bottom:4px;"><strong>${q.author}:</strong> ${q.question}</p>
          <span style="font-size:0.78rem; color:#38BDF8;">👍 ${q.upvotes} upvotes</span>
        </div>
      `).join('');
    }
  } catch (err) {
    console.error(err);
  }
}

async function submitQuestion() {
  const text = document.getElementById('qna-input').value.trim();
  if (!text) return;
  await fetchAPI('/qna', { method: 'POST', body: JSON.stringify({ question: text }) });
  document.getElementById('qna-input').value = '';
  showToast('Question submitted to speaker stage!', '💬');
  loadQnA();
}

async function loadBGM() {
  try {
    const tracks = await fetchAPI('/bgm');
    const container = document.getElementById('bgm-list');
    if (Array.isArray(tracks)) {
      container.innerHTML = tracks.map(t => `
        <div class="card-item">
          <h4>${t.title}</h4>
          <p style="font-size:0.82rem; color:#94A3B8; margin: 4px 0 8px;">Zone: ${t.zone} | Format: ${t.type}</p>
          <a href="${t.url}" target="_blank" class="hud-btn primary" style="display:inline-flex;">▶️ Play Track</a>
        </div>
      `).join('');
    }
  } catch (err) {
    console.error(err);
  }
}

// Back Office Controls & Firestore User Management
let ALL_BACKOFFICE_USERS = [];
let backofficeSelectedEvent = 'devfest-bangkok-2026';

function onAdminEventSelectChange(eventId) {
  backofficeSelectedEvent = eventId;
  loadBackofficeUsers(true);
}

function showAdminTab(tabId) {
  document.querySelectorAll('.admin-tab').forEach(t => t.style.display = 'none');
  const target = document.getElementById(tabId);
  if (target) target.style.display = 'block';
  if (tabId === 'users-admin-tab') {
    loadBackofficeUsers();
  } else if (tabId === 'agenda-admin-tab') {
    loadAdminSessions();
  } else if (tabId === 'firestore-admin-tab') {
    loadFirestoreEventData();
  } else if (tabId === 'feedback-admin-tab') {
    loadAdminFeedback();
  }
}

async function loadBackofficeUsers(bypassCache = false) {
  try {
    if (bypassCache) {
      ClientCacheManager.invalidate('/backoffice/users');
    }

    const eventQuery = backofficeSelectedEvent ? `event_id=${encodeURIComponent(backofficeSelectedEvent)}&` : '';
    const [usersRes, statsRes] = await Promise.all([
      fetchAPI(`/backoffice/users?${eventQuery}limit=200`, {}, bypassCache),
      fetchAPI(`/backoffice/users/stats?${eventQuery}`, {}, bypassCache)
    ]);

    if (statsRes) {
      const kpiTotal = document.getElementById('users-kpi-total');
      const kpiStaff = document.getElementById('users-kpi-staff');
      const kpiSpeakers = document.getElementById('users-kpi-speakers');
      const kpiPartic = document.getElementById('users-kpi-participants');
      const kpiVerified = document.getElementById('users-kpi-verified');
      const kpiGoogle = document.getElementById('users-kpi-google');

      if (kpiTotal) kpiTotal.textContent = statsRes.total_users || 0;
      if (kpiStaff) kpiStaff.textContent = (statsRes.by_role?.ORGANIZER || 0) + (statsRes.by_role?.STAFF || 0);
      if (kpiSpeakers) kpiSpeakers.textContent = (statsRes.by_role?.SPEAKER || 0) + (statsRes.by_role?.SPONSOR || 0);
      if (kpiPartic) kpiPartic.textContent = statsRes.by_role?.PARTICIPANT || 0;
      if (kpiVerified) kpiVerified.textContent = statsRes.verified_tickets_count || 0;
      if (kpiGoogle) kpiGoogle.textContent = statsRes.google_authenticated_count || 0;
      const projEl = document.getElementById('admin-gcp-project-name');
      if (projEl && statsRes.project_id) {
        projEl.textContent = statsRes.project_id;
      }
    }

    if (usersRes && usersRes.users) {
      ALL_BACKOFFICE_USERS = usersRes.users;
      renderBackofficeUsersList(ALL_BACKOFFICE_USERS);
    }
  } catch (err) {
    console.error('Error loading Firestore users:', err);
    const listEl = document.getElementById('backoffice-users-list');
    if (listEl) listEl.innerHTML = '<div style="color:#EF4444; font-size:0.85rem; padding:12px;">Failed to load users from Firestore.</div>';
  }
}

function filterBackofficeUsers() {
  const searchInput = document.getElementById('admin-users-search');
  const roleFilter = document.getElementById('admin-users-role-filter');
  const search = (searchInput ? searchInput.value : '').toLowerCase().trim();
  const role = roleFilter ? roleFilter.value : '';

  let filtered = ALL_BACKOFFICE_USERS;
  if (role) {
    filtered = filtered.filter(u => (u.effective_role || u.role) === role);
  }
  if (search) {
    filtered = filtered.filter(u => 
      (u.display_name && u.display_name.toLowerCase().includes(search)) ||
      (u.email && u.email.toLowerCase().includes(search)) ||
      (u.id && u.id.toLowerCase().includes(search)) ||
      ((u.event_ticket_ref || u.ticket_ref) && (u.event_ticket_ref || u.ticket_ref).toLowerCase().includes(search))
    );
  }
  renderBackofficeUsersList(filtered);
}

function renderBackofficeUsersList(users) {
  const listEl = document.getElementById('backoffice-users-list');
  if (!listEl) return;

  if (!users || users.length === 0) {
    listEl.innerHTML = '<div style="color:var(--text-muted); font-size:0.85rem; padding:16px; text-align:center;">No matching attendees found in Firestore for this event context.</div>';
    return;
  }

  const roleColors = {
    ORGANIZER: '#EC4899',
    STAFF: '#F59E0B',
    SPEAKER: '#A78BFA',
    SPONSOR: '#34D399',
    PARTICIPANT: '#38BDF8'
  };

  const eventNameMap = {
    'devfest-bangkok-2026': 'DevFest 2026',
    'gdg-ai-hackathon-2026': 'AI Hackathon',
    'cloud-community-day-2026': 'Cloud Day'
  };

  listEl.innerHTML = users.map(u => {
    const currentRole = u.effective_role || u.role || 'PARTICIPANT';
    const roleColor = roleColors[currentRole] || '#38BDF8';
    const isGoogle = u.auth_provider === 'google' || (u.email && u.email.includes('gmail.com'));
    const ticketRef = u.event_ticket_ref || u.ticket_ref;
    const isTicketVerified = u.event_verified_ticket !== undefined ? u.event_verified_ticket : (u.verified_ticket === true);

    // Multi-event membership pills
    const eventsMap = u.events || {};
    const eventPills = Object.entries(eventsMap).map(([evId, mem]) => {
      const shortName = eventNameMap[evId] || evId;
      const memRole = mem.role || 'PARTICIPANT';
      const pColor = roleColors[memRole] || '#94A3B8';
      return `<span style="background:rgba(30,41,59,0.8); border:1px solid ${pColor}; color:${pColor}; font-size:0.65rem; border-radius:4px; padding:1px 5px; font-weight:600;">${shortName}: ${memRole}</span>`;
    }).join(' ');

    return `
      <div style="background:#0F172A; border:1px solid var(--card-border); border-radius:8px; padding:12px; display:flex; justify-content:space-between; align-items:center; gap:12px; flex-wrap:wrap;">
        <div style="display:flex; align-items:center; gap:10px; min-width:240px; flex:2;">
          <div style="width:38px; height:38px; border-radius:50%; background:#1E293B; border:1.5px solid ${roleColor}; display:flex; align-items:center; justify-content:center; overflow:hidden; font-weight:700; font-size:0.9rem; color:#FFF; flex-shrink:0;">
            ${u.avatar_url ? `<img src="${u.avatar_url}" style="width:100%; height:100%; object-fit:cover;" onerror="this.style.display='none'">` : (u.display_name ? u.display_name.charAt(0).toUpperCase() : 'U')}
          </div>
          <div>
            <div style="display:flex; align-items:center; gap:6px; flex-wrap:wrap;">
              <span style="font-weight:700; color:#FFF; font-size:0.88rem;">${u.display_name || 'Anonymous User'}</span>
              ${isGoogle ? '<span class="badge" style="background:rgba(66,133,244,0.2); color:#60A5FA; border:1px solid #3B82F6; font-size:0.62rem; padding:1px 5px;">🔵 Google</span>' : '<span class="badge" style="background:#1E293B; color:#94A3B8; font-size:0.62rem; padding:1px 5px;">Local</span>'}
              ${u.global_role === 'ORGANIZER' ? '<span class="badge" style="background:rgba(236,72,153,0.2); color:#EC4899; border:1px solid #EC4899; font-size:0.62rem; padding:1px 5px;">👑 System Org</span>' : ''}
            </div>
            <div style="font-size:0.75rem; color:var(--text-muted); font-family:'Space Mono', monospace; margin:2px 0;">${u.email} • ID: ${u.id}</div>
            ${eventPills ? `<div style="display:flex; gap:4px; flex-wrap:wrap; margin-top:3px;">${eventPills}</div>` : ''}
          </div>
        </div>

        <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap; flex:1; justify-content:flex-end;">
          <!-- Ticket Badge / Link -->
          <div style="font-size:0.75rem;">
            ${isTicketVerified && ticketRef
              ? `<span style="background:rgba(16,185,129,0.15); color:#10B981; border:1px solid #10B981; border-radius:4px; padding:3px 8px; font-weight:600;">🎟️ ${ticketRef}</span>`
              : `<button class="hud-btn" style="padding:4px 8px; font-size:0.72rem;" onclick="assignUserTicketFromBackoffice('${u.id}')">+ Link Ticket</button>`
            }
          </div>

          <!-- Role Selector Dropdown -->
          <select onchange="updateUserRoleFromBackoffice('${u.id}', this.value)" style="padding:4px 8px; border-radius:6px; background:#1E293B; border:1.5px solid ${roleColor}; color:#FFF; font-size:0.78rem; font-weight:600;">
            <option value="PARTICIPANT" ${currentRole === 'PARTICIPANT' ? 'selected' : ''}>Participant</option>
            <option value="SPEAKER" ${currentRole === 'SPEAKER' ? 'selected' : ''}>Speaker</option>
            <option value="SPONSOR" ${currentRole === 'SPONSOR' ? 'selected' : ''}>Sponsor</option>
            <option value="STAFF" ${currentRole === 'STAFF' ? 'selected' : ''}>Staff</option>
            <option value="ORGANIZER" ${currentRole === 'ORGANIZER' ? 'selected' : ''}>Organizer</option>
          </select>

          <!-- Delete User Button -->
          <button class="hud-btn danger" style="padding:4px 8px; font-size:0.75rem;" onclick="deleteUserFromBackoffice('${u.id}', '${u.display_name}')" title="Delete User">🗑️</button>
        </div>
      </div>
    `;
  }).join('');
}

async function updateUserRoleFromBackoffice(userId, newRole) {
  try {
    const eventQuery = backofficeSelectedEvent ? `?event_id=${encodeURIComponent(backofficeSelectedEvent)}` : '';
    const res = await fetchAPI(`/backoffice/users/${userId}/role${eventQuery}`, {
      method: 'POST',
      body: JSON.stringify({ new_role: newRole })
    });
    if (res.user) {
      showToast(`User role updated to ${newRole} on Firestore!`, '✅');
      if (currentUser && currentUser.id === userId) {
        currentUser.role = newRole;
        updateUserUI();
      }
      loadBackofficeUsers(true);
    }
  } catch (err) {
    showToast('Failed to update user role.', '⚠️');
  }
}

async function assignUserTicketFromBackoffice(userId) {
  const ticketRef = prompt('Enter DevFest Ticket Reference (e.g. TICKET-DEV-888):');
  if (!ticketRef || !ticketRef.trim()) return;

  try {
    const eventQuery = backofficeSelectedEvent ? `?event_id=${encodeURIComponent(backofficeSelectedEvent)}` : '';
    const res = await fetchAPI(`/backoffice/users/${userId}/ticket${eventQuery}`, {
      method: 'POST',
      body: JSON.stringify({ ticket_ref: ticketRef.trim(), verified: true })
    });
    if (res.user) {
      showToast(`Ticket '${ticketRef.trim()}' assigned and verified on Firestore!`, '🎟️');
      loadBackofficeUsers(true);
    }
  } catch (err) {
    showToast('Failed to assign ticket.', '⚠️');
  }
}


async function deleteUserFromBackoffice(userId, userName) {
  if (!confirm(`Are you sure you want to delete user '${userName}' (${userId}) from Firestore?`)) return;

  try {
    await fetchAPI(`/backoffice/users/${userId}`, { method: 'DELETE' });
    showToast(`User '${userName}' removed from Firestore.`, '🗑️');
    loadBackofficeUsers();
  } catch (err) {
    showToast('Failed to delete user.', '⚠️');
  }
}

async function loadFirestoreEventData() {
  try {
    const event = await fetchAPI('/firestore/events/devfest-bangkok-2026');
    const detailsContainer = document.getElementById('firestore-event-details');
    const statsContainer = document.getElementById('firestore-attendance-stats');
    const listContainer = document.getElementById('firestore-participants-list');

    if (detailsContainer && event) {
      detailsContainer.innerHTML = `
        <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(200px, 1fr)); gap:8px;">
          <div><strong>📅 Date:</strong> ${event.date}</div>
          <div><strong>🏛️ Venue:</strong> ${event.venue?.name || 'N/A'}</div>
          <div><strong>📍 Address:</strong> ${event.venue?.address || 'N/A'}</div>
          <div><strong>🏷️ Theme:</strong> ${event.metadata?.theme || 'N/A'}</div>
          <div><strong>👥 Expected Capacity:</strong> ${event.metadata?.expected_capacity || 'N/A'}</div>
          <div><strong>🎤 Speakers:</strong> ${event.speakers?.length || 0} Listed</div>
          <div><strong>📚 Sessions:</strong> ${event.sessions?.length || 0} Registered</div>
          <div><strong>🏢 Sponsors:</strong> ${event.sponsors?.length || 0} Configured</div>
        </div>
      `;
    }

    if (statsContainer && event.attendance_summary) {
      const s = event.attendance_summary;
      const rateColor = s.show_up_rate_percent >= 50 ? '#10B981' : '#F59E0B';
      statsContainer.innerHTML = `
        <div style="background:#0F172A; border:1px solid var(--card-border); padding:10px; border-radius:8px; text-align:center;">
          <div style="font-size:0.75rem; color:#94A3B8;">Total Registered</div>
          <div style="font-size:1.3rem; font-weight:800; color:#38BDF8;">${s.total_registered}</div>
        </div>
        <div style="background:#0F172A; border:1px solid var(--card-border); padding:10px; border-radius:8px; text-align:center;">
          <div style="font-size:0.75rem; color:#94A3B8;">Showed Up / Attended</div>
          <div style="font-size:1.3rem; font-weight:800; color:#10B981;">${s.total_attended}</div>
        </div>
        <div style="background:#0F172A; border:1px solid var(--card-border); padding:10px; border-radius:8px; text-align:center;">
          <div style="font-size:0.75rem; color:#94A3B8;">Absent / Pending</div>
          <div style="font-size:1.3rem; font-weight:800; color:#F87171;">${s.absent_count}</div>
        </div>
        <div style="background:#0F172A; border:1px solid var(--card-border); padding:10px; border-radius:8px; text-align:center;">
          <div style="font-size:0.75rem; color:#94A3B8;">Show-Up Rate</div>
          <div style="font-size:1.3rem; font-weight:800; color:${rateColor};">${s.show_up_rate_percent}%</div>
        </div>
      `;
    }

    if (listContainer && event.participants) {
      const pList = Object.values(event.participants);
      listContainer.innerHTML = pList.map(p => `
        <div style="display:flex; justify-content:space-between; align-items:center; padding:8px 12px; background:#090E1A; border:1px solid var(--card-border); border-radius:6px; margin-bottom:6px; font-size:0.82rem;">
          <div>
            <strong>${p.name}</strong> <span style="color:#64748B;">(${p.ticket_ref})</span>
            <div style="font-size:0.72rem; color:#94A3B8;">${p.email} | Scanned by: ${p.scanned_by || 'N/A'}</div>
          </div>
          <div>
            ${p.attended ? `<span class="badge verified" style="font-size:0.7rem;">✔ ATTENDED</span>` : `<span class="badge" style="font-size:0.7rem; background:#334155;">⏳ NOT ARRIVED</span>`}
          </div>
        </div>
      `).join('');
    }
  } catch (err) {
    console.error('Error loading Firestore event data:', err);
  }
}

async function submitParticipantCheckin() {
  const inputEl = document.getElementById('checkin-ticket-input');
  const notesEl = document.getElementById('checkin-notes-input');
  const val = inputEl ? inputEl.value.trim() : '';
  const notes = notesEl ? notesEl.value.trim() : '';

  if (!val) {
    showToast('Please enter a ticket ref or user ID to check in.', '⚠️');
    return;
  }

  try {
    const data = await fetchAPI('/firestore/events/devfest-bangkok-2026/checkin', {
      method: 'POST',
      body: JSON.stringify({ ticket_ref_or_user_id: val, notes: notes })
    });

    if (data.participant) {
      showToast(`✅ Check-in recorded for ${data.participant.name}!`, '🎉');
      if (inputEl) inputEl.value = '';
      if (notesEl) notesEl.value = '';
      loadFirestoreEventData();
    } else {
      showToast(data.detail || 'Check-in failed.', '⚠️');
    }
  } catch (err) {
    showToast('Error recording participant check-in.', '⚠️');
  }
}

async function loadAdminSessions() {
  try {
    const sessions = await fetchAPI('/sessions');
    const container = document.getElementById('admin-sessions-list');
    if (!container || !Array.isArray(sessions)) return;

    cachedSessions = sessions;
    container.innerHTML = sessions.map(s => `
      <div style="display:flex; justify-content:space-between; align-items:center; padding:10px 14px; background:#090E1A; border:1px solid var(--card-border); border-radius:8px; margin-bottom:8px; gap:12px;">
        <div style="flex:1;">
          <div style="display:flex; align-items:center; gap:8px;">
            <span class="badge" style="background:${getTrackColor(s.track)}; font-size:0.7rem;">${s.track}</span>
            <strong style="color:#FFF; font-size:0.9rem;">${s.title}</strong>
          </div>
          <div style="color:#94A3B8; font-size:0.8rem; margin-top:3px;">
            ⏰ ${s.start_time} - ${s.end_time} | 📍 ${s.room} | 🎤 ${s.speaker_name}
          </div>
        </div>
        <div style="display:flex; gap:6px;">
          <button class="hud-btn" style="padding:4px 8px; font-size:0.78rem;" onclick="editAdminSession('${s.id}')">✏️ Edit</button>
          <button class="hud-btn" style="padding:4px 8px; font-size:0.78rem; border-color:#EF4444; color:#F87171;" onclick="deleteAdminSession('${s.id}')">🗑️ Delete</button>
        </div>
      </div>
    `).join('');
  } catch (err) {
    console.error('Error loading admin sessions:', err);
  }
}

// AI Agenda Generation & Autofill
async function autoFillAgendaWithAI() {
  const promptInput = document.getElementById('ai-agenda-prompt');
  const prompt = promptInput ? promptInput.value.trim() : '';
  if (!prompt) {
    showToast('Please type or paste a talk description for AI!', '⚠️');
    return;
  }

  showToast('✨ Gemini AI analyzing session details & generating fields...', '🤖');
  try {
    const data = await fetchAPI('/backoffice/ai-agenda-generate', {
      method: 'POST',
      body: JSON.stringify({ prompt })
    });

    if (data.generated_session) {
      const s = data.generated_session;
      document.getElementById('sess-edit-title').value = s.title || '';
      document.getElementById('sess-edit-speaker').value = s.speaker_name || '';
      document.getElementById('sess-edit-track').value = s.track || 'Track 1: AI & Agents';
      document.getElementById('sess-edit-room').value = s.room || 'Room A1';
      document.getElementById('sess-edit-start').value = s.start_time || '10:00 AM';
      document.getElementById('sess-edit-end').value = s.end_time || '11:00 AM';
      document.getElementById('sess-edit-desc').value = s.description || '';

      // Highlight fields with pulsing animation
      const fieldIds = ['sess-edit-title', 'sess-edit-speaker', 'sess-edit-room', 'sess-edit-start', 'sess-edit-end', 'sess-edit-desc'];
      fieldIds.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
          el.style.borderColor = '#38BDF8';
          el.style.boxShadow = '0 0 10px rgba(56, 189, 248, 0.4)';
          setTimeout(() => {
            el.style.borderColor = 'var(--card-border)';
            el.style.boxShadow = 'none';
          }, 3500);
        }
      });

      showToast('✨ Session details generated & auto-filled by AI! Review and click Save.', '🎉');
    } else {
      showToast(data.detail || 'Failed to generate session details.', '⚠️');
    }
  } catch (err) {
    showToast('Error communicating with AI Agenda generator.', '⚠️');
  }
}

async function saveAdminSession() {
  const editId = document.getElementById('sess-edit-id').value;
  const title = document.getElementById('sess-edit-title').value.trim();
  const track = document.getElementById('sess-edit-track').value;
  const speaker_name = document.getElementById('sess-edit-speaker').value.trim();
  const room = document.getElementById('sess-edit-room').value.trim();
  const start_time = document.getElementById('sess-edit-start').value.trim();
  const end_time = document.getElementById('sess-edit-end').value.trim();
  const description = document.getElementById('sess-edit-desc').value.trim();

  if (!title || !speaker_name || !room || !start_time || !end_time) {
    showToast('Please fill all required session fields!', '⚠️');
    return;
  }

  const payload = {
    title, track, speaker_name, room, start_time, end_time, description,
    speaker_id: 'user-speaker-1'
  };

  try {
    if (editId) {
      const data = await fetchAPI(`/sessions/${editId}`, { method: 'PUT', body: JSON.stringify(payload) });
      showToast(data.message || `Updated session "${title}"!`, '✅');
    } else {
      const data = await fetchAPI('/sessions', { method: 'POST', body: JSON.stringify(payload) });
      showToast(data.message || `Added session "${title}" to schedule!`, '🎉');
    }
    resetAdminSessionForm();
    loadAdminSessions();
    loadAgenda();
  } catch (err) {
    showToast('Error saving session.', '⚠️');
  }
}

function editAdminSession(sessionId) {
  const sess = cachedSessions.find(s => s.id === sessionId);
  if (!sess) return;
  document.getElementById('sess-edit-id').value = sess.id;
  document.getElementById('sess-edit-title').value = sess.title || '';
  document.getElementById('sess-edit-track').value = sess.track || 'Track 1: AI & Agents';
  document.getElementById('sess-edit-speaker').value = sess.speaker_name || '';
  document.getElementById('sess-edit-room').value = sess.room || '';
  document.getElementById('sess-edit-start').value = sess.start_time || '';
  document.getElementById('sess-edit-end').value = sess.end_time || '';
  document.getElementById('sess-edit-desc').value = sess.description || '';
  document.getElementById('admin-session-form-title').innerText = `✏️ Edit Session: ${sess.title}`;
  showToast(`Loaded "${sess.title}" into editor`, '✏️');
}

function resetAdminSessionForm() {
  document.getElementById('sess-edit-id').value = '';
  document.getElementById('sess-edit-title').value = '';
  document.getElementById('sess-edit-speaker').value = '';
  document.getElementById('sess-edit-room').value = '';
  document.getElementById('sess-edit-start').value = '';
  document.getElementById('sess-edit-end').value = '';
  document.getElementById('sess-edit-desc').value = '';
  const aiPrompt = document.getElementById('ai-agenda-prompt');
  if (aiPrompt) aiPrompt.value = '';
  document.getElementById('admin-session-form-title').innerText = 'Add / Edit Agenda Session';
}

// --- GEMINI AI SPONSOR DETAILS PARSER & BOOTH MANAGEMENT ---
let cachedAdminSponsors = [];
let currentEditingSponsorId = 'sponsor-google-cloud';

async function autoFillSponsorWithGemini() {
  const promptInput = document.getElementById('ai-sponsor-prompt');
  const prompt = promptInput ? promptInput.value.trim() : '';
  if (!prompt) {
    showToast('Please paste a company pitch or sponsor description for Gemini AI!', '⚠️');
    return;
  }

  showToast('✨ Gemini AI analyzing sponsor prospectus & company details...', '🤖');
  try {
    const data = await fetchAPI('/sponsors/parse-gemini', {
      method: 'POST',
      body: JSON.stringify({ raw_text: prompt })
    });

    if (data.parsed_sponsor) {
      const sp = data.parsed_sponsor;
      document.getElementById('sponsor-edit-name').value = sp.name || '';
      document.getElementById('sponsor-edit-tier').value = sp.tier || 'Gold Sponsor';
      document.getElementById('sponsor-edit-url').value = sp.iframe_url || 'https://cloud.google.com';
      document.getElementById('sponsor-edit-desc').value = sp.description || '';

      // Glowing highlight animation
      ['sponsor-edit-name', 'sponsor-edit-tier', 'sponsor-edit-url', 'sponsor-edit-desc'].forEach(id => {
        const el = document.getElementById(id);
        if (el) {
          el.style.borderColor = '#F87171';
          el.style.boxShadow = '0 0 10px rgba(248, 113, 113, 0.4)';
          setTimeout(() => {
            el.style.borderColor = 'var(--card-border)';
            el.style.boxShadow = 'none';
          }, 3500);
        }
      });

      showToast(`✨ Sponsor details for "${sp.name}" parsed by Gemini! Review and Save.`, '🎉');
    } else {
      showToast(data.detail || 'Failed to parse sponsor details.', '⚠️');
    }
  } catch (err) {
    showToast('Error communicating with Gemini Sponsor parser.', '⚠️');
  }
}

async function loadAdminSponsors() {
  try {
    const sponsors = await fetchAPI('/sponsors');
    cachedAdminSponsors = sponsors || [];
    const list = document.getElementById('admin-sponsors-list');
    if (!list) return;

    list.innerHTML = cachedAdminSponsors.map(s => `
      <div style="display:flex; justify-content:space-between; align-items:center; padding:10px 14px; background:#090E1A; border:1px solid var(--card-border); border-radius:8px; gap:12px;">
        <div style="flex:1;">
          <div style="display:flex; align-items:center; gap:8px;">
            <span class="badge" style="background:#EA4335; font-size:0.7rem;">${s.tier}</span>
            <strong style="color:#FFF; font-size:0.9rem;">${s.name}</strong>
          </div>
          <div style="color:#94A3B8; font-size:0.78rem; margin-top:3px; word-break:break-all;">
            🌐 ${s.iframe_url}
          </div>
        </div>
        <button class="hud-btn" style="padding:4px 10px; font-size:0.78rem;" onclick="editAdminSponsor('${s.id}')">✏️ Edit Booth</button>
      </div>
    `).join('');

    if (cachedAdminSponsors.length > 0) {
      editAdminSponsor(cachedAdminSponsors[0].id);
    }
  } catch (err) {
    console.error('Error loading admin sponsors:', err);
  }
}

function editAdminSponsor(sponsorId) {
  const sp = cachedAdminSponsors.find(s => s.id === sponsorId);
  if (!sp) return;
  currentEditingSponsorId = sp.id;
  document.getElementById('sponsor-edit-name').value = sp.name || '';
  document.getElementById('sponsor-edit-tier').value = sp.tier || 'Title Sponsor';
  document.getElementById('sponsor-edit-url').value = sp.iframe_url || 'https://cloud.google.com';
  document.getElementById('sponsor-edit-desc').value = sp.description || '';
  document.getElementById('admin-sponsor-form-title').innerText = `✏️ Edit Sponsor Booth: ${sp.name}`;
}

async function saveAdminSponsorBooth() {
  const name = document.getElementById('sponsor-edit-name').value.trim();
  const tier = document.getElementById('sponsor-edit-tier').value;
  const iframe_url = document.getElementById('sponsor-edit-url').value.trim();
  const description = document.getElementById('sponsor-edit-desc').value.trim();

  if (!name || !iframe_url) {
    showToast('Please provide sponsor name and iframe URL.', '⚠️');
    return;
  }

  try {
    await fetchAPI(`/sponsors/${currentEditingSponsorId}`, {
      method: 'PUT',
      body: JSON.stringify({ name, tier, iframe_url, description })
    });
    showToast(`Sponsor booth for "${name}" updated successfully! 🏢`, '🏢');
    loadAdminSponsors();
  } catch (err) {
    showToast('Failed to update sponsor booth.', '⚠️');
  }
}

function clearAdminSessionForm() {
  resetAdminSessionForm();
}

async function deleteAdminSession(sessionId) {
  if (!confirm('Are you sure you want to delete this session from the schedule?')) return;
  try {
    const data = await fetchAPI(`/sessions/${sessionId}`, { method: 'DELETE' });
    showToast(data.message || 'Session deleted from schedule.', '🗑️');
    loadAdminSessions();
    loadAgenda();
  } catch (err) {
    showToast('Error deleting session.', '⚠️');
  }
}

async function generateInviteLink() {
  const role = document.getElementById('invite-role-select').value;
  try {
    const data = await fetchAPI('/invites/generate', { method: 'POST', body: JSON.stringify({ role }) });
    if (data.invite_url) {
      document.getElementById('invite-result').innerHTML = `
        <strong>Generated Invite Link:</strong><br>
        <a href="${data.invite_url}" style="color:#38BDF8;">${data.invite_url}</a>
      `;
      showToast(`Created invitation token for ${role}`, '🔗');
    } else {
      showToast(data.detail || 'Failed to generate invite', '⚠️');
    }
  } catch (err) {
    showToast('Error generating invite link.', '⚠️');
  }
}

async function publishAnnouncement() {
  const channel = document.getElementById('ann-channel').value;
  const text = document.getElementById('ann-text').value.trim();
  if (!text) return;
  try {
    const data = await fetchAPI('/announcements', { method: 'POST', body: JSON.stringify({ channel, message: text }) });
    document.getElementById('ann-text').value = '';
    if (data.announcement) {
      document.getElementById('ticker-content').innerText = data.announcement.message;
      showToast(`Announcement broadcast to ${channel} channel!`, '📢');
    } else {
      showToast(data.detail || 'Failed to publish announcement', '⚠️');
    }
  } catch (err) {
    showToast('Error publishing announcement.', '⚠️');
  }
}

async function triggerLuckyDraw() {
  try {
    const data = await fetchAPI('/lucky-draw/draw', { method: 'POST' });
    if (data.winner) {
      document.getElementById('lucky-draw-result').innerHTML = `
        <div style="background:#10B981; color:#FFF; padding:14px; border-radius:8px; font-weight:bold; line-height:1.5;">
          🎉 WINNER: ${data.winner.winner_name} (${data.winner.winner_email})<br>
          🎁 Prize: ${data.winner.prize}
        </div>
      `;
      showToast(`🏆 Winner selected: ${data.winner.winner_name}`, '🎰');
    } else {
      showToast(data.detail || 'Lucky draw raffle failed.', '⚠️');
    }
  } catch (err) {
    showToast('Error executing lucky draw raffle.', '⚠️');
  }
}

// --- ATTENDEE EVENT FEEDBACK & RATINGS ---
let currentOverallStarRating = 5;
let currentContentRating = 5;
let currentVenueRating = 5;
let currentNpsScore = 10;
let selectedFeedbackEvent = 'devfest-bangkok-2026';

const OVERALL_STAR_LABELS = {
  1: '1/5 • Needs Significant Improvement ⚠️',
  2: '2/5 • Fair / Room for Growth 💡',
  3: '3/5 • Good / Average Event 👍',
  4: '4/5 • Very Good / Great Sessions! 👏',
  5: '5/5 • Outstanding Experience! 🌟'
};

function onFeedbackEventChange(val) {
  selectedFeedbackEvent = val;
}

function setFeedbackOverallRating(val) {
  currentOverallStarRating = val;
  const buttons = document.querySelectorAll('#feedback-stars-container .feedback-star-btn');
  buttons.forEach((btn, idx) => {
    if (idx < val) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });
  const label = document.getElementById('feedback-overall-label');
  if (label) {
    label.innerText = OVERALL_STAR_LABELS[val] || `${val}/5 Stars`;
  }
}

// Backward compatibility alias
const setFeedbackStar = setFeedbackOverallRating;

function setFeedbackContentRating(val, btn) {
  currentContentRating = val;
  const chips = document.querySelectorAll('#content-rating-chips .rating-chip');
  chips.forEach(c => {
    if (c.innerText.trim().startsWith(String(val))) {
      c.classList.add('active');
    } else {
      c.classList.remove('active');
    }
  });
  if (btn) {
    chips.forEach(c => c.classList.remove('active'));
    btn.classList.add('active');
  }
}

function setFeedbackVenueRating(val, btn) {
  currentVenueRating = val;
  const chips = document.querySelectorAll('#venue-rating-chips .rating-chip');
  chips.forEach(c => {
    if (c.innerText.trim().startsWith(String(val))) {
      c.classList.add('active');
    } else {
      c.classList.remove('active');
    }
  });
  if (btn) {
    chips.forEach(c => c.classList.remove('active'));
    btn.classList.add('active');
  }
}

function setFeedbackNps(val, btn) {
  currentNpsScore = val;
  const chips = document.querySelectorAll('#nps-chips-container .nps-chip');
  chips.forEach(c => {
    if (parseInt(c.innerText.trim()) === val) {
      c.classList.add('active');
    } else {
      c.classList.remove('active');
    }
  });
  if (btn) {
    chips.forEach(c => c.classList.remove('active'));
    btn.classList.add('active');
  }

  const badge = document.getElementById('feedback-nps-badge');
  if (badge) {
    if (val <= 6) {
      badge.className = 'badge';
      badge.style.background = 'rgba(239, 68, 68, 0.25)';
      badge.style.borderColor = '#EF4444';
      badge.style.color = '#FCA5A5';
      badge.innerText = `${val} / 10 • Detractor ⚠️`;
    } else if (val <= 8) {
      badge.className = 'badge';
      badge.style.background = 'rgba(245, 158, 11, 0.25)';
      badge.style.borderColor = '#F59E0B';
      badge.style.color = '#FDE047';
      badge.innerText = `${val} / 10 • Passive 😐`;
    } else {
      badge.className = 'badge';
      badge.style.background = 'rgba(16, 185, 129, 0.25)';
      badge.style.borderColor = '#10B981';
      badge.style.color = '#6EE7B7';
      badge.innerText = `${val} / 10 • Promoter 🚀`;
    }
  }
}

async function submitEventFeedback() {
  const comments = document.getElementById('feedback-comments-input')?.value.trim() || '';
  if (!comments) {
    showToast('Please enter your feedback comments or suggestions!', '⚠️');
    return;
  }

  const evSelect = document.getElementById('feedback-event-id');
  const targetEvent = (evSelect ? evSelect.value : selectedFeedbackEvent) || 'devfest-bangkok-2026';

  try {
    const data = await fetchAPI('/feedback', {
      method: 'POST',
      body: JSON.stringify({
        overall_rating: currentOverallStarRating,
        content_rating: currentContentRating,
        venue_rating: currentVenueRating,
        nps_score: currentNpsScore,
        comments: comments,
        event_id: targetEvent
      })
    });

    showToast(data.message || `🎉 Thank you! Your feedback for "${targetEvent}" was saved to Firestore.`, '⭐');
    if (document.getElementById('feedback-comments-input')) {
      document.getElementById('feedback-comments-input').value = '';
    }
    closeModal('feedback-modal');
  } catch (err) {
    showToast('Error submitting feedback.', '⚠️');
  }
}

async function loadAdminFeedback() {
  try {
    const evQuery = backofficeSelectedEvent ? `?event_id=${encodeURIComponent(backofficeSelectedEvent)}` : '';
    const data = await fetchAPI(`/feedback/all${evQuery}`);
    if (document.getElementById('admin-fb-total')) {
      document.getElementById('admin-fb-total').innerText = data.total_responses || 0;
    }
    if (document.getElementById('admin-fb-avg-overall')) {
      document.getElementById('admin-fb-avg-overall').innerText = (data.average_overall || 5.0) + ' ⭐';
    }
    if (document.getElementById('admin-fb-avg-content')) {
      document.getElementById('admin-fb-avg-content').innerText = (data.average_content || 5.0) + ' ⭐';
    }
    if (document.getElementById('admin-fb-nps')) {
      document.getElementById('admin-fb-nps').innerText = (data.nps_score >= 0 ? '+' : '') + (data.nps_score || 0);
    }

    const list = document.getElementById('admin-feedback-list');
    if (!list) return;
    if (!data.feedbacks || data.feedbacks.length === 0) {
      list.innerHTML = '<div style="color:var(--text-muted); font-size:0.85rem; padding:10px;">No attendee feedback recorded for this event yet.</div>';
      return;
    }

    list.innerHTML = data.feedbacks.map(fb => `
      <div style="background:#0F172A; border:1px solid var(--card-border); border-radius:8px; padding:12px;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px; flex-wrap:wrap; gap:6px;">
          <div style="font-weight:700; color:#FFF; font-size:0.85rem;">👤 ${fb.user_name || 'Attendee'} <span style="font-size:0.7rem; color:#94A3B8; font-weight:normal;">(${fb.event_id || 'devfest-bangkok-2026'})</span></div>
          <div style="color:#FBBF24; font-size:0.82rem;">${'⭐'.repeat(fb.overall_rating || 5)} (${fb.overall_rating}/5) &nbsp;|&nbsp; NPS: <strong style="color:#EC4899;">${fb.nps_score || 10}</strong></div>
        </div>
        <p style="color:#CBD5E1; font-size:0.82rem; margin:0 0 6px;">"${fb.comments}"</p>
        <div style="font-size:0.72rem; color:var(--text-muted);">Keynote: ${fb.content_rating || 5}/5 • Venue: ${fb.venue_rating || 5}/5 • ${fb.created_at ? new Date(fb.created_at).toLocaleTimeString() : 'Just now'}</div>
      </div>
    `).join('');
  } catch (err) {
    console.error('Error loading admin feedback:', err);
  }
}

async function restoreUserSession() {
  if (typeof localStorage === 'undefined') return;
  try {
    const cachedUser = localStorage.getItem('devfestverse_user');
    const cachedAvatar = localStorage.getItem('devfestverse_avatar');
    if (cachedAvatar) {
      studioConfig = JSON.parse(cachedAvatar);
    }
    if (cachedUser) {
      const parsed = JSON.parse(cachedUser);
      currentUser = { ...currentUser, ...parsed };
      if (parsed.avatar_config) {
        studioConfig = { ...parsed.avatar_config };
      }
      initStudioControls();
      updateUserUI();
    }

    // Refresh user profile and avatar from Firestore
    if (currentUser.id) {
      const res = await fetchAPI('/auth/me');
      if (res && res.user) {
        currentUser = { ...currentUser, ...res.user };
        if (res.user.avatar_config) {
          studioConfig = { ...res.user.avatar_config };
          currentUser.avatar_config = { ...res.user.avatar_config };
          saveUserSession(currentUser);
        }
        initStudioControls();
        updateUserUI();
      }
    }
  } catch (e) {
    console.log('Error restoring user session:', e);
  }
}

// Google Identity Services setup on window load
window.addEventListener('load', async () => {
  // Restore persisted character and avatar on load
  await restoreUserSession();

  let googleClientId = '';
  try {
    const cfg = await fetchAPI('/auth/config');
    if (cfg && cfg.google_client_id) {
      googleClientId = cfg.google_client_id;
    }
  } catch (e) {}

  if (googleClientId && window.google && window.google.accounts && window.google.accounts.id) {
    try {
      window.google.accounts.id.initialize({
        client_id: googleClientId,
        callback: handleGoogleCredentialResponse,
        auto_select: false,
        cancel_on_tap_outside: true
      });
    } catch (e) {
      console.log('Google Identity Services init:', e);
    }
  }
});

// --- BUILDER ZONE SHOWCASE & LIVE IFRAME DEMOS ---
let ALL_BUILDER_PROJECTS = [];
let ACTIVE_BUILDER_CATEGORY = 'All';

async function loadBuilderProjects() {
  try {
    const data = await fetchAPI('/builders/projects');
    ALL_BUILDER_PROJECTS = data.projects || [];
    renderBuilderProjects(ALL_BUILDER_PROJECTS);
  } catch (err) {
    console.error('Error loading builder projects:', err);
  }
}

function renderBuilderProjects(projects) {
  const container = document.getElementById('builder-projects-list');
  if (!container) return;

  let filtered = projects;
  if (ACTIVE_BUILDER_CATEGORY !== 'All') {
    filtered = filtered.filter(p => p.category === ACTIVE_BUILDER_CATEGORY);
  }

  const searchVal = (document.getElementById('builder-search-input')?.value || '').toLowerCase().trim();
  if (searchVal) {
    filtered = filtered.filter(p => 
      p.title.toLowerCase().includes(searchVal) ||
      p.description.toLowerCase().includes(searchVal) ||
      p.builder_name.toLowerCase().includes(searchVal) ||
      (p.tech_stack || []).some(t => t.toLowerCase().includes(searchVal))
    );
  }

  if (filtered.length === 0) {
    container.innerHTML = `
      <div style="grid-column: 1 / -1; text-align:center; padding: 40px 20px; color:var(--text-muted);">
        <div style="font-size: 2.5rem; margin-bottom: 8px;">🚀</div>
        <div style="font-size: 1rem; color:#FFF; font-weight:700;">No projects found in this category</div>
        <div style="font-size: 0.8rem; margin-top: 4px;">Be the first developer to showcase your work!</div>
        <button class="hud-btn primary" onclick="openModal('builder-submit-modal')" style="margin: 12px auto 0; padding:8px 16px;">➕ Submit Your Project</button>
      </div>
    `;
    return;
  }

  container.innerHTML = filtered.map(p => {
    const hasUpvoted = (p.upvoted_by || []).includes(currentUser.id);
    const techChips = (p.tech_stack || []).map(t => 
      `<span style="background:rgba(255,255,255,0.06); border:1px solid rgba(255,255,255,0.1); border-radius:4px; padding:2px 6px; font-size:0.68rem; color:#94A3B8;">${t}</span>`
    ).join('');

    return `
      <div class="session-card" style="display:flex; flex-direction:column; justify-content:space-between; padding:14px; border:1px solid var(--card-border); border-radius:10px; background:#0B1120;">
        <div>
          <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:8px;">
            <span class="badge" style="background:#0284C7; font-size:0.7rem;">${p.category || 'App'}</span>
            <button onclick="upvoteBuilderProject('${p.id}')" class="hud-btn" style="padding:3px 8px; font-size:0.75rem; border-color:${hasUpvoted ? '#38BDF8' : 'var(--card-border)'}; background:${hasUpvoted ? 'rgba(56,189,248,0.2)' : 'transparent'};">
              👏 <span>${p.upvotes || 0}</span>
            </button>
          </div>
          <h4 style="color:#FFF; font-size:0.95rem; margin:0 0 4px; font-weight:700;">${p.title}</h4>
          <div style="font-size:0.75rem; color:#38BDF8; margin-bottom:8px;">by ${p.builder_name}</div>
          <p style="font-size:0.78rem; color:#94A3B8; margin:0 0 10px; line-height:1.4; display:-webkit-box; -webkit-line-clamp:3; -webkit-box-orient:vertical; overflow:hidden;">
            ${p.description}
          </p>
          <div style="display:flex; flex-wrap:wrap; gap:4px; margin-bottom:12px;">
            ${techChips}
          </div>
        </div>

        <div style="display:flex; gap:6px; margin-top:8px;">
          <button class="hud-btn primary" onclick="launchBuilderLiveDemo('${p.title.replace(/'/g, "\\'")}', '${p.builder_name.replace(/'/g, "\\'")}', '${p.demo_url}')" style="flex:1; justify-content:center; padding:7px; font-size:0.78rem;">
            ▶️ Launch Demo
          </button>
          ${p.github_url ? `
            <a href="${p.github_url}" target="_blank" rel="noopener noreferrer" class="hud-btn" style="padding:7px 10px; font-size:0.78rem;" title="View Source Code on GitHub">
              💻
            </a>
          ` : ''}
        </div>
      </div>
    `;
  }).join('');
}

function filterBuilderCategory(cat, btn) {
  ACTIVE_BUILDER_CATEGORY = cat;
  document.querySelectorAll('#builder-track-chips .option-chip').forEach(b => b.classList.remove('selected'));
  if (btn) btn.classList.add('selected');
  renderBuilderProjects(ALL_BUILDER_PROJECTS);
}

function onBuilderSearch(val) {
  renderBuilderProjects(ALL_BUILDER_PROJECTS);
}

function launchBuilderLiveDemo(title, author, url) {
  const viewport = document.getElementById('builder-live-demo-viewport');
  const iframe = document.getElementById('builder-demo-iframe');
  const titleEl = document.getElementById('builder-demo-title');
  const authorEl = document.getElementById('builder-demo-author');
  const newTabBtn = document.getElementById('builder-demo-newtab-btn');

  if (titleEl) titleEl.innerText = title;
  if (authorEl) authorEl.innerText = `by ${author}`;
  if (newTabBtn) newTabBtn.href = url;
  if (iframe) iframe.src = url;
  if (viewport) {
    viewport.style.display = 'block';
    viewport.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  showToast(`Launched interactive demo for "${title}"! 🚀`, '🚀');
}

function closeBuilderLiveDemo() {
  const viewport = document.getElementById('builder-live-demo-viewport');
  const iframe = document.getElementById('builder-demo-iframe');
  if (viewport) viewport.style.display = 'none';
  if (iframe) iframe.src = 'about:blank';
}

async function upvoteBuilderProject(id) {
  try {
    const res = await fetchAPI(`/builders/projects/${id}/upvote`, { method: 'POST' });
    const proj = ALL_BUILDER_PROJECTS.find(p => p.id === id);
    if (proj) {
      proj.upvotes = res.upvotes;
      if (res.has_upvoted) {
        if (!proj.upvoted_by) proj.upvoted_by = [];
        if (!proj.upvoted_by.includes(currentUser.id)) proj.upvoted_by.push(currentUser.id);
      } else {
        proj.upvoted_by = (proj.upvoted_by || []).filter(u => u !== currentUser.id);
      }
    }
    renderBuilderProjects(ALL_BUILDER_PROJECTS);
    showToast(res.message || 'Upvoted!', '👏');
  } catch (err) {
    showToast('Failed to upvote project.', '⚠️');
  }
}

async function submitBuilderProject() {
  const title = document.getElementById('proj-sub-title')?.value.trim();
  const name = document.getElementById('proj-sub-name')?.value.trim();
  const category = document.getElementById('proj-sub-category')?.value || 'AI & Agents';
  const demoUrl = document.getElementById('proj-sub-demo')?.value.trim();
  const githubUrl = document.getElementById('proj-sub-github')?.value.trim();
  const tagsStr = document.getElementById('proj-sub-tags')?.value.trim();
  const desc = document.getElementById('proj-sub-desc')?.value.trim();

  if (!title || !name || !demoUrl || !desc) {
    showToast('Please fill in all required fields (Title, Builder, Demo URL, Description).', '⚠️');
    return;
  }

  const tech_stack = tagsStr ? tagsStr.split(',').map(t => t.trim()).filter(Boolean) : ['Google Cloud'];

  try {
    const res = await fetchAPI('/builders/projects', {
      method: 'POST',
      body: JSON.stringify({
        title,
        builder_name: name,
        category,
        demo_url: demoUrl,
        github_url: githubUrl || null,
        description: desc,
        tech_stack
      })
    });

    showToast(res.message || 'Project submitted successfully! 🎉', '🎉');
    closeModal('builder-submit-modal');
    
    // Clear inputs
    document.getElementById('proj-sub-title').value = '';
    document.getElementById('proj-sub-name').value = '';
    document.getElementById('proj-sub-demo').value = '';
    document.getElementById('proj-sub-github').value = '';
    document.getElementById('proj-sub-tags').value = '';
    document.getElementById('proj-sub-desc').value = '';

    // Reload list and launch newly created project demo directly!
    await loadBuilderProjects();
    if (res.project) {
      launchBuilderLiveDemo(res.project.title, res.project.builder_name, res.project.demo_url);
    }
  } catch (err) {
    showToast('Error submitting project. Please verify fields.', '⚠️');
  }
}

// --- REAL-TIME MULTIPLAYER PRESENCE VIA WEBSOCKET (CLOUD RUN CLUSTERING) ---
let presenceSocket = null;
let lastSentX = 0, lastSentY = 0, lastPosSentTime = 0;

function initRealtimePresence() {
  if (typeof window === 'undefined' || !window.WebSocket) return;
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const wsUrl = `${protocol}//${window.location.host}/api/v1/ws/presence/devfest-main?user_id=${currentUser.id}`;

  try {
    presenceSocket = new WebSocket(wsUrl);

    presenceSocket.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === 'INIT_PRESENCE' && msg.players) {
          // Merge initial active players
          msg.players.forEach(p => {
            if (p.id !== currentUser.id && !OTHER_PARTICIPANTS.some(op => op.id === p.id)) {
              OTHER_PARTICIPANTS.push({
                id: p.id,
                name: p.name || 'Attendee',
                role: p.role || 'PARTICIPANT',
                x: p.x || 480,
                y: p.y || 380,
                avatar: p.avatar || THEME_PRESETS[0].config,
                moving: false,
                direction: p.direction || 'down',
                verified: p.verified || false
              });
            }
          });
        } else if (msg.type === 'PLAYER_DELTA' && msg.player) {
          const p = msg.player;
          if (p.id === currentUser.id) return;
          let existing = OTHER_PARTICIPANTS.find(op => op.id === p.id);
          if (existing) {
            existing.x = p.x;
            existing.y = p.y;
            existing.direction = p.direction;
            existing.moving = p.moving;
            existing.name = p.name;
            existing.role = p.role;
            existing.verified = p.verified;
            if (p.avatar) existing.avatar = p.avatar;
          } else {
            OTHER_PARTICIPANTS.push({
              id: p.id,
              name: p.name || 'Attendee',
              role: p.role || 'PARTICIPANT',
              x: p.x,
              y: p.y,
              avatar: p.avatar || THEME_PRESETS[0].config,
              moving: p.moving,
              direction: p.direction || 'down',
              verified: p.verified || false
            });
          }
        } else if (msg.type === 'PLAYER_LEFT') {
          const idx = OTHER_PARTICIPANTS.findIndex(op => op.id === msg.id);
          if (idx !== -1) OTHER_PARTICIPANTS.splice(idx, 1);
        }
      } catch (err) {
        // Safe message ignore
      }
    };

    // Heartbeat ping every 12 seconds
    setInterval(() => {
      if (presenceSocket && presenceSocket.readyState === WebSocket.OPEN) {
        presenceSocket.send(JSON.stringify({ type: 'PING' }));
      }
    }, 12000);

  } catch (e) {
    console.log('Realtime WebSocket connecting in offline/local fallback mode');
  }
}

// Throttle broadcast of local player position (15 Hz)
setInterval(() => {
  if (presenceSocket && presenceSocket.readyState === WebSocket.OPEN && player) {
    const distMoved = Math.hypot(player.x - lastSentX, player.y - lastSentY);
    if (distMoved > 2 || player.moving) {
      presenceSocket.send(JSON.stringify({
        type: 'POSITION_UPDATE',
        x: player.x,
        y: player.y,
        direction: player.direction,
        moving: player.moving,
        name: currentUser.display_name,
        role: currentUser.role,
        verified: currentUser.verified_ticket,
        avatar: currentUser.avatar_config
      }));
      lastSentX = player.x;
      lastSentY = player.y;
    }
  }
}, 66); // ~15 FPS network broadcast

// Initialize on load
initStudioControls();
initMobileControls();
updateUserUI();
initRealtimePresence();
gameLoop();
studioPreviewLoop();



