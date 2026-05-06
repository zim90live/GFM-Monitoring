import { useEffect, useRef } from "react";
import { useThree, useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useControls, folder } from "leva";
import { defaults } from "../config/params.js";

const DEG2RAD = THREE.MathUtils.degToRad;

export default function CameraRig() {
  const { camera, pointer } = useThree();

  const c = useControls(
    "摄像机",
    {
      fov: { value: defaults.camera.fov, min: 10, max: 80, step: 0.1, label: "FOV" },
      tiltDeg: { value: defaults.camera.tiltDeg, min: 0, max: 89, step: 0.1, label: "俯角°" },
      distance: { value: defaults.camera.distance, min: 5, max: 100, step: 0.1, label: "距离" },
      targetY: { value: defaults.camera.targetY, min: -10, max: 10, step: 0.1, label: "注视点 Y" },
      "鼠标轨道": folder(
        {
          orbitEnabled: { value: true, label: "启用" },
          orbitAzDeg: { value: 8, min: 0, max: 45, step: 0.1, label: "水平摆角°" },
          orbitElDeg: { value: 4, min: 0, max: 30, step: 0.1, label: "垂直摆角°" },
          orbitDamping: { value: 0.06, min: 0.005, max: 0.5, step: 0.005, label: "跟随速度" },
        },
        { collapsed: true }
      ),
    },
    { collapsed: true }
  );

  // 复用临时向量，避免每帧 new
  const target = useRef(new THREE.Vector3());

  // 计算摄像机位置（orbitAz 绕 Y 轴方位、orbitEl 加在俯角上）
  const computePosition = (out, tiltDeg, distance, azOffset, elOffset) => {
    const tilt = THREE.MathUtils.clamp(
      DEG2RAD(tiltDeg) + elOffset,
      DEG2RAD(0.5),
      DEG2RAD(89)
    );
    const az = azOffset;
    const horiz = Math.cos(tilt) * distance;
    out.set(
      horiz * Math.sin(az),
      Math.sin(tilt) * distance,
      horiz * Math.cos(az)
    );
  };

  // 参数变化或关闭轨道时立即吸附到基础位置
  useEffect(() => {
    camera.fov = c.fov;
    camera.updateProjectionMatrix();
    if (!c.orbitEnabled) {
      const p = new THREE.Vector3();
      computePosition(p, c.tiltDeg, c.distance, 0, 0);
      camera.position.copy(p);
      camera.lookAt(0, c.targetY, 0);
    }
  }, [camera, c.fov, c.tiltDeg, c.distance, c.targetY, c.orbitEnabled]);

  // 每帧：用 pointer 驱动方位/俯角的小幅摆动，阻尼跟随
  useFrame(() => {
    if (!c.orbitEnabled) return;
    const azOffset = -pointer.x * DEG2RAD(c.orbitAzDeg);
    const elOffset = -pointer.y * DEG2RAD(c.orbitElDeg);
    computePosition(target.current, c.tiltDeg, c.distance, azOffset, elOffset);
    camera.position.lerp(target.current, c.orbitDamping);
    camera.lookAt(0, c.targetY, 0);
  });

  return null;
}
