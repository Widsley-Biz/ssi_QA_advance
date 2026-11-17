import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  listExams,
  getMyMaterialProgress,
  saveMaterialProgress,
  type ExamMaterial,
} from '../lib/exams';

const DEEP_BLUE = '#03202F';
const CYAN = '#3DB7E4';
const SEA_GREEN = '#50DAB0';
const MAGENTA = '#E21776';

function pad3(n: number): string {
  return String(n).padStart(3, '0');
}

/**
 * スライド教材(ページ画像)のビューア。
 *
 * PDFそのものではなく、1ページ=1枚のJPEGに分割済みの画像を表示する
 * （元のスライドは画像のみでテキスト層が無いため、最初から画像で持つ方が軽い）。
 * ページを開くたびに視聴進捗(material_progress)をサーバーに保存し、
 * 次回はlast_pageから再開する。
 */
export default function MaterialViewer() {
  const { examId, materialId } = useParams<{ examId: string; materialId: string }>();
  const navigate = useNavigate();

  const [examName, setExamName] = useState('');
  const [material, setMaterial] = useState<ExamMaterial | null>(null);
  const [page, setPage] = useState(1);
  const [viewedPages, setViewedPages] = useState<Set<number>>(new Set());
  const [jumpInput, setJumpInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!examId || !materialId) return;
    (async () => {
      try {
        const [exams, progress] = await Promise.all([listExams(), getMyMaterialProgress()]);
        const exam = exams.find((e) => e.id === examId);
        const mat = exam?.materials?.find((m) => m.id === materialId);
        if (!exam || !mat || !mat.pages) {
          setError('教材が見つかりませんでした');
          return;
        }
        setExamName(exam.name);
        setMaterial(mat);
        const mine = progress.find((p) => p.exam_id === examId && p.material_id === materialId);
        const viewed = new Set(mine?.viewed_pages ?? []);
        const startPage =
          mine?.last_page && mine.last_page >= 1 && mine.last_page <= mat.pages
            ? mine.last_page
            : 1;
        viewed.add(startPage);
        setViewedPages(viewed);
        setPage(startPage);
        // 初回表示も視聴1ページとして保存する（レジューム位置の再確認も兼ねる）
        saveMaterialProgress(examId, materialId, startPage).catch(() => {
          // 保存に失敗してもビューア自体は止めない
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : '読み込みに失敗しました');
      } finally {
        setLoading(false);
      }
    })();
  }, [examId, materialId]);

  // ページ遷移のたびに呼ぶ（デバウンスしない。タブを閉じる直前の遷移を失わないため）
  function visitPage(n: number) {
    if (!material || !examId || !materialId) return;
    const clamped = Math.min(Math.max(1, n), material.pages!);
    setPage(clamped);
    setViewedPages((prev) => (prev.has(clamped) ? prev : new Set(prev).add(clamped)));
    saveMaterialProgress(examId, materialId, clamped).catch(() => {
      // 保存に失敗してもビューア自体は止めない
    });
  }

  function goTo(n: number) {
    visitPage(n);
  }

  function onJump() {
    const n = Number(jumpInput);
    if (Number.isInteger(n)) goTo(n);
    setJumpInput('');
  }

  if (loading) return <div style={styles.page}>読み込み中…</div>;
  if (error || !material) {
    return (
      <div style={styles.page}>
        <div style={styles.error}>{error ?? '見つかりませんでした'}</div>
        <button style={styles.backBtn} onClick={() => navigate('/exams')}>模擬試験一覧に戻る</button>
      </div>
    );
  }

  const totalPages = material.pages!;
  const percent = Math.round((viewedPages.size / totalPages) * 100);

  return (
    <div style={styles.page}>
      <button style={styles.backLink} onClick={() => navigate('/exams')}>← 模擬試験一覧</button>

      <div style={styles.head}>
        <h1 style={styles.title}>{material.label}</h1>
        <div style={styles.examName}>{examName}</div>
      </div>

      <div style={styles.progressRow}>
        <div style={styles.progressBarOuter}>
          <div style={{ ...styles.progressBarInner, width: `${percent}%` }} />
        </div>
        <div style={styles.progressText}>{percent}%（{viewedPages.size}/{totalPages}ページ閲覧）</div>
      </div>

      <div style={styles.viewerWrap}>
        <img
          key={page}
          src={`${material.url}/${pad3(page)}.jpg`}
          alt={`${material.label} ${page}ページ目`}
          style={styles.img}
        />
      </div>

      <div style={styles.navRow}>
        <button style={styles.navBtn} onClick={() => goTo(page - 1)} disabled={page <= 1}>
          ← 前へ
        </button>
        <div style={styles.pageIndicator}>
          {page} / {totalPages}
        </div>
        <button style={styles.navBtn} onClick={() => goTo(page + 1)} disabled={page >= totalPages}>
          次へ →
        </button>
        <div style={styles.jumpBox}>
          <input
            value={jumpInput}
            onChange={(e) => setJumpInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && onJump()}
            placeholder="ページ番号"
            style={styles.jumpInput}
          />
          <button style={styles.jumpBtn} onClick={onJump}>移動</button>
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: { maxWidth: 820, margin: '0 auto', padding: '28px 20px 72px', textAlign: 'left' },
  backLink: { border: 'none', background: 'none', color: CYAN, fontSize: 13, fontWeight: 700, cursor: 'pointer', padding: 0, marginBottom: 16 },
  backBtn: { marginTop: 16, padding: '10px 18px', border: '1px solid #D5DEE4', borderRadius: 8, background: '#fff', color: DEEP_BLUE, fontWeight: 700, cursor: 'pointer' },
  head: { display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' },
  title: { fontSize: 21, fontWeight: 800, color: DEEP_BLUE, margin: 0 },
  examName: { fontSize: 12.5, color: '#888' },

  progressRow: { marginTop: 16, display: 'flex', alignItems: 'center', gap: 12 },
  progressBarOuter: { flex: 1, height: 10, borderRadius: 5, background: '#E5EBEF', overflow: 'hidden' },
  progressBarInner: { height: '100%', borderRadius: 5, background: `linear-gradient(90deg, ${SEA_GREEN}, ${CYAN})`, transition: 'width 0.2s' },
  progressText: { flex: 'none', fontSize: 12.5, color: '#555', fontVariantNumeric: 'tabular-nums' },

  viewerWrap: { marginTop: 18, textAlign: 'center', background: '#F5F9FB', borderRadius: 10, padding: 12 },
  img: { maxWidth: '100%', borderRadius: 6, boxShadow: '0 2px 10px rgba(3,32,47,0.12)' },

  navRow: { marginTop: 16, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' },
  navBtn: { padding: '9px 18px', border: `1px solid ${CYAN}`, borderRadius: 8, background: '#fff', color: DEEP_BLUE, fontSize: 14, fontWeight: 700, cursor: 'pointer' },
  pageIndicator: { fontSize: 14, fontWeight: 700, color: DEEP_BLUE, fontVariantNumeric: 'tabular-nums', minWidth: 70, textAlign: 'center' },
  jumpBox: { display: 'flex', gap: 6, marginLeft: 'auto' },
  jumpInput: { width: 90, padding: '8px 10px', fontSize: 13, border: '1px solid #D5DEE4', borderRadius: 8, outline: 'none' },
  jumpBtn: { padding: '8px 14px', border: 'none', borderRadius: 8, background: DEEP_BLUE, color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' },

  error: { padding: '12px 15px', background: '#FDECF3', borderLeft: `4px solid ${MAGENTA}`, borderRadius: 6, color: '#7a0b3c', fontSize: 13.5, marginBottom: 12 },
};
