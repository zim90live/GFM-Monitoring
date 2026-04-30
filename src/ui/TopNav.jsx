import React from "react";

const tabs = ["电站监控", "运行监控", "智能告警", "报表", "设置"];

export default function TopNav() {
  return (
    <header className="nav">
      <div className="nav-left">
        <div className="logo-main">FUSIONSOLAR</div>
        <div className="logo-sub">GFM Monitoring</div>
      </div>
      <nav className="nav-tabs">
        {tabs.map((t, i) => (
          <a key={t} className={`tab ${i === 2 ? "active" : ""}`}>{t}</a>
        ))}
      </nav>
      <div className="nav-right">
        <span className="icon-btn">🔔</span>
        <span className="icon-btn">👤</span>
      </div>
    </header>
  );
}
