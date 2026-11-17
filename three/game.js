import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

/* ------------------------------------------------------------------ *
 * Crystal Rush · 网页版
 * 与 Godot 版共用同一批资产：assets/models/*.glb、assets/textures/*.png
 * 玩法一致：60 秒内收集 8 枚金币
 * ------------------------------------------------------------------ */

const CFG = {
  arena: 26,
  bound: 12.4,
  totalTime: 60,
  coinCount: 8,
  speed: 7.5,
  jumpVelocity: 6.2,
  gravity: 20,
  playerRadius: 0.5,
  playerRestY: 0.76,
  pillarRadius: 0.78,
  pickupRadius: 1.15,
  cameraOffset: new THREE.Vector3(0, 8.5, 9.5),
};

const ASSETS = {
  grass: './assets/textures/ground_grass.png',
  stone: './assets/textures/stone_brick.png',
  player: './assets/models/player_crystal.glb',
  coin: './assets/models/coin.glb',
};

const COIN_SPOTS = [
  [3, -2], [-3, 4], [7, 6], [-7, -6],
  [0, 8.5], [8.5, -8], [-8.5, 7.5], [2, -7.5],
];

const PILLARS = [
  { x: 4, z: 3, yaw: 18 },
  { x: -5, z: -4, yaw: 36 },
  { x: 6.5, z: -6, yaw: 54 },
  { x: -6.5, z: 5, yaw: 72 },
];

const ui = {
  score: document.getElementById('ui-score'),
  time: document.getElementById('ui-time'),
  banner: document.getElementById('banner'),
  bannerTitle: document.getElementById('banner-title'),
  bannerSub: document.getElementById('banner-sub'),
  bannerTime: document.getElementById('banner-time'),
  bannerBtn: document.getElementById('banner-btn'),
  loading: document.getElementById('loading'),
};

const keys = new Set();

let scene, camera, renderer, clock;
let groundMesh = null;
let player, coinTemplate;
let coins = [];
let score = 0;
let timeLeft = CFG.totalTime;
let elapsed = 0;
let playing = false;
let vy = 0;
let onGround = true;

init().catch((err) => {
  console.error(err);
  ui.loading.textContent = '加载失败：' + err.message;
});

async function init() {
  setupRenderer();
  setupScene();
  buildArena();

  const [grassTex, stoneTex, playerGltf, coinGltf] = await Promise.all([
    loadTexture(ASSETS.grass, 9),
    loadTexture(ASSETS.stone, 1),
    loadGltf(ASSETS.player),
    loadGltf(ASSETS.coin),
  ]);

  applyGroundTexture(grassTex);
  applyPillarTexture(stoneTex);
  buildPlayer(playerGltf.scene);
  coinTemplate = coinGltf.scene;
  buildCoins();

  setupInput();
  startRun();
  ui.loading.classList.add('hide');
  setTimeout(() => ui.loading.remove(), 500);

  clock = new THREE.Clock();
  renderer.setAnimationLoop(tick);

  if (new URLSearchParams(location.search).has('smoke')) runSmokeTest();
}

/* 自测：把玩家瞬移到第一枚金币上，验证拾取与计分（?smoke=1） */
function runSmokeTest() {
  const out = document.createElement('div');
  out.style.cssText =
    'position:fixed;bottom:70px;left:20px;z-index:99;color:#fff;font:600 20px system-ui;' +
    'background:rgba(0,0,0,.72);padding:10px 16px;border-radius:10px';
  out.textContent = 'SMOKE running…';
  document.body.appendChild(out);

  setTimeout(() => {
    const target = coins[0];
    player.position.x = target.object.position.x;
    player.position.z = target.object.position.z;
  }, 900);

  setTimeout(() => {
    const left = coins.filter((c) => !c.collected).length;
    out.textContent = `SMOKE score=${score} left=${left} time=${Math.ceil(timeLeft)}`;
    document.title = `SMOKE score=${score} left=${left}`;
  }, 1800);
}

/* ---------------------------- 场景搭建 ---------------------------- */

function setupRenderer() {
  renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  document.body.appendChild(renderer.domElement);
  window.addEventListener('resize', onResize);
}

