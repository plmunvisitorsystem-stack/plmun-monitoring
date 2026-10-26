/**
 * LGU "Featured Cases" page (/admin/featured-cases): the resolved cases shown
 * in the public landing page slideshow, in slideshow order.
 * Each case: thumbnail, caption, Visible/Hidden switch, Up/Down (order),
 * Edit (same form as on Report Details) and Remove (with confirmation).
 * New cases are added from a Resolved report's details page.
 */
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import StaffLayout from '../../layouts/StaffLayout';
import Card from '../../components/Card';
import Button from '../../components/Button';
import Alert from '../../components/Alert';
import Modal from '../../components/Modal';
import Icon from '../../components/Icon';
import IssueTypeIcon from '../../components/IssueTypeIcon';
import EmptyState from '../../components/EmptyState';
import LoadError from '../../components/LoadError';
import FeatureCaseDialog from './FeatureCaseDialog';
import { apiRequest, fetchImageUrl } from '../../api/client';
import { useApiData } from '../../hooks/useApiData';
import { useLanguage } from '../../i18n/useLanguage';
import { formatDate, formatReportId } from '../../utils/format';
import '../staff/LiveChat.css'; // the on/off switch style (availability-switch)
import './FeaturedCases.css';

// Small photo loaded with the login token (hidden cases are not public).
function Thumbnail({ url, alt }) {
  const [src, setSrc] = useState(null);
  useEffect(() => {
    let objectUrl = null;
    let cancelled = false;
    fetchImageUrl(url)
      .then((loaded) => {
        if (cancelled) URL.revokeObjectURL(loaded);
        else {
          objectUrl = loaded;
          setSrc(loaded);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [url]);
  return <div className="featured-row__thumb">{src ? <img src={src} alt={alt} /> : <Icon name="image" />}</div>;
}

export default function FeaturedCasesPage() {
  const { t, language } = useLanguage();
  const { data, loading, errorCode, reload } = useApiData('/admin/featured-cases');
  const [cases, setCases] = useState([]);
  const [busyId, setBusyId] = useState(null);
  const [actionError, setActionError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [editing, setEditing] = useState(null);
  const [removing, setRemoving] = useState(null);
  // A new photo gets the same URL, so the thumbnail is reloaded with a counter.
  const [photoVersion, setPhotoVersion] = useState({});

  useEffect(() => {
    if (data?.cases) setCases(data.cases);
  }, [data]);

  async function run(id, action) {
    if (busyId) return;
    setBusyId(id);
    setActionError(null);
    setNotice(null);
    try {
      await action();
    } catch (error) {
      setActionError(error.code);
      reload();
    } finally {
      setBusyId(null);
    }
  }

  const replaceCase = (updated) => setCases((current) => current.map((item) => (item.id === updated.id ? updated : item)));

  const toggleVisible = (item) =>
    run(item.id, async () => {
      const result = await apiRequest(`/admin/featured-cases/${item.id}/visibility`, {
        method: 'PATCH',
        body: { isVisible: !item.isVisible },
      });
      replaceCase(result.featured);
      setNotice(t(result.featured.isVisible ? 'featured.nowVisible' : 'featured.nowHidden'));
    });

  const move = (item, direction) =>
    run(item.id, async () => {
      const result = await apiRequest(`/admin/featured-cases/${item.id}/move`, { method: 'PATCH', body: { direction } });
      setCases(result.cases);
    });

  const confirmRemove = () =>
    run(removing.id, async () => {
      await apiRequest(`/admin/featured-cases/${removing.id}`, { method: 'DELETE' });
      setCases((current) => current.filter((item) => item.id !== removing.id));
      setRemoving(null);
      setNotice(t('featured.removed'));
    });

  const visibleCount = cases.filter((item) => item.isVisible).length;

  return (
    <StaffLayout role="lgu">
      <h1 className="page-title">{t('featured.pageTitle')}</h1>
      <p className="text-muted featured-page__intro">{t('featured.pageIntro')}</p>

      {loading && <p className="text-muted" role="status">{t('common.loading')}</p>}
      {!loading && errorCode && <LoadError code={errorCode} onRetry={reload} />}

      {actionError && <Alert type="error">{t(`errors.${actionError}`)}</Alert>}
      {notice && (
        <p className="featured-page__notice" role="status">
          <Icon name="check" /> {notice}
        </p>
      )}

      {!loading && !errorCode && cases.length === 0 && (
        <EmptyState icon="star" title={t('featured.emptyTitle')} message={t('featured.emptyMessage')} />
      )}

      {!loading && cases.length > 0 && (
        <Card>
          <p className="text-muted featured-page__count">{t('featured.count', { visible: visibleCount, total: cases.length })}</p>
          <ol className="featured-list">
            {cases.map((item, index) => (
              <li key={item.id} className={`featured-row ${item.isVisible ? '' : 'is-hidden'}`}>
                <span className="featured-row__order" aria-hidden="true">{index + 1}</span>
                <Thumbnail
                  key={`${item.id}-${photoVersion[item.id] || 0}`}
                  url={item.photoUrl}
                  alt={t('featured.photoAlt', { type: item.issueType, area: item.area })}
                />
                <div className="featured-row__info">
                  <p className="featured-row__caption">{item.caption}</p>
                  <p className="featured-row__meta">
                    <Link to={`/admin/reports/${item.reportId}`} state={{ from: '/admin/featured-cases' }}>
                      {formatReportId(item.reportId, item.dateSubmitted)}
                    </Link>
                    <IssueTypeIcon type={item.issueType} />
                    <span>{item.area}</span>
                    {item.dateResolved && <span>{t('featured.resolvedOn', { date: formatDate(item.dateResolved, language) })}</span>}
                  </p>
                  {item.status !== 'Resolved' && (
                    <p className="featured-row__warning">
                      <Icon name="warning" /> {t('featured.autoHidden')}
                    </p>
                  )}
                </div>
                <div className="featured-row__actions">
                  <button
                    type="button"
                    role="switch"
                    aria-checked={item.isVisible}
                    aria-label={t('featured.visibleLabel', { n: index + 1 })}
                    className={`availability-switch ${item.isVisible ? 'is-available' : ''}`}
                    onClick={() => toggleVisible(item)}
                    disabled={busyId !== null || (!item.isVisible && item.status !== 'Resolved')}
                  >
                    <span className="availability-switch__track" aria-hidden="true">
                      <span className="availability-switch__thumb" />
                    </span>
                    <span>{t(item.isVisible ? 'featured.visible' : 'featured.hidden')}</span>
                  </button>
                  <div className="featured-row__buttons">
                    <Button
                      variant="outline"
                      className="featured-row__icon-btn"
                      aria-label={t('featured.moveUp', { n: index + 1 })}
                      title={t('featured.moveUp', { n: index + 1 })}
                      onClick={() => move(item, 'up')}
                      disabled={busyId !== null || index === 0}
                    >
                      <Icon name="chevronUp" />
                    </Button>
                    <Button
                      variant="outline"
                      className="featured-row__icon-btn"
                      aria-label={t('featured.moveDown', { n: index + 1 })}
                      title={t('featured.moveDown', { n: index + 1 })}
                      onClick={() => move(item, 'down')}
                      disabled={busyId !== null || index === cases.length - 1}
                    >
                      <Icon name="chevronDown" />
                    </Button>
                    <Button variant="outline" icon="pencil" onClick={() => setEditing(item)} disabled={busyId !== null}>
                      {t('featured.edit')}
                    </Button>
                    <Button variant="outline" icon="trash" className="featured-row__remove" onClick={() => setRemoving(item)} disabled={busyId !== null}>
                      {t('featured.remove')}
                    </Button>
                  </div>
                </div>
              </li>
            ))}
          </ol>
        </Card>
      )}

      <FeatureCaseDialog
        open={Boolean(editing)}
        onClose={() => setEditing(null)}
        featured={editing}
        slide={editing ? { issueType: editing.issueType, area: editing.area, dateResolved: editing.dateResolved } : {}}
        onSaved={(updated) => {
          replaceCase(updated);
          setPhotoVersion((current) => ({ ...current, [updated.id]: (current[updated.id] || 0) + 1 }));
          setEditing(null);
          setNotice(t('featured.saved'));
        }}
      />

      <Modal open={Boolean(removing)} title={t('featured.removeTitle')} onClose={() => setRemoving(null)}>
        <p>{t('featured.removeMessage')}</p>
        {removing && <p className="featured-page__remove-caption">“{removing.caption}”</p>}
        <div className="modal__actions">
          <Button variant="outline" onClick={() => setRemoving(null)} disabled={busyId !== null}>
            {t('featured.cancel')}
          </Button>
          <Button className="btn--danger" icon="trash" onClick={confirmRemove} disabled={busyId !== null}>
            {t('featured.removeConfirm')}
          </Button>
        </div>
      </Modal>
    </StaffLayout>
  );
}
