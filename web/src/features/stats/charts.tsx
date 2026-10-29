import { useEffect, useRef } from 'react';
import { levelOf, weekdayOf } from './stats.ts';

const CELL = 11;
const STEP = 13; // cell + a 2px gap
const LEFT = 26;
const TOP = 16;
const WEEKDAY_LABELS: [number, string][] = [
  [0, 'Пн'],
  [2, 'Ср'],
  [4, 'Пт'],
];

function monthLabel(day: string): string {
  const [y, m] = day.split('-').map(Number);
  return new Date(y!, m! - 1, 1).toLocaleDateString('ru-RU', { month: 'short' }).replace('.', '');
}

/**
 * A year of days as a calendar heatmap: one column per week, Monday on top. One hue, light to
 * dark (levels 0–4 in CSS), so the order is visible without telling colors apart.
 */
export function Heatmap({
  weeks,
  valueOf,
  scale,
  describe,
  hovered,
  onHover,
}: {
  weeks: (string | null)[][];
  valueOf: (day: string) => number;
  scale: number[];
  /** Tooltip text of a day. */
  describe: (day: string) => string;
  hovered: string | null;
  onHover: (day: string | null) => void;
}) {
  const scroller = useRef<HTMLDivElement>(null);
  // The latest weeks are the interesting ones: on a narrow screen, start scrolled to them.
  useEffect(() => {
    const el = scroller.current;
    if (el) el.scrollLeft = el.scrollWidth;
  }, []);

  const width = LEFT + weeks.length * STEP;
  const height = TOP + 7 * STEP;
  // A month is named over its first week; names closer than three weeks would overlap.
  const months: [number, string][] = [];
  weeks.forEach((week, w) => {
    const first = week[0];
    const prev = weeks[w - 1]?.[0];
    if (!first || (prev && prev.slice(0, 7) === first.slice(0, 7))) return;
    const last = months[months.length - 1];
    if (last && w - last[0] < 3) months.pop();
    if (w < weeks.length - 2) months.push([w, monthLabel(first)]);
  });
  return (
    <div className="heatmap-scroll" ref={scroller} onMouseLeave={() => onHover(null)}>
      <svg
        className="heatmap"
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        aria-label="Активность по дням за год"
      >
        {months.map(([w, label]) => (
          <text key={`m${w}`} className="chart-label" x={LEFT + w * STEP} y={10}>
            {label}
          </text>
        ))}
        {WEEKDAY_LABELS.map(([row, label]) => (
          <text key={label} className="chart-label" x={0} y={TOP + row * STEP + CELL - 1}>
            {label}
          </text>
        ))}
        {weeks.map((week, w) =>
          week.map((day) =>
            day === null ? null : (
              <rect
                key={day}
                data-day={day}
                className={`hm-cell hm-l${levelOf(valueOf(day), scale)}${hovered === day ? ' hovered' : ''}`}
                x={LEFT + w * STEP}
                y={TOP + weekdayOf(day) * STEP}
                width={CELL}
                height={CELL}
                rx={2}
                onMouseEnter={() => onHover(day)}
              >
                <title>{describe(day)}</title>
              </rect>
            ),
          ),
        )}
      </svg>
    </div>
  );
}

/** «Меньше ▢▢▢▢▢ Больше» */
export function HeatmapLegend() {
  return (
    <div className="heatmap-legend" aria-hidden="true">
      <span>меньше</span>
      {[0, 1, 2, 3, 4].map((l) => (
        <svg key={l} width={CELL} height={CELL}>
          <rect className={`hm-cell hm-l${l}`} width={CELL} height={CELL} rx={2} />
        </svg>
      ))}
      <span>больше</span>
    </div>
  );
}

const BAR_SLOT = 44;
const BAR = 22;
const PLOT = 96;
const BAR_TOP = 18;

/** A bar with a 4px rounded top, anchored to the baseline. */
function barPath(x: number, base: number, h: number): string {
  const r = Math.min(4, h, BAR / 2);
  const top = base - h;
  return `M${x},${base}V${top + r}Q${x},${top} ${x + r},${top}H${x + BAR - r}Q${x + BAR},${top} ${x + BAR},${top + r}V${base}Z`;
}

/** The last days as bars; the value is written over today's bar and the hovered one. */
export function DayBars({
  days,
  valueOf,
  labelOf,
  describe,
  hovered,
  onHover,
}: {
  days: string[];
  valueOf: (day: string) => number;
  labelOf: (day: string) => string;
  describe: (day: string) => string;
  hovered: string | null;
  onHover: (day: string | null) => void;
}) {
  const max = Math.max(1, ...days.map(valueOf));
  const width = days.length * BAR_SLOT;
  const base = BAR_TOP + PLOT;
  const height = base + 20;
  const today = days[days.length - 1];
  return (
    <svg
      className="day-bars"
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      aria-label="Активность за последние дни"
      onMouseLeave={() => onHover(null)}
    >
      <line className="chart-axis" x1={0} x2={width} y1={base + 0.5} y2={base + 0.5} />
      {days.map((day, i) => {
        const value = valueOf(day);
        const h = (value / max) * PLOT;
        const x = i * BAR_SLOT + (BAR_SLOT - BAR) / 2;
        const labelled = day === today || day === hovered;
        return (
          <g key={day} onMouseEnter={() => onHover(day)}>
            {/* The hit target is the whole column, not just the bar. */}
            <rect className="bar-hit" x={i * BAR_SLOT} y={0} width={BAR_SLOT} height={base}>
              <title>{describe(day)}</title>
            </rect>
            {h > 0 && (
              <path className={`bar${day === hovered ? ' hovered' : ''}`} d={barPath(x, base, h)} />
            )}
            {labelled && (
              <text className="chart-value" x={x + BAR / 2} y={base - h - 5} textAnchor="middle">
                {value}
              </text>
            )}
            <text
              className={`chart-label${day === today ? ' today' : ''}`}
              x={x + BAR / 2}
              y={base + 15}
              textAnchor="middle"
            >
              {labelOf(day)}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
