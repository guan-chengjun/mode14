/**
 * weather.js
 * 天气系统：晴天 / 夜晚 / 雨天（含轻微雾效与降雨粒子）。
 *
 * 通过切换场景背景色、雾参数、灯光强度与色温，并显隐星空、雨线，
 * 在同一套模型上呈现三种截然不同的环境氛围。
 */

import * as THREE from "three";

export class WeatherSystem {
  constructor(scene) {
    this.scene = scene;
    this.current = "sunny";

    /* ---------------- 灯光 ---------------- */

    // 半球光：模拟天空与地面之间的环境漫反射
    this.hemi = new THREE.HemisphereLight(0xbfe0ff, 0x5a6472, 0.9);
    scene.add(this.hemi);

    // 主平行光：太阳 / 月亮，负责投射阴影
    this.sun = new THREE.DirectionalLight(0xfff2d8, 2.6);
    this.sun.position.set(26, 38, 20);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    // 阴影相机范围需覆盖大摆锤整个扫掠区（围栏半径约 18.5m）
    this.sun.shadow.camera.left = -32;
    this.sun.shadow.camera.right = 32;
    this.sun.shadow.camera.top = 32;
    this.sun.shadow.camera.bottom = -32;
    this.sun.shadow.camera.near = 1;
    this.sun.shadow.camera.far = 110;
    this.sun.shadow.bias = -0.0004;
    scene.add(this.sun);
    scene.add(this.sun.target); // 目标点默认原点（设备中心）

    // 夜晚园区照明（暖光，打在设备平台上）
    this.nightLamp = new THREE.PointLight(0xffc887, 0, 60, 1.6);
    this.nightLamp.position.set(0, 8, 6);
    scene.add(this.nightLamp);

    // 线性雾，三种天气下密度不同
    scene.fog = new THREE.Fog(0xa8c8e8, 70, 220);

    /* ---------------- 星空（仅夜晚可见） ---------------- */
    this.stars = this._buildStars();
    scene.add(this.stars);

    /* ---------------- 雨线（仅雨天可见） ---------------- */
    this.rain = this._buildRain();
    scene.add(this.rain.points);
  }

  /** 生成上半球随机分布的星点 */
  _buildStars() {
    const count = 900;
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      // 半径 90 的上半球
      const r = 90;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.random() * Math.PI * 0.48; // 只在天空一侧
      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = r * Math.cos(phi) + 4;
      positions[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    const mat = new THREE.PointsMaterial({
      color: 0xffffff,
      size: 0.65,
      transparent: true,
      opacity: 0.9,
      sizeAttenuation: true,
    });
    const points = new THREE.Points(geo, mat);
    points.visible = false;
    return points;
  }

  /**
   * 生成雨线粒子。
   * 每条雨用一段短线段表示，位置属性每帧动态更新。
   */
  _buildRain() {
    const dropCount = 2600;
    const positions = new Float32Array(dropCount * 6); // 每条线段两个顶点
    const drops = [];
    const RANGE = 38;   // 雨区水平半径
    const TOP = 46;     // 雨区顶部高度
    const LEN = 1.4;    // 单条雨线长度

    for (let i = 0; i < dropCount; i++) {
      const d = {
        x: (Math.random() - 0.5) * RANGE * 2,
        y: Math.random() * TOP,
        z: (Math.random() - 0.5) * RANGE * 2,
        speed: 26 + Math.random() * 12,
      };
      drops.push(d);
      this._writeDrop(positions, i, d, LEN);
    }

    const geo = new THREE.BufferGeometry();
    const attr = new THREE.BufferAttribute(positions, 3);
    attr.setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute("position", attr);

    const mat = new THREE.LineBasicMaterial({
      color: 0xaec4d8,
      transparent: true,
      opacity: 0.5,
    });
    const points = new THREE.LineSegments(geo, mat);
    points.visible = false;
    points.frustumCulled = false;

    return { points, geometry: geo, drops, LEN, RANGE, TOP };
  }

  /** 把第 i 条雨线的两个顶点写入位置数组 */
  _writeDrop(array, i, d, len) {
    const k = i * 6;
    // 略带倾斜，模拟风雨
    array[k] = d.x;
    array[k + 1] = d.y;
    array[k + 2] = d.z;
    array[k + 3] = d.x + 0.25;
    array[k + 4] = d.y - len;
    array[k + 5] = d.z + 0.08;
  }

  /** 每帧推进雨线下落 */
  update(dt) {
    if (this.current !== "rain") return;
    const { geometry, drops, LEN, RANGE, TOP } = this.rain;
    const attr = geometry.attributes.position;
    const arr = attr.array;

    for (let i = 0; i < drops.length; i++) {
      const d = drops[i];
      d.y -= d.speed * dt;
      d.x += 1.2 * dt; // 轻微风偏
      // 落到地面后回收到雨区顶部
      if (d.y < 0.4) {
        d.y = TOP + Math.random() * 6;
        d.x = (Math.random() - 0.5) * RANGE * 2;
        d.z = (Math.random() - 0.5) * RANGE * 2;
      }
      this._writeDrop(arr, i, d, LEN);
    }
    attr.needsUpdate = true;
  }

  /** 切换天气：sunny（晴天）/ night（夜晚）/ rain（雨天） */
  setWeather(type) {
    this.current = type;
    const { scene, hemi, sun } = this;

    if (type === "sunny") {
      scene.background = new THREE.Color(0x82b4e6);
      scene.fog.color.set(0xa8c8e8);
      scene.fog.near = 70;
      scene.fog.far = 220;

      hemi.color.set(0xbfe0ff);
      hemi.groundColor.set(0x5a6472);
      hemi.intensity = 0.9;

      sun.color.set(0xfff2d8);
      sun.intensity = 2.6;
      sun.position.set(26, 38, 20);
      this.nightLamp.intensity = 0;

      this.stars.visible = false;
      this.rain.points.visible = false;
    } else if (type === "night") {
      scene.background = new THREE.Color(0x070b18);
      scene.fog.color.set(0x0a1024);
      scene.fog.near = 55;
      scene.fog.far = 170;

      hemi.color.set(0x33466e);
      hemi.groundColor.set(0x0c1018);
      hemi.intensity = 0.28;

      sun.color.set(0x9fb8ff); // 月光偏冷蓝
      sun.intensity = 0.55;
      sun.position.set(-18, 30, -12);
      this.nightLamp.intensity = 60;

      this.stars.visible = true;
      this.rain.points.visible = false;
    } else {
      // 雨天：阴沉天空 + 较浓雾效 + 雨线
      scene.background = new THREE.Color(0x5a6b7d);
      scene.fog.color.set(0x6b7c8d);
      scene.fog.near = 28;   // 轻微雾：中近距离开始衰减
      scene.fog.far = 115;

      hemi.color.set(0x9fb2c4);
      hemi.groundColor.set(0x404a55);
      hemi.intensity = 0.5;

      sun.color.set(0xcdd6e0);
      sun.intensity = 0.75;
      sun.position.set(14, 34, 10);
      this.nightLamp.intensity = 0;

      this.stars.visible = false;
      this.rain.points.visible = true;
    }
  }
}
