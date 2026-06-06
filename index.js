/* ═══════════════════════════════════════════════════════════════
   FGC 2026 SIMULATOR ENGINE — Team Colombia
   Interactive Field + Calculator + Game Features
   ═══════════════════════════════════════════════════════════════ */

// ── 1. GAME STATE ───────────────────────────────────────────────
const STATE = {
  robots: {
    redR1: { zone: 'none', buddy: false },
    redR2: { zone: 'none', buddy: false },
    redR3: { zone: 'none', buddy: false },
    blueR1: { zone: 'none', buddy: false },
    blueR2: { zone: 'none', buddy: false },
    blueR3: { zone: 'none', buddy: false }
  },
  suppression: { red: 0, blue: 0 },
  extinguisher: 0,
  totalWildfires: 500
};

// Robot positions on canvas
const ROBOT_POS = {
  redR1:  { x: 140, y: 510, baseX: 140, baseY: 510 },
  redR2:  { x: 90,  y: 560, baseX: 90,  baseY: 560 },
  redR3:  { x: 190, y: 570, baseX: 190, baseY: 570 },
  blueR1: { x: 560, y: 510, baseX: 560, baseY: 510 },
  blueR2: { x: 510, y: 560, baseX: 510, baseY: 560 },
  blueR3: { x: 610, y: 570, baseX: 610, baseY: 570 }
};

const ROBOT_COLORS = {
  redR1: '#ce1126', redR2: '#ff5565', redR3: '#ff5565',
  blueR1: '#0033a0', blueR2: '#5588ff', blueR3: '#5588ff'
};
const ROBOT_NAMES = {
  redR1: 'COL', redR2: 'R2', redR3: 'R3',
  blueR1: 'B1', blueR2: 'B2', blueR3: 'B3'
};

// Load robot images
const ROBOT_IMAGES = {
  redR1: new Image(), redR2: new Image(), redR3: new Image(),
  blueR1: new Image(), blueR2: new Image(), blueR3: new Image()
};
ROBOT_IMAGES.redR1.src = 'robot_colombia.png';
ROBOT_IMAGES.redR2.src = 'robot_ally.png';
ROBOT_IMAGES.redR3.src = 'robot_ally.png';
ROBOT_IMAGES.blueR1.src = 'robot_rival.png';
ROBOT_IMAGES.blueR2.src = 'robot_rival.png';
ROBOT_IMAGES.blueR3.src = 'robot_rival.png';

// Drag state
let dragRobot = null;
let dragOffset = { x: 0, y: 0 };
let buddyLinkMode = null; // robot key in buddy-link mode
let contextRobot = null;
let heatmapOn = false;

// Wildfire particles
let particles = [];
const PARTICLE_COUNT = 60;

// Animation frame
let animFrame = null;

// ── 2. CANVAS SETUP ─────────────────────────────────────────────
const canvas = document.getElementById('fieldCanvas');
const ctx = canvas.getContext('2d');
const DPR = window.devicePixelRatio || 1;

function resizeCanvas() {
  const wrapper = canvas.parentElement;
  const size = Math.min(wrapper.clientWidth, 700);
  canvas.style.width = size + 'px';
  canvas.style.height = size + 'px';
  canvas.width = size * DPR;
  canvas.height = size * DPR;
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
}
resizeCanvas();
window.addEventListener('resize', () => { resizeCanvas(); render(); });

// Get canvas-relative size
function S() { return parseFloat(canvas.style.width); }

