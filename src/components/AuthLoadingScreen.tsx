const DEEP_BLUE = '#03202F';
const CYAN = '#3DB7E4';
const SEA_GREEN = '#50DAB0';

/**
 * Googleログインのリダイレクトから戻った直後〜getRedirectResult/onAuthStateChanged/
 * プロフィール取得が完了するまでの間(数秒)に表示する画面。
 * この画面が無いとログイン画面が一瞬再表示され、ログインボタンが押せる状態になるため
 * 連打されてしまう(Ryuji報告)。loading中はログイン画面自体を出さないことで
 * ボタンの連打を構造的に防ぐ。
 */
export default function AuthLoadingScreen() {
  return (
    <div style={styles.container}>
      <style>{`
        @keyframes auth-loading-spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
      <div style={styles.card}>
        <div style={styles.logoIcon} />
        <h1 style={styles.logo}>Widsley SkillCheck</h1>
        <div style={styles.spinner} />
        <p style={styles.message}>ログイン中...</p>
        <p style={styles.submessage}>まもなく画面が切り替わります</p>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: `linear-gradient(135deg, ${SEA_GREEN}20, ${CYAN}20, #fff)`,
    padding: 16,
  },
  card: {
    background: '#fff',
    borderRadius: 16,
    padding: '48px 40px',
    maxWidth: 420,
    width: '100%',
    boxShadow: `0 4px 24px ${CYAN}18`,
    textAlign: 'center' as const,
  },
  logoIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    background: `linear-gradient(135deg, ${SEA_GREEN}, ${CYAN})`,
    margin: '0 auto 16px',
  },
  logo: {
    fontSize: 28,
    fontWeight: 800,
    color: DEEP_BLUE,
    margin: '0 0 32px',
    letterSpacing: '-0.5px',
  },
  spinner: {
    width: 32,
    height: 32,
    margin: '0 auto 16px',
    border: '3px solid #eee',
    borderTop: `3px solid ${CYAN}`,
    borderRadius: '50%',
    animation: 'auth-loading-spin 0.8s linear infinite',
  },
  message: {
    fontSize: 15,
    fontWeight: 600,
    color: DEEP_BLUE,
    margin: 0,
  },
  submessage: {
    fontSize: 13,
    color: '#888',
    margin: '4px 0 0',
  },
};
