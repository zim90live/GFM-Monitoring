import React, { Suspense } from "react";
import { Canvas } from "@react-three/fiber";
import { Environment } from "@react-three/drei";
import * as THREE from "three";
import { useControls } from "leva";

import { defaults } from "../config/params.js";
import { ViewContext, useView } from "../state/ViewContext.jsx";
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
    envPreset: { value: defaults.renderer.envPreset, options: ENV_PRESETS, label: "环境预设" },
    envIntensity: { value: defaults.renderer.envIntensity, min: 0, max: 3, step: 0.01, label: "环境强度" },
  }, { collapsed: true });

  const viewCtx = useView();

  return (
    <Canvas
      shadows
      dpr={[1, 1.5]}
      gl={{
        antialias: true,
        alpha: true,
        toneMapping: THREE.ACESFilmicToneMapping,
        outputColorSpace: THREE.SRGBColorSpace,
      }}
    >
      <ViewContext.Provider value={viewCtx}>
        {/* 透明背景 → 显出 .stage 的径向渐变 */}

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
      </ViewContext.Provider>
    </Canvas>
  );
}
