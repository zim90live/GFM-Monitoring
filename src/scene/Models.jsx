import React, { useEffect, useMemo } from "react";
import * as THREE from "three";
import { useGLTF } from "@react-three/drei";
import { useControls, folder } from "leva";
import { defaults } from "../config/params.js";
import modelUrl from "../../assets/models/模型导出 - 0430.glb?url";

// ============== Fresnel 着色器材质（外壳用） ==============
function createFresnelMaterial() {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    uniforms: {
      uColor: { value: new THREE.Color("#ffffff") },
      uRimColor: { value: new THREE.Color("#88ccff") },
      uRimPower: { value: 3.0 },
      uRimIntensity: { value: 1.0 },
      uBaseOpacity: { value: 0.04 },
    },
    vertexShader: /* glsl */ `
      varying vec3 vNormalW;
      varying vec3 vViewDirW;
      void main() {
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vNormalW = normalize(mat3(modelMatrix) * normal);
        vViewDirW = normalize(cameraPosition - wp.xyz);
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: /* glsl */ `
      precision highp float;
      uniform vec3 uColor;
      uniform vec3 uRimColor;
      uniform float uRimPower;
      uniform float uRimIntensity;
      uniform float uBaseOpacity;
      varying vec3 vNormalW;
      varying vec3 vViewDirW;
      void main() {
        float f = pow(
          1.0 - clamp(dot(normalize(vNormalW), normalize(vViewDirW)), 0.0, 1.0),
          uRimPower
        );
        vec3 col = mix(uColor, uRimColor, f);
        float alpha = clamp(uBaseOpacity + f * uRimIntensity, 0.0, 1.0);
        gl_FragColor = vec4(col, alpha);
      }
    `,
  });
}

export default function Models({ envIntensity = 1 }) {
  const { scene: gltfScene } = useGLTF(modelUrl);
  const scene = useMemo(() => gltfScene.clone(true), [gltfScene]);

  const transform = useControls("模型", {
    targetSize: { value: defaults.models.targetSize, min: 0.5, max: 20, step: 0.1, label: "统一尺寸" },
    "储能（左）": folder({
      sx: { value: defaults.models.storage.x, min: -40, max: 40, step: 0.1, label: "X" },
      sy: { value: defaults.models.storage.y, min: -10, max: 10, step: 0.1, label: "Y" },
      sz: { value: defaults.models.storage.z, min: -20, max: 20, step: 0.1, label: "Z" },
      srot: { value: defaults.models.storage.rotationY, min: -180, max: 180, step: 0.1, label: "Y 旋转°" },
    }, { collapsed: true }),
    "电网（右）": folder({
      gx: { value: defaults.models.grid.x, min: -40, max: 40, step: 0.1, label: "X" },
      gy: { value: defaults.models.grid.y, min: -10, max: 10, step: 0.1, label: "Y" },
      gz: { value: defaults.models.grid.z, min: -20, max: 20, step: 0.1, label: "Z" },
      grot: { value: defaults.models.grid.rotationY, min: -180, max: 180, step: 0.1, label: "Y 旋转°" },
    }, { collapsed: true }),
  }, { collapsed: true });

  const mat = useControls("模型材质（共用）", {
    "外壳（菲涅尔）": folder({
      shellColor: { value: defaults.materials.shell.color, label: "基础色" },
      shellRimColor: { value: defaults.materials.shell.rimColor, label: "边缘色" },
      shellRimPower: { value: defaults.materials.shell.rimPower, min: 0.1, max: 10, step: 0.1, label: "边缘锐度" },
      shellRimIntensity: { value: defaults.materials.shell.rimIntensity, min: 0, max: 3, step: 0.01, label: "边缘亮度" },
      shellBaseOpacity: { value: defaults.materials.shell.baseOpacity, min: 0, max: 1, step: 0.01, label: "中心不透明度" },
    }, { collapsed: true }),
    "正常设备（内部）": folder({
      innerColor: { value: defaults.materials.inner.color, label: "颜色" },
      innerRoughness: { value: defaults.materials.inner.roughness, min: 0, max: 1, step: 0.01, label: "粗糙度" },
      innerMetalness: { value: defaults.materials.inner.metalness, min: 0, max: 1, step: 0.01, label: "金属度" },
    }, { collapsed: true }),
  }, { collapsed: true });

  // 共享一份 Fresnel 材质（所有外壳 mesh 共用）
  const fresnelMat = useMemo(() => createFresnelMaterial(), []);
  useEffect(() => () => fresnelMat.dispose(), [fresnelMat]);

  // 一次性：clone 后扫描——把"外壳"的 mesh 替换成 fresnelMat 且关闭投影；
  // 普通材质保留并收集引用以便后续应用 leva 参数
  const setup = useMemo(() => {
    const result = { storage: null, grid: null, innerMaterials: [] };
    for (const key of ["storage", "grid"]) {
      const name = key === "storage" ? "储能" : "电网";
      const obj = scene.getObjectByName(name);
      if (!obj) continue;

      obj.traverse((c) => {
        if (!c.isMesh) return;
        const mats = Array.isArray(c.material) ? c.material : [c.material];
        const isShell = mats.some((m) => m && m.name === "外壳");
        if (isShell) {
          // 外壳：换 Fresnel + 不投阴影
          c.material = fresnelMat;
          c.castShadow = false;
          c.receiveShadow = false;
        } else {
          // 普通设备：保留原材质，开阴影，记录到 inner 列表
          c.castShadow = true;
          c.receiveShadow = true;
          for (const m of mats) {
            if (m && !result.innerMaterials.includes(m)) {
              result.innerMaterials.push(m);
            }
          }
        }
      });

      if (!obj.userData.normalized) {
        const box = new THREE.Box3().setFromObject(obj);
        const size = new THREE.Vector3();
        const center = new THREE.Vector3();
        box.getSize(size);
        box.getCenter(center);
        obj.position.sub(center);
        obj.position.y -= box.min.y - center.y;
        obj.userData.normalized = true;
        obj.userData.maxAxis = Math.max(size.x, size.y, size.z);
      }
      result[key] = obj;
    }
    return result;
  }, [scene, fresnelMat]);

  // 应用 Fresnel uniforms（外壳）
  useEffect(() => {
    const u = fresnelMat.uniforms;
    u.uColor.value.set(mat.shellColor);
    u.uRimColor.value.set(mat.shellRimColor);
    u.uRimPower.value = mat.shellRimPower;
    u.uRimIntensity.value = mat.shellRimIntensity;
    u.uBaseOpacity.value = mat.shellBaseOpacity;
  }, [fresnelMat, mat.shellColor, mat.shellRimColor, mat.shellRimPower, mat.shellRimIntensity, mat.shellBaseOpacity]);

  // 应用普通设备材质（inner）
  useEffect(() => {
    for (const m of setup.innerMaterials) {
      m.color?.set(mat.innerColor);
      if ("roughness" in m) m.roughness = mat.innerRoughness;
      if ("metalness" in m) m.metalness = mat.innerMetalness;
      if ("envMapIntensity" in m) m.envMapIntensity = envIntensity;
      m.needsUpdate = true;
    }
  }, [setup, mat.innerColor, mat.innerRoughness, mat.innerMetalness, envIntensity]);

  const storageScale =
    setup.storage?.userData.maxAxis
      ? transform.targetSize / setup.storage.userData.maxAxis
      : 1;
  const gridScale =
    setup.grid?.userData.maxAxis
      ? transform.targetSize / setup.grid.userData.maxAxis
      : 1;

  return (
    <>
      {setup.storage && (
        <group
          position={[transform.sx, transform.sy, transform.sz]}
          rotation={[0, THREE.MathUtils.degToRad(transform.srot), 0]}
          scale={storageScale}
        >
          <primitive object={setup.storage} />
        </group>
      )}
      {setup.grid && (
        <group
          position={[transform.gx, transform.gy, transform.gz]}
          rotation={[0, THREE.MathUtils.degToRad(transform.grot), 0]}
          scale={gridScale}
        >
          <primitive object={setup.grid} />
        </group>
      )}
    </>
  );
}

useGLTF.preload(modelUrl);
