const API_BASE = 'http://localhost:8000/api/v1';

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
  keys[e.code] = true;
  player.targetX = null;
  player.targetY = null;
  if ((e.code === 'KeyE' || e.code === 'Space') && player.nearHotspot && !isAnyModalActive()) {
    e.preventDefault();
    triggerHotspotAction(player.nearHotspot);
  }
});
window.addEventListener('keyup', (e) => { keys[e.code] = false; });

// Interactive Hotspots on the 2D Map
const HOTSPOTS = [
  { id: 'ticket-billboard', type: 'TICKET_BILLBOARD', x: 420, y: 270, width: 120, height: 50, label: '🎫 MAIN TICKET BILLBOARD', sub: 'Verify Ticket to Unlock', color: '#10B981', ringColor: '#34D399' },
  { id: 'workshop-zone', type: 'WORKSHOP_ZONE', x: 100, y: 190, width: 140, height: 60, label: '💻 WORKSHOP LABS', sub: 'Hands-on Seat Reservation', color: '#8B5CF6', ringColor: '#A78BFA' },
  { id: 'sponsor-google', type: 'SPONSOR_BOOTH', x: 720, y: 190, width: 140, height: 60, label: '🏢 GOOGLE CLOUD BOOTH', sub: 'Vertex AI & Cloud Run Expo', url: 'https://cloud.google.com', color: '#EA4335', ringColor: '#F87171' },
  { id: 'bb-fb-page', type: 'COMMUNITY_BILLBOARD', x: 80, y: 50, width: 75, height: 40, label: '📘 FB PAGE', url: 'https://www.facebook.com/gdgcloudbkk', color: '#4285F4', ringColor: '#60A5FA' },
  { id: 'bb-fb-group', type: 'COMMUNITY_BILLBOARD', x: 170, y: 50, width: 75, height: 40, label: '👥 FB GROUP', url: 'https://www.facebook.com/groups/gdgcloudbkk', color: '#34A853', ringColor: '#4ADE80' },
  { id: 'bb-discord', type: 'COMMUNITY_BILLBOARD', x: 260, y: 50, width: 75, height: 40, label: '💬 DISCORD', url: 'https://discord.gg/gdgcloudbkk', color: '#5865F2', ringColor: '#818CF8' },
  { id: 'bb-instagram', type: 'COMMUNITY_BILLBOARD', x: 350, y: 50, width: 85, height: 40, label: '📷 INSTAGRAM', url: 'https://www.instagram.com/gdgcloudbkk', color: '#E1306C', ringColor: '#F472B6' },
  { id: 'bb-youtube', type: 'COMMUNITY_BILLBOARD', x: 450, y: 50, width: 80, height: 40, label: '▶️ YOUTUBE', url: 'https://www.youtube.com/@gdgcloudbkk', color: '#FF0000', ringColor: '#F87171' },
  { id: 'stage-screen', type: 'STAGE_SCREEN', x: 570, y: 45, width: 150, height: 48, label: '🎤 MAIN STAGE AGENDA', sub: 'Live Gemini Transcripts', color: '#FBBC04', ringColor: '#FDE047' }
];

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
  if (player.nearHotspot) {
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
function drawCharacterSprite(renderCtx, x, y, config, isMoving, stepFrame, bobOffset, direction, scale = 1, showBadge = true) {
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

  // 8. Overhead Nametag & Badges (World Canvas only)
  if (showBadge) {
    const badgeY = hy - 14;
    // Verified Badge Tag
    if (currentUser.verified_ticket) {
      renderCtx.fillStyle = '#10B981';
      renderCtx.font = 'bold 9px Plus Jakarta Sans, Segoe UI, sans-serif';
      renderCtx.textAlign = 'center';
      renderCtx.fillText('✔ VERIFIED', 0, badgeY);
    }
    
    // Player Name
    renderCtx.fillStyle = '#FFFFFF';
    renderCtx.font = 'bold 11px Plus Jakarta Sans, Segoe UI, sans-serif';
    renderCtx.textAlign = 'center';
    renderCtx.shadowColor = 'rgba(0,0,0,0.8)';
    renderCtx.shadowBlur = 4;
    renderCtx.fillText(currentUser.display_name, 0, badgeY + (currentUser.verified_ticket ? 10 : 0));
    renderCtx.shadowBlur = 0;
  }

  renderCtx.restore();
}

function renderWorld() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // 1. Tech Campus Floor Grid
  ctx.strokeStyle = '#151F33';
  ctx.lineWidth = 1;
  for (let x = 0; x < canvas.width; x += 40) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke();
  }
  for (let y = 0; y < canvas.height; y += 40) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke();
  }

  // 2. Google Color Circuit Paths on Floor
  const time = Date.now() * 0.002;
  ctx.lineWidth = 3;
  // Blue circuit line
  ctx.strokeStyle = '#2563EB33';
  ctx.beginPath(); ctx.moveTo(100, 100); ctx.lineTo(480, 100); ctx.lineTo(480, 360); ctx.stroke();
  // Red circuit line
  ctx.strokeStyle = '#DC262633';
  ctx.beginPath(); ctx.moveTo(780, 100); ctx.lineTo(480, 100); ctx.stroke();
  // Green circuit line
  ctx.strokeStyle = '#16A34A33';
  ctx.beginPath(); ctx.moveTo(170, 290); ctx.lineTo(420, 290); ctx.stroke();

  // 3. Hotspot Holographic Platforms & Billboards
  HOTSPOTS.forEach(spot => {
    const cx = spot.x + spot.width / 2;
    const cy = spot.y + spot.height / 2;

    // Glowing pulsating ring under hotspot
    const pulse = Math.sin(time + spot.x) * 3;
    ctx.fillStyle = spot.ringColor + '22';
    ctx.beginPath();
    ctx.ellipse(cx, cy + spot.height / 2, spot.width / 2 + 8 + pulse, 12 + pulse / 2, 0, 0, Math.PI * 2);
    ctx.fill();

    // Billboard / Booth Box
    ctx.fillStyle = '#0F172A';
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

    // Label Text
    ctx.fillStyle = '#FFF';
    ctx.font = 'bold 10px Plus Jakarta Sans, Segoe UI';
    ctx.textAlign = 'center';
    ctx.fillText(spot.label, cx, spot.y + spot.height / 2 + (spot.sub ? -2 : 3));

    if (spot.sub) {
      ctx.fillStyle = '#94A3B8';
      ctx.font = '8px Plus Jakarta Sans, Segoe UI';
      ctx.fillText(spot.sub, cx, spot.y + spot.height / 2 + 10);
    }
  });

  // 4. Tap-to-Move Glowing Destination Ring
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

  // 5. Render Player Sprite
  const bobOffset = !player.moving ? Math.sin(player.bobFrame) * 3 : 0;
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
    true
  );

  // 6. Mini-Map Radar on Bottom-Right
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
  updatePlayer();
  renderWorld();
  requestAnimationFrame(gameLoop);
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
  requestAnimationFrame(studioPreviewLoop);
}

