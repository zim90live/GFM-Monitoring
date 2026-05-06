import React from "react";

import iconKuaisu   from "../../assets/icon/MiddlePills - 快速电压控制.svg?url";
import iconKuanPin  from "../../assets/icon/MiddlePills - 宽频震荡抑制.svg?url";
import iconYiCi     from "../../assets/icon/MiddlePills - 一次调频.svg?url";
import iconGuanLiang from "../../assets/icon/MiddlePills - 惯量响应.svg?url";

const PILLS = [
  { title: "快速电压控制", num: 6,  icon: iconKuaisu },
  { title: "宽频振荡抑制", num: 3,  icon: iconKuanPin },
  { title: "一次调频",     num: 13, icon: iconYiCi },
  { title: "惯量响应",     num: 5,  icon: iconGuanLiang },
];

export default function MiddlePills() {
  return (
    <div className="middle-pills">
      {PILLS.map((p) => (
        <div className="middle-pill" key={p.title}>
          <div className="middle-pill-icon">
            <img src={p.icon} alt="" />
          </div>
          <div className="middle-pill-title">{p.title}</div>
          <div className="middle-pill-num">{p.num}</div>
        </div>
      ))}
    </div>
  );
}
