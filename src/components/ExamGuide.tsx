import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { getGuide, type GuideDetail } from '../lib/exams';
import GuideSections from './GuideSections';

const DEEP_BLUE = '#03202F';
const CYAN = '#3DB7E4';

/**
 * 教材・実技共通の「案内ページ」。提出フォームが無い、読み取り専用の案内だけを出す。
 * 例: Playwrightワークショップの「はじめにガイド」、各回の後日演習課題の案内。
 *
 * kindの制限は無い（practical専用のExamPracticalとは別物。material等でも使う）。
 * 文言とリンクはサーバー（DBのguide列）が持っている。ここに文言を書かないこと。
 */
export default function ExamGuide() {
  const { examId } = useParams<{ examId: string }>();
  const navigate = useNavigate();
  const [data, setData] = useState<GuideDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!examId) return;
    (async () => {
      try {
        setData(await getGuide(examId));
      } catch (err) {
        setError(err instanceof Error ? err.message : '読み込みに失敗しました');
      } finally {
        setLoading(false);
      }
    })();
  }, [examId]);

  if (loading) return <div style={styles.page}>読み込み中…</div>;
  if (error || !data) {
    return (
      <div style={styles.page}>
        <div style={styles.error}>{error ?? '見つかりませんでした'}</div>
        <button style={styles.backBtn} onClick={() => navigate('/exams')}>学習・試験一覧に戻る</button>
      </div>
    );
  }

  const { exam } = data;
  const g = exam.guide;

  return (
    <div style={styles.page}>
      <button style={styles.backLink} onClick={() => navigate('/exams')}>← 学習・試験一覧</button>

      <div style={styles.head}>
        <span style={styles.badge}>案内</span>
        <h1 style={styles.title}>{exam.name}</h1>
      </div>
      {exam.description && <p style={styles.lead}>{exam.description}</p>}
      {g.intro && <p style={styles.intro}>{g.intro}</p>}

      <GuideSections
        guide={g}
        whatWeSeeHeading={g.what_we_see_heading}
        stepsHeading={g.steps_heading}
        contentsHeading={g.contents_heading}
        answersPolicyHeading={g.answers_policy_heading}
        gradingHeading={g.grading_heading}
      />
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
  intro: { fontSize: 14.5, color: '#444', lineHeight: 1.75, marginTop: 8 },
  error: { padding: 16, background: '#FDECF3', borderLeft: '4px solid #E21776', borderRadius: 6, color: '#7a0b3c' },
};
