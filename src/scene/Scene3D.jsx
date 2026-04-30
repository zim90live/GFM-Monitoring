import React, { Suspense } from "react";
import { Canvas } from "@react-three/fiber";
import { Environment, SoftShadows } from "@react-three/drei";
import * as THREE from "three";
import { useControls } from "leva";

import { defaults } from "../config/params.js";
import RendererSettings from "./RendererSettings.jsx";
import CameraRig from "./CameraRig.jsx";
import Lights from "./Lights.jsx";
import Ground from "./Ground.jsx";
import Ring from "./Ring.jsx";
import Models from "./Models.jsx";

const ENV_PRESETS = [
  "city", "studio", "warehouse", "sunset", "dawn",
  "night", "forest", "apartment", "park", "lobby",
];

export default function Scene3D() {
  const r = useControls("渲染", {
    exposure: { value: defaults.renderer.exposure, min: 0, max: 3, step: 0.01, label: "曝光" },
    background: { value: defaults.renderer.background, label: "背景" },
    envPreset: { value: defaults.renderer.envPreset, options: ENV_PRESETS, label: "环境预设" },
    envIntensity: { value: defaults.renderer.envIntensity, min: 0, max: 3, step: 0.01, label: "环境强度" },
  }, { collapsed: true });

  // PCSS 柔和阴影（替代 VSM）
  const sh = useControls("阴影 (PCSS)", {
    size: { value: defaults.shadow.size, min: 0, max: 100, step: 0.1, label: "光源面积" },
    samples: { value: defaults.shadow.samples, min: 1, max: 32, step: 1, label: "采样数" },
    focus: { value: defaults.shadow.focus, min: 0, max: 2, step: 0.01, label: "焦距" },
  }, { collapsed: true });

  return (
    <Canvas
      shadows  /* 默认 PCFSoftShadowMap，配 SoftShadows 注入 PCSS 着色器 */
      dpr={[1, 1.5]}
      gl={{
        antialias: true,
        toneMapping: THREE.ACESFilmicToneMapping,
        outputColorSpace: THREE.SRGBColorSpace,
      }}
    >
      {/* key 强制重挂载：drei SoftShadows 在 mount 时打补丁，参数变了需重新注入 */}
      <SoftShadows
        key={`${sh.size}-${sh.samples}-${sh.focus}`}
        size={sh.size}
        samples={sh.samples}
        focus={sh.focus}
      />

      <color attach="background" args={[r.background]} />

      <Suspense fallback={null}>
        <Environment preset={r.envPreset} environmentIntensity={r.envIntensity} />
      </Suspense>
      <Suspense fallback={null}>
        <Models envIntensity={r.envIntensity} />
      </Suspense>

      <RendererSettings exposure={r.exposure} />
      <CameraRig />
      <Lights />
      <Ground envIntensity={r.envIntensity} />
      <Ring envIntensity={r.envIntensity} />
    </Canvas>
  );
}
