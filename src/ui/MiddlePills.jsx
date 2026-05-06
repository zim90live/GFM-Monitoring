import React from "react";
import { useView } from "../state/ViewContext.jsx";

import iconKuaisu from "../../assets/icon/MiddlePills - 快速电压控制.svg?url";
import iconKuanPin from "../../assets/icon/MiddlePills - 宽频震荡抑制.svg?url";
import iconYiCi from "../../assets/icon/MiddlePills - 一次调频.svg?url";
import iconGuanLiang from "../../assets/icon/MiddlePills - 惯量响应.svg?url";

const PILLS = [
  { title: "快速电压控制", num: 6, icon: iconKuaisu, filter: "blue" },
  { title: "宽频振荡抑制", num: 3, icon: iconKuanPin, filter: "pink" },
  { title: "一次调频", num: 13, icon: iconYiCi, filter: "orange" },
  { title: "惯量响应", num: 5, icon: iconGuanLiang, filter: "green" },
];

// overview 时 .middle-pills 的 top 位置（CSS bottom:381 + 高度 68 → 1080-381-68=631）
const OVERVIEW_TOP = 631;
const DETAIL_TOP = 114;
const DELTA = DETAIL_TOP - OVERVIEW_TOP; // -517

export default function MiddlePills() {
  const { eased, filter, toggleFilter } = useView();
  const dy = DELTA * eased;
  return (
    <div className="middle-pills" style={{ transform: `translateY(${dy}px)` }}>
      {PILLS.map((p) => {
        const selected = filter === p.filter;
        return (
          <div
            className={`middle-pill${selected ? " selected" : ""}`}
            key={p.title}
            onClick={() => toggleFilter(p.filter)}
            role="button"
          >
            <div className="middle-pill-icon">
              <img src={p.icon} alt="" />
            </div>
            <div className="middle-pill-title">{p.title}</div>
            <div className="middle-pill-num">{p.num}</div>
          </div>
        );
      })}
    </div>
  );
}
