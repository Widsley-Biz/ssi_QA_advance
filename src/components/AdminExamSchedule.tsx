import { useEffect, useState } from 'react';
import {
  listExams,
  getAdminExamSchedule,
  putAdminExamSchedule,
  putAdminExamTargets,
  type ExamSummary,
} from '../lib/exams';

const DEEP_BLUE = '#03202F';
const CYAN = '#3DB7E4';
const SEA_GREEN = '#50DAB0';
const MAGENTA = '#E21776';

/** datetime-local(ローカル時刻の文字列) ⇄ ISO文字列(UTC) の変換 */
function toInputValue(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function fromInputValue(v: string): string | null {
  if (!v) return null;
  return new Date(v).toISOString();
}

/**
 * 管理者向け：試験の開始/終了日時・受験回数上限・対象者(email)を設定する。
 * 設問の追加・編集は対象外（今まで通りSQL運用）。
 */
export default function AdminExamSchedule() {
  const [exams, setExams] = useState<ExamSummary[]>([]);
  const [examId, setExamId] = useState('');
  const [opensAt, setOpensAt] = useState('');
  const [closesAt, setClosesAt] = useState('');
  const [maxAttempts, setMaxAttempts] = useState('');
  const [emailsText, setEmailsText] = useState('');
  const [originalEmailCount, setOriginalEmailCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const e = await listExams();
        setExams(e);
        if (e.length > 0) setExamId(e[0].id);
      } catch {
        setError('試験一覧の取得に失敗しました');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (!examId) return;
    (async () => {
      setDetailLoading(true);
      setFeedback('');
      setError('');
      try {
        const detail = await getAdminExamSchedule(examId);
        setOpensAt(toInputValue(detail.opens_at));
        setClosesAt(toInputValue(detail.closes_at));
        setMaxAttempts(detail.max_attempts != null ? String(detail.max_attempts) : '');
        setEmailsText(detail.target_emails.join('\n'));
        setOriginalEmailCount(detail.target_emails.length);
      } catch {
        setError('設定の取得に失敗しました');
      } finally {
        setDetailLoading(false);
      }
    })();
  }, [examId]);

  const handleSaveSchedule = async () => {
    setSaving(true);
    setFeedback('');
    setError('');
    try {
      await putAdminExamSchedule(examId, {
        opens_at: fromInputValue(opensAt),
        closes_at: fromInputValue(closesAt),
        max_attempts: maxAttempts.trim() ? Number(maxAttempts) : null,
      });
      setFeedback('日程・受験回数を保存しました');
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存に失敗しました');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveTargets = async () => {
    const emails = emailsText
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean);

    if (emails.length === 0 && originalEmailCount > 0) {
      const ok = confirm(
        '対象者を1人も登録しない状態で保存すると、この試験は「全員公開」に戻ります。よろしいですか？',
      );
      if (!ok) return;
    }

    setSaving(true);
    setFeedback('');
    setError('');
    try {
      const res = await putAdminExamTargets(examId, emails);
      setOriginalEmailCount(res.emails.length);
      setFeedback(`対象者を保存しました（${res.emails.length}名）`);
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存に失敗しました');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div style={{ padding: 24, color: '#999' }}>読み込み中...</div>;

  return (
    <div>
      <h2 style={styles.sectionTitle}>試験の日程・対象者設定</h2>
      <p style={styles.hint}>
        開始/終了日時と受験回数上限を設定すると「正式試験」になります。終了日時までは本人に採点結果・解説を表示しません。
        空欄に戻せば、既存の自習試験と同じ（常時公開・無制限）に戻ります。
      </p>

      <div style={styles.field}>
        <label style={styles.label}>試験</label>
        <select value={examId} onChange={(e) => setExamId(e.target.value)} style={styles.select}>
          {exams.map((e) => (
            <option key={e.id} value={e.id}>
              {e.group_name ? `${e.group_name} / ` : ''}{e.name}
            </option>
          ))}
        </select>
      </div>

      {detailLoading ? (
        <div style={{ color: '#999', padding: '12px 0' }}>読み込み中...</div>
      ) : (
        <>
          <div style={styles.card}>
            <h3 style={styles.cardTitle}>日程・受験回数</h3>
            <div style={styles.row}>
              <div style={styles.field}>
                <label style={styles.label}>開始日時（空欄=常時公開）</label>
                <input
                  type="datetime-local"
                  value={opensAt}
                  onChange={(e) => setOpensAt(e.target.value)}
                  style={styles.input}
                />
              </div>
              <div style={styles.field}>
                <label style={styles.label}>終了日時（空欄=常時公開・結果は提出後すぐ表示）</label>
                <input
                  type="datetime-local"
                  value={closesAt}
                  onChange={(e) => setClosesAt(e.target.value)}
                  style={styles.input}
                />
              </div>
              <div style={styles.field}>
                <label style={styles.label}>受験回数上限（空欄=無制限）</label>
                <input
                  type="number"
                  min={1}
                  value={maxAttempts}
                  onChange={(e) => setMaxAttempts(e.target.value)}
                  style={styles.input}
                  placeholder="例: 1"
                />
              </div>
            </div>
            <button style={styles.saveBtn} disabled={saving} onClick={handleSaveSchedule}>
              {saving ? '保存中...' : '日程・受験回数を保存'}
            </button>
          </div>

          <div style={styles.card}>
            <h3 style={styles.cardTitle}>対象者（@widsley.com のメールを1行ずつ）</h3>
            <textarea
              value={emailsText}
              onChange={(e) => setEmailsText(e.target.value)}
              style={styles.textarea}
              placeholder={'空欄=全員対象\nalice@widsley.com\nbob@widsley.com'}
            />
            <button style={styles.saveBtn} disabled={saving} onClick={handleSaveTargets}>
              {saving ? '保存中...' : '対象者を保存'}
            </button>
          </div>
        </>
      )}

      {feedback && <div style={styles.feedback}>{feedback}</div>}
      {error && <div style={styles.error}>{error}</div>}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  sectionTitle: { fontSize: 18, fontWeight: 700, color: DEEP_BLUE, margin: '0 0 8px' },
  hint: { fontSize: 13, color: '#888', marginBottom: 20, lineHeight: 1.6 },
  card: { background: '#f8fafc', borderRadius: 12, padding: '18px 20px', marginBottom: 20, border: '1px solid #e5eef5' },
  cardTitle: { fontSize: 14.5, fontWeight: 700, color: DEEP_BLUE, margin: '0 0 14px' },
  row: { display: 'flex', gap: 14, flexWrap: 'wrap', marginBottom: 14 },
  field: { display: 'flex', flexDirection: 'column', gap: 6, flex: '1 1 220px', marginBottom: 14 },
  label: { fontSize: 12, fontWeight: 600, color: '#666' },
  select: { padding: '9px 12px', borderRadius: 8, border: '1px solid #ddd', fontSize: 14, background: '#fff' },
  input: { padding: '9px 12px', borderRadius: 8, border: '1px solid #ddd', fontSize: 14 },
  textarea: { width: '100%', minHeight: 120, padding: '10px 12px', borderRadius: 8, border: '1px solid #ddd', fontSize: 13.5, fontFamily: 'inherit', resize: 'vertical', boxSizing: 'border-box' },
  saveBtn: { marginTop: 4, padding: '9px 22px', border: 'none', borderRadius: 8, background: `linear-gradient(135deg, ${SEA_GREEN}, ${CYAN})`, color: DEEP_BLUE, fontWeight: 700, fontSize: 13.5, cursor: 'pointer' },
  feedback: { marginTop: 8, fontSize: 13, fontWeight: 600, color: '#0a7d55' },
  error: { marginTop: 8, padding: '10px 14px', borderRadius: 8, background: '#fef2f6', color: MAGENTA, fontSize: 13 },
};
