import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import {
  listExams,
  listAttempts,
  getMyMaterialProgress,
  getExamRetakeState,
  type ExamSummary,
  type ExamCategory,
  type AttemptSummary,
  type MaterialProgress,
} from '../lib/exams';

const DEEP_BLUE = '#03202F';
const CYAN = '#3DB7E4';
const GRADIENT = 'linear-gradient(135deg, #50DAB0, #3DB7E4)';

type Tab = ExamCategory;
const TABS: Tab[] = ['learning', 'mock', 'certification'];

const TAB_LABEL: Record<Tab, string> = {
  learning: '学習',
  mock: '模擬試験',
  certification: '社内認定試験',
};

const TAB_TITLE: Record<Tab, string> = {
  learning: '学習教材',
  mock: '模擬試験',
  certification: '社内認定試験',
};

const TAB_LEAD: Record<Tab, string> = {
  learning: '動画・スライドで学ぶ教材です。閲覧したページは自動で記録され、何度でも見返せます。',
  mock: '社内認定試験の予行演習です。何度でも受け直せます。提出すると採点結果と解説が表示されます。本番の試験ではありません。',
  certification: 'ここは本番の社内認定試験です。受験期間・回数に制限がある場合があります。',
};

const TAB_EMPTY: Record<Tab, string> = {
  learning: '学習できる教材がまだありません。',
  mock: '受験できる模擬試験がまだありません。',
  certification: '実施中の社内認定試験はありません。',
};

/** categoryが未設定(NULL)の過去データ向けフォールバック */
function effectiveCategory(e: ExamSummary): Tab {
  if (e.category) return e.category;
  if (e.kind === 'material') return 'learning';
  const isFormal = Boolean(e.opens_at || e.closes_at || e.max_attempts);
  return isFormal ? 'certification' : 'mock';
}

/**
 * 模擬試験・学習教材・社内認定試験の一覧。タブ(学習/模擬/社内認定試験) → ジャンル → 試験 の3階層。
 *   模擬試験タブ → Playwright社内試験 → セットA〜D
 * 試験が増えても探せるように、名前・説明・ジャンルを対象とした検索を付けている。
 * 検索中はタブを横断して全件から探す。
 */
