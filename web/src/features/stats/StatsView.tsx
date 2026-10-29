import { useState } from 'react';
import { dayKey } from '../../data/activity.ts';
import { useAppData } from '../../state/hooks.ts';
import { DayBars, Heatmap, HeatmapLegend } from './charts.tsx';
import {
  type DayStats,
  type MetricKey,
  METRICS,
  cardSummary,
  dailyStats,
  firstDay,
  heatmapWeeks,
  lastDays,
  levelScale,
  metricValue,
  streaks,
  sumOver,
} from './stats.ts';

const WEEKS = 53;

function parseDay(day: string): Date {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(y!, m! - 1, d!);
}

/** "ср, 28 окт." */
const shortDay = (day: string) =>
  parseDay(day).toLocaleDateString('ru-RU', { weekday: 'short', day: 'numeric', month: 'short' });

/** "28 октября 2026 г." */
const longDay = (day: string) =>
  parseDay(day).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });

/** Everything about one day, for the line under the charts. */
function dayDetails(s: DayStats | undefined): string {
  if (!s || metricValue(s, 'all') + s.tasksCreated === 0) return 'ничего не отмечено';
  const parts: string[] = [];
  if (s.tasksDone) parts.push(`выполнено задач: ${s.tasksDone}`);
  if (s.tasksCreated) parts.push(`создано задач: ${s.tasksCreated}`);
  if (s.pomodoroSessions) {
    parts.push(`Pomodoro: ${s.pomodoroMinutes} мин (сессий: ${s.pomodoroSessions})`);
  }
  if (s.reviews) parts.push(`повторений карточек: ${s.reviews}`);
  if (s.notesEdited) parts.push(`заметок: ${s.notesEdited}`);
  return parts.join(' · ');
}

function Tile({ value, title, sub }: { value: string; title: string; sub: string }) {
  return (
    <div className="stat-tile">
      <div className="stat-value">{value}</div>
      <div className="stat-title">{title}</div>
      <div className="stat-sub">{sub}</div>
    </div>
  );
}

/**
 * The statistics tab (phase 2.4): a summary, a year heatmap, the last week by day, streaks
 * and flashcards. Everything is computed from local data; counting started with v2.3.0.
 */
export function StatsView() {
  const { data } = useAppData();
  const [metric, setMetric] = useState<MetricKey>('all');
  const [hovered, setHovered] = useState<string | null>(null);
  // The day the tab was opened; counters change while it is open, the day rarely does.
  const [today] = useState(() => dayKey(Date.now()));

  const days = dailyStats(data);
  const week = lastDays(today, 7);
  const weeks = heatmapWeeks(today, WEEKS);
  const valueOf = (day: string) => metricValue(days.get(day), metric);
  const scale = levelScale(weeks.flat().map((d) => (d ? valueOf(d) : 0)));
  const { unit } = METRICS.find((m) => m.key === metric)!;
  const describe = (day: string) => `${shortDay(day)}: ${valueOf(day)} ${unit}`;
  const streak = streaks(days, today);
  const since = firstDay(days);
  const cards = cardSummary(data, today);
  const shown = hovered ?? today;

  const tile = (key: MetricKey, title: string, suffix = '') => (
    <Tile
      value={`${sumOver(days, week, key)}${suffix}`}
      title={title}
      sub={`сегодня: ${metricValue(days.get(today), key)}${suffix}`}
    />
  );

  return (
    <div className="stats-view">
      <section className="box" aria-labelledby="statsSummary">
        <div className="box-head">
          <span className="stripe" style={{ background: 'var(--accent)' }} />
          <h2 id="statsSummary">За 7 дней</h2>
        </div>
        <div className="stat-tiles">
          <Tile
            value={String(streak.current)}
            title="Дней подряд"
            sub={`рекорд: ${streak.longest}`}
          />
          {tile('tasksDone', 'Задач выполнено')}
          {tile('pomodoroMinutes', 'Минут Pomodoro')}
          {tile('reviews', 'Повторений карточек')}
          {tile('notesEdited', 'Заметок изменено')}
        </div>
        <p className="hint">
          {since
            ? `Данные собираются с ${longDay(since)}; всё считается на этом устройстве.`
            : 'Статистика собирается с версии 2.3.0: выполняйте задачи, работайте с Pomodoro, повторяйте карточки — данные появятся здесь.'}
        </p>
      </section>

      <section className="box" aria-labelledby="statsActivity">
        <div className="box-head">
          <span className="stripe" style={{ background: 'var(--accent)' }} />
          <h2 id="statsActivity">Активность</h2>
          <span className="spacer" />
          <select
            className="select stats-metric"
            aria-label="Показатель"
            value={metric}
            onChange={(e) => setMetric(e.target.value as MetricKey)}
          >
            {METRICS.map((m) => (
              <option key={m.key} value={m.key}>
                {m.title}
              </option>
            ))}
          </select>
        </div>

        <h3 className="chart-head">Год</h3>
        <Heatmap
          weeks={weeks}
          valueOf={valueOf}
          scale={scale}
          describe={describe}
          hovered={hovered}
          onHover={setHovered}
        />
        <HeatmapLegend />

        <h3 className="chart-head">Последние 7 дней</h3>
        <DayBars
          days={week}
          valueOf={valueOf}
          labelOf={(day) => shortDay(day).split(',')[0]!}
          describe={describe}
          hovered={hovered}
          onHover={setHovered}
        />

        <p className="day-details" aria-live="polite">
          <strong>{shortDay(shown)}</strong> — {dayDetails(days.get(shown))}
        </p>
      </section>

      <section className="box" aria-labelledby="statsCards">
        <div className="box-head">
          <span className="stripe" style={{ background: 'var(--rest)' }} />
          <h2 id="statsCards">Карточки</h2>
        </div>
        <div className="stat-tiles">
          <Tile
            value={String(cards.recent)}
            title="Повторений за 30 дней"
            sub={`всего: ${cards.total}`}
          />
          <Tile
            value={cards.recalled === null ? '—' : `${Math.round(cards.recalled * 100)}%`}
            title="Вспомнили"
            sub="ответы не «Снова», за 30 дней"
          />
          <Tile value={String(cards.items.review)} title="На повторении" sub="выученные элементы" />
          <Tile
            value={String(cards.items.learning)}
            title="На изучении"
            sub="включая переучивание"
          />
          <Tile value={String(cards.items.new)} title="Новых" sub="ещё не изучались" />
        </div>
      </section>
    </div>
  );
}
