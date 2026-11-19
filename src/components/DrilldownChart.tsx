import { useMemo, useState } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ReferenceLine, ReferenceDot, ResponsiveContainer,
} from 'recharts';
import type { DailyActivity } from '../lib/dashboard';

const CYAN = '#3DB7E4';
const DEEP_BLUE = '#03202F';
const MAGENTA = '#E21776';

type Range = 'week' | 'month' | '3month';
const RANGE_DAYS: Record<Range, number> = { week: 7, month: 30, '3month': 90 };
const RANGE_LABEL: Record<Range, string> = { week: '週間', month: '月間', '3month': '過去3ヶ月' };

/** JST基準の 'YYYY-MM-DD' を返す */
function jstDateStr(d: Date): string {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Tokyo' }).format(d);
}

function addDays(dateStr: string, delta: number): string {
  const d = new Date(`${dateStr}T00:00:00+09:00`);
  d.setDate(d.getDate() + delta);
  return jstDateStr(d);
}

interface Props {
  userId: string;
  displayName: string;
  teamLabel: string;
  activity: DailyActivity;
  onClose: () => void;
}

export default function DrilldownChart({ userId, displayName, teamLabel, activity, onClose }: Props) {
  const [range, setRange] = useState<Range>('week');

  const { chartData, markers, recordStartInView } = useMemo(() => {
    const today = jstDateStr(new Date());
    const n = RANGE_DAYS[range];
    const start = addDays(today, -(n - 1));

    const pagesByDay = new Map<string, number>();
    for (const row of activity.materialDaily) {
      if (row.user_id === userId) pagesByDay.set(row.day, row.pages);
    }

    const days: { date: string; pages: number }[] = [];
    for (let i = 0; i < n; i++) {
      const dateStr = addDays(start, i);
      days.push({ date: dateStr.slice(5), pages: pagesByDay.get(dateStr) ?? 0 });
    }

    const examMarkers = activity.examEvents
      .filter((e) => e.user_id === userId && e.day >= start && e.day <= today)
      .map((e) => ({
        date: e.day.slice(5),
        color: e.passed ? '#0a7a5a' : e.kind === 'practical' ? CYAN : '#c0185a',
        label: `${e.exam_name}${e.kind === 'practical' ? '(提出)' : e.passed ? '(合格)' : ''}`,
      }));
    const skillmapMarkers = activity.skillmapEvents
      .filter((e) => e.user_id === userId && e.day >= start && e.day <= today)
      .map((e) => ({ date: e.day.slice(5), color: MAGENTA, label: `${e.course_name}(提出)` }));

    const recordStart = activity.recordStart ? jstDateStr(new Date(activity.recordStart)) : null;
    const recordStartInView = recordStart && recordStart > start && recordStart <= today
      ? recordStart.slice(5)
      : null;

    return { chartData: days, markers: [...examMarkers, ...skillmapMarkers], recordStartInView };
  }, [activity, userId, range]);

  return (
    <div style={{
      background: '#F8FBFC', border: `1px solid ${CYAN}40`, borderRadius: 10,
      padding: '16px 18px',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, flexWrap: 'wrap', gap: 6 }}>
        <h3 style={{ margin: 0, fontSize: 13, fontWeight: 700, color: DEEP_BLUE }}>
          {displayName} の学習量推移 <span style={{ fontSize: 11, fontWeight: 500, color: '#9fb3bd' }}>({teamLabel})</span>
        </h3>
        <span
          onClick={onClose}
          style={{ cursor: 'pointer', fontSize: 11, color: '#9fb3bd', fontWeight: 700 }}
        >
          閉じる ✕
        </span>
      </div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        {(Object.keys(RANGE_DAYS) as Range[]).map((key) => (
          <span
            key={key}
            onClick={() => setRange(key)}
            style={{
              cursor: 'pointer', userSelect: 'none', fontSize: 12, fontWeight: 700,
              padding: '5px 12px', borderRadius: 999,
              background: range === key ? DEEP_BLUE : '#fff',
              color: range === key ? '#fff' : '#555',
              border: `1px solid ${range === key ? DEEP_BLUE : '#d7e2e8'}`,
            }}
          >
            {RANGE_LABEL[key]}
          </span>
        ))}
      </div>
      <ResponsiveContainer width="100%" height={180}>
        <LineChart data={chartData} margin={{ left: 4, right: 20, top: 10, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#eef3f5" />
          <XAxis dataKey="date" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
          <YAxis allowDecimals={false} tick={{ fontSize: 10 }} width={24} />
          <Tooltip formatter={(v) => [`${v}ページ`, '新しく読んだページ数']} />
          {recordStartInView && (
            <ReferenceLine x={recordStartInView} stroke={MAGENTA} strokeDasharray="3 3" label={{ value: '記録開始', fontSize: 10, fill: MAGENTA, position: 'top' }} />
          )}
          {markers.map((mk, i) => (
            <ReferenceDot key={i} x={mk.date} y={0} r={4} fill={mk.color} stroke="none" />
          ))}
          <Line type="monotone" dataKey="pages" stroke={CYAN} strokeWidth={2.5} dot={{ fill: CYAN, r: 3 }} activeDot={{ r: 5 }} />
        </LineChart>
      </ResponsiveContainer>
      <p style={{ fontSize: 11, color: '#9fb3bd', margin: '6px 0 0' }}>
        折れ線 = その日に新しく読んだ教材ページ数。丸印 = 試験の提出・合格日、スキルマップの提出日。
        {recordStartInView && ' 赤い点線より左はログ開始前のため0で表示しています。'}
      </p>
    </div>
  );
}
