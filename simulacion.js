/* ═══════════════════════════════════════════════════════════════
   FGC 2026 REAL-TIME SIMULATION ENGINE — Team Colombia
   Igniting Innovation — 2D Top-Down Game
   ═══════════════════════════════════════════════════════════════ */

// ── 1. CONSTANTS ────────────────────────────────────────────────
const FIELD_M = 7;          // Field size in meters
const CANVAS_BASE = 700;    // Base canvas pixels
const MATCH_DURATION = 150; // 2:30 in seconds
const S = cEl => parseFloat(cEl.style.width) || cEl.width;
const TOTAL_BALLS = 500;
const BALL_RADIUS_M = 0.05; // 50mm radius (10cm diameter)
const ROBOT_SIZE_M = 0.50;  // 50cm side (official size)
const PICKUP_RANGE_M = 0.62;
const SHOOT_BALL_SPEED = 6; // m/s for flying balls
const FRICTION = 0.96;
const BALL_PUSH_FORCE = 0.8;
const HP_RATE = 0.8;        // Human player processes 1 ball per ~1.25s

// Official Incheon 2026 field zones (origin top-left)
const ZONES = {
  // Suppression units directly to the sides of the central Extinguisher
  supRed:    { x: 1.6,  y: 0.0,  w: 1.2, h: 0.7 },
  supBlue:   { x: 4.2,  y: 0.0,  w: 1.2, h: 0.7 },
  extinguisher: { x: 2.8, y: 0.0, w: 1.4, h: 0.7 },
  // Smaller fire shields at the bottom corners
  fireShieldRed:  { x: 0.0,   y: 6.4, w: 0.6, h: 0.6 },
  fireShieldBlue: { x: 6.4,   y: 6.4, w: 0.6, h: 0.6 },
  shootRedZone:   { x: 0.0,   y: 0.2, w: 1.8, h: 2.0 },
  shootBlueZone:  { x: 5.2,   y: 0.2, w: 1.8, h: 2.0 },
  fsRedZone:      { x: 0.0,   y: 5.8, w: 0.9, h: 1.2 },
  fsBlueZone:     { x: 6.1,   y: 5.8, w: 0.9, h: 1.2 },
};

// Official diagonal braces layout (starts outside fire shields, converges at extinguisher)
const BRACES = {
  red: { startX: 0.9, startY: 6.8, endX: 2.8, endY: 0.7 },
  blue: { startX: 6.1, startY: 6.8, endX: 4.2, endY: 0.7 }
};
const BRACE_LENGTH = Math.sqrt(
  (BRACES.red.endX - BRACES.red.startX) ** 2 +
  (BRACES.red.endY - BRACES.red.startY) ** 2
);

const CLIMB_VALUES = { none: 0, contact: 0.05, z1: 0.10, z2: 0.20, z3: 0.30 };

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

// ── 2. RETRO SOUND EFFECTS (Web Audio API Synthesizer) ───────────
let audioCtx = null;
function playSound(type) {
  try {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!audioCtx) audioCtx = new AudioContextClass();
    if (audioCtx.state === 'suspended') audioCtx.resume();
    
    const osc = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    osc.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    
    const now = audioCtx.currentTime;
    
    if (type === 'pickup') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(600, now);
      osc.frequency.exponentialRampToValueAtTime(1000, now + 0.08);
      gainNode.gain.setValueAtTime(0.08, now);
      gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
      osc.start(now);
      osc.stop(now + 0.08);
    } else if (type === 'shoot') {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(320, now);
      osc.frequency.exponentialRampToValueAtTime(60, now + 0.15);
      gainNode.gain.setValueAtTime(0.12, now);
      gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
      osc.start(now);
      osc.stop(now + 0.15);
    } else if (type === 'score') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(523.25, now); // C5
      osc.frequency.setValueAtTime(659.25, now + 0.07); // E5
      gainNode.gain.setValueAtTime(0.06, now);
      gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
      osc.start(now);
      osc.stop(now + 0.25);
    } else if (type === 'extinguisher') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1568, now); // G6
      gainNode.gain.setValueAtTime(0.06, now);
      gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
      osc.start(now);
      osc.stop(now + 0.35);
    } else if (type === 'climb') {
      osc.type = 'square';
      osc.frequency.setValueAtTime(55, now);
      gainNode.gain.setValueAtTime(0.03, now);
      gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
      osc.start(now);
      osc.stop(now + 0.05);
    } else if (type === 'countdown') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(440, now);
      gainNode.gain.setValueAtTime(0.08, now);
      gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
      osc.start(now);
      osc.stop(now + 0.15);
    } else if (type === 'go') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, now);
      gainNode.gain.setValueAtTime(0.12, now);
      gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
      osc.start(now);
      osc.stop(now + 0.4);
    } else if (type === 'game_over') {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(220, now);
      osc.frequency.linearRampToValueAtTime(60, now + 0.6);
      gainNode.gain.setValueAtTime(0.1, now);
      gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
      osc.start(now);
      osc.stop(now + 0.6);
    }
  } catch (e) {
    console.warn("Sound failed to play:", e);
  }
}

// ── 3. ROBOT TEXTURES LOADING ────────────────────────────────────
const ROBOT_IMAGES = {
  colombia: new Image(),
  ally: new Image(),
  rival: new Image()
};
ROBOT_IMAGES.colombia.src = 'robot_colombia.png';
ROBOT_IMAGES.ally.src = 'robot_ally.png';
ROBOT_IMAGES.rival.src = 'robot_rival.png';

const ROBOT_TEXTURES = {
  colombia: null,
  ally: null,
  rival: null
};

function processTexture(img, key) {
  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth || img.width;
  canvas.height = img.naturalHeight || img.height;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0);
  try {
    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imgData.data;
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i+1];
      const b = data[i+2];
      if (r < 20 && g < 20 && b < 20) {
        data[i+3] = 0; // Set transparent
      }
    }
    ctx.putImageData(imgData, 0, 0);
    const processed = new Image();
    processed.src = canvas.toDataURL();
    processed.onload = () => {
      ROBOT_TEXTURES[key] = processed;
    };
  } catch (e) {
    console.warn("Dynamic texture transparency failed, using fallback:", e);
    ROBOT_TEXTURES[key] = img;
  }
}

ROBOT_IMAGES.colombia.onload = () => processTexture(ROBOT_IMAGES.colombia, 'colombia');
ROBOT_IMAGES.ally.onload = () => processTexture(ROBOT_IMAGES.ally, 'ally');
ROBOT_IMAGES.rival.onload = () => processTexture(ROBOT_IMAGES.rival, 'rival');

// ── 4. GAME STATE ───────────────────────────────────────────────
let gamePhase = 'setup'; // 'setup' | 'countdown' | 'playing' | 'ended'
let matchTime = MATCH_DURATION;
let matchInterval = null;
let lastClimbSoundTime = 0;

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
    climbSpeed: 0.5,
  },
  gameMode: 1, // 1 = Solo, 2 = 2 Players Coop
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

// Player statistics
const PLAYER_STATS = {
  pickedUp: 0,
  shot: 0,
  hits: 0,
  misses: 0,
  distance: 0,
};

const PLAYER2_STATS = {
  pickedUp: 0,
  shot: 0,
  hits: 0,
  misses: 0,
  distance: 0,
};

// Input state
const KEYS = {};
window.addEventListener('keydown', e => {
  const key = e.key.toLowerCase();
  KEYS[key] = true;
  if (e.key === ' ' || key.startsWith('arrow')) {
    e.preventDefault();
  }
});
window.addEventListener('keyup', e => {
  KEYS[e.key.toLowerCase()] = false;
});

// ── 5. BALL SYSTEM ──────────────────────────────────────────────
let balls = [];

function initBalls() {
  balls = [];
  for (let i = 0; i < TOTAL_BALLS; i++) {
    let x, y;
    if (Math.random() < 0.6) {
      x = 1.8 + Math.random() * 3.4;
      y = 1.0 + Math.random() * 4.5;
    } else {
      x = 0.5 + Math.random() * 6.0;
      y = 0.5 + Math.random() * 6.0;
    }
    balls.push({
      x: x,
      y: y,
      vx: 0,
      vy: 0,
      state: 'field',
      owner: null,
      targetX: 0,
      targetY: 0,
      targetZone: null,
    });
  }
}

// Spatial Hash Grid for O(N) ball lookups
const GRID_SIZE = 0.5; // meter per cell
let spatialGrid = {};

function rebuildSpatialGrid() {
  spatialGrid = {};
  balls.forEach((b, idx) => {
    if (b.state !== 'field') return;
    const gx = Math.floor(b.x / GRID_SIZE);
    const gy = Math.floor(b.y / GRID_SIZE);
    const key = `${gx}_${gy}`;
    if (!spatialGrid[key]) spatialGrid[key] = [];
    spatialGrid[key].push(idx);
  });
}