// ── 3. FIELD DRAWING ────────────────────────────────────────────
function render() {
  const s = S();
  ctx.clearRect(0, 0, s, s);

  // Background
  ctx.fillStyle = '#0a0c14';
  ctx.fillRect(0, 0, s, s);

  // Subtle grid
  ctx.strokeStyle = 'rgba(255,255,255,0.015)';
  ctx.lineWidth = 0.5;
  const gs = s / 18;
  for (let i = 0; i <= 18; i++) {
    ctx.beginPath(); ctx.moveTo(i * gs, 0); ctx.lineTo(i * gs, s); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, i * gs); ctx.lineTo(s, i * gs); ctx.stroke();
  }

  // Field boundary (the 7x7m playing field)
  const pad = s * 0.08;
  const fw = s - pad * 2;
  ctx.strokeStyle = 'rgba(255,255,255,0.08)';
  ctx.lineWidth = 2;
  ctx.strokeRect(pad, pad, fw, fw);

  // ── Alliance Stations ──
  // Red (left)
  ctx.fillStyle = 'rgba(206,17,38,0.04)';
  ctx.strokeStyle = 'rgba(206,17,38,0.2)';
  ctx.lineWidth = 2;
  ctx.fillRect(pad - s * 0.06, pad, s * 0.06, fw);
  ctx.strokeRect(pad - s * 0.06, pad, s * 0.06, fw);
  // Red label
  ctx.save();
  ctx.translate(pad - s * 0.03, pad + fw / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.fillStyle = 'rgba(206,17,38,0.4)';
  ctx.font = `bold ${s * 0.015}px Montserrat`;
  ctx.textAlign = 'center';
  ctx.fillText('RED ALLIANCE STATION', 0, 0);
  ctx.restore();

  // Blue (right)
  ctx.fillStyle = 'rgba(0,51,160,0.04)';
  ctx.strokeStyle = 'rgba(0,51,160,0.2)';
  ctx.fillRect(pad + fw, pad, s * 0.06, fw);
  ctx.strokeRect(pad + fw, pad, s * 0.06, fw);
  ctx.save();
  ctx.translate(pad + fw + s * 0.03, pad + fw / 2);
  ctx.rotate(Math.PI / 2);
  ctx.fillStyle = 'rgba(0,51,160,0.4)';
  ctx.font = `bold ${s * 0.015}px Montserrat`;
  ctx.textAlign = 'center';
  ctx.fillText('BLUE ALLIANCE STATION', 0, 0);
  ctx.restore();

  // ── Guardrails (bottom) ──
  ctx.strokeStyle = 'rgba(255,255,255,0.15)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(pad + fw * 0.15, pad + fw);
  ctx.lineTo(pad + fw * 0.85, pad + fw);
  ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.06)';
  ctx.font = `bold ${s * 0.013}px Montserrat`;
  ctx.textAlign = 'center';
  ctx.fillText('GUARDRAILS', pad + fw / 2, pad + fw + s * 0.025);

  // ── Fire Shields (bottom corners) ──
  const shieldSize = fw * 0.1;
  // Left fire shield
  ctx.fillStyle = 'rgba(206,17,38,0.06)';
  ctx.strokeStyle = 'rgba(206,17,38,0.15)';
  ctx.lineWidth = 1.5;
  ctx.fillRect(pad, pad + fw - shieldSize, shieldSize, shieldSize);
  ctx.strokeRect(pad, pad + fw - shieldSize, shieldSize, shieldSize);
  ctx.fillStyle = 'rgba(206,17,38,0.3)';
  ctx.font = `bold ${s * 0.01}px Montserrat`;
  ctx.fillText('🛡', pad + shieldSize / 2, pad + fw - shieldSize / 2 + 2);

  // Right fire shield
  ctx.fillStyle = 'rgba(0,51,160,0.06)';
  ctx.strokeStyle = 'rgba(0,51,160,0.15)';
  ctx.fillRect(pad + fw - shieldSize, pad + fw - shieldSize, shieldSize, shieldSize);
  ctx.strokeRect(pad + fw - shieldSize, pad + fw - shieldSize, shieldSize, shieldSize);
  ctx.fillStyle = 'rgba(0,51,160,0.3)';
  ctx.fillText('🛡', pad + fw - shieldSize / 2, pad + fw - shieldSize / 2 + 2);

  // ── Human Player Zones (bottom corners, outside field) ──
  ctx.fillStyle = 'rgba(206,17,38,0.03)';
  ctx.fillRect(pad - s * 0.06, pad + fw - shieldSize * 1.5, s * 0.06, shieldSize * 1.5);
  ctx.fillStyle = 'rgba(206,17,38,0.25)';
  ctx.font = `${s * 0.009}px Montserrat`;
  ctx.textAlign = 'center';
  ctx.fillText('HUMAN', pad - s * 0.03, pad + fw - shieldSize * 0.6);
  ctx.fillText('PLAYER', pad - s * 0.03, pad + fw - shieldSize * 0.3);

  ctx.fillStyle = 'rgba(0,51,160,0.03)';
  ctx.fillRect(pad + fw, pad + fw - shieldSize * 1.5, s * 0.06, shieldSize * 1.5);
  ctx.fillStyle = 'rgba(0,51,160,0.25)';
  ctx.fillText('HUMAN', pad + fw + s * 0.03, pad + fw - shieldSize * 0.6);
  ctx.fillText('PLAYER', pad + fw + s * 0.03, pad + fw - shieldSize * 0.3);

  // ── Suppression Units (top area) ──
  const supW = fw * 0.12;
  const supH = fw * 0.08;
  const supY = pad + fw * 0.03;

  // Red suppression (left of center)
  ctx.fillStyle = 'rgba(206,17,38,0.06)';
  ctx.strokeStyle = 'rgba(206,17,38,0.25)';
  ctx.lineWidth = 1.5;
  const redSupX = pad + fw * 0.22;
  ctx.beginPath();
  ctx.roundRect(redSupX, supY, supW, supH, 4);
  ctx.fill(); ctx.stroke();
  ctx.fillStyle = 'rgba(255,85,101,0.7)';
  ctx.font = `bold ${s * 0.012}px Montserrat`;
  ctx.textAlign = 'center';
  ctx.fillText('SUP. RED', redSupX + supW / 2, supY + supH / 2 + 3);

  // Blue suppression (right of center)
  ctx.fillStyle = 'rgba(0,51,160,0.06)';
  ctx.strokeStyle = 'rgba(0,51,160,0.25)';
  const blueSupX = pad + fw * 0.66;
  ctx.beginPath();
  ctx.roundRect(blueSupX, supY, supW, supH, 4);
  ctx.fill(); ctx.stroke();
  ctx.fillStyle = 'rgba(85,136,255,0.7)';
  ctx.fillText('SUP. BLUE', blueSupX + supW / 2, supY + supH / 2 + 3);

  // ── Extinguisher (center top) ──
  const extR = fw * 0.06;
  const extCX = pad + fw / 2;
  const extCY = supY + supH / 2;
  ctx.fillStyle = 'rgba(255,215,0,0.04)';
  ctx.strokeStyle = 'rgba(255,215,0,0.25)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(extCX, extCY, extR, 0, Math.PI * 2);
  ctx.fill(); ctx.stroke();
  ctx.fillStyle = 'rgba(255,215,0,0.7)';
  ctx.font = `bold ${s * 0.011}px Montserrat`;
  ctx.fillText('EXTINGUISHER', extCX, extCY + 3);

  // ── Suppression Units label ──
  ctx.fillStyle = 'rgba(255,255,255,0.08)';
  ctx.font = `bold ${s * 0.01}px Montserrat`;
  ctx.fillText('SUPPRESSION UNITS', pad + fw / 2, supY - s * 0.01);

  // ── Brace Lines (diagonal from bottom to top-center) ──
  const braceTopX = pad + fw / 2;
  const braceTopY = pad + fw * 0.15;
  const braceBottomLeftX = pad + fw * 0.15;
  const braceBottomRightX = pad + fw * 0.85;
  const braceBottomY = pad + fw * 0.85;

  // Red brace line (left)
  ctx.strokeStyle = 'rgba(206,17,38,0.12)';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(braceBottomLeftX, braceBottomY);
  ctx.lineTo(braceTopX - fw * 0.02, braceTopY);
  ctx.stroke();

  // Blue brace line (right)
  ctx.strokeStyle = 'rgba(0,51,160,0.12)';
  ctx.beginPath();
  ctx.moveTo(braceBottomRightX, braceBottomY);
  ctx.lineTo(braceTopX + fw * 0.02, braceTopY);
  ctx.stroke();

  // ── Zone Markers on brace lines ──
  const zonePositions = [
    { name: 'BRACE: ZONE 3', t: 0.25, color: 'rgba(232,48,72,0.4)' },
    { name: 'BRACE: ZONE 2', t: 0.50, color: 'rgba(74,144,226,0.4)' },
    { name: 'BRACE: ZONE 1', t: 0.75, color: 'rgba(240,192,64,0.4)' }
  ];

  zonePositions.forEach(zp => {
    // Left brace marker
    const lx = braceBottomLeftX + (braceTopX - fw * 0.02 - braceBottomLeftX) * zp.t;
    const rx = braceBottomRightX + (braceTopX + fw * 0.02 - braceBottomRightX) * zp.t;
    const y = braceBottomY + (braceTopY - braceBottomY) * zp.t;

    ctx.strokeStyle = zp.color;
    ctx.lineWidth = 1;
    // Horizontal zone line spanning the field width at this y
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(lx, y);
    ctx.lineTo(rx, y);
    ctx.stroke();
    ctx.setLineDash([]);

    // Label
    ctx.fillStyle = zp.color;
    ctx.font = `bold ${s * 0.012}px Montserrat`;
    ctx.textAlign = 'center';
    ctx.fillText(zp.name, pad + fw / 2, y - 4);
  });

  // ── Regional Zone labels ──
  ctx.fillStyle = 'rgba(255,255,255,0.06)';
  ctx.font = `${s * 0.011}px Montserrat`;
  ctx.textAlign = 'center';
  const regY = pad + fw * 0.45;
  ctx.fillText('REGIONAL', pad + fw * 0.28, regY);
  ctx.fillText('ZONE', pad + fw * 0.28, regY + s * 0.015);
  ctx.fillText('REGIONAL', pad + fw * 0.72, regY);
  ctx.fillText('ZONE', pad + fw * 0.72, regY + s * 0.015);

  // ── Heat Map Overlay ──
  if (heatmapOn) {
    drawHeatmap(s, pad, fw);
  }

  // ── Wildfire Particles ──
  drawParticles(s, pad, fw);

  // ── Buddy Links ──
  drawBuddyLinks(s);

  // ── Buddy Link Mode indicator ──
  if (buddyLinkMode) {
    ctx.strokeStyle = 'rgba(255,215,0,0.3)';
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 6]);
    const rob = ROBOT_POS[buddyLinkMode];
    ctx.beginPath();
    ctx.arc(rob.x, rob.y, 28, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // ── Robots ──
  drawRobots(s);
}

function drawHeatmap(s, pad, fw) {
  // Show optimal zones with gradient
  const zones = [
    { label: 'Z3 OPTIMAL', y: pad + fw * 0.2, intensity: 0.06, color: '232,48,72' },
    { label: 'Z2 GOOD', y: pad + fw * 0.4, intensity: 0.04, color: '74,144,226' },
    { label: 'Z1 BASIC', y: pad + fw * 0.6, intensity: 0.03, color: '240,192,64' },
    { label: 'SCORING ZONE', y: pad + fw * 0.1, intensity: 0.05, color: '255,215,0' }
  ];

  zones.forEach(z => {
    const grad = ctx.createRadialGradient(pad + fw / 2, z.y, 0, pad + fw / 2, z.y, fw * 0.4);
    grad.addColorStop(0, `rgba(${z.color},${z.intensity})`);
    grad.addColorStop(1, `rgba(${z.color},0)`);
    ctx.fillStyle = grad;
    ctx.fillRect(pad, z.y - fw * 0.15, fw, fw * 0.3);
  });
}

