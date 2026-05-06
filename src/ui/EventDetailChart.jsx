import React, { useRef, useState } from "react";
import {
  eventAt as evAt,
  visibleEvents as evVisible,
  eventPurpleY,
  eventCyanY,
  EVENT_TYPE_INFO,
} from "../data/events.js";

// ============ 几何参数 ============
const STAGE_W = 1920;
const STAGE_H = 1080;
const SIDE_PAD = 24;                  // 左右边距，与时间轴 / 首页 BottomBar 对齐

// 时间轴叠加在图表之上：刻度位于 SVG 底部，数字 DOM 覆盖在刻度上方
const CHART_W = STAGE_W - SIDE_PAD * 2;     // 1872
const CHART_H_VB = 720;                      // viewBox 高
const baseline = CHART_H_VB * 0.45;          // 紫线基线

// 容器布局：bottom 24, 高 = SVG 高（数字与刻度都内嵌在里面）
const CONTAINER_H = CHART_H_VB;
// 数字行的位置：贴在刻度上方（刻度高 12px + 8px 间距）
const LABELS_BOTTOM = 20;
const LABELS_HEIGHT = 12;

// ============ 视觉色 ============
const COLORS = {
  purple: "#B23DA8",
  cyan: "#1DBDF1",
  text: "rgba(255,255,255,0.7)",
  tickBig: "rgba(255,255,255,0.6)",
  tickSmall: "rgba(255,255,255,0.4)",
};

// ============ 默认初始 viewStart / viewSpan（与 EventDetail 同步） ============
const TOTAL_SEC = 6 * 86400;
const TILE_COUNT = 360;
const TILE_SEC = TOTAL_SEC / TILE_COUNT;
const INITIAL_SEL_START = 220 * TILE_SEC;
const INITIAL_SEL_SPAN  = (100 / 1872) * TOTAL_SEC;  // 100px 视觉宽度

const cyanBase = baseline + 90;

// 根据 viewSpan 选择适合的 major / minor 刻度间隔
// 规则：major 是 60 的整数倍（whole-minute 标签），minor = major / 12
const MAJOR_CANDIDATES = [60, 120, 300, 600, 900, 1800, 3600, 7200, 14400, 21600];
function pickAxisIntervals(spanSec) {
  const ideal = spanSec / 6;        // 期望 ~6 个大刻度
  let major = MAJOR_CANDIDATES[MAJOR_CANDIDATES.length - 1];
  for (const c of MAJOR_CANDIDATES) {
    if (c >= ideal) { major = c; break; }
  }
  return { major, minor: major / 12 };
}

// 共享事件源（从 ../data/events.js）：始终展示所有事件，filter 不影响图表内容
function makeQueries({ ratio, seed }) {
  return {
    purpleYAt: (absT) => {
      const ev = evAt(absT, { ratio, seed });
      return baseline + (ev ? eventPurpleY(absT, ev) : 0);
    },
    cyanYAt: (absT) => {
      const ev = evAt(absT, { ratio, seed });
      return cyanBase + (ev ? eventCyanY(absT, ev) : 0);
    },
    visEvents: (viewStart, spanSec) =>
      evVisible(viewStart, spanSec, { ratio, seed }),
  };
}

function buildPath(viewStart, spanSec, fn) {
  const N = 600;
  const pts = [];
  for (let i = 0; i <= N; i++) {
    const x = (i / N) * CHART_W;
    const t = viewStart + (i / N) * spanSec;
    pts.push(`${x.toFixed(1)},${fn(t).toFixed(1)}`);
  }
  return "M" + pts.join("L");
}

