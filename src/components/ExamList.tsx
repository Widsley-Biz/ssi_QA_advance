import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { listExams, listAttempts, type ExamSummary, type AttemptSummary } from '../lib/exams';

const DEEP_BLUE = '#03202F';
const CYAN = '#3DB7E4';
const SEA_GREEN = '#50DAB0';
const GRADIENT = 'linear-gradient(135deg, #50DAB0, #3DB7E4)';

export default function ExamList() {
  const navigate = useNavigate();
  const [exams, setExams] = useState<ExamSummary[]>([]);
  const [attempts, setAttempts] = useState<AttemptSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const [e, a] = await Promise.all([listExams(), listAttempts()]);
        setExams(e);
        setAttempts(a);
      } catch (err) {
        setError(err instanceof Error ? err.message : '読み込みに失敗しました');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const start = (examId: string) => {
    setStarting(examId);
    navigate(`/exams/${encodeURIComponent(examId)}/take`);
  };

  if (loading) return <div style={styles.page}>読み込み中…</div>;
  if (error) return <div style={styles.page}><div style={styles.error}>{error}</div></div>;

  const myAttempts = attempts.slice(0, 10);

  return (
    <div style={styles.page}>
      <h1 style={styles.title}>模擬試験</h1>
      <p style={styles.lead}>
        社内認定試験の予行演習です。<b>何度でも受け直せます。</b>
        提出すると採点結果と解説が表示されます。本番の試験ではありません。
      </p>

      {exams.length === 0 && <div style={styles.empty}>受験できる模擬試験がまだありません。</div>}

      <div style={styles.grid}>
        {exams.map((e) => (
          <div key={e.id} style={styles.card}>
            <div style={styles.cardHead}>
              <div style={styles.cardName}>{e.name}</div>
              {!e.is_published && <span style={styles.draft}>非公開</span>}
            </div>
            {e.description && <div style={styles.cardDesc}>{e.description}</div>}

            <div style={styles.metaRow}>
              <Meta label="問題数" value={`${e.question_count}問`} />
              <Meta label="満点" value={`${e.total_points}点`} />
              <Meta label="合格ライン" value={`${e.pass_score}点`} />
              <Meta label="制限時間" value={e.time_limit_min ? `${e.time_limit_min}分` : 'なし'} />
            </div>

            <div style={styles.myRow}>
              {e.my_attempts > 0 ? (
                <>
                  受験 <b>{e.my_attempts}</b> 回 ／ 最高得点{' '}
                  <b style={{ color: (e.my_best_score ?? 0) >= e.pass_score ? SEA_GREEN : DEEP_BLUE }}>
                    {e.my_best_score}点
                  </b>
                </>
              ) : (
                <span style={{ color: '#888' }}>まだ受験していません</span>
              )}
            </div>

            <button
              style={styles.startBtn}
              disabled={starting === e.id}
              onClick={() => start(e.id)}
            >
              {e.my_attempts > 0 ? 'もう一度受ける' : '受験する'}
            </button>
          </div>
        ))}
      </div>

      {myAttempts.length > 0 && (
        <>
          <h2 style={styles.subTitle}>受験履歴</h2>
          <div style={styles.tableWrap}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>試験</th>
                  <th style={styles.th}>提出日時</th>
                  <th style={styles.th}>得点</th>
                  <th style={styles.th}>判定</th>
                  <th style={styles.th}></th>
                </tr>
              </thead>
              <tbody>
                {myAttempts.map((a) => (
                  <tr key={a.id}>
                    <td style={styles.td}>{a.exam_name}</td>
                    <td style={styles.td}>{new Date(a.submitted_at).toLocaleString('ja-JP')}</td>
                    <td style={styles.td}>
                      {a.earned_points} / {a.total_points}
                    </td>
                    <td style={styles.td}>
                      <span style={a.passed ? styles.pass : styles.fail}>
                        {a.passed ? '合格' : '不合格'}
                      </span>
                    </td>
                    <td style={styles.td}>
                      <button style={styles.linkBtn} onClick={() => navigate(`/exams/result/${a.id}`)}>
                        結果を見る
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div style={styles.meta}>
      <div style={styles.metaLabel}>{label}</div>
      <div style={styles.metaValue}>{value}</div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: { maxWidth: 1000, margin: '0 auto', padding: '32px 20px 64px' },
  title: { fontSize: 28, fontWeight: 800, color: DEEP_BLUE, margin: 0 },
  lead: { fontSize: 15, color: '#444', lineHeight: 1.7, marginTop: 10 },
  subTitle: { fontSize: 19, fontWeight: 700, color: DEEP_BLUE, marginTop: 40, marginBottom: 12 },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 18, marginTop: 24 },
  card: { border: '1px solid #E2E8EC', borderRadius: 12, padding: '20px 22px', background: '#fff' },
  cardHead: { display: 'flex', alignItems: 'center', gap: 10 },
  cardName: { fontSize: 17, fontWeight: 700, color: DEEP_BLUE },
  draft: { fontSize: 11, fontWeight: 700, color: '#fff', background: '#999', borderRadius: 4, padding: '2px 8px' },
  cardDesc: { fontSize: 13, color: '#666', marginTop: 8, lineHeight: 1.6 },
  metaRow: { display: 'flex', gap: 16, marginTop: 16, flexWrap: 'wrap' },
  meta: { minWidth: 64 },
  metaLabel: { fontSize: 11, color: '#888' },
  metaValue: { fontSize: 15, fontWeight: 700, color: DEEP_BLUE, marginTop: 2 },
  myRow: { fontSize: 13, color: '#444', marginTop: 16, paddingTop: 12, borderTop: '1px solid #EEF2F4' },
  startBtn: {
    width: '100%', marginTop: 16, padding: '11px 0', border: 'none', borderRadius: 8,
    background: GRADIENT, color: DEEP_BLUE, fontSize: 15, fontWeight: 700, cursor: 'pointer',
  },
  tableWrap: { overflowX: 'auto' },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: 13.5 },
  th: { background: DEEP_BLUE, color: '#fff', textAlign: 'left', padding: '9px 12px', fontWeight: 700, whiteSpace: 'nowrap' },
  td: { padding: '9px 12px', borderBottom: '1px solid #E8EDF0' },
  pass: { color: '#0a7d55', fontWeight: 700 },
  fail: { color: '#888', fontWeight: 700 },
  linkBtn: { border: 'none', background: 'none', color: CYAN, fontSize: 13, fontWeight: 700, cursor: 'pointer', padding: 0 },
  empty: { marginTop: 24, padding: 24, background: '#F5F8FA', borderRadius: 10, color: '#666' },
  error: { padding: 16, background: '#FDECF3', borderLeft: '4px solid #E21776', borderRadius: 6, color: '#7a0b3c' },
};
