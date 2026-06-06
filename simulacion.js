/* ═══════════════════════════════════════════════════════════════
   FGC 2026 REAL-TIME SIMULATION ENGINE — Team Colombia
   Igniting Innovation — 2D Top-Down Game
   ═══════════════════════════════════════════════════════════════ */

// ── 1. CONSTANTS ────────────────────────────────────────────────
const FIELD_M = 7;          // Field size in meters
const CANVAS_BASE = 700;    // Base canvas pixels
const MATCH_DURATION = 150; // 2:30 in seconds
const TOTAL_BALLS = 500;
const BALL_RADIUS_M = 0.05; // 50mm radius
const ROBOT_SIZE_M = 0.45;  // ~45cm side
const PICKUP_RANGE_M = 0.55;
const SHOOT_BALL_SPEED = 6; // m/s for flying balls
const FRICTION = 0.96;
const BALL_PUSH_FORCE = 0.8;
const HP_RATE = 0.8;        // Human player processes 1 ball per ~1.25s

// Zone definitions (in meters, origin top-left)
const ZONES = {
  supRed:    { x: 0,    y: 0.3,  w: 1.0, h: 2.2 },
  supBlue:   { x: 6.0,  y: 0.3,  w: 1.0, h: 2.2 },
  extinguisher: { x: 2.8, y: 0, w: 1.4, h: 0.7 },
  fireShieldRed:  { x: 0,   y: 5.5, w: 1.3, h: 1.5 },
  fireShieldBlue: { x: 5.7, y: 5.5, w: 1.3, h: 1.5 },
  shootRedZone:   { x: 0,   y: 0.2, w: 1.8, h: 2.8 },
  shootBlueZone:  { x: 5.2, y: 0.2, w: 1.8, h: 2.8 },
  fsRedZone:      { x: 0,   y: 5.0, w: 1.8, h: 2.0 },
  fsBlueZone:     { x: 5.2, y: 5.0, w: 1.8, h: 2.0 },
};

// Colors
const COL = {
  fieldBg: '#0a0c14',
  gridLine: 'rgba(255,255,255,0.015)',
  ball: '#ff8c28',
  ballFlying: '#ffb347',
  redBot: '#e83048',
  redBotLight: '#ff5e6f',
  blueBot: '#3377ff',
  blueBotLight: '#5c9aff',
  playerHighlight: '#ffd700',
  supRed: 'rgba(232,48,72,0.12)',
  supBlue: 'rgba(51,119,255,0.12)',
  extZone: 'rgba(255,215,0,0.08)',
  fsRed: 'rgba(232,48,72,0.06)',
  fsBlue: 'rgba(51,119,255,0.06)',
};

// ── 2. GAME STATE ───────────────────────────────────────────────
let gamePhase = 'setup'; // 'setup' | 'countdown' | 'playing' | 'ended'
let matchTime = MATCH_DURATION;
let matchInterval = null;

// Configuration (from setup UI)
const CONFIG = {
  alliance: 'red',
  teamNumber: 1,
  specs: {
    moveSpeed: 1.5,
    pickupSpeed: 2.0,
    shotSpeed: 3.0,
    capacity: 12,
    accuracy: 80,
  },
  allyMultiplier: 0.8,
  rivalMultiplier: 0.8,
  hpAccuracy: 70,
};

// Score tracking
const SCORE = {
  redSup: 0,
  blueSup: 0,
  extinguisher: 0,
};

// Player stats
const PLAYER_STATS = {
  pickedUp: 0,
  shot: 0,
  hits: 0,
  misses: 0,
  distance: 0,
};

// Input state
const KEYS = {};
window.addEventListener('keydown', e => {
  KEYS[e.key.toLowerCase()] = true;
  if (e.key === ' ') e.preventDefault();
});
window.addEventListener('keyup', e => {
  KEYS[e.key.toLowerCase()] = false;
});

// ── 3. BALL SYSTEM ──────────────────────────────────────────────
let balls = [];

function initBalls() {
  balls = [];
  for (let i = 0; i < TOTAL_BALLS; i++) {
    balls.push({
      x: 1.0 + Math.random() * 5.0,
      y: 0.6 + Math.random() * 5.5,
      vx: (Math.random() - 0.5) * 0.1,
      vy: (Math.random() - 0.5) * 0.1,
      state: 'field', // 'field' | 'held' | 'flying' | 'scored_red' | 'scored_blue' | 'extinguished'
      owner: null,
      targetX: 0,
      targetY: 0,
    });
  }
}

// Spatial hash for O(n) ball queries
const GRID_CELL = 0.5;
let spatialGrid = {};

function rebuildSpatialGrid() {
  spatialGrid = {};
  balls.forEach((b, i) => {
    if (b.state !== 'field') return;
    const cx = Math.floor(b.x / GRID_CELL);
    const cy = Math.floor(b.y / GRID_CELL);
    const key = `${cx},${cy}`;
    if (!spatialGrid[key]) spatialGrid[key] = [];
    spatialGrid[key].push(i);
  });
}

function getNearbyBalls(x, y, range) {
  const results = [];
  const minCx = Math.floor((x - range) / GRID_CELL);
  const maxCx = Math.floor((x + range) / GRID_CELL);
  const minCy = Math.floor((y - range) / GRID_CELL);
  const maxCy = Math.floor((y + range) / GRID_CELL);
  for (let cx = minCx; cx <= maxCx; cx++) {
    for (let cy = minCy; cy <= maxCy; cy++) {
      const key = `${cx},${cy}`;
      if (spatialGrid[key]) {
        spatialGrid[key].forEach(idx => {
          const b = balls[idx];
          const dx = b.x - x;
          const dy = b.y - y;
          if (dx * dx + dy * dy <= range * range) {
            results.push(idx);
          }
        });
      }
    }
  }
  return results;
}