function setupScene() {
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x78abe6);
  scene.fog = new THREE.Fog(0x9cc2ec, 34, 62);

  camera = new THREE.PerspectiveCamera(58, window.innerWidth / window.innerHeight, 0.1, 200);
  camera.position.copy(CFG.cameraOffset);
  camera.lookAt(0, 0.6, 0);

  const hemi = new THREE.HemisphereLight(0xbcd6f5, 0x4c5c3e, 1.15);
  scene.add(hemi);

  const sun = new THREE.DirectionalLight(0xfff4e0, 2.4);
  sun.position.set(9, 15, 7);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -16;
  sun.shadow.camera.right = 16;
  sun.shadow.camera.top = 16;
  sun.shadow.camera.bottom = -16;
  sun.shadow.camera.near = 0.5;
  sun.shadow.camera.far = 60;
  sun.shadow.bias = -0.0006;
  scene.add(sun);
}

function buildArena() {
  const geo = new THREE.PlaneGeometry(CFG.arena, CFG.arena);
  const mat = new THREE.MeshStandardMaterial({ color: 0x8fbf6a, roughness: 0.95, metalness: 0 });
  groundMesh = new THREE.Mesh(geo, mat);
  groundMesh.rotation.x = -Math.PI / 2;
  groundMesh.receiveShadow = true;
  scene.add(groundMesh);
}

function applyGroundTexture(tex) {
  groundMesh.material.map = tex;
  groundMesh.material.color.set(0xffffff);
  groundMesh.material.needsUpdate = true;
}

function applyPillarTexture(tex) {
  for (const p of PILLARS) {
    const geo = new THREE.BoxGeometry(1.4, 2.5, 1.4);
    const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9, metalness: 0 });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(p.x, 1.25, p.z);
    mesh.rotation.y = THREE.MathUtils.degToRad(p.yaw);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    scene.add(mesh);
  }
}

function buildPlayer(gltfScene) {
  player = new THREE.Group();
  player.position.set(0, CFG.playerRestY, 0);

  const crystalMat = new THREE.MeshStandardMaterial({
    color: 0x4dc7ff,
    metalness: 0.12,
    roughness: 0.14,
    emissive: 0x33b8ff,
    emissiveIntensity: 1.25,
  });

  gltfScene.traverse((node) => {
    if (node.isMesh) {
      node.material = crystalMat;
      node.castShadow = true;
    }
  });

  player.add(gltfScene);
  player.scale.setScalar(1.15);
  scene.add(player);
}

function buildCoins() {
  const goldMat = new THREE.MeshStandardMaterial({
    color: 0xffc21a,
    metalness: 0.15,
    roughness: 0.35,
    emissive: 0xff9500,
    emissiveIntensity: 0.28,
  });

  for (const [x, z] of COIN_SPOTS) {
    const model = coinTemplate.clone(true);
    model.traverse((node) => {
      if (node.isMesh) {
        node.material = goldMat;
        node.castShadow = true;
      }
    });

    const holder = new THREE.Group();
    holder.position.set(x, 0.9, z);
    model.scale.setScalar(1.25);
    holder.add(model);
    scene.add(holder);

    coins.push({
      object: holder,
      baseY: 0.9,
      collected: false,
      phase: Math.random() * Math.PI * 2,
    });
  }
}

/* ---------------------------- 输入与回合 ---------------------------- */

function setupInput() {
  window.addEventListener('keydown', (e) => {
    const k = e.code;
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(k)) e.preventDefault();

    if (k === 'KeyR') { restart(); return; }
    if (k === 'Space' && playing && onGround) {
      vy = CFG.jumpVelocity;
      onGround = false;
      return;
    }
    keys.add(k);
  });

  window.addEventListener('keyup', (e) => keys.delete(e.code));
  window.addEventListener('blur', () => keys.clear());
  ui.bannerBtn.addEventListener('click', restart);
}

function startRun() {
  score = 0;
  timeLeft = CFG.totalTime;
  elapsed = 0;
  playing = true;
  vy = 0;
  onGround = true;

  player.position.set(0, CFG.playerRestY, 0);
  camera.position.copy(player.position).add(CFG.cameraOffset);
  camera.lookAt(player.position.x, player.position.y + 0.6, player.position.z);

  for (const c of coins) {
    c.collected = false;
    c.object.visible = true;
  }

  ui.banner.classList.remove('show');
  updateHud();
}

function restart() {
  startRun();
}

function endRun(won) {
  if (!playing) return;
  playing = false;

  ui.bannerTitle.textContent = won ? 'ALL COINS COLLECTED!' : 'TIME UP!';
  ui.bannerTitle.style.color = won ? '#8df5b0' : '#ffab8a';
  ui.bannerBtn.textContent = won ? '再玩一次' : '重新挑战';

  if (won) {
    ui.bannerSub.style.display = '';
    ui.bannerTime.textContent = Math.round(elapsed);
  } else {
    ui.bannerSub.style.display = 'none';
  }

  ui.banner.classList.add('show');
}

