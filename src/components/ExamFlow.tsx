import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { startExam, submitExam, type ExamSession } from '../lib/exams';

const DEEP_BLUE = '#03202F';
const CYAN = '#3DB7E4';
const SEA_GREEN = '#50DAB0';
const GRADIENT = 'linear-gradient(135deg, #50DAB0, #3DB7E4)';

/**
 * 出題画面。
 * サーバーは正解を返さないので、この画面で正誤を出すことはできない（意図どおり）。
 * 全問回答してから提出し、採点は結果画面で受け取る。
 */
export default function ExamFlow() {
  const { examId } = useParams<{ examId: string }>();
  const navigate = useNavigate();
  const [session, setSession] = useState<ExamSession | null>(null);
  const [answers, setAnswers] = useState<Record<number, string[]>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const refs = useRef<Record<number, HTMLDivElement | null>>({});

  useEffect(() => {
    if (!examId) return;
    (async () => {
      try {
        setSession(await startExam(examId));
      } catch (err) {
        setError(err instanceof Error ? err.message : '試験を開始できませんでした');
      } finally {
        setLoading(false);
      }
    })();
  }, [examId]);

  const answeredCount = useMemo(
    () => Object.values(answers).filter((v) => v.length > 0).length,
    [answers],
  );
  const unanswered = useMemo(
    () => (session?.questions ?? []).filter((q) => !(answers[q.id]?.length > 0)),
    [session, answers],
  );

  const pick = (qid: number, key: string, multiple: boolean) => {
    setAnswers((prev) => {
      const cur = prev[qid] ?? [];
      if (multiple) {
        const next = cur.includes(key) ? cur.filter((k) => k !== key) : [...cur, key];
        return { ...prev, [qid]: next };
      }
      return { ...prev, [qid]: [key] };
    });
    if (!multiple && session) {
      const idx = session.questions.findIndex((q) => q.id === qid);
      const next = session.questions[idx + 1];
      if (next) setTimeout(() => refs.current[next.id]?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 180);
    }
  };

  const doSubmit = async () => {
    if (!session) return;
    setSubmitting(true);
    try {
      const result = await submitExam(session.attempt_id, answers);
      navigate(`/exams/result/${result.attempt_id}`, { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : '提出に失敗しました');
      setSubmitting(false);
      setConfirming(false);
    }
  };

  if (loading) return <div style={styles.page}>読み込み中…</div>;
  if (error) return (
    <div style={styles.page}>
      <div style={styles.error}>{error}</div>
      <button style={styles.backBtn} onClick={() => navigate('/exams')}>模擬試験一覧へ戻る</button>
    </div>
  );
  if (!session) return null;

  const total = session.questions.length;

  return (
    <div style={styles.page}>
      <div style={styles.sticky}>
        <div style={styles.stickyInner}>
          <div style={styles.examName}>{session.exam.name}</div>
          <div style={styles.progressText}>
            回答済み <b>{answeredCount}</b> / {total}
          </div>
          <div style={styles.barOuter}>
            <div style={{ ...styles.barInner, width: `${(answeredCount / total) * 100}%` }} />
          </div>
        </div>
      </div>

      <div style={styles.notice}>
        全問に回答してから提出してください。<b>提出するまで正誤は表示されません。</b>
        提出後に、問題ごとの正解と解説が出ます。
      </div>

      {session.questions.map((q, i) => {
        const selected = answers[q.id] ?? [];
        return (
          <div key={q.id} style={styles.qCard} ref={(el) => { refs.current[q.id] = el; }}>
            <div style={styles.qHead}>
              <span style={styles.qNo}>Q{i + 1}</span>
              {q.category && <span style={styles.qCat}>{q.category}</span>}
              <span style={styles.qPts}>{q.points}点</span>
              {q.allow_multiple && <span style={styles.qMulti}>複数選択</span>}
            </div>

            <div style={styles.qBody} dangerouslySetInnerHTML={{ __html: q.question }} />

            <div style={styles.choices}>
              {Object.keys(q.choices).sort().map((key) => {
                const on = selected.includes(key);
                return (
                  <button
                    key={key}
                    onClick={() => pick(q.id, key, q.allow_multiple)}
                    style={{ ...styles.choice, ...(on ? styles.choiceOn : {}) }}
                  >
                    <span style={{ ...styles.choiceKey, ...(on ? styles.choiceKeyOn : {}) }}>
                      {key.toUpperCase()}
                    </span>
                    <span style={styles.choiceText}>{q.choices[key]}</span>
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}

      <div style={styles.submitArea}>
        {unanswered.length > 0 && (
          <div style={styles.warn}>
            未回答が <b>{unanswered.length}</b> 問あります（Q
            {unanswered.map((q) => session.questions.findIndex((x) => x.id === q.id) + 1).join(', Q')}）。
            未回答のまま提出すると0点になります。
          </div>
        )}
        <button style={styles.submitBtn} disabled={submitting} onClick={() => setConfirming(true)}>
          {submitting ? '提出中…' : '提出して採点する'}
        </button>
      </div>

      {confirming && (
        <div style={styles.overlay} onClick={() => !submitting && setConfirming(false)}>
          <div style={styles.dialog} onClick={(e) => e.stopPropagation()}>
            <div style={styles.dialogTitle}>提出しますか？</div>
            <div style={styles.dialogBody}>
              回答済み {answeredCount} / {total} 問
              {unanswered.length > 0 && <>（未回答 {unanswered.length} 問）</>}
              <br />
              提出すると採点され、やり直しはできません。
              <br />
              <span style={{ color: '#666' }}>もう一度受けたい場合は、一覧から新しく受験してください。</span>
            </div>
            <div style={styles.dialogBtns}>
              <button style={styles.cancelBtn} disabled={submitting} onClick={() => setConfirming(false)}>
                戻る
              </button>
              <button style={styles.okBtn} disabled={submitting} onClick={doSubmit}>
                {submitting ? '提出中…' : '提出する'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: { maxWidth: 860, margin: '0 auto', padding: '0 20px 80px' },
  sticky: { position: 'sticky', top: 0, zIndex: 10, background: '#fff', borderBottom: '1px solid #E4EAEE', paddingTop: 16 },
  stickyInner: { paddingBottom: 12 },
  examName: { fontSize: 17, fontWeight: 800, color: DEEP_BLUE },
  progressText: { fontSize: 13, color: '#555', marginTop: 6 },
  barOuter: { height: 6, background: '#EDF2F5', borderRadius: 999, marginTop: 8, overflow: 'hidden' },
  barInner: { height: '100%', background: GRADIENT, borderRadius: 999, transition: 'width .25s' },
  notice: { marginTop: 18, padding: '12px 16px', background: '#F2F7FA', borderLeft: `4px solid ${SEA_GREEN}`, borderRadius: '0 6px 6px 0', fontSize: 13.5, lineHeight: 1.7, color: '#333' },
  qCard: { marginTop: 22, padding: '20px 22px', border: '1px solid #E2E8EC', borderRadius: 12, background: '#fff' },
  qHead: { display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
  qNo: { fontSize: 14, fontWeight: 800, color: '#fff', background: DEEP_BLUE, borderRadius: 6, padding: '3px 10px' },
  qCat: { fontSize: 11.5, fontWeight: 700, color: DEEP_BLUE, background: '#E4F3FA', borderRadius: 4, padding: '2px 8px' },
  qPts: { fontSize: 12, color: '#777' },
  qMulti: { fontSize: 11.5, fontWeight: 700, color: '#fff', background: '#E21776', borderRadius: 4, padding: '2px 8px' },
  qBody: { marginTop: 14, fontSize: 14.5, lineHeight: 1.75, color: '#1a1a1a', overflowX: 'auto' },
  choices: { marginTop: 16, display: 'flex', flexDirection: 'column', gap: 8 },
  choice: { display: 'flex', gap: 12, alignItems: 'flex-start', textAlign: 'left', padding: '12px 14px', border: '1px solid #DDE4E9', borderRadius: 8, background: '#fff', cursor: 'pointer', fontSize: 14, lineHeight: 1.6, width: '100%' },
  choiceOn: { borderColor: CYAN, background: '#EAF6FC', boxShadow: `inset 0 0 0 1px ${CYAN}` },
  choiceKey: { flex: '0 0 auto', width: 26, height: 26, borderRadius: '50%', background: '#EEF3F6', color: '#555', fontWeight: 800, fontSize: 13, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' },
  choiceKeyOn: { background: GRADIENT, color: DEEP_BLUE },
  choiceText: { whiteSpace: 'pre-wrap', fontFamily: 'inherit' },
  submitArea: { marginTop: 32 },
  warn: { padding: '12px 16px', background: '#FFF8E6', borderLeft: '4px solid #C78A00', borderRadius: '0 6px 6px 0', fontSize: 13.5, lineHeight: 1.7, marginBottom: 14 },
  submitBtn: { width: '100%', padding: '14px 0', border: 'none', borderRadius: 10, background: GRADIENT, color: DEEP_BLUE, fontSize: 16, fontWeight: 800, cursor: 'pointer' },
  backBtn: { marginTop: 16, padding: '10px 20px', border: `1px solid ${CYAN}`, borderRadius: 8, background: '#fff', color: CYAN, fontWeight: 700, cursor: 'pointer' },
  overlay: { position: 'fixed', inset: 0, background: 'rgba(3,32,47,.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: 20 },
  dialog: { background: '#fff', borderRadius: 12, padding: '24px 26px', maxWidth: 420, width: '100%' },
  dialogTitle: { fontSize: 18, fontWeight: 800, color: DEEP_BLUE },
  dialogBody: { fontSize: 14, lineHeight: 1.8, color: '#333', marginTop: 12 },
  dialogBtns: { display: 'flex', gap: 10, marginTop: 22 },
  cancelBtn: { flex: 1, padding: '11px 0', border: '1px solid #CFD8DE', borderRadius: 8, background: '#fff', color: '#555', fontWeight: 700, cursor: 'pointer' },
  okBtn: { flex: 1, padding: '11px 0', border: 'none', borderRadius: 8, background: GRADIENT, color: DEEP_BLUE, fontWeight: 800, cursor: 'pointer' },
  error: { padding: 16, background: '#FDECF3', borderLeft: '4px solid #E21776', borderRadius: 6, color: '#7a0b3c', marginTop: 24 },
};
