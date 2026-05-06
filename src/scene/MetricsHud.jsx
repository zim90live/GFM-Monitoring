import React from "react";
import { Html } from "@react-three/drei";

const LEFT = [
  { value: "24.001", unit: "kW", label: "可充电功率" },
  { value: "27.001", unit: "kW", label: "可放电功率" },
  { value: "55.001", unit: "kWh", label: "可充电电量" },
  { value: "34.291", unit: "kWh", label: "可放电电量" },
];

const RIGHT = [
  { value: "24.001", unit: "kW", label: "有功功率" },
  { value: "27.001", unit: "kW", label: "无功功率" },
  { value: "50.0", unit: "Hz", label: "频率" },
  { value: "0.9", unit: "", label: "功率因数" },
];

function MetricItem({ value, unit, label }) {
  return (
    <div className="metric-item">
      <div className="metric-value">
        <span className="metric-num">{value}</span>
        {unit && <span className="metric-unit">{unit}</span>}
      </div>
      <div className="metric-label">{label}</div>
    </div>
  );
}

function Block({ side, items }) {
  return (
    <div className={`metrics-hud-block metrics-${side}`}>
      <div className="metrics-divider" />
      <div className="metrics-grid">
        {items.map((m, i) => <MetricItem key={i} {...m} />)}
      </div>
    </div>
  );
}

// 跟随两个模型的浮动指标面板
export default function MetricsHud({ transforms }) {
  if (!transforms) return null;
  const { sx, sy, sz, gx, gy, gz } = transforms;

  return (
    <>
      {/* 锚点放在模型脚底（y 略低）→ 投影到屏幕时位于模型下方一点 */}
      <Html
        position={[sx - 1, sy - 1.6, sz]}
        style={{ pointerEvents: "none" }}
        zIndexRange={[10, 0]}
      >
        <Block side="left" items={LEFT} />
      </Html>

      <Html
        position={[gx + 1, gy - 1.6, gz]}
        style={{ pointerEvents: "none" }}
        zIndexRange={[10, 0]}
      >
        <Block side="right" items={RIGHT} />
      </Html>
    </>
  );
}
