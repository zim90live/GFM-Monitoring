import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import { ViewProvider } from "./state/ViewContext.jsx";

// 不开 StrictMode：避免 dev 下 useMemo / primitive 双挂载导致 GLB 场景树被反复 reparent
createRoot(document.getElementById("root")).render(
  <ViewProvider>
    <App />
  </ViewProvider>
);
