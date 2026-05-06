import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

export const ViewContext = createContext(null);
const TRANSITION_MS = 1000;

const easeInOutCubic = (x) =>
  x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;

export function ViewProvider({ children }) {
  // 线性 t（0=overview, 1=detail），rAF 推进
  const tRef = useRef(0);          // 给 3D 用（不触发 React rerender）
  const eRef = useRef(0);          // 缓动后的 t（同样给 3D 用）
  const [t, setT] = useState(0);   // 给 DOM 用（每帧触发 rerender）
  const [eased, setEased] = useState(0);
  const targetRef = useRef(0);
  const rafRef = useRef(null);
  const lastRef = useRef(0);

  // 颜色筛选：null | 'pink' | 'orange' | 'blue' | 'green'
  const [filter, setFilterRaw] = useState(null);
  const toggleFilter = useCallback((key) => {
    setFilterRaw((prev) => (prev === key ? null : key));
  }, []);

  // 进入详情页时附带的目标选区位置（点击环上某个 tile 后传给 EventDetail）
  const pendingSelLeftRef = useRef(null);

  const tick = useCallback((now) => {
    const dt = now - lastRef.current;
    lastRef.current = now;
    const dir = targetRef.current - tRef.current;
    if (Math.abs(dir) < 1e-4) {
      tRef.current = targetRef.current;
      eRef.current = easeInOutCubic(tRef.current);
      setT(tRef.current);
      setEased(eRef.current);
      rafRef.current = null;
      return;
    }
    const step = (dt / TRANSITION_MS) * Math.sign(dir);
    let next = tRef.current + step;
    if (next < 0) next = 0;
    if (next > 1) next = 1;
    tRef.current = next;
    eRef.current = easeInOutCubic(next);
    setT(next);
    setEased(eRef.current);
    rafRef.current = requestAnimationFrame(tick);
  }, []);

  const startAnimation = useCallback(() => {
    if (rafRef.current != null) return;
    lastRef.current = performance.now();
    rafRef.current = requestAnimationFrame(tick);
  }, [tick]);

  const enter = useCallback((selLeft = null) => {
    if (typeof selLeft === "number") pendingSelLeftRef.current = selLeft;
    targetRef.current = 1;
    startAnimation();
  }, [startAnimation]);

  const exit = useCallback(() => {
    targetRef.current = 0;
    startAnimation();
  }, [startAnimation]);

  // ESC 返回（仅在已经进入 detail 或正在 transitioning-in 时生效）
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape" && targetRef.current === 1) exit();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [exit]);

  useEffect(() => () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
  }, []);

  // 派生视图状态
  let view;
  if (t <= 0 && targetRef.current === 0) view = "overview";
  else if (t >= 1 && targetRef.current === 1) view = "detail";
  else view = targetRef.current === 1 ? "transitioning-in" : "transitioning-out";

  const value = useMemo(
    () => ({ view, t, eased, tRef, eRef, enter, exit, filter, toggleFilter, pendingSelLeftRef }),
    [view, t, eased, enter, exit, filter, toggleFilter]
  );

  return <ViewContext.Provider value={value}>{children}</ViewContext.Provider>;
}

export function useView() {
  const ctx = useContext(ViewContext);
  if (!ctx) throw new Error("useView must be used inside ViewProvider");
  return ctx;
}