function drawParticles(s, pad, fw) {
  if (particles.length < PARTICLE_COUNT) {
    for (let i = particles.length; i < PARTICLE_COUNT; i++) {
      particles.push({
        x: pad + Math.random() * fw,
        y: pad + fw * 0.3 + Math.random() * fw * 0.5,
        vx: (Math.random() - 0.5) * 0.3,
        vy: (Math.random() - 0.5) * 0.2,
        r: 2 + Math.random() * 3,
        alpha: 0.15 + Math.random() * 0.25,
        phase: Math.random() * Math.PI * 2
      });
    }
  }

  const t = Date.now() / 1000;
  particles.forEach(p => {
    p.x += p.vx;
    p.y += p.vy + Math.sin(t + p.phase) * 0.15;

    // Wrap around
    if (p.x < pad) p.x = pad + fw;
    if (p.x > pad + fw) p.x = pad;
    if (p.y < pad + fw * 0.2) p.y = pad + fw * 0.8;
    if (p.y > pad + fw * 0.85) p.y = pad + fw * 0.25;

    ctx.fillStyle = `rgba(255,160,40,${p.alpha * (0.5 + 0.5 * Math.sin(t * 2 + p.phase))})`;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    ctx.fill();
  });
}

function drawBuddyLinks(s) {
  const robotKeys = Object.keys(STATE.robots);
  const t = Date.now() / 500;

  robotKeys.forEach(fromKey => {
    const rob = STATE.robots[fromKey];
    if (!rob.buddy) return;

    const toKey = rob.buddy;
    const fromPos = ROBOT_POS[fromKey];
    const toPos = ROBOT_POS[toKey];
    if (!fromPos || !toPos) return;

    // Animated golden chain
    ctx.strokeStyle = `rgba(255,215,0,${0.3 + 0.15 * Math.sin(t)})`;
    ctx.lineWidth = 2.5;
    ctx.setLineDash([6, 4]);
    ctx.lineDashOffset = -Date.now() / 100;
    ctx.beginPath();
    ctx.moveTo(fromPos.x, fromPos.y);
    ctx.lineTo(toPos.x, toPos.y);
    ctx.stroke();
    ctx.setLineDash([]);

    // Chain icon at midpoint
    const mx = (fromPos.x + toPos.x) / 2;
    const my = (fromPos.y + toPos.y) / 2;
    ctx.fillStyle = `rgba(255,215,0,${0.5 + 0.2 * Math.sin(t)})`;
    ctx.font = `${S() * 0.02}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText('🔗', mx, my + 2);
  });
}

function drawRobots(s) {
  const robotKeys = Object.keys(ROBOT_POS);
  const robotRadius = s * 0.0357;

  robotKeys.forEach(key => {
    const pos = ROBOT_POS[key];
    const color = ROBOT_COLORS[key];
    const name = ROBOT_NAMES[key];
    const zone = STATE.robots[key].zone;
    const isBuddy = !!STATE.robots[key].buddy;
    const isDragging = dragRobot === key;

    // Glow based on zone
    const glowColors = {
      none: 'transparent',
      contact: 'rgba(139,143,160,0.3)',
      z1: 'rgba(240,192,64,0.4)',
      z2: 'rgba(74,144,226,0.4)',
      z3: 'rgba(232,48,72,0.5)'
    };

    // Outer glow
    if (zone !== 'none') {
      ctx.shadowColor = glowColors[zone] || 'transparent';
      ctx.shadowBlur = isDragging ? 20 : 12;
    }

    // Draw premium image if loaded
    const img = ROBOT_IMAGES[key];
    if (img && img.complete && img.naturalWidth !== 0) {
      ctx.drawImage(img, pos.x - robotRadius, pos.y - robotRadius, robotRadius * 2, robotRadius * 2);
    } else {
      // Fallback to circle
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, robotRadius, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;

    // Border
    ctx.strokeStyle = isDragging ? '#fff' : 'rgba(255,255,255,0.4)';
    ctx.lineWidth = isDragging ? 2.5 : 1.5;
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, robotRadius, 0, Math.PI * 2);
    ctx.stroke();

    // Zone ring indicator
    if (zone !== 'none') {
      const zoneRingColors = {
        contact: '#8b8fa0',
        z1: '#f0c040',
        z2: '#4a90e2',
        z3: '#e83048'
      };
      ctx.strokeStyle = zoneRingColors[zone];
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, robotRadius + 4, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Buddy icon
    if (isBuddy) {
      ctx.fillStyle = 'rgba(255,215,0,0.9)';
      ctx.font = `${s * 0.016}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText('⛓', pos.x, pos.y - robotRadius - 6);
    }

    // Name label badge under the robot
    ctx.fillStyle = 'rgba(10, 12, 20, 0.8)';
    ctx.beginPath();
    ctx.roundRect(pos.x - 22, pos.y + robotRadius - 2, 44, 14, 4);
    ctx.fill();

    ctx.fillStyle = '#fff';
    ctx.font = `bold ${s * 0.011}px Montserrat`;
    ctx.textAlign = 'center';
    ctx.fillText(name, pos.x, pos.y + robotRadius + 8);
  });
}

// ── Animation Loop ──
function animate() {
  render();
  animFrame = requestAnimationFrame(animate);
}
animate();

// ── 4. CANVAS INTERACTION ───────────────────────────────────────

function getCanvasPos(e) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: (e.clientX - rect.left) * (S() / rect.width),
    y: (e.clientY - rect.top) * (S() / rect.height)
  };
}

function hitTestRobot(mx, my) {
  const radius = S() * 0.0357;
  for (const key of Object.keys(ROBOT_POS)) {
    const rob = ROBOT_POS[key];
    if (Math.hypot(rob.x - mx, rob.y - my) <= radius + 5) return key;
  }
  return null;
}

// Mouse Down — Start drag
canvas.addEventListener('mousedown', (e) => {
  if (e.button !== 0) return;
  const { x, y } = getCanvasPos(e);
  const hit = hitTestRobot(x, y);

  if (hit) {
    if (buddyLinkMode && buddyLinkMode !== hit) {
      // Complete buddy link
      const fromAlliance = buddyLinkMode.startsWith('red') ? 'red' : 'blue';
      const toAlliance = hit.startsWith('red') ? 'red' : 'blue';
      if (fromAlliance === toAlliance) {
        STATE.robots[buddyLinkMode].buddy = !STATE.robots[buddyLinkMode].buddy;
        syncUIFromState();
        recalculate();
      }
      buddyLinkMode = null;
      updateTooltip('Buddy link cancelado');
      return;
    }

    dragRobot = hit;
    dragOffset.x = x - ROBOT_POS[hit].x;
    dragOffset.y = y - ROBOT_POS[hit].y;
    canvas.style.cursor = 'grabbing';
  } else {
    buddyLinkMode = null;
  }
});

// Mouse Move — Drag
canvas.addEventListener('mousemove', (e) => {
  const { x, y } = getCanvasPos(e);

  if (dragRobot) {
    ROBOT_POS[dragRobot].x = x - dragOffset.x;
    ROBOT_POS[dragRobot].y = y - dragOffset.y;

    // Auto-detect zone based on Y position
    autoDetectZone(dragRobot);
  } else {
    // Hover cursor
    const hit = hitTestRobot(x, y);
    canvas.style.cursor = hit ? 'grab' : 'default';
  }
});

// Mouse Up — End drag
window.addEventListener('mouseup', () => {
  if (dragRobot) {
    snapToZone(dragRobot);
    dragRobot = null;
    canvas.style.cursor = 'default';
  }
});

