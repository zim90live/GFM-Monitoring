import React, { useMemo, useEffect, useState, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { MeshTransmissionMaterial, Html } from "@react-three/drei";
import { useControls, folder, button } from "leva";
import { defaults } from "../config/params.js";
import { useView } from "../state/ViewContext.jsx";
import { eventForTile, TILE_COUNT } from "../data/events.js";

// 6 天日期（每天对应 360/6 = 60 个 tile）
const DAY_DATES = [
  "2026-04-19", "2026-04-20", "2026-04-21",
  "2026-04-22", "2026-04-23", "2026-04-24",
];

// ============== InstancedMesh 子组件 ==============
// hover 高亮范围（以选中 tile 为中心，~19 个 tile，与详情页 100px 选区一致）
const HOVER_RANGE = 19;
const TILE_TOTAL = 360;
const _hoverColor = new THREE.Color();

function computeHoverRange(hoverIdx) {
  if (hoverIdx == null) return null;
  let lo = hoverIdx - Math.floor(HOVER_RANGE / 2);
  let hi = lo + HOVER_RANGE;
  if (lo < 0) { hi -= lo; lo = 0; }
  if (hi > TILE_TOTAL) { lo -= (hi - TILE_TOTAL); hi = TILE_TOTAL; }
  return [lo, hi];
}

function InstancedTiles({
  tiles, geometry, material, castShadow, receiveShadow,
  hoverIdx, onTileHover, onTileLeave, onTileClick,
}) {
  const ref = useRef();
  const { eRef } = useView();
  const lastE = useRef(-1);
  const dummy = useMemo(() => new THREE.Object3D(), []);

  const writeMatrices = (e) => {
    const inst = ref.current;
    if (!inst) return;
    for (let i = 0; i < tiles.length; i++) {
      const t = tiles[i];
      const px = THREE.MathUtils.lerp(t.position[0], t.linePos[0], e);
      const py = THREE.MathUtils.lerp(t.position[1], t.linePos[1], e);
      const pz = THREE.MathUtils.lerp(t.position[2], t.linePos[2], e);
      const ry = THREE.MathUtils.lerp(t.rotY, t.lineRotY, e);
      const sx = THREE.MathUtils.lerp(1, t.lineScaleX, e);
      dummy.position.set(px, py, pz);
      dummy.rotation.set(0, ry, 0);
      dummy.scale.set(sx, 1, 1);
      dummy.updateMatrix();
      inst.setMatrixAt(i, dummy.matrix);
    }
    inst.instanceMatrix.needsUpdate = true;
    inst.computeBoundingSphere?.();
  };

  useEffect(() => {
    writeMatrices(eRef.current);
    lastE.current = eRef.current;
  }, [tiles]);

  useFrame(() => {
    const e = eRef.current;
    if (Math.abs(e - lastE.current) < 1e-4) return;
    writeMatrices(e);
    lastE.current = e;
  });

  // hover 高亮：在 hover 范围内 tile 全亮，外侧 tile 用 instanceColor 调暗
  useEffect(() => {
    const inst = ref.current;
    if (!inst) return;
    const range = computeHoverRange(hoverIdx);
    for (let i = 0; i < tiles.length; i++) {
      const gi = tiles[i].idx;
      if (range == null) {
        _hoverColor.setRGB(1, 1, 1);
      } else if (gi >= range[0] && gi < range[1]) {
        _hoverColor.setRGB(1, 1, 1);
      } else {
        _hoverColor.setRGB(0.12, 0.12, 0.12);
      }
      inst.setColorAt(i, _hoverColor);
    }
    if (inst.instanceColor) inst.instanceColor.needsUpdate = true;
  }, [tiles, hoverIdx]);

  const handleClick = (e) => {
    const i = e.instanceId;
    if (i == null) return;
    e.stopPropagation();
    onTileClick?.(tiles[i].idx, e);
  };
  const handlePointerMove = (e) => {
    const i = e.instanceId;
    if (i == null) return;
    e.stopPropagation();
    onTileHover?.(tiles[i].idx);
  };
  const handlePointerOut = () => {
    onTileLeave?.();
  };

  return (
    <instancedMesh
      ref={ref}
      args={[geometry, material, tiles.length]}
      castShadow={castShadow}
      receiveShadow={receiveShadow}
      onClick={handleClick}
      onPointerMove={handlePointerMove}
      onPointerOut={handlePointerOut}
    />
  );
}

// ============== Tile 颜色：每个 tile 对应一个事件，颜色 = 事件 type ==============
function buildAssignments(tileCount, coloredRatio, seed) {
  const result = new Array(tileCount).fill("glass");
  for (let i = 0; i < tileCount; i++) {
    const ev = eventForTile(i, coloredRatio, seed);
    if (ev) result[i] = ev.type;
  }
  return result;
}

// 玻璃 detail 态目标值
const GLASS_DETAIL_COLOR = "#484848";
const GLASS_DETAIL_TRANSMISSION = 0.6;
// 复用 Color 实例避免每帧分配
const _colA = new THREE.Color();
const _colB = new THREE.Color();
function lerpHex(from, to, t) {
  _colA.set(from);
  _colB.set(to);
  _colA.lerp(_colB, t);
  return `#${_colA.getHexString()}`;
}

// 筛选状态下的非匹配 tile 透明度
const FILTER_DIM_OPACITY = 0.08;

export default function Ring({ envIntensity = 1 }) {
  const { eased, enter, view, filter } = useView();
  const [hoverIdx, setHoverIdx] = useState(null);

  // 进入详情态时清掉 hover 高亮
  useEffect(() => {
    if (view !== "overview") setHoverIdx(null);
  }, [view]);

  const handleTileHover = (gi) => {
    if (view !== "overview") return;
    setHoverIdx((prev) => (prev === gi ? prev : gi));
  };
  const handleTileLeave = () => {
    setHoverIdx(null);
  };
  const handleTileClick = (gi) => {
    if (view !== "overview") return;
    // 计算选区起始位置：让点击的 tile 落在选区中心
    const halfRange = HOVER_RANGE / 2;
    const trackUsable = 1872;
    const selWidthRatio = 100 / trackUsable;
    let selLeft = (gi - halfRange) / TILE_TOTAL;
    selLeft = Math.max(0, Math.min(1 - selWidthRatio, selLeft));
    enter(selLeft);
  };
  // 圆环主参数
  const r = useControls("圆环", {
    radius: { value: defaults.ring.radius, min: 1, max: 20, step: 0.1, label: "半径" },
    tileCount: { value: defaults.ring.tileCount, min: 8, max: 600, step: 1, label: "总片数" },
    tileWidth: { value: defaults.ring.tileWidth, min: 0.01, max: 1, step: 0.01, label: "片宽" },
    tileDepth: { value: defaults.ring.tileDepth, min: 0.05, max: 3, step: 0.01, label: "片深" },
    heightBase: { value: defaults.ring.heightBase, min: 0.1, max: 5, step: 0.01, label: "片高" },
    rotationDeg: { value: defaults.ring.rotationDeg, min: -180, max: 180, step: 0.1, label: "旋转°" },
    castShadow: { value: defaults.ring.castShadow, label: "投阴影" },
  }, { collapsed: true });

  // 玻璃材质（drei MeshTransmissionMaterial）
  const g = useControls("圆环 · 玻璃 (MTM)", {
    color: { value: defaults.ring.glass.color, label: "颜色" },
    transmission: { value: defaults.ring.glass.transmission, min: 0, max: 1, step: 0.01, label: "透射" },
    opacity: { value: defaults.ring.glass.opacity, min: 0, max: 1, step: 0.01, label: "不透明度" },
    roughness: { value: defaults.ring.glass.roughness, min: 0, max: 1, step: 0.01, label: "粗糙度" },
    metalness: { value: defaults.ring.glass.metalness, min: 0, max: 1, step: 0.01, label: "金属度" },
    ior: { value: defaults.ring.glass.ior, min: 1, max: 2.5, step: 0.01, label: "折射率" },
    thickness: { value: defaults.ring.glass.thickness, min: 0, max: 5, step: 0.01, label: "厚度" },
    clearcoat: { value: defaults.ring.glass.clearcoat, min: 0, max: 1, step: 0.01, label: "清漆" },
    clearcoatRoughness: { value: defaults.ring.glass.clearcoatRoughness, min: 0, max: 1, step: 0.01, label: "清漆粗糙度" },
    attenuationColor: { value: defaults.ring.glass.attenuationColor, label: "体内染色" },
    attenuationDistance: { value: defaults.ring.glass.attenuationDistance, min: 0.1, max: 20, step: 0.1, label: "染色衰减" },
    "MTM 专属": folder({
      backside: { value: defaults.ring.glass.backside, label: "背面渲染" },
      samples: { value: defaults.ring.glass.samples, min: 1, max: 16, step: 1, label: "采样数" },
      resolution: { value: defaults.ring.glass.resolution, options: [128, 256, 512, 1024], label: "FBO 分辨率" },
      chromaticAberration: { value: defaults.ring.glass.chromaticAberration, min: 0, max: 1, step: 0.01, label: "色散" },
      anisotropy: { value: defaults.ring.glass.anisotropy, min: 0, max: 1, step: 0.01, label: "各向异性" },
      distortion: { value: defaults.ring.glass.distortion, min: 0, max: 1, step: 0.01, label: "扰动" },
      distortionScale: { value: defaults.ring.glass.distortionScale, min: 0, max: 5, step: 0.01, label: "扰动尺度" },
      temporalDistortion: { value: defaults.ring.glass.temporalDistortion, min: 0, max: 1, step: 0.01, label: "时间扰动" },
    }, { collapsed: true }),
  }, { collapsed: true });

  // 亚克力 4 色
  const [a, setA] = useControls("圆环 · 亚克力", () => ({
    coloredRatio: { value: defaults.ring.acrylic.coloredRatio, min: 0, max: 1, step: 0.01, label: "染色比例" },
    seed: { value: defaults.ring.acrylic.seed, min: 0, max: 9999, step: 1, label: "随机种子" },
    "🎲 重新洗牌": button(() => setA({ seed: Math.floor(Math.random() * 9999) })),
    "共用属性": folder({
      aTransmission: { value: defaults.ring.acrylic.transmission, min: 0, max: 1, step: 0.01, label: "透射" },
      aOpacity: { value: defaults.ring.acrylic.opacity, min: 0, max: 1, step: 0.01, label: "不透明度" },
      aRoughness: { value: defaults.ring.acrylic.roughness, min: 0, max: 1, step: 0.01, label: "粗糙度" },
      aMetalness: { value: defaults.ring.acrylic.metalness, min: 0, max: 1, step: 0.01, label: "金属度" },
      aIor: { value: defaults.ring.acrylic.ior, min: 1, max: 2.5, step: 0.01, label: "折射率" },
      aThickness: { value: defaults.ring.acrylic.thickness, min: 0, max: 5, step: 0.01, label: "厚度" },
      aClearcoat: { value: defaults.ring.acrylic.clearcoat, min: 0, max: 1, step: 0.01, label: "清漆" },
      aClearcoatRoughness: { value: defaults.ring.acrylic.clearcoatRoughness, min: 0, max: 1, step: 0.01, label: "清漆粗糙度" },
    }, { collapsed: true }),
    "颜色": folder({
      cPink: { value: defaults.ring.acrylic.colorPink, label: "粉红" },
      cOrange: { value: defaults.ring.acrylic.colorOrange, label: "橙" },
      cBlue: { value: defaults.ring.acrylic.colorBlue, label: "蓝" },
      cGreen: { value: defaults.ring.acrylic.colorGreen, label: "绿" },
    }, { collapsed: true }),
  }), { collapsed: true });

  // 8 段（yOffset + ratio）
  const segCfg = useControls(
    "圆环 · 分段（8 段）",
    Object.fromEntries(
      defaults.ring.segments.map((s, i) => [
        `段${i + 1}`,
        folder({
          [`y${i}`]: { value: s.yOffset, min: -5, max: 5, step: 0.01, label: "Y 偏移" },
          [`r${i}`]: { value: s.ratio, min: 0, max: 10, step: 0.01, label: "占比" },
        }, { collapsed: true }),
      ])
    ),
    { collapsed: true }
  );

  // ===== 共享几何体 =====
  const geometry = useMemo(
    () => new THREE.BoxGeometry(r.tileWidth, r.heightBase, r.tileDepth),
    [r.tileWidth, r.heightBase, r.tileDepth]
  );
  useEffect(() => () => geometry.dispose(), [geometry]);

  // ===== 共享玻璃材质（drei MeshTransmissionMaterial） =====
  // 挂在一个隐藏的 carrier mesh 上，每帧渲染一张 backside FBO 给所有 360 玻璃面片复用
  const [glassMat, setGlassMat] = useState(null);
  useEffect(() => {
    // 同步 envIntensity 到 MTM 实例（其他属性已通过 JSX props 实时同步）
    if (glassMat) glassMat.envMapIntensity = envIntensity;
  }, [glassMat, envIntensity]);

  // ===== 4 个亚克力材质（共享一份属性 + 各自颜色） =====
  const acrylicMats = useMemo(() => {
    const make = () => new THREE.MeshPhysicalMaterial({ transparent: true });
    return { pink: make(), orange: make(), blue: make(), green: make() };
  }, []);
  useEffect(() => {
    return () => {
      for (const m of Object.values(acrylicMats)) m.dispose();
    };
  }, [acrylicMats]);

  useEffect(() => {
    const colorFor = {
      pink: a.cPink, orange: a.cOrange, blue: a.cBlue, green: a.cGreen,
    };
    for (const [k, m] of Object.entries(acrylicMats)) {
      m.color.set(colorFor[k]);
      m.transmission = a.aTransmission;
      // 筛选生效时：选中的颜色保持原 opacity，其他降到 FILTER_DIM_OPACITY
      m.opacity = filter == null || filter === k ? a.aOpacity : FILTER_DIM_OPACITY;
      m.roughness = a.aRoughness;
      m.metalness = a.aMetalness;
      m.ior = a.aIor;
      m.thickness = a.aThickness;
      m.clearcoat = a.aClearcoat;
      m.clearcoatRoughness = a.aClearcoatRoughness;
      m.envMapIntensity = envIntensity;
      m.needsUpdate = true;
    }
  }, [
    acrylicMats,
    a.cPink, a.cOrange, a.cBlue, a.cGreen,
    a.aTransmission, a.aOpacity, a.aRoughness, a.aMetalness,
    a.aIor, a.aThickness, a.aClearcoat, a.aClearcoatRoughness,
    envIntensity, filter,
  ]);

  // ===== 计算每片位置 + 旋转（含详情态目标位置） =====
  const tiles = useMemo(() => {
    const segments = defaults.ring.segments.map((_, i) => ({
      yOffset: segCfg[`y${i}`],
      ratio: segCfg[`r${i}`],
    }));
    const totalRatio =
      segments.reduce((s, x) => s + Math.max(x.ratio, 0), 0) || 1;

    // 详情态：所有 tile 沿 X 等距分布，朝向相机
    const dCfg = defaults.ring.detail;
    const totalLen = 2 * Math.PI * r.radius * dCfg.strideMul;
    const stride = totalLen / r.tileCount;

    const arr = [];
    // 时间在环上逆时针增长（从顶部出发，先经左侧→底→右侧）
    let cumAngle = -Math.PI / 2;
    let globalIdx = 0;
    for (const seg of segments) {
      const ratio = Math.max(seg.ratio, 0) / totalRatio;
      const segAngle = ratio * Math.PI * 2;
      const segTiles = Math.max(0, Math.round(r.tileCount * ratio));
      if (segTiles === 0) {
        cumAngle -= segAngle;
        continue;
      }
      for (let i = 0; i < segTiles; i++) {
        const t = (i + 0.5) / segTiles;
        const angle = cumAngle - t * segAngle;
        const y = r.heightBase / 2 + seg.yOffset;
        const px = Math.cos(angle) * r.radius;
        const pz = Math.sin(angle) * r.radius;
        const rotY = Math.atan2(-px, -pz);

        // 直线目标：x 等距、y/z 固定，朝相机（rotY=0）；
        // X 缩放：留出 gapRatio 空隙让 tile 边界清晰
        const idx = globalIdx;
        const linePx = (idx - r.tileCount / 2 + 0.5) * stride;
        const linePos = [linePx, dCfg.lineY, dCfg.lineZ];
        const lineRotY = 0;
        const lineScaleX = (stride / r.tileWidth) * (1 - dCfg.gapRatio);

        arr.push({
          idx,
          position: [px, y, pz], rotY,
          linePos, lineRotY, lineScaleX,
        });
        globalIdx++;
      }
      cumAngle -= segAngle;
    }
    return arr;
  }, [r.tileCount, r.radius, r.heightBase, segCfg]);

  // ===== 抽取分配（圆形相邻：visual index 即可） =====
  const assignments = useMemo(
    () => buildAssignments(tiles.length, a.coloredRatio, a.seed),
    [tiles.length, a.coloredRatio, a.seed]
  );

  // ===== 6 个日期标签（圆周态 + 直线态目标位置） =====
  const segmentLabels = useMemo(() => {
    const result = [];
    const N = DAY_DATES.length;
    const py = r.heightBase + 1.0;
    const dCfg = defaults.ring.detail;
    const totalLen = 2 * Math.PI * r.radius * dCfg.strideMul;
    for (let i = 0; i < N; i++) {
      // 与 tile 同向逆时针：从顶部开始减角度
      const centerAngle = -Math.PI / 2 - ((i + 0.5) / N) * Math.PI * 2;
      const px = Math.cos(centerAngle) * r.radius;
      const pz = Math.sin(centerAngle) * r.radius;
      const lineX = ((i + 0.5) / N - 0.5) * totalLen;
      result.push({
        position: [px, py, pz],
        linePos: [lineX, dCfg.lineY + 0.7, dCfg.lineZ],
        date: DAY_DATES[i],
        key: i,
      });
    }
    return result;
  }, [r.radius, r.heightBase]);

  // ===== 按材质分组（InstancedMesh 每组一个） =====
  const groupedTiles = useMemo(() => {
    const g = { glass: [], pink: [], orange: [], blue: [], green: [] };
    for (let i = 0; i < tiles.length; i++) {
      g[assignments[i]].push(tiles[i]);
    }
    return g;
  }, [tiles, assignments]);

  const materialFor = (key) =>
    key === "glass" ? glassMat : acrylicMats[key];

  // 几何体维度变化时强制重建 InstancedMesh
  const geomKey = `${r.tileWidth}-${r.tileDepth}-${r.heightBase}`;

  return (
    <>
      {/* 隐藏 carrier：挂载唯一的 MTM，所有玻璃面片共享其材质实例 */}
      <mesh visible={false} key={`mtm-${g.samples}-${g.resolution}`}>
        <boxGeometry args={[0.001, 0.001, 0.001]} />
        <MeshTransmissionMaterial
          ref={(m) => { if (m && m !== glassMat) setGlassMat(m); }}
          color={lerpHex(g.color, GLASS_DETAIL_COLOR, eased)}
          transmission={THREE.MathUtils.lerp(g.transmission, GLASS_DETAIL_TRANSMISSION, eased)}
          opacity={g.opacity}
          roughness={g.roughness}
          metalness={g.metalness}
          ior={g.ior}
          thickness={g.thickness}
          clearcoat={g.clearcoat}
          clearcoatRoughness={g.clearcoatRoughness}
          attenuationColor={g.attenuationColor}
          attenuationDistance={g.attenuationDistance}
          backside={g.backside}
          samples={g.samples}
          resolution={g.resolution}
          chromaticAberration={g.chromaticAberration}
          anisotropy={g.anisotropy}
          distortion={g.distortion}
          distortionScale={g.distortionScale}
          temporalDistortion={g.temporalDistortion}
          transparent
        />
      </mesh>

      <group rotation={[0, THREE.MathUtils.lerp(THREE.MathUtils.degToRad(r.rotationDeg), 0, eased), 0]}>
        {Object.entries(groupedTiles).map(([key, list]) => {
          const mat = materialFor(key);
          if (list.length === 0 || !mat) return null;
          return (
            <InstancedTiles
              key={`${key}-${list.length}-${geomKey}`}
              tiles={list}
              geometry={geometry}
              material={mat}
              castShadow={r.castShadow}
              receiveShadow={true}
              hoverIdx={hoverIdx}
              onTileHover={handleTileHover}
              onTileLeave={handleTileLeave}
              onTileClick={handleTileClick}
            />
          );
        })}

        {/* 3D 日期标签：仅在 overview 状态显示（e<0.5 内淡出）；详情页用 EventDetail 的 2D 顶部坐标轴 */}
        {(() => {
          const labelOpacity = Math.max(0, 1 - eased / 0.5);
          if (labelOpacity <= 0) return null;
          return segmentLabels.map((s) => (
            <Html
              key={s.key}
              position={s.position}
              center
              style={{ pointerEvents: "none", opacity: labelOpacity }}
              zIndexRange={[5, 0]}
            >
              <div className="ring-date-label">{s.date}</div>
            </Html>
          ));
        })()}
      </group>
    </>
  );
}
