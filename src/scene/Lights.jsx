import { useMemo, useEffect, useRef } from "react";
import * as THREE from "three";
import { useControls, folder, button } from "leva";
import { AccumulativeShadows, RandomizedLight } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { defaults } from "../config/params.js";
import { shadowsRef } from "./shadowRef.js";
import { useView } from "../state/ViewContext.jsx";

function azElToPos(azDeg, elDeg, dist) {
  const az = THREE.MathUtils.degToRad(azDeg);
  const el = THREE.MathUtils.degToRad(elDeg);
  return [
    dist * Math.cos(el) * Math.sin(az),
    dist * Math.sin(el),
    dist * Math.cos(el) * Math.cos(az),
  ];
}

export default function Lights() {
  const { eRef } = useView();
  const detailLightRef = useRef();
  const detailAmbientRef = useRef();
  const shadowsContainerRef = useRef();

  const cfg = useControls(
    "灯光",
    {
      ambient: { value: defaults.lights.ambient, min: 0, max: 3, step: 0.01, label: "环境光" },
      "详情态": folder({
        detailFrontIntensity: { value: 0.8, min: 0, max: 5, step: 0.05, label: "正面补光" },
        detailAmbientBoost: { value: 0, min: 0, max: 3, step: 0.05, label: "环境光增量" },
      }, { collapsed: true }),
      主光: folder(
        {
          keyIntensity: { value: defaults.lights.key.intensity, min: 0, max: 5, step: 0.01, label: "强度" },
          keyAzimuth: { value: defaults.lights.key.azimuth, min: -180, max: 180, step: 1, label: "方位角°" },
          keyElevation: { value: defaults.lights.key.elevation, min: 0, max: 90, step: 1, label: "高度角°" },
          keyDistance: { value: defaults.lights.key.distance, min: 5, max: 100, step: 0.5, label: "距离" },
        },
        { collapsed: true }
      ),
      补光: folder(
        {
          rimColor: { value: defaults.lights.rim.color, label: "颜色" },
          rimIntensity: { value: defaults.lights.rim.intensity, min: 0, max: 3, step: 0.01, label: "强度" },
          rimAzimuth: { value: defaults.lights.rim.azimuth, min: -180, max: 180, step: 1, label: "方位角°" },
          rimElevation: { value: defaults.lights.rim.elevation, min: -10, max: 90, step: 1, label: "高度角°" },
          rimDistance: { value: defaults.lights.rim.distance, min: 5, max: 100, step: 0.5, label: "距离" },
        },
        { collapsed: true }
      ),
    },
    { collapsed: true }
  );

  // 累积阴影（烘焙到贴图，零每帧成本）
  const [sh, setSh] = useControls(
    "阴影 (Accumulative)",
    () => ({
      enabled: { value: defaults.shadow.enabled, label: "启用" },
      frames: { value: defaults.shadow.frames, min: 1, max: 200, step: 1, label: "累积帧数" },
      radius: { value: defaults.shadow.radius, min: 0, max: 20, step: 0.1, label: "光源抖动半径" },
      opacity: { value: defaults.shadow.opacity, min: 0, max: 1, step: 0.01, label: "不透明度" },
      scale: { value: defaults.shadow.scale, min: 1, max: 200, step: 1, label: "阴影面尺寸" },
      blend: { value: defaults.shadow.blend, min: 0, max: 100, step: 0.5, label: "混合" },
      "🔄 重新烘焙": button(() => shadowsRef.current?.reset()),
    }),
    { collapsed: true }
  );

  const keyPos = useMemo(
    () => azElToPos(cfg.keyAzimuth, cfg.keyElevation, cfg.keyDistance),
    [cfg.keyAzimuth, cfg.keyElevation, cfg.keyDistance]
  );
  const rimPos = useMemo(
    () => azElToPos(cfg.rimAzimuth, cfg.rimElevation, cfg.rimDistance),
    [cfg.rimAzimuth, cfg.rimElevation, cfg.rimDistance]
  );

  // 灯光参数变 → 阴影需要重烘
  useEffect(() => {
    shadowsRef.current?.reset();
  }, [cfg.keyAzimuth, cfg.keyElevation, cfg.keyDistance, sh.radius, sh.frames]);

  // 转场期：详情灯随 e 渐入（0→1），阴影 group 渐出
  useFrame(() => {
    const e = eRef.current;
    const inFactor = Math.max(0, (e - 0.3) / 0.7); // 30% 后开始亮起，到 100% 全亮
    if (detailLightRef.current) {
      detailLightRef.current.intensity = cfg.detailFrontIntensity * inFactor;
    }
    if (detailAmbientRef.current) {
      detailAmbientRef.current.intensity = cfg.detailAmbientBoost * inFactor;
    }
    if (shadowsContainerRef.current) {
      const fade = 1 - Math.min(1, e / 0.6);
      shadowsContainerRef.current.visible = sh.enabled && fade > 0.001;
    }
  });

  return (
    <>
      <ambientLight intensity={cfg.ambient} />
      {/* 详情态：额外环境光提亮整体 */}
      <ambientLight ref={detailAmbientRef} intensity={0} />

      {/* 主光（不投实时阴影，让 AccumulativeShadows 接管） */}
      <directionalLight
        position={keyPos}
        intensity={cfg.keyIntensity}
      />

      {/* 补光（不投阴影） */}
      <directionalLight
        position={rimPos}
        intensity={cfg.rimIntensity}
        color={cfg.rimColor}
      />

      {/* 详情态正面补光：从 +Z 方向打过来照亮 tile 朝相机的正面，转场后期渐入 */}
      <directionalLight
        ref={detailLightRef}
        position={[0, 4.5, 30]}
        intensity={0}
      />

      {/* 累积阴影：烘焙完后冻结，每帧 0 成本 */}
      {sh.enabled && (
        <group ref={shadowsContainerRef}>
          <AccumulativeShadows
            ref={shadowsRef}
            key={`${sh.frames}-${sh.scale}`}
            temporal
            frames={sh.frames}
            alphaTest={0.85}
            scale={sh.scale}
            opacity={sh.opacity}
            blend={sh.blend}
            color="#000000"
            position={[0, 0.005, 0]}
          >
            <RandomizedLight
              amount={8}
              radius={sh.radius}
              ambient={0.5}
              intensity={Math.PI}
              position={keyPos}
              bias={0.001}
              size={30}        /* 关键：阴影摄像机正交边界，必须覆盖整个场景 */
              near={0.5}
              far={120}
              mapSize={1024}
            />
          </AccumulativeShadows>
        </group>
      )}
    </>
  );
}
