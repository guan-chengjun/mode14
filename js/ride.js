/**
 * ride.js
 * 大摆锤程序化建模模块。
 *
 * 说明：考虑到可商用 GLB 大摆锤模型在公开素材站难以稳定获取且授权条款不一，
 * 本项目采用 Three.js 基础几何体 1:1 程序化搭建整机结构，优点是：
 *   1. 每个部件都带有准确的 partId，点击拾取与讲解天然对应；
 *   2. 线框透视模式可直接切换材质，无需额外处理外部模型的网格层级；
 *   3. 摆动层级（主轴 → 摆臂 → 座舱回转盘 → 座椅）严格按真实机械结构组织。
 * 如需替换为授权 GLB 模型，可参考 README 中的 GLTFLoader 接入说明。
 */

import * as THREE from "three";

/* ---------------- 通用建模小工具 ---------------- */

/** 向父节点添加一个 Box 网格 */
function addBox(parent, size, pos, material) {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(size[0], size[1], size[2]),
    material
  );
  mesh.position.set(pos[0], pos[1], pos[2]);
  parent.add(mesh);
  return mesh;
}

/** 在两点之间生成一根方钢梁（BoxGeometry 沿 Y 轴后旋转对齐） */
function beamBetween(parent, a, b, thickness, material) {
  const dir = new THREE.Vector3().subVectors(b, a);
  const len = dir.length();
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(thickness, len, thickness),
    material
  );
  mesh.position.copy(a).addScaledVector(dir, 0.5);
  mesh.quaternion.setFromUnitVectors(
    new THREE.Vector3(0, 1, 0),
    dir.clone().normalize()
  );
  parent.add(mesh);
  return mesh;
}

/** 在两点之间生成一根圆钢管 */
function cylinderBetween(parent, a, b, radius, material, radialSegments = 16) {
  const dir = new THREE.Vector3().subVectors(b, a);
  const len = dir.length();
  const mesh = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, len, radialSegments),
    material
  );
  mesh.position.copy(a).addScaledVector(dir, 0.5);
  mesh.quaternion.setFromUnitVectors(
    new THREE.Vector3(0, 1, 0),
    dir.clone().normalize()
  );
  parent.add(mesh);
  return mesh;
}

/**
 * 构建整台大摆锤。
 * @returns {object} 包含根节点、运动节点、部件分组与材质控制方法
 */
