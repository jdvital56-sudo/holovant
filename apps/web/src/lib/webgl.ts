/** Cheap capability probe run before <Canvas> mounts — no context leaked. */
export function isWebglSupported(): boolean {
  if (typeof window === "undefined") return true;
  try {
    const canvas = document.createElement("canvas");
    const gl = canvas.getContext("webgl2") ?? canvas.getContext("webgl");
    return Boolean(gl);
  } catch {
    return false;
  }
}
