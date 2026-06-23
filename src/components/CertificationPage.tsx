import { useState } from 'react';

const DEEP_BLUE = '#03202F';
const CYAN = '#3DB7E4';
const SEA_GREEN = '#50DAB0';
const MAGENTA = '#E21776';

// ── Certification data parsed from CSV ──

interface Cert {
  no: number;
  name: string;
  category: string;
}

interface LevelData {
  name: string;
  reward: string;
  color: string;
  certs: Cert[];
}

const levels: LevelData[] = [
  {
    name: 'Academia',
    reward: '【どちらかマストで取得】',
    color: '#6B7280',
    certs: [
      { no: 1, name: 'JSTQB Foundation Level', category: 'QA推奨' },
      { no: 2, name: 'ISTQB Foundation Level', category: 'QA推奨' },
    ],
  },
  {
    name: 'エントリー',
    reward: '【報奨金10,000円】',
    color: CYAN,
    certs: [
      { no: 1, name: 'ITパスポート試験', category: '国家資格' },
      { no: 2, name: '情報セキュリティマネジメント試験', category: '国家資格' },
      { no: 3, name: 'AWS Certified Cloud Practitioner', category: 'ベンダー系' },
      { no: 4, name: 'AWS Certified AI Practitioner', category: 'ベンダー系' },
      { no: 5, name: 'Oracle Master Bronze', category: 'ベンダー系' },
      { no: 6, name: 'Oracle Certified Java Programmer, Bronze SE', category: 'ベンダー系' },
      { no: 7, name: 'Microsoft Certified: Azure Fundamentals', category: 'ベンダー系' },
      { no: 8, name: 'Microsoft Certified: Azure Data Fundamentals', category: 'ベンダー系' },
      { no: 9, name: 'Microsoft Certified: Security, Compliance, and Identity Fundamentals', category: 'ベンダー系' },
      { no: 10, name: 'LPIC-1', category: 'ベンダーニュートラル系' },
      { no: 11, name: 'LinuCレベル1', category: 'ベンダーニュートラル系' },
      { no: 12, name: 'Pythonエンジニア認定基礎試験', category: 'ベンダーニュートラル系' },
      { no: 13, name: 'Pythonエンジニア認定データ分析試験', category: 'ベンダーニュートラル系' },
      { no: 14, name: 'HTML5プロフェッショナル認定試験 レベル1', category: 'ベンダーニュートラル系' },
      { no: 15, name: 'Javaプログラミング能力認定試験 3級', category: 'ベンダーニュートラル系' },
      { no: 16, name: 'Certified in Cybersecurity (CC)', category: 'ベンダーニュートラル系' },
      { no: 17, name: 'Microsoft Certified: Azure AI Fundamentals', category: 'AI系' },
      { no: 18, name: '生成AIプラクティショナー 社内認定資格', category: '社内認定資格' },
      { no: 19, name: 'Playwright 社内認定資格', category: '社内認定資格' },
    ],
  },
  {
    name: 'アソシエイト',
    reward: '【報奨金30,000円】',
    color: SEA_GREEN,
    certs: [
      { no: 1, name: '基本情報技術者試験', category: '国家資格' },
      { no: 2, name: 'JSTQB Advanced Level テストアナリスト', category: 'QA推奨' },
      { no: 3, name: 'JSTQB Advanced Level テストマネージャ', category: 'QA推奨' },
      { no: 4, name: 'ISTQB Advanced Level', category: 'QA推奨' },
      { no: 5, name: 'AWS Certified Solutions Architect - Associate', category: 'ベンダー系' },
      { no: 6, name: 'AWS Certified Developer - Associate', category: 'ベンダー系' },
      { no: 7, name: 'AWS Certified SysOps Administrator - Associate', category: 'ベンダー系' },
      { no: 8, name: 'AWS Certified Data Engineer - Associate', category: 'ベンダー系' },
      { no: 9, name: 'AWS Certified Machine Learning Engineer - Associate', category: 'ベンダー系' },
      { no: 10, name: 'CCNA', category: 'ベンダー系' },
      { no: 11, name: 'Oracle Master Silver', category: 'ベンダー系' },
      { no: 12, name: 'Oracle Master Silver SQL', category: 'ベンダー系' },
      { no: 13, name: 'Oracle Certified Java Programmer, Silver SE 11', category: 'ベンダー系' },
      { no: 14, name: 'Microsoft Certified: Azure Security Engineer Associate', category: 'ベンダー系' },
      { no: 15, name: 'Microsoft Certified: Azure Network Engineer Associate', category: 'ベンダー系' },
      { no: 16, name: 'Microsoft Certified: Azure Administrator Associate', category: 'ベンダー系' },
      { no: 17, name: 'Microsoft Certified: Azure Developer Associate', category: 'ベンダー系' },
      { no: 18, name: 'Microsoft Certified: Windows Server Hybrid Administrator Associate', category: 'ベンダー系' },
      { no: 19, name: 'Microsoft Certified: Azure Database Administrator Associate', category: 'ベンダー系' },
      { no: 20, name: 'Microsoft Certified: Azure Data Scientist Associate', category: 'ベンダー系' },
      { no: 21, name: 'Microsoft Certified: Fabric Analytics Engineer Associate', category: 'ベンダー系' },
      { no: 22, name: 'Microsoft Certified: Fabric Data Engineer Associate', category: 'ベンダー系' },
      { no: 23, name: 'Microsoft Certified: Identity and Access Administrator Associate', category: 'ベンダー系' },
      { no: 24, name: 'Microsoft Certified: Security Operations Analyst Associate', category: 'ベンダー系' },
      { no: 25, name: 'Microsoft Certified: Information Security Administrator Associate', category: 'ベンダー系' },
      { no: 26, name: 'LPIC-2', category: 'ベンダーニュートラル系' },
      { no: 27, name: 'LinuCレベル2', category: 'ベンダーニュートラル系' },
      { no: 28, name: 'Pythonエンジニア認定データ分析実践試験', category: 'ベンダーニュートラル系' },
      { no: 29, name: 'Pythonエンジニア認定実践試験', category: 'ベンダーニュートラル系' },
      { no: 30, name: 'HTML5プロフェッショナル認定試験 レベル2', category: 'ベンダーニュートラル系' },
      { no: 31, name: 'Javaプログラミング能力認定試験 2級', category: 'ベンダーニュートラル系' },
      { no: 32, name: 'OpenJS Node.js Application Developer (JSNAD)', category: 'ベンダーニュートラル系' },
      { no: 33, name: 'Systems Security Certified Practitioner (SSCP)', category: 'ベンダーニュートラル系' },
      { no: 34, name: 'Microsoft Certified: Azure AI Engineer Associate', category: 'AI系' },
    ],
  },
  {
    name: 'プロフェッショナル',
    reward: '【報奨金40,000円】',
    color: MAGENTA,
    certs: [
      { no: 1, name: '応用情報技術者試験', category: '国家資格' },
      { no: 2, name: 'JSTQB Specialist テスト自動化エンジニア', category: 'QA推奨' },
      { no: 3, name: 'AWS Certified Solutions Architect - Professional', category: 'ベンダー系' },
      { no: 4, name: 'AWS Certified DevOps Engineer - Professional', category: 'ベンダー系' },
      { no: 5, name: 'CCNP', category: 'ベンダー系' },
      { no: 6, name: 'Oracle Master Gold', category: 'ベンダー系' },
      { no: 7, name: 'Oracle Certified Java Programmer, Gold SE 11', category: 'ベンダー系' },
      { no: 8, name: 'Microsoft Certified: Azure Solutions Architect Expert', category: 'ベンダー系' },
      { no: 9, name: 'Microsoft Certified: DevOps Engineer Expert', category: 'ベンダー系' },
      { no: 10, name: 'Microsoft Certified: Cybersecurity Architect Expert', category: 'ベンダー系' },
      { no: 11, name: 'Claude Certified Architect', category: 'ベンダー系' },
      { no: 12, name: 'LPIC-3', category: 'ベンダーニュートラル系' },
      { no: 13, name: 'LinuCレベル3', category: 'ベンダーニュートラル系' },
      { no: 14, name: 'Meta Front-End Developer Professional Certificate', category: 'ベンダーニュートラル系' },
      { no: 15, name: 'Pythonとネットワークの自動化基礎検定', category: 'ベンダーニュートラル系' },
      { no: 16, name: 'Javaプログラミング能力認定試験 1級', category: 'ベンダーニュートラル系' },
      { no: 17, name: 'Certified Cloud Security Professional (CCSP)', category: 'ベンダーニュートラル系' },
      { no: 18, name: 'Certified Secure Software Lifecycle Professional (CSSLP)', category: 'ベンダーニュートラル系' },
      { no: 19, name: 'Professional Cloud Developer', category: 'AI系' },
      { no: 20, name: 'TensorFlow Developer Certificate', category: 'AI系' },
    ],
  },
  {
    name: 'エキスパート',
    reward: '【毎月10,000円（2つ目から5,000円）】',
    color: '#8B5CF6',
    certs: [
      { no: 1, name: 'データベーススペシャリスト試験', category: '国家資格' },
      { no: 2, name: 'ネットワークスペシャリスト試験', category: '国家資格' },
      { no: 3, name: 'プロジェクトマネージャ試験', category: '国家資格' },
      { no: 4, name: 'システムアーキテクト試験', category: '国家資格' },
      { no: 5, name: 'ITストラテジスト試験', category: '国家資格' },
      { no: 6, name: 'ITサービスマネージャ試験', category: '国家資格' },
      { no: 7, name: 'システム監査技術者試験', category: '国家資格' },
      { no: 8, name: '情報処理安全確保支援士試験', category: '国家資格' },
      { no: 9, name: 'ISTQB Certified Tester Expert Level (ISTQB EL)', category: 'QA推奨' },
      { no: 10, name: 'AWS Certified Advanced Networking - Specialty', category: 'ベンダー系' },
      { no: 11, name: 'Microsoft Certified: Azure for SAP Workloads Specialty', category: 'ベンダー系' },
      { no: 12, name: 'Microsoft Certified: Azure Virtual Desktop Specialty', category: 'ベンダー系' },
      { no: 13, name: 'Microsoft Certified: Azure Cosmos DB Developer Specialty', category: 'ベンダー系' },
      { no: 14, name: 'AWS Certified Machine Learning - Specialty', category: 'ベンダー系' },
      { no: 15, name: 'AWS Certified Security - Specialty', category: 'ベンダー系' },
      { no: 16, name: 'Oracle Master Platinum', category: 'ベンダー系' },
      { no: 17, name: 'PMP® (Project Management Professional)', category: 'ベンダーニュートラル系' },
      { no: 18, name: 'Certified Kubernetes Administrator (CKA)', category: 'ベンダーニュートラル系' },
      { no: 19, name: 'Certified Information Systems Security Professional (CISSP)', category: 'ベンダーニュートラル系' },
    ],
  },
];

