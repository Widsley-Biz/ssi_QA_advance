import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  getExamReport,
  listExams,
  getExamMaterialProgress,
  type ExamReportCell,
  type ExamSummary,
  type AdminMaterialProgressRow,
} from '../lib/exams';

const DEEP_BLUE = '#03202F';
const MAGENTA = '#E21776';

/**
 * 管理者向け：メンバー×試験のマトリクス。
 * LeaderView/BoardViewのsticky header・sticky氏名列と同じCSSパターンを使う。
 */
export default function AdminExamReport() {
  const navigate = useNavigate();
  const [cells, setCells] = useState<ExamReportCell[]>([]);
  const [examsWithMaterials, setExamsWithMaterials] = useState<ExamSummary[]>([]);
  const [selectedExamId, setSelectedExamId] = useState('');
  const [materialRows, setMaterialRows] = useState<AdminMaterialProgressRow[]>([]);
  const [materialLoading, setMaterialLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const [report, exams] = await Promise.all([getExamReport(), listExams()]);
        setCells(report);
        const withMaterials = exams.filter((e) => e.materials && e.materials.length > 0);
        setExamsWithMaterials(withMaterials);
        if (withMaterials.length > 0) setSelectedExamId(withMaterials[0].id);
      } catch (err) {
        setError(err instanceof Error ? err.message : '読み込みに失敗しました');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (!selectedExamId) return;
    (async () => {
      setMaterialLoading(true);
      try {
        setMaterialRows(await getExamMaterialProgress(selectedExamId));
      } catch (err) {
        setError(err instanceof Error ? err.message : '読み込みに失敗しました');
      } finally {
        setMaterialLoading(false);
      }
    })();
  }, [selectedExamId]);

  const selectedExam = examsWithMaterials.find((e) => e.id === selectedExamId);

  const progressMembers = useMemo(() => {
    const seen = new Map<string, string>();
    for (const r of materialRows) if (!seen.has(r.user_id)) seen.set(r.user_id, r.display_name);
    return [...seen.entries()]
      .map(([user_id, display_name]) => ({ user_id, display_name }))
      .sort((a, b) => a.display_name.localeCompare(b.display_name, 'ja'));
  }, [materialRows]);

  const progressByUserMaterial = useMemo(() => {
    const m = new Map<string, AdminMaterialProgressRow>();
    for (const r of materialRows) if (r.material_id) m.set(`${r.user_id}:${r.material_id}`, r);
    return m;
  }, [materialRows]);

  const exams = useMemo(() => {
    const seen = new Map<string, { exam_id: string; exam_name: string; group_name: string }>();
    for (const c of cells) {
      if (!seen.has(c.exam_id)) {
        seen.set(c.exam_id, { exam_id: c.exam_id, exam_name: c.exam_name, group_name: c.group_name });
      }
    }
    return [...seen.values()];
  }, [cells]);

  const members = useMemo(() => {
    const seen = new Map<string, { user_id: string; display_name: string }>();
    for (const c of cells) {
      if (!seen.has(c.user_id)) seen.set(c.user_id, { user_id: c.user_id, display_name: c.display_name });
    }
    return [...seen.values()].sort((a, b) => a.display_name.localeCompare(b.display_name, 'ja'));
  }, [cells]);

  const cellMap = useMemo(() => {
    const m = new Map<string, ExamReportCell>();
    for (const c of cells) m.set(`${c.user_id}:${c.exam_id}`, c);
    return m;
  }, [cells]);

  if (loading) return <div style={{ padding: 24, color: '#999' }}>読み込み中...</div>;
  if (error) return <div style={styles.error}>{error}</div>;

  return (
    <div>
      <h2 style={styles.sectionTitle}>試験レポート（メンバー×試験）</h2>
      <p style={styles.hint}>
        セルをクリックすると提出結果を確認できます。「対象外」は対象者限定の試験で、そのメンバーが対象外であることを示します。
      </p>

      <div style={{ overflowX: 'auto', overflowY: 'auto', maxHeight: '70vh', border: '1px solid #eee', borderRadius: 10 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={styles.thCorner}>メンバー名</th>
              {exams.map((e) => (
                <th key={e.exam_id} style={styles.thSticky} title={e.group_name}>
                  {e.exam_name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {members.length === 0 ? (
              <tr>
                <td colSpan={exams.length + 1} style={{ textAlign: 'center', color: '#999', padding: 24 }}>
                  データがありません
                </td>
              </tr>
            ) : (
              members.map((m) => (
                <tr key={m.user_id} style={styles.tr}>
                  <td style={styles.tdSticky}>{m.display_name}</td>
                  {exams.map((e) => {
                    const cell = cellMap.get(`${m.user_id}:${e.exam_id}`);
                    if (!cell || cell.excluded) {
                      return (
                        <td key={e.exam_id} style={{ ...styles.td, color: '#bbb' }}>
                          対象外
                        </td>
                      );
                    }
                    if (cell.attempt_id == null) {
                      return (
                        <td key={e.exam_id} style={{ ...styles.td, color: '#999' }}>
                          未受験
                        </td>
                      );
                    }
                    return (
                      <td key={e.exam_id} style={styles.td}>
                        <button
                          style={{
                            ...styles.scoreBtn,
                            color: cell.passed ? '#0a7d55' : MAGENTA,
                            background: cell.passed ? '#EAF7F1' : '#FDECF3',
                          }}
                          onClick={() => navigate(`/exams/result/${cell.attempt_id}`)}
                        >
                          {cell.earned_points} / {cell.total_points}点
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {examsWithMaterials.length > 0 && (
        <>
          <h2 style={{ ...styles.sectionTitle, marginTop: 40 }}>教材閲覧状況</h2>
          <p style={styles.hint}>
            スライド教材をどこまで見たか（ページ画像のうち実際に開いたページの割合）を試験ごとに確認できます。
          </p>
          <select
            value={selectedExamId}
            onChange={(e) => setSelectedExamId(e.target.value)}
            style={styles.examSelect}
          >
            {examsWithMaterials.map((e) => (
              <option key={e.id} value={e.id}>{e.name}</option>
            ))}
          </select>

          {materialLoading ? (
            <div style={{ padding: 24, color: '#999' }}>読み込み中...</div>
          ) : (
            <div style={{ overflowX: 'auto', overflowY: 'auto', maxHeight: '70vh', border: '1px solid #eee', borderRadius: 10, marginTop: 12 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={styles.thCorner}>メンバー名</th>
                    {selectedExam?.materials?.map((m) => (
                      <th key={m.id} style={styles.thSticky}>{m.label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {progressMembers.length === 0 ? (
                    <tr>
                      <td colSpan={(selectedExam?.materials?.length ?? 0) + 1} style={{ textAlign: 'center', color: '#999', padding: 24 }}>
                        データがありません
                      </td>
                    </tr>
                  ) : (
                    progressMembers.map((m) => (
                      <tr key={m.user_id} style={styles.tr}>
                        <td style={styles.tdSticky}>{m.display_name}</td>
                        {selectedExam?.materials?.map((mat) => {
                          const row = progressByUserMaterial.get(`${m.user_id}:${mat.id}`);
                          const viewed = row?.viewed_pages?.length ?? 0;
                          if (!row || viewed === 0 || !mat.pages) {
                            return (
                              <td key={mat.id} style={{ ...styles.td, color: '#999' }}>未着手</td>
                            );
                          }
                          const percent = Math.round((viewed / mat.pages) * 100);
                          return (
                            <td key={mat.id} style={styles.td}>
                              <span style={{ fontWeight: 700, color: percent >= 100 ? '#0a7d55' : DEEP_BLUE }}>
                                {percent}%
                              </span>
                              <span style={{ color: '#999', marginLeft: 6 }}>
                                （{row.last_page}/{mat.pages}p）
                              </span>
                            </td>
                          );
                        })}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  sectionTitle: { fontSize: 18, fontWeight: 700, color: DEEP_BLUE, margin: '0 0 8px' },
  hint: { fontSize: 13, color: '#888', marginBottom: 16 },
  thSticky: {
    padding: '12px 14px', textAlign: 'left', fontSize: 13, fontWeight: 700, color: DEEP_BLUE,
    borderBottom: '2px solid #eee', background: '#fafbfc', whiteSpace: 'nowrap',
    position: 'sticky', top: 0, zIndex: 2,
  },
  thCorner: {
    padding: '12px 14px', textAlign: 'left', fontSize: 13, fontWeight: 700, color: DEEP_BLUE,
    borderBottom: '2px solid #eee', borderRight: '1px solid #eee', background: '#fafbfc',
    whiteSpace: 'nowrap', position: 'sticky', top: 0, left: 0, zIndex: 3,
  },
  tr: { borderBottom: '1px solid #f0f0f0' },
  td: { padding: '10px 14px', fontSize: 13, color: '#333', whiteSpace: 'nowrap' },
  tdSticky: {
    padding: '10px 14px', fontSize: 13, fontWeight: 600, color: DEEP_BLUE, whiteSpace: 'nowrap',
    position: 'sticky', left: 0, zIndex: 1, background: '#fff', borderRight: '1px solid #f0f0f0',
  },
  scoreBtn: {
    border: 'none', borderRadius: 6, padding: '4px 10px', fontSize: 12.5, fontWeight: 700, cursor: 'pointer',
  },
  error: { padding: 16, background: '#FDECF3', borderLeft: `4px solid ${MAGENTA}`, borderRadius: 6, color: '#7a0b3c' },
  examSelect: { padding: '9px 12px', fontSize: 13.5, border: '1px solid #D5DEE4', borderRadius: 8, outline: 'none', fontFamily: 'inherit', minWidth: 280 },
};