// Double Click — Buddy mode
canvas.addEventListener('dblclick', (e) => {
  const { x, y } = getCanvasPos(e);
  const hit = hitTestRobot(x, y);
  if (!hit) return;

  // Toggle buddy on/off for this robot
  // R1/B1 can't be buddies themselves (they're the holders)
  if (hit === 'redR1' || hit === 'blueR1') {
    updateTooltip('R1/B1 sostiene a los buddies, no puede ser buddy');
    return;
  }

  if (STATE.robots[hit].buddy) {
    STATE.robots[hit].buddy = false;
  } else {
    // Chain connections
    if (hit === 'redR2') STATE.robots[hit].buddy = 'redR1';
    else if (hit === 'redR3') STATE.robots[hit].buddy = 'redR2';
    else if (hit === 'blueR2') STATE.robots[hit].buddy = 'blueR1';
    else if (hit === 'blueR3') STATE.robots[hit].buddy = 'blueR2';
  }

  syncUIFromState();
  recalculate();
  updateTooltip(STATE.robots[hit].buddy ? `${ROBOT_NAMES[hit]} conectado como Buddy 🔗` : `${ROBOT_NAMES[hit]} desconectado`);
});

// Right Click — Context Menu
canvas.addEventListener('contextmenu', (e) => {
  e.preventDefault();
  const { x, y } = getCanvasPos(e);
  const hit = hitTestRobot(x, y);
  if (!hit) { hideContextMenu(); return; }

  contextRobot = hit;
  showContextMenu(e.clientX, e.clientY);
});

// ── Zone Detection ──
function autoDetectZone(key) {
  const s = S();
  const pad = s * 0.08;
  const fw = s - pad * 2;
  const y = ROBOT_POS[key].y;

  const z3Line = pad + fw * 0.25;
  const z2Line = pad + fw * 0.50;
  const z1Line = pad + fw * 0.75;
  const contactLine = pad + fw * 0.85;

  let zone = 'none';
  if (y <= z3Line) zone = 'z3';
  else if (y <= z2Line) zone = 'z2';
  else if (y <= z1Line) zone = 'z1';
  else if (y <= contactLine) zone = 'contact';

  if (STATE.robots[key].zone !== zone) {
    STATE.robots[key].zone = zone;
    syncUIFromState();
    recalculate();
  }
}

function snapToZone(key) {
  autoDetectZone(key);
}

function getZoneY(zone, key) {
  const s = S();
  const pad = s * 0.08;
  const fw = s - pad * 2;
  const isRed = key.startsWith('red');
  const idx = parseInt(key.slice(-1)) - 1;
  const baseX = isRed ? pad + fw * 0.2 : pad + fw * 0.75;
  const offsetX = idx * s * 0.04;

  const yMap = {
    z3: pad + fw * 0.2,
    z2: pad + fw * 0.4,
    z1: pad + fw * 0.62,
    contact: pad + fw * 0.78,
    none: ROBOT_POS[key].baseY
  };

  return { x: baseX + offsetX, y: yMap[zone] || ROBOT_POS[key].baseY };
}

function moveRobotToZone(key, zone) {
  STATE.robots[key].zone = zone;
  const target = getZoneY(zone, key);

  // Smooth animation
  const startX = ROBOT_POS[key].x;
  const startY = ROBOT_POS[key].y;
  const duration = 300;
  const startTime = Date.now();

  function animMove() {
    const elapsed = Date.now() - startTime;
    const t = Math.min(1, elapsed / duration);
    const ease = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;

    ROBOT_POS[key].x = startX + (target.x - startX) * ease;
    ROBOT_POS[key].y = startY + (target.y - startY) * ease;

    if (t < 1) requestAnimationFrame(animMove);
  }
  animMove();

  syncUIFromState();
  recalculate();
}

// ── 5. CONTEXT MENU ─────────────────────────────────────────────
const contextMenu = document.getElementById('contextMenu');

function showContextMenu(x, y) {
  contextMenu.style.left = x + 'px';
  contextMenu.style.top = y + 'px';

  // Show/hide buddy options based on robot
  const isRed = contextRobot.startsWith('red');
  const isHolder = contextRobot === 'redR1' || contextRobot === 'blueR1';
  const isR3 = contextRobot === 'redR3' || contextRobot === 'blueR3';

  const cR1 = document.getElementById('ctxConnectR1');
  const cR2 = document.getElementById('ctxConnectR2');
  const cDisc = document.getElementById('ctxDisconnect');
  const bSep = document.getElementById('ctxBuddySep');

  if (isHolder) {
    cR1.style.display = 'none';
    cR2.style.display = 'none';
    cDisc.style.display = 'none';
    bSep.style.display = 'none';
  } else {
    bSep.style.display = 'block';
    cDisc.style.display = STATE.robots[contextRobot].buddy ? 'block' : 'none';

    // Connect R1 / B1 option
    cR1.style.display = STATE.robots[contextRobot].buddy === (isRed ? 'redR1' : 'blueR1') ? 'none' : 'block';
    cR1.textContent = isRed ? '🔗 Conectar a R1 (COL)' : '🔗 Conectar a B1 (Rival)';

    // Connect R2 / B2 option (only for R3 / B3)
    if (isR3) {
      cR2.style.display = STATE.robots[contextRobot].buddy === (isRed ? 'redR2' : 'blueR2') ? 'none' : 'block';
      cR2.textContent = isRed ? '🔗 Conectar a R2 (Aliado)' : '🔗 Conectar a B2 (Rival)';
    } else {
      cR2.style.display = 'none';
    }
  }

  contextMenu.classList.add('visible');
}

function hideContextMenu() {
  contextMenu.classList.remove('visible');
  contextRobot = null;
}

document.addEventListener('click', (e) => {
  if (!contextMenu.contains(e.target)) hideContextMenu();
});

contextMenu.querySelectorAll('.ctx-item').forEach(item => {
  item.addEventListener('click', () => {
    if (!contextRobot) return;
    const action = item.dataset.action;
    const isRed = contextRobot.startsWith('red');

    switch (action) {
      case 'moveZ3': moveRobotToZone(contextRobot, 'z3'); break;
      case 'moveZ2': moveRobotToZone(contextRobot, 'z2'); break;
      case 'moveZ1': moveRobotToZone(contextRobot, 'z1'); break;
      case 'moveContact': moveRobotToZone(contextRobot, 'contact'); break;
      case 'connectR1':
        STATE.robots[contextRobot].buddy = isRed ? 'redR1' : 'blueR1';
        syncUIFromState();
        recalculate();
        break;
      case 'connectR2':
        STATE.robots[contextRobot].buddy = isRed ? 'redR2' : 'blueR2';
        syncUIFromState();
        recalculate();
        break;
      case 'disconnectBuddy':
        STATE.robots[contextRobot].buddy = false;
        syncUIFromState();
        recalculate();
        break;
      case 'resetRobot':
        STATE.robots[contextRobot].zone = 'none';
        STATE.robots[contextRobot].buddy = false;
        ROBOT_POS[contextRobot].x = ROBOT_POS[contextRobot].baseX;
        ROBOT_POS[contextRobot].y = ROBOT_POS[contextRobot].baseY;
        syncUIFromState();
        recalculate();
        break;
    }
    hideContextMenu();
  });
});

// ── Tooltip ──
function updateTooltip(msg) {
  const tip = document.getElementById('canvasTooltip');
  tip.textContent = msg;
  tip.style.opacity = '1';
  setTimeout(() => {
    tip.textContent = 'Arrastra robots • Doble clic = Buddy • Clic derecho = Opciones';
    tip.style.opacity = '0.7';
  }, 2500);
}

// ── 6. SCORING ENGINE ───────────────────────────────────────────
const CLIMB_VALUES = { none: 0, contact: 0.05, z1: 0.10, z2: 0.20, z3: 0.30 };

