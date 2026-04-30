import React, { useMemo, useEffect, useState, useRef } from "react";
import * as THREE from "three";
import { MeshTransmissionMaterial } from "@react-three/drei";
import { useControls, folder, button } from "leva";
import { defaults } from "../config/params.js";

// ============== InstancedMesh 子组件 ==============
function InstancedTiles({ tiles, geometry, material, castShadow, receiveShadow }) {
  const ref = useRef();
  useEffect(() => {
    const inst = ref.current;
    if (!inst) return;
    const dummy = new THREE.Object3D();
    for (let i = 0; i < tiles.length; i++) {
      const t = tiles[i];
      dummy.position.set(t.position[0], t.position[1], t.position[2]);
      dummy.rotation.set(0, t.rotY, 0);
      dummy.updateMatrix();
      inst.setMatrixAt(i, dummy.matrix);
    }
    inst.instanceMatrix.needsUpdate = true;
    inst.computeBoundingSphere?.();
  }, [tiles]);

  return (
    <instancedMesh
      ref={ref}
      args={[geometry, material, tiles.length]}
      castShadow={castShadow}
      receiveShadow={receiveShadow}
    />
  );
}

// ============== 工具：seeded RNG（mulberry32） ==============
function mulberry32(seed) {
  let t = seed >>> 0;
  return () => {
    t = (t + 0x6d2b79f5) >>> 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

// ============== 抽取算法：1-6 连续相邻一组，组内同色 ==============
const COLOR_KEYS = ["pink", "orange", "blue", "green"];

function buildAssignments(tileCount, coloredRatio, seed) {
  const rng = mulberry32(seed);
  const result = new Array(tileCount).fill("glass");
  const target = Math.round(tileCount * coloredRatio);
  let colored = 0;
  let i = 0;
  while (i < tileCount) {
    const remaining = tileCount - i;
    const needed = Math.max(0, target - colored);
    const p = remaining > 0 ? Math.min(1, needed / remaining) : 0;
    const groupLen = 1 + Math.floor(rng() * 6); // 1..6
    if (rng() < p) {
      // 染色组：随机选 1 种颜色
      const color = COLOR_KEYS[Math.floor(rng() * COLOR_KEYS.length)];
      const end = Math.min(i + groupLen, tileCount);
      for (let k = i; k < end; k++) result[k] = color;
      colored += end - i;
      i = end;
    } else {
      // 玻璃组：跳过这段
      i = Math.min(i + groupLen, tileCount);
    }
  }
  return result;
}

export default function Ring({ envIntensity = 1 }) {
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
      m.opacity = a.aOpacity;
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
    envIntensity,
  ]);

  // ===== 计算每片位置 + 旋转 =====
  const tiles = useMemo(() => {
    const segments = defaults.ring.segments.map((_, i) => ({
      yOffset: segCfg[`y${i}`],
      ratio: segCfg[`r${i}`],
    }));
    const totalRatio =
      segments.reduce((s, x) => s + Math.max(x.ratio, 0), 0) || 1;

    const arr = [];
    let cumAngle = -Math.PI / 2;
    for (const seg of segments) {
      const ratio = Math.max(seg.ratio, 0) / totalRatio;
      const segAngle = ratio * Math.PI * 2;
      const segTiles = Math.max(0, Math.round(r.tileCount * ratio));
      if (segTiles === 0) {
        cumAngle += segAngle;
        continue;
      }
      for (let i = 0; i < segTiles; i++) {
        const t = (i + 0.5) / segTiles;
        const angle = cumAngle + t * segAngle;
        const y = r.heightBase / 2 + seg.yOffset;
        const px = Math.cos(angle) * r.radius;
        const pz = Math.sin(angle) * r.radius;
        const rotY = Math.atan2(-px, -pz);
        arr.push({ position: [px, y, pz], rotY });
      }
      cumAngle += segAngle;
    }
    return arr;
  }, [r.tileCount, r.radius, r.heightBase, segCfg]);

  // ===== 抽取分配（圆形相邻：visual index 即可） =====
  const assignments = useMemo(
    () => buildAssignments(tiles.length, a.coloredRatio, a.seed),
    [tiles.length, a.coloredRatio, a.seed]
  );

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
          color={g.color}
          transmission={g.transmission}
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

      <group rotation={[0, THREE.MathUtils.degToRad(r.rotationDeg), 0]}>
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
            />
          );
        })}
      </group>
    </>
  );
}
