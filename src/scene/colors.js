import * as THREE from 'three';

// Fallback only, used if a key is missing from the theme object passed in.
const FALLBACK = {
  colors: {
    background: '#0B1B33', surfaceRaised: '#1B3A66', primary: '#1A5FBF', primaryText: '#7DB2FF',
    accent: '#FF6B35', success: '#4ADE80', text: '#F4F8FF'
  },
  scene: {
    sceneBackground: '#0B1B33', globeBase: '#1A5FBF', globeAccent: '#2F7BE0', globeLight: '#FFD9B8',
    characterBody: '#F4F8FF', characterAccent: '#FF6B35',
    cohortColors: ['#FF6B35', '#7DB2FF', '#F4C95D', '#8EE3C8', '#E59AD0']
  }
};

export function normalizeTheme(theme) {
  const scene = { ...FALLBACK.scene, ...((theme && theme.scene) || {}) };
  const colors = { ...FALLBACK.colors, ...((theme && theme.colors) || {}) };
  if (!Array.isArray(scene.cohortColors) || !scene.cohortColors.length) scene.cohortColors = FALLBACK.scene.cohortColors;
  return { scene, colors };
}

const C = (hex) => new THREE.Color(hex);

// Semantic color roles used by procedural geometry. Everything derives from the theme.
export function resolveRole(role, th) {
  const s = th.scene, c = th.colors;
  if (role.startsWith('cohort:')) {
    const i = parseInt(role.slice(7), 10) || 0;
    return C(s.cohortColors[i % s.cohortColors.length]);
  }
  switch (role) {
    case 'body': return C(s.characterBody);
    case 'accent': return C(s.characterAccent);
    case 'skin': return C(s.characterBody).lerp(C(s.sceneBackground), 0.12);
    case 'legs': return C(s.characterBody).lerp(C(s.sceneBackground), 0.6);
    case 'shoe': return C(s.sceneBackground).lerp(C(s.characterBody), 0.15);
    case 'globeBase': return C(s.globeBase);
    case 'globeAccent': return C(s.globeAccent);
    case 'globeLight': case 'light': return C(s.globeLight);
    case 'plinth': return C(s.globeAccent).lerp(C(s.characterBody), 0.22);
    case 'rug': return C(s.globeBase).lerp(C(s.sceneBackground), 0.25);
    case 'wood': return C(s.globeLight).lerp(C(s.sceneBackground), 0.6);
    case 'metal': return C(s.characterBody).lerp(C(s.sceneBackground), 0.4);
    case 'frame': return C(c.primary).lerp(C(s.characterBody), 0.3);
    case 'screenBg': return C(s.sceneBackground).lerp(C(c.primary), 0.3);
    case 'building': return C(s.globeBase).lerp(C(s.characterBody), 0.3);
    case 'plant': return C(c.success).lerp(C(s.sceneBackground), 0.3);
    default: return C(s.characterBody);
  }
}
