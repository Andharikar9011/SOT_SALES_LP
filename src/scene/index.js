// Public entry. The UI imports ONLY this file. See app/INTERFACE.md and app/SCENE_README.md.
import { SceneController } from './scene.js';

/**
 * @param {{canvas: HTMLCanvasElement, theme: object, content: object, reducedMotion?: boolean, isMobile?: boolean, debug?: boolean}} options
 * @returns {Promise<SceneController>} rejects if WebGL is unavailable
 */
export async function createScene(options) {
  const controller = new SceneController(options); // throws (-> rejection) when WebGL is unavailable
  return controller;
}