function isRobotSupported(key) {
  const rob = STATE.robots[key];
  if (!rob || !rob.buddy) return false;

  let current = rob.buddy;
  const visited = new Set();
  while (current) {
    if (visited.has(current)) break; // Prevent loops
    visited.add(current);

    const parent = STATE.robots[current];
    if (!parent) return false;

    // If parent is climbing, the chain is valid
    if (parent.zone !== 'none') return true;

    current = parent.buddy;
  }
  return false;
}

function recalculate() {
  const redBalls = STATE.suppression.red;
  const blueBalls = STATE.suppression.blue;
  const extBalls = STATE.extinguisher;

  // Multipliers
  const redMult = 1.0 +
    CLIMB_VALUES[STATE.robots.redR1.zone] +
    CLIMB_VALUES[STATE.robots.redR2.zone] +
    CLIMB_VALUES[STATE.robots.redR3.zone];

  const blueMult = 1.0 +
    CLIMB_VALUES[STATE.robots.blueR1.zone] +
    CLIMB_VALUES[STATE.robots.blueR2.zone] +
    CLIMB_VALUES[STATE.robots.blueR3.zone];

  // Partner climbs (recursive verification)
  const redPartners = ['redR2', 'redR3'].filter(isRobotSupported).length;
  const bluePartners = ['blueR2', 'blueR3'].filter(isRobotSupported).length;
  const redPartnerPts = redPartners * 25;
  const bluePartnerPts = bluePartners * 25;

  // Coopertition
  let robotsInZ3 = 0;
  Object.values(STATE.robots).forEach(r => { if (r.zone === 'z3') robotsInZ3++; });
  let cooptPts = 0;
  if (robotsInZ3 >= 6) cooptPts = 40;
  else if (robotsInZ3 >= 5) cooptPts = 25;
  else if (robotsInZ3 >= 4) cooptPts = 10;

  // Regional scores
  const redRegional = Math.ceil(redBalls * redMult) + redPartnerPts;
  const blueRegional = Math.ceil(blueBalls * blueMult) + bluePartnerPts;

  // Total (each alliance gets global points)
  const redTotal = redRegional + extBalls + cooptPts;
  const blueTotal = blueRegional + extBalls + cooptPts;

  // Update VS Scoreboard
  animateScore('redTotalScore', redTotal);
  animateScore('blueTotalScore', blueTotal);

  document.getElementById('redSupDisplay').textContent = redBalls;
  document.getElementById('redMultDisplay').textContent = redMult.toFixed(2);
  document.getElementById('redPartnerDisplay').textContent = redPartnerPts;

  document.getElementById('blueSupDisplay').textContent = blueBalls;
  document.getElementById('blueMultDisplay').textContent = blueMult.toFixed(2);
  document.getElementById('bluePartnerDisplay').textContent = bluePartnerPts;

  document.getElementById('globalExtDisplay').textContent = extBalls;
  document.getElementById('globalCooptDisplay').textContent = cooptPts;

  // Multiplier badges
  document.getElementById('redMultBadge').textContent = `×${redMult.toFixed(3)}`;
  document.getElementById('blueMultBadge').textContent = `×${blueMult.toFixed(3)}`;

  // Zone bonuses
  ['redR1', 'redR2', 'redR3', 'blueR1', 'blueR2', 'blueR3'].forEach(key => {
    const el = document.getElementById(`${key}Bonus`);
    if (el) el.textContent = `+${CLIMB_VALUES[STATE.robots[key].zone].toFixed(2)}`;
  });

  // Wildfire pool
  const used = redBalls + blueBalls + extBalls;
  const remaining = Math.max(0, STATE.totalWildfires - used);
  document.getElementById('poolRemaining').textContent = remaining;

  const total = STATE.totalWildfires;
  document.getElementById('poolRed').style.width = (redBalls / total * 100) + '%';
  document.getElementById('poolExt').style.width = (extBalls / total * 100) + '%';
  document.getElementById('poolBlue').style.width = (blueBalls / total * 100) + '%';

  // Coopertition indicators
  updateCoopertition(robotsInZ3, cooptPts);
}

function animateScore(elementId, newValue) {
  const el = document.getElementById(elementId);
  const oldValue = parseInt(el.textContent) || 0;
  if (oldValue === newValue) return;

  const duration = 300;
  const startTime = Date.now();

  function step() {
    const elapsed = Date.now() - startTime;
    const t = Math.min(1, elapsed / duration);
    const ease = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
    const current = Math.round(oldValue + (newValue - oldValue) * ease);
    el.textContent = current;

    if (t < 1) requestAnimationFrame(step);
    else el.textContent = newValue;
  }
  step();
}

function updateCoopertition(count, bonus) {
  const dots = document.querySelectorAll('#cooptDots .coopt-dot');
  let redCount = 0;
  let blueCount = 0;

  ['redR1', 'redR2', 'redR3'].forEach(k => { if (STATE.robots[k].zone === 'z3') redCount++; });
  ['blueR1', 'blueR2', 'blueR3'].forEach(k => { if (STATE.robots[k].zone === 'z3') blueCount++; });

  dots.forEach((dot, i) => {
    dot.className = 'coopt-dot';
    if (i < redCount) dot.classList.add('active-red');
    else if (i < redCount + blueCount) dot.classList.add('active-blue');
  });

  document.getElementById('cooptBonus').textContent = `+${bonus} pts`;

  // Tier highlights
  document.getElementById('tier4').className = 'coopt-tier' + (count >= 4 ? ' active' : '');
  document.getElementById('tier5').className = 'coopt-tier' + (count >= 5 ? ' active' : '');
  document.getElementById('tier6').className = 'coopt-tier' + (count >= 6 ? ' active' : '');
}

// ── 7. UI CONTROLS ──────────────────────────────────────────────

// Zone Selectors
document.querySelectorAll('.zone-selector').forEach(selector => {
  const robotKey = selector.dataset.robot;
  selector.querySelectorAll('.zone-opt').forEach(opt => {
    opt.addEventListener('click', () => {
      const zone = opt.dataset.zone;
      STATE.robots[robotKey].zone = zone;
      moveRobotToZone(robotKey, zone);
      syncUIFromState();
      recalculate();
    });
  });
});

// Buddy Toggles
document.querySelectorAll('.buddy-toggle').forEach(toggle => {
  const robotKey = toggle.dataset.buddy;
  toggle.addEventListener('click', () => {
    if (robotKey === 'redR1' || robotKey === 'blueR1') {
      updateTooltip('R1/B1 sostiene buddies, no puede ser buddy');
      return;
    }
    
    if (STATE.robots[robotKey].buddy) {
      STATE.robots[robotKey].buddy = false;
    } else {
      if (robotKey === 'redR3') {
        STATE.robots[robotKey].buddy = document.getElementById('redR3Target').value || 'redR1';
      } else if (robotKey === 'blueR3') {
        STATE.robots[robotKey].buddy = document.getElementById('blueR3Target').value || 'blueR1';
      } else {
        STATE.robots[robotKey].buddy = robotKey.startsWith('red') ? 'redR1' : 'blueR1';
      }
    }
    syncUIFromState();
    recalculate();
  });
});

// Buddy Target Selects
const redR3Target = document.getElementById('redR3Target');
if (redR3Target) {
  redR3Target.addEventListener('change', (e) => {
    if (STATE.robots.redR3.buddy) {
      STATE.robots.redR3.buddy = e.target.value;
      recalculate();
    }
  });
}

const blueR3Target = document.getElementById('blueR3Target');
if (blueR3Target) {
  blueR3Target.addEventListener('change', (e) => {
    if (STATE.robots.blueR3.buddy) {
      STATE.robots.blueR3.buddy = e.target.value;
      recalculate();
    }
  });
}

