import * as THREE from 'three';
import GUI from 'lil-gui';

// 游戏状态枚举
const GameState = {
  RUNNING: 'running',
  OVER: 'over',
  INITIALIZING: 'initializing',
  READY: 'ready'
};

// 声明变量 - 新增：动画循环ID，用于终止旧循环
let scene, camera, renderer, gui;
let sphere;
const textureLoader = new THREE.TextureLoader();
const moveSpeed = 0.17;
const keys = { w: false, a: false, s: false, d: false };
let isMouseDown = false;
let prevMouseX = 0;
let prevMouseY = 0;
let yaw = 0;
let pitch = 0;
const sensitivity = 0.1;
const maxPitch = 85;
const minPitch = -85;
const cameraOffset = new THREE.Vector3(0, 1.6, 0.1);
const sphereRadius = 0.7;
const spawnRange = 20;
const maxTargetSpheres = 10;
const spawnInterval = 2000;
let targetSpheres = [];
let followSpheres = [];
const followDelay = 120;
let isAnyKeyPressed = false;
let gameState = GameState.INITIALIZING;
let spawnTimer = null;
let initializationComplete = false;
let collisionCheckEnabled = false;
let gameStartTime = 0;
let debugMode = false;
let npcHead;
let npcBody = [];
const npcRadius = 0.6;
const npcMinLength = 10;
const npcMaxLength = 40;
let npcCurrentDir = new THREE.Vector3(1, 0, 0);
const npcMoveSpeed = 0.1;
const npcDirChangeTime = [1500, 4000];
let npcDirTimer = null;

// 【关键新增】存储动画循环ID，用于终止旧循环
let animationFrameId = null;


// 事件处理函数（保持不变）
function handleKeyDown(e) {
  if (gameState === GameState.READY) {
    startGame();
    return;
  }
  if (gameState !== GameState.RUNNING) return;
  if (keys.hasOwnProperty(e.key.toLowerCase())) {
    keys[e.key.toLowerCase()] = true;
    isAnyKeyPressed = true;
  }
}

function handleKeyUp(e) {
  if (keys.hasOwnProperty(e.key.toLowerCase())) {
    keys[e.key.toLowerCase()] = false;
    isAnyKeyPressed = keys.w || keys.a || keys.s || keys.d;
  }
}

function handleMouseDown(e) {
  if (gameState !== GameState.RUNNING) return;
  isMouseDown = true;
  prevMouseX = e.clientX;
  prevMouseY = e.clientY;
  if (!document.pointerLockElement && !document.mozPointerLockElement) {
    renderer.domElement.requestPointerLock = 
      renderer.domElement.requestPointerLock ||
      renderer.domElement.mozPointerLockElement;
    renderer.domElement.requestPointerLock();
  }
}

function handleMouseMove(e) {
  if (gameState !== GameState.RUNNING || !isMouseDown || (document.pointerLockElement === renderer.domElement)) return;
  const deltaX = e.clientX - prevMouseX;
  const deltaY = e.clientY - prevMouseY;
  prevMouseX = e.clientX;
  prevMouseY = e.clientY;
  yaw -= deltaX * sensitivity;
  pitch -= deltaY * sensitivity;
  pitch = Math.max(minPitch, Math.min(maxPitch, pitch));
}

function handleMouseMoveLocked(e) {
  if (gameState !== GameState.RUNNING || document.pointerLockElement !== renderer.domElement && 
      document.mozPointerLockElement !== renderer.domElement) return;
  const deltaX = e.movementX || e.mozMovementX || 0;
  const deltaY = e.movementY || e.mozMovementY || 0;
  yaw -= deltaX * sensitivity;
  pitch -= deltaY * sensitivity;
  pitch = Math.max(minPitch, Math.min(maxPitch, pitch));
}

function handleMouseUp() {
  isMouseDown = false;
}

function handlePointerLockChange() {
  if (!document.pointerLockElement) {
    isMouseDown = false;
  }
}

function handleWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

// 创建场景、相机和渲染器
function createScene() {
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  document.body.appendChild(renderer.domElement);
}

