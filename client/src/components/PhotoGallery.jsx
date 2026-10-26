/**
 * Photo gallery for Report Details (resident, response team, LGU).
 *   photos: [{ id }] from the API
 * Each photo is loaded with the login token (only the report owner, the
 * assigned team, and the LGU may see it). Tapping a thumbnail opens a
 * full-screen viewer with Previous / Next and Close (Esc and arrow keys work too).
 */
import { useEffect, useRef, useState } from 'react';
import Icon from './Icon';
import { fetchPhotoUrl } from '../api/client';
import { useLanguage } from '../i18n/useLanguage';
import './PhotoGallery.css';

export default function PhotoGallery({ photos }) {
  const { t } = useLanguage();
  const [urls, setUrls] = useState({}); // photo id -> object URL, or 'error'
  const [openIndex, setOpenIndex] = useState(null);
  const dialogRef = useRef(null);
  const photoKey = photos.map((photo) => photo.id).join(',');

  // Load every photo once; free the temporary URLs when leaving the page.
  useEffect(() => {
    let active = true;
    const created = [];
    for (const photo of photos) {
      fetchPhotoUrl(photo.id)
        .then((url) => {
          if (!active) return URL.revokeObjectURL(url);
          created.push(url);
          return setUrls((current) => ({ ...current, [photo.id]: url }));
        })
        .catch(() => active && setUrls((current) => ({ ...current, [photo.id]: 'error' })));
    }
    return () => {
      active = false;
      created.forEach((url) => URL.revokeObjectURL(url));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [photoKey]);

  // Open / close the full-screen <dialog>.
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (openIndex !== null && !dialog.open) dialog.showModal();
    if (openIndex === null && dialog.open) dialog.close();
  }, [openIndex]);

  if (photos.length === 0) return <p className="text-muted">{t('photos.none')}</p>;

  const total = photos.length;
  const go = (step) => setOpenIndex((index) => (index + step + total) % total);
  const current = openIndex !== null ? photos[openIndex] : null;

  return (
    <>
      <ul className="photo-gallery">
        {photos.map((photo, index) => {
          const url = urls[photo.id];
          return (
            <li key={photo.id}>
              <button
                type="button"
                className="photo-gallery__thumb"
                onClick={() => setOpenIndex(index)}
                aria-label={t('photos.open', { n: index + 1 })}
                disabled={!url || url === 'error'}
              >
                {url && url !== 'error' && <img src={url} alt="" />}
                {url === 'error' && <span className="photo-gallery__error">{t('photos.loadError')}</span>}
                {!url && <span className="photo-gallery__loading">{t('common.loading')}</span>}
              </button>
            </li>
          );
        })}
      </ul>

      <dialog
        ref={dialogRef}
        className="photo-viewer"
        aria-label={current ? t('photos.viewerTitle', { n: openIndex + 1, total }) : undefined}
        onCancel={(event) => {
          event.preventDefault();
          setOpenIndex(null);
        }}
        onKeyDown={(event) => {
          if (event.key === 'ArrowRight' && total > 1) go(1);
          if (event.key === 'ArrowLeft' && total > 1) go(-1);
        }}
      >
        {current && (
          <>
            <div className="photo-viewer__bar">
              <span className="photo-viewer__count">{t('photos.viewerTitle', { n: openIndex + 1, total })}</span>
              <button type="button" className="photo-viewer__button" onClick={() => setOpenIndex(null)}>
                <Icon name="close" />
                <span>{t('photos.close')}</span>
              </button>
            </div>
            <div className="photo-viewer__stage">
              <img src={urls[current.id]} alt={t('photos.alt', { n: openIndex + 1 })} />
            </div>
            {total > 1 && (
              <div className="photo-viewer__bar photo-viewer__bar--bottom">
                <button type="button" className="photo-viewer__button" onClick={() => go(-1)}>
                  <Icon name="chevronLeft" />
                  <span>{t('teamReports.previous')}</span>
                </button>
                <button type="button" className="photo-viewer__button" onClick={() => go(1)}>
                  <span>{t('teamReports.next')}</span>
                  <Icon name="chevronRight" />
                </button>
              </div>
            )}
          </>
        )}
      </dialog>
    </>
  );
}