export default function ExamList() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [exams, setExams] = useState<ExamSummary[]>([]);
  const [attempts, setAttempts] = useState<AttemptSummary[]>([]);
  const [materialProgress, setMaterialProgress] = useState<MaterialProgress[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [closedGroups, setClosedGroups] = useState<Set<string>>(new Set());

  const tabParam = searchParams.get('tab');
  const activeTab: Tab = TABS.includes(tabParam as Tab) ? (tabParam as Tab) : 'learning';
  const setActiveTab = (t: Tab) => setSearchParams((prev) => {
    const next = new URLSearchParams(prev);
    next.set('tab', t);
    return next;
  }, { replace: true });

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

  const examById = useMemo(() => new Map(exams.map((e) => [e.id, e])), [exams]);

  // 受験履歴はタブのcategoryに属する試験の分だけに絞る（JSTQB FLの確認テスト等、
  // learningカテゴリの筆記がここに混ざって「模擬試験」「社内認定試験」タブに出ないように）
  const attemptsForTab = useMemo(
    () =>
      attempts.filter((a) => {
        const exam = examById.get(a.exam_id);
        return exam ? effectiveCategory(exam) === activeTab : false;
      }),
    [attempts, examById, activeTab],
  );

  /** 学習タブ専用: 教材(スライド等)の閲覧履歴。閲覧済みのものだけ、最終閲覧が新しい順 */
  const materialHistory = useMemo(() => {
    const rows: { key: string; examId: string; materialId: string; label: string; percent: number; updatedAt: string }[] = [];
    for (const mp of materialProgress) {
      const exam = examById.get(mp.exam_id);
      const material = exam?.materials?.find((m) => m.id === mp.material_id);
      if (!exam || !material?.pages || mp.viewed_pages.length === 0) continue;
      rows.push({
        key: `${mp.exam_id}:${mp.material_id}`,
        examId: mp.exam_id,
        materialId: mp.material_id,
        label: `${exam.name}｜${material.label}`,
        percent: Math.round((mp.viewed_pages.length / material.pages) * 100),
        updatedAt: mp.updated_at,
      });
    }
    return rows.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  }, [materialProgress, examById]);

  const tabCounts = useMemo(() => {
    const counts: Record<Tab, number> = { learning: 0, mock: 0, certification: 0 };
    for (const e of exams) counts[effectiveCategory(e)]++;
    return counts;
  }, [exams]);

  const searching = query.trim().length > 0;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return exams;
    return exams.filter((e) =>
      [e.name, e.description, e.group_name].some((v) => (v ?? '').toLowerCase().includes(q)),
    );
  }, [exams, query]);

  // 検索中はタブを無視して全件から探す。検索していないときだけタブで絞る
  const visible = useMemo(
    () => (searching ? filtered : filtered.filter((e) => effectiveCategory(e) === activeTab)),
    [filtered, searching, activeTab],
  );

  /** ジャンルごとにまとめる。group_name が空のものは「その他」 */
  const groups = useMemo(() => {
    const map = new Map<string, ExamSummary[]>();
    for (const e of visible) {
      const g = e.group_name?.trim() || 'その他';
      if (!map.has(g)) map.set(g, []);
      map.get(g)!.push(e);
    }
    return [...map.entries()];
  }, [visible]);

  // 既定は開いた状態。見出しクリックで閉じられる。検索中は常に開く
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
      <h1 style={styles.title}>{searching ? '検索結果' : TAB_TITLE[activeTab]}</h1>
      <p style={styles.lead}>{searching ? `全タブから「${query}」を含むものを探しています。` : TAB_LEAD[activeTab]}</p>

      {!searching && (
        <div style={styles.tabRow}>
          {TABS.map((t) => (
            <button
              key={t}
              onClick={() => setActiveTab(t)}
              style={{ ...styles.tabBtn, ...(t === activeTab ? styles.tabBtnActive : {}) }}
            >
              {TAB_LABEL[t]}
              <span style={styles.tabCount}>{tabCounts[t]}</span>
            </button>
          ))}
        </div>
      )}

      <div style={styles.searchRow}>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="名前・ジャンルで検索（例: Playwright、セットA、HTML基礎）"
          style={styles.search}
        />
        {searching && (
          <button style={styles.clearBtn} onClick={() => setQuery('')}>クリア</button>
        )}
      </div>

      {searching && (
        <div style={styles.hitCount}>
          {filtered.length === 0 ? '該当するものがありません' : `${filtered.length}件`}
        </div>
      )}

      {groups.length === 0 && !searching && (
        <div style={styles.empty}>{TAB_EMPTY[activeTab]}</div>
      )}

      {groups.map(([group, items]) => {
        const open = isOpen(group);
        const totalAttempts = items.reduce((s, e) => s + Number(e.my_attempts ?? 0), 0);
        const allMaterial = items.every((e) => e.kind === 'material');
        return (
          <div key={group} style={styles.group}>
            <button
              style={styles.groupHead}
              onClick={() => !searching && toggle(group)}
            >
              <span style={styles.caret}>{open ? '▾' : '▸'}</span>
              <span style={styles.groupName}>{group}</span>
              <span style={styles.groupMeta}>
                {allMaterial ? `${items.length}件` : `${items.length}種`}
                {!allMaterial && totalAttempts > 0 && <> ・ 受験 {totalAttempts}回</>}
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
                  const { notYetOpen, closed, limitReached, attemptsLeft, disabled } = getExamRetakeState(e);
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
                                  ? '受験済み'
                                  : e.my_attempts > 0
                                    ? 'もう一度受ける'
                                    : '受験する'}
                        </button>
                      )}

                      {/* 教材(material)は受験ボタンを持たないが、guide(jsonb)があれば
                          案内ページ（はじめにガイド・後日演習課題の案内等）へのボタンを出す */}
                      {materialOnly && e.has_guide && (
                        <button
                          style={styles.guideBtn}
                          onClick={() => navigate(`/exams/${encodeURIComponent(e.id)}/guide`)}
                        >
                          {e.guide_button_label ?? 'はじめにを読む'}
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

      {activeTab === 'learning' ? (
        (materialHistory.length > 0 || attemptsForTab.length > 0) && (
          <>
            <h2 style={styles.subTitle}>学習履歴</h2>

            {materialHistory.length > 0 && (
              <div style={styles.historyBlock}>
                <h3 style={styles.h3}>教材の閲覧</h3>
                <div style={styles.tableWrap}>
                  <table style={styles.table}>
                    <thead>
                      <tr>
                        <th style={styles.th}>教材</th>
                        <th style={styles.th}>進捗</th>
                        <th style={styles.th}>最終閲覧</th>
                        <th style={styles.th}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {materialHistory.map((r) => (
                        <tr key={r.key}>
                          <td style={styles.td}>{r.label}</td>
                          <td style={styles.td}>{r.percent}%</td>
                          <td style={styles.td}>{new Date(r.updatedAt).toLocaleString('ja-JP')}</td>
                          <td style={styles.td}>
                            <Link
                              style={styles.linkBtn}
                              to={`/exams/${encodeURIComponent(r.examId)}/materials/${encodeURIComponent(r.materialId)}`}
                            >
                              続きを見る
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {attemptsForTab.length > 0 && (
              <div style={styles.historyBlock}>
                <h3 style={styles.h3}>確認テストの受験履歴</h3>
                <AttemptsTable rows={attemptsForTab} onShowResult={(id) => navigate(`/exams/result/${id}`)} />
              </div>
            )}
          </>
        )
      ) : (
        attemptsForTab.length > 0 && (
          <>
            <h2 style={styles.subTitle}>受験履歴</h2>
            <AttemptsTable rows={attemptsForTab} onShowResult={(id) => navigate(`/exams/result/${id}`)} />
          </>
        )
      )}
    </div>
  );
}

function AttemptsTable({ rows, onShowResult }: { rows: AttemptSummary[]; onShowResult: (id: number) => void }) {
  return (
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
          {rows.slice(0, 20).map((a) => (
            <tr key={a.id}>
              <td style={styles.td}>{a.exam_name}</td>
              <td style={styles.td}>{a.display_name}</td>
              <td style={styles.td}>{new Date(a.submitted_at).toLocaleString('ja-JP')}</td>
              {a.pending_reveal ? (
                <td style={styles.td} colSpan={2}>
                  <span style={{ color: '#888' }}>提出済み（結果は試験終了後に表示）</span>
                </td>
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
                <button style={styles.linkBtn} onClick={() => onShowResult(a.id)}>
                  結果を見る
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
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
  tabRow: { display: 'flex', gap: 8, marginTop: 20, borderBottom: '1px solid #E2E8EC' },
  tabBtn: { display: 'flex', alignItems: 'center', gap: 6, padding: '10px 16px', border: 'none', background: 'none', color: '#777', fontSize: 14.5, fontWeight: 700, cursor: 'pointer', borderBottom: '3px solid transparent', marginBottom: -1 },
  tabBtnActive: { color: DEEP_BLUE, borderBottom: `3px solid ${CYAN}` },
  tabCount: { fontSize: 11.5, fontWeight: 700, color: '#888', background: '#F0F4F6', borderRadius: 10, padding: '1px 7px' },
  searchRow: { display: 'flex', gap: 8, marginTop: 18 },
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
  cardName: { fontSize: 15.5, fontWeight: 700, color: DEEP_BLUE, flex: 1, minWidth: 0 },
  draft: { fontSize: 11, fontWeight: 700, color: '#fff', background: '#999', borderRadius: 4, padding: '2px 8px', whiteSpace: 'nowrap', flexShrink: 0 },
  practical: { fontSize: 11, fontWeight: 700, color: DEEP_BLUE, background: '#CAF4E7', borderRadius: 4, padding: '2px 8px', whiteSpace: 'nowrap', flexShrink: 0 },
  formal: { fontSize: 11, fontWeight: 700, color: '#fff', background: '#E21776', borderRadius: 4, padding: '2px 8px', whiteSpace: 'nowrap', flexShrink: 0 },
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
  btnDisabled: { background: '#D8DEE3', color: '#8A94A0', cursor: 'not-allowed' },
  subTitle: { fontSize: 19, fontWeight: 700, color: DEEP_BLUE, marginTop: 40, marginBottom: 12 },
  historyBlock: { marginTop: 18 },
  h3: { fontSize: 14.5, fontWeight: 700, color: '#555', margin: '0 0 8px' },
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
