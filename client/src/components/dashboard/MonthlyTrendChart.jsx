/**
 * "Monthly Trend" - line chart of reports per month.
 *   byMonth: [{ month: '2026-01', count: 2 }, ...]
 * One series: accent green, a 2px line with a 5% fill, 8px dots with a white ring, no legend
 * (the card title names it). Hovering anywhere over a month shows its count.
 * A hidden table gives screen readers the same numbers.
 */
import { Line } from 'react-chartjs-2';
import { ACCENT, AXIS_COLOR, GRID_COLOR, GRID_DASH, TOOLTIP_STYLE } from './chartSetup';
import { useLanguage } from '../../i18n/useLanguage';

const LOCALES = { en: 'en-PH', tl: 'fil-PH' };

export default function MonthlyTrendChart({ byMonth, title }) {
  const { t, language } = useLanguage();

  // "2026-10" -> "Oct 2026" / "Okt 2026"
  const monthFormat = new Intl.DateTimeFormat(LOCALES[language] || 'en-PH', { month: 'short', year: 'numeric' });
  const labels = byMonth.map(({ month }) => {
    const [year, monthNumber] = month.split('-').map(Number);
    return monthFormat.format(new Date(year, monthNumber - 1, 1));
  });
  const values = byMonth.map(({ count }) => count);

  const data = {
    labels,
    datasets: [
      {
        data: values,
        borderColor: ACCENT,
        borderWidth: 2,
        fill: 'origin', // very light (5%) area under the line
        backgroundColor: 'rgba(21, 128, 61, 0.05)',
        borderJoinStyle: 'round',
        borderCapStyle: 'round',
        tension: 0, // straight lines: no invented curves between months
        pointRadius: 4, // 8px dots
        pointHoverRadius: 6,
        pointBackgroundColor: ACCENT,
        pointBorderColor: '#FFFFFF', // 2px white ring
        pointBorderWidth: 2,
        pointHitRadius: 14, // easy to hover
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false }, // hover anywhere in a month's column
    plugins: {
      legend: { display: false },
      tooltip: {
        ...TOOLTIP_STYLE,
        callbacks: { label: (item) => t('dashboard.reportsCount', { count: item.raw }) },
      },
    },
    scales: {
      x: { grid: { display: false }, border: { color: AXIS_COLOR } },
      y: {
        beginAtZero: true,
        ticks: { precision: 0 },
        grid: { color: GRID_COLOR },
        border: { display: false, dash: GRID_DASH },
      },
    },
  };

  const summary = labels.map((label, i) => `${label}: ${values[i]}`).join(', ');

  return (
    <>
      <div className="chart-box chart-box--line">
        <Line data={data} options={options} role="img" aria-label={`${title}. ${summary}`} />
      </div>
      <table className="visually-hidden">
        <caption>{title}</caption>
        <tbody>
          {labels.map((label, i) => (
            <tr key={label}>
              <th scope="row">{label}</th>
              <td>{values[i]}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