// 清理事件监听器（保持不变）
function cleanupEventListeners() {
  if (!renderer || !renderer.domElement) return;
  window.removeEventListener('keydown', handleKeyDown);
  window.removeEventListener('keyup', handleKeyUp);
  renderer.domElement.removeEventListener('mousedown', handleMouseDown);
  document.removeEventListener('mousemove', handleMouseMove);
  document.removeEventListener('mousemove', handleMouseMoveLocked);
  window.removeEventListener('mouseup', handleMouseUp);
  document.removeEventListener('pointerlockchange', handlePointerLockChange);
  window.removeEventListener('resize', handleWindowResize);
}

// 设置事件监听（保持不变）
function setupEventListeners() {
  window.addEventListener('keydown', handleKeyDown);
  window.addEventListener('keyup', handleKeyUp);
  renderer.domElement.addEventListener('mousedown', handleMouseDown);
  document.addEventListener('mousemove', handleMouseMove);
  document.addEventListener('mousemove', handleMouseMoveLocked);
  window.addEventListener('mouseup', handleMouseUp);
  document.addEventListener('pointerlockchange', handlePointerLockChange);
  window.addEventListener('resize', handleWindowResize);
}

// 创建初始化和就绪状态UI（保持不变）
function createStatusUI() {
  const oldInitUI = document.getElementById('initializationUI');
  if (oldInitUI) document.body.removeChild(oldInitUI);
  const oldReadyUI = document.getElementById('readyUI');
  if (oldReadyUI) document.body.removeChild(oldReadyUI);
  
  if (gameState === GameState.INITIALIZING) {
    const initUI = document.createElement('div');
    initUI.id = 'initializationUI';
    initUI.style.position = 'fixed';
    initUI.style.top = '0';
    initUI.style.left = '0';
    initUI.style.width = '100%';
    initUI.style.height = '100%';
    initUI.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
    initUI.style.display = 'flex';
    initUI.style.flexDirection = 'column';
    initUI.style.justifyContent = 'center';
    initUI.style.alignItems = 'center';
    initUI.style.zIndex = '1001';
    initUI.style.color = 'white';
    initUI.style.fontFamily = 'Arial, sans-serif';
    const textElement = document.createElement('h1');
    textElement.textContent = '游戏准备中...';
    textElement.style.fontSize = '2em';
    initUI.appendChild(textElement);
    document.body.appendChild(initUI);
  } else if (gameState === GameState.READY) {
    const readyUI = document.createElement('div');
    readyUI.id = 'readyUI';
    readyUI.style.position = 'fixed';
    readyUI.style.top = '0';
    readyUI.style.left = '0';
    readyUI.style.width = '100%';
    readyUI.style.height = '100%';
    readyUI.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
    readyUI.style.display = 'flex';
    readyUI.style.flexDirection = 'column';
    readyUI.style.justifyContent = 'center';
    readyUI.style.alignItems = 'center';
    readyUI.style.zIndex = '1001';
    readyUI.style.color = 'white';
    readyUI.style.fontFamily = 'Arial, sans-serif';
    const titleElement = document.createElement('h1');
    titleElement.textContent = '游戏准备就绪!';
    titleElement.style.fontSize = '2.5em';
    titleElement.style.marginBottom = '20px';
    const infoElement = document.createElement('p');
    infoElement.textContent = '按任意键开始游戏';
    infoElement.style.fontSize = '1.2em';
    readyUI.appendChild(titleElement);
    readyUI.appendChild(infoElement);
    document.body.appendChild(readyUI);
  }
}

// 初始化游戏（保持不变）
function init() {
  gameState = GameState.INITIALIZING;
  initializationComplete = false;
  collisionCheckEnabled = false;
  followSpheres = [];
  targetSpheres = [];
  gameStartTime = 0;
  
  createStatusUI();
  cleanupGameUI();
  createGameUI();
  
  if (gui) gui.destroy();
  gui = new GUI();
  gui.add({debugMode: false}, 'debugMode').onChange(value => {
    debugMode = value;
  });
  
  addGround();
  addMainSphere();
  initNPCSnake();
  startSpawningTargetSpheres();
  addLights();
  setupEventListeners();
  
  initPositionHistory(sphere, true);
  camera.position.copy(sphere.position).add(cameraOffset);
  
  const gameOverUI = document.getElementById('gameOverUI');
  if (gameOverUI) gameOverUI.style.display = 'none';
  
  setTimeout(() => {
    initializationComplete = true;
    gameState = GameState.READY;
    createStatusUI();
    if (debugMode) {
      console.log('初始化完成，等待玩家开始');
      logPositions();
    }
  }, 1000);
  
  // 启动动画循环（此时旧循环已被终止）
  animate();
}

