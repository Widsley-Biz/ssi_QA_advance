import { useEffect, useMemo, useState } from 'react';
import {
  listExams,
  getAdminExamSchedule,
  putAdminExamSchedule,
  putAdminExamTargets,
  listAdminExamSchedules,
  getAdminExamScheduleDetail,
  createAdminExamSchedule,
  updateAdminExamSchedule,
  deleteAdminExamSchedule,
  type ExamSummary,
  type ExamScheduleSummary,
  type ExamScheduleDetail,
} from '../lib/exams';
import { fetchProfiles, fetchTeams, teamIdsOf } from '../lib/data';
import type { Profile, Team } from '../types';

const DEEP_BLUE = '#03202F';
const CYAN = '#3DB7E4';
const SEA_GREEN = '#50DAB0';
const MAGENTA = '#E21776';

/**
 * datetime-local(日本時間として入力・表示する文字列) ⇄ ISO文字列(UTC) の変換。
 *
 * ブラウザの実行環境のタイムゾーンに依存すると、日本以外のタイムゾーンで
 * 開いた場合に「日本時間の何時何分で公開する」設定が狂う。
 * 常に Asia/Tokyo として解釈・表示することで、公開される内部時刻を
 * 必ず日本時間基準に揃える。
 */
function toInputValue(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  const parts = new Intl.DateTimeFormat('ja-JP', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
    hour12: false,
  }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)!.value;
  return `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}`;
}
function fromInputValue(v: string): string | null {
  if (!v) return null;
  // datetime-local の値(YYYY-MM-DDTHH:mm)は常に日本時間として扱う
  return new Date(`${v}:00+09:00`).toISOString();
}
function formatJst(iso: string): string {
  return new Date(iso).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' });
}

/** 名前・メールで絞り込んだ上で、所属チームごとにグルーピングする（対象者ピッカー共通ロジック） */
function groupMembers(profiles: Profile[], teams: Team[], query: string): [string, Profile[]][] {
  const q = query.trim().toLowerCase();
  const filtered = q
    ? profiles.filter((p) => [p.display_name, p.email].some((v) => v.toLowerCase().includes(q)))
    : profiles;
  const map = new Map<string, Profile[]>();
  for (const p of filtered) {
    const ids = teamIdsOf(p);
    const groups = ids.length > 0 ? ids.map((id) => teams.find((t) => t.id === id)?.name ?? '未所属') : ['未所属'];
    // 複数チーム所属者は、所属している全チームのグループに表示する（重複OK。選択状態は共通）
    for (const g of new Set(groups)) {
      if (!map.has(g)) map.set(g, []);
      map.get(g)!.push(p);
    }
  }
  return [...map.entries()].sort(([a], [b]) => a.localeCompare(b, 'ja'));
}

function toggleSetMember(setFn: (fn: (prev: Set<string>) => Set<string>) => void, email: string) {
  setFn((prev) => {
    const next = new Set(prev);
    if (next.has(email)) next.delete(email);
    else next.add(email);
    return next;
  });
}
function toggleSetGroup(
  setFn: (fn: (prev: Set<string>) => Set<string>) => void,
  members: Profile[],
  selectAll: boolean,
) {
  setFn((prev) => {
    const next = new Set(prev);
    for (const m of members) {
      if (selectAll) next.add(m.email);
      else next.delete(m.email);
    }
    return next;
  });
}

