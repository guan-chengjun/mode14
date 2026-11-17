/**
 * main.js
 * 大摆锤 3D 演示主入口。
 *
 * 模块职责：
 *   - 创建渲染器、透视相机、OrbitControls 轨道控制器；
 *   - 组装大摆锤模型（ride.js）、天气系统（weather.js）、标注交互（annotations.js）；
 *   - 驱动“往复摆动 + 座舱自转”的真实运动学动画；
 *   - 绑定播放/暂停/复位、调速、线框透视、天气切换等全部 UI。
 */

import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { buildRide } from "./ride.js";
import { WeatherSystem } from "./weather.js";
import { AnnotationManager } from "./annotations.js";

/* ================================================================
 * 一、渲染器 / 场景 / 相机
 * ================================================================ */

const container = document.getElementById("scene-container");

const renderer = new THREE.WebGLRenderer({
  antialias: true,
  powerPreference: "high-performance",
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap; // 柔和阴影
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
container.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x82b4e6);

// 透视相机
const camera = new THREE.PerspectiveCamera(
  50,
  window.innerWidth / window.innerHeight,
  0.1,
  400
);
const DEFAULT_CAM_POS = new THREE.Vector3(26, 17, 32);
const DEFAULT_TARGET = new THREE.Vector3(0, 10, 0);
camera.position.copy(DEFAULT_CAM_POS);

/* ---------------- OrbitControls 轨道控制器 ---------------- */
const controls = new OrbitControls(camera, renderer.domElement);
controls.target.copy(DEFAULT_TARGET);
controls.enableDamping = true;       // 阻尼，视角转动更顺滑
controls.dampingFactor = 0.06;
controls.minDistance = 8;           // 最近缩放距离
controls.maxDistance = 95;          // 最远缩放距离（需容纳整个围栏）
controls.maxPolarAngle = Math.PI * 0.495; // 禁止相机钻入地面以下
controls.screenSpacePanning = false;
controls.update();

/* ================================================================
 * 二、地面环境
 * ================================================================ */

// 大面积草地（接收阴影）
const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(400, 400),
  new THREE.MeshStandardMaterial({ color: 0x4f7a44, roughness: 0.95, metalness: 0 })
);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

// 设备外围圆形硬化广场
const plaza = new THREE.Mesh(
  new THREE.CircleGeometry(30, 64),
  new THREE.MeshStandardMaterial({ color: 0x7d858f, roughness: 0.85, metalness: 0.05 })
);
plaza.rotation.x = -Math.PI / 2;
plaza.position.y = 0.02;
plaza.receiveShadow = true;
scene.add(plaza);

/* ================================================================
 * 三、大摆锤模型 + 天气系统 + 标注交互
 * ================================================================ */

const ride = buildRide();
scene.add(ride.root);

const weather = new WeatherSystem(scene);
weather.setWeather("sunny");

const annotation = new AnnotationManager(renderer, camera, ride);

/* ================================================================
 * 四、运转动画参数与状态
 * ================================================================ */

const MAX_ANGLE = THREE.MathUtils.degToRad(100); // 真实大摆锤极限摆角约 ±100°
const BASE_PERIOD = 7;                            // 基准往复周期（秒）
const RAMP_TIME = 12;                             // 启动时角度渐增时长（秒），模拟缓启动

const state = {
  playing: false,        // 是否正在运转
  speedFactor: 1,        // 速度倍率（滑块控制）
  simTime: 0,            // 累计模拟时间（受倍率影响）
  swingAngle: 0,         // 当前摆角（弧度）
  spinAngle: 0,          // 座舱自转角（弧度）
  spinSpeed: 0.65,       // 座舱基准自转速度（弧度/秒）
};

/* ---------------- HUD 与按钮引用 ---------------- */
const hudState = document.getElementById("hud-state");
const hudAngle = document.getElementById("hud-angle");
const hudSpeed = document.getElementById("hud-speed");
const btnPlay = document.getElementById("btn-play");
const btnPause = document.getElementById("btn-pause");
const btnReset = document.getElementById("btn-reset");
const speedSlider = document.getElementById("speed-slider");
const speedValue = document.getElementById("speed-value");
const btnWireframe = document.getElementById("btn-wireframe");
const btnCamera = document.getElementById("btn-camera");