// 开始游戏（保持不变）
function startGame() {
  const readyUI = document.getElementById('readyUI');
  if (readyUI) document.body.removeChild(readyUI);
  gameState = GameState.RUNNING;
  collisionCheckEnabled = true;
  gameStartTime = Date.now();
  if (debugMode) {
    console.log('游戏开始于', new Date(gameStartTime).toISOString());
  }
}

// 初始化物体的位置历史（保持不变）
function initPositionHistory(targetObj, forceClear = false) {
  if (forceClear || !targetObj.positionHistory) {
    targetObj.positionHistory = [];
  }
}

// 添加地面（保持不变）
function addGround() {
  const planeGeometry = new THREE.PlaneGeometry(500, 500);
  const myTexture = textureLoader.load(
'src/贪吃蛇平面.png', // 图 片 路 径
() => { console.log('纹 理 加 载 完 成 ！'); }
);

  const planeMaterial = new THREE.MeshStandardMaterial({ map: myTexture });
  const plane = new THREE.Mesh(planeGeometry, planeMaterial);
  plane.rotation.x = -Math.PI / 2;
  plane.position.y = -0.51;
  plane.receiveShadow = true;
  plane.name = "地面";
  scene.add(plane);
}

// 添加主蛇头（保持不变）
function addMainSphere() {
  const sphereGeometry = new THREE.SphereGeometry(sphereRadius, 16, 16);
  const sphereMaterial = new THREE.MeshStandardMaterial({ color: 0xff0000 });
  sphere = new THREE.Mesh(sphereGeometry, sphereMaterial);
  sphere.castShadow = true;
  sphere.position.set(0, sphereRadius, 0);
  sphere.name = "主蛇头";
  scene.add(sphere);
}

// 初始化NPC蛇（保持不变）
function initNPCSnake() {
  if (npcHead) {
    scene.remove(npcHead);
    npcHead = null;
  }
  npcBody.forEach(body => {
    scene.remove(body.mesh);
  });
  npcBody = [];
  if (npcDirTimer) {
    clearTimeout(npcDirTimer);
    npcDirTimer = null;
  }
  
  const npcLength = Math.floor(Math.random() * (npcMaxLength - npcMinLength + 1)) + npcMinLength;
  createNPCHead();
  generateNPCBody(npcLength - 1);
  setNPCDirAwayFromMain();
  startNPCDirTimer();
}

// 创建NPC蛇头（保持不变）
function createNPCHead() {
  const headGeo = new THREE.SphereGeometry(npcRadius, 16, 16);
  const headMat = new THREE.MeshStandardMaterial({ color: 0x0000ff });
  npcHead = new THREE.Mesh(headGeo, headMat);
  npcHead.castShadow = true;
  const minDistance = 60;
  const angle = Math.random() * Math.PI * 2;
  npcHead.position.set(
    sphere.position.x + Math.cos(angle) * minDistance,
    npcRadius,
    sphere.position.z + Math.sin(angle) * minDistance
  );
  npcHead.name = "NPC蛇头";
  scene.add(npcHead);
  initPositionHistory(npcHead, true);
}

// 设置NPC初始方向远离主蛇（保持不变）
function setNPCDirAwayFromMain() {
  const dirFromMain = new THREE.Vector3();
  dirFromMain.subVectors(npcHead.position, sphere.position).normalize();
  npcCurrentDir.copy(dirFromMain);
}

// 生成NPC蛇身体（保持不变）
function generateNPCBody(bodyCount) {
  let prevBody = npcHead;
  for (let i = 0; i < bodyCount; i++) {
    const dir = new THREE.Vector3();
    if (prevBody === npcHead) {
      dir.copy(npcCurrentDir).negate();
    } else {
      dir.subVectors(prevBody.position, npcBody[i-1].mesh.position).normalize().negate();
    }
    const pos = prevBody.position.clone().add(dir.multiplyScalar(npcRadius * 2.3));
    
    const bodyGeo = new THREE.SphereGeometry(npcRadius, 16, 16);
    const bodyMat = new THREE.MeshStandardMaterial({ 
      color: 0x00ffff,
      transparent: true,
      opacity: 0.8
    });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.position.copy(pos);
    body.castShadow = true;
    body.name = `NPC蛇身-${i+1}`;
    scene.add(body);
    
    initPositionHistory(body, true);
    const bodyObj = {
      mesh: body,
      target: prevBody,
      delay: 7
    };
    npcBody.push(bodyObj);
    
    prevBody = body;
  }
}