/** 対象者ピッカー（検索＋チームごとのチェックボックス一覧）。単一スケジュール・複数予定の両方で使う */
function MemberPicker({
  groupedMembers,
  selectedEmails,
  query,
  onQueryChange,
  onToggleMember,
  onToggleGroup,
}: {
  groupedMembers: [string, Profile[]][];
  selectedEmails: Set<string>;
  query: string;
  onQueryChange: (v: string) => void;
  onToggleMember: (email: string) => void;
  onToggleGroup: (members: Profile[], selectAll: boolean) => void;
}) {
  return (
    <>
      <input
        value={query}
        onChange={(e) => onQueryChange(e.target.value)}
        placeholder="名前・メールで検索"
        style={{ ...styles.input, width: '100%', marginBottom: 12, boxSizing: 'border-box' }}
      />
      <div style={styles.memberList}>
        {groupedMembers.length === 0 ? (
          <div style={{ color: '#999', fontSize: 13, padding: '8px 0' }}>該当するメンバーがいません</div>
        ) : (
          groupedMembers.map(([group, members]) => {
            const allSelected = members.every((m) => selectedEmails.has(m.email));
            return (
              <div key={group} style={styles.memberGroup}>
                <div style={styles.memberGroupHead}>
                  <span style={styles.memberGroupName}>{group}</span>
                  <button style={styles.groupToggleBtn} onClick={() => onToggleGroup(members, !allSelected)}>
                    {allSelected ? 'チーム全解除' : 'チーム全選択'}
                  </button>
                </div>
                {members.map((m) => (
                  <label key={m.id} style={styles.memberRow}>
                    <input
                      type="checkbox"
                      checked={selectedEmails.has(m.email)}
                      onChange={() => onToggleMember(m.email)}
                    />
                    <span style={styles.memberName}>{m.display_name}</span>
                    <span style={styles.memberEmail}>{m.email}</span>
                  </label>
                ))}
              </div>
            );
          })
        )}
      </div>
    </>
  );
}

/**
 * 管理者向け：試験の開始/終了日時・受験回数上限・対象者(email)を設定する。
 * 設問の追加・編集は対象外（今まで通りSQL運用）。
 */
