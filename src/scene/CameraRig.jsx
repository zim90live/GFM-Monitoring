import { useEffect } from "react";
import { useThree } from "@react-three/fiber";
import * as THREE from "three";
import { useControls } from "leva";
import { defaults } from "../config/params.js";

export default function CameraRig() {
  const { camera } = useThree();
  const c = useControls("摄像机", {
    fov: { value: defaults.camera.fov, min: 10, max: 80, step: 0.1, label: "FOV" },
    tiltDeg: { value: defaults.camera.tiltDeg, min: 0, max: 89, step: 0.1, label: "俯角°" },
    distance: { value: defaults.camera.distance, min: 5, max: 100, step: 0.1, label: "距离" },
    targetY: { value: defaults.camera.targetY, min: -10, max: 10, step: 0.1, label: "注视点 Y" },
  }, { collapsed: true });

  useEffect(() => {
    const tilt = THREE.MathUtils.degToRad(c.tiltDeg);
    const d = c.distance;
    camera.fov = c.fov;
    camera.position.set(0, Math.sin(tilt) * d, Math.cos(tilt) * d);
    camera.lookAt(0, c.targetY, 0);
    camera.updateProjectionMatrix();
  }, [camera, c.fov, c.tiltDeg, c.distance, c.targetY]);

  return null;
}
