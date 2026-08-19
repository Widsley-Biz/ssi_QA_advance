import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { getAttemptResult, type ExamResult as Result } from '../lib/exams';

const DEEP_BLUE = '#03202F';
const CYAN = '#3DB7E4';
const SEA_GREEN = '#50DAB0';
const MAGENTA = '#E21776';
const GRADIENT = 'linear-gradient(135deg, #50DAB0, #3DB7E4)';

/** 採点結果。ここで初めて正解と解説が表示される */
export default function ExamResult() {
  const { attemptId } = useParams<{ attemptId: string }>();
  const navigate = useNavigate();
  const [result, setResult] = useState<Result | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openAll, setOpenAll] = useState(false);

  useEffect(() => {
    if (!attemptId) return;
    (async () => {
      try {
        setResult(await getAttemptResult(Number(attemptId)));
      } catch (err) {
        setError(err instanceof Error ? err.message : '結果を取得できませんでした');
      } finally {
        setLoading(false);
      }
    })();
  }, [attemptId]);

  if (loading) return <div style={styles.page}>読み込み中…</div>;
  if (error) return (
    <div style={styles.page}>
      <div style={styles.error}>{error}</div>
      <button style={styles.backBtn} onClick={() => navigate('/exams')}>模擬試験一覧へ戻る</button>
    </div>
  );
  if (!result) return null;

  const pct = result.total_points ? Math.round((result.earned_points / result.total_points) * 100) : 0;
  const correctCount = result.results.filter((r) => r.is_correct).length;

  return (
    <div style={styles.page}>
      <div style={{ ...styles.hero, background: result.passed ? GRADIENT : '#EEF2F5' }}>
        <div style={styles.examName}>{result.exam.name}</div>
        <div style={{ ...styles.verdict, color: result.passed ? DEEP_BLUE : '#666' }}>
          {result.passed ? '合格' : '不合格'}
        </div>
        <div style={styles.score}>
          <b style={{ fontSize: 40 }}>{result.earned_points}</b>
          <span style={{ fontSize: 20, color: result.passed ? DEEP_BLUE : '#777' }}> / {result.total_points} 点（{pct}%）</span>
        </div>
        <div style={styles.heroMeta}>
          合格ライン {result.exam.pass_score}点 ／ 正答 {correctCount} / {result.results.length} 問
        </div>
      </div>

      <div style={styles.actions}>
        <button style={styles.retryBtn} onClick={() => navigate(`/exams/${encodeURIComponent(result.exam.id)}/take`)}>
          もう一度受ける
        </button>
        <button style={styles.listBtn} onClick={() => navigate('/exams')}>模擬試験一覧</button>
        <button style={styles.toggleBtn} onClick={() => setOpenAll((v) => !v)}>
          {openAll ? '解説をすべて閉じる' : '解説をすべて開く'}
        </button>
      </div>

      <h2 style={styles.subTitle}>問題ごとの結果</h2>

      {result.results.map((r, i) => (
        <div key={r.question_id} style={{ ...styles.qCard, borderLeft: `5px solid ${r.is_correct ? SEA_GREEN : MAGENTA}` }}>
          <div style={styles.qHead}>
            <span style={styles.qNo}>Q{i + 1}</span>
            {r.category && <span style={styles.qCat}>{r.category}</span>}
            <span style={{ ...styles.mark, color: r.is_correct ? '#0a7d55' : MAGENTA }}>
              {r.is_correct ? '正解' : '不正解'}
            </span>
            <span style={styles.pts}>{r.earned_points} / {r.points}点</span>
          </div>

          <div style={styles.qBody} dangerouslySetInnerHTML={{ __html: r.question }} />

          <div style={styles.choices}>
            {Object.keys(r.choices).sort().map((key) => {
              const chosen = r.selected_keys.includes(key);
              const correct = r.correct_keys.includes(key);
              const bg = correct ? '#EAF7F1' : chosen ? '#FDECF3' : '#fff';
              const bd = correct ? SEA_GREEN : chosen ? MAGENTA : '#E1E7EB';
              return (
                <div key={key} style={{ ...styles.choice, background: bg, borderColor: bd }}>
                  <span style={styles.choiceKey}>{key.toUpperCase()}</span>
                  <span style={styles.choiceText}>{r.choices[key]}</span>
                  <span style={styles.tags}>
                    {correct && <span style={styles.tagOk}>正解</span>}
                    {chosen && <span style={styles.tagMine}>あなたの回答</span>}
                  </span>
                </div>
              );
            })}
          </div>

          {r.selected_keys.length === 0 && <div style={styles.noAnswer}>未回答でした</div>}

          {r.explanation && (
            <details open={openAll} style={styles.details}>
              <summary style={styles.summary}>解説を見る</summary>
              <div style={styles.explanation} dangerouslySetInnerHTML={{ __html: r.explanation }} />
            </details>
          )}
        </div>
      ))}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: { maxWidth: 860, margin: '0 auto', padding: '28px 20px 80px' },
  hero: { borderRadius: 14, padding: '26px 28px', textAlign: 'center' },
  examName: { fontSize: 14, fontWeight: 700, color: DEEP_BLUE, opacity: .8 },
  verdict: { fontSize: 26, fontWeight: 800, marginTop: 6 },
  score: { marginTop: 6, color: DEEP_BLUE },
  heroMeta: { fontSize: 13, color: DEEP_BLUE, opacity: .75, marginTop: 8 },
  actions: { display: 'flex', gap: 10, marginTop: 18, flexWrap: 'wrap' },
  retryBtn: { padding: '10px 20px', border: 'none', borderRadius: 8, background: GRADIENT, color: DEEP_BLUE, fontWeight: 800, cursor: 'pointer' },
  listBtn: { padding: '10px 20px', border: `1px solid ${CYAN}`, borderRadius: 8, background: '#fff', color: CYAN, fontWeight: 700, cursor: 'pointer' },
  toggleBtn: { padding: '10px 20px', border: '1px solid #CFD8DE', borderRadius: 8, background: '#fff', color: '#555', fontWeight: 700, cursor: 'pointer', marginLeft: 'auto' },
  subTitle: { fontSize: 19, fontWeight: 700, color: DEEP_BLUE, marginTop: 34, marginBottom: 4 },
  qCard: { marginTop: 18, padding: '18px 20px', border: '1px solid #E2E8EC', borderRadius: 10, background: '#fff' },
  qHead: { display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
  qNo: { fontSize: 13.5, fontWeight: 800, color: '#fff', background: DEEP_BLUE, borderRadius: 6, padding: '3px 10px' },
  qCat: { fontSize: 11.5, fontWeight: 700, color: DEEP_BLUE, background: '#E4F3FA', borderRadius: 4, padding: '2px 8px' },
  mark: { fontSize: 13.5, fontWeight: 800 },
  pts: { fontSize: 12, color: '#777', marginLeft: 'auto' },
  qBody: { textAlign: 'left', marginTop: 12, fontSize: 14.5, lineHeight: 1.75, color: '#1a1a1a', overflowX: 'auto' },
  choices: { marginTop: 14, display: 'flex', flexDirection: 'column', gap: 7 },
  choice: { display: 'flex', gap: 11, alignItems: 'flex-start', padding: '10px 12px', border: '1px solid', borderRadius: 8, fontSize: 13.5, lineHeight: 1.6 },
  choiceKey: { flex: '0 0 auto', width: 24, height: 24, borderRadius: '50%', background: '#EEF3F6', color: '#555', fontWeight: 800, fontSize: 12.5, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' },
  choiceText: { textAlign: 'left', whiteSpace: 'pre-wrap', flex: 1 },
  tags: { display: 'flex', gap: 6, flex: '0 0 auto' },
  tagOk: { fontSize: 11, fontWeight: 700, color: '#0a7d55', background: '#D8F0E5', borderRadius: 4, padding: '2px 7px', whiteSpace: 'nowrap' },
  tagMine: { fontSize: 11, fontWeight: 700, color: MAGENTA, background: '#FBD9E8', borderRadius: 4, padding: '2px 7px', whiteSpace: 'nowrap' },
  noAnswer: { marginTop: 10, fontSize: 13, color: MAGENTA, fontWeight: 700 },
  details: { marginTop: 14, borderTop: '1px solid #EEF2F4', paddingTop: 10 },
  summary: { cursor: 'pointer', fontSize: 13.5, fontWeight: 700, color: CYAN },
  explanation: { textAlign: 'left', marginTop: 10, fontSize: 13.5, lineHeight: 1.8, color: '#333', background: '#F7FAFC', padding: '12px 14px', borderRadius: 8 },
  backBtn: { marginTop: 16, padding: '10px 20px', border: `1px solid ${CYAN}`, borderRadius: 8, background: '#fff', color: CYAN, fontWeight: 700, cursor: 'pointer' },
  error: { padding: 16, background: '#FDECF3', borderLeft: '4px solid #E21776', borderRadius: 6, color: '#7a0b3c' },
};