export function buildRide() {
  const root = new THREE.Group();
  root.name = "PendulumRide";

  /* ------------ 材质模板（注册部件时会按部件克隆，互相独立） ------------ */
  const mat = {
    steel: new THREE.MeshStandardMaterial({ color: 0x8b94a3, metalness: 0.85, roughness: 0.35 }),
    darkSteel: new THREE.MeshStandardMaterial({ color: 0x39414f, metalness: 0.7, roughness: 0.45 }),
    redPaint: new THREE.MeshStandardMaterial({ color: 0xd2403a, metalness: 0.35, roughness: 0.45 }),
    bluePaint: new THREE.MeshStandardMaterial({ color: 0x2f70d2, metalness: 0.35, roughness: 0.45 }),
    yellow: new THREE.MeshStandardMaterial({ color: 0xf2b01d, metalness: 0.3, roughness: 0.5 }),
    concrete: new THREE.MeshStandardMaterial({ color: 0x9aa1ab, metalness: 0.05, roughness: 0.9 }),
    platform: new THREE.MeshStandardMaterial({ color: 0x566070, metalness: 0.4, roughness: 0.6 }),
    rubber: new THREE.MeshStandardMaterial({ color: 0x1f2329, metalness: 0.1, roughness: 0.9 }),
  };

  const partGroups = {};      // 部件 id -> Group
  const partMaterials = {};   // 部件 id -> 该部件独立材质数组
  const allMeshes = [];

  /** 注册部件：写入 partId、开启阴影、克隆材质实现各部件独立控制 */
  function finalizePart(id, group, parent = root) {
    parent.add(group);
    const ownMats = new Set();
    group.traverse((obj) => {
      if (obj.isMesh) {
        obj.userData.partId = id;
        obj.castShadow = true;
        obj.receiveShadow = true;
        const cloned = obj.material.clone();
        obj.material = cloned;
        ownMats.add(cloned);
        allMeshes.push(obj);
      }
    });
    partGroups[id] = group;
    partMaterials[id] = [...ownMats];
  }

  /** 高亮 / 取消高亮某个部件（点击选中时调用） */
  function setHighlight(id, on) {
    const list = partMaterials[id];
    if (!list) return;
    for (const m of list) {
      m.emissive.set(on ? 0x2f6fd0 : 0x000000);
      m.emissiveIntensity = on ? 0.55 : 1;
    }
  }

  /** 实体 / 透视线框模式切换 */
  function setWireframe(on) {
    for (const m of Object.values(partMaterials).flat()) {
      m.wireframe = on;
    }
  }

  /* ================================================================
   * 部件 1：底座支撑钢架（环形平台 + 放射梁 + 检修围栏基础）
   * ================================================================ */
  const base = new THREE.Group();
  base.name = "base";

  // 混凝土地坪承台
  const apron = new THREE.Mesh(
    new THREE.CylinderGeometry(9.2, 9.6, 0.4, 48),
    mat.concrete
  );
  apron.position.y = 0.2;
  base.add(apron);

  // 环形钢制设备平台
  const platform = new THREE.Mesh(
    new THREE.CylinderGeometry(7.4, 7.4, 0.5, 48),
    mat.platform
  );
  platform.position.y = 0.65;
  base.add(platform);

  // 平台外圈警示环
  const warnRing = new THREE.Mesh(
    new THREE.TorusGeometry(7.45, 0.09, 10, 64),
    mat.yellow
  );
  warnRing.rotation.x = Math.PI / 2;
  warnRing.position.y = 0.92;
  base.add(warnRing);

  // 放射状钢梁（从中心向平台边缘发散）
  for (let i = 0; i < 12; i++) {
    const ang = (i / 12) * Math.PI * 2;
    const a = new THREE.Vector3(Math.cos(ang) * 1.2, 0.95, Math.sin(ang) * 1.2);
    const b = new THREE.Vector3(Math.cos(ang) * 7.0, 0.95, Math.sin(ang) * 7.0);
    beamBetween(base, a, b, 0.18, mat.darkSteel);
  }

  // 四个塔架脚座（配重墩 + 法兰）
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      addBox(base, [1.4, 0.5, 1.4], [sx * 3.9, 1.05, sz * 1.55], mat.concrete);
      addBox(base, [0.9, 0.18, 0.9], [sx * 3.9, 1.38, sz * 1.55], mat.darkSteel);
    }
  }
  finalizePart("base", base);

  /* ================================================================
   * 部件 2：主旋转支座（四腿收拢 A 型塔架 + 顶部轴承座箱体）
   * ================================================================ */
  const pivotSupport = new THREE.Group();
  pivotSupport.name = "pivotSupport";

  // 四条斜塔腿，在顶部收拢
  const legTop = new THREE.Vector3(0, 15.4, 0);
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      beamBetween(
        pivotSupport,
        new THREE.Vector3(sx * 3.9, 1.45, sz * 1.55),
        legTop,
        0.52,
        mat.steel
      );
    }
  }

  // 塔架中部交叉加强撑（两个侧面）
  for (const sz of [-1.55, 1.55]) {
    beamBetween(pivotSupport, new THREE.Vector3(-2.6, 5.2, sz), new THREE.Vector3(2.6, 9.6, sz * 0.45), 0.2, mat.darkSteel);
    beamBetween(pivotSupport, new THREE.Vector3(2.6, 5.2, sz), new THREE.Vector3(-2.6, 9.6, sz * 0.45), 0.2, mat.darkSteel);
  }
  // 顶部横担
  beamBetween(pivotSupport, new THREE.Vector3(-1.6, 14.6, 0), new THREE.Vector3(1.6, 14.6, 0), 0.4, mat.darkSteel);

  // 顶部主轴轴承座箱体
  addBox(pivotSupport, [3.4, 2.1, 2.3], [0, 16, 0], mat.steel);
  // 两个静支点轴承座
  for (const sx of [-1, 1]) {
    const bearing = new THREE.Mesh(
      new THREE.CylinderGeometry(0.7, 0.7, 0.75, 24),
      mat.darkSteel
    );
    bearing.rotation.z = Math.PI / 2;
    bearing.position.set(sx * 1.55, 16, 0);
    pivotSupport.add(bearing);
  }
  // 顶部检修平台与护栏
  addBox(pivotSupport, [4.2, 0.18, 3.0], [0, 17.25, -0.2], mat.darkSteel);
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      beamBetween(
        pivotSupport,
        new THREE.Vector3(sx * 2.0, 17.3, sz * 1.3 - 0.2),
        new THREE.Vector3(sx * 2.0, 18.1, sz * 1.3 - 0.2),
        0.07,
        mat.yellow
      );
    }
  }
  finalizePart("pivotSupport", pivotSupport);

  /* ================================================================
   * 运动总节点：摆动中心（位于主轴轴线上）
   * 摆臂、主轴动环、座舱全部挂在该节点下，绕 X 轴往复摆动
   * ================================================================ */
  const swingPivot = new THREE.Group();
  swingPivot.name = "swingPivot";
  swingPivot.position.set(0, 16, 0);
  root.add(swingPivot);

  /* ================================================================
   * 部件 3：摆动主轴（随摆臂一起转动的轴体 + 中央轮毂）
   * ================================================================ */
  const mainShaft = new THREE.Group();
  mainShaft.name = "mainShaft";

  const shaft = new THREE.Mesh(
    new THREE.CylinderGeometry(0.42, 0.42, 4.6, 24),
    mat.steel
  );
  shaft.rotation.z = Math.PI / 2; // 轴线沿 X 方向
  mainShaft.add(shaft);

  // 中央连接轮毂（摆臂法兰就固定在它上面）
  const hub = new THREE.Mesh(
    new THREE.CylinderGeometry(0.92, 0.92, 1.35, 28),
    mat.darkSteel
  );
  hub.rotation.z = Math.PI / 2;
  mainShaft.add(hub);

  // 轴端角度编码器小圆盘
  const encoder = new THREE.Mesh(
    new THREE.CylinderGeometry(0.28, 0.28, 0.22, 20),
    mat.yellow
  );
  encoder.rotation.z = Math.PI / 2;
  encoder.position.x = 2.45;
  mainShaft.add(encoder);
  finalizePart("mainShaft", mainShaft, swingPivot);

  /* ================================================================
   * 部件 4：大摆臂（桁架式箱型臂，长 13 米）
   * ================================================================ */
  const arm = new THREE.Group();
  arm.name = "arm";

  // 根部法兰盘
  addBox(arm, [1.5, 1.1, 1.1], [0, -0.5, 0], mat.darkSteel);

  // 桁架四根弦杆的横截面坐标
  const chordX = 0.34;
  const chordZ = 0.24;
  const topY = -1.0;
  const bottomY = -12.4;
  const segments = 10;
  const corners = [
    [-chordX, -chordZ],
    [chordX, -chordZ],
    [chordX, chordZ],
    [-chordX, chordZ],
  ];

  // 四根主弦杆
  for (const [cx, cz] of corners) {
    beamBetween(
      arm,
      new THREE.Vector3(cx, topY, cz),
      new THREE.Vector3(cx, bottomY, cz),
      0.16,
      mat.redPaint
    );
  }

  // 每隔一段加横隔框 + 两面斜撑
  for (let i = 0; i <= segments; i++) {
    const y = topY + ((bottomY - topY) * i) / segments;
    // 横隔框
    beamBetween(arm, new THREE.Vector3(-chordX, y, -chordZ), new THREE.Vector3(chordX, y, -chordZ), 0.1, mat.steel);
    beamBetween(arm, new THREE.Vector3(-chordX, y, chordZ), new THREE.Vector3(chordX, y, chordZ), 0.1, mat.steel);
    beamBetween(arm, new THREE.Vector3(-chordX, y, -chordZ), new THREE.Vector3(-chordX, y, chordZ), 0.1, mat.steel);
    beamBetween(arm, new THREE.Vector3(chordX, y, -chordZ), new THREE.Vector3(chordX, y, chordZ), 0.1, mat.steel);

    if (i < segments) {
      const y2 = topY + ((bottomY - topY) * (i + 1)) / segments;
      // 前后两面 X 型斜撑
      for (const cz of [-chordZ, chordZ]) {
        beamBetween(arm, new THREE.Vector3(-chordX, y, cz), new THREE.Vector3(chordX, y2, cz), 0.08, mat.steel);
        beamBetween(arm, new THREE.Vector3(chordX, y, cz), new THREE.Vector3(-chordX, y2, cz), 0.08, mat.steel);
      }
    }
  }

  // 臂身涂装标识条
  addBox(arm, [0.72, 0.5, 0.5], [0, -6.5, 0], mat.yellow);

  // 末端连接箱体（座舱回转支承安装位）
  addBox(arm, [1.5, 0.9, 1.5], [0, -12.85, 0], mat.darkSteel);
  finalizePart("arm", arm, swingPivot);

  /* ================================================================
   * 部件 5：座舱（回转圆盘 + 16 个乘客座椅）
   * cabinSpin 为自转节点，整体又随 swingPivot 摆动
   * ================================================================ */
  const cabin = new THREE.Group();
  cabin.name = "cabin";
  cabin.position.set(0, -13, 0); // 挂在摆臂末端

  const cabinSpin = new THREE.Group();
  cabinSpin.name = "cabinSpin";
  cabin.add(cabinSpin);

  // 与摆臂连接的回转支承（大环）
  const slewRing = new THREE.Mesh(
    new THREE.TorusGeometry(1.0, 0.22, 14, 40),
    mat.darkSteel
  );
  slewRing.rotation.x = Math.PI / 2;
  slewRing.position.y = 0.35;
  cabinSpin.add(slewRing);

  // 座舱主圆盘
  const disk = new THREE.Mesh(
    new THREE.CylinderGeometry(4.3, 4.0, 0.45, 48),
    mat.bluePaint
  );
  disk.position.y = -0.05;
  cabinSpin.add(disk);

  // 圆盘外圈防撞环
  const rim = new THREE.Mesh(
    new THREE.TorusGeometry(4.3, 0.13, 12, 64),
    mat.yellow
  );
  rim.rotation.x = Math.PI / 2;
  rim.position.y = -0.05;
  cabinSpin.add(rim);

  // 8 根放射状承力梁
  for (let i = 0; i < 8; i++) {
    const ang = (i / 8) * Math.PI * 2;
    beamBetween(
      cabinSpin,
      new THREE.Vector3(Math.cos(ang) * 0.6, -0.05, Math.sin(ang) * 0.6),
      new THREE.Vector3(Math.cos(ang) * 4.0, -0.05, Math.sin(ang) * 4.0),
      0.12,
      mat.darkSteel
    );
  }

  // 中央装饰锥顶
  const cone = new THREE.Mesh(
    new THREE.ConeGeometry(0.9, 1.0, 24),
    mat.redPaint
  );
  cone.position.y = 0.65;
  cabinSpin.add(cone);

  /**
   * 构建单个乘客座椅（局部坐标：+Z 为乘客面朝的外侧）
   */
  function buildSeat(seatMat) {
    const seat = new THREE.Group();
    // 支撑立柱
    addBox(seat, [0.2, 0.55, 0.2], [0, 0.22, 0], mat.darkSteel);
    // 座兜
    addBox(seat, [0.74, 0.16, 0.72], [0, 0.58, 0], seatMat);
    // 靠背（略微后仰）
    const back = addBox(seat, [0.74, 0.85, 0.14], [0, 1.0, -0.32], seatMat);
    back.rotation.x = -0.14;
    // 两侧扶手
    addBox(seat, [0.09, 0.09, 0.55], [-0.4, 0.78, 0], mat.darkSteel);
    addBox(seat, [0.09, 0.09, 0.55], [0.4, 0.78, 0], mat.darkSteel);
    return seat;
  }

  // 16 个座椅沿圆周均布，全部朝外
  const SEAT_COUNT = 16;
  const SEAT_RADIUS = 3.45;
  for (let i = 0; i < SEAT_COUNT; i++) {
    const ang = (i / SEAT_COUNT) * Math.PI * 2;
    const seat = buildSeat(i % 2 === 0 ? mat.redPaint : mat.bluePaint);
    seat.position.set(
      Math.sin(ang) * SEAT_RADIUS,
      0.2,
      Math.cos(ang) * SEAT_RADIUS
    );
    seat.rotation.y = ang; // 面朝外侧
    cabinSpin.add(seat);
  }
  finalizePart("cabin", cabin, swingPivot);

  /* ================================================================
   * 部件 6（乘人安全件）：安全压杆
   * 单独成组挂在每个座椅上，但统一注册为 harness 部件
   * ================================================================ */
  const harnessAll = new THREE.Group();
  harnessAll.name = "harness";

  for (let i = 0; i < SEAT_COUNT; i++) {
    const ang = (i / SEAT_COUNT) * Math.PI * 2;
    const harness = new THREE.Group();
    harness.position.set(
      Math.sin(ang) * SEAT_RADIUS,
      0.2,
      Math.cos(ang) * SEAT_RADIUS
    );
    harness.rotation.y = ang;

    // 胸口横杆
    cylinderBetween(
      harness,
      new THREE.Vector3(-0.34, 1.12, 0.32),
      new THREE.Vector3(0.34, 1.12, 0.32),
      0.06,
      mat.yellow
    );
    // 两侧翻转臂（铰点在座椅后侧）
    cylinderBetween(
      harness,
      new THREE.Vector3(-0.34, 0.62, -0.28),
      new THREE.Vector3(-0.34, 1.12, 0.32),
      0.05,
      mat.yellow
    );
    cylinderBetween(
      harness,
      new THREE.Vector3(0.34, 0.62, -0.28),
      new THREE.Vector3(0.34, 1.12, 0.32),
      0.05,
      mat.yellow
    );
    // 软垫护套
    addBox(harness, [0.6, 0.1, 0.12], [0, 1.12, 0.36], mat.rubber);
    harnessAll.add(harness);
  }
  finalizePart("harness", harnessAll, cabinSpin);

  /* ================================================================
   * 部件 7：驱动电机结构（塔架顶部平台，固定不摆动）
   * ================================================================ */
  const motorGroup = new THREE.Group();
  motorGroup.name = "motor";

  // 电机安装平台支架
  addBox(motorGroup, [2.8, 0.22, 1.7], [0, 17.45, -1.55], mat.darkSteel);
  beamBetween(motorGroup, new THREE.Vector3(-1.2, 16.9, -1.2), new THREE.Vector3(-1.2, 17.4, -2.1), 0.12, mat.steel);
  beamBetween(motorGroup, new THREE.Vector3(1.2, 16.9, -1.2), new THREE.Vector3(1.2, 17.4, -2.1), 0.12, mat.steel);

  // 主驱动电机（横置圆筒）
  const driveMotor = new THREE.Mesh(
    new THREE.CylinderGeometry(0.52, 0.52, 1.5, 24),
    mat.bluePaint
  );
  driveMotor.rotation.z = Math.PI / 2;
  driveMotor.position.set(-0.35, 18.05, -1.7);
  motorGroup.add(driveMotor);
  // 电机散热筋
  for (let i = 0; i < 6; i++) {
    addBox(motorGroup, [0.06, 0.05, 1.1], [-0.35, 18.55, -2.1 + i * 0.16], mat.darkSteel);
  }

  // 减速机箱体
  addBox(motorGroup, [1.0, 1.0, 1.1], [0.85, 18.0, -1.7], mat.yellow);

  // 常闭式制动器（制动盘 + 卡钳）
  const brake = new THREE.Mesh(
    new THREE.CylinderGeometry(0.46, 0.46, 0.16, 24),
    mat.steel
  );
  brake.rotation.z = Math.PI / 2;
  brake.position.set(-1.25, 18.05, -1.7);
  motorGroup.add(brake);
  addBox(motorGroup, [0.18, 0.5, 0.4], [-1.25, 18.05, -1.2], mat.rubber);

  // 输出小齿轮（与主轴齿圈啮合）
  const gear = new THREE.Mesh(
    new THREE.CylinderGeometry(0.42, 0.42, 0.3, 18),
    mat.darkSteel
  );
  gear.rotation.z = Math.PI / 2;
  gear.position.set(1.55, 17.85, -1.55);
  motorGroup.add(gear);
  finalizePart("motor", motorGroup);

  /* ================================================================
   * 部件 8：限位防护结构（机械缓冲挡块 + 全周安全围栏）
   * ================================================================ */
  const limitGuard = new THREE.Group();
  limitGuard.name = "limitGuard";

  // 摆臂极限位置机械缓冲挡块（安装在轴承座箱体前侧）
  for (const sx of [-1, 1]) {
    const buffer = new THREE.Mesh(
      new THREE.CylinderGeometry(0.28, 0.34, 0.9, 20),
      mat.rubber
    );
    buffer.position.set(sx * 1.2, 15.55, 1.35);
    buffer.rotation.x = 0.55;
    limitGuard.add(buffer);
    // 挡块黄色底座
    addBox(limitGuard, [0.5, 0.25, 0.5], [sx * 1.2, 15.95, 1.1], mat.yellow);
  }

  // 全周安全围栏：包围摆臂完整扫掠范围（半径 18.5m）
  const FENCE_R = 18.5;
  const POST_COUNT = 28;
  for (let i = 0; i < POST_COUNT; i++) {
    const ang = (i / POST_COUNT) * Math.PI * 2;
    const x = Math.sin(ang) * FENCE_R;
    const z = Math.cos(ang) * FENCE_R;
    beamBetween(
      limitGuard,
      new THREE.Vector3(x, 0.1, z),
      new THREE.Vector3(x, 1.35, z),
      0.12,
      i % 2 === 0 ? mat.yellow : mat.darkSteel
    );
  }
  // 两道环形横杆
  for (const y of [0.7, 1.25]) {
    const rail = new THREE.Mesh(
      new THREE.TorusGeometry(FENCE_R, 0.055, 8, 96),
      mat.yellow
    );
    rail.rotation.x = Math.PI / 2;
    rail.position.y = y;
    limitGuard.add(rail);
  }
  finalizePart("limitGuard", limitGuard);

  return {
    root,                 // 整机根节点
    swingPivot,           // 摆动节点（绕 X 轴）
    cabinSpin,            // 座舱自转节点（绕 Y 轴）
    partGroups,
    allMeshes,
    setHighlight,
    setWireframe,
  };
}
