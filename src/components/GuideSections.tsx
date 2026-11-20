import { Link } from 'react-router-dom';
import type { PracticalGuide } from '../lib/exams';

const DEEP_BLUE = '#03202F';
const CYAN = '#3DB7E4';
const SEA_GREEN = '#50DAB0';
const MAGENTA = '#E21776';

interface GuideSectionsProps {
  guide: PracticalGuide;
  /** 見出し文言。もともと実技模擬の案内専用に書かれた固定文言なので、
   *  用途が違うページ（教材のはじめにガイド・後日演習課題の案内等）から
   *  使うときはここで上書きする。省略時は実技模擬の見た目を変えない。 */
  whatWeSeeHeading?: string;
  stepsHeading?: string;
  contentsHeading?: string;
  answersPolicyHeading?: string;
  gradingHeading?: string;
}

/**
 * 案内ページ（実技模擬・教材の「はじめにガイド」・各回の後日演習課題の案内）の
 * 読み取り専用セクション一式。intro の次から、提出フォームより前まで。
 *
 * 文言とリンクはDBの guide(jsonb) にしか無い。ここに文言を書かないこと。
 * 書いてしまうと、直すたびにデプロイが必要になる。
 */
export default function GuideSections({
  guide: g,
  whatWeSeeHeading = 'この実技で見ていること',
  stepsHeading = '進め方',
  contentsHeading = 'リポジトリの中身',
  answersPolicyHeading = '模範解答を見るタイミング',
  gradingHeading = '採点について',
}: GuideSectionsProps) {
  return (
    <>
      {/* 先に飛び先を出す。読み終わる前に触りたい人がいるので上に置く */}
      {!!g.links?.length && (
        <div style={styles.linkRow}>
          {g.links.map((l) => {
            const internal = l.url.startsWith('/');
            const content = (
              <>
                <span style={styles.linkLabel}>{l.label}{internal ? '' : ' ↗'}</span>
                {l.note && <span style={styles.linkNote}>{l.note}</span>}
              </>
            );
            const linkStyle = l.primary ? styles.linkPrimary : styles.linkPlain;
            return internal ? (
              <Link key={l.url} to={l.url} style={linkStyle}>{content}</Link>
            ) : (
              <a key={l.url} href={l.url} target="_blank" rel="noopener noreferrer" style={linkStyle}>
                {content}
              </a>
            );
          })}
        </div>
      )}

      {!!g.what_we_see?.length && (
        <section style={styles.section}>
          <h2 style={styles.h2}>{whatWeSeeHeading}</h2>
          <ul style={styles.ul}>
            {g.what_we_see.map((t) => (
              <li key={t} style={styles.li}>{t}</li>
            ))}
          </ul>
        </section>
      )}

      {!!g.steps?.length && (
        <section style={styles.section}>
          <h2 style={styles.h2}>{stepsHeading}</h2>
          {g.steps.map((s) => (
            <div key={s.no} style={styles.step}>
              <div style={styles.stepNo}>{s.no}</div>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={styles.stepTitle}>{s.title}</div>
                <div style={styles.stepBody}>{s.body}</div>
                {s.code && <pre style={styles.codeBlock}>{s.code}</pre>}
              </div>
            </div>
          ))}
        </section>
      )}

      {!!g.contents?.length && (
        <section style={styles.section}>
          <h2 style={styles.h2}>{contentsHeading}</h2>
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
          <b>{answersPolicyHeading}</b>
          <div style={{ marginTop: 4 }}>{g.answers_policy}</div>
        </div>
      )}

      {g.grading && (
        <div style={styles.note}>
          <b>{gradingHeading}</b>
          <div style={{ marginTop: 4 }}>{g.grading}</div>
        </div>
      )}

      {g.note && <p style={styles.smallNote}>※ {g.note}</p>}
    </>
  );
}

const styles: Record<string, React.CSSProperties> = {
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
  stepBody: { fontSize: 13.5, color: '#444', lineHeight: 1.7, marginTop: 3, whiteSpace: 'pre-wrap' },
  codeBlock: { marginTop: 8, padding: '12px 14px', background: '#0D1B24', color: '#CFE8F3', borderRadius: 8, fontSize: 12.5, lineHeight: 1.6, overflowX: 'auto', fontFamily: 'SFMono-Regular, Menlo, monospace' },

  tableWrap: { overflowX: 'auto' },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: 13.5 },
  tdPath: { padding: '8px 12px 8px 0', borderBottom: '1px solid #EEF2F4', whiteSpace: 'nowrap', verticalAlign: 'top' },
  td: { padding: '8px 0', borderBottom: '1px solid #EEF2F4', color: '#444', lineHeight: 1.6 },
  code: { background: '#F2F7FA', padding: '2px 7px', borderRadius: 4, fontSize: 12.5, fontFamily: 'SFMono-Regular, Menlo, monospace' },

  warn: { marginTop: 26, padding: '13px 16px', background: '#FDF0F6', borderLeft: `4px solid ${MAGENTA}`, borderRadius: '0 8px 8px 0', fontSize: 13.5, color: '#333', lineHeight: 1.7 },
  note: { marginTop: 14, padding: '13px 16px', background: '#F2F7FA', borderLeft: `4px solid ${SEA_GREEN}`, borderRadius: '0 8px 8px 0', fontSize: 13.5, color: '#333', lineHeight: 1.7 },
  smallNote: { marginTop: 14, fontSize: 12.5, color: '#777', lineHeight: 1.7 },
};
