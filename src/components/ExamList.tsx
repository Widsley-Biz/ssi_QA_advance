import { useEffect, useMemo, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  listExams,
  listAttempts,
  getMyMaterialProgress,
  type ExamSummary,
  type AttemptSummary,
  type MaterialProgress,
} from '../lib/exams';

const DEEP_BLUE = '#03202F';
const CYAN = '#3DB7E4';
const GRADIENT = 'linear-gradient(135deg, #50DAB0, #3DB7E4)';

/**
 * 模擬試験の一覧。ジャンル → 試験 の2階層。
 *   模擬試験 → Playwright社内試験 → セットA〜D
 * 試験が増えても探せるように、名前・説明・ジャンルを対象とした検索を付けている。
 */
export default function ExamList() {
  const navigate = useNavigate();
  const [exams, setExams] = useState<ExamSummary[]>([]);
  const [attempts, setAttempts] = useState<AttemptSummary[]>([]);
  const [materialProgress, setMaterialProgress] = useState<MaterialProgress[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [closedGroups, setClosedGroups] = useState<Set<string>>(new Set());

  useEffect(() => {
    (async () => {
      try {
        const [e, a, mp] = await Promise.all([listExams(), listAttempts(), getMyMaterialProgress()]);
        setExams(e);
        setAttempts(a);
        setMaterialProgress(mp);
      } catch (err) {
        setError(err instanceof Error ? err.message : '読み込みに失敗しました');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  /** 教材1件ぶんの進捗%（未閲覧=0）。id/pagesが無い教材はnull(=進捗管理の対象外) */
  function materialPercent(examId: string, materialId: string | undefined, pages: number | undefined) {
    if (!materialId || !pages) return null;
    const mine = materialProgress.find((p) => p.exam_id === examId && p.material_id === materialId);
    return Math.round(((mine?.viewed_pages.length ?? 0) / pages) * 100);
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return exams;
    return exams.filter((e) =>
      [e.name, e.description, e.group_name].some((v) => (v ?? '').toLowerCase().includes(q)),
    );
  }, [exams, query]);

  /** ジャンルごとにまとめる。group_name が空のものは「その他」 */
  const groups = useMemo(() => {
    const map = new Map<string, ExamSummary[]>();
    for (const e of filtered) {
      const g = e.group_name?.trim() || 'その他';
      if (!map.has(g)) map.set(g, []);
      map.get(g)!.push(e);
    }
    return [...map.entries()];
  }, [filtered]);

  // 既定は開いた状態。見出しクリックで閉じられる。検索中は常に開く
  const searching = query.trim().length > 0;
  const isOpen = (g: string) => searching || !closedGroups.has(g);
  const toggle = (g: string) =>
    setClosedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(g)) next.delete(g);
      else next.add(g);
      return next;
    });

  if (loading) return <div style={styles.page}>読み込み中…</div>;
  if (error) return <div style={styles.page}><div style={styles.error}>{error}</div></div>;

  return (
    <div style={styles.page}>
      <h1 style={styles.title}>模擬試験</h1>
      <p style={styles.lead}>
        社内認定試験の予行演習です。<b>何度でも受け直せます。</b>
        提出すると採点結果と解説が表示されます。本番の試験ではありません。
      </p>

      <div style={styles.searchRow}>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="試験名・ジャンルで検索（例: Playwright、セットA）"
          style={styles.search}
        />
        {searching && (
          <button style={styles.clearBtn} onClick={() => setQuery('')}>クリア</button>
        )}
      </div>

      {searching && (
        <div style={styles.hitCount}>
          {filtered.length === 0 ? '該当する試験がありません' : `${filtered.length}件`}
        </div>
      )}

      {groups.length === 0 && !searching && (
        <div style={styles.empty}>受験できる模擬試験がまだありません。</div>
      )}

      {groups.map(([group, items]) => {
        const open = isOpen(group);
        const totalAttempts = items.reduce((s, e) => s + Number(e.my_attempts ?? 0), 0);
        return (
          <div key={group} style={styles.group}>
            <button
              style={styles.groupHead}
              onClick={() => !searching && toggle(group)}
            >
              <span style={styles.caret}>{open ? '▾' : '▸'}</span>
              <span style={styles.groupName}>{group}</span>
              <span style={styles.groupMeta}>
                {items.length}種
                {totalAttempts > 0 && <> ・ 受験 {totalAttempts}回</>}
              </span>
            </button>

            {open && (
              <div style={styles.grid}>
                {items.map((e) => {
                  // 実技はここで採点しない。問題数・満点・合格ラインを出すと
                  // すべて0になって誤解を生むので、カードの中身から分岐させる
                  const practical = e.kind === 'practical';
                  const materialOnly = e.kind === 'material';
                  const isFormal = Boolean(e.opens_at || e.closes_at || e.max_attempts);
                  const now = new Date();
                  const notYetOpen = e.opens_at ? now < new Date(e.opens_at) : false;
                  const closed = e.closes_at ? now > new Date(e.closes_at) : false;
                  const attemptsLeft = e.max_attempts != null ? e.max_attempts - Number(e.my_attempts ?? 0) : null;
                  const limitReached = attemptsLeft != null && attemptsLeft <= 0;
                  const disabled = !practical && (notYetOpen || closed || limitReached);
                  return (
                    <div key={e.id} style={styles.card}>
                      <div style={styles.cardHead}>
                        <div style={styles.cardName}>{e.name}</div>
                        {isFormal && <span style={styles.formal}>正式試験</span>}
                        {practical && <span style={styles.practical}>実技</span>}
                        {materialOnly && <span style={styles.practical}>教材</span>}
                        {!e.is_published && <span style={styles.draft}>非公開</span>}
                      </div>

                      {isFormal && (
                        <div style={styles.scheduleRow}>
                          {e.opens_at && <>開始 {new Date(e.opens_at).toLocaleString('ja-JP')} ／ </>}
                          {e.closes_at && <>終了 {new Date(e.closes_at).toLocaleString('ja-JP')} ／ </>}
                          {attemptsLeft != null && <>残り受験回数 {Math.max(attemptsLeft, 0)}回</>}
                        </div>
                      )}

                      {practical ? (
                        <div style={styles.practicalDesc}>{e.description}</div>
                      ) : materialOnly ? (
                        e.description && <div style={styles.practicalDesc}>{e.description}</div>
                      ) : (
                        <div style={styles.metaRow}>
                          <Meta label="問題数" value={`${e.question_count}問`} />
                          <Meta label="満点" value={`${e.total_points}点`} />
                          <Meta label="合格ライン" value={`${e.pass_score}点`} />
                          <Meta label="制限時間" value={e.time_limit_min ? `${e.time_limit_min}分` : 'なし'} />
                        </div>
                      )}

                      {!practical && e.materials && e.materials.length > 0 && (
                        <div style={styles.materialsRow}>
                          教材：
                          {e.materials.map((m, i) => {
                            if (!m.url) {
                              // 準備中（録画がまだ無い等）: リンクにせずそのまま表示
                              return (
                                <span key={i} style={styles.materialComingSoon}>
                                  {m.label}
                                </span>
                              );
                            }
                            const percent = materialPercent(e.id, m.id, m.pages);
                            if (percent == null) {
                              // id/pagesが無い教材は従来通りの外部リンクのまま(フォールバック)
                              return (
                                <a
                                  key={i}
                                  href={m.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  style={styles.materialLink}
                                >
                                  {m.label}
                                </a>
                              );
                            }
                            return (
                              <Link
                                key={i}
                                to={`/exams/${encodeURIComponent(e.id)}/materials/${encodeURIComponent(m.id!)}`}
                                style={styles.materialLink}
                              >
                                {m.label}
                                <span style={styles.materialPercent}>（{percent}%）</span>
                              </Link>
                            );
                          })}
                        </div>
                      )}

                      {!materialOnly && (
                        <div style={styles.myRow}>
                          {practical ? (
                            Number(e.my_practical_count) > 0 ? (
                              <>
                                提出 <b>{Number(e.my_practical_count)}</b> 回
                                {e.my_practical_at && (
                                  <> ／ 最終 {new Date(e.my_practical_at).toLocaleDateString('ja-JP')}</>
                                )}
                              </>
                            ) : (
                              <span style={{ color: '#888' }}>まだ提出していません</span>
                            )
                          ) : e.my_attempts > 0 ? (
                            <>
                              受験 <b>{Number(e.my_attempts)}</b> 回 ／ 最高得点{' '}
                              <b style={{ color: Number(e.my_best_score ?? 0) >= Number(e.pass_score) ? '#0a7d55' : DEEP_BLUE }}>
                                {Number(e.my_best_score)}点
                              </b>
                            </>
                          ) : (
                            <span style={{ color: '#888' }}>まだ受験していません</span>
                          )}
                        </div>
                      )}

                      {!materialOnly && (
                        <button
                          style={{
                            ...(practical ? styles.guideBtn : styles.startBtn),
                            ...(disabled ? styles.btnDisabled : {}),
                          }}
                          disabled={disabled}
                          onClick={() =>
                            navigate(
                              practical
                                ? `/exams/${encodeURIComponent(e.id)}/practical`
                                : `/exams/${encodeURIComponent(e.id)}/take`,
                            )
                          }
                        >
                          {practical
                            ? '進め方を見る'
                            : notYetOpen
                              ? 'まだ開始していません'
                              : closed
                                ? '受付終了'
                                : limitReached
                                  ? '受験回数の上限です'
                                  : e.my_attempts > 0
                                    ? 'もう一度受ける'
                                    : '受験する'}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}

      {attempts.length > 0 && (
        <>
          <h2 style={styles.subTitle}>受験履歴</h2>
          <div style={styles.tableWrap}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>試験</th>
                  <th style={styles.th}>回答者</th>
                  <th style={styles.th}>提出日時</th>
                  <th style={styles.th}>得点</th>
                  <th style={styles.th}>判定</th>
                  <th style={styles.th}></th>
                </tr>
              </thead>
              <tbody>
                {attempts.slice(0, 20).map((a) => (
                  <tr key={a.id}>
                    <td style={styles.td}>{a.exam_name}</td>
                    <td style={styles.td}>{a.display_name}</td>
                    <td style={styles.td}>{new Date(a.submitted_at).toLocaleString('ja-JP')}</td>
                    {a.pending_reveal ? (
                      <>
                        <td style={styles.td} colSpan={2}>
                          <span style={{ color: '#888' }}>提出済み（結果は試験終了後に表示）</span>
                        </td>
                      </>
                    ) : (
                      <>
                        <td style={styles.td}>{a.earned_points} / {a.total_points}</td>
                        <td style={styles.td}>
                          <span style={a.passed ? styles.pass : styles.fail}>
                            {a.passed ? '合格' : '不合格'}
                          </span>
                        </td>
                      </>
                    )}
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
  // #root に text-align:center が効いているので、この画面では明示的に左寄せにする
  page: { maxWidth: 1000, margin: '0 auto', padding: '32px 20px 64px', textAlign: 'left' },
  title: { fontSize: 28, fontWeight: 800, color: DEEP_BLUE, margin: 0 },
  lead: { fontSize: 15, color: '#444', lineHeight: 1.7, marginTop: 10 },
  searchRow: { display: 'flex', gap: 8, marginTop: 22 },
  search: { flex: 1, padding: '11px 14px', fontSize: 14, border: '1px solid #D5DEE4', borderRadius: 8, outline: 'none', fontFamily: 'inherit' },
  clearBtn: { padding: '0 16px', border: '1px solid #D5DEE4', borderRadius: 8, background: '#fff', color: '#555', fontWeight: 700, cursor: 'pointer' },
  hitCount: { fontSize: 13, color: '#666', marginTop: 8 },
  group: { marginTop: 22, border: '1px solid #E2E8EC', borderRadius: 12, overflow: 'hidden' },
  groupHead: { display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '14px 18px', border: 'none', background: '#F5F9FB', cursor: 'pointer', textAlign: 'left' },
  caret: { color: CYAN, fontSize: 14, width: 14 },
  groupName: { fontSize: 16, fontWeight: 800, color: DEEP_BLUE },
  groupMeta: { fontSize: 12.5, color: '#777', marginLeft: 'auto' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14, padding: 16 },
  card: { border: '1px solid #E5EBEF', borderRadius: 10, padding: '16px 18px', background: '#fff' },
  cardHead: { display: 'flex', alignItems: 'center', gap: 10 },
  cardName: { fontSize: 15.5, fontWeight: 700, color: DEEP_BLUE },
  draft: { fontSize: 11, fontWeight: 700, color: '#fff', background: '#999', borderRadius: 4, padding: '2px 8px' },
  practical: { fontSize: 11, fontWeight: 700, color: DEEP_BLUE, background: '#CAF4E7', borderRadius: 4, padding: '2px 8px' },
  formal: { fontSize: 11, fontWeight: 700, color: '#fff', background: '#E21776', borderRadius: 4, padding: '2px 8px' },
  scheduleRow: { fontSize: 11.5, color: '#666', marginTop: 10, lineHeight: 1.6 },
  practicalDesc: { fontSize: 12.5, color: '#444', lineHeight: 1.6, marginTop: 12 },
  guideBtn: { width: '100%', marginTop: 14, padding: '10px 0', border: `1px solid ${CYAN}`, borderRadius: 8, background: '#fff', color: DEEP_BLUE, fontSize: 14.5, fontWeight: 700, cursor: 'pointer' },
  metaRow: { display: 'flex', gap: 14, marginTop: 14, flexWrap: 'wrap' },
  materialsRow: { fontSize: 12.5, color: '#555', marginTop: 10, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' },
  materialLink: { color: CYAN, fontWeight: 700, textDecoration: 'none' },
  materialPercent: { color: '#888', fontWeight: 700, marginLeft: 2 },
  materialComingSoon: { color: '#999', fontWeight: 700, fontStyle: 'italic' },
  meta: { minWidth: 58 },
  metaLabel: { fontSize: 11, color: '#888' },
  metaValue: { fontSize: 14.5, fontWeight: 700, color: DEEP_BLUE, marginTop: 2 },
  myRow: { fontSize: 12.5, color: '#444', marginTop: 14, paddingTop: 10, borderTop: '1px solid #EEF2F4' },
  startBtn: { width: '100%', marginTop: 14, padding: '10px 0', border: 'none', borderRadius: 8, background: GRADIENT, color: DEEP_BLUE, fontSize: 14.5, fontWeight: 700, cursor: 'pointer' },
  btnDisabled: { opacity: 0.5, cursor: 'not-allowed' },
  subTitle: { fontSize: 19, fontWeight: 700, color: DEEP_BLUE, marginTop: 40, marginBottom: 12 },
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