// 整分秒（major 标签）：HH:MM:00
function formatMinute(secAbs) {
  const s = ((Math.round(secAbs) % 86400) + 86400) % 86400;
  const h = Math.floor(s / 3600);
  const m = Math.floor(s / 60) % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00`;
}
// 完整时分秒（hover tooltip 用）
function formatTime(secAbs) {
  const s = ((Math.round(secAbs) % 86400) + 86400) % 86400;
  const h = Math.floor(s / 3600);
  const m = Math.floor(s / 60) % 60;
  const ss = s % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
}

// hover 数据系列 metadata（与曲线一一对应）
const SERIES_INFO = [
  { color: "#B23DA8", label: "有功功率", unit: "kW", base: 24.0, dev: 30.0,
    fn: null /* placeholder, 见 EventDetailChart 内部 */ },
  { color: "#1DBDF1", label: "频率",     unit: "Hz", base: 50.0, dev: 0.50,
    fn: null },
];

export default function EventDetailChart({
  startSec = INITIAL_SEL_START,
  spanSec = INITIAL_SEL_SPAN,
  ratio = 0.30,
  seed = 1,
}) {
  const { purpleYAt, cyanYAt, visEvents } = makeQueries({ ratio, seed });
  const viewStart = startSec;
  const { major: MAJOR_SEC, minor: MINOR_SEC } = pickAxisIntervals(spanSec);
  const purpleD = buildPath(viewStart, spanSec, purpleYAt);
  const cyanD   = buildPath(viewStart, spanSec, cyanYAt);

  // hover 状态
  const svgRef = useRef(null);
  const [hover, setHover] = useState(null); // { sx, cy } in viewBox coords / px-relative-to-svg
  const onPointerMove = (e) => {
    if (!svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const sx = ((e.clientX - rect.left) / rect.width) * CHART_W;
    const cy = e.clientY - rect.top;       // px 相对 SVG / 容器（容器 inset:0）
    setHover({ sx, cy });
  };
  const onPointerLeave = () => setHover(null);

  // hover 计算
  let hoverInfo = null;
  if (hover && hover.sx >= 0 && hover.sx <= CHART_W) {
    const t = viewStart + (hover.sx / CHART_W) * spanSec;
    const py = purpleYAt(t);
    const cy = cyanYAt(t);
    hoverInfo = {
      sx: hover.sx,
      cy: hover.cy,
      timeText: formatTime(t),
      values: [
        { ...SERIES_INFO[0], y: py,
          val: 24 + ((baseline - py) / 200) * 30 },
        { ...SERIES_INFO[1], y: cy,
          val: 50 + ((cyanBase - cy) / 200) * 0.5 },
      ],
    };
  }

  // 刻度：minor 间隔自适应，major = 60 的整数倍 → 标签都是整分 HH:MM:00
  const viewEnd = viewStart + spanSec;
  const firstMinor = Math.ceil(viewStart / MINOR_SEC) * MINOR_SEC;
  const ticks = [];
  const labels = [];
  for (let t = firstMinor; t <= viewEnd; t += MINOR_SEC) {
    const x = ((t - viewStart) / spanSec) * CHART_W;
    const big = t % MAJOR_SEC === 0;
    ticks.push({ x, big, key: t });
    if (big) labels.push({ x, text: formatMinute(t), key: t });
  }

  // 视窗内可见事件（每个事件渲染自己的 zone + 锚点）
  const timeToX = (absT) => ((absT - viewStart) / spanSec) * CHART_W;
  const visibleEvents = visEvents(viewStart, spanSec);

  return (
    <div
      className="ed-chart-wrap"
      style={{
        position: "absolute",
        left: SIDE_PAD,
        right: SIDE_PAD,
        bottom: 24,
        height: CONTAINER_H,
        pointerEvents: "none",
      }}
    >
      <svg
        ref={svgRef}
        className="ed-chart-svg"
        style={{
          position: "absolute", inset: 0, width: "100%", height: "100%",
          display: "block", overflow: "hidden",
          pointerEvents: "auto", cursor: "crosshair",
        }}
        viewBox={`0 0 ${CHART_W} ${CHART_H_VB}`}
        preserveAspectRatio="none"
        onPointerMove={onPointerMove}
        onPointerLeave={onPointerLeave}
      >
        {/* 每个可见事件：单类型 zone + 边界虚线 + 中心标签
            紧挨的相邻事件共享边界，避免画重复虚线 */}
        {(() => {
          const startSet = new Set(visibleEvents.map((e) => e.tStart));
          const endSet   = new Set(visibleEvents.map((e) => e.tEnd));
          return visibleEvents.map((ev) => {
            const xs = timeToX(ev.tStart);
            const xe = timeToX(ev.tEnd);
            const info = EVENT_TYPE_INFO[ev.type];
            const hasLeftNeighbor  = endSet.has(ev.tStart);
            const hasRightNeighbor = startSet.has(ev.tEnd);
            const k = `${ev.idx}`;
            return (
              <g key={k}>
                <rect x={xs} y={0} width={xe - xs} height={CHART_H_VB}
                  fill={info.zoneColor} />
                {!hasLeftNeighbor && (
                  <line x1={xs} x2={xs} y1={0} y2={CHART_H_VB}
                    stroke={info.guideColor} strokeWidth={1} strokeDasharray="4 4"
                    vectorEffect="non-scaling-stroke" />
                )}
                {!hasRightNeighbor && (
                  <line x1={xe} x2={xe} y1={0} y2={CHART_H_VB}
                    stroke={info.guideColor} strokeWidth={1} strokeDasharray="4 4"
                    vectorEffect="non-scaling-stroke" />
                )}
                {/* 区段中心标签：事件分类名 */}
                <text x={(xs + xe) / 2} y={baseline - 200}
                  fill={info.textColor} fontSize={12} textAnchor="middle"
                  style={{ fontWeight: 500 }}>
                  {info.label}
                </text>
              </g>
            );
          });
        })()}

        {/* 曲线 */}
        <path d={purpleD} stroke={COLORS.purple} strokeWidth={1.6} fill="none"
          strokeLinecap="round" strokeLinejoin="round"
          vectorEffect="non-scaling-stroke" />
        <path d={cyanD} stroke={COLORS.cyan} strokeWidth={1.6} fill="none"
          strokeLinecap="round" strokeLinejoin="round"
          vectorEffect="non-scaling-stroke" />

        {/* 刻度（位于 SVG 底部，跟首页一致：小 6 大 12） */}
        {ticks.map((t) => (
          <line
            key={t.key}
            x1={t.x}
            x2={t.x}
            y1={t.big ? CHART_H_VB - 12 : CHART_H_VB - 6}
            y2={CHART_H_VB}
            stroke={t.big ? COLORS.tickBig : COLORS.tickSmall}
            strokeWidth={1}
            vectorEffect="non-scaling-stroke"
          />
        ))}

        {/* hover 游标 */}
        {hoverInfo && (
          <>
            <line
              x1={hoverInfo.sx} x2={hoverInfo.sx}
              y1={0} y2={CHART_H_VB - 12}
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

      {/* 时间数字：覆盖在刻度上方（数字在上、刻度在下） */}
      <div
        className="bb-chart-labels"
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: LABELS_BOTTOM,
          height: LABELS_HEIGHT,
          pointerEvents: "none",
        }}
      >
        {labels.map((l) => (
          <span key={l.key} style={{ left: `${(l.x / CHART_W) * 100}%` }}>
            {l.text}
          </span>
        ))}
      </div>

      {/* hover 数据卡片（复用首页 .bb-chart-tooltip 样式，Y 跟随光标） */}
      {hoverInfo && (
        <div
          className="bb-chart-tooltip"
          style={{
            left: `${(hoverInfo.sx / CHART_W) * 100}%`,
            top: `${hoverInfo.cy - 12}px`,
          }}
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