async function saveAndApplyAvatar() {
  try {
    const data = await fetchAPI('/avatar/customize', {
      method: 'POST',
      body: JSON.stringify(studioConfig)
    });
    currentUser.avatar_config = { ...studioConfig };
    updateUserUI();
    showToast(data.message || '🎉 Avatar design saved & applied!', '🎨');
    closeModal('avatar-studio-modal');
  } catch (err) {
    showToast('Error saving avatar configuration.', '⚠️');
  }
}

async function generateWithGeminiAI() {
  const promptInput = document.getElementById('ai-avatar-prompt');
  const prompt = promptInput.value.trim();
  if (!prompt) {
    showToast('Please type a prompt for Gemini AI avatar synthesis!', '⚠️');
    return;
  }

  showToast('Synthesizing character with Gemini AI...', '🤖');
  try {
    const data = await fetchAPI('/avatar/ai-generate', {
      method: 'POST',
      body: JSON.stringify({ prompt })
    });
    if (data.config) {
      studioConfig = { ...data.config };
      initStudioControls();
      showToast(data.message || 'Gemini AI generated your character!', '✨');
    } else {
      showToast(data.detail || 'Failed to generate avatar.', '⚠️');
    }
  } catch (err) {
    showToast('Failed to connect to Gemini AI generator.', '⚠️');
  }
}

// --- AUTH & GOOGLE ONBOARDING ---
async function loginWithGoogle() {
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
      }
      updateUserUI();
      closeModal('signin-modal');
      showToast(`Welcome ${currentUser.display_name}! Signed in via Google`, '🚀');
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
    loadAdminSessions();
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
  document.getElementById('billboard-iframe-viewport').src = url;
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

// --- API INTEGRATION HELPERS ---
async function fetchAPI(endpoint, options = {}) {
  options.headers = options.headers || {};
  options.headers['x-user-id'] = currentUser.id;
  options.headers['Content-Type'] = 'application/json';
  const res = await fetch(`${API_BASE}${endpoint}`, options);
  return res.json();
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

// Back Office Controls
function showAdminTab(tabId) {
  document.querySelectorAll('.admin-tab').forEach(t => t.style.display = 'none');
  const target = document.getElementById(tabId);
  if (target) target.style.display = 'block';
  if (tabId === 'agenda-admin-tab') {
    loadAdminSessions();
  }
  if (tabId === 'firestore-admin-tab') {
    loadFirestoreEventData();
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
    clearAdminSessionForm();
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

function clearAdminSessionForm() {
  document.getElementById('sess-edit-id').value = '';
  document.getElementById('sess-edit-title').value = '';
  document.getElementById('sess-edit-speaker').value = '';
  document.getElementById('sess-edit-room').value = '';
  document.getElementById('sess-edit-start').value = '';
  document.getElementById('sess-edit-end').value = '';
  document.getElementById('sess-edit-desc').value = '';
  document.getElementById('admin-session-form-title').innerText = 'Add / Edit Agenda Session';
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

// Initialize on load
initStudioControls();
initMobileControls();
updateUserUI();
gameLoop();
studioPreviewLoop();