const categoryColors: Record<string, string> = {
  '国家資格': '#dc2626',
  'QA推奨': SEA_GREEN,
  'ベンダー系': CYAN,
  'ベンダーニュートラル系': '#8B5CF6',
  'AI系': '#F59E0B',
  '社内認定資格': MAGENTA,
};

export default function CertificationPage() {
  const [selectedLevel, setSelectedLevel] = useState<string | null>(null);

  return (
    <div style={{ minHeight: 'calc(100vh - 56px)', padding: '24px 16px 60px', maxWidth: 1000, margin: '0 auto' }}>
      <h1 style={{ fontSize: 24, fontWeight: 800, color: DEEP_BLUE, marginBottom: 8 }}>奨励資格一覧</h1>
      <p style={{ fontSize: 13, color: '#888', marginBottom: 24, lineHeight: 1.6 }}>
        SSI事業部で推奨される資格の一覧です。レベルに応じた報奨金制度があります。
      </p>

      {/* Level filter */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 24 }}>
        <button
          onClick={() => setSelectedLevel(null)}
          style={{
            padding: '6px 16px', fontSize: 13, fontWeight: 600, borderRadius: 999, cursor: 'pointer',
            border: selectedLevel === null ? 'none' : '1px solid #ddd',
            background: selectedLevel === null ? DEEP_BLUE : '#fff',
            color: selectedLevel === null ? '#fff' : '#666',
          }}
        >
          すべて
        </button>
        {levels.map(lv => (
          <button
            key={lv.name}
            onClick={() => setSelectedLevel(lv.name)}
            style={{
              padding: '6px 16px', fontSize: 13, fontWeight: 600, borderRadius: 999, cursor: 'pointer',
              border: selectedLevel === lv.name ? 'none' : `1px solid ${lv.color}40`,
              background: selectedLevel === lv.name ? lv.color : '#fff',
              color: selectedLevel === lv.name ? '#fff' : lv.color,
            }}
          >
            {lv.name}
          </button>
        ))}
      </div>

      {/* Level sections */}
      {levels
        .filter(lv => !selectedLevel || lv.name === selectedLevel)
        .map(lv => {
          // Group by category
          const categories = [...new Set(lv.certs.map(c => c.category))];

          return (
            <div key={lv.name} style={{
              background: '#fff', borderRadius: 16, padding: '24px', marginBottom: 20,
              boxShadow: '0 1px 8px rgba(0,0,0,0.04)', border: `1px solid ${lv.color}20`,
            }}>
              {/* Level header */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
                <span style={{
                  fontSize: 16, fontWeight: 800, color: '#fff', background: lv.color,
                  padding: '5px 16px', borderRadius: 999,
                }}>
                  {lv.name}
                </span>
                <span style={{ fontSize: 13, color: lv.color, fontWeight: 700 }}>
                  {lv.reward}
                </span>
                <span style={{ fontSize: 12, color: '#aaa' }}>
                  {lv.certs.length}資格
                </span>
              </div>

              {/* Certs grouped by category */}
              {categories.map(cat => {
                const catCerts = lv.certs.filter(c => c.category === cat);
                return (
                  <div key={cat} style={{ marginBottom: 12 }}>
                    <div style={{
                      fontSize: 12, fontWeight: 700, color: categoryColors[cat] ?? '#666',
                      marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6,
                    }}>
                      <span style={{
                        width: 8, height: 8, borderRadius: '50%',
                        background: categoryColors[cat] ?? '#999', display: 'inline-block',
                      }} />
                      {cat}
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, paddingLeft: 14 }}>
                      {catCerts.map(cert => (
                        <span key={cert.no} style={{
                          fontSize: 13, color: DEEP_BLUE, background: '#f5f7fa',
                          padding: '5px 12px', borderRadius: 8, border: '1px solid #eee',
                          lineHeight: 1.4,
                        }}>
                          {cert.name}
                        </span>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })}
    </div>
  );
}