// Steppers
document.querySelectorAll('.stepper-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const target = document.getElementById(btn.dataset.target);
    const delta = parseInt(btn.dataset.delta);
    let val = parseInt(target.value) + delta;
    val = Math.max(parseInt(target.min), Math.min(parseInt(target.max), val));
    target.value = val;
    enforceSumLimit(target);
    syncStateFromUI();
    recalculate();
  });

  // Long press for fast increment
  let interval;
  btn.addEventListener('mousedown', () => {
    interval = setInterval(() => btn.click(), 120);
  });
  btn.addEventListener('mouseup', () => clearInterval(interval));
  btn.addEventListener('mouseleave', () => clearInterval(interval));
});

// Direct input on steppers
document.querySelectorAll('.stepper-value').forEach(input => {
  input.addEventListener('change', () => {
    let val = parseInt(input.value) || 0;
    val = Math.max(parseInt(input.min), Math.min(parseInt(input.max), val));
    input.value = val;
    enforceSumLimit(input);
    syncStateFromUI();
    recalculate();
  });
});

// ── Sync Functions ──
function enforceSumLimit(changedInput) {
  const redInput = document.getElementById('redSup');
  const blueInput = document.getElementById('blueSup');
  const extInput = document.getElementById('extSup');

  let red = parseInt(redInput.value) || 0;
  let blue = parseInt(blueInput.value) || 0;
  let ext = parseInt(extInput.value) || 0;

  const total = red + blue + ext;
  if (total > 500) {
    if (changedInput.id === 'redSup') {
      redInput.value = 500 - blue - ext;
    } else if (changedInput.id === 'blueSup') {
      blueInput.value = 500 - red - ext;
    } else if (changedInput.id === 'extSup') {
      extInput.value = 500 - red - blue;
    }
  }
}

function syncStateFromUI() {
  STATE.suppression.red = parseInt(document.getElementById('redSup').value) || 0;
  STATE.suppression.blue = parseInt(document.getElementById('blueSup').value) || 0;
  STATE.extinguisher = parseInt(document.getElementById('extSup').value) || 0;
}

function syncUIFromState() {
  // Zone selectors
  Object.keys(STATE.robots).forEach(key => {
    const selector = document.querySelector(`.zone-selector[data-robot="${key}"]`);
    if (!selector) return;
    selector.querySelectorAll('.zone-opt').forEach(opt => {
      opt.className = 'zone-opt';
      if (opt.dataset.zone === STATE.robots[key].zone) {
        opt.classList.add('active-' + opt.dataset.zone);
      }
    });

    // Buddy toggles
    const buddyToggle = document.querySelector(`.buddy-toggle[data-buddy="${key}"]`);
    if (buddyToggle) {
      buddyToggle.classList.toggle('active', !!STATE.robots[key].buddy);
    }

    // Target selects show/hide and sync
    if (key === 'redR3' || key === 'blueR3') {
      const targetSelect = document.getElementById(key + 'Target');
      if (targetSelect) {
        if (STATE.robots[key].buddy) {
          targetSelect.style.display = 'block';
          targetSelect.value = STATE.robots[key].buddy;
        } else {
          targetSelect.style.display = 'none';
        }
      }
    }
  });

  // Stepper values
  document.getElementById('redSup').value = STATE.suppression.red;
  document.getElementById('blueSup').value = STATE.suppression.blue;
  document.getElementById('extSup').value = STATE.extinguisher;
}

// ── 8. PRESETS ──────────────────────────────────────────────────
const PRESETS = {
  tania_0: {
    name: "Tania: Peor Escenario (Buen Robot)",
    desc: "Robot en Z3 + 1 buddy colgado en Z3. 65 pelotas supresión roja. Total = 129 pts.",
    red: 65, blue: 0, ext: 0,
    robots: { redR1: 'z3', redR2: 'z3', redR3: 'none', blueR1: 'none', blueR2: 'none', blueR3: 'none' },
    buddies: { redR2: true }
  },
  tania_1: {
    name: "Tania: Mismo + Rivales colgados",
    desc: "Robot + buddy en Z3 + 3 rivales en Z3 (Coopertición 5 = +25). Total = 154 pts.",
    red: 65, blue: 0, ext: 0,
    robots: { redR1: 'z3', redR2: 'z3', redR3: 'none', blueR1: 'z3', blueR2: 'z3', blueR3: 'z3' },
    buddies: { redR2: true }
  },
  tania_2: {
    name: "Tania: Mejor Escenario",
    desc: "225 sup rojas, 50 ext, 6 robots Z3, doble buddy por alianza. Total = 568 pts.",
    red: 225, blue: 225, ext: 50,
    robots: { redR1: 'z3', redR2: 'z3', redR3: 'z3', blueR1: 'z3', blueR2: 'z3', blueR3: 'z3' },
    buddies: { redR2: true, redR3: true, blueR2: true, blueR3: true }
  },
  moncada_0: {
    name: "Moncada: Peor Escenario",
    desc: "60 sup, 50 ext. R1+buddy Z3, R3 Contact. Total = 174 pts.",
    red: 60, blue: 0, ext: 50,
    robots: { redR1: 'z3', redR2: 'z3', redR3: 'contact', blueR1: 'none', blueR2: 'none', blueR3: 'none' },
    buddies: { redR2: true }
  },
  moncada_1: {
    name: "Moncada: Mismo + Rivales",
    desc: "Igual + 3 rivales en Z3 (Coopertición 5 = +25). Total = 199 pts.",
    red: 60, blue: 0, ext: 50,
    robots: { redR1: 'z3', redR2: 'z3', redR3: 'contact', blueR1: 'z3', blueR2: 'z3', blueR3: 'z3' },
    buddies: { redR2: true }
  },
  moncada_2: {
    name: "Moncada: 2do Mejor",
    desc: "120 sup, 90 ext. 3 aliados Z3 (1 buddy). Total = 343 pts.",
    red: 120, blue: 0, ext: 90,
    robots: { redR1: 'z3', redR2: 'z3', redR3: 'z3', blueR1: 'none', blueR2: 'none', blueR3: 'none' },
    buddies: { redR2: true }
  },
  moncada_3: {
    name: "Moncada: Mejor Escenario",
    desc: "120 sup, 90 ext. 6 robots Z3 (Coopertición = +40). Total = 383 pts.",
    red: 120, blue: 120, ext: 90,
    robots: { redR1: 'z3', redR2: 'z3', redR3: 'z3', blueR1: 'z3', blueR2: 'z3', blueR3: 'z3' },
    buddies: { redR2: true, blueR2: true }
  },
  jhon_0: {
    name: "Jhon: Peor Escenario",
    desc: "85 sup, 25 ext. 1 aliado + 3 rivales Z3 (Coopt 4 = +10). Total = 146 pts.",
    red: 85, blue: 0, ext: 25,
    robots: { redR1: 'z3', redR2: 'none', redR3: 'none', blueR1: 'z3', blueR2: 'z3', blueR3: 'z3' },
    buddies: {}
  },
  jhon_1: {
    name: "Jhon: Mejor Escenario",
    desc: "85 sup, 25 ext. 6 robots Z3, doble buddy. Total = 277 pts.",
    red: 85, blue: 85, ext: 25,
    robots: { redR1: 'z3', redR2: 'z3', redR3: 'z3', blueR1: 'z3', blueR2: 'z3', blueR3: 'z3' },
    buddies: { redR2: true, redR3: true, blueR2: true, blueR3: true }
  },
  team4_0: {
    name: "Sergio: Peor Escenario",
    desc: "130 sup, 35 ext. R1 Z2, R2 Z1, R3 Contact. Total = 211 pts.",
    red: 130, blue: 0, ext: 35,
    robots: { redR1: 'z2', redR2: 'z1', redR3: 'contact', blueR1: 'none', blueR2: 'none', blueR3: 'none' },
    buddies: {}
  },
  team4_1: {
    name: "Sergio: Mejor Escenario",
    desc: "245 sup, 65 ext. Red: 2xZ3(1 buddy)+Z2. Blue: Z2+2xZ1. Total = 531 pts.",
    red: 245, blue: 150, ext: 65,
    robots: { redR1: 'z3', redR2: 'z3', redR3: 'z2', blueR1: 'z2', blueR2: 'z1', blueR3: 'z1' },
    buddies: { redR2: true }
  }
};

