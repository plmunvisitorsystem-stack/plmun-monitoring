/**
 * Barangay Landayan hall photo used as a full-cover background with a dark green overlay.
 * Place it as the first child of a container with the class "hall-bg";
 * the container's content sits on top in white text.
 *   priority: true only on the landing hero and the login page (preloaded, loaded first);
 *             everywhere else the photo is lazy-loaded.
 * If the photo cannot load, the container's solid green background shows instead.
 */
import { useState } from 'react';
import { preload } from 'react-dom';
import './HallPhoto.css';

// The largest file is the original width (1536px); it is never enlarged.
const WIDTHS = { 640: 640, 1024: 1024, 1920: 1536 };
const srcSet = (ext) =>
  Object.entries(WIDTHS)
    .map(([name, w]) => `/images/barangay-hall-${name}.${ext} ${w}w`)
    .join(', ');

export default function HallPhoto({ priority = false, sizes = '100vw' }) {
  const [failed, setFailed] = useState(false);

  if (priority) {
    preload('/images/barangay-hall-1024.webp', {
      as: 'image',
      type: 'image/webp',
      imageSrcSet: srcSet('webp'),
      imageSizes: sizes,
      fetchPriority: 'high',
    });
  }

  return (
    <>
      {!failed && (
        <picture className="hall-bg__photo">
          <source type="image/webp" srcSet={srcSet('webp')} sizes={sizes} />
          <img
            src="/images/barangay-hall-1024.jpg"
            srcSet={srcSet('jpg')}
            sizes={sizes}
            alt="Barangay Landayan hall"
            loading={priority ? 'eager' : 'lazy'}
            fetchPriority={priority ? 'high' : 'auto'}
            decoding="async"
            onError={() => setFailed(true)}
          />
        </picture>
      )}
      <div className="hall-bg__overlay" aria-hidden="true" />
    </>
  );
}