// 限制NPC转向角小于90度的方向生成函数
function randomNPCDir() {
  // 1. 定义最大转向角度（弧度制，80度接近90度但留有余地）
  const maxTurnAngle = THREE.MathUtils.degToRad(80);
  
  // 2. 生成一个在[-maxTurnAngle, maxTurnAngle]之间的随机转向角
  const turnAngle = (Math.random() * 2 - 1) * maxTurnAngle;
  
  // 3. 创建旋转四元数：绕Y轴（垂直方向）旋转turnAngle角度
  const quaternion = new THREE.Quaternion();
  quaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), turnAngle);
  
  // 4. 用旋转四元数更新当前方向（在原方向基础上旋转）
  npcCurrentDir.applyQuaternion(quaternion).normalize();
}


// 启动NPC方向切换定时器（保持不变）
function startNPCDirTimer() {
  const changeTime = Math.random() * (npcDirChangeTime[1] - npcDirChangeTime[0]) + npcDirChangeTime[0];
  npcDirTimer = setTimeout(() => {
    if (gameState === GameState.RUNNING) {
      randomNPCDir();
      startNPCDirTimer();
    }
  }, changeTime);
}

// 更新NPC蛇头位置（保持不变）
function updateNPCHead() {
  if (gameState !== GameState.RUNNING) return;
  npcHead.position.add(npcCurrentDir.clone().multiplyScalar(npcMoveSpeed));
  
  const boundary = 100;
  if (npcHead.position.x > boundary) npcCurrentDir.x = -Math.abs(npcCurrentDir.x);
  if (npcHead.position.x < -boundary) npcCurrentDir.x = Math.abs(npcCurrentDir.x);
  if (npcHead.position.z > boundary) npcCurrentDir.z = -Math.abs(npcCurrentDir.z);
  if (npcHead.position.z < -boundary) npcCurrentDir.z = Math.abs(npcCurrentDir.z);
  
  npcHead.position.y = npcRadius;
}

// 更新NPC蛇身体跟随（保持不变）
function updateNPCBody() {
  if (gameState !== GameState.RUNNING) return;
  npcBody.forEach(body => {
    const target = body.target;
    const history = target.positionHistory;
    if (history.length < body.delay) {
      body.mesh.position.lerp(target.position, 0.5);
      return;
    }
    const targetPos = history[history.length - body.delay];
    body.mesh.position.lerp(targetPos, 0.5);
  });
}

// 更新NPC位置历史（保持不变）
function updateNPCHistory() {
  if (gameState !== GameState.RUNNING) return;
  initPositionHistory(npcHead);
  npcHead.positionHistory.push(npcHead.position.clone());
  if (npcHead.positionHistory.length > 200) npcHead.positionHistory.shift();
  npcBody.forEach(body => {
    initPositionHistory(body.mesh);
    body.mesh.positionHistory.push(body.mesh.position.clone());
    if (body.mesh.positionHistory.length > 100) body.mesh.positionHistory.shift();
  });
}

// 目标球体随机生成（保持不变）
function spawnTargetSphere() {
  if (targetSpheres.length >= maxTargetSpheres || gameState !== GameState.RUNNING) return;
  const randomX = (Math.random() - 0.5) * 2 * spawnRange;
  const randomZ = (Math.random() - 0.5) * 2 * spawnRange;
  const distanceToMain = Math.sqrt(
    Math.pow(randomX - sphere.position.x, 2) + 
    Math.pow(randomZ - sphere.position.z, 2)
  );
  if (distanceToMain < sphereRadius * 6) return;
  
  const targetGeometry = new THREE.SphereGeometry(sphereRadius, 16, 16);
  const targetMaterial = new THREE.MeshStandardMaterial({ 
    color: `hsl(${Math.random() * 60 + 120}, 100%, 50%)`
  });
  const targetSphere = new THREE.Mesh(targetGeometry, targetMaterial);
  targetSphere.castShadow = true;
  targetSphere.position.set(randomX, sphereRadius, randomZ);
  targetSphere.name = `目标球体-${targetSpheres.length + 1}`;
  scene.add(targetSphere);
  targetSpheres.push(targetSphere);
}

