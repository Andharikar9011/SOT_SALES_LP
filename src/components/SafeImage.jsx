import { useEffect, useState } from 'react';
import { initials } from '../utils/text.js';

// <img> with graceful failure. fallback: 'initials' (avatar), 'text' (text label), or 'hide'.
export default function SafeImage({ src, alt = '', fallback = 'hide', label = '', className = '', width, height, loading = 'lazy', onFail }) {
  const [failed, setFailed] = useState(!src);
  useEffect(() => { setFailed(!src); }, [src]);
  if (failed) {
    if (fallback === 'initials') {
      return <span className={`${className} img-fallback img-fallback--initials`} role="img" aria-label={alt || label}><span aria-hidden="true">{initials(label)}</span></span>;
    }
    if (fallback === 'text') return <span className={`${className} img-fallback img-fallback--text`}>{label}</span>;
    return null;
  }
  return <img className={className} src={src} alt={alt} width={width} height={height} loading={loading} decoding="async"
    onError={() => { setFailed(true); onFail?.(); }} />;
}
