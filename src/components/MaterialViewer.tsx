import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  listExams,
  getMyMaterialProgress,
  saveMaterialProgress,
  fetchMaterialPageBlob,
  type ExamMaterial,
} from '../lib/exams';

const DEEP_BLUE = '#03202F';
const CYAN = '#3DB7E4';
const SEA_GREEN = '#50DAB0';
const MAGENTA = '#E21776';

function MaximizeIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 3H5a2 2 0 0 0-2 2v3" />
      <path d="M21 8V5a2 2 0 0 0-2-2h-3" />
      <path d="M3 16v3a2 2 0 0 0 2 2h3" />
      <path d="M16 21h3a2 2 0 0 0 2-2v-3" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </svg>
  );
}

function ChevronLeftIcon() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m15 18-6-6 6-6" />
    </svg>
  );
}

function ChevronRightIcon() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m9 18 6-6-6-6" />
    </svg>
  );
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
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [imgSrc, setImgSrc] = useState<string | null>(null);
  const pageRef = useRef(1);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const blobCacheRef = useRef<Map<number, string>>(new Map());

  // バケットが非公開のため、ページ画像はAuthorizationヘッダつきfetchでBlob URL化して使う。
  // 直近数ページ分だけキャッシュし、溢れた古いものはrevokeして解放する
  async function loadPageImage(n: number) {
    if (!examId || !materialId) return;
    const cache = blobCacheRef.current;
    const cached = cache.get(n);
    if (cached) {
      setImgSrc(cached);
      return;
    }
    try {
      const url = await fetchMaterialPageBlob(examId, materialId, n);
      cache.set(n, url);
      if (cache.size > 6) {
        const oldestKey = cache.keys().next().value;
        if (oldestKey !== undefined) {
          URL.revokeObjectURL(cache.get(oldestKey)!);
          cache.delete(oldestKey);
        }
      }
      setImgSrc(url);
    } catch {
      // 読み込み失敗時は前の画像を表示したままにする
    }
  }

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
        pageRef.current = startPage;
        await loadPageImage(startPage);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [examId, materialId]);

  useEffect(() => {
    pageRef.current = page;
  }, [page]);

  useEffect(() => {
    const cache = blobCacheRef.current;
    return () => {
      cache.forEach((url) => URL.revokeObjectURL(url));
    };
  }, []);

  useEffect(() => {
    if (!isFullscreen) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setIsFullscreen(false);
      else if (e.key === 'ArrowLeft') visitPage(pageRef.current - 1);
      else if (e.key === 'ArrowRight') visitPage(pageRef.current + 1);
    }
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isFullscreen]);

  // ページ遷移のたびに呼ぶ（デバウンスしない。タブを閉じる直前の遷移を失わないため）
  function visitPage(n: number) {
    if (!material || !examId || !materialId) return;
    const clamped = Math.min(Math.max(1, n), material.pages!);
    setPage(clamped);
    setViewedPages((prev) => (prev.has(clamped) ? prev : new Set(prev).add(clamped)));
    saveMaterialProgress(examId, materialId, clamped).catch(() => {
      // 保存に失敗してもビューア自体は止めない
    });
    loadPageImage(clamped);
  }

  function goTo(n: number) {
    visitPage(n);
  }

  function onJump() {
    const n = Number(jumpInput);
    if (Number.isInteger(n)) goTo(n);
    setJumpInput('');
  }

  function handleTouchStart(e: React.TouchEvent) {
    const t = e.touches[0];
    touchStartRef.current = { x: t.clientX, y: t.clientY };
  }

  function handleTouchEnd(e: React.TouchEvent) {
    const start = touchStartRef.current;
    touchStartRef.current = null;
    if (!start) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - start.x;
    const dy = t.clientY - start.y;
    if (Math.abs(dx) < 40 || Math.abs(dx) < Math.abs(dy)) return;
    // ピンチズーム中（拡大表示中）の指ドラッグはページ送りと誤認識しない
    if (window.visualViewport && window.visualViewport.scale > 1.01) return;
    goTo(dx < 0 ? page + 1 : page - 1);
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
        {imgSrc && (
          <img
            src={imgSrc}
            alt={`${material.label} ${page}ページ目`}
            style={styles.img}
          />
        )}
        <button style={styles.maximizeBtn} onClick={() => setIsFullscreen(true)} aria-label="全画面表示">
          <MaximizeIcon />
        </button>
      </div>

      {isFullscreen && (
        <div style={styles.fsOverlay} onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
          {imgSrc && (
            <img
              src={imgSrc}
              alt={`${material.label} ${page}ページ目`}
              style={styles.fsImg}
            />
          )}
          <button style={styles.fsClose} onClick={() => setIsFullscreen(false)} aria-label="閉じる">
            <CloseIcon />
          </button>
          <div style={styles.fsPageIndicator}>{page} / {totalPages}</div>
          <button
            style={{ ...styles.fsNavBtn, ...styles.fsNavBtnLeft, opacity: page <= 1 ? 0.3 : 1 }}
            onClick={() => goTo(page - 1)}
            disabled={page <= 1}
            aria-label="前へ"
          >
            <ChevronLeftIcon />
          </button>
          <button
            style={{ ...styles.fsNavBtn, ...styles.fsNavBtnRight, opacity: page >= totalPages ? 0.3 : 1 }}
            onClick={() => goTo(page + 1)}
            disabled={page >= totalPages}
            aria-label="次へ"
          >
            <ChevronRightIcon />
          </button>
        </div>
      )}

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

  viewerWrap: { marginTop: 18, textAlign: 'center', background: '#F5F9FB', borderRadius: 10, padding: 12, position: 'relative' },
  img: { maxWidth: '100%', borderRadius: 6, boxShadow: '0 2px 10px rgba(3,32,47,0.12)' },
  maximizeBtn: {
    position: 'absolute', top: 10, right: 10, width: 34, height: 34, borderRadius: 8,
    border: 'none', background: 'rgba(3,32,47,0.72)', color: '#fff',
    display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
  },
  fsOverlay: {
    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: '#000', zIndex: 1000,
    display: 'flex', alignItems: 'center', justifyContent: 'center', touchAction: 'manipulation',
  },
  fsImg: { maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' },
  fsClose: {
    position: 'fixed', top: 16, right: 16, zIndex: 1001, width: 40, height: 40, borderRadius: 20,
    border: 'none', background: 'rgba(255,255,255,0.14)', color: '#fff',
    display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
  },
  fsPageIndicator: {
    position: 'fixed', bottom: 16, left: '50%', transform: 'translateX(-50%)', zIndex: 1001,
    color: '#fff', fontSize: 13, fontWeight: 700, background: 'rgba(255,255,255,0.14)',
    padding: '4px 12px', borderRadius: 12, fontVariantNumeric: 'tabular-nums',
  },
  fsNavBtn: {
    position: 'fixed', top: '50%', transform: 'translateY(-50%)', zIndex: 1001,
    width: 48, height: 48, borderRadius: 24, border: 'none',
    background: 'rgba(255,255,255,0.14)', color: '#fff',
    display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
  },
  fsNavBtnLeft: { left: 12 },
  fsNavBtnRight: { right: 12 },

  navRow: { marginTop: 16, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' },
  navBtn: { padding: '9px 18px', border: `1px solid ${CYAN}`, borderRadius: 8, background: '#fff', color: DEEP_BLUE, fontSize: 14, fontWeight: 700, cursor: 'pointer' },
  pageIndicator: { fontSize: 14, fontWeight: 700, color: DEEP_BLUE, fontVariantNumeric: 'tabular-nums', minWidth: 70, textAlign: 'center' },
  jumpBox: { display: 'flex', gap: 6, marginLeft: 'auto' },
  jumpInput: { width: 90, padding: '8px 10px', fontSize: 13, border: '1px solid #D5DEE4', borderRadius: 8, outline: 'none' },
  jumpBtn: { padding: '8px 14px', border: 'none', borderRadius: 8, background: DEEP_BLUE, color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' },

  error: { padding: '12px 15px', background: '#FDECF3', borderLeft: `4px solid ${MAGENTA}`, borderRadius: 6, color: '#7a0b3c', fontSize: 13.5, marginBottom: 12 },
};
