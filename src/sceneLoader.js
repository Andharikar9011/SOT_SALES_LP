// Lazy-loads the Three.js scene (its own chunk). A rejected import or a rejected createScene() (no WebGL)
// propagates to SceneCanvas, which reports it so App can show the static NoWebGLFallback.
export async function loadScene() {
  const { createScene } = await import('./scene/index.js');
  return { createScene };
}