function updateHud() {
  ui.score.textContent = `COINS ${score} / ${CFG.coinCount}`;
  ui.time.textContent = `TIME ${Math.max(0, Math.ceil(timeLeft))}`;
}

/* ---------------------------- 主循环 ---------------------------- */

function tick() {
  const dt = Math.min(clock.getDelta(), 0.05);

  if (playing) {
    elapsed += dt;
    timeLeft -= dt;
    if (timeLeft <= 0) {
      timeLeft = 0;
      updateHud();
      endRun(false);
    } else {
      updateHud();
    }
    stepPlayer(dt);
    stepCoins(dt, true);
    checkPickup();
  } else {
    stepCoins(dt, false);
  }

  updateCamera(dt);
  renderer.render(scene, camera);
}

function stepPlayer(dt) {
  if (!playing) return;

  if (!onGround) vy -= CFG.gravity * dt;

  let dx = 0;
  let dz = 0;
  if (keys.has('KeyW') || keys.has('ArrowUp')) dz -= 1;
  if (keys.has('KeyS') || keys.has('ArrowDown')) dz += 1;
  if (keys.has('KeyA') || keys.has('ArrowLeft')) dx -= 1;
  if (keys.has('KeyD') || keys.has('ArrowRight')) dx += 1;

  const len = Math.hypot(dx, dz);
  if (len > 0) {
    dx /= len;
    dz /= len;
    player.position.x += dx * CFG.speed * dt;
    player.position.z += dz * CFG.speed * dt;
  }

  player.position.y += vy * dt;
  if (player.position.y <= CFG.playerRestY) {
    player.position.y = CFG.playerRestY;
    vy = 0;
    onGround = true;
  }

  // 石柱：按圆形做推挤
  for (const p of PILLARS) {
    const ox = player.position.x - p.x;
    const oz = player.position.z - p.z;
    const dist = Math.hypot(ox, oz);
    const minDist = CFG.playerRadius + CFG.pillarRadius;
    if (dist > 0.0001 && dist < minDist) {
      const push = (minDist - dist) / dist;
      player.position.x += ox * push;
      player.position.z += oz * push;
    }
  }

  // 场地边界
  player.position.x = THREE.MathUtils.clamp(player.position.x, -CFG.bound, CFG.bound);
  player.position.z = THREE.MathUtils.clamp(player.position.z, -CFG.bound, CFG.bound);
}

function stepCoins(dt, spin) {
  for (const c of coins) {
    if (c.collected) continue;
    if (spin) c.object.rotation.y += dt * 2.2;
    c.phase += dt;
    c.object.position.y = c.baseY + Math.sin(c.phase * 2.5) * 0.12;
  }
}

function checkPickup() {
  for (const c of coins) {
    if (c.collected) continue;

    const dx = player.position.x - c.object.position.x;
    const dz = player.position.z - c.object.position.z;
    const dy = player.position.y - c.baseY;

    if (Math.hypot(dx, dz) < CFG.pickupRadius && Math.abs(dy) < 1.7) {
      c.collected = true;
      c.object.visible = false;
      score += 1;
      updateHud();

      if (score >= CFG.coinCount) {
        endRun(true);
      }
    }
  }
}

function updateCamera(dt) {
  const target = player.position.clone().add(CFG.cameraOffset);
  const k = 1 - Math.exp(-6 * dt);
  camera.position.lerp(target, k);
  camera.lookAt(player.position.x, player.position.y + 0.6, player.position.z);
}

/* ---------------------------- 工具函数 ---------------------------- */

function loadTexture(path, repeat) {
  return new Promise((resolve, reject) => {
    new THREE.TextureLoader().load(
      path,
      (tex) => {
        tex.wrapS = THREE.RepeatWrapping;
        tex.wrapT = THREE.RepeatWrapping;
        tex.repeat.set(repeat, repeat);
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
        resolve(tex);
      },
      undefined,
      () => reject(new Error('贴图加载失败: ' + path)),
    );
  });
}

function loadGltf(path) {
  return new Promise((resolve, reject) => {
    new GLTFLoader().load(path, resolve, undefined, () => reject(new Error('模型加载失败: ' + path)));
  });
}

function onResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}
