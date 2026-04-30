import React from "react";

const PILLS = [
  { color: "#4fa700", label: "电压" },
  { color: "#1dbdf1", label: "频率" },
  { color: "#fad724", label: "频率变化率" },
];

function Pill({ color, label }) {
  return (
    <div className="bb-pill">
      <span className="bb-pill-dot" style={{ background: color }} />
      <span className="bb-pill-text">{label}</span>
    </div>
  );
}

// 共享的"激烈波动区"包络：3 个区段合计约 40% 时间轴
// 三条曲线共用同一份 envelope → 同一时刻一起波动
const ZONES = [
  { center: 0.16, width: 0.07, intensity: 1.0 },
  { center: 0.50, width: 0.07, intensity: 0.85 },
  { center: 0.82, width: 0.06, intensity: 1.0 },
];

function envelope(t) {
  let max = 0;
  for (const z of ZONES) {
    const d = (t - z.center) / z.width;
    if (Math.abs(d) < 1) {
      const v = 0.5 * (1 + Math.cos(Math.PI * d)) * z.intensity;
      if (v > max) max = v;
    }
  }
  return max;
}

// 稳定时只有微小起伏；激烈区在 envelope 加权下注入大幅噪声
function makeCurve(W, baseline, freq, phase) {
  const N = 600;
  const pts = [];
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    const x = t * W;
    const env = envelope(t);

    // 稳定段：±1.5 像素的微振动
    const stable = 1.5 * Math.sin(t * Math.PI * 2 * freq + phase);

    // 激烈段：多频叠加 ~ ±30 像素，被 envelope 调制
    const active =
      18 * Math.sin(t * Math.PI * 2 * freq * 1.7 + phase * 1.5) +
      10 * Math.sin(t * Math.PI * 2 * freq * 3.3 + phase * 0.5) +
      5  * Math.sin(t * Math.PI * 2 * freq * 7.1 + phase);

    const y = baseline + stable + env * active;
    pts.push(`${x.toFixed(1)},${y.toFixed(1)}`);
  }
  return "M" + pts.join("L");
}

function GridTrendChart() {
  const W = 1856;
  const H = 150;

  // 每 11 个小刻度 + 1 个大刻度 = 12 ticks 一组
  const tickN = 96; // 8 组
  const spacing = W / (tickN - 1);
  const ticks = Array.from({ length: tickN }, (_, i) => ({
    x: i * spacing,
    big: i % 12 === 11,
  }));

  // 大刻度对应的时间标签（基准 16:30:00，每个大刻度 +1 分钟）
  const bigTicks = ticks.filter((t) => t.big);
  const labels = bigTicks.map((t, i) => {
    const totalMin = 30 + i;
    const h = 16 + Math.floor(totalMin / 60);
    const m = totalMin % 60;
    return {
      x: t.x,
      text: `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00`,
    };
  });

  // 三条共用 baseline + envelope；freq/phase 不同 → 稳定时贴在中线、波动时形态各异
  const baseline = H / 2;
  const curves = [
    { d: makeCurve(W, baseline, 7, 0),    color: "#4fa700" },
    { d: makeCurve(W, baseline, 9, 2.1),  color: "#1dbdf1" },
    { d: makeCurve(W, baseline, 8, 4.3),  color: "#fad724" },
  ];

  return (
    <div className="bb-chart-wrap">
      <svg
        className="bb-chart"
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
      >
        {/* 曲线 */}
        {curves.map((c, i) => (
          <path
            key={i}
            d={c.d}
            stroke={c.color}
            strokeWidth={2}
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />
        ))}
        {/* 横轴刻度 */}
        {ticks.map((t, i) => (
          <line
            key={i}
            x1={t.x}
            x2={t.x}
            y1={t.big ? H - 12 : H - 6}
            y2={H}
            stroke={t.big ? "var(--text-2)" : "var(--text-3)"}
            strokeWidth={1}
            vectorEffect="non-scaling-stroke"
          />
        ))}
      </svg>

      {/* 大刻度时间标签 */}
      <div className="bb-chart-labels">
        {labels.map((l, i) => (
          <span key={i} style={{ left: `${(l.x / W) * 100}%` }}>
            {l.text}
          </span>
        ))}
      </div>
    </div>
  );
}

export default function BottomBar() {
  return (
    <footer className="bottom-bar">
      <div className="bb-top">
        <div className="bb-top-header">
          <div className="bb-top-title">电网实时趋势</div>
          <div className="bb-pills">
            {PILLS.map((p) => (
              <Pill key={p.label} color={p.color} label={p.label} />
            ))}
          </div>
        </div>
        <GridTrendChart />
      </div>
      <div className="bb-bottom"></div>
    </footer>
  );
}
