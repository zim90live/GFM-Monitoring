import React from "react";
import Scene3D from "./scene/Scene3D.jsx";
import TopNav from "./ui/TopNav.jsx";
import BottomBar from "./ui/BottomBar.jsx";

export default function App() {
  return (
    <div className="stage">
      <div className="scene-canvas">
        <Scene3D />
      </div>
      <div className="ui">
        <TopNav />
        <BottomBar />
      </div>
    </div>
  );
}