// 目标球体定时生成（保持不变）
function startSpawningTargetSpheres() {
  if (spawnTimer) {
    clearInterval(spawnTimer);
  }
  spawnTimer = setInterval(() => {
    if (gameState === GameState.RUNNING) {
      spawnTargetSphere();
    }
  }, spawnInterval);
}

// 主蛇头移动（保持不变）
function updateSpherePosition() {
  if (gameState !== GameState.RUNNING) return;
  const forward = new THREE.Vector3();
  camera.getWorldDirection(forward);
  forward.y = 0;
  forward.normalize();
  const right = new THREE.Vector3();
  right.crossVectors(forward, camera.up).normalize();
  
  if (keys.w) sphere.position.add(forward.clone().multiplyScalar(moveSpeed));
  if (keys.s) sphere.position.sub(forward.clone().multiplyScalar(moveSpeed));
  if (keys.a) sphere.position.sub(right.clone().multiplyScalar(moveSpeed));
  if (keys.d) sphere.position.add(right.clone().multiplyScalar(moveSpeed));
  
  sphere.position.y = Math.max(sphere.position.y, sphereRadius);
}

// 碰撞检测 - 主蛇吃目标球（保持不变）
// 修改：在碰撞检测中添加粒子效果
function checkTargetCollisions() {
  if (gameState !== GameState.RUNNING) return;
  
  for (let i = targetSpheres.length - 1; i >= 0; i--) {
    const target = targetSpheres[i];
    const distance = sphere.position.distanceTo(target.position);
    if (distance < sphereRadius * 2) {
      // 生成烟花特效（使用目标球体的颜色）
      createExplosionEffect(target.position, target.material.color.getHex());
      
      generateFollowSphereInChain();
      scene.remove(target);
      targetSpheres.splice(i, 1);
    }
  }
}
// 生成主蛇身体（保持不变）
function generateFollowSphereInChain() {
  const followTarget = followSpheres.length === 0 
    ? sphere 
    : followSpheres[followSpheres.length - 1].mesh;
  const targetForward = new THREE.Vector3();
  if (followTarget === sphere) {
    camera.getWorldDirection(targetForward);
  } else {
    followTarget.getWorldDirection(targetForward);
  }
  const spawnDir = targetForward.negate().normalize();
  const spawnPos = followTarget.position.clone().add(spawnDir.multiplyScalar(sphereRadius * 10));
  
  const followGeo = new THREE.SphereGeometry(sphereRadius, 16, 16);
  const followMat = new THREE.MeshStandardMaterial({
    color: `hsl(${Math.random() * 360}, 100%, 50%)`,
    transparent: true,
    opacity: 0.7
  });
  const newFollowSphere = new THREE.Mesh(followGeo, followMat);
  newFollowSphere.castShadow = true;
  newFollowSphere.position.copy(spawnPos);
  newFollowSphere.name = `主蛇身-${followSpheres.length + 1}`;
  scene.add(newFollowSphere);
  
  initPositionHistory(newFollowSphere, true);
  followSpheres.push({
    mesh: newFollowSphere,
    target: followTarget,
    delay: followDelay
  });
}

// 更新所有位置历史（保持不变）
function updateAllPositionHistories() {
  if (gameState !== GameState.RUNNING) return;
  if (isAnyKeyPressed) {
    updateSingleHistory(sphere);
    followSpheres.forEach(followObj => {
      updateSingleHistory(followObj.mesh);
    });
  }
  updateNPCHistory();
}

// 更新单个球体的位置历史（保持不变）
function updateSingleHistory(targetObj) {
  targetObj.positionHistory.push(targetObj.position.clone());
  if (targetObj.positionHistory.length > targetObj === sphere ? followDelay * followSpheres.length*2 + 20 : followDelay *2 + 20) {
    targetObj.positionHistory.shift();
  }
}

