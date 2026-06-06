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

// Official diagonal braces and field zones (origin top-left)
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

// Official diagonal braces layout (from bottom corner to extinguisher edges)
const BRACES = {
  red: { startX: 0.5, startY: 6.5, endX: 2.8, endY: 0.65 },
  blue: { startX: 6.5, startY: 6.5, endX: 4.2, endY: 0.65 }
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
      // High-pitched bell/chime
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1568, now); // G6
      gainNode.gain.setValueAtTime(0.06, now);
      gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
      osc.start(now);
      osc.stop(now + 0.35);
    } else if (type === 'climb') {
      // Low motor cranking sound
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

// Programmatic background keying (makes solid black transparent)
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
      // Key out dark background colors
      if (r < 20 && g < 20 && b < 20) {
        data[i+3] = 0; // Transparent alpha
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
  gameMode: 1, // 1 = Solo, 2 = 2 Jugadores Coop
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
    e.preventDefault(); // prevent keyboard browser scrolling
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
    // 60% of balls scattered in central zone, 40% near sides
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
      state: 'field', // 'field' | 'held' | 'flying' | 'flying_hp' | 'scored_red' | 'scored_blue' | 'extinguished'
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
          // Scored Hit!
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
          // Missed suppression unit
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
let player2Robot = null;

function initRobots() {
  robots = [];
  playerRobot = null;
  player2Robot = null;
  const pa = CONFIG.alliance;
  const ea = pa === 'red' ? 'blue' : 'red';

  const pStartX = pa === 'red' ? 0.35 : FIELD_M - 0.35;
  const eStartX = ea === 'red' ? 0.35 : FIELD_M - 0.35;

  const teamPositions = [
    { y: FIELD_M * 0.70 },
    { y: FIELD_M * 0.82 },
    { y: FIELD_M * 0.94 - 0.1 },
  ];

  // Create player alliance robots
  for (let i = 0; i < 3; i++) {
    const isP1 = (i === 0);
    const isP2 = (i === 1 && CONFIG.gameMode === 2);
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

// Check if robot is in Contact Zone C
function inContactZone(robot) {
  const brace = BRACES[robot.alliance];
  const dx = robot.x - brace.startX;
  const dy = robot.y - brace.startY;
  return Math.sqrt(dx*dx + dy*dy) < 0.65;
}

// ── 7. PLAYER INPUT & CLIMB UPDATE ────────────────────────────────
function updatePlayerRobot(r, dt) {
  if (!r || gamePhase !== 'playing') return;

  // 🧗 Escalada (Climbing) State
  if (r.state === 'climbing') {
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
      
      // Calculate speed scaling if buddy attached
      let speedScale = 1.0;
      const hasBuddy = robots.some(a => a.state === 'climbing' && a.isBuddy && a.buddyOf === r.id);
      if (hasBuddy) speedScale = 0.55; // 55% speed with buddy
      
      r.climbT = Math.max(0, Math.min(1.0, r.climbT + climbDir * (r.specs.climbSpeed / len) * dt * speedScale));
      
      if (performance.now() - lastClimbSoundTime > 150) {
        playSound('climb');
        lastClimbSoundTime = performance.now();
      }
    }
    
    const brace = BRACES[r.alliance];
    r.x = brace.startX + (brace.endX - brace.startX) * r.climbT;
    r.y = brace.startY + (brace.endY - brace.startY) * r.climbT;
    r.angle = Math.atan2(brace.endY - brace.startY, brace.endX - brace.startX);
    
    // Drag buddy
    robots.forEach(a => {
      if (a.state === 'climbing' && a.isBuddy && a.buddyOf === r.id) {
        a.climbT = Math.max(0, r.climbT - 0.15); // Buddy offsets behind
        a.x = brace.startX + (brace.endX - brace.startX) * a.climbT;
        a.y = brace.startY + (brace.endY - brace.startY) * a.climbT;
        a.angle = r.angle;
      }
    });
    return;
  }

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

  // Diagonal normalization
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
      // Throw ball to fire shield → queues human player throw
      const ballIdx = r.inventory.shift();
      balls[ballIdx].state = 'held'; // temporarily
      handleHumanPlayer(ballIdx, r.alliance);
      r.shootCooldown = 1.0 / r.specs.shotSpeed;
      if (r.isPlayer1) PLAYER_STATS.shot++;
      else if (r.isPlayer2) PLAYER2_STATS.shot++;
    }
  }

  // Climb Action (O / I)
  const climbKey = r.isPlayer2 ? 'i' : 'o';
  if (KEYS[climbKey] && inContactZone(r)) {
    r.state = 'climbing';
    r.climbT = 0.05;
    
    // Auto-attach closest ally in Contact Zone as buddy
    let closestAlly = null;
    let closestDist = Infinity;
    robots.forEach(a => {
      if (a.id !== r.id && a.alliance === r.alliance && a.state !== 'climbing') {
        const d = Math.hypot(a.x - r.x, a.y - r.y);
        if (d < 0.85 && d < closestDist) {
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

// ── 8. BOT AI & AUTO CLIMB ───────────────────────────────────────
function updateBotAI(robot, dt) {
  if (robot.isPlayer || gamePhase !== 'playing') return;
  const r = robot;
  r.pickupCooldown = Math.max(0, r.pickupCooldown - dt);
  r.shootCooldown = Math.max(0, r.shootCooldown - dt);
  r.aiWait = Math.max(0, r.aiWait - dt);

  // Late Match: Rush to climb ramp
  if (matchTime <= 20) {
    r.aiState = 'seek_climb';
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
        moveToward(r, target.x + 0.3, target.y + 0.3, dt);
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
      const brace = BRACES[r.alliance];
      const dist = Math.hypot(r.x - brace.startX, r.y - brace.startY);
      if (dist < 0.4) {
        // Enter climbing state!
        r.state = 'climbing';
        r.climbT = 0.05;
        
        // Auto-attach buddy climber
        let closestAlly = null;
        let closestDist = Infinity;
        robots.forEach(a => {
          if (a.id !== r.id && a.alliance === r.alliance && a.state !== 'climbing') {
            const d = Math.hypot(a.x - r.x, a.y - r.y);
            if (d < 0.85 && d < closestDist) {
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

let hpRedThrowTimer = 0; // emoji pose visual timer
let hpBlueThrowTimer = 0;

let activeThrows = []; // Parabolic throws on screen
let visualSplashes = []; // Particle impacts on target

function handleHumanPlayer(ballIdx, alliance) {
  if (alliance === 'red') {
    hpRedQueue.push(ballIdx);
  } else {
    hpBlueQueue.push(ballIdx);
  }
}

function updateHumanPlayers(dt) {
  // Anim timers for HP emoji
  hpRedThrowTimer = Math.max(0, hpRedThrowTimer - dt);
  hpBlueThrowTimer = Math.max(0, hpBlueThrowTimer - dt);

  // Red Human
  hpRedTimer += dt;
  if (hpRedTimer >= (1 / HP_RATE) && hpRedQueue.length > 0) {
    hpRedTimer = 0;
    const idx = hpRedQueue.shift();
    const isHit = Math.random() * 100 < CONFIG.hpAccuracy;
    
    // HP Position (left side bottom corner)
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
      duration: 0.9 // seconds in flight
    });

    balls[idx].state = 'flying_hp';
    hpRedThrowTimer = 0.45; // pose duration
  }

  // Blue Human
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

  // Update flying HP throws
  for (let i = activeThrows.length - 1; i >= 0; i--) {
    const th = activeThrows[i];
    th.t += dt / th.duration;

    if (th.t >= 1.0) {
      // Arrived at extinguisher target
      if (th.isHit) {
        balls[th.ballIdx].state = 'extinguished';
        SCORE.extinguisher++;
        playSound('extinguisher');
        createSplash(th.targetX, th.targetY, COL.ball);
      } else {
        // Bounce off target back to field
        balls[th.ballIdx].state = 'field';
        balls[th.ballIdx].x = th.targetX;
        balls[th.ballIdx].y = th.targetY;
        balls[th.ballIdx].vx = (Math.random() - 0.5) * 3;
        balls[th.ballIdx].vy = 2.0 + Math.random() * 2.0; // falling bounce
        playSound('shoot');
      }
      activeThrows.splice(i, 1);
    } else {
      const t = th.t;
      // Parabolic equation
      th.x = th.startX + (th.targetX - th.startX) * t;
      th.y = th.startY + (th.targetY - th.startY) * t - Math.sin(t * Math.PI) * 1.8; // Peak height of 1.8 meters
      
      balls[th.ballIdx].x = th.x;
      balls[th.ballIdx].y = th.y;
    }
  }

  // Update visual splashes
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
    life: 0.35 // 350ms lifespan
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
  if (w <= 0 || h <= 0) return; // Guard: skip if hidden
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
  const size = Math.min(w, h - 24); // Subtract text spacer height
  const dpr = window.devicePixelRatio || 1;
  setupCanvas.width = size * dpr;
  setupCanvas.height = size * dpr;
  setupCanvas.style.width = size + 'px';
  setupCanvas.style.height = size + 'px';
  setupCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
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

  // Field background
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

  // Shoot zones and Fire Shield Zones
  drawZone(c, ZONES.shootRedZone, 'rgba(232,48,72,0.04)', 'rgba(232,48,72,0.08)');
  drawZone(c, ZONES.shootBlueZone, 'rgba(51,119,255,0.04)', 'rgba(51,119,255,0.08)');
  drawZone(c, ZONES.fsRedZone, 'rgba(232,48,72,0.03)', 'rgba(232,48,72,0.06)');
  drawZone(c, ZONES.fsBlueZone, 'rgba(51,119,255,0.03)', 'rgba(51,119,255,0.06)');

  // Contact Zone Circles
  drawContactZone(c, 'red');
  drawContactZone(c, 'blue');

  // Suppression Units
  drawSuppressionUnit(c, ZONES.supRed, COL.supRed, 'rgba(232,48,72,0.3)', 'SUP RED', SCORE.redSup);
  drawSuppressionUnit(c, ZONES.supBlue, COL.supBlue, 'rgba(51,119,255,0.3)', 'SUP BLUE', SCORE.blueSup);

  // Extinguisher
  drawExtinguisher(c);

  // Fire Shields
  drawFireShield(c, ZONES.fireShieldRed, 'rgba(232,48,72,0.08)', '🛡', 'RED');
  drawFireShield(c, ZONES.fireShieldBlue, 'rgba(51,119,255,0.08)', '🛡', 'BLUE');

  // Official diagonal steel Braces (drawn behind robots)
  drawBrace(c, 'red');
  drawBrace(c, 'blue');

  // Human Players (outside field)
  drawHumanPlayer(c, 'red');
  drawHumanPlayer(c, 'blue');

  // Guardrails (bottom edge)
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

  // Balls scatter
  renderBalls(c);

  // Golden chain links for supported buddy robots
  renderGoldenChains(c);

  // Active Human player thrown balls
  renderHPThrownBalls(c);

  // Splash particles
  renderSplashes(c);

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

  c.fillStyle = textColor;
  c.font = `bold ${S() * 0.013}px Montserrat`;
  c.textAlign = 'center';
  c.fillText(label, px + pw / 2, py + 16);

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

function drawBrace(c, alliance) {
  const isRed = alliance === 'red';
  const brace = BRACES[alliance];
  const px1 = mToP(brace.startX);
  const py1 = mToP(brace.startY);
  const px2 = mToP(brace.endX);
  const py2 = mToP(brace.endY);
  
  // Steel pipe core
  c.strokeStyle = 'rgba(90, 100, 110, 0.4)';
  c.lineWidth = 10;
  c.beginPath();
  c.moveTo(px1, py1);
  c.lineTo(px2, py2);
  c.stroke();
  
  // Alliance heat shrink cover
  c.strokeStyle = isRed ? 'rgba(232, 48, 72, 0.7)' : 'rgba(51, 119, 255, 0.7)';
  c.lineWidth = 6;
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
    c.lineWidth = 2.5;
    c.beginPath();
    c.moveTo(mToP(tx - nx * 0.12), mToP(ty - ny * 0.12));
    c.lineTo(mToP(tx + nx * 0.12), mToP(ty + ny * 0.12));
    c.stroke();
  });
  
  // Zone labels
  c.fillStyle = 'rgba(255,255,255,0.45)';
  c.font = 'bold 8px Montserrat';
  c.textAlign = 'center';
  
  const labelT = [0.165, 0.495, 0.825];
  const labelNames = ['ZONA 1', 'ZONA 2', 'ZONA 3'];
  labelT.forEach((t, i) => {
    const tx = brace.startX + (brace.endX - brace.startX) * t;
    const ty = brace.startY + (brace.endY - brace.startY) * t;
    c.fillText(labelNames[i], mToP(tx + (isRed ? -0.22 : 0.22)), mToP(ty) + 3);
  });
}

function drawContactZone(c, alliance) {
  const isRed = alliance === 'red';
  const brace = BRACES[alliance];
  const px = mToP(brace.startX);
  const py = mToP(brace.startY);
  
  c.strokeStyle = isRed ? 'rgba(232, 48, 72, 0.35)' : 'rgba(51, 119, 255, 0.35)';
  c.fillStyle = isRed ? 'rgba(232, 48, 72, 0.05)' : 'rgba(51, 119, 255, 0.05)';
  c.lineWidth = 1.5;
  c.beginPath();
  c.arc(px, py, mToP(0.65), 0, Math.PI * 2);
  c.fill();
  c.stroke();
  
  c.fillStyle = isRed ? 'rgba(232, 48, 72, 0.5)' : 'rgba(51, 119, 255, 0.5)';
  c.font = 'bold 9px Montserrat';
  c.textAlign = 'center';
  c.fillText('C', px, py + 3);
}

function drawHumanPlayer(c, alliance) {
  const isRed = alliance === 'red';
  const x = isRed ? -0.3 : FIELD_M + 0.3;
  const y = 6.3;
  const px = mToP(x);
  const py = mToP(y);
  
  const queue = isRed ? hpRedQueue : hpBlueQueue;
  const throwTimer = isRed ? hpRedThrowTimer : hpBlueThrowTimer;

  // Toggle emoji based on throw animation timer
  const emoji = throwTimer > 0 ? '🙆‍♂️' : '🧑';

  c.save();
  if (throwTimer > 0) {
    // scale jump effect
    c.translate(px, py);
    c.scale(1.25, 1.25);
    c.translate(-px, -py);
  }

  c.font = `${S() * 0.03}px sans-serif`;
  c.textAlign = 'center';
  c.fillText(emoji, px, py);
  c.restore();

  // Draw queue length indicator
  if (queue.length > 0) {
    c.fillStyle = '#ffd700';
    c.font = `bold ${S() * 0.012}px Orbitron`;
    c.fillText(`${queue.length}`, px, py + 18);
  }

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
      c.strokeStyle = 'rgba(255,179,71,0.2)';
      c.lineWidth = 1;
      c.setLineDash([2, 2]);
      c.beginPath();
      c.moveTo(mToP(b.x), mToP(b.y));
      c.lineTo(mToP(b.targetX), mToP(b.targetY));
      c.stroke();
      c.setLineDash([]);

      c.fillStyle = COL.ballFlying;
      c.shadowColor = 'rgba(255,179,71,0.5)';
      c.shadowBlur = 5;
      c.beginPath();
      c.arc(mToP(b.x), mToP(b.y), ballR + 1, 0, Math.PI * 2);
      c.fill();
      c.shadowColor = 'transparent';
      c.shadowBlur = 0;
    }
  });
}

function renderHPThrownBalls(c) {
  const ballR = Math.max(2, mToP(BALL_RADIUS_M));
  activeThrows.forEach(th => {
    // 3D scale curve peaking in middle of throw
    const sizeScale = 1.0 + Math.sin(th.t * Math.PI) * 0.9;
    
    c.fillStyle = COL.ballFlying;
    c.shadowColor = 'rgba(255,179,71,0.6)';
    c.shadowBlur = 8;
    c.beginPath();
    c.arc(mToP(th.x), mToP(th.y), ballR * sizeScale, 0, Math.PI * 2);
    c.fill();
    c.shadowColor = 'transparent';
    c.shadowBlur = 0;
  });
}

function renderSplashes(c) {
  visualSplashes.forEach(s => {
    c.fillStyle = s.color;
    c.globalAlpha = s.life / 0.35;
    s.particles.forEach(p => {
      c.beginPath();
      c.arc(mToP(p.x), mToP(p.y), 2.5, 0, Math.PI * 2);
      c.fill();
    });
    c.globalAlpha = 1.0;
  });
}

function renderGoldenChains(c) {
  robots.forEach(a => {
    if (a.state === 'climbing' && a.isBuddy && a.buddyOf) {
      const climber = robots.find(r => r.id === a.buddyOf);
      if (climber) {
        const px1 = mToP(climber.x);
        const py1 = mToP(climber.y);
        const px2 = mToP(a.x);
        const py2 = mToP(a.y);

        c.strokeStyle = '#ffd700'; // Golden chain link
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

        // Draw chain connector visual helper
        c.fillStyle = '#ffd700';
        c.font = '13px sans-serif';
        c.textAlign = 'center';
        c.fillText('🔗', (px1 + px2) / 2, (py1 + py2) / 2 + 5);
      }
    }
  });
}

function renderRobots(c) {
  const pa = CONFIG.alliance;
  robots.forEach(r => {
    const px = mToP(r.x);
    const py = mToP(r.y);
    const size = mToP(ROBOT_SIZE_M);
    const half = size / 2;

    c.save();
    c.translate(px, py);

    // Glowing halo around active controllable players
    if (r.isPlayer) {
      c.shadowColor = r.isPlayer2 ? 'rgba(92,154,255,0.45)' : 'rgba(255,215,0,0.45)';
      c.shadowBlur = 12;
    }

    // Select PNG texture or fallback to vector
    const baseTex = r.id === `${pa}R1` ? ROBOT_IMAGES.colombia : (r.alliance === pa ? ROBOT_IMAGES.ally : ROBOT_IMAGES.rival);
    const processedTex = r.id === `${pa}R1` ? ROBOT_TEXTURES.colombia : (r.alliance === pa ? ROBOT_TEXTURES.ally : ROBOT_TEXTURES.rival);
    const texture = processedTex || baseTex;

    if (texture && texture.complete && texture.naturalWidth > 0) {
      c.rotate(r.angle);
      c.drawImage(texture, -half, -half, size, size);
    } else {
      // Fallback Vector Box
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

      // Heading arrow indicator
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

    // Inventory fill bar (above robot)
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

    // Floating text label
    let label = r.isPlayer1 ? '★ TÚ' : r.isPlayer2 ? '★ P2' : r.id.slice(-2);
    c.fillStyle = 'rgba(10,12,20,0.8)';
    c.beginPath();
    c.roundRect(-16, half + 2, 32, 12, 3);
    c.fill();
    c.fillStyle = r.isPlayer1 ? COL.playerHighlight : r.isPlayer2 ? '#5c9aff' : '#ccc';
    c.font = `bold ${S() * 0.009}px Montserrat`;
    c.textAlign = 'center';
    c.fillText(label, 0, half + 11);

    c.restore();
  });
}

// ── 11. SETUP VIEW PREVIEW ───────────────────────────────────────
function renderSetupPreview() {
  if (!setupCtx) return;
  const c = setupCtx;
  const cw = setupCanvas.style.width ? parseFloat(setupCanvas.style.width) : 500;
  const s = cw;
  c.clearRect(0, 0, s, s);

  function m2p(m) { return (m / FIELD_M) * s; }

  // BG
  c.fillStyle = COL.fieldBg;
  c.fillRect(0, 0, s, s);

  // Border
  c.strokeStyle = 'rgba(255,255,255,0.06)';
  c.lineWidth = 1.5;
  c.strokeRect(1, 1, s - 2, s - 2);

  // Draw Braces lines
  const pa = CONFIG.alliance;
  const ea = pa === 'red' ? 'blue' : 'red';
  
  c.strokeStyle = pa === 'red' ? 'rgba(232,48,72,0.4)' : 'rgba(51,119,255,0.4)';
  c.lineWidth = 4;
  c.beginPath();
  c.moveTo(m2p(BRACES[pa].startX), m2p(BRACES[pa].startY));
  c.lineTo(m2p(BRACES[pa].endX), m2p(BRACES[pa].endY));
  c.stroke();

  c.strokeStyle = ea === 'red' ? 'rgba(232,48,72,0.15)' : 'rgba(51,119,255,0.15)';
  c.beginPath();
  c.moveTo(m2p(BRACES[ea].startX), m2p(BRACES[ea].startY));
  c.lineTo(m2p(BRACES[ea].endX), m2p(BRACES[ea].endY));
  c.stroke();

  // Contact Zone Circles
  c.fillStyle = pa === 'red' ? 'rgba(232,48,72,0.06)' : 'rgba(51,119,255,0.06)';
  c.beginPath();
  c.arc(m2p(BRACES[pa].startX), m2p(BRACES[pa].startY), m2p(0.65), 0, Math.PI * 2);
  c.fill();
  c.fillStyle = pa === 'red' ? 'rgba(232,48,72,0.3)' : 'rgba(51,119,255,0.3)';
  c.font = 'bold 9px Montserrat';
  c.textAlign = 'center';
  c.fillText('CONTACTO C', m2p(BRACES[pa].startX), m2p(BRACES[pa].startY) + 3);

  // Draw setup position boxes
  const pStartX = pa === 'red' ? 0.35 : FIELD_M - 0.35;
  const eStartX = ea === 'red' ? 0.35 : FIELD_M - 0.35;

  const teamPositions = [
    { y: FIELD_M * 0.70 },
    { y: FIELD_M * 0.82 },
    { y: FIELD_M * 0.94 - 0.1 },
  ];

  const size = m2p(ROBOT_SIZE_M);

  // Allies
  teamPositions.forEach((pos, idx) => {
    const isPlayer1 = (idx === 0);
    const isPlayer2 = (idx === 1 && CONFIG.gameMode === 2);
    const isPlayer = isPlayer1 || isPlayer2;
    const y = pos.y;

    c.fillStyle = pa === 'red' ? COL.redBot : COL.blueBot;
    c.beginPath();
    c.roundRect(m2p(pStartX) - size / 2, m2p(y) - size / 2, size, size, 4);
    c.fill();

    if (isPlayer) {
      c.strokeStyle = isPlayer2 ? '#5c9aff' : COL.playerHighlight;
      c.lineWidth = 2;
      c.stroke();
      c.fillStyle = isPlayer2 ? '#5c9aff' : COL.playerHighlight;
      c.font = 'bold 9px Montserrat';
      c.textAlign = 'center';
      c.fillText(isPlayer2 ? '★ P2' : '★ TÚ', m2p(pStartX), m2p(y) + size / 2 + 10);
    }

    // Enemy alliance
    c.fillStyle = ea === 'red' ? COL.redBot : COL.blueBot;
    c.beginPath();
    c.roundRect(m2p(eStartX) - size / 2, m2p(y) - size / 2, size, size, 4);
    c.fill();
  });

  // Labels
  c.fillStyle = 'rgba(255,255,255,0.12)';
  c.font = `bold ${s * 0.022}px Montserrat`;
  c.textAlign = 'center';
  c.fillText('SUPPRESSION RED', m2p(0.5), m2p(0.2));
  c.fillText('SUPPRESSION BLUE', m2p(6.5), m2p(0.2));
  c.fillText('EXTINGUISHER', m2p(3.5), m2p(0.35));
}

// ── 12. GAME LOOP ────────────────────────────────────────────────
let lastFrameTime = 0;
let animationId = null;

function gameLoop(timestamp) {
  const dt = Math.min((timestamp - lastFrameTime) / 1000, 0.05); // cap frame step
  lastFrameTime = timestamp;

  if (gamePhase === 'playing') {
    rebuildSpatialGrid();
    
    // Update robots (climbing vs normal driving/bot AI)
    robots.forEach(r => {
      if (r.state === 'climbing') {
        if (!r.isPlayer && !r.isBuddy) {
          // AI bot climbing update
          const brace = BRACES[r.alliance];
          const dx = brace.endX - brace.startX;
          const dy = brace.endY - brace.startY;
          const len = Math.sqrt(dx*dx + dy*dy);
          
          let speedScale = 1.0;
          const hasBuddy = robots.some(a => a.state === 'climbing' && a.isBuddy && a.buddyOf === r.id);
          if (hasBuddy) speedScale = 0.55;

          r.climbT = Math.min(0.9, r.climbT + (r.specs.climbSpeed / len) * dt * speedScale); // bots climb up to 90%
          r.x = brace.startX + (brace.endX - brace.startX) * r.climbT;
          r.y = brace.startY + (brace.endY - brace.startY) * r.climbT;
          r.angle = Math.atan2(brace.endY - brace.startY, brace.endX - brace.startX);

          // Drag buddy
          robots.forEach(a => {
            if (a.state === 'climbing' && a.isBuddy && a.buddyOf === r.id) {
              a.climbT = Math.max(0, r.climbT - 0.15);
              a.x = brace.startX + (brace.endX - brace.startX) * a.climbT;
              a.y = brace.startY + (brace.endY - brace.startY) * a.climbT;
              a.angle = r.angle;
            }
          });
        }
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
  document.getElementById('gsRedScore').textContent = SCORE.redSup;
  document.getElementById('gsBlueScore').textContent = SCORE.blueSup;
  document.getElementById('gsExtScore').textContent = SCORE.extinguisher;
  
  if (CONFIG.gameMode === 2 && player2Robot) {
    document.getElementById('hudInventory').textContent = `P1: ${playerRobot.inventory.length}/${playerRobot.specs.capacity} | P2: ${player2Robot.inventory.length}/${player2Robot.specs.capacity}`;
    
    let p1Status = playerRobot.state === 'moving' ? '🏃' : playerRobot.state === 'picking' ? 'Intake' : playerRobot.state === 'shooting' ? '🎯' : playerRobot.state === 'climbing' ? '🧗' : 'Quieto';
    let p2Status = player2Robot.state === 'moving' ? '🏃' : player2Robot.state === 'picking' ? 'Intake' : player2Robot.state === 'shooting' ? '🎯' : player2Robot.state === 'climbing' ? '🧗' : 'Quieto';
    document.getElementById('hudStatus').textContent = `P1: ${p1Status} | P2: ${p2Status}`;
  } else {
    document.getElementById('hudInventory').textContent = `${playerRobot.inventory.length} / ${playerRobot.specs.capacity}`;
    let status = 'Quieto';
    if (playerRobot.state === 'moving') status = '🏃 Moviéndose';
    else if (playerRobot.state === 'picking') status = '⬇ Recogiendo';
    else if (playerRobot.state === 'shooting') status = '🎯 Disparando';
    else if (playerRobot.state === 'climbing') status = '🧗 Escalando';
    document.getElementById('hudStatus').textContent = status;
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

  // Toggle HUD descriptions
  const controlsEl = document.querySelector('.hud-controls');
  if (CONFIG.gameMode === 2) {
    controlsEl.innerHTML = `
      <span>P1: <kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd>, <kbd>P</kbd>, <kbd>SPACE</kbd>, <kbd>O</kbd></span>
      <span style="margin-left: 10px; border-left: 1px solid rgba(255,255,255,0.15); padding-left: 10px;">P2: <kbd>↑</kbd><kbd>↓</kbd><kbd>←</kbd><kbd>→</kbd>, <kbd>K</kbd>, <kbd>L</kbd>, <kbd>I</kbd></span>
    `;
  } else {
    controlsEl.innerHTML = `
      <kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> Mover
      <kbd>P</kbd> Recoger
      <kbd>SPACE</kbd> Lanzar
      <kbd>O</kbd> Escalar
    `;
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

function endMatch() {
  clearInterval(matchInterval);
  gamePhase = 'ended';
  playSound('game_over');

  // Compute zone heights for all robots along braces to apply multipliers
  function getRobotZone(r) {
    if (r.state !== 'climbing') return 'none';
    if (r.climbT > 0.66) return 'z3';
    if (r.climbT > 0.33) return 'z2';
    if (r.climbT > 0.0) return 'z1';
    return 'contact';
  }

  const zones = {};
  robots.forEach(r => {
    zones[r.id] = getRobotZone(r);
  });

  const pa = CONFIG.alliance;
  const ea = pa === 'red' ? 'blue' : 'red';

  // Multiplier formulas FGC Incheon 2026
  const redMult = 1.0 +
    CLIMB_VALUES[zones['redR1']] +
    CLIMB_VALUES[zones['redR2']] +
    CLIMB_VALUES[zones['redR3']];

  const blueMult = 1.0 +
    CLIMB_VALUES[zones['blueR1']] +
    CLIMB_VALUES[zones['blueR2']] +
    CLIMB_VALUES[zones['blueR3']];

  // supported partners (recursive hang - in simulation simple isBuddy triggers partner pts)
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

  // Display results
  showPhase('results');
  document.getElementById('resultRedScore').textContent = redTotal;
  document.getElementById('resultBlueScore').textContent = blueTotal;
  
  document.getElementById('rbRedSup').textContent = SCORE.redSup;
  document.getElementById('rbRedMult').textContent = `×${redMult.toFixed(2)}`;
  document.getElementById('rbRedRegional').textContent = redRegional;
  
  document.getElementById('rbBlueSup').textContent = SCORE.blueSup;
  document.getElementById('rbBlueMult').textContent = `×${blueMult.toFixed(2)}`;
  document.getElementById('rbBlueRegional').textContent = blueRegional;
  document.getElementById('rbExtTotal').textContent = SCORE.extinguisher + cooptPts; // Extinguisher + coopertition

  updateResultsStatsUI();
}

function showPhase(phase) {
  document.getElementById('setupScreen').style.display = phase === 'setup' ? 'block' : 'none';
  document.getElementById('gameScreen').style.display = phase === 'game' ? 'block' : 'none';
  document.getElementById('resultsScreen').style.display = phase === 'results' ? 'block' : 'none';
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
        } else if (groupId === 'gameModeToggle') {
          CONFIG.gameMode = parseInt(val);
        } else if (groupId === 'allyDifficulty') {
          CONFIG.allyMultiplier = parseFloat(val);
        } else if (groupId === 'rivalDifficulty') {
          CONFIG.rivalMultiplier = parseFloat(val);
        }
        renderSetupPreview();
      });
    });
  });

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