function getNearbyBalls(rx, ry, radius) {
  const gx1 = Math.floor((rx - radius) / GRID_SIZE);
  const gx2 = Math.floor((rx + radius) / GRID_SIZE);
  const gy1 = Math.floor((ry - radius) / GRID_SIZE);
  const gy2 = Math.floor((ry + radius) / GRID_SIZE);

  const results = [];
  for (let gx = gx1; gx <= gx2; gx++) {
    for (let gy = gy1; gy <= gy2; gy++) {
      const key = `${gx}_${gy}`;
      const cell = spatialGrid[key];
      if (cell) {
        cell.forEach(idx => {
          const b = balls[idx];
          const dist = Math.hypot(b.x - rx, b.y - ry);
          if (dist <= radius) {
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
      
      // Arena bounds bounce
      if (b.x < BALL_RADIUS_M) { b.x = BALL_RADIUS_M; b.vx = Math.abs(b.vx) * 0.5; }
      if (b.x > FIELD_M - BALL_RADIUS_M) { b.x = FIELD_M - BALL_RADIUS_M; b.vx = -Math.abs(b.vx) * 0.5; }
      if (b.y < BALL_RADIUS_M) { b.y = BALL_RADIUS_M; b.vy = Math.abs(b.vy) * 0.5; }
      if (b.y > FIELD_M - BALL_RADIUS_M) { b.y = FIELD_M - BALL_RADIUS_M; b.vy = -Math.abs(b.vy) * 0.5; }
    } else if (b.state === 'flying') {
      const dx = b.targetX - b.x;
      const dy = b.targetY - b.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < 0.15) {
        // Arrived at Suppression unit target
        const robot = robots.find(r => r.id === b.owner);
        const acc = robot ? robot.specs.accuracy : 80;
        if (Math.random() * 100 < acc) {
          if (b.targetZone === 'supRed') {
            b.state = 'scored_red';
            SCORE.redSup++;
          } else if (b.targetZone === 'supBlue') {
            b.state = 'scored_blue';
            SCORE.blueSup++;
          }
          playSound('score');
          
          if (robot) {
            if (robot.isPlayer1) PLAYER_STATS.hits++;
            else if (robot.isPlayer2) PLAYER2_STATS.hits++;
          }
        } else {
          // Missed
          b.state = 'field';
          b.vx = (Math.random() - 0.5) * 3;
          b.vy = (Math.random() - 0.5) * 2 + 1.5; // bounce downward
          if (robot) {
            if (robot.isPlayer1) PLAYER_STATS.misses++;
            else if (robot.isPlayer2) PLAYER2_STATS.misses++;
          }
        }
      } else {
        const speed = SHOOT_BALL_SPEED * dt;
        b.x += (dx / dist) * speed;
        b.y += (dy / dist) * speed;
      }
    }
  });
}

// ── 6. ROBOT CLASS ──────────────────────────────────────────────
class Robot {
  constructor(id, alliance, teamNum, isPlayer) {
    this.id = id;
    this.alliance = alliance;
    this.teamNum = teamNum;
    this.isPlayer = isPlayer;
    this.isPlayer1 = false;
    this.isPlayer2 = false;
    this.x = 0;
    this.y = 0;
    this.angle = 0;
    this.vx = 0;
    this.vy = 0;
    this.inventory = [];
    this.specs = { moveSpeed: 1.5, pickupSpeed: 2, shotSpeed: 3, capacity: 12, accuracy: 80, climbSpeed: 0.5 };
    this.state = 'idle'; // 'idle' | 'moving' | 'picking' | 'shooting' | 'climbing'
    this.pickupCooldown = 0;
    this.shootCooldown = 0;
    this.aiState = 'seek_balls';
    this.aiTarget = null;
    this.aiWait = 0;
    this.prevX = 0;
    this.prevY = 0;

    // Escalada (Brace climb) variables
    this.climbT = 0.0; // 0.0 to 1.0 along diagonal
    this.isBuddy = false;
    this.buddyOf = null;
  }

  getShootTarget() {
    if (this.alliance === 'red') {
      return { x: 2.2, y: 0.35, zone: 'supRed' };
    } else {
      return { x: 4.8, y: 0.35, zone: 'supBlue' };
    }
  }

  getFireShieldTarget() {
    if (this.alliance === 'red') {
      return { x: 0.4, y: 6.4 };
    } else {
      return { x: 6.6, y: 6.4 };
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
let player2Robot = null;

function initRobots() {
  robots = [];
  playerRobot = null;
  player2Robot = null;
  const pa = CONFIG.alliance;
  const ea = pa === 'red' ? 'blue' : 'red';

  const pStartX = pa === 'red' ? 0.45 : FIELD_M - 0.45;
  const eStartX = ea === 'red' ? 0.45 : FIELD_M - 0.45;

  const teamPositions = [
    { y: FIELD_M * 0.70 },
    { y: FIELD_M * 0.82 },
    { y: FIELD_M * 0.94 - 0.15 },
  ];

  // Create player alliance robots
  for (let i = 0; i < 3; i++) {
    const isP1 = (i === CONFIG.teamNumber - 1);
    const isP2 = (i === (CONFIG.teamNumber % 3) && CONFIG.gameMode === 2);
    const isP = isP1 || isP2;
    
    const r = new Robot(
      `${pa}R${i + 1}`,
      pa,
      i + 1,
      isP
    );
    r.isPlayer1 = isP1;
    r.isPlayer2 = isP2;
    r.x = pStartX;
    r.y = teamPositions[i].y;
    r.angle = pa === 'red' ? 0 : Math.PI;
    r.prevX = r.x;
    r.prevY = r.y;

    if (isP1) {
      r.specs = { ...CONFIG.specs };
      playerRobot = r;
    } else if (isP2) {
      r.specs = { ...CONFIG.specs };
      player2Robot = r;
    } else {
      r.specs = {
        moveSpeed: CONFIG.specs.moveSpeed * CONFIG.allyMultiplier,
        pickupSpeed: CONFIG.specs.pickupSpeed * CONFIG.allyMultiplier,
        shotSpeed: CONFIG.specs.shotSpeed * CONFIG.allyMultiplier,
        capacity: Math.max(3, Math.round(CONFIG.specs.capacity * CONFIG.allyMultiplier)),
        accuracy: Math.round(CONFIG.specs.accuracy * CONFIG.allyMultiplier),
        climbSpeed: CONFIG.specs.climbSpeed * CONFIG.allyMultiplier
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
      climbSpeed: CONFIG.specs.climbSpeed * CONFIG.rivalMultiplier
    };
    robots.push(r);
  }
}

function inContactZone(robot) {
  const brace = BRACES[robot.alliance];
  const dx = robot.x - brace.startX;
  const dy = robot.y - brace.startY;
  return Math.sqrt(dx*dx + dy*dy) < 0.45;
}

// ── 7. PLAYER INPUT ──────────────────────────────────────────────
function updatePlayerRobot(r, dt) {
  if (!r || gamePhase !== 'playing') return;

  // 🏃 Normal Driving
  const sp = r.specs.moveSpeed;
  let moveX = 0, moveY = 0;

  if (r.isPlayer2) {
    if (KEYS['arrowup']) moveY = -1;
    if (KEYS['arrowdown']) moveY = 1;
    if (KEYS['arrowleft']) moveX = -1;
    if (KEYS['arrowright']) moveX = 1;
  } else {
    if (KEYS['w']) moveY = -1;
    if (KEYS['s']) moveY = 1;
    if (KEYS['a']) moveX = -1;
    if (KEYS['d']) moveX = 1;
  }

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

  // Clamp inside field
  const half = ROBOT_SIZE_M / 2;
  r.x = Math.max(half, Math.min(FIELD_M - half, r.x));
  r.y = Math.max(half, Math.min(FIELD_M - half, r.y));

  // Track mileage
  const dx = r.x - r.prevX;
  const dy = r.y - r.prevY;
  const distTravelled = Math.sqrt(dx * dx + dy * dy);
  if (r.isPlayer1) PLAYER_STATS.distance += distTravelled;
  else if (r.isPlayer2) PLAYER2_STATS.distance += distTravelled;

  // Push field balls
  pushBallsFromRobot(r);

  // Intake / Pickup Action
  r.pickupCooldown = Math.max(0, r.pickupCooldown - dt);
  const pickupKey = r.isPlayer2 ? 'k' : 'p';
  if (KEYS[pickupKey] && r.inventory.length < r.specs.capacity && r.pickupCooldown <= 0) {
    const nearby = getNearbyBalls(r.x, r.y, PICKUP_RANGE_M);
    if (nearby.length > 0) {
      const idx = nearby[0];
      balls[idx].state = 'held';
      balls[idx].owner = r.id;
      r.inventory.push(idx);
      r.state = 'picking';
      r.pickupCooldown = 1.0 / r.specs.pickupSpeed;
      playSound('pickup');
      if (r.isPlayer1) PLAYER_STATS.pickedUp++;
      else if (r.isPlayer2) PLAYER2_STATS.pickedUp++;
    }
  }

  // Shoot Action (Space / L)
  r.shootCooldown = Math.max(0, r.shootCooldown - dt);
  const shootKey = r.isPlayer2 ? 'l' : ' ';
  if (KEYS[shootKey] && r.inventory.length > 0 && r.shootCooldown <= 0) {
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
      playSound('shoot');
      if (r.isPlayer1) PLAYER_STATS.shot++;
      else if (r.isPlayer2) PLAYER2_STATS.shot++;
    } else if (r.isInFireShieldZone()) {
      const ballIdx = r.inventory.shift();
      balls[ballIdx].state = 'held';
      handleHumanPlayer(ballIdx, r.alliance);
      r.shootCooldown = 1.0 / r.specs.shotSpeed;
      if (r.isPlayer1) PLAYER_STATS.shot++;
      else if (r.isPlayer2) PLAYER2_STATS.shot++;
    }
  }

  // Climb Action trigger (O / I or W / Arrow Up)
  const climbKey = r.isPlayer2 ? 'i' : 'o';
  const upKey = r.isPlayer2 ? 'arrowup' : 'w';
  if ((KEYS[climbKey] || KEYS[upKey]) && inContactZone(r)) {
    r.state = 'climbing';
    r.climbT = 0.05;
    
    // Auto-attach buddy climber
    let closestAlly = null;
    let closestDist = Infinity;
    robots.forEach(a => {
      if (a.id !== r.id && a.alliance === r.alliance && a.state !== 'climbing') {
        const d = Math.hypot(a.x - r.x, a.y - r.y);
        if (d < 0.9 && d < closestDist) {
          closestDist = d;
          closestAlly = a;
        }
      }
    });

    if (closestAlly) {
      closestAlly.state = 'climbing';
      closestAlly.isBuddy = true;
      closestAlly.buddyOf = r.id;
      closestAlly.climbT = 0.0;
    }
  }
}

// ── 7.5 CLIMBING UPDATER (Runs for both player & bot climbers) ────
function updateClimbingRobot(r, dt) {
  if (r.isPlayer) {
    const climbKey = r.isPlayer2 ? 'i' : 'o';
    const upKey = r.isPlayer2 ? 'arrowup' : 'w';
    const downKey = r.isPlayer2 ? 'arrowdown' : 's';
    
    let climbDir = 0;
    if (KEYS[climbKey] || KEYS[upKey]) climbDir = 1;
    else if (KEYS[downKey]) climbDir = -1;
    
    if (climbDir !== 0) {
      const brace = BRACES[r.alliance];
      const dx = brace.endX - brace.startX;
      const dy = brace.endY - brace.startY;
      const len = Math.sqrt(dx*dx + dy*dy);
      
      let speedScale = 1.0;
      const hasBuddy = robots.some(a => a.state === 'climbing' && a.isBuddy && a.buddyOf === r.id);
      if (hasBuddy) speedScale = 0.55;

      r.climbT = Math.max(0, Math.min(1.0, r.climbT + climbDir * (r.specs.climbSpeed / len) * dt * speedScale));
      
      if (r.climbT <= 0.001 && climbDir === -1) {
        r.state = 'idle';
        r.climbT = 0.0;
        robots.forEach(a => {
          if (a.state === 'climbing' && a.isBuddy && a.buddyOf === r.id) {
            a.state = 'idle';
            a.isBuddy = false;
            a.buddyOf = null;
            a.climbT = 0.0;
          }
        });
      }
      
      if (performance.now() - lastClimbSoundTime > 150) {
        playSound('climb');
        lastClimbSoundTime = performance.now();
      }
    }
  } else if (!r.isBuddy) {
    // Bot climbing
    const brace = BRACES[r.alliance];
    const dx = brace.endX - brace.startX;
    const dy = brace.endY - brace.startY;
    const len = Math.sqrt(dx*dx + dy*dy);
    
    let speedScale = 1.0;
    const hasBuddy = robots.some(a => a.state === 'climbing' && a.isBuddy && a.buddyOf === r.id);
    if (hasBuddy) speedScale = 0.55;

    r.climbT = Math.min(0.9, r.climbT + (r.specs.climbSpeed / len) * dt * speedScale); // bots climb to 90%
  }

  // Update physical coordinates
  const brace = BRACES[r.alliance];
  r.x = brace.startX + (brace.endX - brace.startX) * r.climbT;
  r.y = brace.startY + (brace.endY - brace.startY) * r.climbT;
  r.angle = Math.atan2(brace.endY - brace.startY, brace.endX - brace.startX);

  // Drag buddy
  if (!r.isBuddy) {
    robots.forEach(a => {
      if (a.state === 'climbing' && a.isBuddy && a.buddyOf === r.id) {
        a.climbT = Math.max(0, r.climbT - 0.15); // Offset buddy behind
        a.x = brace.startX + (brace.endX - brace.startX) * a.climbT;
        a.y = brace.startY + (brace.endY - brace.startY) * a.climbT;
        a.angle = r.angle;
      }
    });
  }
}

// ── 8. BOT AI ────────────────────────────────────────────────────
function updateBotAI(robot, dt) {
  if (robot.isPlayer || gamePhase !== 'playing') return;
  const r = robot;

  // Nula Difficulty Check (If set to 0.0, bot remains idle)
  const mult = r.alliance === CONFIG.alliance ? CONFIG.allyMultiplier : CONFIG.rivalMultiplier;
  if (mult === 0.0) {
    r.state = 'idle';
    return;
  }

  r.pickupCooldown = Math.max(0, r.pickupCooldown - dt);
  r.shootCooldown = Math.max(0, r.shootCooldown - dt);
  r.aiWait = Math.max(0, r.aiWait - dt);

  // Climbing trigger conditions
  const fieldBallsCount = balls.filter(b => b.state === 'field').length;
  const shouldClimb = (matchTime <= 30) || (fieldBallsCount === 0);

  if (shouldClimb) {
    r.aiState = 'seek_climb';
  } else {
    // If not allowed to climb, and currently trying to climb, reset
    if (r.aiState === 'seek_climb') {
      r.aiState = 'seek_balls';
    }
    if (r.state === 'climbing') {
      r.state = 'idle';
      r.climbT = 0.0;
      r.isBuddy = false;
      r.buddyOf = null;
    }
  }

  if (r.aiWait > 0) return;

  switch (r.aiState) {
    case 'seek_balls': {
      if (r.inventory.length >= r.specs.capacity) {
        r.aiState = Math.random() < 0.7 ? 'seek_suppression' : 'seek_fireshield';
        break;
      }
      const nearby = getNearbyBalls(r.x, r.y, PICKUP_RANGE_M);
      if (nearby.length > 0 && r.pickupCooldown <= 0) {
        const idx = nearby[0];
        balls[idx].state = 'held';
        balls[idx].owner = r.id;
        r.inventory.push(idx);
        r.pickupCooldown = 1.0 / r.specs.pickupSpeed;
        r.state = 'picking';
        if (r.inventory.length >= r.specs.capacity) {
          r.aiState = Math.random() < 0.7 ? 'seek_suppression' : 'seek_fireshield';
        }
        break;
      }
      let bestDist = Infinity;
      let bestX = FIELD_M / 2, bestY = FIELD_M / 2;
      const searchRange = 3.5;
      const candidates = getNearbyBalls(r.x, r.y, searchRange);
      if (candidates.length > 0) {
        bestX = balls[candidates[0]].x;
        bestY = balls[candidates[0]].y;
      } else {
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
        const driveX = r.alliance === 'red' ? 1.5 : 5.5;
        moveToward(r, driveX, target.y + 0.5, dt);
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
        r.aiWait = 0.3 + Math.random() * 0.4;
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
        playSound('shoot');
      }
      break;
    }

    case 'depositing_fs': {
      if (r.inventory.length === 0) {
        r.aiState = 'seek_balls';
        r.aiWait = 0.3 + Math.random() * 0.4;
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

    case 'seek_climb': {
      // Check if climbing is allowed
      const fieldBallsCount = balls.filter(b => b.state === 'field').length;
      const shouldClimb = (matchTime <= 30) || (fieldBallsCount === 0);
      if (!shouldClimb) {
        r.aiState = 'seek_balls';
        r.state = 'idle';
        r.climbT = 0.0;
        break;
      }
      const brace = BRACES[r.alliance];
      const dist = Math.hypot(r.x - brace.startX, r.y - brace.startY);
      if (dist < 0.45) {
        r.state = 'climbing';
        r.climbT = 0.05;
        
        let closestAlly = null;
        let closestDist = Infinity;
        robots.forEach(a => {
          if (a.id !== r.id && a.alliance === r.alliance && a.state !== 'climbing') {
            const d = Math.hypot(a.x - r.x, a.y - r.y);
            if (d < 0.9 && d < closestDist) {
              closestDist = d;
              closestAlly = a;
            }
          }
        });

        if (closestAlly) {
          closestAlly.state = 'climbing';
          closestAlly.isBuddy = true;
          closestAlly.buddyOf = r.id;
          closestAlly.climbT = 0.0;
        }
      } else {
        moveToward(r, brace.startX, brace.startY, dt);
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

// ── 9. HUMAN PLAYER & THROWING ANIMATION ─────────────────────────
let hpRedQueue = [];
let hpBlueQueue = [];
let hpRedTimer = 0;
let hpBlueTimer = 0;

let hpRedThrowTimer = 0;
let hpBlueThrowTimer = 0;

let activeThrows = [];
let visualSplashes = [];

function handleHumanPlayer(ballIdx, alliance) {
  if (alliance === 'red') {
    hpRedQueue.push(ballIdx);
  } else {
    hpBlueQueue.push(ballIdx);
  }
}

function updateHumanPlayers(dt) {
  hpRedThrowTimer = Math.max(0, hpRedThrowTimer - dt);
  hpBlueThrowTimer = Math.max(0, hpBlueThrowTimer - dt);

  // Red HP
  hpRedTimer += dt;
  if (hpRedTimer >= (1 / HP_RATE) && hpRedQueue.length > 0) {
    hpRedTimer = 0;
    const idx = hpRedQueue.shift();
    const isHit = Math.random() * 100 < CONFIG.hpAccuracy;
    
    const sx = -0.3;
    const sy = 6.3;
    const tx = 3.5;
    const ty = 0.35;

    activeThrows.push({
      ballIdx: idx,
      alliance: 'red',
      startX: sx,
      startY: sy,
      x: sx,
      y: sy,
      targetX: tx,
      targetY: ty,
      t: 0.0,
      isHit: isHit,
      duration: 0.9
    });

    balls[idx].state = 'flying_hp';
    hpRedThrowTimer = 0.45;
  }

  // Blue HP
  hpBlueTimer += dt;
  if (hpBlueTimer >= (1 / HP_RATE) && hpBlueQueue.length > 0) {
    hpBlueTimer = 0;
    const idx = hpBlueQueue.shift();
    const isHit = Math.random() * 100 < CONFIG.hpAccuracy;

    const sx = FIELD_M + 0.3;
    const sy = 6.3;
    const tx = 3.5;
    const ty = 0.35;

    activeThrows.push({
      ballIdx: idx,
      alliance: 'blue',
      startX: sx,
      startY: sy,
      x: sx,
      y: sy,
      targetX: tx,
      targetY: ty,
      t: 0.0,
      isHit: isHit,
      duration: 0.9
    });

    balls[idx].state = 'flying_hp';
    hpBlueThrowTimer = 0.45;
  }

  // Update active throws
  for (let i = activeThrows.length - 1; i >= 0; i--) {
    const th = activeThrows[i];
    th.t += dt / th.duration;

    if (th.t >= 1.0) {
      if (th.isHit) {
        balls[th.ballIdx].state = 'extinguished';
        SCORE.extinguisher++;
        playSound('extinguisher');
        createSplash(th.targetX, th.targetY, COL.ball);
      } else {
        balls[th.ballIdx].state = 'field';
        balls[th.ballIdx].x = th.targetX;
        balls[th.ballIdx].y = th.targetY;
        balls[th.ballIdx].vx = (Math.random() - 0.5) * 3;
        balls[th.ballIdx].vy = 2.0 + Math.random() * 2.0;
        playSound('shoot');
      }
      activeThrows.splice(i, 1);
    } else {
      const t = th.t;
      th.x = th.startX + (th.targetX - th.startX) * t;
      th.y = th.startY + (th.targetY - th.startY) * t - Math.sin(t * Math.PI) * 1.8;
      
      balls[th.ballIdx].x = th.x;
      balls[th.ballIdx].y = th.y;
    }
  }

  // Update splashes
  for (let i = visualSplashes.length - 1; i >= 0; i--) {
    const s = visualSplashes[i];
    s.life -= dt;
    if (s.life <= 0) {
      visualSplashes.splice(i, 1);
    } else {
      s.particles.forEach(p => {
        p.x += p.vx * dt;
        p.y += p.vy * dt;
      });
    }
  }
}

function createSplash(x, y, color) {
  const pList = [];
  for (let i = 0; i < 8; i++) {
    const angle = Math.random() * Math.PI * 2;
    const sp = 0.5 + Math.random() * 1.5;
    pList.push({
      x: x,
      y: y,
      vx: Math.cos(angle) * sp,
      vy: Math.sin(angle) * sp
    });
  }
  visualSplashes.push({
    particles: pList,
    color: color,
    life: 0.35
  });
}

// ── 10. RENDERING ────────────────────────────────────────────────
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
}

function resizeGameCanvas() {
  if (!gameCanvas) return;
  const wrapper = gameCanvas.parentElement;
  const w = wrapper.clientWidth;
  const h = wrapper.clientHeight;
  if (w <= 0 || h <= 0) return;
  const size = Math.min(w, h);
  const dpr = window.devicePixelRatio || 1;
  gameCanvas.width = size * dpr;
  gameCanvas.height = size * dpr;
  gameCanvas.style.width = size + 'px';
  gameCanvas.style.height = size + 'px';
  gameCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function resizeSetupCanvas() {
  if (!setupCanvas) return;
  const wrapper = setupCanvas.parentElement;
  const w = wrapper.clientWidth;
  const h = wrapper.clientHeight;
  if (w <= 0 || h <= 0) return;
  const size = Math.min(w, h - 24);
  const dpr = window.devicePixelRatio || 1;
  setupCanvas.width = size * dpr;
  setupCanvas.height = size * dpr;
  setupCanvas.style.width = size + 'px';
  setupCanvas.style.height = size + 'px';
  setupCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function mToP(m, cEl) {
  const s = S(cEl);
  const pad = s * 0.08;
  const fw = s - pad * 2;
  return pad + (m / FIELD_M) * fw;
}

function sizeToP(m, cEl) {
  const s = S(cEl);
  const pad = s * 0.08;
  const fw = s - pad * 2;
  return (m / FIELD_M) * fw;
}

// Draw the static field layout on any canvas context
function drawFieldBase(c, cEl) {
  const s = S(cEl);
  const pad = s * 0.08;
  const fw = s - pad * 2;
  c.clearRect(0, 0, s, s);

  // Background
  c.fillStyle = COL.fieldBg;
  c.fillRect(0, 0, s, s);

  // Rejilla (grid inside padded area)
  c.strokeStyle = COL.gridLine;
  c.lineWidth = 0.5;
  for (let i = 0; i <= 14; i++) {
    const p = pad + (i / 14) * fw;
    c.beginPath(); c.moveTo(p, pad); c.lineTo(p, pad + fw); c.stroke();
    c.beginPath(); c.moveTo(pad, p); c.lineTo(pad + fw, p); c.stroke();
  }

  // Border of the playing field
  c.strokeStyle = 'rgba(255,255,255,0.08)';
  c.lineWidth = 2;
  c.strokeRect(pad, pad, fw, fw);

  // Zonas de Disparo y Fire Shields
  drawZoneCtx(c, ZONES.shootRedZone, 'rgba(232,48,72,0.04)', 'rgba(232,48,72,0.08)', cEl);
  drawZoneCtx(c, ZONES.shootBlueZone, 'rgba(51,119,255,0.04)', 'rgba(51,119,255,0.08)', cEl);
  drawZoneCtx(c, ZONES.fsRedZone, 'rgba(232,48,72,0.03)', 'rgba(232,48,72,0.06)', cEl);
  drawZoneCtx(c, ZONES.fsBlueZone, 'rgba(51,119,255,0.03)', 'rgba(51,119,255,0.06)', cEl);

  // Contact Zone Circles
  drawContactZoneCtx(c, 'red', cEl);
  drawContactZoneCtx(c, 'blue', cEl);

  // Suppression Units
  drawSuppressionUnitCtx(c, ZONES.supRed, COL.supRed, 'rgba(232,48,72,0.3)', 'SUP RED', SCORE.redSup, cEl);
  drawSuppressionUnitCtx(c, ZONES.supBlue, COL.supBlue, 'rgba(51,119,255,0.3)', 'SUP BLUE', SCORE.blueSup, cEl);

  // Extinguisher
  drawExtinguisherCtx(c, cEl);

  // Compact Fire Shields
  drawFireShieldCtx(c, ZONES.fireShieldRed, 'rgba(232,48,72,0.08)', '🛡', 'RED', cEl);
  drawFireShieldCtx(c, ZONES.fireShieldBlue, 'rgba(51,119,255,0.08)', '🛡', 'BLUE', cEl);

  // Official diagonal braces (Inverted V converging at Extinguisher)
  drawBraceCtx(c, 'red', cEl);
  drawBraceCtx(c, 'blue', cEl);
}

function drawZoneCtx(c, zone, fill, stroke, cEl) {
  c.fillStyle = fill;
  c.strokeStyle = stroke;
  c.lineWidth = 1;
  c.setLineDash([4, 4]);
  c.fillRect(mToP(zone.x, cEl), mToP(zone.y, cEl), sizeToP(zone.w, cEl), sizeToP(zone.h, cEl));
  c.strokeRect(mToP(zone.x, cEl), mToP(zone.y, cEl), sizeToP(zone.w, cEl), sizeToP(zone.h, cEl));
  c.setLineDash([]);
}

function drawSuppressionUnitCtx(c, zone, fill, textColor, label, count, cEl) {
  const px = mToP(zone.x, cEl);
  const py = mToP(zone.y, cEl);
  const pw = sizeToP(zone.w, cEl);
  const ph = sizeToP(zone.h, cEl);

  c.fillStyle = fill;
  c.fillRect(px, py, pw, ph);
  c.strokeStyle = textColor;
  c.lineWidth = 2;
  c.strokeRect(px, py, pw, ph);

  c.fillStyle = textColor;
  c.font = `bold ${S(cEl) * 0.013}px Montserrat`;
  c.textAlign = 'center';
  c.fillText(label, px + pw / 2, py + 16);

  c.font = `bold ${S(cEl) * 0.025}px Orbitron`;
  c.fillText(count.toString(), px + pw / 2, py + ph / 2 + 8);
}

function drawExtinguisherCtx(c, cEl) {
  const z = ZONES.extinguisher;
  const px = mToP(z.x, cEl);
  const py = mToP(z.y, cEl);
  const pw = sizeToP(z.w, cEl);
  const ph = sizeToP(z.h, cEl);

  c.fillStyle = COL.extZone;
  c.strokeStyle = 'rgba(255,215,0,0.2)';
  c.lineWidth = 1.5;
  c.beginPath();
  c.roundRect(px, py, pw, ph, 6);
  c.fill();
  c.stroke();

  c.fillStyle = 'rgba(255,215,0,0.6)';
  c.font = `bold ${S(cEl) * 0.012}px Montserrat`;
  c.textAlign = 'center';
  c.fillText('🧯 EXTINGUISHER', px + pw / 2, py + ph / 2 + 3);
  c.font = `bold ${S(cEl) * 0.018}px Orbitron`;
  c.fillText(SCORE.extinguisher.toString(), px + pw / 2, py + ph - 6);
}

function drawFireShieldCtx(c, zone, color, icon, label, cEl) {
  const px = mToP(zone.x, cEl);
  const py = mToP(zone.y, cEl);
  const pw = sizeToP(zone.w, cEl);
  const ph = sizeToP(zone.h, cEl);

  c.fillStyle = color;
  c.fillRect(px, py, pw, ph);
  c.strokeStyle = color.replace('0.08', '0.2');
  c.lineWidth = 1;
  c.strokeRect(px, py, pw, ph);

  c.fillStyle = color.replace('0.08', '0.4');
  c.font = `${S(cEl) * 0.018}px sans-serif`;
  c.textAlign = 'center';
  c.fillText(icon, px + pw / 2, py + ph / 2 - 4);
  c.font = `bold ${S(cEl) * 0.009}px Montserrat`;
  c.fillText('FIRE SHIELD', px + pw / 2, py + ph / 2 + 12);
}

function drawBraceCtx(c, alliance, cEl) {
  const isRed = alliance === 'red';
  const brace = BRACES[alliance];
  const px1 = mToP(brace.startX, cEl);
  const py1 = mToP(brace.startY, cEl);
  const px2 = mToP(brace.endX, cEl);
  const py2 = mToP(brace.endY, cEl);
  
  // Metal tube background
  c.strokeStyle = 'rgba(90, 100, 110, 0.4)';
  c.lineWidth = sizeToP(0.1, cEl) || 6;
  c.beginPath();
  c.moveTo(px1, py1);
  c.lineTo(px2, py2);
  c.stroke();
  
  // Alliance heat shrink cover
  c.strokeStyle = isRed ? 'rgba(232, 48, 72, 0.7)' : 'rgba(51, 119, 255, 0.7)';
  c.lineWidth = sizeToP(0.06, cEl) || 4;
  c.beginPath();
  c.moveTo(px1, py1);
  c.lineTo(px2, py2);
  c.stroke();

  // White tape ticks for zone partitions
  const tVals = [0.33, 0.66];
  tVals.forEach(t => {
    const tx = brace.startX + (brace.endX - brace.startX) * t;
    const ty = brace.startY + (brace.endY - brace.startY) * t;
    const dx = brace.endX - brace.startX;
    const dy = brace.endY - brace.startY;
    const len = Math.sqrt(dx*dx + dy*dy);
    const nx = -dy / len;
    const ny = dx / len;
    
    c.strokeStyle = '#ffffff';
    c.lineWidth = sizeToP(0.025, cEl) || 2;
    c.beginPath();
    c.moveTo(mToP(tx - nx * 0.12, cEl), mToP(ty - ny * 0.12, cEl));
    c.lineTo(mToP(tx + nx * 0.12, cEl), mToP(ty + ny * 0.12, cEl));
    c.stroke();
  });
  
  // Zone labels along braces
  c.fillStyle = 'rgba(255,255,255,0.45)';
  c.font = `bold ${S(cEl) * 0.011}px Montserrat`;
  c.textAlign = 'center';
  
  const labelT = [0.165, 0.495, 0.825];
  const labelNames = ['ZONA 1', 'ZONA 2', 'ZONA 3'];
  labelT.forEach((t, i) => {
    const tx = brace.startX + (brace.endX - brace.startX) * t;
    const ty = brace.startY + (brace.endY - brace.startY) * t;
    c.fillText(labelNames[i], mToP(tx + (isRed ? -0.22 : 0.22), cEl), mToP(ty, cEl) + 3);
  });
}

function drawContactZoneCtx(c, alliance, cEl) {
  const isRed = alliance === 'red';
  const brace = BRACES[alliance];
  const px = mToP(brace.startX, cEl);
  const py = mToP(brace.startY, cEl);
  
  c.strokeStyle = isRed ? 'rgba(232, 48, 72, 0.35)' : 'rgba(51, 119, 255, 0.35)';
  c.fillStyle = isRed ? 'rgba(232, 48, 72, 0.05)' : 'rgba(51, 119, 255, 0.05)';
  c.lineWidth = 1.5;
  c.beginPath();
  c.arc(px, py, sizeToP(0.40, cEl), 0, Math.PI * 2);
  c.fill();
  c.stroke();
  
  c.fillStyle = isRed ? 'rgba(232, 48, 72, 0.5)' : 'rgba(51, 119, 255, 0.5)';
  c.font = `bold ${S(cEl) * 0.013}px Montserrat`;
  c.textAlign = 'center';
  c.fillText('C', px, py + 4);
}

function renderGame() {
  const s = S(gameCanvas);
  const c = gameCtx;
  
  // Draw basic arena layout
  drawFieldBase(c, gameCanvas);

  // Human Players (outside field)
  drawHumanPlayer(c, 'red', gameCanvas);
  drawHumanPlayer(c, 'blue', gameCanvas);

  // Guardrails (bottom edge)
  drawGuardrails(c, gameCanvas);

  // Balls scatter
  renderBalls(c, gameCanvas);

  // Golden chain links for supported buddy robots
  renderGoldenChains(c, gameCanvas);

  // Active Human player thrown balls
  renderHPThrownBalls(c, gameCanvas);

  // Splash particles
  renderSplashes(c, gameCanvas);

  // Robots
  renderRobots(c, gameCanvas);
}

function drawGuardrails(c, cEl) {
  const s = S(cEl);
  c.strokeStyle = 'rgba(255,255,255,0.12)';
  c.lineWidth = 3;
  c.beginPath();
  c.moveTo(mToP(1.5, cEl), mToP(FIELD_M, cEl) - 1);
  c.lineTo(mToP(5.5, cEl), mToP(FIELD_M, cEl) - 1);
  c.stroke();
  c.fillStyle = 'rgba(255,255,255,0.05)';
  c.font = `bold ${s * 0.012}px Montserrat`;
  c.textAlign = 'center';
  c.fillText('GUARDRAILS', mToP(3.5, cEl), mToP(FIELD_M, cEl) - 6);
}

function drawHumanPlayer(c, alliance, cEl) {
  const isRed = alliance === 'red';
  const x = isRed ? -0.35 : FIELD_M + 0.35; // slightly further out to ensure it's not on the line
  const y = 6.3;
  const px = mToP(x, cEl);
  const py = mToP(y, cEl);
  
  const queue = isRed ? hpRedQueue : hpBlueQueue;
  const throwTimer = isRed ? hpRedThrowTimer : hpBlueThrowTimer;

  const emoji = throwTimer > 0 ? '🙆‍♂️' : '🧑';
  const sSize = S(cEl);

  c.save();
  if (throwTimer > 0) {
    c.translate(px, py);
    c.scale(1.25, 1.25);
    c.translate(-px, -py);
  }

  // Draw Emoji
  c.font = `${sSize * 0.045}px sans-serif`;
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  c.fillText(emoji, px, py);
  c.restore();

  // Draw Queue Length if any
  if (queue.length > 0) {
    c.fillStyle = '#ffd700';
    c.font = `bold ${sSize * 0.014}px Orbitron`;
    c.textAlign = 'center';
    c.textBaseline = 'top';
    c.fillText(`${queue.length}`, px, py + sSize * 0.03);
  }

  // Draw "HUMAN PLAYER" label above emoji
  c.fillStyle = isRed ? 'rgba(232,48,72,0.6)' : 'rgba(51,119,255,0.6)';
  c.font = `bold ${sSize * 0.014}px Montserrat`;
  c.textAlign = 'center';
  c.textBaseline = 'bottom';
  c.fillText('HUMAN', px, py - sSize * 0.035);
  c.fillText('PLAYER', px, py - sSize * 0.02);
}

function renderBalls(c, cEl) {
  const ballR = Math.max(2, sizeToP(BALL_RADIUS_M, cEl));
  balls.forEach(b => {
    if (b.state === 'field') {
      c.fillStyle = COL.ball;
      c.beginPath();
      c.arc(mToP(b.x, cEl), mToP(b.y, cEl), ballR, 0, Math.PI * 2);
      c.fill();
    } else if (b.state === 'flying') {
      c.strokeStyle = 'rgba(255,179,71,0.2)';
      c.lineWidth = 1;
      c.setLineDash([2, 2]);
      c.beginPath();
      c.moveTo(mToP(b.x, cEl), mToP(b.y, cEl));
      c.lineTo(mToP(b.targetX, cEl), mToP(b.targetY, cEl));
      c.stroke();
      c.setLineDash([]);

      c.fillStyle = COL.ballFlying;
      c.shadowColor = 'rgba(255,179,71,0.5)';
      c.shadowBlur = 5;
      c.beginPath();
      c.arc(mToP(b.x, cEl), mToP(b.y, cEl), ballR + 1, 0, Math.PI * 2);
      c.fill();
      c.shadowColor = 'transparent';
      c.shadowBlur = 0;
    }
  });
}

function renderHPThrownBalls(c, cEl) {
  const ballR = Math.max(2, sizeToP(BALL_RADIUS_M, cEl));
  activeThrows.forEach(th => {
    const sizeScale = 1.0 + Math.sin(th.t * Math.PI) * 0.9;
    
    c.fillStyle = COL.ballFlying;
    c.shadowColor = 'rgba(255,179,71,0.6)';
    c.shadowBlur = 8;
    c.beginPath();
    c.arc(mToP(th.x, cEl), mToP(th.y, cEl), ballR * sizeScale, 0, Math.PI * 2);
    c.fill();
    c.shadowColor = 'transparent';
    c.shadowBlur = 0;
  });
}

function renderSplashes(c, cEl) {
  visualSplashes.forEach(s => {
    c.fillStyle = s.color;
    c.globalAlpha = s.life / 0.35;
    s.particles.forEach(p => {
      c.beginPath();
      c.arc(mToP(p.x, cEl), mToP(p.y, cEl), 2.5, 0, Math.PI * 2);
      c.fill();
    });
    c.globalAlpha = 1.0;
  });
}

function renderGoldenChains(c, cEl) {
  robots.forEach(a => {
    if (a.state === 'climbing' && a.isBuddy && a.buddyOf) {
      const climber = robots.find(r => r.id === a.buddyOf);
      if (climber) {
        const px1 = mToP(climber.x, cEl);
        const py1 = mToP(climber.y, cEl);
        const px2 = mToP(a.x, cEl);
        const py2 = mToP(a.y, cEl);

        c.strokeStyle = '#ffd700';
        c.lineWidth = 4;
        c.shadowColor = 'rgba(255, 215, 0, 0.45)';
        c.shadowBlur = 6;
        c.setLineDash([3, 3]);
        c.beginPath();
        c.moveTo(px1, py1);
        c.lineTo(px2, py2);
        c.stroke();
        c.setLineDash([]);
        c.shadowColor = 'transparent';
        c.shadowBlur = 0;

        c.fillStyle = '#ffd700';
        c.font = '13px sans-serif';
        c.textAlign = 'center';
        c.fillText('🔗', (px1 + px2) / 2, (py1 + py2) / 2 + 5);
      }
    }
  });
}

function renderRobots(c, cEl) {
  const pa = CONFIG.alliance;
  robots.forEach(r => {
    const px = mToP(r.x, cEl);
    const py = mToP(r.y, cEl);
    const size = sizeToP(ROBOT_SIZE_M, cEl);
    const half = size / 2;

    c.save();
    c.translate(px, py);

    if (r.isPlayer) {
      c.shadowColor = r.isPlayer2 ? 'rgba(92,154,255,0.45)' : 'rgba(255,215,0,0.45)';
      c.shadowBlur = 12;
    }

    const baseTex = r.id === `${pa}R1` ? ROBOT_IMAGES.colombia : (r.alliance === pa ? ROBOT_IMAGES.ally : ROBOT_IMAGES.rival);
    const processedTex = r.id === `${pa}R1` ? ROBOT_TEXTURES.colombia : (r.alliance === pa ? ROBOT_TEXTURES.ally : ROBOT_TEXTURES.rival);
    const texture = processedTex || baseTex;

    if (texture && texture.complete && texture.naturalWidth > 0) {
      c.rotate(r.angle);
      c.drawImage(texture, -half, -half, size, size);
    } else {
      const bodyColor = r.alliance === 'red' ? COL.redBot : COL.blueBot;
      const lightColor = r.alliance === 'red' ? COL.redBotLight : COL.blueBotLight;

      c.fillStyle = bodyColor;
      c.beginPath();
      c.roundRect(-half, -half, size, size, size * 0.15);
      c.fill();

      c.fillStyle = lightColor;
      const innerSize = size * 0.5;
      c.beginPath();
      c.roundRect(-innerSize / 2, -innerSize / 2, innerSize, innerSize, innerSize * 0.15);
      c.fill();

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
      c.restore();
    }
    c.shadowColor = 'transparent';
    c.shadowBlur = 0;

    // Inventory bar
    if (r.specs.capacity > 0 && r.state !== 'climbing') {
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

    let label = r.isPlayer1 ? '★ TÚ' : r.isPlayer2 ? '★ P2' : r.id.slice(-2);
    c.fillStyle = 'rgba(10,12,20,0.8)';
    c.beginPath();
    c.roundRect(-16, half + 2, 32, 12, 3);
    c.fill();
    c.fillStyle = r.isPlayer1 ? COL.playerHighlight : r.isPlayer2 ? '#5c9aff' : '#ccc';
    c.font = `bold ${S(cEl) * 0.009}px Montserrat`;
    c.textAlign = 'center';
    c.fillText(label, 0, half + 11);

    c.restore();
  });
}

// ── 11. SETUP PREVIEW (Unified with in-game field aesthetics) ────
function renderSetupPreview() {
  if (!setupCtx) return;
  const c = setupCtx;
  
  // 1. Draw identical field background, braces, and zones
  drawFieldBase(c, setupCanvas);

  // 2. Draw human players (outside field)
  drawHumanPlayer(c, 'red', setupCanvas);
  drawHumanPlayer(c, 'blue', setupCanvas);

  // 3. Draw guardrails (bottom edge)
  drawGuardrails(c, setupCanvas);

  // 4. Draw balls scatter
  renderBalls(c, setupCanvas);

  // 5. Draw robots in initial setup positions
  renderRobots(c, setupCanvas);
}

// ── 12. GAME LOOP ────────────────────────────────────────────────
let lastFrameTime = 0;
let animationId = null;

function gameLoop(timestamp) {
  const dt = Math.min((timestamp - lastFrameTime) / 1000, 0.05); // cap frame step
  lastFrameTime = timestamp;

  if (gamePhase === 'playing') {
    rebuildSpatialGrid();
    
    robots.forEach(r => {
      if (r.state === 'climbing') {
        updateClimbingRobot(r, dt);
      } else {
        if (r.isPlayer) {
          updatePlayerRobot(r, dt);
        } else {
          updateBotAI(r, dt);
        }
      }
    });

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
  
  // Calculate real-time regional scores with climbing multipliers and buddy points
  const zones = {
    redR1: getRobotZoneKey(robots.find(r => r.id === 'redR1')),
    redR2: getRobotZoneKey(robots.find(r => r.id === 'redR2')),
    redR3: getRobotZoneKey(robots.find(r => r.id === 'redR3')),
    blueR1: getRobotZoneKey(robots.find(r => r.id === 'blueR1')),
    blueR2: getRobotZoneKey(robots.find(r => r.id === 'blueR2')),
    blueR3: getRobotZoneKey(robots.find(r => r.id === 'blueR3'))
  };
  
  const redMult = 1.0 + CLIMB_VALUES[zones.redR1] + CLIMB_VALUES[zones.redR2] + CLIMB_VALUES[zones.redR3];
  const blueMult = 1.0 + CLIMB_VALUES[zones.blueR1] + CLIMB_VALUES[zones.blueR2] + CLIMB_VALUES[zones.blueR3];
  const redBuddies = robots.filter(r => r.alliance === 'red' && r.state === 'climbing' && r.isBuddy).length;
  const blueBuddies = robots.filter(r => r.alliance === 'blue' && r.state === 'climbing' && r.isBuddy).length;
  
  const redRegional = Math.ceil(SCORE.redSup * redMult) + redBuddies * 25;
  const blueRegional = Math.ceil(SCORE.blueSup * blueMult) + blueBuddies * 25;
  
  document.getElementById('gsRedScore').textContent = redRegional;
  document.getElementById('gsBlueScore').textContent = blueRegional;
  document.getElementById('gsExtScore').textContent = SCORE.extinguisher;
  
  document.getElementById('gsRedSup').textContent = SCORE.redSup;
  document.getElementById('gsBlueSup').textContent = SCORE.blueSup;
  document.getElementById('gsRedHPQueue').textContent = hpRedQueue.length;
  document.getElementById('gsBlueHPQueue').textContent = hpBlueQueue.length;
  
  const getDiffLabel = (val) => {
    if (val === 0.0) return 'Nula (0.0)';
    if (val <= 0.6) return 'Básica (' + val.toFixed(2) + ')';
    if (val <= 0.8) return 'Media (' + val.toFixed(2) + ')';
    return 'Fuerte (' + val.toFixed(2) + ')';
  };
  
  if (CONFIG.alliance === 'red') {
    document.getElementById('gsRedBotDiff').textContent = getDiffLabel(CONFIG.allyMultiplier);
    document.getElementById('gsBlueBotDiff').textContent = getDiffLabel(CONFIG.rivalMultiplier);
  } else {
    document.getElementById('gsRedBotDiff').textContent = getDiffLabel(CONFIG.rivalMultiplier);
    document.getElementById('gsBlueBotDiff').textContent = getDiffLabel(CONFIG.allyMultiplier);
  }
  
  const redR1 = robots.find(r => r.id === 'redR1');
  const blueR1 = robots.find(r => r.id === 'blueR1');
  const p1Header = document.getElementById('p1Header');
  const p2Header = document.getElementById('p2Header');
  
  const getStatusText = (state) => {
    if (state === 'moving') return '🏃 Moviéndose';
    if (state === 'picking') return '⬇ Recogiendo';
    if (state === 'shooting') return '🎯 Disparando';
    if (state === 'climbing') return '🧗 Escalando';
    return 'Quieto';
  };

  if (CONFIG.alliance === 'red') {
    // Left: Player 1 (Red)
    if (p1Header) p1Header.textContent = '👤 JUGADOR 1 (WASD)';
    document.getElementById('hudRedInv').textContent = `${playerRobot.inventory.length} / ${playerRobot.specs.capacity}`;
    document.getElementById('hudRedStatus').textContent = getStatusText(playerRobot.state);

    // Right: Player 2 or Rival Bot (Blue)
    if (CONFIG.gameMode === 2 && player2Robot) {
      if (p2Header) p2Header.textContent = '👥 JUGADOR 2 (ARROWS)';
      document.getElementById('hudBlueInv').textContent = `${player2Robot.inventory.length} / ${player2Robot.specs.capacity}`;
      document.getElementById('hudBlueStatus').textContent = getStatusText(player2Robot.state);
    } else {
      if (p2Header) p2Header.textContent = '🤖 BOT RIVAL 1 (AUTO)';
      if (blueR1) {
        document.getElementById('hudBlueInv').textContent = `${blueR1.inventory.length} / ${blueR1.specs.capacity}`;
        document.getElementById('hudBlueStatus').textContent = getStatusText(blueR1.state);
      }
    }
  } else {
    // Right: Player 1 (Blue)
    if (p2Header) p2Header.textContent = '👤 JUGADOR 1 (WASD)';
    document.getElementById('hudBlueInv').textContent = `${playerRobot.inventory.length} / ${playerRobot.specs.capacity}`;
    document.getElementById('hudBlueStatus').textContent = getStatusText(playerRobot.state);

    // Left: Player 2 or Rival Bot (Red)
    if (CONFIG.gameMode === 2 && player2Robot) {
      if (p1Header) p1Header.textContent = '👥 JUGADOR 2 (ARROWS)';
      document.getElementById('hudRedInv').textContent = `${player2Robot.inventory.length} / ${player2Robot.specs.capacity}`;
      document.getElementById('hudRedStatus').textContent = getStatusText(player2Robot.state);
    } else {
      if (p1Header) p1Header.textContent = '🤖 BOT RIVAL 1 (AUTO)';
      if (redR1) {
        document.getElementById('hudRedInv').textContent = `${redR1.inventory.length} / ${redR1.specs.capacity}`;
        document.getElementById('hudRedStatus').textContent = getStatusText(redR1.state);
      }
    }
  }

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

// ── 13. GAME FLOW ────────────────────────────────────────────────
function startMatch() {
  readConfigFromUI();

  // Reset scores and stats
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

  PLAYER2_STATS.pickedUp = 0;
  PLAYER2_STATS.shot = 0;
  PLAYER2_STATS.hits = 0;
  PLAYER2_STATS.misses = 0;
  PLAYER2_STATS.distance = 0;

  hpRedQueue = [];
  hpBlueQueue = [];
  hpRedTimer = 0;
  hpBlueTimer = 0;
  hpRedThrowTimer = 0;
  hpBlueThrowTimer = 0;
  activeThrows = [];
  visualSplashes = [];
  matchTime = MATCH_DURATION;

  // Toggle HUD keyboard display for Player 2
  const p2ControlsKbd = document.getElementById('p2ControlsKbd');
  if (p2ControlsKbd) {
    p2ControlsKbd.style.display = CONFIG.gameMode === 2 ? 'block' : 'none';
  }

  showPhase('game');
  resizeGameCanvas();
  updateTimerDisplay();

  // Countdown Phase
  gamePhase = 'countdown';
  renderGame();
  const overlay = document.getElementById('countdownOverlay');
  const numEl = document.getElementById('countdownNumber');
  overlay.style.display = 'flex';

  let count = 3;
  numEl.textContent = count;
  playSound('countdown');

  const countInterval = setInterval(() => {
    count--;
    if (count > 0) {
      numEl.textContent = count;
      playSound('countdown');
    } else if (count === 0) {
      numEl.textContent = '¡GO!';
      numEl.style.color = '#2dd264';
      playSound('go');
    } else {
      clearInterval(countInterval);
      overlay.style.display = 'none';
      numEl.style.color = '';
      gamePhase = 'playing';
      startMatchTimer();
    }
  }, 1000);

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

function getRobotZoneKey(r) {
  if (!r || r.state !== 'climbing') return 'none';
  if (r.climbT > 0.66) return 'z3';
  if (r.climbT > 0.33) return 'z2';
  if (r.climbT > 0.05) return 'z1';
  return 'contact';
}

function isRobotABuddy(key) {
  const r = robots.find(bot => bot.id === key);
  if (r && r.state === 'climbing' && r.isBuddy) {
    return r.buddyOf.startsWith('red') ? (r.buddyOf.endsWith('1') ? 'redR1' : 'redR2') : (r.buddyOf.endsWith('1') ? 'blueR1' : 'blueR2');
  }
  return false;
}

function endMatch() {
  clearInterval(matchInterval);
  gamePhase = 'ended';
  playSound('game_over');

  const zones = {};
  robots.forEach(r => {
    zones[r.id] = getRobotZoneKey(r);
  });

  const pa = CONFIG.alliance;
  const ea = pa === 'red' ? 'blue' : 'red';

  // Multipliers Red
  const redMult = 1.0 +
    CLIMB_VALUES[zones['redR1']] +
    CLIMB_VALUES[zones['redR2']] +
    CLIMB_VALUES[zones['redR3']];

  // Multipliers Blue
  const blueMult = 1.0 +
    CLIMB_VALUES[zones['blueR1']] +
    CLIMB_VALUES[zones['blueR2']] +
    CLIMB_VALUES[zones['blueR3']];

  // Buddies score (+25 each)
  const redBuddies = robots.filter(r => r.alliance === 'red' && r.state === 'climbing' && r.isBuddy).length;
  const blueBuddies = robots.filter(r => r.alliance === 'blue' && r.state === 'climbing' && r.isBuddy).length;
  
  const redPartnerPts = redBuddies * 25;
  const bluePartnerPts = blueBuddies * 25;

  // Coopertition
  let robotsInZ3 = 0;
  robots.forEach(r => {
    if (zones[r.id] === 'z3') robotsInZ3++;
  });
  let cooptPts = 0;
  if (robotsInZ3 >= 6) cooptPts = 40;
  else if (robotsInZ3 >= 5) cooptPts = 25;
  else if (robotsInZ3 >= 4) cooptPts = 10;

  const redRegional = Math.ceil(SCORE.redSup * redMult) + redPartnerPts;
  const blueRegional = Math.ceil(SCORE.blueSup * blueMult) + bluePartnerPts;
  const redTotal = redRegional + SCORE.extinguisher + cooptPts;
  const blueTotal = blueRegional + SCORE.extinguisher + cooptPts;

  // Display scores
  showPhase('results');
  document.getElementById('resultRedScore').textContent = redTotal;
  document.getElementById('resultBlueScore').textContent = blueTotal;
  
  document.getElementById('rbRedSup').textContent = SCORE.redSup;
  document.getElementById('rbRedMult').textContent = `×${redMult.toFixed(2)}`;
  document.getElementById('rbRedRegional').textContent = redRegional;
  
  document.getElementById('rbBlueSup').textContent = SCORE.blueSup;
  document.getElementById('rbBlueMult').textContent = `×${blueMult.toFixed(2)}`;
  document.getElementById('rbBlueRegional').textContent = blueRegional;
  document.getElementById('rbExtTotal').textContent = SCORE.extinguisher + cooptPts;

  updateResultsStatsUI();

  // Setup click listener on Ir a Calculadora to carry match data
  const goCalcBtn = document.getElementById('goCalcBtn');
  if (goCalcBtn) {
    // Recreate listener to clear any old ones
    const newBtn = goCalcBtn.cloneNode(true);
    goCalcBtn.parentNode.replaceChild(newBtn, goCalcBtn);
    newBtn.addEventListener('click', () => {
      const matchData = {
        redBalls: SCORE.redSup,
        blueBalls: SCORE.blueSup,
        extBalls: SCORE.extinguisher,
        robots: {
          redR1: getRobotZoneKey(robots.find(r => r.id === 'redR1')),
          redR2: getRobotZoneKey(robots.find(r => r.id === 'redR2')),
          redR3: getRobotZoneKey(robots.find(r => r.id === 'redR3')),
          blueR1: getRobotZoneKey(robots.find(r => r.id === 'blueR1')),
          blueR2: getRobotZoneKey(robots.find(r => r.id === 'blueR2')),
          blueR3: getRobotZoneKey(robots.find(r => r.id === 'blueR3'))
        },
        buddies: {
          redR2: isRobotABuddy('redR2'),
          redR3: isRobotABuddy('redR3'),
          blueR2: isRobotABuddy('blueR2'),
          blueR3: isRobotABuddy('blueR3')
        }
      };
      localStorage.setItem('fgc_match_result', JSON.stringify(matchData));
      window.location.href = 'index.html';
    });
  }
}

function showPhase(phase) {
  document.getElementById('setupScreen').style.display = phase === 'setup' ? 'flex' : 'none';
  document.getElementById('gameScreen').style.display = phase === 'game' ? 'flex' : 'none';
  document.getElementById('resultsScreen').style.display = phase === 'results' ? 'flex' : 'none';
}

function updateResultsStatsUI() {
  const card = document.querySelector('.player-stats-card');
  if (CONFIG.gameMode === 2 && player2Robot) {
    const p1Shots = PLAYER_STATS.hits + PLAYER_STATS.misses;
    const p1Acc = p1Shots > 0 ? `${Math.round(PLAYER_STATS.hits / p1Shots * 100)}%` : '—';
    const p2Shots = PLAYER2_STATS.hits + PLAYER2_STATS.misses;
    const p2Acc = p2Shots > 0 ? `${Math.round(PLAYER2_STATS.hits / p2Shots * 100)}%` : '—';

    card.innerHTML = `
      <h3>📊 ESTADÍSTICAS DE JUGADORES</h3>
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
        <div>
          <h4 style="font-size: 0.72rem; color: var(--col-yellow); margin-bottom: 6px; letter-spacing: 0.5px;">👤 JUGADOR 1 (WASD)</h4>
          <div class="ps-grid" style="grid-template-columns: 1fr; gap: 5px;">
            <div class="ps-item"><span>Pelotas Recogidas</span><strong>${PLAYER_STATS.pickedUp}</strong></div>
            <div class="ps-item"><span>Pelotas Disparadas</span><strong>${PLAYER_STATS.shot}</strong></div>
            <div class="ps-item"><span>Precisión Real</span><strong>${p1Acc}</strong></div>
            <div class="ps-item"><span>Distancia</span><strong>${PLAYER_STATS.distance.toFixed(1)} m</strong></div>
          </div>
        </div>
        <div>
          <h4 style="font-size: 0.72rem; color: var(--blue-light); margin-bottom: 6px; letter-spacing: 0.5px;">👥 JUGADOR 2 (ARROWS)</h4>
          <div class="ps-grid" style="grid-template-columns: 1fr; gap: 5px;">
            <div class="ps-item"><span>Pelotas Recogidas</span><strong>${PLAYER2_STATS.pickedUp}</strong></div>
            <div class="ps-item"><span>Pelotas Disparadas</span><strong>${PLAYER2_STATS.shot}</strong></div>
            <div class="ps-item"><span>Precisión Real</span><strong>${p2Acc}</strong></div>
            <div class="ps-item"><span>Distancia</span><strong>${PLAYER2_STATS.distance.toFixed(1)} m</strong></div>
          </div>
        </div>
      </div>
    `;
  } else {
    const totalShots = PLAYER_STATS.hits + PLAYER_STATS.misses;
    const p1Acc = totalShots > 0 ? `${Math.round(PLAYER_STATS.hits / totalShots * 100)}%` : '—';
    card.innerHTML = `
      <h3>📊 TUS ESTADÍSTICAS</h3>
      <div class="ps-grid">
        <div class="ps-item"><span>Pelotas Recogidas</span><strong>${PLAYER_STATS.pickedUp}</strong></div>
        <div class="ps-item"><span>Pelotas Disparadas</span><strong>${PLAYER_STATS.shot}</strong></div>
        <div class="ps-item"><span>Aciertos</span><strong>${PLAYER_STATS.hits}</strong></div>
        <div class="ps-item"><span>Fallos</span><strong>${PLAYER_STATS.misses}</strong></div>
        <div class="ps-item"><span>Precisión Real</span><strong>${p1Acc}</strong></div>
        <div class="ps-item"><span>Distancia Recorrida</span><strong>${PLAYER_STATS.distance.toFixed(1)} m</strong></div>
      </div>
    `;
  }
}

// ── 14. UI SETUP ─────────────────────────────────────────────────
function readConfigFromUI() {
  CONFIG.specs.moveSpeed = parseFloat(document.getElementById('moveSpeed').value);
  CONFIG.specs.pickupSpeed = parseFloat(document.getElementById('pickupSpeed').value);
  CONFIG.specs.shotSpeed = parseFloat(document.getElementById('shotSpeed').value);
  CONFIG.specs.capacity = parseInt(document.getElementById('capacity').value);
  CONFIG.specs.accuracy = parseInt(document.getElementById('accuracy').value);
  CONFIG.specs.climbSpeed = parseFloat(document.getElementById('climbSpeed').value);
  CONFIG.hpAccuracy = parseInt(document.getElementById('hpAccuracy').value);
  
  CONFIG.allyMultiplier = parseFloat(document.getElementById('allyDiffSlider').value);
  CONFIG.rivalMultiplier = parseFloat(document.getElementById('rivalDiffSlider').value);
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
          initRobots();
        } else if (groupId === 'teamToggle') {
          CONFIG.teamNumber = parseInt(val);
          initRobots();
        } else if (groupId === 'gameModeToggle') {
          CONFIG.gameMode = parseInt(val);
          initRobots();
        } else if (groupId === 'allyDifficulty') {
          const v = parseFloat(val);
          CONFIG.allyMultiplier = v;
          document.getElementById('allyDiffSlider').value = v;
          document.getElementById('allyDiffVal').textContent = v.toFixed(2);
          initRobots();
        } else if (groupId === 'rivalDifficulty') {
          const v = parseFloat(val);
          CONFIG.rivalMultiplier = v;
          document.getElementById('rivalDiffSlider').value = v;
          document.getElementById('rivalDiffVal').textContent = v.toFixed(2);
          initRobots();
        }
        renderSetupPreview();
      });
    });
  });

  // Bot difficulty sliders
  const allyDiffSlider = document.getElementById('allyDiffSlider');
  const allyDiffVal = document.getElementById('allyDiffVal');
  if (allyDiffSlider && allyDiffVal) {
    allyDiffSlider.addEventListener('input', () => {
      const v = parseFloat(allyDiffSlider.value);
      allyDiffVal.textContent = v.toFixed(2);
      CONFIG.allyMultiplier = v;
      
      const group = document.getElementById('allyDifficulty');
      group.querySelectorAll('.toggle-btn').forEach(btn => btn.classList.remove('active'));
      const matching = group.querySelector(`.toggle-btn[data-value="${v.toFixed(1)}"]`);
      if (matching) matching.classList.add('active');
      initRobots();
      renderSetupPreview();
    });
  }

  const rivalDiffSlider = document.getElementById('rivalDiffSlider');
  const rivalDiffVal = document.getElementById('rivalDiffVal');
  if (rivalDiffSlider && rivalDiffVal) {
    rivalDiffSlider.addEventListener('input', () => {
      const v = parseFloat(rivalDiffSlider.value);
      rivalDiffVal.textContent = v.toFixed(2);
      CONFIG.rivalMultiplier = v;

      const group = document.getElementById('rivalDifficulty');
      group.querySelectorAll('.toggle-btn').forEach(btn => btn.classList.remove('active'));
      const matching = group.querySelector(`.toggle-btn[data-value="${v.toFixed(1)}"]`);
      if (matching) matching.classList.add('active');
      initRobots();
      renderSetupPreview();
    });
  }

  // Sliders mapping
  const sliderMappings = [
    { id: 'moveSpeed', display: 'moveSpeedVal', suffix: ' m/s', decimals: 1 },
    { id: 'pickupSpeed', display: 'pickupSpeedVal', suffix: ' pelotas/s', decimals: 1 },
    { id: 'shotSpeed', display: 'shotSpeedVal', suffix: ' pelotas/s', decimals: 1 },
    { id: 'capacity', display: 'capacityVal', suffix: ' pelotas', decimals: 0 },
    { id: 'accuracy', display: 'accuracyVal', suffix: '%', decimals: 0 },
    { id: 'climbSpeed', display: 'climbSpeedVal', suffix: ' m/s', decimals: 1 },
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

  // Play again button
  document.getElementById('playAgainBtn').addEventListener('click', () => {
    if (animationId) cancelAnimationFrame(animationId);
    clearInterval(matchInterval);
    gamePhase = 'setup';
    showPhase('setup');
    resizeSetupCanvas();
    renderSetupPreview();
  });

  // Go to calculator button
  document.getElementById('goCalcBtn').addEventListener('click', () => {
    window.location.href = 'index.html';
  });
}

// ── 15. INITIALIZATION ───────────────────────────────────────────
window.addEventListener('DOMContentLoaded', () => {
  initCanvases();
  initSetupUI();
  readConfigFromUI();
  initBalls();
  initRobots();
  resizeSetupCanvas();
  renderSetupPreview();
});

window.addEventListener('resize', () => {
  if (gamePhase === 'playing' || gamePhase === 'countdown') {
    resizeGameCanvas();
  } else if (gamePhase === 'setup') {
    resizeSetupCanvas();
    renderSetupPreview();
  }
});