// 更新蛇身体跟随（保持不变）
function updateChainFollow() {
  if (gameState !== GameState.RUNNING) return;
  if (isAnyKeyPressed) {
    followSpheres.forEach(followObj => {
      const target = followObj.target;
      const history = target.positionHistory;
      if (history.length < followObj.delay) {
        followObj.mesh.position.lerp(target.position, 0.2);
        return;
      }
      const targetIndex = history.length - followObj.delay;
      const targetPos = history[targetIndex];
      followObj.mesh.position.lerp(targetPos, 0.05);
      followObj.mesh.quaternion.slerp(target.quaternion, 0.2);
    });
  }
  updateNPCBody();
}

// 相机更新（保持不变）
function updateCamera() {
  if (gameState !== GameState.RUNNING) return;
  const desiredPosition = sphere.position.clone().add(cameraOffset);
  camera.position.lerp(desiredPosition, 0.2); 
  camera.rotation.order = 'YXZ';
  camera.rotation.y = THREE.MathUtils.degToRad(yaw);
  camera.rotation.x = THREE.MathUtils.degToRad(pitch);
}

// 调试：输出位置信息（保持不变）
//function logPositions() {
  //console.log('主蛇头位置:', {
    //x: sphere.position.x.toFixed(2),
    //y: sphere.position.y.toFixed(2),
    //z: sphere.position.z.toFixed(2)
  //});
  //console.log('NPC蛇头位置:', {
    //x: npcHead.position.x.toFixed(2),
    //y: npcHead.position.y.toFixed(2),
    //z: npcHead.position.z.toFixed(2)
  //});
  //const distance = sphere.position.distanceTo(npcHead.position);
  //console.log('主蛇与NPC距离:', distance.toFixed(2));
//}

// 检测蛇的碰撞（保持不变）
function checkSnakeCollisions() {
  if (!collisionCheckEnabled || gameState !== GameState.RUNNING) return;
  if (Date.now() - gameStartTime < 1000) return;
  
  const mainSelfMinDistance = sphereRadius * 2 * 0.7;
  if (followSpheres.length > 7) {
    for (let i = 7; i < followSpheres.length; i++) {
      const distance = sphere.position.distanceTo(followSpheres[i].mesh.position);
      if (distance < mainSelfMinDistance) {
        if (debugMode) {
          console.log(`主蛇自碰撞: 距离=${distance.toFixed(2)} < ${mainSelfMinDistance.toFixed(2)}`);
        }
        endGame("主蛇撞到了自己！");
        return;
      }
    }
  }
  
  const mainNpcMinDistance = (sphereRadius + npcRadius) * 0.7;
  for (let i = 0; i < npcBody.length; i++) {
    const distance = sphere.position.distanceTo(npcBody[i].mesh.position);
    if (distance < mainNpcMinDistance) {
      if (debugMode) {
        console.log(`主蛇碰NPC身体: 距离=${distance.toFixed(2)} < ${mainNpcMinDistance.toFixed(2)}`);
      }
      endGame("主蛇撞到了NPC蛇！");
      return;
    }
  }
  
  
  
  for (let i = 0; i < followSpheres.length; i++) {
    const distance = npcHead.position.distanceTo(followSpheres[i].mesh.position);
    if (distance < mainNpcMinDistance) {
      if (debugMode) {
        console.log(`NPC碰主蛇身体: 距离=${distance.toFixed(2)} < ${mainNpcMinDistance.toFixed(2)}`);
      }
      endGame("NPC蛇撞到了主蛇！");
      return;
    }
  }
}

// 游戏结束（保持不变）
function endGame(message) {
  if (gameState === GameState.OVER) return;
  gameState = GameState.OVER;
  collisionCheckEnabled = false;
  if (debugMode) {
    console.log('游戏结束:', message);
    logPositions();
  }
  const messageElement = document.getElementById('gameOverMessage');
  if (messageElement) messageElement.textContent = message;
  const gameOverUI = document.getElementById('gameOverUI');
  if (gameOverUI) gameOverUI.style.display = 'flex';
}