/** 更新左上角实时状态 */
function updateHUD() {
  hudState.textContent = state.playing ? "运转中" : "暂停";
  hudAngle.textContent = `${THREE.MathUtils.radToDeg(state.swingAngle).toFixed(1)}°`;
  hudSpeed.textContent = `${state.speedFactor.toFixed(1)}×`;
}

/* ================================================================
 * 五、UI 事件绑定
 * ================================================================ */

// 播放 / 暂停 / 复位
btnPlay.addEventListener("click", () => {
  state.playing = true;
  updateHUD();
});

btnPause.addEventListener("click", () => {
  state.playing = false;
  updateHUD();
});

btnReset.addEventListener("click", () => {
  state.playing = false;
  state.simTime = 0;
  state.swingAngle = 0;
  state.spinAngle = 0;
  ride.swingPivot.rotation.x = 0;
  ride.cabinSpin.rotation.y = 0;
  updateHUD();
});

// 速度倍率滑块
speedSlider.addEventListener("input", () => {
  state.speedFactor = parseFloat(speedSlider.value);
  speedValue.textContent = `${state.speedFactor.toFixed(1)}×`;
  updateHUD();
});

// 实体 / 透视线框切换
let wireframeOn = false;
btnWireframe.addEventListener("click", () => {
  wireframeOn = !wireframeOn;
  ride.setWireframe(wireframeOn);
  btnWireframe.classList.toggle("wireframe-on", wireframeOn);
  btnWireframe.setAttribute("aria-pressed", String(wireframeOn));
  btnWireframe.textContent = wireframeOn
    ? "透视线框模式：开"
    : "透视线框模式：关";
});

// 天气切换
document.querySelectorAll(".btn-weather").forEach((btn) => {
  btn.addEventListener("click", () => {
    document
      .querySelectorAll(".btn-weather")
      .forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    weather.setWeather(btn.dataset.weather);
  });
});

// 相机视角复位
btnCamera.addEventListener("click", () => {
  camera.position.copy(DEFAULT_CAM_POS);
  controls.target.copy(DEFAULT_TARGET);
  controls.update();
});

// 窗口尺寸自适应
window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

/* ================================================================
 * 六、动画循环：真实大摆锤往复运动学
 *
 * 摆角公式：
 *   angle(t) = 包络(t) × A × sin(2π·t / T)
 *
 *   - 包络 smoothstep 让设备“缓启动 → 摆幅渐增至极限 → 平稳运行”，
 *     停机后自然停在当前摆角，复位时回零；
 *   - 周期 T 固定（不随倍率压缩相位），保证换向节奏自然；
 *   - 座舱同时绕竖直轴匀速自转，座椅随圆盘与摆臂做复合运动，
 *     所有座椅均为座舱层级的子节点，因此不会出现穿模。
 * ================================================================ */

const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);

  const rawDt = Math.min(clock.getDelta(), 0.05); // 钳制大帧间隔，避免跳变

  if (state.playing) {
    const dt = rawDt * state.speedFactor;
    state.simTime += dt;

    // 摆幅包络：0 → 1 平滑渐增（模拟真实设备的缓启动过程）
    const ramp = THREE.MathUtils.smoothstep(
      state.simTime / RAMP_TIME,
      0,
      1
    );
    const omega = (2 * Math.PI) / BASE_PERIOD;
    state.swingAngle =
      ramp * MAX_ANGLE * Math.sin(omega * state.simTime);

    // 座舱匀速自转
    state.spinAngle += state.spinSpeed * dt;
  }

  // 写入运动节点（暂停时保持上一姿态）
  ride.swingPivot.rotation.x = state.swingAngle;
  ride.cabinSpin.rotation.y = state.spinAngle;

  // 推进天气特效（雨线下落）
  weather.update(rawDt);

  controls.update();
  updateHUD();
  renderer.render(scene, camera);
}

updateHUD();
animate();