function updateBalls(dt) {
  balls.forEach(b => {
    if (b.state === 'field') {
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.vx *= FRICTION;
      b.vy *= FRICTION;
      // Wall bounce
      if (b.x < BALL_RADIUS_M) { b.x = BALL_RADIUS_M; b.vx = Math.abs(b.vx) * 0.5; }
      if (b.x > FIELD_M - BALL_RADIUS_M) { b.x = FIELD_M - BALL_RADIUS_M; b.vx = -Math.abs(b.vx) * 0.5; }
      if (b.y < BALL_RADIUS_M) { b.y = BALL_RADIUS_M; b.vy = Math.abs(b.vy) * 0.5; }
      if (b.y > FIELD_M - BALL_RADIUS_M) { b.y = FIELD_M - BALL_RADIUS_M; b.vy = -Math.abs(b.vy) * 0.5; }
    } else if (b.state === 'flying') {
      const dx = b.targetX - b.x;
      const dy = b.targetY - b.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < 0.15) {
        // Arrived at target — check accuracy
        const robot = robots.find(r => r.id === b.owner);
        const acc = robot ? robot.specs.accuracy : 80;
        if (Math.random() * 100 < acc) {
          // Hit!
          if (b.targetZone === 'supRed') {
            b.state = 'scored_red';
            SCORE.redSup++;
          } else if (b.targetZone === 'supBlue') {
            b.state = 'scored_blue';
            SCORE.blueSup++;
          }
          if (robot && robot.isPlayer) PLAYER_STATS.hits++;
        } else {
          // Miss — bounce back onto field
          b.state = 'field';
          b.vx = (Math.random() - 0.5) * 3;
          b.vy = (Math.random() - 0.5) * 3 + 1;
          if (robot && robot.isPlayer) PLAYER_STATS.misses++;
        }
      } else {
        const speed = SHOOT_BALL_SPEED * dt;
        b.x += (dx / dist) * speed;
        b.y += (dy / dist) * speed;
      }
    }
  });
}

// ── 4. ROBOT CLASS ──────────────────────────────────────────────
class Robot {
  constructor(id, alliance, teamNum, isPlayer) {
    this.id = id;
    this.alliance = alliance;
    this.teamNum = teamNum;
    this.isPlayer = isPlayer;
    this.x = 0;
    this.y = 0;
    this.angle = 0;
    this.vx = 0;
    this.vy = 0;
    this.inventory = [];
    this.specs = { moveSpeed: 1.5, pickupSpeed: 2, shotSpeed: 3, capacity: 12, accuracy: 80 };
    this.state = 'idle'; // 'idle' | 'moving' | 'picking' | 'shooting'
    this.pickupCooldown = 0;
    this.shootCooldown = 0;
    this.aiState = 'seek_balls';
    this.aiTarget = null;
    this.aiWait = 0;
    this.prevX = 0;
    this.prevY = 0;
  }

  getShootTarget() {
    if (this.alliance === 'red') {
      return { x: 0.5, y: 1.4, zone: 'supRed' };
    } else {
      return { x: 6.5, y: 1.4, zone: 'supBlue' };
    }
  }

  getFireShieldTarget() {
    if (this.alliance === 'red') {
      return { x: 0.65, y: 6.2 };
    } else {
      return { x: 6.35, y: 6.2 };
    }
  }

  isInShootZone() {
    const z = this.alliance === 'red' ? ZONES.shootRedZone : ZONES.shootBlueZone;
    return this.x >= z.x && this.x <= z.x + z.w && this.y >= z.y && this.y <= z.y + z.h;
  }

  isInFireShieldZone() {
    const z = this.alliance === 'red' ? ZONES.fsRedZone : ZONES.fsBlueZone;
    return this.x >= z.x && this.x <= z.x + z.w && this.y >= z.y && this.y <= z.y + z.h;
  }
}

let robots = [];
let playerRobot = null;

function initRobots() {
  robots = [];
  const pa = CONFIG.alliance;
  const ea = pa === 'red' ? 'blue' : 'red';

  // Player's alliance positions (left side for red, right for blue)
  const pStartX = pa === 'red' ? 0.35 : FIELD_M - 0.35;
  const eStartX = ea === 'red' ? 0.35 : FIELD_M - 0.35;

  const teamPositions = [
    { y: FIELD_M * 0.75 },
    { y: FIELD_M * 0.85 },
    { y: FIELD_M * 0.95 - 0.1 },
  ];

  // Create player's alliance robots
  for (let i = 0; i < 3; i++) {
    const isP = (i + 1 === CONFIG.teamNumber);
    const r = new Robot(
      `${pa}R${i + 1}`,
      pa,
      i + 1,
      isP
    );
    r.x = pStartX;
    r.y = teamPositions[i].y;
    r.angle = pa === 'red' ? 0 : Math.PI;
    r.prevX = r.x;
    r.prevY = r.y;

    if (isP) {
      r.specs = { ...CONFIG.specs };
      playerRobot = r;
    } else {
      r.specs = {
        moveSpeed: CONFIG.specs.moveSpeed * CONFIG.allyMultiplier,
        pickupSpeed: CONFIG.specs.pickupSpeed * CONFIG.allyMultiplier,
        shotSpeed: CONFIG.specs.shotSpeed * CONFIG.allyMultiplier,
        capacity: Math.max(3, Math.round(CONFIG.specs.capacity * CONFIG.allyMultiplier)),
        accuracy: Math.round(CONFIG.specs.accuracy * CONFIG.allyMultiplier),
      };
    }
    robots.push(r);
  }

  // Create enemy alliance robots
  for (let i = 0; i < 3; i++) {
    const r = new Robot(
      `${ea}R${i + 1}`,
      ea,
      i + 1,
      false
    );
    r.x = eStartX;
    r.y = teamPositions[i].y;
    r.angle = ea === 'red' ? 0 : Math.PI;
    r.prevX = r.x;
    r.prevY = r.y;
    r.specs = {
      moveSpeed: CONFIG.specs.moveSpeed * CONFIG.rivalMultiplier,
      pickupSpeed: CONFIG.specs.pickupSpeed * CONFIG.rivalMultiplier,
      shotSpeed: CONFIG.specs.shotSpeed * CONFIG.rivalMultiplier,
      capacity: Math.max(3, Math.round(CONFIG.specs.capacity * CONFIG.rivalMultiplier)),
      accuracy: Math.round(CONFIG.specs.accuracy * CONFIG.rivalMultiplier),
    };
    robots.push(r);
  }
}

