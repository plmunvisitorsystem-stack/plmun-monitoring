/**
 * "Reports by Issue Type" - horizontal bar chart.
 * One series, so one color (accent green) and no legend; the card title
 * names what is plotted. Each bar shows its value at the tip, and a hidden
 * table gives screen readers the same numbers.
 */
import { Bar } from 'react-chartjs-2';
import { ACCENT, ACCENT_HOVER, AXIS_COLOR, GRID_COLOR, GRID_DASH, TOOLTIP_STYLE } from './chartSetup';
import { useLanguage } from '../../i18n/useLanguage';
import { ISSUE_TYPES, ISSUE_TYPE_KEYS } from '../../utils/constants';

// Small Chart.js plugin: writes each bar's value just after its tip.
const valueAtTip = {
  id: 'valueAtTip',
  afterDatasetsDraw(chart) {
    const { ctx } = chart;
    ctx.save();
    ctx.fillStyle = '#1A1A1A'; // text color, never the bar color
    ctx.font = "500 12px 'IBM Plex Mono', ui-monospace, monospace";
    ctx.textBaseline = 'middle';
    chart.getDatasetMeta(0).data.forEach((bar, index) => {
      ctx.fillText(String(chart.data.datasets[0].data[index]), bar.x + 8, bar.y);
    });
    ctx.restore();
  },
};

// title: the chart's name for screen readers (defaults to the dashboard title)
export default function IssueTypeChart({ byIssueType, title }) {
  const { t } = useLanguage();
  const chartTitle = title || t('dashboard.byIssueType');
  const labels = ISSUE_TYPES.map((type) => t(`issueType.${ISSUE_TYPE_KEYS[type]}`));
  const values = ISSUE_TYPES.map((type) => byIssueType[type]);
  const max = Math.max(...values, 1);

  const data = {
    labels,
    datasets: [
      {
        data: values,
        backgroundColor: ACCENT,
        hoverBackgroundColor: ACCENT_HOVER,
        borderRadius: 2, // slightly rounded data end...
        borderSkipped: 'start', // ...square at the baseline
        maxBarThickness: 24,
      },
    ],
  };

  const options = {
    indexAxis: 'y', // horizontal bars: long issue-type names stay readable
    responsive: true,
    maintainAspectRatio: false,
    layout: { padding: { right: 40 } }, // room for the value labels
    plugins: {
      legend: { display: false },
      tooltip: {
        ...TOOLTIP_STYLE,
        callbacks: { label: (item) => t('dashboard.reportsCount', { count: item.raw }) },
      },
    },
    scales: {
      x: {
        beginAtZero: true,
        suggestedMax: max,
        ticks: { precision: 0 },
        grid: { color: GRID_COLOR }, // 1px dashed, recessive
        border: { display: false, dash: GRID_DASH },
      },
      y: {
        grid: { display: false },
        border: { color: AXIS_COLOR },
      },
    },
  };

  const summary = labels.map((label, i) => `${label}: ${values[i]}`).join(', ');

  return (
    <>
      <div className="chart-box chart-box--bar">
        <Bar data={data} options={options} plugins={[valueAtTip]} role="img" aria-label={`${chartTitle}. ${summary}`} />
      </div>
      <table className="visually-hidden">
        <caption>{chartTitle}</caption>
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