// 创建游戏UI（保持不变）
function createGameUI() {
  if (document.getElementById('gameOverUI')) return;
  const gameOverUI = document.createElement('div');
  gameOverUI.id = 'gameOverUI';
  gameOverUI.style.position = 'fixed';
  gameOverUI.style.top = '0';
  gameOverUI.style.left = '0';
  gameOverUI.style.width = '100%';
  gameOverUI.style.height = '100%';
  gameOverUI.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
  gameOverUI.style.display = 'none';
  gameOverUI.style.flexDirection = 'column';
  gameOverUI.style.justifyContent = 'center';
  gameOverUI.style.alignItems = 'center';
  gameOverUI.style.zIndex = '1000';
  gameOverUI.style.color = 'white';
  gameOverUI.style.fontFamily = 'Arial, sans-serif';
  
  const messageElement = document.createElement('h1');
  messageElement.id = 'gameOverMessage';
  messageElement.style.marginBottom = '30px';
  messageElement.style.fontSize = '2em';
  
  const restartButton = document.createElement('button');
  restartButton.textContent = '重新开始';
  restartButton.style.padding = '15px 30px';
  restartButton.style.fontSize = '1.2em';
  restartButton.style.cursor = 'pointer';
  restartButton.style.backgroundColor = '#4CAF50';
  restartButton.style.color = 'white';
  restartButton.style.border = 'none';
  restartButton.style.borderRadius = '5px';
  restartButton.style.transition = 'background-color 0.3s';
  
  restartButton.addEventListener('mouseover', () => {
    restartButton.style.backgroundColor = '#45a049';
  });
  restartButton.addEventListener('mouseout', () => {
    restartButton.style.backgroundColor = '#4CAF50';
  });
  restartButton.addEventListener('click', restartGame);
  
  gameOverUI.appendChild(messageElement);
  gameOverUI.appendChild(restartButton);
  document.body.appendChild(gameOverUI);
}

// 清除游戏UI（保持不变）
function cleanupGameUI() {
  const gameOverUI = document.getElementById('gameOverUI');
  if (gameOverUI) {
    document.body.removeChild(gameOverUI);
  }
}

// 【关键修改】重新开始游戏：新增终止动画循环的逻辑
function restartGame() {
  if (debugMode) {
    console.log('=== 重新开始游戏 ===');
  }
  
  // 1. 【核心修复】终止上一次的动画循环
  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId);
    animationFrameId = null;
  }
  
  // 2. 清除事件监听器
  if (renderer && renderer.domElement) {
    cleanupEventListeners();
  }
  
  // 3. 清除所有定时器
  if (npcDirTimer) {
    clearTimeout(npcDirTimer);
    npcDirTimer = null;
  }
  if (spawnTimer) {
    clearInterval(spawnTimer);
    spawnTimer = null;
  }
  
  // 4. 清除所有游戏对象
  if (scene) {
    while (scene.children.length > 0) {
      scene.remove(scene.children[0]);
    }
  }
  
  // 5. 清除渲染器DOM元素
  if (renderer && renderer.domElement && renderer.domElement.parentElement) {
    renderer.domElement.parentElement.removeChild(renderer.domElement);
  }
  
  // 6. 完全重置所有状态变量
  sphere = null;
  followSpheres = [];
  targetSpheres = [];
  npcHead = null;
  npcBody = [];
  yaw = 0;
  pitch = 0;
  for (const key in keys) {
    keys[key] = false;
  }
  isAnyKeyPressed = false;
  gameState = GameState.INITIALIZING;
  initializationComplete = false;
  collisionCheckEnabled = false;
  
  // 7. 重新初始化游戏
  createScene();
  init();
}

// 【关键修改】动画循环：存储循环ID，用于后续终止
// 修改：在动画循环中添加粒子更新
function animate() {
  animationFrameId = requestAnimationFrame(animate);
  
  if (gameState === GameState.RUNNING) {
    updateSpherePosition();
    updateCamera();
    checkTargetCollisions();
    updateNPCHead();
    updateAllPositionHistories();
    updateChainFollow();
    checkSnakeCollisions();
    updateParticles(); // 新增：更新粒子系统
  }
  
  if (renderer && scene && camera) {
    renderer.render(scene, camera);
  }
}





// 新增：创建粒子材质（复用材质提高性能）
const particleMaterial = new THREE.PointsMaterial({
  size: 0.3,
  transparent: true,
  opacity: 1,
  vertexColors: true,
  sizeAttenuation: true // 粒子大小随距离变化
});


