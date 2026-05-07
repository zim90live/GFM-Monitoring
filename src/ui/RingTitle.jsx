import React from "react";
import { useView } from "../state/ViewContext.jsx";

// 首页环中央的大标题。进入详情页时随转场淡出（与 BottomBar / MiddlePills 一致）。
export default function RingTitle() {
  const { eased } = useView();
  const opacity = 1 - eased;
  if (opacity <= 0.001) return null;
  return (
    <div className="ring-title" style={{ opacity }}>
      电网数据稳态运行中
    </div>
  );
}
