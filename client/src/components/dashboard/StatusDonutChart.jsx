/**
 * "Reports by Status" - donut chart with the exact status colors and the
 * total in the center. The legend beside it always shows each status word
 * and its count, so nobody has to tell the colors apart.
 */
import { Doughnut } from 'react-chartjs-2';
import { STATUS_COLORS, TOOLTIP_STYLE } from './chartSetup';
import { useLanguage } from '../../i18n/useLanguage';
import { STATUSES, STATUS_KEYS } from '../../utils/constants';

export default function StatusDonutChart({ total, byStatus }) {
  const { t } = useLanguage();
  const labels = STATUSES.map((status) => t(`status.${STATUS_KEYS[status]}`));
  const values = STATUSES.map((status) => byStatus[status]);
  const isEmpty = total === 0;

  const data = {
    labels,
    datasets: [
      {
        // With no reports, draw a plain gray ring instead of nothing.
        data: isEmpty ? [1] : values,
        backgroundColor: isEmpty ? ['#E5EAE5'] : STATUSES.map((status) => STATUS_COLORS[status]),
        borderColor: '#FFFFFF', // 2px white gap between segments
        borderWidth: 2,
        hoverOffset: 4,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: '68%',
    plugins: {
      legend: { display: false }, // our own legend is beside the chart
      tooltip: isEmpty
        ? { enabled: false }
        : { ...TOOLTIP_STYLE, callbacks: { label: (item) => t('dashboard.reportsCount', { count: item.raw }) } },
    },
  };

  const summary = labels.map((label, i) => `${label}: ${values[i]}`).join(', ');

  return (
    <div className="donut">
      <div className="donut__chart">
        <Doughnut data={data} options={options} role="img" aria-label={`${t('dashboard.byStatus')}. ${summary}`} />
        {/* Total in the center (decorative copy; the number is also on the cards) */}
        <div className="donut__center" aria-hidden="true">
          <span className="donut__total">{total}</span>
          <span className="donut__total-label">{t('dashboard.total')}</span>
        </div>
      </div>

      <ul className="donut__legend">
        {STATUSES.map((status, i) => (
          <li key={status}>
            <span className="donut__swatch" style={{ background: STATUS_COLORS[status] }} />
            <span className="donut__legend-label">{labels[i]}</span>
            <span className="donut__legend-value">{values[i]}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
