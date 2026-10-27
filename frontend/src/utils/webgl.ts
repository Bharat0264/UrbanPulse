let supported: boolean | undefined;
export function supportsWebGL() {
  if (supported !== undefined) return supported;
  try {
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("webgl2");
    supported = !!context;
    context?.getExtension("WEBGL_lose_context")?.loseContext();
    return supported;
  } catch {
    return (supported = false);
  }
}