const presetSelect = document.getElementById('presetSelect');
const presetDesc = document.getElementById('presetDesc');

// Custom dropdown elements
const customDropdown = document.getElementById('customPresetDropdown');
const dropdownTrigger = document.getElementById('dropdownTrigger');
const dropdownSelectedValue = document.getElementById('dropdownSelectedValue');
const dropdownItems = customDropdown.querySelectorAll('.dropdown-item');

// Toggle dropdown menu
dropdownTrigger.addEventListener('click', (e) => {
  e.stopPropagation();
  customDropdown.classList.toggle('open');
});

// Dropdown item selection
dropdownItems.forEach(item => {
  item.addEventListener('click', (e) => {
    e.stopPropagation();
    const val = item.dataset.value;
    const text = item.textContent;

    // Update selection classes
    dropdownItems.forEach(i => i.classList.remove('selected'));
    item.classList.add('selected');

    // Update trigger text
    dropdownSelectedValue.textContent = text;
    customDropdown.classList.remove('open');

    // Update native select and trigger event
    presetSelect.value = val;
    presetSelect.dispatchEvent(new Event('change'));
  });
});

// Close dropdown when clicking outside
document.addEventListener('click', () => {
  customDropdown.classList.remove('open');
});

// Helper to select preset in the custom dropdown visually
function syncCustomDropdown(value) {
  dropdownItems.forEach(item => {
    if (item.dataset.value === value) {
      item.classList.add('selected');
      dropdownSelectedValue.textContent = item.textContent;
    } else {
      item.classList.remove('selected');
    }
  });
  if (!value) {
    dropdownSelectedValue.textContent = '— Seleccionar escenario —';
  }
}

presetSelect.addEventListener('change', () => {
  const preset = PRESETS[presetSelect.value];
  if (!preset) return;
  applyPreset(preset);
});

function applyPreset(preset) {
  // Reset all
  Object.keys(STATE.robots).forEach(key => {
    STATE.robots[key].zone = preset.robots[key] || 'none';
    
    const hasBuddy = preset.buddies?.[key] || false;
    if (hasBuddy) {
      if (typeof hasBuddy === 'string') {
        STATE.robots[key].buddy = hasBuddy;
      } else {
        // Fallback: connect to default R1/B1
        STATE.robots[key].buddy = key.startsWith('red') ? 'redR1' : 'blueR1';
      }
    } else {
      STATE.robots[key].buddy = false;
    }
  });

  STATE.suppression.red = preset.red;
  STATE.suppression.blue = preset.blue;
  STATE.extinguisher = preset.ext;

  // Move robots to positions
  Object.keys(STATE.robots).forEach(key => {
    moveRobotToZone(key, STATE.robots[key].zone);
  });

  // Sync custom dropdown visually
  syncCustomDropdown(presetSelect.value);

  syncUIFromState();
  recalculate();
  presetDesc.textContent = preset.desc;
}

// ── 9. TIMER ────────────────────────────────────────────────────
let timerSeconds = 150; // 2:30
let timerRunning = false;
let timerInterval = null;

const timerDisplay = document.getElementById('timerDisplay');
const timerFill = document.getElementById('timerFill');
const timerStartBtn = document.getElementById('timerStartBtn');
const timerResetBtn = document.getElementById('timerResetBtn');

function formatTime(sec) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function updateTimerUI() {
  timerDisplay.textContent = formatTime(timerSeconds);
  const pct = (timerSeconds / 150) * 100;
  timerFill.style.width = pct + '%';

  // Color states
  timerDisplay.className = 'timer-display';
  timerFill.className = 'timer-progress-fill';

  if (timerSeconds <= 10) {
    timerDisplay.classList.add('critical');
    timerFill.classList.add('critical');
  } else if (timerSeconds <= 30) {
    timerDisplay.classList.add('warning');
    timerFill.classList.add('warning');
  }
}

timerStartBtn.addEventListener('click', () => {
  if (timerRunning) {
    // Pause
    clearInterval(timerInterval);
    timerRunning = false;
    timerStartBtn.textContent = '▶ START';
    timerStartBtn.classList.remove('running');
  } else {
    // Start
    if (timerSeconds <= 0) timerSeconds = 150;
    timerRunning = true;
    timerStartBtn.textContent = '⏸ PAUSE';
    timerStartBtn.classList.add('running');

    timerInterval = setInterval(() => {
      timerSeconds--;
      updateTimerUI();

      if (timerSeconds <= 0) {
        clearInterval(timerInterval);
        timerRunning = false;
        timerStartBtn.textContent = '▶ START';
        timerStartBtn.classList.remove('running');
        updateTooltip('⏱ ¡Fin del partido!');
      } else if (timerSeconds === 30) {
        updateTooltip('⚠ ¡Últimos 30 segundos!');
      } else if (timerSeconds === 10) {
        updateTooltip('🚨 ¡10 SEGUNDOS!');
      }
    }, 1000);
  }
});

timerResetBtn.addEventListener('click', () => {
  clearInterval(timerInterval);
  timerRunning = false;
  timerSeconds = 150;
  timerStartBtn.textContent = '▶ START';
  timerStartBtn.classList.remove('running');
  updateTimerUI();
});

updateTimerUI();

// ── 10. HUD BUTTONS ─────────────────────────────────────────────

// Heatmap toggle
document.getElementById('hudHeatmap').addEventListener('click', function() {
  heatmapOn = !heatmapOn;
  this.classList.toggle('active', heatmapOn);
});

// Reset field
document.getElementById('hudReset').addEventListener('click', resetAll);

// Export PNG
document.getElementById('hudExport').addEventListener('click', () => {
  // Create a composite canvas with scoreboard info
  const exportCanvas = document.createElement('canvas');
  const ecs = 800;
  exportCanvas.width = ecs;
  exportCanvas.height = ecs + 100;
  const ectx = exportCanvas.getContext('2d');

  // Background
  ectx.fillStyle = '#0a0c14';
  ectx.fillRect(0, 0, ecs, ecs + 100);

  // Draw field
  ectx.drawImage(canvas, 0, 0, ecs, ecs);

  // Scoreboard bar
  ectx.fillStyle = 'rgba(14,16,24,0.95)';
  ectx.fillRect(0, ecs, ecs, 100);

  // Red score
  ectx.fillStyle = '#e83048';
  ectx.font = 'bold 28px Orbitron';
  ectx.textAlign = 'left';
  ectx.fillText(`RED: ${document.getElementById('redTotalScore').textContent}`, 20, ecs + 40);

  // Blue score
  ectx.fillStyle = '#3377ff';
  ectx.textAlign = 'right';
  ectx.fillText(`BLUE: ${document.getElementById('blueTotalScore').textContent}`, ecs - 20, ecs + 40);

  // Global
  ectx.fillStyle = '#ffd700';
  ectx.font = 'bold 14px Montserrat';
  ectx.textAlign = 'center';
  ectx.fillText(`GLOBAL: Ext ${STATE.extinguisher} | Coopt ${document.getElementById('globalCooptDisplay').textContent}`, ecs / 2, ecs + 38);

  // Watermark
  ectx.fillStyle = 'rgba(255,255,255,0.3)';
  ectx.font = '11px Poppins';
  ectx.fillText('Team Colombia — FGC 2026 Simulator', ecs / 2, ecs + 80);

  // Download
  const link = document.createElement('a');
  link.download = `FGC2026_Sim_${new Date().toISOString().slice(0, 16)}.png`;
  link.href = exportCanvas.toDataURL('image/png');
  link.click();

  updateTooltip('📷 Imagen exportada');
});

