import { useMemo } from "react";
import * as THREE from "three";
import { useControls, folder } from "leva";
import { defaults } from "../config/params.js";

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
  const cfg = useControls("灯光", {
    ambient: { value: defaults.lights.ambient, min: 0, max: 3, step: 0.01, label: "环境光" },
    主光: folder({
      keyIntensity: { value: defaults.lights.key.intensity, min: 0, max: 5, step: 0.01, label: "强度" },
      keyAzimuth: { value: defaults.lights.key.azimuth, min: -180, max: 180, step: 1, label: "方位角°" },
      keyElevation: { value: defaults.lights.key.elevation, min: 0, max: 90, step: 1, label: "高度角°" },
      keyDistance: { value: defaults.lights.key.distance, min: 5, max: 100, step: 0.5, label: "距离" },
    }, { collapsed: true }),
    补光: folder({
      rimColor: { value: defaults.lights.rim.color, label: "颜色" },
      rimIntensity: { value: defaults.lights.rim.intensity, min: 0, max: 3, step: 0.01, label: "强度" },
      rimAzimuth: { value: defaults.lights.rim.azimuth, min: -180, max: 180, step: 1, label: "方位角°" },
      rimElevation: { value: defaults.lights.rim.elevation, min: -10, max: 90, step: 1, label: "高度角°" },
      rimDistance: { value: defaults.lights.rim.distance, min: 5, max: 100, step: 0.5, label: "距离" },
    }, { collapsed: true }),
  }, { collapsed: true });

  const keyPos = useMemo(
    () => azElToPos(cfg.keyAzimuth, cfg.keyElevation, cfg.keyDistance),
    [cfg.keyAzimuth, cfg.keyElevation, cfg.keyDistance]
  );
  const rimPos = useMemo(
    () => azElToPos(cfg.rimAzimuth, cfg.rimElevation, cfg.rimDistance),
    [cfg.rimAzimuth, cfg.rimElevation, cfg.rimDistance]
  );

  return (
    <>
      <ambientLight intensity={cfg.ambient} />

      {/* 主光（日光，唯一投阴影；柔和度由全局 SoftShadows 控制） */}
      <directionalLight
        position={keyPos}
        intensity={cfg.keyIntensity}
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
        shadow-camera-left={-30}
        shadow-camera-right={30}
        shadow-camera-top={30}
        shadow-camera-bottom={-30}
        shadow-camera-near={0.5}
        shadow-camera-far={80}
        shadow-bias={-0.0005}
      />

      {/* 补光（不投阴影） */}
      <directionalLight
        position={rimPos}
        intensity={cfg.rimIntensity}
        color={cfg.rimColor}
      />
    </>
  );
}
