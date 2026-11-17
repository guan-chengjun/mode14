/**
 * annotations.js
 * 部件标注与讲解交互模块。
 *
 * 职责：
 *   1. 通过 Raycaster 实现 3D 场景内的部件点击拾取；
 *   2. 点击后高亮该部件，并在右侧面板展示结构 / 作用 / 功能讲解；
 *   3. 同步渲染部件目录列表，支持从目录直接选择；
 *   4. 鼠标悬停可点击部件时变为手型。
 */

import * as THREE from "three";
import { PART_INFO, PART_ORDER } from "./parts.js";

export class AnnotationManager {
  /**
   * @param {THREE.WebGLRenderer} renderer
   * @param {THREE.Camera} camera
   * @param {object} ride buildRide() 的返回对象
   */
  constructor(renderer, camera, ride) {
    this.renderer = renderer;
    this.camera = camera;
    this.ride = ride;
    this.raycaster = new THREE.Raycaster();
    this.pointer = new THREE.Vector2();
    this.selectedId = null;
    this.downPos = null; // 记录按下位置，用于区分“点击”与“拖拽旋转”

    this.listEl = document.getElementById("part-list");
    this.listView = document.getElementById("part-list-view");
    this.detailView = document.getElementById("part-detail-view");
    this.titleEl = document.getElementById("detail-title");
    this.descEl = document.getElementById("detail-desc");
    this.pointsEl = document.getElementById("detail-points");

    this._buildList();
    this._bindEvents();
  }

  /** 渲染右侧部件目录 */
  _buildList() {
    this.listEl.innerHTML = "";
    PART_ORDER.forEach((id, index) => {
      const li = document.createElement("li");
      li.dataset.partId = id;
      li.innerHTML = `<span class="part-index">${index + 1}</span>${PART_INFO[id].title}`;
      li.addEventListener("click", () => this.selectById(id));
      this.listEl.appendChild(li);
    });
  }

  /** 绑定画布指针事件 */
  _bindEvents() {
    const dom = this.renderer.domElement;

    dom.addEventListener("pointerdown", (e) => {
      this.downPos = { x: e.clientX, y: e.clientY };
    });

    dom.addEventListener("pointerup", (e) => {
      // 位移过大说明是在拖拽旋转视角，不触发拾取
      if (this.downPos) {
        const dx = e.clientX - this.downPos.x;
        const dy = e.clientY - this.downPos.y;
        if (Math.hypot(dx, dy) > 6) return;
      }
      this._pick(e);
    });

    // 悬停切换鼠标手型
    dom.addEventListener("pointermove", (e) => {
      if (e.buttons !== 0) return; // 拖拽中不处理
      const hit = this._raycast(e);
      dom.style.cursor = hit ? "pointer" : "default";
    });

    // 返回目录按钮
    document.getElementById("btn-back").addEventListener("click", () => {
      this.deselect();
    });
  }

  /** 执行一次射线拾取并选中最近的部件 */
  _pick(event) {
    const hit = this._raycast(event);
    if (hit) {
      this.selectById(hit.object.userData.partId);
    }
  }

  /** 射线检测，返回距离相机最近的命中对象 */
  _raycast(event) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    this.raycaster.setFromCamera(this.pointer, this.camera);
    const hits = this.raycaster.intersectObjects(this.ride.allMeshes, false);
    return hits.length > 0 ? hits[0] : null;
  }

  /** 按部件 id 选中：高亮 + 展示讲解 */
  selectById(id) {
    if (!PART_INFO[id]) return;

    // 取消旧高亮
    if (this.selectedId) {
      this.ride.setHighlight(this.selectedId, false);
    }
    this.selectedId = id;
    this.ride.setHighlight(id, true);

    // 填充详情视图
    const info = PART_INFO[id];
    this.titleEl.textContent = info.title;
    this.descEl.textContent = info.desc;
    this.pointsEl.innerHTML = info.points.map((p) => `<li>${p}</li>`).join("");

    this.listView.hidden = true;
    this.detailView.hidden = false;
  }

  /** 取消选中，回到目录视图 */
  deselect() {
    if (this.selectedId) {
      this.ride.setHighlight(this.selectedId, false);
      this.selectedId = null;
    }
    this.detailView.hidden = true;
    this.listView.hidden = false;
  }
}
