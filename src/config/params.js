// 默认参数（被 leva 用作初始值）
export const defaults = {
  renderer: {
    exposure: 1.5,
    background: "#000000",
    envPreset: "night",   // drei 内置预设：city/studio/warehouse/sunset/dawn/night/forest/apartment/park/lobby
    envIntensity: 0.2,
  },

  camera: {
    fov: 32,
    tiltDeg: 24,
    distance: 38,
    targetY: -4.3,
    // 详情页（侧视）摄像机机位 —— 环展开成直线后落在屏幕上方
    detail: {
      fov: 32,
      tiltDeg: 4.3,
      distance: 44,
      targetY: -1.4,
    },
  },

  // 累积阴影（drei <AccumulativeShadows> + <RandomizedLight>）
  // 启动后累积 N 帧到贴图，之后零开销
  shadow: {
    enabled: true,
    frames: 60,            // 累积帧数（更多 = 更平滑但烘焙更久）
    radius: 5,             // 随机化光源抖动半径（控制柔和度）
    opacity: 0.8,          // 阴影整体不透明度
    scale: 50,             // 阴影面尺寸
    blend: 30,             // 混合
  },

  lights: {
    ambient: 0.5,
    key: {
      intensity: 1.2,
      azimuth: -180,
      elevation: 40,
      distance: 40,
    },
    rim: {
      color: "#d9ebff",
      intensity: 1,
      azimuth: -45,
      elevation: 25,
      distance: 25,
    },
  },

  ground: {
    visible: true,
    color: "#05070a",
    roughness: 0.7,
    metalness: 1,
    reflection: {
      enabled: false,
      resolution: 512,        // 反射贴图分辨率（128/256/512/1024）
      mirror: 0.6,            // 镜面强度（0=无反射，1=纯镜面）
      blurX: 300,             // 横向模糊
      blurY: 100,             // 纵向模糊
      mixBlur: 1,             // 模糊混合度
      mixStrength: 1.2,       // 反射叠加强度
      mixContrast: 1.0,       // 反射对比度
      depthScale: 1,          // 远处淡化（与摄像机距离衰减）
    },
  },

  ring: {
    radius: 7.0,
    tileCount: 360,
    tileWidth: 0.05,
    tileDepth: 0.9,
    heightBase: 1.2,
    rotationDeg: -21,
    castShadow: true,          // 投阴影（InstancedMesh 下开销很小，可保留接地感）
    glass: {
      color: "#ffffff",
      transmission: 0.98,
      opacity: 1.0,
      roughness: 0.8,
      metalness: 0.0,
      ior: 1.5,
      thickness: 0.5,
      clearcoat: 1.0,
      clearcoatRoughness: 0.04,
      attenuationColor: "#aac8ff",
      attenuationDistance: 3.0,
      // MTM 专属（drei MeshTransmissionMaterial）
      backside: true,
      samples: 8,
      resolution: 256,
      chromaticAberration: 0.06,
      anisotropy: 0.15,
      distortion: 0.0,
      distortionScale: 0.5,
      temporalDistortion: 0.0,
    },

    // 亚克力 4 色（除颜色外其他属性完全一致）
    acrylic: {
      coloredRatio: 0.3,        // 染色比例（约 30%）
      seed: 1,                  // 随机种子（固定 → 刷新结果稳定）
      // 共用属性
      transmission: 0.55,
      opacity: 1.0,
      roughness: 0.65,
      metalness: 0.0,
      ior: 1.5,
      thickness: 0.5,
      clearcoat: 0.5,
      clearcoatRoughness: 0.05,
      // 4 种颜色
      colorPink: "#ff69df",
      colorOrange: "#ff9520",
      colorBlue: "#59a7ff",
      colorGreen: "#00e564",
    },
    segments: [
      { yOffset: 0.9, ratio: 1 },
      { yOffset: 0.6, ratio: 1 },
      { yOffset: 0.3, ratio: 1 },
      { yOffset: 0.0, ratio: 1 },
      { yOffset: 0.3, ratio: 1 },
      { yOffset: 0.6, ratio: 1 },
      { yOffset: 0.9, ratio: 1 },
      { yOffset: 1.2, ratio: 1 },
    ],
    // 详情页（展开为直线后）目标参数：tile 沿 X 等距分布，朝向相机
    detail: {
      lineY: 4.5,         // 直线在世界 Y（屏幕上偏高）
      lineZ: 0,           // 直线在世界 Z
      strideMul: 1.0,     // 直线总长 = 原圆周长 × strideMul（1 = 等长展开）
      gapRatio: 0.4,      // tile 之间的空隙占比（0=无缝，0.4=每片占 stride 的 60%）
      backplane: {
        enabled: false,
        z: -0.6,          // 背板距离直线后方
        color: "#36393cff",
        opacity: 0.85,    // 中心实色不透明度（边缘自动淡出，由 shader 处理）
      },
    },
  },

  // 详情页 UI 参数（选区框等）
  eventDetail: {
    selection: {
      top: 254,            // 选区框顶部 px（与 3D 直线 tile 的屏幕投影对齐）
      height: 64,          // 选区框高度
      leftPad: 24,         // 选区可拖范围左侧 padding
      rightPad: 24,        // 选区可拖范围右侧 padding
      borderColor: "#ffffff",
      borderAlpha: 0.85,
      bgAlpha: 0.04,
    },
  },

  models: {
    targetSize: 3.6,
    storage: { x: -13, y: 0, z: 0, rotationY: -20 },
    grid: { x: 13, y: 0, z: 0, rotationY: 20 },
  },

  materials: {
    // 外壳：菲涅尔材质（边缘高亮，中心几近透明，不投阴影）
    shell: {
      color: "#ffffff",
      rimColor: "#ffffff",
      rimPower: 10.0,        // 越大边缘越细
      rimIntensity: 0.1,    // 边缘亮度
      baseOpacity: 0,    // 中心不透明度
    },
    inner: {
      color: "#44474b",
      roughness: 0.6,
      metalness: 0.2,
    },
  },
};
