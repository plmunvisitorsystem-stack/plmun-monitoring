/**
 * Chart.js setup (run once). We register only the parts our charts use,
 * and set the default font and colors to match the staff design
 * (the charts appear only on LGU and response team pages).
 */
import {
  ArcElement,
  BarElement,
  CategoryScale,
  Chart,
  Filler,
  LinearScale,
  LineElement,
  PointElement,
  Tooltip,
} from 'chart.js';

Chart.register(ArcElement, BarElement, CategoryScale, Filler, LinearScale, LineElement, PointElement, Tooltip);

Chart.defaults.font.family = "'IBM Plex Sans', system-ui, sans-serif";
Chart.defaults.font.size = 12;
Chart.defaults.color = '#5F665F'; // axis labels and ticks

// Grid lines: 1px dashed, very light.
export const GRID_COLOR = '#E5EAE5';
export const GRID_DASH = [4, 4];
export const AXIS_COLOR = '#D4DDD4';

// Single-series charts use the accent green.
export const ACCENT = '#15803D';
export const ACCENT_HOVER = '#166534';

// Shared tooltip look: white box with a thin border, 4px corners.
export const TOOLTIP_STYLE = {
  backgroundColor: '#FFFFFF',
  borderColor: '#D4DDD4',
  borderWidth: 1,
  titleColor: '#1A1A1A',
  bodyColor: '#1A1A1A',
  titleFont: { size: 12, weight: '600' },
  bodyFont: { size: 12 },
  padding: 8,
  cornerRadius: 4,
  displayColors: false,
};

// Exact status colors from the design rules.
export const STATUS_COLORS = {
  Submitted: '#6B7280',
  'Under Review': '#2F6FA3',
  'In Progress': '#C77700',
  Resolved: '#2E7D32',
};
