import { useEffect, useRef } from "react";
import { useControls, folder } from "leva";
import { MeshReflectorMaterial } from "@react-three/drei";
import { defaults } from "../config/params.js";

export default function Ground({ envIntensity = 1 }) {
  const matRef = useRef();

  const cfg = useControls("地面", {
    visible: { value: defaults.ground.visible, label: "显示" },
    color: { value: defaults.ground.color, label: "颜色" },
    roughness: { value: defaults.ground.roughness, min: 0, max: 1, step: 0.01, label: "粗糙度" },
    metalness: { value: defaults.ground.metalness, min: 0, max: 1, step: 0.01, label: "金属度" },
    反射: folder({
      reflEnabled: { value: defaults.ground.reflection.enabled, label: "启用反射" },
      reflResolution: { value: defaults.ground.reflection.resolution, options: [128, 256, 512, 1024], label: "分辨率" },
      reflMirror: { value: defaults.ground.reflection.mirror, min: 0, max: 1, step: 0.01, label: "镜面强度" },
      reflBlurX: { value: defaults.ground.reflection.blurX, min: 0, max: 1000, step: 10, label: "模糊 X" },
      reflBlurY: { value: defaults.ground.reflection.blurY, min: 0, max: 1000, step: 10, label: "模糊 Y" },
      reflMixBlur: { value: defaults.ground.reflection.mixBlur, min: 0, max: 6, step: 0.05, label: "模糊混合" },
      reflMixStrength: { value: defaults.ground.reflection.mixStrength, min: 0, max: 5, step: 0.05, label: "反射强度" },
      reflMixContrast: { value: defaults.ground.reflection.mixContrast, min: 0, max: 3, step: 0.05, label: "反射对比" },
      reflDepthScale: { value: defaults.ground.reflection.depthScale, min: 0, max: 5, step: 0.05, label: "远处淡化" },
    }, { collapsed: true }),
  }, { collapsed: true });

  useEffect(() => {
    if (matRef.current && "envMapIntensity" in matRef.current) {
      matRef.current.envMapIntensity = envIntensity;
    }
  }, [envIntensity]);

  return (
    <mesh
      visible={cfg.visible}
      rotation={[-Math.PI / 2, 0, 0]}
      position={[0, -0.01, 0]}
      receiveShadow
    >
      <planeGeometry args={[200, 200]} />
      {cfg.reflEnabled ? (
        <MeshReflectorMaterial
          ref={matRef}
          key={cfg.reflResolution}  /* 切分辨率需重建 FBO */
          color={cfg.color}
          roughness={cfg.roughness}
          metalness={cfg.metalness}
          envMapIntensity={envIntensity}
          resolution={cfg.reflResolution}
          mirror={cfg.reflMirror}
          blur={[cfg.reflBlurX, cfg.reflBlurY]}
          mixBlur={cfg.reflMixBlur}
          mixStrength={cfg.reflMixStrength}
          mixContrast={cfg.reflMixContrast}
          depthScale={cfg.reflDepthScale}
          depthToBlurRatioBias={0.25}
          minDepthThreshold={0.9}
          maxDepthThreshold={1}
        />
      ) : (
        <meshStandardMaterial
          ref={matRef}
          color={cfg.color}
          roughness={cfg.roughness}
          metalness={cfg.metalness}
          envMapIntensity={envIntensity}
        />
      )}
    </mesh>
  );
}
