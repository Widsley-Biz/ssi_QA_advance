import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  getPractical,
  submitPractical,
  deletePracticalSubmission,
  type PracticalDetail,
  type PracticalSubmission,
} from '../lib/exams';

const DEEP_BLUE = '#03202F';
const CYAN = '#3DB7E4';
const SEA_GREEN = '#50DAB0';
const MAGENTA = '#E21776';

/**
 * 実技模擬の説明ページ。
 *
 * 筆記はクリックすると出題が始まるが、実技はここを1枚挟んで
 * 練習サイトとGitHubリポジトリへ送り出す。採点はPRレビュー側で行うので、
 * この画面は「進め方の案内」と「提出した自己申告の記録」だけを担う。
 *
 * 文言とリンクはサーバー（DBのguide列）が持っている。ここに文言を書かないこと。
 * 書いてしまうと、直すたびにデプロイが必要になる。
 */
export default function ExamPractical() {
  const { examId } = useParams<{ examId: string }>();
  const navigate = useNavigate();
  const [data, setData] = useState<PracticalDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [prUrl, setPrUrl] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!examId) return;
    (async () => {
      try {
        setData(await getPractical(examId));
      } catch (err) {
        setError(err instanceof Error ? err.message : '読み込みに失敗しました');
      } finally {
        setLoading(false);
      }
    })();
  }, [examId]);

  async function onSubmit() {
    if (!examId || saving) return;
    setSaving(true);
    setFormError(null);
    try {
      const row = await submitPractical(examId, prUrl.trim(), note.trim());
      setData((d) => (d ? { ...d, my_submissions: [row, ...d.my_submissions] } : d));
      setPrUrl('');
      setNote('');
      setDone(true);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : '記録に失敗しました');
    } finally {
      setSaving(false);
    }
  }

  async function onDelete(row: PracticalSubmission) {
    try {
      await deletePracticalSubmission(row.id);
      setData((d) =>
        d ? { ...d, my_submissions: d.my_submissions.filter((s) => s.id !== row.id) } : d,
      );
    } catch (err) {
      setFormError(err instanceof Error ? err.message : '取り消しに失敗しました');
    }
  }

  if (loading) return <div style={styles.page}>読み込み中…</div>;
  if (error || !data) {
    return (
      <div style={styles.page}>
        <div style={styles.error}>{error ?? '見つかりませんでした'}</div>
        <button style={styles.backBtn} onClick={() => navigate('/exams')}>模擬試験一覧に戻る</button>
      </div>
    );
  }

  const { exam, my_submissions: mine } = data;
  const g = exam.guide ?? { intro: '' };

  return (
    <div style={styles.page}>
      <button style={styles.backLink} onClick={() => navigate('/exams')}>← 模擬試験一覧</button>

      <div style={styles.head}>
        <span style={styles.badge}>実技</span>
        <h1 style={styles.title}>{exam.name}</h1>
      </div>
      <p style={styles.lead}>{g.intro}</p>

      {/* 先に飛び先を出す。読み終わる前に触りたい人がいるので上に置く */}
      {!!g.links?.length && (
        <div style={styles.linkRow}>
          {g.links.map((l) => (
            <a
              key={l.url}
              href={l.url}
              target="_blank"
              rel="noopener noreferrer"
              style={l.primary ? styles.linkPrimary : styles.linkPlain}
            >
              <span style={styles.linkLabel}>{l.label} ↗</span>
              {l.note && <span style={styles.linkNote}>{l.note}</span>}
            </a>
          ))}
        </div>
      )}

      {!!g.what_we_see?.length && (
        <section style={styles.section}>
          <h2 style={styles.h2}>この実技で見ていること</h2>
          <ul style={styles.ul}>
            {g.what_we_see.map((t) => (
              <li key={t} style={styles.li}>{t}</li>
            ))}
          </ul>
        </section>
      )}

      {!!g.steps?.length && (
        <section style={styles.section}>
          <h2 style={styles.h2}>進め方</h2>
          {g.steps.map((s) => (
            <div key={s.no} style={styles.step}>
              <div style={styles.stepNo}>{s.no}</div>
              <div>
                <div style={styles.stepTitle}>{s.title}</div>
                <div style={styles.stepBody}>{s.body}</div>
              </div>
            </div>
          ))}
        </section>
      )}

      {!!g.contents?.length && (
        <section style={styles.section}>
          <h2 style={styles.h2}>リポジトリの中身</h2>
          <div style={styles.tableWrap}>
            <table style={styles.table}>
              <tbody>
                {g.contents.map((c) => (
                  <tr key={c.path}>
                    <td style={styles.tdPath}><code style={styles.code}>{c.path}</code></td>
                    <td style={styles.td}>{c.body}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {g.answers_policy && (
        <div style={styles.warn}>
          <b>模範解答を見るタイミング</b>
          <div style={{ marginTop: 4 }}>{g.answers_policy}</div>
        </div>
      )}

      {g.grading && (
        <div style={styles.note}>
          <b>採点について</b>
          <div style={{ marginTop: 4 }}>{g.grading}</div>
        </div>
      )}

      {g.note && <p style={styles.smallNote}>※ {g.note}</p>}

      {/* 自己申告。点数は入れない（採点はPRレビュー側） */}
      <section style={styles.section}>
        <h2 style={styles.h2}>提出したら記録しておく</h2>
        <p style={styles.formLead}>
          点数はここでは付きません。<b>講師がレビューに入りやすくなる</b>ので、
          Pull Requestを出したら記録しておいてください。何度出し直しても構いません。
        </p>
        {done && <div style={styles.okMsg}>記録しました。講師にレビューを依頼してください。</div>}
        {formError && <div style={styles.error}>{formError}</div>}
        <input
          value={prUrl}
          onChange={(e) => setPrUrl(e.target.value)}
          placeholder="Pull RequestのURL（例: https://github.com/owner/repo/pull/12）※空欄でもOK"
          style={styles.input}
        />
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="詰まったところ・レビューで見てほしいところ（任意）"
          style={styles.textarea}
          rows={3}
        />
        <button style={styles.submitBtn} onClick={onSubmit} disabled={saving}>
          {saving ? '記録中…' : 'PRを提出した'}
        </button>

        {mine.length > 0 && (
          <div style={styles.history}>
            <div style={styles.historyHead}>提出の記録</div>
            {mine.map((s) => (
              <div key={s.id} style={styles.historyRow}>
                <div style={{ minWidth: 0 }}>
                  <div style={styles.historyDate}>
                    {new Date(s.submitted_at).toLocaleString('ja-JP')}
                  </div>
                  {s.pr_url && (
                    <a href={s.pr_url} target="_blank" rel="noopener noreferrer" style={styles.prLink}>
                      {s.pr_url}
                    </a>
                  )}
                  {s.note && <div style={styles.historyNote}>{s.note}</div>}
                </div>
                <button style={styles.undoBtn} onClick={() => onDelete(s)}>取り消す</button>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

// #root に text-align:center が効いているので、この画面では明示的に左寄せにする
const styles: Record<string, React.CSSProperties> = {
  page: { maxWidth: 860, margin: '0 auto', padding: '28px 20px 72px', textAlign: 'left' },
  backLink: { border: 'none', background: 'none', color: CYAN, fontSize: 13, fontWeight: 700, cursor: 'pointer', padding: 0, marginBottom: 16 },
  backBtn: { marginTop: 16, padding: '10px 18px', border: '1px solid #D5DEE4', borderRadius: 8, background: '#fff', color: DEEP_BLUE, fontWeight: 700, cursor: 'pointer' },
  head: { display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
  badge: { fontSize: 11.5, fontWeight: 700, color: DEEP_BLUE, background: '#CAF4E7', borderRadius: 4, padding: '3px 9px' },
  title: { fontSize: 25, fontWeight: 800, color: DEEP_BLUE, margin: 0 },
  lead: { fontSize: 14.5, color: '#444', lineHeight: 1.75, marginTop: 12 },

  linkRow: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 12, margin: '22px 0 6px' },
  linkPrimary: { display: 'block', padding: '15px 18px', borderRadius: 10, textDecoration: 'none', background: `linear-gradient(135deg, ${SEA_GREEN}, ${CYAN})`, color: DEEP_BLUE },
  linkPlain: { display: 'block', padding: '15px 18px', borderRadius: 10, textDecoration: 'none', border: '1px solid #D5DEE4', background: '#fff', color: DEEP_BLUE },
  linkLabel: { display: 'block', fontSize: 15, fontWeight: 800 },
  linkNote: { display: 'block', fontSize: 12, marginTop: 4, opacity: 0.85, lineHeight: 1.5 },

  section: { marginTop: 34 },
  h2: { fontSize: 17, fontWeight: 700, color: DEEP_BLUE, margin: '0 0 10px', paddingBottom: 6, borderBottom: `2px solid ${CYAN}` },
  ul: { margin: 0, paddingLeft: 20 },
  li: { fontSize: 14, color: '#333', lineHeight: 1.8, marginBottom: 4 },

  step: { display: 'flex', gap: 13, padding: '12px 0', borderBottom: '1px solid #EEF2F4' },
  stepNo: { flex: 'none', width: 26, height: 26, borderRadius: 13, background: DEEP_BLUE, color: '#fff', fontSize: 13, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' },
  stepTitle: { fontSize: 14.5, fontWeight: 700, color: DEEP_BLUE },
  stepBody: { fontSize: 13.5, color: '#444', lineHeight: 1.7, marginTop: 3 },

  tableWrap: { overflowX: 'auto' },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: 13.5 },
  tdPath: { padding: '8px 12px 8px 0', borderBottom: '1px solid #EEF2F4', whiteSpace: 'nowrap', verticalAlign: 'top' },
  td: { padding: '8px 0', borderBottom: '1px solid #EEF2F4', color: '#444', lineHeight: 1.6 },
  code: { background: '#F2F7FA', padding: '2px 7px', borderRadius: 4, fontSize: 12.5, fontFamily: 'SFMono-Regular, Menlo, monospace' },

  warn: { marginTop: 26, padding: '13px 16px', background: '#FDF0F6', borderLeft: `4px solid ${MAGENTA}`, borderRadius: '0 8px 8px 0', fontSize: 13.5, color: '#333', lineHeight: 1.7 },
  note: { marginTop: 14, padding: '13px 16px', background: '#F2F7FA', borderLeft: `4px solid ${SEA_GREEN}`, borderRadius: '0 8px 8px 0', fontSize: 13.5, color: '#333', lineHeight: 1.7 },
  smallNote: { marginTop: 14, fontSize: 12.5, color: '#777', lineHeight: 1.7 },

  formLead: { fontSize: 13.5, color: '#444', lineHeight: 1.7, marginBottom: 12 },
  input: { width: '100%', padding: '11px 14px', fontSize: 13.5, border: '1px solid #D5DEE4', borderRadius: 8, outline: 'none', fontFamily: 'inherit', marginBottom: 10 },
  textarea: { width: '100%', padding: '11px 14px', fontSize: 13.5, border: '1px solid #D5DEE4', borderRadius: 8, outline: 'none', fontFamily: 'inherit', resize: 'vertical', marginBottom: 12 },
  submitBtn: { padding: '11px 26px', border: 'none', borderRadius: 8, background: `linear-gradient(135deg, ${SEA_GREEN}, ${CYAN})`, color: DEEP_BLUE, fontSize: 14.5, fontWeight: 700, cursor: 'pointer' },
  okMsg: { padding: '10px 14px', background: '#E6F6E6', borderRadius: 8, color: '#0a7d55', fontSize: 13.5, fontWeight: 700, marginBottom: 12 },
  error: { padding: '12px 15px', background: '#FDECF3', borderLeft: `4px solid ${MAGENTA}`, borderRadius: 6, color: '#7a0b3c', fontSize: 13.5, marginBottom: 12 },

  history: { marginTop: 24, border: '1px solid #E2E8EC', borderRadius: 10, overflow: 'hidden' },
  historyHead: { padding: '10px 16px', background: '#F5F9FB', fontSize: 13, fontWeight: 700, color: DEEP_BLUE },
  historyRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, padding: '11px 16px', borderTop: '1px solid #EEF2F4' },
  historyDate: { fontSize: 12.5, color: '#666', fontVariantNumeric: 'tabular-nums' },
  prLink: { display: 'block', fontSize: 13, color: CYAN, wordBreak: 'break-all', marginTop: 2 },
  historyNote: { fontSize: 13, color: '#444', marginTop: 4, lineHeight: 1.6 },
  undoBtn: { flex: 'none', border: 'none', background: 'none', color: '#999', fontSize: 12.5, cursor: 'pointer', padding: 0 },
};