// 新增：粒子系统更新函数（在动画循环中调用）
function updateParticles() {
  scene.children.forEach(child => {
    if (child.userData.isExplosion) {
      // 更新每个粒子
      const particles = child.geometry.attributes;
      const positions = particles.position.array;
      const velocities = child.userData.velocities;
      const lifetimes = child.userData.lifetimes;
      const maxLifetime = child.userData.maxLifetime;
      
      // 更新颜色和位置
      for (let i = 0; i < positions.length; i += 3) {
        // 应用速度
        positions[i] += velocities[i];     // X轴速度
        positions[i + 1] += velocities[i + 1]; // Y轴速度
        positions[i + 2] += velocities[i + 2]; // Z轴速度
        
        // 减少生命周期
        lifetimes[i / 3] -= 0.008; // 约等于每帧时间
        const lifeRatio = lifetimes[i / 3] / maxLifetime;
        
        // 随时间淡出并缩小
        particles.color.array[i] = particles.color.array[i] * lifeRatio;
        particles.color.array[i + 1] = particles.color.array[i + 1] * lifeRatio;
        particles.color.array[i + 2] = particles.color.array[i + 2] * lifeRatio;
      }
      
      particles.position.needsUpdate = true;
      particles.color.needsUpdate = true;
      
      // 生命周期结束后移除粒子系统
      if (Math.max(...lifetimes) <= 0) {
        scene.remove(child);
      }
    }
  });
}

// 新增：创建碰撞烟花特效
function createExplosionEffect(position, color) {
  const particleCount = 200; // 粒子数量
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(particleCount * 3);
  const colors = new Float32Array(particleCount * 3);
  const velocities = new Float32Array(particleCount * 3);
  const lifetimes = new Array(particleCount);
  
  // 基于目标球体颜色生成粒子颜色
  const baseColor = new THREE.Color(color);
  
  for (let i = 0; i < particleCount; i++) {
    const i3 = i * 3;
    
    // 所有粒子初始位置都在碰撞点
    positions[i3] = position.x;
    positions[i3 + 1] = position.y;
    positions[i3 + 2] = position.z;
    
    // 随机颜色，基于目标球体颜色变化
    const hueVariation = (Math.random() - 0.5) * 0.2; // 色相变化范围
    const particleColor = new THREE.Color().copy(baseColor);
    particleColor.offsetHSL(hueVariation, 0.2, 0);
    
    colors[i3] = particleColor.r;
    colors[i3 + 1] = particleColor.g;
    colors[i3 + 2] = particleColor.b;
    
    // 随机速度（烟花扩散效果）
    const speed = 0.1 + Math.random() * 0.3;
    const angle = Math.random() * Math.PI * 2;
    const elevation = Math.random() * Math.PI / 2; // 向上扩散
    
    velocities[i3] = Math.cos(angle) * Math.cos(elevation) * speed;
    velocities[i3 + 1] = Math.sin(elevation) * speed; // Y轴向上
    velocities[i3 + 2] = Math.sin(angle) * Math.cos(elevation) * speed;
    
    // 随机生命周期（0.8-1.5秒）
    lifetimes[i] = 2.0 + Math.random() * 1.5;
  }
  
  // 设置几何体属性
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  
  // 创建粒子系统
  const particles = new THREE.Points(geometry, particleMaterial);
  
  // 存储粒子系统数据用于更新
  particles.userData = {
    isExplosion: true,
    velocities: velocities,
    lifetimes: lifetimes,
    maxLifetime: 3.5
  };
  
  scene.add(particles);
}

// 添加光照（保持不变）
function addLights() {
  const ambientLight = new THREE.AmbientLight(0x404040);
  scene.add(ambientLight);
  const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
  directionalLight.position.set(5, 10, 7);
  directionalLight.castShadow = true;
  scene.add(directionalLight);
  directionalLight.shadow.camera.top = 5;
  directionalLight.shadow.camera.bottom = -5;
  directionalLight.shadow.camera.left = -5;
  directionalLight.shadow.camera.right = 5;
  directionalLight.shadow.camera.near = 0.1;
  directionalLight.shadow.camera.far = 50;
  directionalLight.shadow.mapSize.width = 1024;
  directionalLight.shadow.mapSize.height = 1024;
}

// 初始化应用（保持不变）
function main() {
  createScene();
  init();
}

// 页面卸载时清理（保持不变）
window.addEventListener('beforeunload', () => {
  cleanupEventListeners();
  if (npcDirTimer) clearTimeout(npcDirTimer);
  if (spawnTimer) clearInterval(spawnTimer);
  // 卸载时终止动画循环
  if (animationFrameId) cancelAnimationFrame(animationFrameId);
});

// 启动应用（保持不变）
main();