// ── 5. PLAYER INPUT ─────────────────────────────────────────────
function updatePlayerInput(dt) {
  if (!playerRobot || gamePhase !== 'playing') return;
  const r = playerRobot;
  const sp = r.specs.moveSpeed;
  let moveX = 0, moveY = 0;

  if (KEYS['w'] || KEYS['arrowup']) moveY = -1;
  if (KEYS['s'] || KEYS['arrowdown']) moveY = 1;
  if (KEYS['a'] || KEYS['arrowleft']) moveX = -1;
  if (KEYS['d'] || KEYS['arrowright']) moveX = 1;

  // Normalize diagonal movement
  if (moveX !== 0 && moveY !== 0) {
    const inv = 1 / Math.sqrt(2);
    moveX *= inv;
    moveY *= inv;
  }

  r.prevX = r.x;
  r.prevY = r.y;

  if (moveX !== 0 || moveY !== 0) {
    r.x += moveX * sp * dt;
    r.y += moveY * sp * dt;
    r.angle = Math.atan2(moveY, moveX);
    r.state = 'moving';
  } else {
    r.state = 'idle';
  }

  // Clamp to field
  const half = ROBOT_SIZE_M / 2;
  r.x = Math.max(half, Math.min(FIELD_M - half, r.x));
  r.y = Math.max(half, Math.min(FIELD_M - half, r.y));

  // Track distance
  const dx = r.x - r.prevX;
  const dy = r.y - r.prevY;
  PLAYER_STATS.distance += Math.sqrt(dx * dx + dy * dy);

  // Push nearby balls
  pushBallsFromRobot(r);

  // Pickup (P key)
  r.pickupCooldown = Math.max(0, r.pickupCooldown - dt);
  if (KEYS['p'] && r.inventory.length < r.specs.capacity && r.pickupCooldown <= 0) {
    const nearby = getNearbyBalls(r.x, r.y, PICKUP_RANGE_M);
    if (nearby.length > 0) {
      const idx = nearby[0];
      balls[idx].state = 'held';
      balls[idx].owner = r.id;
      r.inventory.push(idx);
      r.state = 'picking';
      r.pickupCooldown = 1.0 / r.specs.pickupSpeed;
      PLAYER_STATS.pickedUp++;
    }
  }

  // Shoot (Space)
  r.shootCooldown = Math.max(0, r.shootCooldown - dt);
  if (KEYS[' '] && r.inventory.length > 0 && r.shootCooldown <= 0) {
    if (r.isInShootZone()) {
      const ballIdx = r.inventory.shift();
      const target = r.getShootTarget();
      const b = balls[ballIdx];
      b.state = 'flying';
      b.x = r.x;
      b.y = r.y;
      b.targetX = target.x;
      b.targetY = target.y;
      b.targetZone = target.zone;
      b.owner = r.id;
      r.shootCooldown = 1.0 / r.specs.shotSpeed;
      r.state = 'shooting';
      PLAYER_STATS.shot++;
    } else if (r.isInFireShieldZone()) {
      // Deposit to fire shield → human player handles it
      const ballIdx = r.inventory.shift();
      balls[ballIdx].state = 'held'; // temporarily
      handleHumanPlayer(ballIdx, r.alliance);
      r.shootCooldown = 1.0 / r.specs.shotSpeed;
      PLAYER_STATS.shot++;
    }
  }
}

// ── 6. BOT AI ───────────────────────────────────────────────────
function updateBotAI(robot, dt) {
  if (robot.isPlayer || gamePhase !== 'playing') return;
  const r = robot;
  r.pickupCooldown = Math.max(0, r.pickupCooldown - dt);
  r.shootCooldown = Math.max(0, r.shootCooldown - dt);
  r.aiWait = Math.max(0, r.aiWait - dt);

  if (r.aiWait > 0) return;

  switch (r.aiState) {
    case 'seek_balls': {
      if (r.inventory.length >= r.specs.capacity) {
        r.aiState = Math.random() < 0.75 ? 'seek_suppression' : 'seek_fireshield';
        break;
      }
      // Find nearest field ball
      const nearby = getNearbyBalls(r.x, r.y, PICKUP_RANGE_M);
      if (nearby.length > 0 && r.pickupCooldown <= 0) {
        const idx = nearby[0];
        balls[idx].state = 'held';
        balls[idx].owner = r.id;
        r.inventory.push(idx);
        r.pickupCooldown = 1.0 / r.specs.pickupSpeed;
        r.state = 'picking';
        if (r.inventory.length >= r.specs.capacity) {
          r.aiState = Math.random() < 0.75 ? 'seek_suppression' : 'seek_fireshield';
        }
        break;
      }
      // Move toward nearest ball cluster
      let bestDist = Infinity;
      let bestX = FIELD_M / 2, bestY = FIELD_M / 2;
      const searchRange = 4;
      const candidates = getNearbyBalls(r.x, r.y, searchRange);
      if (candidates.length > 0) {
        const idx = candidates[0];
        bestX = balls[idx].x;
        bestY = balls[idx].y;
      } else {
        // Wander toward center
        bestX = 1 + Math.random() * 5;
        bestY = 1 + Math.random() * 5;
      }
      moveToward(r, bestX, bestY, dt);
      break;
    }

    case 'seek_suppression': {
      const target = r.getShootTarget();
      if (r.isInShootZone() && r.inventory.length > 0) {
        r.aiState = 'shooting';
      } else {
        moveToward(r, target.x + 0.5, target.y + 0.5, dt);
      }
      break;
    }

    case 'seek_fireshield': {
      const target = r.getFireShieldTarget();
      if (r.isInFireShieldZone() && r.inventory.length > 0) {
        r.aiState = 'depositing_fs';
      } else {
        moveToward(r, target.x, target.y, dt);
      }
      break;
    }

    case 'shooting': {
      if (r.inventory.length === 0) {
        r.aiState = 'seek_balls';
        r.aiWait = 0.3 + Math.random() * 0.5;
        break;
      }
      if (r.shootCooldown <= 0) {
        const ballIdx = r.inventory.shift();
        const target = r.getShootTarget();
        const b = balls[ballIdx];
        b.state = 'flying';
        b.x = r.x;
        b.y = r.y;
        b.targetX = target.x;
        b.targetY = target.y;
        b.targetZone = target.zone;
        b.owner = r.id;
        r.shootCooldown = 1.0 / r.specs.shotSpeed;
        r.state = 'shooting';
      }
      break;
    }

    case 'depositing_fs': {
      if (r.inventory.length === 0) {
        r.aiState = 'seek_balls';
        r.aiWait = 0.3 + Math.random() * 0.5;
        break;
      }
      if (r.shootCooldown <= 0) {
        const ballIdx = r.inventory.shift();
        handleHumanPlayer(ballIdx, r.alliance);
        r.shootCooldown = 1.0 / r.specs.shotSpeed;
        r.state = 'shooting';
      }
      break;
    }
  }
}

