import React, { useRef, useState } from "react";
import { useControls, folder } from "leva";
import { useView } from "../state/ViewContext.jsx";
import { defaults } from "../config/params.js";
import EventDetailChart from "./EventDetailChart.jsx";

// 时间条覆盖 stage 宽度的范围（左右各留 24px 边距）
const STAGE_W = 1920;
const STRIP_LEFT = 24;
const STRIP_USABLE = STAGE_W - STRIP_LEFT * 2;
const TILE_COUNT = 360;
const TOTAL_SEC = 6 * 86400;
// 选区视觉宽度 100px；左边默认对齐到演示区起点（tile 220）
const SELECTION_WIDTH_PX = 100;
const SELECTION_INIT_LEFT_RATIO = 220 / TILE_COUNT;

// 顶部坐标轴位置（配合 3D 直线的屏幕投影位置；camera detail 改了需联动微调）
const TOP_AXIS_BOTTOM = 1080 - 240; // = bottom 840
const TOP_AXIS_HEIGHT = 40;          // labels 12 + gap 16 + ticks 12

const DAY_DATES = [
  "2026-04-19", "2026-04-20", "2026-04-21",
  "2026-04-22", "2026-04-23", "2026-04-24",
];

export default function EventDetail() {
  const { eased } = useView();
  const k = Math.max(0, (eased - 0.55) / 0.45);
  if (k <= 0) return null;

  return (
    <div
      className="event-detail"
      style={{
        opacity: k,
        pointerEvents: "none",  // 外层不拦截，由内部的 .ed-selection / SVG 自行 auto
      }}
    >
      <TopAxis />
      <SelectionAndChart />
    </div>
  );
}

// ============== 顶部时间轴：与底部坐标轴样式一致 ==============
function TopAxis() {
  // 73 个刻度（0..72），每 12 个一大刻度 → 7 大刻度（与 BottomBar 一致）
  // 6 个日期标签放在前 6 个大刻度位置（最后一个大刻度无标签）
  const tickN = 73;
  const ticks = Array.from({ length: tickN }, (_, i) => ({
    x: (i / (tickN - 1)) * STRIP_USABLE,
    big: i % 12 === 0,
  }));
  const labels = DAY_DATES.map((d, i) => ({
    x: (i * 12 / (tickN - 1)) * STRIP_USABLE,
    text: d,
  }));

  return (
    <div
      className="ed-top-axis"
      style={{
        position: "absolute",
        left: STRIP_LEFT,
        bottom: TOP_AXIS_BOTTOM,
        width: STRIP_USABLE,
        height: TOP_AXIS_HEIGHT,
        pointerEvents: "none",
      }}
    >
      {/* 日期标签（在轴上方，复用首页 .bb-chart-labels 样式） */}
      <div
        className="bb-chart-labels"
        style={{ position: "absolute", top: 0, left: 0, right: 0, height: 12 }}
      >
        {labels.map((l, i) => (
          <span key={i} style={{ left: `${(l.x / STRIP_USABLE) * 100}%` }}>
            {l.text}
          </span>
        ))}
      </div>

      {/* 刻度 SVG（位于轴下半，刻度从底向上延伸 → 朝向下方 tile 行） */}
      <svg
        style={{ position: "absolute", left: 0, right: 0, bottom: 0, width: "100%", height: 12 }}
        viewBox={`0 0 ${STRIP_USABLE} 12`}
        preserveAspectRatio="none"
      >
        {ticks.map((t, i) => (
          <line
            key={i}
            x1={t.x}
            x2={t.x}
            y1={12}
            y2={t.big ? 0 : 6}
            stroke={t.big ? "rgba(255,255,255,0.6)" : "rgba(255,255,255,0.4)"}
            strokeWidth={1}
            vectorEffect="non-scaling-stroke"
          />
        ))}
      </svg>
    </div>
  );
}

function SelectionAndChart() {
  // leva 参数：选区框纵向 / 横向 / 高度（与 3D 直线对齐用）
  const dCfg = defaults.eventDetail.selection;
  const sel = useControls(
    "详情页 · 选区框",
    {
      selTop:      { value: dCfg.top,       min: 0, max: 1000, step: 1, label: "顶部 (px)" },
      selHeight:   { value: dCfg.height,    min: 4, max: 200,  step: 1, label: "高度 (px)" },
      selLeftPad:  { value: dCfg.leftPad,   min: 0, max: 200,  step: 1, label: "左边距 (px)" },
      selRightPad: { value: dCfg.rightPad,  min: 0, max: 200,  step: 1, label: "右边距 (px)" },
      "外观": folder({
        borderColor: { value: dCfg.borderColor, label: "描边颜色" },
        borderAlpha: { value: dCfg.borderAlpha, min: 0, max: 1, step: 0.01, label: "描边透明度" },
        bgAlpha:     { value: dCfg.bgAlpha,     min: 0, max: 1, step: 0.01, label: "底色透明度" },
      }, { collapsed: true }),
    },
    { collapsed: true }
  );

  const trackUsable = STAGE_W - sel.selLeftPad - sel.selRightPad;
  // 100px 在当前 track 宽度下的比例
  const selWidth = SELECTION_WIDTH_PX / trackUsable;

  const { pendingSelLeftRef } = useView();
  const stripRef = useRef(null);
  const [selLeft, setSelLeft] = useState(() => {
    const v = pendingSelLeftRef?.current;
    return typeof v === "number" ? v : SELECTION_INIT_LEFT_RATIO;
  });
  const dragRef = useRef(null);

  const onPointerDown = (e) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    const rect = stripRef.current.getBoundingClientRect();
    dragRef.current = {
      startClientX: e.clientX,
      startLeft: selLeft,
      stripWidth: rect.width,
    };
  };
  const onPointerMove = (e) => {
    if (!dragRef.current) return;
    const dx = e.clientX - dragRef.current.startClientX;
    const dRatio = dx / dragRef.current.stripWidth;
    let next = dragRef.current.startLeft + dRatio;
    next = Math.max(0, Math.min(1 - selWidth, next));
    setSelLeft(next);
  };
  const onPointerUp = (e) => {
    e.currentTarget.releasePointerCapture?.(e.pointerId);
    dragRef.current = null;
  };

  const startSec = Math.floor(selLeft * TOTAL_SEC);
  const spanSec  = selWidth * TOTAL_SEC;

  const hexToRgba = (hex, a) => {
    const m = hex.match(/^#([0-9a-f]{6})$/i);
    if (!m) return `rgba(255,255,255,${a})`;
    const n = parseInt(m[1], 16);
    return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
  };

  return (
    <>
      <div
        ref={stripRef}
        className="ed-strip-track"
        style={{
          position: "absolute",
          top: sel.selTop,
          left: sel.selLeftPad,
          width: trackUsable,
          height: sel.selHeight,
        }}
      >
        <div
          className="ed-selection"
          style={{
            left: `${selLeft * 100}%`,
            width: `${SELECTION_WIDTH_PX}px`,
            border: `1px solid ${hexToRgba(sel.borderColor, sel.borderAlpha)}`,
            background: hexToRgba(sel.borderColor, sel.bgAlpha),
          }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        />
      </div>

      <EventDetailChart startSec={startSec} spanSec={spanSec} />
    </>
  );
}
