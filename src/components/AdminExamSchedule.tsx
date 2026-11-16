import { useEffect, useMemo, useState } from 'react';
import {
  listExams,
  getAdminExamSchedule,
  putAdminExamSchedule,
  putAdminExamTargets,
  type ExamSummary,
} from '../lib/exams';
import { fetchProfiles, fetchTeams, teamIdsOf } from '../lib/data';
import type { Profile, Team } from '../types';

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

  useEffect(() => {
    (async () => {
      try {
        const [e, p, t] = await Promise.all([listExams(), fetchProfiles(), fetchTeams()]);
        setExams(e);
        setProfiles(p);
        setTeams(t);
        if (e.length > 0) setExamId(e[0].id);
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
      try {
        const detail = await getAdminExamSchedule(examId);
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
    })();
  }, [examId]);

  const groupedMembers = useMemo(() => {
    const q = memberQuery.trim().toLowerCase();
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
  }, [profiles, teams, memberQuery]);

  const toggleMember = (email: string) => {
    setSelectedEmails((prev) => {
      const next = new Set(prev);
      if (next.has(email)) next.delete(email);
      else next.add(email);
      return next;
    });
  };

  const toggleGroup = (members: Profile[], selectAll: boolean) => {
    setSelectedEmails((prev) => {
      const next = new Set(prev);
      for (const m of members) {
        if (selectAll) next.add(m.email);
        else next.delete(m.email);
      }
      return next;
    });
  };

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
    const emails = [...selectedEmails];

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
            <h3 style={styles.cardTitle}>
              対象者（{selectedEmails.size === 0 ? '未選択＝全員対象' : `${selectedEmails.size}名選択中`}）
            </h3>
            <input
              value={memberQuery}
              onChange={(e) => setMemberQuery(e.target.value)}
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
                        <button
                          style={styles.groupToggleBtn}
                          onClick={() => toggleGroup(members, !allSelected)}
                        >
                          {allSelected ? 'チーム全解除' : 'チーム全選択'}
                        </button>
                      </div>
                      {members.map((m) => (
                        <label key={m.id} style={styles.memberRow}>
                          <input
                            type="checkbox"
                            checked={selectedEmails.has(m.email)}
                            onChange={() => toggleMember(m.email)}
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
            <button style={{ ...styles.saveBtn, marginTop: 14 }} disabled={saving} onClick={handleSaveTargets}>
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
  saveBtn: { marginTop: 4, padding: '9px 22px', border: 'none', borderRadius: 8, background: `linear-gradient(135deg, ${SEA_GREEN}, ${CYAN})`, color: DEEP_BLUE, fontWeight: 700, fontSize: 13.5, cursor: 'pointer' },
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
};