function moveToward(robot, tx, ty, dt) {
  const dx = tx - robot.x;
  const dy = ty - robot.y;
  const dist = Math.sqrt(dx * dx + dy * dy);
  if (dist < 0.1) return;

  const speed = robot.specs.moveSpeed * dt;
  robot.prevX = robot.x;
  robot.prevY = robot.y;
  robot.x += (dx / dist) * Math.min(speed, dist);
  robot.y += (dy / dist) * Math.min(speed, dist);
  robot.angle = Math.atan2(dy, dx);
  robot.state = 'moving';

  // Clamp
  const half = ROBOT_SIZE_M / 2;
  robot.x = Math.max(half, Math.min(FIELD_M - half, robot.x));
  robot.y = Math.max(half, Math.min(FIELD_M - half, robot.y));

  pushBallsFromRobot(robot);
}

function pushBallsFromRobot(robot) {
  const nearby = getNearbyBalls(robot.x, robot.y, ROBOT_SIZE_M * 0.7);
  nearby.forEach(idx => {
    const b = balls[idx];
    const dx = b.x - robot.x;
    const dy = b.y - robot.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist > 0.01) {
      const force = BALL_PUSH_FORCE / (dist + 0.1);
      b.vx += (dx / dist) * force * 0.016;
      b.vy += (dy / dist) * force * 0.016;
    }
  });
}

// ── 7. HUMAN PLAYER ─────────────────────────────────────────────
let hpRedQueue = [];
let hpBlueQueue = [];
let hpRedTimer = 0;
let hpBlueTimer = 0;

function handleHumanPlayer(ballIdx, alliance) {
  if (alliance === 'red') {
    hpRedQueue.push(ballIdx);
  } else {
    hpBlueQueue.push(ballIdx);
  }
}

function updateHumanPlayers(dt) {
  // Red HP
  hpRedTimer += dt;
  if (hpRedTimer >= (1 / HP_RATE) && hpRedQueue.length > 0) {
    hpRedTimer = 0;
    const idx = hpRedQueue.shift();
    if (Math.random() * 100 < CONFIG.hpAccuracy) {
      balls[idx].state = 'extinguished';
      SCORE.extinguisher++;
    } else {
      // Miss — ball returns to field
      balls[idx].state = 'field';
      balls[idx].x = 1 + Math.random() * 5;
      balls[idx].y = 5 + Math.random() * 1.5;
      balls[idx].vx = (Math.random() - 0.5) * 2;
      balls[idx].vy = -Math.random() * 2;
    }
  }

  // Blue HP
  hpBlueTimer += dt;
  if (hpBlueTimer >= (1 / HP_RATE) && hpBlueQueue.length > 0) {
    hpBlueTimer = 0;
    const idx = hpBlueQueue.shift();
    if (Math.random() * 100 < CONFIG.hpAccuracy) {
      balls[idx].state = 'extinguished';
      SCORE.extinguisher++;
    } else {
      balls[idx].state = 'field';
      balls[idx].x = 1 + Math.random() * 5;
      balls[idx].y = 5 + Math.random() * 1.5;
      balls[idx].vx = (Math.random() - 0.5) * 2;
      balls[idx].vy = -Math.random() * 2;
    }
  }
}

// ── 8. RENDERING ────────────────────────────────────────────────
let gameCanvas, gameCtx;
let setupCanvas, setupCtx;

// roundRect polyfill for older browsers
if (!CanvasRenderingContext2D.prototype.roundRect) {
  CanvasRenderingContext2D.prototype.roundRect = function(x, y, w, h, r) {
    if (typeof r === 'number') r = { tl: r, tr: r, br: r, bl: r };
    const radii = typeof r === 'object' ? r : { tl: r, tr: r, br: r, bl: r };
    const rad = radii.tl || radii || 0;
    this.moveTo(x + rad, y);
    this.lineTo(x + w - rad, y);
    this.quadraticCurveTo(x + w, y, x + w, y + rad);
    this.lineTo(x + w, y + h - rad);
    this.quadraticCurveTo(x + w, y + h, x + w - rad, y + h);
    this.lineTo(x + rad, y + h);
    this.quadraticCurveTo(x, y + h, x, y + h - rad);
    this.lineTo(x, y + rad);
    this.quadraticCurveTo(x, y, x + rad, y);
    this.closePath();
    return this;
  };
}

function initCanvases() {
  gameCanvas = document.getElementById('gameCanvas');
  gameCtx = gameCanvas.getContext('2d');
  setupCanvas = document.getElementById('setupCanvas');
  setupCtx = setupCanvas ? setupCanvas.getContext('2d') : null;
  // Don't resize game canvas at init — it's hidden (0 width)
}

