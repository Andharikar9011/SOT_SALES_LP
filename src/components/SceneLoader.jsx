import { useEffect, useState } from 'react';
import Logo from './Logo.jsx';

// Full-viewport loader shown until the scene is ready (min 300ms to avoid a flash).
export default function SceneLoader({ ready, ratio, logo, logoAlt, siteName, label }) {
  const [minDone, setMinDone] = useState(false);
  const [gone, setGone] = useState(false);
  useEffect(() => { const t = setTimeout(() => setMinDone(true), 300); return () => clearTimeout(t); }, []);
  const hiding = ready && minDone;
  useEffect(() => {
    if (!hiding) return undefined;
    const t = setTimeout(() => setGone(true), 450);
    return () => clearTimeout(t);
  }, [hiding]);
  if (gone) return null;
  return (
    <div className={`scene-loader${hiding ? ' scene-loader--hide' : ''}`} aria-hidden={hiding || undefined}>
      <Logo className="scene-loader__logo" src={logo} label={siteName} />
      <div className="scene-loader__bar" role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round((ready ? 1 : ratio) * 100)}>
        <div className="scene-loader__fill" style={{ transform: `scaleX(${ready ? 1 : Math.max(0.05, ratio)})` }} />
      </div>
    </div>
  );
}
