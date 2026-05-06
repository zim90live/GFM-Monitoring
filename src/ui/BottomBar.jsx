import React, { useEffect, useRef, useState } from "react";

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

// 三条曲线共享的激烈波动 envelope：基于哈希在虚拟轴上不规则分布
// 把虚拟轴切成 BUCKET 像素的格子，每格按哈希决定是否触发一段波动、中心/宽度/强度
const BUCKET = 700;     // 平均间隔（约 3 分钟，PX_PER_MIN≈234）
const SKIP_PROB = 0.22; // 22% 格子完全无波动 → 偶尔出现长平静期

function hash01(n) {
  let h = n | 0;
  h = Math.imul(h ^ (h >>> 16), 2246822507);
  h = Math.imul(h ^ (h >>> 13), 3266489909);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function envelopeAt(vx) {
  const idx = Math.floor(vx / BUCKET);
  let max = 0;
  // 检查相邻 ±1 格，避免跨边界波动被截断
  for (let k = -1; k <= 1; k++) {
    const b = idx + k;
    const r1 = hash01(b * 374761393 + 1);
    const r2 = hash01(b * 668265263 + 2);
    const r3 = hash01(b * 2147483647 + 3);
    if (r3 < SKIP_PROB) continue;
    const center = (b + 0.15 + r1 * 0.7) * BUCKET;
    // 宽度走平方分布：大部分较短的快速尖峰，偶尔出现一段长扰动
    const wnorm = r2 * r2;
    const width = 60 + wnorm * 360;          // 60..420 px（≈15s..110s）
    const intensity = 0.55 + r3 * 0.55;      // 0.55..1.10
    const d = (vx - center) / width;
    if (Math.abs(d) < 1) {
      const v = 0.5 * (1 + Math.cos(Math.PI * d)) * intensity;
      if (v > max) max = v;
    }
  }
  return max;
}

// 基于虚拟坐标 vx 的曲线 y 值：稳定段微振动 + envelope 调制的激烈段
function curveYAt(vx, W, baseline, freq, phase) {
  const u = vx / W;
  const env = envelopeAt(vx);
  const stable = 1.5 * Math.sin(u * Math.PI * 2 * freq + phase);
  const active =
    18 * Math.sin(u * Math.PI * 2 * freq * 1.7 + phase * 1.5) +
    10 * Math.sin(u * Math.PI * 2 * freq * 3.3 + phase * 0.5) +
    5  * Math.sin(u * Math.PI * 2 * freq * 7.1 + phase);
  return baseline + stable + env * active;
}

const SERIES = [
  { freq: 7, phase: 0,   color: "#4fa700", label: "电压",       unit: "kV",   base: 35.20, dev: 1.50 },
  { freq: 9, phase: 2.1, color: "#1dbdf1", label: "频率",       unit: "Hz",   base: 50.00, dev: 0.20 },
  { freq: 8, phase: 4.3, color: "#fad724", label: "频率变化率", unit: "Hz/s", base: 0.02,  dev: 0.40 },
];

function GridTrendChart() {
  const W = 1856;
  const H = 150;
  const baseline = H / 2;
  const TICK_N_BASE = 96;
  const SPACING = W / (TICK_N_BASE - 1);   // 像素 / 小刻度
  const PX_PER_MIN = SPACING * 12;         // 像素 / 分钟（大刻度间距）
  const PX_PER_SEC = PX_PER_MIN / 60;      // 真实时间：1 大格 = 1 分钟
  const PAUSE_MS = 5000;                   // 拖拽后冻结时长
  const SNAP_K = 0.12;                     // 回弹到最新位置的 lerp 系数
  const BASE_MIN_AT_I11 = 30;              // 索引 11 大刻度对应 16:30
  const BASE_HOUR = 16;

  const offsetRef = useRef(0);
  const [offset, setOffset] = useState(0);
  const dragRef = useRef(null);
  const [hover, setHover] = useState(null);
  const svgRef = useRef(null);
  const startRef = useRef(performance.now());
  // mode: "live" | "paused" | "snapping"
  const modeRef = useRef("live");
  const pauseUntilRef = useRef(0);

  // 时间驱动滚动 + 拖拽后回弹
  useEffect(() => {
    let raf;
    const tick = (now) => {
      const natural = ((now - startRef.current) / 1000) * PX_PER_SEC;

      if (dragRef.current) {
        // 拖拽中：onPointerMove 直接驱动 offsetRef
      } else if (modeRef.current === "paused") {
        if (now >= pauseUntilRef.current) modeRef.current = "snapping";
      }

      if (!dragRef.current) {
        if (modeRef.current === "live") {
          offsetRef.current = natural;
        } else if (modeRef.current === "snapping") {
          const diff = natural - offsetRef.current;
          offsetRef.current += diff * SNAP_K;
          if (Math.abs(diff) < 0.5) {
            offsetRef.current = natural;
            modeRef.current = "live";
          }
        }
        setOffset(offsetRef.current);
      }

      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [PX_PER_SEC]);

  // 数据边沿：初始时数据只到 75% 宽度，随真实时间向右推进
  // dataEdgeVx = naturalOffset + 0.75*W；屏幕坐标 = dataEdgeVx - offset
  const DATA_EDGE_INIT = 0.75;
  const natural = ((performance.now() - startRef.current) / 1000) * PX_PER_SEC;
  const dataEdgeSx = Math.max(0, Math.min(W, DATA_EDGE_INIT * W + (natural - offset)));

  // 曲线路径（基于当前 offset 重新采样可见区，仅到 dataEdgeSx）
  const N = 600;
  const Nclip = Math.floor((dataEdgeSx / W) * N);
  const paths = SERIES.map((s) => {
    if (Nclip <= 0) return "";
    const pts = [];
    for (let i = 0; i <= Nclip; i++) {
      const sx = (i / Nclip) * dataEdgeSx;
      const y = curveYAt(sx + offset, W, baseline, s.freq, s.phase);
      pts.push(`${sx.toFixed(1)},${y.toFixed(1)}`);
    }
    return "M" + pts.join("L");
  });

  // 异常时段：复用 envelope 的 bucket，但只占大波动区域的 25%（居中收缩）
  const ABNORMAL_RATIO = 0.25;
  const startB = Math.floor(offset / BUCKET) - 1;
  const endB   = Math.ceil((offset + W) / BUCKET) + 1;
  const zones = [];
  for (let b = startB; b <= endB; b++) {
    const r1 = hash01(b * 374761393 + 1);
    const r2 = hash01(b * 668265263 + 2);
    const r3 = hash01(b * 2147483647 + 3);
    if (r3 < SKIP_PROB) continue;
    const center = (b + 0.15 + r1 * 0.7) * BUCKET;
    const wnorm = r2 * r2;
    const fullWidth = 60 + wnorm * 360;
    const halfW = fullWidth * ABNORMAL_RATIO;          // 40% 总宽度 → 半宽 = 0.4*fullW
    let x1 = (center - halfW) - offset;
    let x2 = (center + halfW) - offset;
    if (x2 < 0 || x1 > W) continue;
    // 不超过数据边沿
    if (x1 >= dataEdgeSx) continue;
    if (x2 > dataEdgeSx) x2 = dataEdgeSx;
    zones.push({ key: b, x1, x2 });
  }

  // 可见刻度
  const firstIdx = Math.floor(offset / SPACING) - 1;
  const lastIdx  = Math.ceil((offset + W) / SPACING) + 1;
  const ticks = [];
  for (let i = firstIdx; i <= lastIdx; i++) {
    const sx = i * SPACING - offset;
    ticks.push({ sx, idx: i, big: ((i % 12) + 12) % 12 === 11 });
  }

  // 时间标签（key 用 minuteIdx 保持稳定，避免每帧重建 DOM）
  const labels = ticks
    .filter((t) => t.big && t.sx >= -40 && t.sx <= W + 40)
    .map((t) => {
      const minuteIdx = BASE_MIN_AT_I11 + Math.floor((t.idx - 11) / 12);
      const h = BASE_HOUR + Math.floor(minuteIdx / 60);
      const m = ((minuteIdx % 60) + 60) % 60;
      return {
        sx: t.sx,
        minuteIdx,
        text: `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00`,
      };
    });

  // 指针交互
  function clientToSvgX(e) {
    const rect = svgRef.current.getBoundingClientRect();
    return ((e.clientX - rect.left) / rect.width) * W;
  }
  function onPointerDown(e) {
    e.currentTarget.setPointerCapture(e.pointerId);
    modeRef.current = "paused";
    dragRef.current = {
      startClientX: e.clientX,
      startOffset: offsetRef.current,
      ratio: W / svgRef.current.getBoundingClientRect().width,
    };
  }
  function onPointerMove(e) {
    const sx = clientToSvgX(e);
    setHover({ sx, clientX: e.clientX });
    if (dragRef.current) {
      const dx = (e.clientX - dragRef.current.startClientX) * dragRef.current.ratio;
      offsetRef.current = dragRef.current.startOffset - dx;
      setOffset(offsetRef.current);
    }
  }
  function endDrag(e) {
    if (e) e.currentTarget.releasePointerCapture?.(e.pointerId);
    if (dragRef.current) {
      dragRef.current = null;
      pauseUntilRef.current = performance.now() + PAUSE_MS;
      modeRef.current = "paused";
    }
  }
  function onPointerLeave(e) {
    setHover(null);
    endDrag(e);
  }

  // 悬停浮层数据（超过数据边沿不显示）
  let hoverInfo = null;
  if (hover && hover.sx <= dataEdgeSx) {
    const vx = hover.sx + offset;
    // 时间：i=11 大刻度对应 16:30:00；vx 与 i 的关系是 vx = i*SPACING
    const minuteFloat = (vx / SPACING - 11) / 12 + BASE_MIN_AT_I11;
    const totalSec = Math.floor(minuteFloat * 60 + BASE_HOUR * 3600);
    const sec = ((totalSec % 86400) + 86400) % 86400;
    const hh = Math.floor(sec / 3600);
    const mm = Math.floor(sec / 60) % 60;
    const ss = sec % 60;
    const timeText = `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;

    const values = SERIES.map((s) => {
      const y = curveYAt(vx, W, baseline, s.freq, s.phase);
      const k = (baseline - y) / baseline;
      return { ...s, y, val: s.base + k * s.dev };
    });
    hoverInfo = { sx: hover.sx, timeText, values };
  }

  const cursor = dragRef.current ? "grabbing" : "grab";

  return (
    <div className="bb-chart-wrap">
      <div className="bb-chart-mask">
        <svg
          ref={svgRef}
          className="bb-chart"
          viewBox={`0 0 ${W} ${H}`}
          preserveAspectRatio="none"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          onPointerLeave={onPointerLeave}
          style={{ cursor, touchAction: "none" }}
        >
          <defs>
            {/* 曲线区：上 #F7B934 0% → 下 #F7B934 10% */}
            <linearGradient id="abnormalCurveGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%"   stopColor="#F7B934" stopOpacity="0" />
              <stop offset="100%" stopColor="#F7B934" stopOpacity="0.10" />
            </linearGradient>
            {/* 轴区：左 #286A36 → 右 #DC7635 */}
            <linearGradient id="abnormalAxisGrad" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%"   stopColor="#286A36" />
              <stop offset="100%" stopColor="#DC7635" />
            </linearGradient>
            {/* 整图左→右白色渐变：0% → 10% */}
            <linearGradient id="screenWashGrad" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%"   stopColor="#FFFFFF" stopOpacity="0" />
              <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0.10" />
            </linearGradient>
          </defs>
          {/* 异常区曲线高亮（顶0% → 底10% 的橙色，与轴留 4px 间距） */}
          {zones.map((z) => (
            <rect
              key={`hl-${z.key}`}
              x={z.x1}
              y={0}
              width={z.x2 - z.x1}
              height={H - 16}
              fill="url(#abnormalCurveGrad)"
              pointerEvents="none"
            />
          ))}
          {paths.map((d, i) => (
            <path
              key={i}
              d={d}
              stroke={SERIES[i].color}
              strokeWidth={2}
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
            />
          ))}
          {ticks.map((t) => (
            <line
              key={t.idx}
              x1={t.sx}
              x2={t.sx}
              y1={t.big ? H - 12 : H - 6}
              y2={H}
              stroke={t.big ? "var(--text-2)" : "var(--text-3)"}
              strokeWidth={1}
              vectorEffect="non-scaling-stroke"
            />
          ))}
          {/* 异常区轴标注（左绿→右橙水平渐变，高 12px，整体 50% 透明度） */}
          {zones.map((z) => (
            <rect
              key={`ax-${z.key}`}
              x={z.x1}
              y={H - 12}
              width={z.x2 - z.x1}
              height={12}
              fill="url(#abnormalAxisGrad)"
              opacity={0.5}
              pointerEvents="none"
            />
          ))}
          {/* 左→右白色渐变：终点贴在数据边沿（曲线终点），宽度 660px */}
          <rect
            x={dataEdgeSx - 660}
            y={0}
            width={660}
            height={H}
            fill="url(#screenWashGrad)"
            pointerEvents="none"
          />
          {hoverInfo && (
            <>
              <line
                x1={hoverInfo.sx}
                x2={hoverInfo.sx}
                y1={0}
                y2={H}
                stroke="rgba(255,255,255,0.4)"
                strokeWidth={1}
                vectorEffect="non-scaling-stroke"
                pointerEvents="none"
              />
              {hoverInfo.values.map((v) => (
                <circle
                  key={v.label}
                  cx={hoverInfo.sx}
                  cy={v.y}
                  r={3}
                  fill={v.color}
                  pointerEvents="none"
                />
              ))}
            </>
          )}
        </svg>

        <div className="bb-chart-labels">
          {labels.map((l) => (
            <span key={l.minuteIdx} style={{ left: `${(l.sx / W) * 100}%` }}>
              {l.text}
            </span>
          ))}
        </div>
      </div>

      {hoverInfo && (
        <div
          className="bb-chart-tooltip"
          style={{ left: `${(hoverInfo.sx / W) * 100}%` }}
        >
          <div className="bb-tt-time">{hoverInfo.timeText}</div>
          {hoverInfo.values.map((v) => (
            <div key={v.label} className="bb-tt-row">
              <span className="bb-tt-dot" style={{ background: v.color }} />
              <span className="bb-tt-label">{v.label}</span>
              <span className="bb-tt-val">
                {v.val.toFixed(2)}
                <span className="bb-tt-unit"> {v.unit}</span>
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ============ 底部 6 格信息区 ============
import iconBing       from "../../assets/icon/BottomCells - 并离网切换.svg?url";
import iconHei        from "../../assets/icon/BottomCells - 黑启动.svg?url";
import iconKuanPin    from "../../assets/icon/BottomCells - 宽频震荡抑制.svg?url";
import iconYiCi       from "../../assets/icon/BottomCells - 一次调频.svg?url";
import iconGuanLiang  from "../../assets/icon/BottomCells - 惯量响应.svg?url";
import iconDuanLu     from "../../assets/icon/BottomCells - 短路电流支撑.svg?url";

const CELLS = [
  { title: "并离网切换",   subs: ["支持手动并离网切换"], icon: iconBing },
  { title: "黑启动",       subs: ["支持整站一键黑启动"], icon: iconHei },
  { title: "宽频振荡抑制", subs: ["阻尼系数 1.0", "抑制范围 10~150Hz"], icon: iconKuanPin },
  { title: "一次调频",     subs: ["调频死区 ±0.03~±0.05Hz", "调频系数 3~5%"], icon: iconYiCi },
  { title: "惯量响应",     subs: ["惯量时间常数 10s"], icon: iconGuanLiang },
  { title: "短路电流支撑", subs: ["过载曲线"], icon: iconDuanLu },
];

function BottomCells() {
  return (
    <div className="bb-bottom">
      {CELLS.map((c) => (
        <div className="bb-cell" key={c.title}>
          <div className="bb-cell-icon">
            <img src={c.icon} alt="" />
          </div>
          <div className="bb-cell-text">
            <div className="bb-cell-title">{c.title}</div>
            {c.subs.map((s, i) => (
              <div key={i} className="bb-cell-sub">{s}</div>
            ))}
          </div>
        </div>
      ))}
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
      <BottomCells />
    </footer>
  );
}
