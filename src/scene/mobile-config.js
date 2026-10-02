// Quality presets. Desktop vs mobile; adaptive quality steps down from these.

export function detectMobile(optIsMobile) {
  if (optIsMobile) return true;
  try {
    const coarse = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
    const small = Math.min(window.innerWidth, window.innerHeight) < 600;
    return !!(coarse && small);
  } catch (e) {
    return false;
  }
}

export function getConfig(isMobile) {
  if (isMobile) {
    return {
      isMobile: true,
      pixelRatioCap: 1.5,
      shadows: false,
      antialias: false,
      targetFps: 30,
      globeDetail: 2,      // 180 faces -> 540 verts
      members: 5,
      figureDetail: 0,     // head icosahedron detail
      stars: 50
    };
  }
  return {
    isMobile: false,
    pixelRatioCap: 2,
    shadows: true,
    antialias: true,
    targetFps: 60,
    globeDetail: 4,        // 500 faces -> 1500 verts
    members: 7,
    figureDetail: 1,
    stars: 140
  };
}
