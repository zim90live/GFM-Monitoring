import { useEffect, useRef } from "react";
import { useThree, useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useControls, folder } from "leva";
import { defaults } from "../config/params.js";
import { useView } from "../state/ViewContext.jsx";

const DEG2RAD = THREE.MathUtils.degToRad;

export default function CameraRig() {
  const { camera, pointer } = useThree();
  const { eRef } = useView();

  const c = useControls(
    "摄像机",
    {
      fov: { value: defaults.camera.fov, min: 10, max: 80, step: 0.1, label: "FOV" },
      tiltDeg: { value: defaults.camera.tiltDeg, min: 0, max: 89, step: 0.1, label: "俯角°" },
      distance: { value: defaults.camera.distance, min: 5, max: 100, step: 0.1, label: "距离" },
      targetY: { value: defaults.camera.targetY, min: -10, max: 10, step: 0.1, label: "注视点 Y" },
      "详情页（侧视）": folder(
        {
          dFov: { value: defaults.camera.detail.fov, min: 10, max: 80, step: 0.1, label: "FOV" },
          dTiltDeg: { value: defaults.camera.detail.tiltDeg, min: 0, max: 60, step: 0.1, label: "俯角°" },
          dDistance: { value: defaults.camera.detail.distance, min: 5, max: 100, step: 0.1, label: "距离" },
          dTargetY: { value: defaults.camera.detail.targetY, min: -10, max: 10, step: 0.1, label: "注视点 Y" },
        },
        { collapsed: true }
      ),
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

  const target = useRef(new THREE.Vector3());
  const lookTmp = useRef(new THREE.Vector3());

  // 由（俯角, 距离, 方位偏移）计算相机位置
  const computePosition = (out, tiltDeg, distance, azOffset, elOffset) => {
    const tilt = THREE.MathUtils.clamp(
      DEG2RAD(tiltDeg) + elOffset,
      DEG2RAD(0.5),
      DEG2RAD(89)
    );
    const horiz = Math.cos(tilt) * distance;
    out.set(
      horiz * Math.sin(azOffset),
      Math.sin(tilt) * distance,
      horiz * Math.cos(azOffset)
    );
  };

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

  useFrame(() => {
    const e = eRef.current; // 0..1（已缓动）
    const orbitFactor = c.orbitEnabled ? Math.max(0, 1 - e) : 0; // 转场期逐渐禁用轨道偏移
    const azOffset = -pointer.x * DEG2RAD(c.orbitAzDeg) * orbitFactor;
    const elOffset = -pointer.y * DEG2RAD(c.orbitElDeg) * orbitFactor;

    // 两套位姿插值（含 FOV）
    const tiltDeg   = THREE.MathUtils.lerp(c.tiltDeg,  c.dTiltDeg,  e);
    const distance  = THREE.MathUtils.lerp(c.distance, c.dDistance, e);
    const targetY   = THREE.MathUtils.lerp(c.targetY,  c.dTargetY,  e);
    const fov       = THREE.MathUtils.lerp(c.fov,      c.dFov,      e);
    if (Math.abs(camera.fov - fov) > 1e-3) {
      camera.fov = fov;
      camera.updateProjectionMatrix();
    }

    computePosition(target.current, tiltDeg, distance, azOffset, elOffset);
    // overview 的鼠标轨道用阻尼跟随；进入转场后直接吸附以避免延迟感
    if (e < 0.001 && c.orbitEnabled) {
      camera.position.lerp(target.current, c.orbitDamping);
    } else {
      camera.position.copy(target.current);
    }

    lookTmp.current.set(0, targetY, 0);
    camera.lookAt(lookTmp.current);
  });

  return null;
}
