/**
 * "Hotspots (last 30 days)" card: areas with many recent reports, ranked by
 * total. Each row: rank, area, most common issue type (icon + word), a small
 * bar (longest = highest total), and the number of reports.
 *   data: { days, minReports, hotspots: [{ area, total, topIssueType }] }
 *         from GET /api/hotspots or the Generate Reports export
 * Used on the LGU and team dashboards and in the (printed) LGU report.
 */
import Card from '../Card';
import IssueTypeIcon from '../IssueTypeIcon';
import { useLanguage } from '../../i18n/useLanguage';
import './HotspotCard.css';

export default function HotspotCard({ data }) {
  const { t } = useLanguage();
  if (!data) return null;

  const highest = Math.max(1, ...data.hotspots.map((spot) => spot.total));

  return (
    <Card title={t('hotspots.title', { days: data.days })} className="hotspots">
      <p className="text-muted hotspots__hint">{t('hotspots.hint', { count: data.minReports, days: data.days })}</p>

      {data.hotspots.length === 0 ? (
        <p className="hotspots__empty">{t('hotspots.empty')}</p>
      ) : (
        <ol className="hotspots__list">
          {data.hotspots.map((spot, index) => (
            <li key={spot.area} className="hotspot">
              <span className="hotspot__rank">{index + 1}</span>
              <span className="hotspot__area">{spot.area}</span>
              <span className="hotspot__type">
                <span className="visually-hidden">{t('hotspots.mostCommon')}: </span>
                <IssueTypeIcon type={spot.topIssueType} />
              </span>
              {/* The bar only repeats the number shown next to it, so screen readers skip it. */}
              <span className="hotspot__bar" aria-hidden="true">
                <span className="hotspot__bar-fill" style={{ width: `${(spot.total / highest) * 100}%` }} />
              </span>
              <span className="hotspot__total">{t('hotspots.reports', { count: spot.total })}</span>
            </li>
          ))}
        </ol>
      )}
    </Card>
  );
}
