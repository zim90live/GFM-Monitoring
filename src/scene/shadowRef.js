// 跨组件共享 AccumulativeShadows 的 ref，让 Models 加载完成后能触发重新烘焙
import { createRef } from "react";
export const shadowsRef = createRef();