// Replay Animation
document.getElementById('hudReplay').addEventListener('click', () => {
  updateTooltip('▶ Reproduciendo animación de partida...');

  // Reset all robots to base
  Object.keys(ROBOT_POS).forEach(key => {
    ROBOT_POS[key].x = ROBOT_POS[key].baseX;
    ROBOT_POS[key].y = ROBOT_POS[key].baseY;
    STATE.robots[key].zone = 'none';
    STATE.robots[key].buddy = false;
  });
  STATE.suppression.red = 0;
  STATE.suppression.blue = 0;
  STATE.extinguisher = 0;
  syncUIFromState();
  recalculate();

  // Animate robots moving up then climbing
  const sequence = [
    { delay: 500, action: () => { STATE.suppression.red = 30; document.getElementById('redSup').value = 30; recalculate(); updateTooltip('🔥 Recolectando wildfires...'); } },
    { delay: 1200, action: () => { STATE.suppression.red = 80; STATE.suppression.blue = 40; document.getElementById('redSup').value = 80; document.getElementById('blueSup').value = 40; recalculate(); } },
    { delay: 2000, action: () => { STATE.extinguisher = 20; document.getElementById('extSup').value = 20; recalculate(); updateTooltip('🧯 Humano depositando en extinguidor...'); } },
    { delay: 2800, action: () => { moveRobotToZone('redR1', 'z1'); updateTooltip('⬆ Robots comenzando a escalar...'); } },
    { delay: 3200, action: () => { moveRobotToZone('blueR1', 'z1'); } },
    { delay: 3600, action: () => { moveRobotToZone('redR1', 'z2'); } },
    { delay: 4000, action: () => { moveRobotToZone('redR2', 'z1'); moveRobotToZone('blueR1', 'z2'); } },
    { delay: 4500, action: () => { moveRobotToZone('redR1', 'z3'); updateTooltip('🏆 ¡R1 alcanza Zona 3!'); } },
    { delay: 5000, action: () => { STATE.robots.redR2.buddy = 'redR1'; moveRobotToZone('redR2', 'z3'); syncUIFromState(); recalculate(); updateTooltip('🔗 ¡Buddy Climb activado!'); } },
    { delay: 5500, action: () => { moveRobotToZone('blueR1', 'z3'); syncUIFromState(); recalculate(); updateTooltip('▶ Replay completo'); } }
  ];

  sequence.forEach(step => {
    setTimeout(step.action, step.delay);
  });
});

// ── 11. LEADERBOARD ─────────────────────────────────────────────
function loadLeaderboard() {
  const data = JSON.parse(localStorage.getItem('fgc2026_leaderboard') || '[]');
  return data;
}

function saveToLeaderboard(entry) {
  const data = loadLeaderboard();
  data.push(entry);
  data.sort((a, b) => b.total - a.total);
  localStorage.setItem('fgc2026_leaderboard', JSON.stringify(data.slice(0, 20)));
  renderLeaderboard();
}

function renderLeaderboard() {
  const data = loadLeaderboard();
  const card = document.getElementById('leaderboardCard');
  const tbody = document.getElementById('leaderboardBody');

  if (data.length === 0) {
    card.style.display = 'none';
    return;
  }

  card.style.display = 'flex';
  tbody.innerHTML = data.map((e, i) => `
    <tr>
      <td class="lb-rank">${i + 1}</td>
      <td>${e.name}</td>
      <td style="color:var(--red-light)">${e.red}</td>
      <td style="color:var(--blue-light)">${e.blue}</td>
      <td class="lb-score">${e.total}</td>
    </tr>
  `).join('');
}

document.getElementById('btnSaveConfig').addEventListener('click', () => {
  const redScore = parseInt(document.getElementById('redTotalScore').textContent) || 0;
  const blueScore = parseInt(document.getElementById('blueTotalScore').textContent) || 0;
  const name = prompt('Nombre para esta configuración:', `Config ${new Date().toLocaleTimeString()}`);
  if (!name) return;

  saveToLeaderboard({
    name,
    red: redScore,
    blue: blueScore,
    total: redScore + blueScore,
    timestamp: Date.now()
  });

  updateTooltip('💾 Configuración guardada al leaderboard');
});

document.getElementById('btnClearLeaderboard').addEventListener('click', () => {
  if (confirm('¿Borrar todo el historial de configuraciones?')) {
    localStorage.removeItem('fgc2026_leaderboard');
    renderLeaderboard();
    updateTooltip('🗑 Historial borrado');
  }
});

renderLeaderboard();

// ── 12. RESET ───────────────────────────────────────────────────
function resetAll() {
  Object.keys(STATE.robots).forEach(key => {
    STATE.robots[key].zone = 'none';
    STATE.robots[key].buddy = false;
    ROBOT_POS[key].x = ROBOT_POS[key].baseX;
    ROBOT_POS[key].y = ROBOT_POS[key].baseY;
  });

  STATE.suppression.red = 0;
  STATE.suppression.blue = 0;
  STATE.extinguisher = 0;

  syncUIFromState();
  recalculate();
  presetSelect.value = '';
  syncCustomDropdown('');
  presetDesc.textContent = 'Selecciona una estrategia para cargarla automáticamente en el simulador.';
  updateTooltip('↺ Campo reiniciado');
}

function checkSimulationRedirect() {
  const stored = localStorage.getItem('fgc_match_result');
  if (!stored) return;

  try {
    const data = JSON.parse(stored);
    
    // Apply scores
    STATE.suppression.red = data.redBalls || 0;
    STATE.suppression.blue = data.blueBalls || 0;
    STATE.extinguisher = data.extBalls || 0;

    // Apply robot zones & buddy status
    const keys = ['redR1', 'redR2', 'redR3', 'blueR1', 'blueR2', 'blueR3'];
    keys.forEach(key => {
      if (data.robots && data.robots[key]) {
        STATE.robots[key].zone = data.robots[key];
        const target = getZoneY(data.robots[key], key);
        ROBOT_POS[key].x = target.x;
        ROBOT_POS[key].y = target.y;
      }
      if (data.buddies && data.buddies[key] !== undefined) {
        STATE.robots[key].buddy = data.buddies[key];
      }
    });

    // Sync UI elements and calculate
    syncUIFromState();
    recalculate();

    // Clear from localStorage
    localStorage.removeItem('fgc_match_result');
    
    setTimeout(() => {
      updateTooltip('📈 ¡Resultados del simulador cargados en la calculadora!');
    }, 500);
  } catch (e) {
    console.error("Error loading simulation results:", e);
  }
}

// ── 13. INITIALIZATION ──────────────────────────────────────────
syncUIFromState();
recalculate();
checkSimulationRedirect();

// Touch support for mobile
canvas.addEventListener('touchstart', (e) => {
  e.preventDefault();
  const touch = e.touches[0];
  const mouseEvent = new MouseEvent('mousedown', {
    clientX: touch.clientX,
    clientY: touch.clientY,
    button: 0
  });
  canvas.dispatchEvent(mouseEvent);
}, { passive: false });

canvas.addEventListener('touchmove', (e) => {
  e.preventDefault();
  const touch = e.touches[0];
  const mouseEvent = new MouseEvent('mousemove', {
    clientX: touch.clientX,
    clientY: touch.clientY
  });
  canvas.dispatchEvent(mouseEvent);
}, { passive: false });

canvas.addEventListener('touchend', (e) => {
  e.preventDefault();
  window.dispatchEvent(new MouseEvent('mouseup'));
}, { passive: false });