export default function AdminExamSchedule() {
  const [exams, setExams] = useState<ExamSummary[]>([]);
  const [examId, setExamId] = useState('');
  const [isPublished, setIsPublished] = useState(false);
  const [opensAt, setOpensAt] = useState('');
  const [closesAt, setClosesAt] = useState('');
  const [maxAttempts, setMaxAttempts] = useState('');
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [selectedEmails, setSelectedEmails] = useState<Set<string>>(new Set());
  const [originalEmailCount, setOriginalEmailCount] = useState(0);
  const [memberQuery, setMemberQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [error, setError] = useState('');

  // 複数予定(exam_schedules)。社内認定試験は同時に複数の開催回を走らせたい
  // ことがあるため、1試験=1予定の上のセクションとは別に、複数予定を一覧・
  // 追加・編集・削除できるセクションを持つ
  const [schedules, setSchedules] = useState<ExamScheduleSummary[]>([]);
  const [schedulesLoading, setSchedulesLoading] = useState(false);
  const [scheduleFormOpen, setScheduleFormOpen] = useState(false);
  const [editingScheduleId, setEditingScheduleId] = useState<number | null>(null);
  const [scheduleLabel, setScheduleLabel] = useState('');
  const [scheduleOpensAt, setScheduleOpensAt] = useState('');
  const [scheduleClosesAt, setScheduleClosesAt] = useState('');
  const [scheduleMaxAttempts, setScheduleMaxAttempts] = useState('');
  const [scheduleSelectedEmails, setScheduleSelectedEmails] = useState<Set<string>>(new Set());
  const [scheduleMemberQuery, setScheduleMemberQuery] = useState('');
  const [scheduleSaving, setScheduleSaving] = useState(false);
  const [scheduleFormError, setScheduleFormError] = useState('');
  const [viewingScheduleId, setViewingScheduleId] = useState<number | null>(null);
  const [scheduleDetail, setScheduleDetail] = useState<ExamScheduleDetail | null>(null);
  const [scheduleDetailLoading, setScheduleDetailLoading] = useState(false);

  // このページでは社内認定試験の日程だけを扱う（学習用教材・模擬試験は対象外。
  // 一覧に混ざって見にくいという指摘のため、ここで明示的に絞り込む）
  const schedulableExams = useMemo(() => exams.filter((e) => e.category === 'certification'), [exams]);

  const loadExams = async () => {
    const e = await listExams();
    setExams(e);
    return e;
  };

  const loadSchedules = async (id: string) => {
    setSchedulesLoading(true);
    try {
      setSchedules(await listAdminExamSchedules(id));
    } catch {
      setError('予定一覧の取得に失敗しました');
    } finally {
      setSchedulesLoading(false);
    }
  };

  useEffect(() => {
    (async () => {
      try {
        const [e, p, t] = await Promise.all([loadExams(), fetchProfiles(), fetchTeams()]);
        setProfiles(p);
        setTeams(t);
        const certExams = e.filter((x) => x.category === 'certification');
        if (certExams.length > 0) setExamId(certExams[0].id);
      } catch {
        setError('試験一覧・メンバー一覧の取得に失敗しました');
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
      setScheduleFormOpen(false);
      setEditingScheduleId(null);
      setViewingScheduleId(null);
      setScheduleDetail(null);
      try {
        const detail = await getAdminExamSchedule(examId);
        setIsPublished(detail.is_published);
        setOpensAt(toInputValue(detail.opens_at));
        setClosesAt(toInputValue(detail.closes_at));
        setMaxAttempts(detail.max_attempts != null ? String(detail.max_attempts) : '');
        setSelectedEmails(new Set(detail.target_emails));
        setOriginalEmailCount(detail.target_emails.length);
      } catch {
        setError('設定の取得に失敗しました');
      } finally {
        setDetailLoading(false);
      }
      await loadSchedules(examId);
    })();
  }, [examId]);

  const groupedMembers = useMemo(() => groupMembers(profiles, teams, memberQuery), [profiles, teams, memberQuery]);
  const scheduleGroupedMembers = useMemo(
    () => groupMembers(profiles, teams, scheduleMemberQuery),
    [profiles, teams, scheduleMemberQuery],
  );

  const toggleMember = (email: string) => toggleSetMember(setSelectedEmails, email);
  const toggleGroup = (members: Profile[], selectAll: boolean) => toggleSetGroup(setSelectedEmails, members, selectAll);
  const toggleScheduleMember = (email: string) => toggleSetMember(setScheduleSelectedEmails, email);
  const toggleScheduleGroup = (members: Profile[], selectAll: boolean) =>
    toggleSetGroup(setScheduleSelectedEmails, members, selectAll);

  const handleSaveSchedule = async () => {
    if (isPublished && selectedEmails.size === 0 && !opensAt && !closesAt) {
      const ok = confirm(
        '対象者・日程のどちらも未設定のまま公開すると、この試験は全員にいつでも表示されます。よろしいですか？',
      );
      if (!ok) return;
    }
    setSaving(true);
    setFeedback('');
    setError('');
    try {
      await putAdminExamSchedule(examId, {
        is_published: isPublished,
        opens_at: fromInputValue(opensAt),
        closes_at: fromInputValue(closesAt),
        max_attempts: maxAttempts.trim() ? Number(maxAttempts) : null,
      });
      setFeedback('公開状態・日程・受験回数を保存しました');
      await loadExams();
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存に失敗しました');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveTargets = async () => {
    const emails = [...selectedEmails];

    if (emails.length === 0 && originalEmailCount > 0 && isPublished) {
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
      await loadExams();
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存に失敗しました');
    } finally {
      setSaving(false);
    }
  };

  const resetScheduleForm = () => {
    setEditingScheduleId(null);
    setScheduleLabel('');
    setScheduleOpensAt('');
    setScheduleClosesAt('');
    setScheduleMaxAttempts('');
    setScheduleSelectedEmails(new Set());
    setScheduleMemberQuery('');
    setScheduleFormError('');
  };

  const openNewScheduleForm = () => {
    resetScheduleForm();
    setViewingScheduleId(null);
    setScheduleDetail(null);
    setScheduleFormOpen(true);
  };

  const openEditScheduleForm = async (s: ExamScheduleSummary) => {
    resetScheduleForm();
    setViewingScheduleId(null);
    setScheduleDetail(null);
    setScheduleFormOpen(true);
    setEditingScheduleId(s.id);
    setScheduleLabel(s.label);
    setScheduleOpensAt(toInputValue(s.opens_at));
    setScheduleClosesAt(toInputValue(s.closes_at));
    setScheduleMaxAttempts(s.max_attempts != null ? String(s.max_attempts) : '');
    if (s.target_count > 0) {
      try {
        const detail = await getAdminExamScheduleDetail(examId, s.id);
        setScheduleSelectedEmails(new Set(detail.members.map((m) => m.email)));
      } catch {
        setScheduleFormError('対象者の取得に失敗しました');
      }
    }
  };

  const handleSaveScheduleForm = async () => {
    const emails = [...scheduleSelectedEmails];
    if (emails.length === 0) {
      const ok = confirm(
        '対象者を1人も指定しないと、この予定は全員が対象になります。よろしいですか？',
      );
      if (!ok) return;
    }
    setScheduleSaving(true);
    setScheduleFormError('');
    try {
      const body = {
        label: scheduleLabel,
        opens_at: fromInputValue(scheduleOpensAt),
        closes_at: fromInputValue(scheduleClosesAt),
        max_attempts: scheduleMaxAttempts.trim() ? Number(scheduleMaxAttempts) : null,
        emails,
      };
      if (editingScheduleId != null) await updateAdminExamSchedule(examId, editingScheduleId, body);
      else await createAdminExamSchedule(examId, body);
      setScheduleFormOpen(false);
      resetScheduleForm();
      await loadSchedules(examId);
      setFeedback('予定を保存しました');
    } catch (err) {
      setScheduleFormError(err instanceof Error ? err.message : '保存に失敗しました');
    } finally {
      setScheduleSaving(false);
    }
  };

  const handleDeleteSchedule = async (s: ExamScheduleSummary) => {
    const ok = confirm(`予定「${s.label || '(ラベル未設定)'}」を削除します。よろしいですか？`);
    if (!ok) return;
    try {
      await deleteAdminExamSchedule(examId, s.id);
      await loadSchedules(examId);
      setFeedback('予定を削除しました');
    } catch (err) {
      setError(err instanceof Error ? err.message : '削除に失敗しました');
    }
  };

  const openScheduleDetail = async (s: ExamScheduleSummary) => {
    setScheduleFormOpen(false);
    if (viewingScheduleId === s.id) {
      setViewingScheduleId(null);
      setScheduleDetail(null);
      return;
    }
    setViewingScheduleId(s.id);
    setScheduleDetail(null);
    setScheduleDetailLoading(true);
    try {
      setScheduleDetail(await getAdminExamScheduleDetail(examId, s.id));
    } catch {
      setError('予定の詳細取得に失敗しました');
    } finally {
      setScheduleDetailLoading(false);
    }
  };

  const upcomingSchedules = schedules.filter((s) => !s.is_past);
  const pastSchedules = schedules.filter((s) => s.is_past);

  if (loading) return <div style={{ padding: 24, color: '#999' }}>読み込み中...</div>;

  return (
    <div>
      <h2 style={styles.sectionTitle}>社内認定試験の公開・日程・対象者設定</h2>
      <p style={styles.hint}>
        ここは社内認定試験（学習用教材・模擬試験は含まない）だけを扱います。日時はすべて日本時間です。
        「公開」をONにしないとboard以外には一切表示されません。対象者を1人も設定していない状態で
        公開すると全員に表示されるため、正式試験は先に対象者・日程を設定してから公開してください。
        終了日時までは本人に採点結果・解説を表示しません。
      </p>

      <div style={styles.overviewWrap}>
        <table style={styles.overviewTable}>
          <thead>
            <tr>
              <th style={styles.th}>試験</th>
              <th style={styles.th}>公開</th>
              <th style={styles.th}>開始(日本時間)</th>
              <th style={styles.th}>終了(日本時間)</th>
              <th style={styles.th}>回数上限</th>
              <th style={styles.th}>対象者</th>
            </tr>
          </thead>
          <tbody>
            {schedulableExams.map((e) => (
              <tr
                key={e.id}
                onClick={() => setExamId(e.id)}
                style={{ ...styles.overviewRow, ...(e.id === examId ? styles.overviewRowActive : {}) }}
              >
                <td style={styles.td}>{e.group_name ? `${e.group_name} / ` : ''}{e.name}</td>
                <td style={styles.td}>
                  <span style={e.is_published ? styles.badgePublished : styles.badgeDraft}>
                    {e.is_published ? '公開中' : '非公開'}
                  </span>
                </td>
                <td style={styles.td}>{e.opens_at ? formatJst(e.opens_at) : '—'}</td>
                <td style={styles.td}>{e.closes_at ? formatJst(e.closes_at) : '—'}</td>
                <td style={styles.td}>{e.max_attempts ?? '無制限'}</td>
                <td style={styles.td}>{e.target_count > 0 ? `${e.target_count}名` : '全員'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {detailLoading ? (
        <div style={{ color: '#999', padding: '12px 0' }}>読み込み中...</div>
      ) : (
        <>
          <div style={styles.card}>
            <h3 style={styles.cardTitle}>単一予定（互換用・1つだけ予定する場合はこちらで十分です）</h3>
            <label style={styles.publishRow}>
              <input
                type="checkbox"
                checked={isPublished}
                onChange={(e) => setIsPublished(e.target.checked)}
              />
              <span style={isPublished ? styles.badgePublished : styles.badgeDraft}>
                {isPublished ? '公開中' : '非公開'}
              </span>
              <span style={{ fontSize: 12, color: '#888' }}>
                （非公開の間はboard以外に一切表示されません）
              </span>
            </label>
            <div style={styles.row}>
              <div style={styles.field}>
                <label style={styles.label}>開始日時（日本時間・空欄=常時公開）</label>
                <input
                  type="datetime-local"
                  value={opensAt}
                  onChange={(e) => setOpensAt(e.target.value)}
                  style={styles.input}
                />
              </div>
              <div style={styles.field}>
                <label style={styles.label}>終了日時（日本時間・空欄=常時公開・結果は提出後すぐ表示）</label>
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
              {saving ? '保存中...' : '公開状態・日程・受験回数を保存'}
            </button>
          </div>

          <div style={styles.card}>
            <h3 style={styles.cardTitle}>
              単一予定の対象者（{selectedEmails.size === 0 ? '未選択＝全員対象' : `${selectedEmails.size}名選択中`}）
            </h3>
            <MemberPicker
              groupedMembers={groupedMembers}
              selectedEmails={selectedEmails}
              query={memberQuery}
              onQueryChange={setMemberQuery}
              onToggleMember={toggleMember}
              onToggleGroup={toggleGroup}
            />
            <button style={{ ...styles.saveBtn, marginTop: 14 }} disabled={saving} onClick={handleSaveTargets}>
              {saving ? '保存中...' : '対象者を保存'}
            </button>
          </div>

          <div style={styles.card}>
            <div style={styles.scheduleHeadRow}>
              <h3 style={{ ...styles.cardTitle, margin: 0 }}>
                複数予定（同じ試験を複数グループ・複数日程で同時に走らせたい場合）
              </h3>
              <button style={styles.addScheduleBtn} onClick={openNewScheduleForm}>
                ＋ 新しい予定を追加
              </button>
            </div>
            <p style={styles.hint}>
              ここに1件でも予定を追加すると、この試験は上の「単一予定」ではなく、ここに並ぶ予定だけで
              公開状態・対象者・受験回数が決まるようになります（既存の設定は1件目の予定として自動的に
              引き継がれます）。クリックすると対象者と試験結果が見れます。
            </p>

            {schedulesLoading ? (
              <div style={{ color: '#999', padding: '8px 0' }}>読み込み中...</div>
            ) : (
              <>
                {scheduleFormOpen && (
                  <div style={styles.scheduleForm}>
                    <h4 style={styles.scheduleFormTitle}>
                      {editingScheduleId != null ? '予定を編集' : '新しい予定'}
                    </h4>
                    <div style={styles.row}>
                      <div style={styles.field}>
                        <label style={styles.label}>ラベル（管理用。例: 2026年12月 Aグループ）</label>
                        <input
                          value={scheduleLabel}
                          onChange={(e) => setScheduleLabel(e.target.value)}
                          style={styles.input}
                          placeholder="例: 2026年12月 Aグループ"
                        />
                      </div>
                    </div>
                    <div style={styles.row}>
                      <div style={styles.field}>
                        <label style={styles.label}>開始日時（日本時間・空欄=常時公開）</label>
                        <input
                          type="datetime-local"
                          value={scheduleOpensAt}
                          onChange={(e) => setScheduleOpensAt(e.target.value)}
                          style={styles.input}
                        />
                      </div>
                      <div style={styles.field}>
                        <label style={styles.label}>終了日時（日本時間・空欄=常時公開）</label>
                        <input
                          type="datetime-local"
                          value={scheduleClosesAt}
                          onChange={(e) => setScheduleClosesAt(e.target.value)}
                          style={styles.input}
                        />
                      </div>
                      <div style={styles.field}>
                        <label style={styles.label}>受験回数上限（空欄=無制限）</label>
                        <input
                          type="number"
                          min={1}
                          value={scheduleMaxAttempts}
                          onChange={(e) => setScheduleMaxAttempts(e.target.value)}
                          style={styles.input}
                          placeholder="例: 1"
                        />
                      </div>
                    </div>
                    <div style={{ marginTop: 8, marginBottom: 6, fontSize: 12.5, fontWeight: 700, color: '#666' }}>
                      対象者（{scheduleSelectedEmails.size === 0 ? '未選択＝全員対象' : `${scheduleSelectedEmails.size}名選択中`}）
                    </div>
                    <MemberPicker
                      groupedMembers={scheduleGroupedMembers}
                      selectedEmails={scheduleSelectedEmails}
                      query={scheduleMemberQuery}
                      onQueryChange={setScheduleMemberQuery}
                      onToggleMember={toggleScheduleMember}
                      onToggleGroup={toggleScheduleGroup}
                    />
                    {scheduleFormError && <div style={styles.error}>{scheduleFormError}</div>}
                    <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
                      <button style={styles.saveBtn} disabled={scheduleSaving} onClick={handleSaveScheduleForm}>
                        {scheduleSaving ? '保存中...' : 'この予定を保存'}
                      </button>
                      <button
                        style={styles.cancelBtn}
                        disabled={scheduleSaving}
                        onClick={() => {
                          setScheduleFormOpen(false);
                          resetScheduleForm();
                        }}
                      >
                        キャンセル
                      </button>
                    </div>
                  </div>
                )}

                <ScheduleList
                  title="開催中・予約中"
                  schedules={upcomingSchedules}
                  emptyText="予定はありません"
                  viewingScheduleId={viewingScheduleId}
                  scheduleDetail={scheduleDetail}
                  scheduleDetailLoading={scheduleDetailLoading}
                  onOpen={openScheduleDetail}
                  onEdit={openEditScheduleForm}
                  onDelete={handleDeleteSchedule}
                />
                <ScheduleList
                  title="終了した回（履歴）"
                  schedules={pastSchedules}
                  emptyText="終了した予定はまだありません"
                  viewingScheduleId={viewingScheduleId}
                  scheduleDetail={scheduleDetail}
                  scheduleDetailLoading={scheduleDetailLoading}
                  onOpen={openScheduleDetail}
                  onEdit={openEditScheduleForm}
                  onDelete={handleDeleteSchedule}
                />
              </>
            )}
          </div>
        </>
      )}

      {feedback && <div style={styles.feedback}>{feedback}</div>}
      {error && <div style={styles.error}>{error}</div>}
    </div>
  );
}

/** 予定(複数予定モード)の一覧。行をクリックすると対象者・結果を展開表示する */
function ScheduleList({
  title,
  schedules,
  emptyText,
  viewingScheduleId,
  scheduleDetail,
  scheduleDetailLoading,
  onOpen,
  onEdit,
  onDelete,
}: {
  title: string;
  schedules: ExamScheduleSummary[];
  emptyText: string;
  viewingScheduleId: number | null;
  scheduleDetail: ExamScheduleDetail | null;
  scheduleDetailLoading: boolean;
  onOpen: (s: ExamScheduleSummary) => void;
  onEdit: (s: ExamScheduleSummary) => void;
  onDelete: (s: ExamScheduleSummary) => void;
}) {
  return (
    <div style={{ marginTop: 16 }}>
      <div style={styles.scheduleListTitle}>{title}（{schedules.length}件）</div>
      {schedules.length === 0 ? (
        <div style={{ color: '#999', fontSize: 13, padding: '8px 0' }}>{emptyText}</div>
      ) : (
        schedules.map((s) => (
          <div key={s.id} style={styles.scheduleRowWrap}>
            <div style={styles.scheduleRow} onClick={() => onOpen(s)}>
              <div style={styles.scheduleRowMain}>
                <span style={styles.scheduleLabel}>{s.label || '(ラベル未設定)'}</span>
                <span style={styles.scheduleDates}>
                  {s.opens_at ? formatJst(s.opens_at) : '常時'} 〜 {s.closes_at ? formatJst(s.closes_at) : '常時'}
                </span>
              </div>
              <div style={styles.scheduleRowMeta}>
                <span>回数上限 {s.max_attempts ?? '無制限'}</span>
                <span>対象 {s.target_count > 0 ? `${s.target_count}名` : '全員'}</span>
                <span>受験済 {s.attempt_count}件</span>
              </div>
              <div style={styles.scheduleRowActions} onClick={(e) => e.stopPropagation()}>
                <button style={styles.groupToggleBtn} onClick={() => onEdit(s)}>編集</button>
                <button style={{ ...styles.groupToggleBtn, color: MAGENTA }} onClick={() => onDelete(s)}>削除</button>
              </div>
            </div>

            {viewingScheduleId === s.id && (
              <div style={styles.scheduleDetailWrap}>
                {scheduleDetailLoading || !scheduleDetail ? (
                  <div style={{ color: '#999', padding: '8px 0' }}>読み込み中...</div>
                ) : (
                  <table style={styles.overviewTable}>
                    <thead>
                      <tr>
                        <th style={styles.th}>メンバー</th>
                        <th style={styles.th}>受験状況</th>
                        <th style={styles.th}>得点</th>
                        <th style={styles.th}>合否</th>
                        <th style={styles.th}>提出日時</th>
                      </tr>
                    </thead>
                    <tbody>
                      {scheduleDetail.members.length === 0 ? (
                        <tr>
                          <td style={styles.td} colSpan={5}>
                            {scheduleDetail.target_count > 0 ? '対象者がいません' : 'まだ誰も受験していません'}
                          </td>
                        </tr>
                      ) : (
                        scheduleDetail.members.map((m) => (
                          <tr key={m.user_id}>
                            <td style={styles.td}>{m.display_name}</td>
                            <td style={styles.td}>
                              {m.status === 'submitted' ? '提出済み' : m.status === 'in_progress' ? '受験中' : '未受験'}
                            </td>
                            <td style={styles.td}>
                              {m.earned_points != null ? `${m.earned_points} / ${m.total_points}` : '—'}
                            </td>
                            <td style={styles.td}>
                              {m.passed == null ? '—' : (
                                <span style={m.passed ? styles.badgePublished : styles.badgeDraft}>
                                  {m.passed ? '合格' : '不合格'}
                                </span>
                              )}
                            </td>
                            <td style={styles.td}>{m.submitted_at ? formatJst(m.submitted_at) : '—'}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                )}
              </div>
            )}
          </div>
        ))
      )}
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
  saveBtn: { marginTop: 4, padding: '9px 22px', border: 'none', borderRadius: 8, background: `linear-gradient(135deg, ${SEA_GREEN}, ${CYAN})`, color: DEEP_BLUE, fontWeight: 700, fontSize: 13.5, cursor: 'pointer' },
  overviewWrap: { overflowX: 'auto', border: '1px solid #e5eef5', borderRadius: 10, marginBottom: 24 },
  overviewTable: { width: '100%', borderCollapse: 'collapse', fontSize: 13 },
  th: { textAlign: 'left', padding: '9px 12px', fontWeight: 700, color: '#8893A4', fontSize: 11.5, background: '#f5f9fb', whiteSpace: 'nowrap' },
  td: { padding: '8px 12px', color: DEEP_BLUE, whiteSpace: 'nowrap' },
  overviewRow: { cursor: 'pointer', borderTop: '1px solid #f0f0f0' },
  overviewRowActive: { background: '#EAF6FC' },
  badgePublished: { fontSize: 11, fontWeight: 700, color: '#0a7d55', background: '#D8F0E5', borderRadius: 4, padding: '2px 8px', whiteSpace: 'nowrap' },
  badgeDraft: { fontSize: 11, fontWeight: 700, color: '#888', background: '#eee', borderRadius: 4, padding: '2px 8px', whiteSpace: 'nowrap' },
  publishRow: { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14, cursor: 'pointer' },
  memberList: { maxHeight: 320, overflowY: 'auto', border: '1px solid #e5eef5', borderRadius: 8, background: '#fff' },
  memberGroup: { borderBottom: '1px solid #f0f0f0' },
  memberGroupHead: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', background: '#f5f9fb' },
  memberGroupName: { fontSize: 12.5, fontWeight: 700, color: DEEP_BLUE },
  groupToggleBtn: { fontSize: 11, color: CYAN, background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600, padding: 0 },
  memberRow: { display: 'flex', alignItems: 'center', gap: 10, padding: '7px 14px', cursor: 'pointer', fontSize: 13 },
  memberName: { color: DEEP_BLUE, fontWeight: 600 },
  memberEmail: { color: '#999', fontSize: 12 },
  feedback: { marginTop: 8, fontSize: 13, fontWeight: 600, color: '#0a7d55' },
  error: { marginTop: 8, padding: '10px 14px', borderRadius: 8, background: '#fef2f6', color: MAGENTA, fontSize: 13 },
  scheduleHeadRow: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, flexWrap: 'wrap', gap: 10 },
  addScheduleBtn: { padding: '7px 16px', border: 'none', borderRadius: 8, background: DEEP_BLUE, color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer' },
  cancelBtn: { padding: '9px 22px', borderRadius: 8, border: '1px solid #ddd', background: '#fff', color: '#666', fontWeight: 600, fontSize: 13.5, cursor: 'pointer' },
  scheduleForm: { background: '#fff', border: `1px solid ${CYAN}`, borderRadius: 10, padding: '16px 18px', marginBottom: 18 },
  scheduleFormTitle: { fontSize: 13.5, fontWeight: 700, color: DEEP_BLUE, margin: '0 0 12px' },
  scheduleListTitle: { fontSize: 12.5, fontWeight: 700, color: '#8893A4', marginBottom: 8 },
  scheduleRowWrap: { border: '1px solid #e5eef5', borderRadius: 10, marginBottom: 8, overflow: 'hidden', background: '#fff' },
  scheduleRow: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '10px 14px', cursor: 'pointer', flexWrap: 'wrap' },
  scheduleRowMain: { display: 'flex', flexDirection: 'column', gap: 2, minWidth: 180 },
  scheduleLabel: { fontSize: 13.5, fontWeight: 700, color: DEEP_BLUE },
  scheduleDates: { fontSize: 12, color: '#888' },
  scheduleRowMeta: { display: 'flex', gap: 14, fontSize: 12, color: '#666', flexWrap: 'wrap' },
  scheduleRowActions: { display: 'flex', gap: 12 },
  scheduleDetailWrap: { borderTop: '1px solid #f0f0f0', padding: '10px 14px', overflowX: 'auto' },
};
