import { useEffect } from "react";
import { useThree } from "@react-three/fiber";

export default function RendererSettings({ exposure }) {
  const { gl } = useThree();
  useEffect(() => {
    gl.toneMappingExposure = exposure;
  }, [gl, exposure]);
  return null;
}