function resizeGameCanvas() {
  if (!gameCanvas) return;
  const wrapper = gameCanvas.parentElement;
  const w = wrapper.clientWidth;
  if (w <= 0) return; // Guard: skip if hidden
  const h = w; // 1:1 aspect ratio
  const dpr = window.devicePixelRatio || 1;
  gameCanvas.width = w * dpr;
  gameCanvas.height = h * dpr;
  gameCanvas.style.width = w + 'px';
  gameCanvas.style.height = h + 'px';
  gameCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function S() {
  return parseFloat(gameCanvas.style.width) || CANVAS_BASE;
}

function mToP(m) {
  return (m / FIELD_M) * S();
}

function renderGame() {
  const s = S();
  const c = gameCtx;
  c.clearRect(0, 0, s, s);

  // Background
  c.fillStyle = COL.fieldBg;
  c.fillRect(0, 0, s, s);

  // Grid
  c.strokeStyle = COL.gridLine;
  c.lineWidth = 0.5;
  for (let i = 0; i <= 14; i++) {
    const p = (i / 14) * s;
    c.beginPath(); c.moveTo(p, 0); c.lineTo(p, s); c.stroke();
    c.beginPath(); c.moveTo(0, p); c.lineTo(s, p); c.stroke();
  }

  // Field border
  c.strokeStyle = 'rgba(255,255,255,0.08)';
  c.lineWidth = 2;
  c.strokeRect(1, 1, s - 2, s - 2);

  // Zones
  drawZone(c, ZONES.shootRedZone, 'rgba(232,48,72,0.06)', 'rgba(232,48,72,0.12)');
  drawZone(c, ZONES.shootBlueZone, 'rgba(51,119,255,0.06)', 'rgba(51,119,255,0.12)');
  drawZone(c, ZONES.fsRedZone, 'rgba(232,48,72,0.04)', 'rgba(232,48,72,0.08)');
  drawZone(c, ZONES.fsBlueZone, 'rgba(51,119,255,0.04)', 'rgba(51,119,255,0.08)');

  // Suppression Units
  drawSuppressionUnit(c, ZONES.supRed, COL.supRed, 'rgba(232,48,72,0.3)', 'SUP RED', SCORE.redSup);
  drawSuppressionUnit(c, ZONES.supBlue, COL.supBlue, 'rgba(51,119,255,0.3)', 'SUP BLUE', SCORE.blueSup);

  // Extinguisher
  drawExtinguisher(c);

  // Fire Shields
  drawFireShield(c, ZONES.fireShieldRed, 'rgba(232,48,72,0.08)', '🛡', 'RED');
  drawFireShield(c, ZONES.fireShieldBlue, 'rgba(51,119,255,0.08)', '🛡', 'BLUE');

  // Human Players (outside field)
  drawHumanPlayer(c, 'red');
  drawHumanPlayer(c, 'blue');

  // Guardrails (bottom)
  c.strokeStyle = 'rgba(255,255,255,0.12)';
  c.lineWidth = 3;
  c.beginPath();
  c.moveTo(mToP(1.5), mToP(FIELD_M) - 1);
  c.lineTo(mToP(5.5), mToP(FIELD_M) - 1);
  c.stroke();
  c.fillStyle = 'rgba(255,255,255,0.05)';
  c.font = `bold ${s * 0.012}px Montserrat`;
  c.textAlign = 'center';
  c.fillText('GUARDRAILS', mToP(3.5), mToP(FIELD_M) - 6);

  // Balls
  renderBalls(c);

  // Robots
  renderRobots(c);
}

function drawZone(c, zone, fill, stroke) {
  c.fillStyle = fill;
  c.strokeStyle = stroke;
  c.lineWidth = 1;
  c.setLineDash([4, 4]);
  c.fillRect(mToP(zone.x), mToP(zone.y), mToP(zone.w), mToP(zone.h));
  c.strokeRect(mToP(zone.x), mToP(zone.y), mToP(zone.w), mToP(zone.h));
  c.setLineDash([]);
}

function drawSuppressionUnit(c, zone, fill, textColor, label, count) {
  const px = mToP(zone.x);
  const py = mToP(zone.y);
  const pw = mToP(zone.w);
  const ph = mToP(zone.h);

  c.fillStyle = fill;
  c.fillRect(px, py, pw, ph);
  c.strokeStyle = textColor;
  c.lineWidth = 2;
  c.strokeRect(px, py, pw, ph);

  // Label
  c.fillStyle = textColor;
  c.font = `bold ${S() * 0.013}px Montserrat`;
  c.textAlign = 'center';
  c.fillText(label, px + pw / 2, py + 16);

  // Ball count
  c.font = `bold ${S() * 0.025}px Orbitron`;
  c.fillText(count.toString(), px + pw / 2, py + ph / 2 + 8);
}

function drawExtinguisher(c) {
  const z = ZONES.extinguisher;
  const px = mToP(z.x);
  const py = mToP(z.y);
  const pw = mToP(z.w);
  const ph = mToP(z.h);

  c.fillStyle = COL.extZone;
  c.strokeStyle = 'rgba(255,215,0,0.2)';
  c.lineWidth = 1.5;
  c.beginPath();
  c.roundRect(px, py, pw, ph, 6);
  c.fill();
  c.stroke();

  c.fillStyle = 'rgba(255,215,0,0.6)';
  c.font = `bold ${S() * 0.012}px Montserrat`;
  c.textAlign = 'center';
  c.fillText('🧯 EXTINGUISHER', px + pw / 2, py + ph / 2 + 3);
  c.font = `bold ${S() * 0.018}px Orbitron`;
  c.fillText(SCORE.extinguisher.toString(), px + pw / 2, py + ph - 6);
}

function drawFireShield(c, zone, color, icon, label) {
  const px = mToP(zone.x);
  const py = mToP(zone.y);
  const pw = mToP(zone.w);
  const ph = mToP(zone.h);

  c.fillStyle = color;
  c.fillRect(px, py, pw, ph);
  c.strokeStyle = color.replace('0.08', '0.2');
  c.lineWidth = 1;
  c.strokeRect(px, py, pw, ph);

  c.fillStyle = color.replace('0.08', '0.4');
  c.font = `${S() * 0.018}px sans-serif`;
  c.textAlign = 'center';
  c.fillText(icon, px + pw / 2, py + ph / 2 - 4);
  c.font = `bold ${S() * 0.009}px Montserrat`;
  c.fillText('FIRE SHIELD', px + pw / 2, py + ph / 2 + 12);
}

function drawHumanPlayer(c, alliance) {
  const isRed = alliance === 'red';
  const x = isRed ? -0.2 : FIELD_M + 0.2;
  const y = 6.3;
  const px = mToP(x);
  const py = mToP(y);
  const queue = isRed ? hpRedQueue : hpBlueQueue;

  // Face emoji
  c.font = `${S() * 0.03}px sans-serif`;
  c.textAlign = 'center';
  c.fillText('🧑', px, py);

  // Queue indicator
  if (queue.length > 0) {
    c.fillStyle = 'rgba(255,215,0,0.7)';
    c.font = `bold ${S() * 0.01}px Orbitron`;
    c.fillText(`${queue.length}`, px, py + 16);
  }

  // Label
  c.fillStyle = isRed ? 'rgba(232,48,72,0.3)' : 'rgba(51,119,255,0.3)';
  c.font = `${S() * 0.008}px Montserrat`;
  c.fillText('HUMAN', px, py - 14);
  c.fillText('PLAYER', px, py - 6);
}

function renderBalls(c) {
  const ballR = Math.max(2, mToP(BALL_RADIUS_M));
  balls.forEach(b => {
    if (b.state === 'field') {
      c.fillStyle = COL.ball;
      c.beginPath();
      c.arc(mToP(b.x), mToP(b.y), ballR, 0, Math.PI * 2);
      c.fill();
    } else if (b.state === 'flying') {
      // Trail
      c.strokeStyle = 'rgba(255,179,71,0.3)';
      c.lineWidth = 1;
      c.setLineDash([2, 2]);
      c.beginPath();
      c.moveTo(mToP(b.x), mToP(b.y));
      c.lineTo(mToP(b.targetX), mToP(b.targetY));
      c.stroke();
      c.setLineDash([]);

      c.fillStyle = COL.ballFlying;
      c.shadowColor = 'rgba(255,179,71,0.5)';
      c.shadowBlur = 6;
      c.beginPath();
      c.arc(mToP(b.x), mToP(b.y), ballR + 1, 0, Math.PI * 2);
      c.fill();
      c.shadowColor = 'transparent';
      c.shadowBlur = 0;
    }
    // scored / extinguished / held = not drawn on field
  });
}

function renderRobots(c) {
  robots.forEach(r => {
    const px = mToP(r.x);
    const py = mToP(r.y);
    const size = mToP(ROBOT_SIZE_M);
    const half = size / 2;

    c.save();
    c.translate(px, py);

    // Glow for player
    if (r.isPlayer) {
      c.shadowColor = 'rgba(255,215,0,0.4)';
      c.shadowBlur = 12;
    }

    // Robot body (square with rounded corners)
    const bodyColor = r.alliance === 'red' ? COL.redBot : COL.blueBot;
    const lightColor = r.alliance === 'red' ? COL.redBotLight : COL.blueBotLight;

    c.fillStyle = bodyColor;
    c.beginPath();
    c.roundRect(-half, -half, size, size, size * 0.15);
    c.fill();

    // Inner detail (lighter square)
    c.fillStyle = lightColor;
    const innerSize = size * 0.5;
    c.beginPath();
    c.roundRect(-innerSize / 2, -innerSize / 2, innerSize, innerSize, innerSize * 0.15);
    c.fill();

    c.shadowColor = 'transparent';
    c.shadowBlur = 0;

    // Direction indicator (triangle/arrow)
    c.save();
    c.rotate(r.angle);
    c.fillStyle = r.isPlayer ? COL.playerHighlight : '#fff';
    c.globalAlpha = 0.8;
    c.beginPath();
    c.moveTo(half + 4, 0);
    c.lineTo(half - 4, -5);
    c.lineTo(half - 4, 5);
    c.closePath();
    c.fill();
    c.globalAlpha = 1;
    c.restore();

    // Border
    c.strokeStyle = r.isPlayer ? COL.playerHighlight : 'rgba(255,255,255,0.3)';
    c.lineWidth = r.isPlayer ? 2 : 1;
    c.beginPath();
    c.roundRect(-half, -half, size, size, size * 0.15);
    c.stroke();

    // Inventory bar (above robot)
    if (r.specs.capacity > 0) {
      const barW = size;
      const barH = 4;
      const barY = -half - 8;
      const fill = r.inventory.length / r.specs.capacity;

      c.fillStyle = 'rgba(0,0,0,0.5)';
      c.fillRect(-half, barY, barW, barH);
      c.fillStyle = fill > 0.8 ? '#e83048' : fill > 0.5 ? '#f0c040' : '#2dd264';
      c.fillRect(-half, barY, barW * fill, barH);
      c.strokeStyle = 'rgba(255,255,255,0.15)';
      c.lineWidth = 0.5;
      c.strokeRect(-half, barY, barW, barH);
    }

    // Player label
    const label = r.isPlayer ? '★ TÚ' : r.id.slice(-2);
    c.fillStyle = 'rgba(10,12,20,0.8)';
    c.beginPath();
    c.roundRect(-16, half + 2, 32, 12, 3);
    c.fill();
    c.fillStyle = r.isPlayer ? COL.playerHighlight : '#ccc';
    c.font = `bold ${S() * 0.01}px Montserrat`;
    c.textAlign = 'center';
    c.fillText(label, 0, half + 11);

    c.restore();
  });
}

// ── 9. SETUP PREVIEW ────────────────────────────────────────────
function renderSetupPreview() {
  if (!setupCtx) return;
  const c = setupCtx;
  const cw = setupCanvas.width;
  const ch = setupCanvas.height;

  c.clearRect(0, 0, cw, ch);
  c.fillStyle = COL.fieldBg;
  c.fillRect(0, 0, cw, ch);

  const scale = cw / FIELD_M;
  const m2p = (m) => m * scale;

  // Grid
  c.strokeStyle = COL.gridLine;
  c.lineWidth = 0.5;
  for (let i = 0; i <= 14; i++) {
    const p = (i / 14) * cw;
    c.beginPath(); c.moveTo(p, 0); c.lineTo(p, ch); c.stroke();
    c.beginPath(); c.moveTo(0, p); c.lineTo(cw, p); c.stroke();
  }

  // Field border
  c.strokeStyle = 'rgba(255,255,255,0.1)';
  c.lineWidth = 2;
  c.strokeRect(2, 2, cw - 4, ch - 4);

  // Zones (simplified)
  c.fillStyle = 'rgba(232,48,72,0.06)';
  c.fillRect(m2p(0), m2p(0.3), m2p(1.0), m2p(2.2));
  c.fillStyle = 'rgba(51,119,255,0.06)';
  c.fillRect(m2p(6.0), m2p(0.3), m2p(1.0), m2p(2.2));

  // Extinguisher
  c.fillStyle = 'rgba(255,215,0,0.06)';
  c.fillRect(m2p(2.8), m2p(0), m2p(1.4), m2p(0.7));

  // Show starting positions
  const pa = CONFIG.alliance;
  const ea = pa === 'red' ? 'blue' : 'red';
  const pStartX = pa === 'red' ? 0.35 : FIELD_M - 0.35;
  const eStartX = ea === 'red' ? 0.35 : FIELD_M - 0.35;
  const positions = [FIELD_M * 0.75, FIELD_M * 0.85, FIELD_M * 0.95 - 0.1];

  positions.forEach((y, i) => {
    const isPlayer = (i + 1 === CONFIG.teamNumber);
    // Player's alliance
    c.fillStyle = pa === 'red' ? COL.redBot : COL.blueBot;
    const size = m2p(ROBOT_SIZE_M);
    c.beginPath();
    c.roundRect(m2p(pStartX) - size / 2, m2p(y) - size / 2, size, size, 4);
    c.fill();
    if (isPlayer) {
      c.strokeStyle = COL.playerHighlight;
      c.lineWidth = 2;
      c.stroke();
      c.fillStyle = COL.playerHighlight;
      c.font = 'bold 10px Montserrat';
      c.textAlign = 'center';
      c.fillText('★ TÚ', m2p(pStartX), m2p(y) + size / 2 + 12);
    }

    // Enemy alliance
    c.fillStyle = ea === 'red' ? COL.redBot : COL.blueBot;
    c.beginPath();
    c.roundRect(m2p(eStartX) - size / 2, m2p(y) - size / 2, size, size, 4);
    c.fill();
  });

  // Ball scatter preview
  c.fillStyle = 'rgba(255,140,40,0.15)';
  for (let i = 0; i < 80; i++) {
    const bx = 1.0 + Math.random() * 5.0;
    const by = 0.6 + Math.random() * 5.5;
    c.beginPath();
    c.arc(m2p(bx), m2p(by), 2, 0, Math.PI * 2);
    c.fill();
  }

  // Labels
  c.fillStyle = 'rgba(255,255,255,0.12)';
  c.font = `bold ${cw * 0.02}px Montserrat`;
  c.textAlign = 'center';
  c.fillText('SUPPRESSION RED', m2p(0.5), m2p(0.2));
  c.fillText('SUPPRESSION BLUE', m2p(6.5), m2p(0.2));
  c.fillText('EXTINGUISHER', m2p(3.5), m2p(0.35));
}

// ── 10. GAME LOOP ───────────────────────────────────────────────
let lastFrameTime = 0;
let animationId = null;

function gameLoop(timestamp) {
  const dt = Math.min((timestamp - lastFrameTime) / 1000, 0.05); // cap at 50ms
  lastFrameTime = timestamp;

  if (gamePhase === 'playing') {
    rebuildSpatialGrid();
    updatePlayerInput(dt);
    robots.forEach(r => updateBotAI(r, dt));
    updateBalls(dt);
    updateHumanPlayers(dt);
    updateHUD();
  }

  if (gamePhase === 'playing' || gamePhase === 'countdown') {
    renderGame();
  }

  animationId = requestAnimationFrame(gameLoop);
}

function updateHUD() {
  if (!playerRobot) return;
  document.getElementById('gsRedScore').textContent = SCORE.redSup;
  document.getElementById('gsBlueScore').textContent = SCORE.blueSup;
  document.getElementById('gsExtScore').textContent = SCORE.extinguisher;
  document.getElementById('hudInventory').textContent = `${playerRobot.inventory.length} / ${playerRobot.specs.capacity}`;

  // Status
  let status = 'Quieto';
  if (playerRobot.state === 'moving') status = '🏃 Moviéndose';
  else if (playerRobot.state === 'picking') status = '⬇ Recogiendo';
  else if (playerRobot.state === 'shooting') status = '🎯 Disparando';
  document.getElementById('hudStatus').textContent = status;

  // Field balls count
  const fieldCount = balls.filter(b => b.state === 'field').length;
  document.getElementById('hudFieldBalls').textContent = fieldCount;
}

function updateTimerDisplay() {
  const m = Math.floor(matchTime / 60);
  const s = matchTime % 60;
  const display = `${m}:${s.toString().padStart(2, '0')}`;
  const timerEl = document.getElementById('gsTimer');
  timerEl.textContent = display;

  timerEl.className = 'gs-timer';
  if (matchTime <= 10) timerEl.classList.add('critical');
  else if (matchTime <= 30) timerEl.classList.add('warning');
}

// ── 11. GAME FLOW ───────────────────────────────────────────────
function startMatch() {
  // Read config from UI
  readConfigFromUI();

  // Init game objects
  initBalls();
  initRobots();
  SCORE.redSup = 0;
  SCORE.blueSup = 0;
  SCORE.extinguisher = 0;
  PLAYER_STATS.pickedUp = 0;
  PLAYER_STATS.shot = 0;
  PLAYER_STATS.hits = 0;
  PLAYER_STATS.misses = 0;
  PLAYER_STATS.distance = 0;
  hpRedQueue = [];
  hpBlueQueue = [];
  hpRedTimer = 0;
  hpBlueTimer = 0;
  matchTime = MATCH_DURATION;

  // Switch to game screen
  showPhase('game');
  resizeGameCanvas();
  updateTimerDisplay();

  // Countdown
  gamePhase = 'countdown';
  renderGame();
  const overlay = document.getElementById('countdownOverlay');
  const numEl = document.getElementById('countdownNumber');
  overlay.style.display = 'flex';

  let count = 3;
  numEl.textContent = count;

  const countInterval = setInterval(() => {
    count--;
    if (count > 0) {
      numEl.textContent = count;
    } else if (count === 0) {
      numEl.textContent = '¡GO!';
      numEl.style.color = '#2dd264';
    } else {
      clearInterval(countInterval);
      overlay.style.display = 'none';
      numEl.style.color = '';
      gamePhase = 'playing';
      startMatchTimer();
    }
  }, 1000);

  // Start render loop
  lastFrameTime = performance.now();
  if (animationId) cancelAnimationFrame(animationId);
  animationId = requestAnimationFrame(gameLoop);
}

function startMatchTimer() {
  matchInterval = setInterval(() => {
    matchTime--;
    updateTimerDisplay();
    if (matchTime <= 0) {
      endMatch();
    }
  }, 1000);
}

function endMatch() {
  clearInterval(matchInterval);
  gamePhase = 'ended';

  // Calculate final scores
  const redMult = 1.0; // No climbing in simulation MVP
  const blueMult = 1.0;
  const redRegional = Math.ceil(SCORE.redSup * redMult);
  const blueRegional = Math.ceil(SCORE.blueSup * blueMult);
  const redTotal = redRegional + SCORE.extinguisher;
  const blueTotal = blueRegional + SCORE.extinguisher;

  // Show results
  showPhase('results');
  document.getElementById('resultRedScore').textContent = redTotal;
  document.getElementById('resultBlueScore').textContent = blueTotal;
  document.getElementById('rbRedSup').textContent = SCORE.redSup;
  document.getElementById('rbRedMult').textContent = `×${redMult.toFixed(2)}`;
  document.getElementById('rbRedRegional').textContent = redRegional;
  document.getElementById('rbBlueSup').textContent = SCORE.blueSup;
  document.getElementById('rbBlueMult').textContent = `×${blueMult.toFixed(2)}`;
  document.getElementById('rbBlueRegional').textContent = blueRegional;
  document.getElementById('rbExtTotal').textContent = SCORE.extinguisher;

  // Player stats
  document.getElementById('psPickedUp').textContent = PLAYER_STATS.pickedUp;
  document.getElementById('psShot').textContent = PLAYER_STATS.shot;
  document.getElementById('psHits').textContent = PLAYER_STATS.hits;
  document.getElementById('psMisses').textContent = PLAYER_STATS.misses;
  const totalShots = PLAYER_STATS.hits + PLAYER_STATS.misses;
  document.getElementById('psAccuracy').textContent = totalShots > 0 ? `${Math.round(PLAYER_STATS.hits / totalShots * 100)}%` : '—';
  document.getElementById('psDistance').textContent = `${PLAYER_STATS.distance.toFixed(1)} m`;
}

function showPhase(phase) {
  document.getElementById('setupScreen').style.display = phase === 'setup' ? 'block' : 'none';
  document.getElementById('gameScreen').style.display = phase === 'game' ? 'block' : 'none';
  document.getElementById('resultsScreen').style.display = phase === 'results' ? 'block' : 'none';
}

// ── 12. UI SETUP ────────────────────────────────────────────────
function readConfigFromUI() {
  CONFIG.specs.moveSpeed = parseFloat(document.getElementById('moveSpeed').value);
  CONFIG.specs.pickupSpeed = parseFloat(document.getElementById('pickupSpeed').value);
  CONFIG.specs.shotSpeed = parseFloat(document.getElementById('shotSpeed').value);
  CONFIG.specs.capacity = parseInt(document.getElementById('capacity').value);
  CONFIG.specs.accuracy = parseInt(document.getElementById('accuracy').value);
  CONFIG.hpAccuracy = parseInt(document.getElementById('hpAccuracy').value);
}

function initSetupUI() {
  // Toggle groups
  document.querySelectorAll('.toggle-group').forEach(group => {
    group.querySelectorAll('.toggle-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        group.querySelectorAll('.toggle-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        const groupId = group.id;
        const val = btn.dataset.value;

        if (groupId === 'allianceToggle') {
          CONFIG.alliance = val;
        } else if (groupId === 'teamToggle') {
          CONFIG.teamNumber = parseInt(val);
        } else if (groupId === 'allyDifficulty') {
          CONFIG.allyMultiplier = parseFloat(val);
        } else if (groupId === 'rivalDifficulty') {
          CONFIG.rivalMultiplier = parseFloat(val);
        }
        renderSetupPreview();
      });
    });
  });

  // Sliders
  const sliderMappings = [
    { id: 'moveSpeed', display: 'moveSpeedVal', suffix: ' m/s', decimals: 1 },
    { id: 'pickupSpeed', display: 'pickupSpeedVal', suffix: ' pelotas/s', decimals: 1 },
    { id: 'shotSpeed', display: 'shotSpeedVal', suffix: ' pelotas/s', decimals: 1 },
    { id: 'capacity', display: 'capacityVal', suffix: ' pelotas', decimals: 0 },
    { id: 'accuracy', display: 'accuracyVal', suffix: '%', decimals: 0 },
    { id: 'hpAccuracy', display: 'hpAccuracyVal', suffix: '%', decimals: 0 },
  ];

  sliderMappings.forEach(({ id, display, suffix, decimals }) => {
    const slider = document.getElementById(id);
    const displayEl = document.getElementById(display);
    if (slider && displayEl) {
      slider.addEventListener('input', () => {
        const v = parseFloat(slider.value);
        displayEl.textContent = (decimals > 0 ? v.toFixed(decimals) : Math.round(v)) + suffix;
      });
    }
  });

  // Start button
  document.getElementById('startMatchBtn').addEventListener('click', startMatch);

  // Results buttons
  document.getElementById('playAgainBtn').addEventListener('click', () => {
    if (animationId) cancelAnimationFrame(animationId);
    clearInterval(matchInterval);
    gamePhase = 'setup';
    showPhase('setup');
    renderSetupPreview();
  });

  document.getElementById('goCalcBtn').addEventListener('click', () => {
    window.location.href = 'index.html';
  });
}

// ── 13. INITIALIZATION ──────────────────────────────────────────
window.addEventListener('DOMContentLoaded', () => {
  initCanvases();
  initSetupUI();
  renderSetupPreview();
});

window.addEventListener('resize', () => {
  if (gamePhase === 'playing' || gamePhase === 'countdown') {
    resizeGameCanvas();
  }
});
