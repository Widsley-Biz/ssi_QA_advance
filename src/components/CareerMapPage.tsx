import { useState } from 'react';
import type { CSSProperties } from 'react';

// ── Brand colors ──
const DEEP_BLUE = '#03202F';
const CYAN = '#3DB7E4';
const SEA_GREEN = '#50DAB0';
const MAGENTA = '#E21776';

// ── Types ──
type StageKey = 'ACADEMIA' | 'ENTRY' | 'ASSOCIATE' | 'PROFESSIONAL' | 'EXPERT';

interface StageInfo {
  key: StageKey;
  label: string;
  sublabel: string;
  period: string;
  description: string;
  gradient: string;
}

interface TrackCard {
  trackGroupId: string;
  trackName: string;
  trackColor: string;
  stage: StageKey;
  title: string;
  skills: string;
  certs?: string;
  /** unique id: groupId:trackIdx */
  cardId: string;
}

// ── Stage definitions ──
const STAGES: StageInfo[] = [
  {
    key: 'ACADEMIA',
    label: 'ACADEMIA',
    sublabel: 'IT未経験者',
    period: '0〜半年',
    description: 'ITキャリアスタート。研修でQAエンジニアの基礎を学び、案件を通してIT知識と経験を増やす。',
    gradient: 'linear-gradient(135deg, #1e293b 0%, #334155 100%)',
  },
  {
    key: 'ENTRY',
    label: 'ENTRY',
    sublabel: 'IT初心者',
    period: '半年〜1年',
    description: '案件と並行してプログラミングやインフラに関しても基本を押さえていく。',
    gradient: `linear-gradient(135deg, ${CYAN} 0%, #2196F3 100%)`,
  },
  {
    key: 'ASSOCIATE',
    label: 'ASSOCIATE',
    sublabel: 'IT中級者',
    period: '1〜3年',
    description: '専門領域へのステップアップ。一人称作業が最低限、自分に合った職種を見極める。',
    gradient: `linear-gradient(135deg, ${SEA_GREEN} 0%, #26a69a 100%)`,
  },
  {
    key: 'PROFESSIONAL',
    label: 'PROFESSIONAL',
    sublabel: 'IT上級者',
    period: '3〜5年',
    description: '各領域の専門家として、PJやチームを先導し部下の育成も行う。',
    gradient: `linear-gradient(135deg, ${MAGENTA} 0%, #c2185b 100%)`,
  },
  {
    key: 'EXPERT',
    label: 'EXPERT',
    sublabel: 'ITエキスパート',
    period: '5年〜',
    description: '業務知識の蓄積と大規模PJ経験を経て、代わりの利かないスペシャルな存在に。',
    gradient: 'linear-gradient(135deg, #7c3aed 0%, #5b21b6 100%)',
  },
];

// ── Track group definitions ──
interface TrackGroupDef {
  id: string;
  name: string;
  color: string;
  tracks: {
    name: string;
    cells: Partial<Record<StageKey, { title: string; skills: string; certs?: string }>>;
  }[];
}

const TRACK_GROUPS: TrackGroupDef[] = [
  {
    id: 'qa',
    name: 'QAエンジニア',
    color: '#7B2FB0',
    tracks: [
      {
        name: 'QAエンジニア',
        cells: {
          ACADEMIA: { title: 'QA基礎', skills: '社会人基礎力／QA基礎知識／テスト技法理解／テスト実施（指導下）', certs: 'JSTQB FL' },
          ENTRY: { title: '実行者', skills: 'テスト技法の基礎／Jira等バグ管理ツール／不具合起票／AIによるテストケース案の生成・確認補助', certs: 'IVEC アシスタントクラス' },
          ASSOCIATE: { title: '設計者', skills: '高度なテスト設計技法／基本的な自動化ツール運用／開発者との円滑なコミュニケーション／AIによる不具合分析・起票補助', certs: 'JSTQB TA／JCSQE初級／IVEC テスタークラス' },
          PROFESSIONAL: { title: '推進者', skills: 'テスト戦略の策定／自動化フレームワーク構築／不具合分析によるプロセス改善提案／AI（Claude Code等）でのテストコード生成・自動化／AIを使ったリグレッション分析', certs: 'JSTQB TM／JCSQE中級／IVEC デザイナークラス' },
          EXPERT: { title: 'マネージャー', skills: 'QAチームの採用・育成／予算管理／組織全体の品質指標の定義化／CoQ最適化／LLMのテスト手法（プロンプト品質・出力評価）／AI品質評価戦略の設計', certs: 'JCSQE上級／IVEC アーキテクトクラス／認定スクラムマスター' },
        },
      },
      {
        name: '自動化系',
        cells: {
          ENTRY: { title: '実行者', skills: 'テスト技法の基礎／Jira等バグ管理ツール／不具合起票', certs: 'ITパスポート／IVEC アシスタントクラス' },
          ASSOCIATE: { title: '自動化ユーザー', skills: 'ノーコード/録画でテスト作成／HTML構造理解と要素特定／Autify・mabl・Selenium IDE／SQL基礎', certs: 'Python3基礎／Java Silver' },
          PROFESSIONAL: { title: '自動化エンジニア', skills: 'コードでテスト自動化／API・CI/CD組み込み／Python・Playwright・GitHub・Postman', certs: 'JSTQB TAE／AWS CLF／GitHub Foundations' },
          EXPERT: { title: 'QAアーキテクト', skills: '組織の自動化戦略立案／保守性の高いFW設計／ROI管理／Docker・負荷テスト・チームマネジメント', certs: 'AWS SAA/SAP／JSTQB AL-TM／ISACA CISA' },
        },
      },
      {
        name: 'セキュリティ系',
        cells: {
          ASSOCIATE: { title: '侵害分析', skills: 'OWASP基礎／認証・認可の基本／情報漏えい対策／パスワード管理／権限設定の基礎／脆弱性再現', certs: 'ISC2 CC／CompTIA Security+' },
          PROFESSIONAL: { title: '防御設計', skills: '基本対策の説明／攻撃シナリオ設計／脆弱性連鎖分析／認証設計レビュー／被害影響分析／権限設計レビュー／リスク評価／セキュア構成レビュー', certs: '徳丸基礎試験／SecuriST 脆弱性診断士／SSCP／CEH' },
          EXPERT: { title: 'セキュリティレビュー・リード', skills: 'アクセス制御設計／データ保護設計／セキュリティレビュー／教育設計／組織改善推進', certs: '情報処理安全確保支援士(SC)／CISSP／OSCP' },
        },
      },
    ],
  },
  {
    id: 'app',
    name: 'アプリケーションエンジニア',
    color: '#0E5A8A',
    tracks: [
      {
        name: 'ソフトウェアエンジニア',
        cells: {
          ENTRY: { title: 'プログラマー', skills: 'プログラミング基礎／詳細設計／バージョン管理／AIツール（Copilot等）によるコード補完・説明補助', certs: 'ITパスポート試験／Java 3級／Oracle Bronze／Pythonエンジニア認定基礎試験／HTML5プロフェッショナル認定 Lv1' },
          ASSOCIATE: { title: 'ジュニアエンジニア', skills: '基本設計／DB設計／API設計／非機能要件の把握／クラウド基礎／AIペアプログラミング活用・プロンプト設計', certs: '基本情報技術者試験／Java Silver／Oracle Silver／AWS CLF／AWS AIP' },
          PROFESSIONAL: { title: 'シニアエンジニア', skills: '要件定義／顧客折衝／見積もり／プロジェクト技術リード／パフォーマンス設計・チューニング／AI（Claude Code等）での自律的なコーディング／LLM APIのアプリ組み込み', certs: '応用情報技術者試験／Java Gold／AWS SAA／Oracle Gold／GCP Professional Cloud Developer／G検定' },
          EXPERT: { title: 'システムコンサルタント', skills: 'ドメイン知識の深化／業務コンサルティング／提案・PoC主導／AI機能のアーキテクチャ設計・RAG/エージェント構築', certs: 'システムアーキテクト試験／ITストラテジスト試験／AWS SAP／AWS MLA' },
        },
      },
      {
        name: 'アーキテクチャ',
        cells: {
          PROFESSIONAL: { title: 'テックリード', skills: 'アーキテクチャ設計／技術選定／チームの技術指導／パフォーマンス設計・チューニング', certs: '応用情報技術者試験／AWS SAP／Azure Solutions Architect Expert／GCP Professional Cloud Architect' },
          EXPERT: { title: 'チーフアーキテクト', skills: '全社技術戦略／大規模システム設計／技術組織のリード', certs: 'システムアーキテクト試験／CKA／AWS SAP' },
        },
      },
    ],
  },
  {
    id: 'infra',
    name: 'クラウドインフラエンジニア',
    color: '#2E6B2E',
    tracks: [
      {
        name: 'クラウドインフラ',
        cells: {
          ENTRY: { title: 'インフラオペレーター', skills: 'サーバ基本設定・運用／NW基本設定・疎通確認／EC2・VPC基礎／監視ツール運用／AIによるコマンド・設定ファイル生成の補助活用', certs: 'ITパスポート試験／AWS CLF／LPIC-1／LinuC Lv1／Azure Fundamentals' },
          ASSOCIATE: { title: 'インフラエンジニア', skills: 'サーバ・NW設計書作成／可用性設計／IaC基礎／クラウド構成設計／ネットワーク影響調整／AIによるIaC（Terraform等）生成・レビュー', certs: '基本情報技術者試験／AWS SAA／CCNA／LPIC-2／Azure Administrator Associate／AWS AIP' },
          PROFESSIONAL: { title: 'シニアインフラエンジニア', skills: '会社全体のサーバ・NW構成統括・設計・管理／インフラ最適化検討／コスト管理／セキュリティ設計／AI（Claude Code等）でのインフラ構築自動化／AIによる障害原因分析', certs: '応用情報技術者試験／AWS DOP／CCNP／LPIC-3／Azure DevOps Engineer Expert' },
          EXPERT: { title: 'インフラアーキテクト', skills: '大規模・複雑環境の統括・設計（マルチクラウド・グローバル対応等）／インフラ最適化推進／組織・チームリード／AIワークロードのインフラ設計（GPU基盤・MLOps）', certs: 'ITサービスマネージャ試験／ネットワークスペシャリスト試験／AWS SAP／CKA／AWS Advanced Networking Specialty／AWS MLA' },
        },
      },
      {
        name: 'セキュリティ',
        cells: {
          PROFESSIONAL: { title: 'セキュリティエンジニア', skills: '防御設計／アクセス制御／インシデント対応／セキュリティポリシー運用', certs: '応用情報技術者試験／情報セキュリティマネジメント試験／AWS SCS／CCSP／CompTIA Security+' },
          EXPERT: { title: 'セキュリティアーキテクト', skills: 'SOC運用統括／サイバー攻撃対策／セキュリティガバナンス／組織全体のセキュリティ戦略', certs: '情報処理安全確保支援士試験／システム監査技術者試験／CISSP／AWS SCS' },
        },
      },
    ],
  },
  {
    id: 'pm',
    name: 'プロジェクトマネージメント',
    color: '#8A6D1A',
    tracks: [
      {
        name: 'PM',
        cells: {
          ASSOCIATE: { title: 'PMO', skills: '進捗・課題管理／ドキュメント整備／会議運営の補佐', certs: 'ITパスポート試験／基本情報技術者試験／認定スクラムマスター（CSM）' },
          PROFESSIONAL: { title: 'PL', skills: '※QA・ソフトウェア・インフラなど領域ごとのリーダーが該当' },
          EXPERT: { title: 'PM', skills: 'プロジェクト全体責任／予算・リスク管理／ステークホルダー調整', certs: 'プロジェクトマネージャ試験／PMP®／ITサービスマネージャ試験' },
        },
      },
    ],
  },
  {
    id: 'biz',
    name: 'ビジネス・推進',
    color: '#B5481F',
    tracks: [
      {
        name: 'バックオフィス・DX推進',
        cells: {
          ENTRY: { title: 'IT管理担当', skills: 'IT機器キッティング・管理／アカウント管理／担当業務理解', certs: 'ITパスポート試験／生成AIプラクティショナー（社内認定）' },
          ASSOCIATE: { title: 'IT運用・改善担当', skills: 'ヘルプデスク対応／社内システム運用／ベンダー管理／RPA構築', certs: '情報セキュリティマネジメント試験／RPA技術者検定／AWS AIP' },
          PROFESSIONAL: { title: 'ITアドミン・DX推進', skills: '社内IT環境の設計・改善／セキュリティポリシー運用／RPA・自動化による業務効率化推進', certs: '基本情報技術者試験／AWS CLF／ITコーディネータ試験' },
          EXPERT: { title: 'IT戦略・DX企画', skills: 'IT投資計画／全社DX推進・システム刷新／情報セキュリティ戦略', certs: '応用情報技術者試験／ITストラテジスト試験／PMP®' },
        },
      },
      {
        name: 'カスタマーサポート',
        cells: {
          ENTRY: { title: 'CS担当者', skills: '問い合わせ対応／一次切り分け／FAQ整備', certs: 'ITパスポート試験' },
          ASSOCIATE: { title: 'CSアナリスト', skills: '問い合わせ傾向の分析／FAQ高度化／対応品質の改善提案', certs: '情報セキュリティマネジメント試験／HDI-CSCA' },
          PROFESSIONAL: { title: 'CSスペシャリスト', skills: '開発・QA・営業など関係部門との連携／不具合エスカレーション／技術的な問題解決', certs: '基本情報技術者試験／HDI-CSCTL' },
          EXPERT: { title: 'CS企画・推進', skills: 'CS組織の設計／KPI策定／プロダクト改善への提言', certs: '応用情報技術者試験／ITサービスマネージャ試験' },
        },
      },
      {
        name: 'データアナリスト',
        cells: {
          ENTRY: { title: 'データオペレーター', skills: 'SQL・BIツール基礎／データ抽出・集計／レポート作成', certs: 'ITパスポート試験／Pythonエンジニア認定基礎試験／AWS AIP' },
          ASSOCIATE: { title: 'データアナリスト', skills: '分析手法・統計学／DWH理解／仮説立案・可視化／課題発見', certs: '基本情報技術者試験／AWS DEA／Pythonデータ分析試験／統計検定2級' },
          PROFESSIONAL: { title: 'データコンサルタント', skills: '改善提案・施策立案／クライアントへのプレゼン／Python・機械学習基礎', certs: '応用情報技術者試験／AWS MLA／Azure Data Scientist Associate／統計検定1級' },
          EXPERT: { title: 'データストラテジスト', skills: 'クライアントのデータ戦略立案／データ基盤設計／組織へのデータ活用推進', certs: 'データベーススペシャリスト試験／AWS MLS／TensorFlow Developer／G検定・E資格' },
        },
      },
      {
        name: 'マーケティング',
        cells: {
          ENTRY: { title: 'コンテンツ担当', skills: 'コンテンツ制作／SEO基礎／Web・SNS運用', certs: 'ITパスポート試験／ウェブ解析士' },
          ASSOCIATE: { title: 'マーケター', skills: 'Web・SNS広告運用／効果測定・分析／PDCAサイクル', certs: 'ウェブ解析士マスター／GAIQ／Google 広告認定資格' },
          PROFESSIONAL: { title: 'マーケティングプランナー', skills: '施策企画・立案／マルチチャネル戦略／データに基づく改善提案', certs: 'GAIQ／HubSpot Marketing Hub 認定資格／Pythonエンジニア認定基礎試験' },
          EXPERT: { title: 'マーケティングストラテジスト', skills: 'マーケ戦略立案／ブランディング／クライアントの市場戦略推進', certs: '応用情報技術者試験／ITストラテジスト試験' },
        },
      },
    ],
  },
];

// ── Build flat card list per stage ──
function buildStageCards(): Record<StageKey, TrackCard[]> {
  const result: Record<StageKey, TrackCard[]> = {
    ACADEMIA: [],
    ENTRY: [],
    ASSOCIATE: [],
    PROFESSIONAL: [],
    EXPERT: [],
  };

  for (const group of TRACK_GROUPS) {
    for (let tIdx = 0; tIdx < group.tracks.length; tIdx++) {
      const track = group.tracks[tIdx];
      const cardId = `${group.id}:${tIdx}`;
      for (const stageKey of Object.keys(track.cells) as StageKey[]) {
        const cell = track.cells[stageKey];
        if (!cell) continue;
        result[stageKey].push({
          trackGroupId: group.id,
          trackName: track.name,
          trackColor: group.color,
          stage: stageKey,
          title: cell.title,
          skills: cell.skills,
          certs: cell.certs,
          cardId,
        });
      }
    }
  }

  return result;
}

const STAGE_CARDS = buildStageCards();



// ── Component ──
export default function CareerMapPage() {
  const [selectedCards, setSelectedCards] = useState<Set<string>>(new Set());
  const [activeGroupFilter, setActiveGroupFilter] = useState<string | null>(null);
  const [hoveredCard, setHoveredCard] = useState<string | null>(null);

  const toggleCard = (cardId: string) => {
    setSelectedCards(prev => {
      const next = new Set(prev);
      if (next.has(cardId)) {
        next.delete(cardId);
      } else {
        next.add(cardId);
      }
      return next;
    });
  };

  const clearSelection = () => {
    setSelectedCards(new Set());
    setActiveGroupFilter(null);
  };

  const toggleGroupFilter = (groupId: string) => {
    setActiveGroupFilter(prev => (prev === groupId ? null : groupId));
  };

  const hasSelection = selectedCards.size > 0;

  // Determine if a card should be highlighted
  const isCardHighlighted = (card: TrackCard): boolean => {
    if (activeGroupFilter) return card.trackGroupId === activeGroupFilter;
    if (hasSelection) return selectedCards.has(card.cardId);
    return false;
  };

  const getCardOpacity = (card: TrackCard): number => {
    if (!hasSelection && !activeGroupFilter) return 1;
    return isCardHighlighted(card) ? 1 : 0.35;
  };

  // Build selected path summary
  const selectedPathCards: TrackCard[] = [];
  if (hasSelection) {
    for (const stage of STAGES) {
      for (const card of STAGE_CARDS[stage.key]) {
        if (selectedCards.has(card.cardId)) {
          selectedPathCards.push(card);
        }
      }
    }
  }

  return (
    <div style={styles.page}>
      {/* Title */}
      <div style={styles.titleBar}>
        <h1 style={styles.title}>Career Roadmap</h1>
        <p style={styles.subtitle}>Widsley エンジニア キャリアロードマップ</p>
      </div>

      {/* Group filter chips */}
      <div style={styles.filterBar}>
        <span style={styles.filterLabel}>トラック:</span>
        <div style={styles.filterChips}>
          {TRACK_GROUPS.map(group => {
            const isActive = activeGroupFilter === group.id;
            return (
              <button
                key={group.id}
                onClick={() => toggleGroupFilter(group.id)}
                style={{
                  ...styles.filterChip,
                  background: isActive ? group.color : '#f1f5f9',
                  color: isActive ? '#fff' : '#475569',
                  borderColor: isActive ? group.color : '#cbd5e1',
                  fontWeight: isActive ? 700 : 500,
                }}
              >
                <span
                  style={{
                    display: 'inline-block',
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    background: group.color,
                    marginRight: 6,
                    opacity: isActive ? 0 : 1,
                  }}
                />
                {group.name}
              </button>
            );
          })}
          {(hasSelection || activeGroupFilter) && (
            <button onClick={clearSelection} style={styles.clearBtn}>
              クリア
            </button>
          )}
        </div>
      </div>

      {/* Roadmap flow */}
      <div style={styles.roadmap}>
        {STAGES.map((stage, stageIdx) => (
          <div key={stage.key}>
            {/* Stage header */}
            <div style={{ ...styles.stageSection }}>
              <div style={{ ...styles.stageHeader, background: stage.gradient }}>
                <div style={styles.stageHeaderTop}>
                  <span style={styles.stageName}>{stage.label}</span>
                  <span style={styles.stageBadge}>
                    {stage.sublabel} {stage.period}
                  </span>
                </div>
                <p style={styles.stageDesc}>{stage.description}</p>
              </div>

              {/* Cards for this stage */}
              {stage.key === 'ACADEMIA' ? (
                // ACADEMIA: single wide card
                <div style={styles.academiaCardWrap}>
                  {STAGE_CARDS.ACADEMIA.map(card => {
                    const opacity = getCardOpacity(card);
                    const highlighted = isCardHighlighted(card);
                    return (
                      <div
                        key={card.cardId + card.title}
                        onClick={() => toggleCard(card.cardId)}
                        onMouseEnter={() => setHoveredCard(card.cardId)}
                        onMouseLeave={() => setHoveredCard(null)}
                        style={{
                          ...styles.academiaCard,
                          borderLeft: `5px solid ${card.trackColor}`,
                          opacity,
                          boxShadow: highlighted
                            ? `0 0 0 2px ${card.trackColor}, 0 4px 20px ${card.trackColor}40`
                            : hoveredCard === card.cardId
                              ? '0 4px 16px rgba(0,0,0,0.12)'
                              : '0 2px 8px rgba(0,0,0,0.06)',
                          transform: hoveredCard === card.cardId ? 'translateY(-1px)' : 'none',
                          transition: 'all 0.2s ease',
                        }}
                      >
                        <div style={styles.cardTitle}>{card.title}</div>
                        <div style={{ ...styles.cardGroup, color: card.trackColor }}>{card.trackName}</div>
                        <div style={styles.cardSkills}>{card.skills}</div>
                        {card.certs && <div style={styles.cardCerts}>{card.certs}</div>}
                      </div>
                    );
                  })}
                </div>
              ) : (
                // Other stages: cards in a flex grid
                <div style={styles.cardsGrid}>
                  {STAGE_CARDS[stage.key].map(card => {
                    const opacity = getCardOpacity(card);
                    const highlighted = isCardHighlighted(card);
                    return (
                      <div
                        key={card.cardId + card.title}
                        onClick={() => toggleCard(card.cardId)}
                        onMouseEnter={() => setHoveredCard(card.cardId)}
                        onMouseLeave={() => setHoveredCard(null)}
                        style={{
                          ...styles.trackCard,
                          borderLeft: `5px solid ${card.trackColor}`,
                          opacity,
                          boxShadow: highlighted
                            ? `0 0 0 2px ${card.trackColor}, 0 4px 20px ${card.trackColor}40`
                            : hoveredCard === card.cardId
                              ? '0 4px 16px rgba(0,0,0,0.12)'
                              : '0 2px 8px rgba(0,0,0,0.06)',
                          transform: hoveredCard === card.cardId ? 'translateY(-1px)' : 'none',
                          transition: 'all 0.2s ease',
                        }}
                      >
                        <div style={styles.cardTitle}>{card.title}</div>
                        <div style={{ ...styles.cardGroup, color: card.trackColor }}>{card.trackName}</div>
                        <div style={styles.cardSkills}>{card.skills}</div>
                        {card.certs && <div style={styles.cardCerts}>{card.certs}</div>}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Arrow connector between stages */}
            {stageIdx < STAGES.length - 1 && (
              <>
                <div style={{ display: 'flex', justifyContent: 'center' }}>
                  <div style={{ width: 3, height: 24, background: '#ddd', borderRadius: 2 }} />
                </div>
                <div style={{
                  display: 'flex',
                  justifyContent: 'center',
                  padding: '0 0 8px',
                }}>
                  <div style={{
                    width: 0,
                    height: 0,
                    borderLeft: '16px solid transparent',
                    borderRight: '16px solid transparent',
                    borderTop: '16px solid #ddd',
                  }} />
                </div>
              </>
            )}
          </div>
        ))}
      </div>

      {/* Floating selected route summary */}
      {hasSelection && (
        <div style={styles.summaryPanel}>
          <div style={styles.summaryHeader}>
            <span style={styles.summaryTitle}>選択中のルート</span>
            <button onClick={clearSelection} style={styles.summaryClear}>
              クリア
            </button>
          </div>
          <div style={styles.summaryCards}>
            {selectedPathCards.map((card, idx) => (
              <div key={card.cardId + card.stage} style={styles.summaryItem}>
                <div
                  style={{
                    ...styles.summaryDot,
                    background: card.trackColor,
                  }}
                />
                <div style={styles.summaryInfo}>
                  <span style={styles.summaryStage}>{card.stage}</span>
                  <span style={styles.summaryRole}>{card.title}</span>
                  <span style={{ ...styles.summaryTrack, color: card.trackColor }}>{card.trackName}</span>
                </div>
                {idx < selectedPathCards.length - 1 && (
                  <div style={styles.summaryArrow}>→</div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Styles ──
const styles: Record<string, CSSProperties> = {
  page: {
    maxWidth: 1100,
    margin: '0 auto',
    padding: '24px 16px 120px',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    position: 'relative',
  },
  titleBar: {
    textAlign: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 32,
    fontWeight: 800,
    color: DEEP_BLUE,
    margin: 0,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 14,
    color: '#64748b',
    marginTop: 4,
  },

  // Filter bar
  filterBar: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    marginBottom: 28,
    padding: '12px 16px',
    background: '#f8fafc',
    borderRadius: 12,
    border: '1px solid #e2e8f0',
    flexWrap: 'wrap' as const,
  },
  filterLabel: {
    fontSize: 13,
    fontWeight: 700,
    color: DEEP_BLUE,
    whiteSpace: 'nowrap' as const,
  },
  filterChips: {
    display: 'flex',
    flexWrap: 'wrap' as const,
    gap: 8,
    alignItems: 'center',
  },
  filterChip: {
    fontSize: 13,
    padding: '6px 14px',
    borderRadius: 20,
    border: '1.5px solid',
    cursor: 'pointer',
    transition: 'all 0.15s ease',
    display: 'flex',
    alignItems: 'center',
    lineHeight: '20px',
    background: 'none',
  },
  clearBtn: {
    fontSize: 12,
    fontWeight: 600,
    padding: '6px 14px',
    borderRadius: 20,
    border: '1.5px solid #ef4444',
    background: '#fff',
    color: '#ef4444',
    cursor: 'pointer',
    lineHeight: '20px',
  },

  // Roadmap
  roadmap: {
    display: 'flex',
    flexDirection: 'column',
  },

  // Stage section
  stageSection: {
    marginBottom: 0,
  },
  stageHeader: {
    padding: '16px 24px',
    borderRadius: 14,
    color: '#fff',
    marginBottom: 16,
  },
  stageHeaderTop: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    marginBottom: 6,
    flexWrap: 'wrap' as const,
  },
  stageName: {
    fontSize: 22,
    fontWeight: 800,
    letterSpacing: 1,
  },
  stageBadge: {
    fontSize: 12,
    fontWeight: 600,
    background: 'rgba(255,255,255,0.2)',
    padding: '3px 10px',
    borderRadius: 12,
  },
  stageDesc: {
    fontSize: 13,
    margin: 0,
    opacity: 0.9,
    lineHeight: 1.5,
  },

  // Cards grid
  cardsGrid: {
    display: 'flex',
    flexWrap: 'wrap' as const,
    gap: 12,
    padding: '0 8px',
    justifyContent: 'center',
  },

  // ACADEMIA special layout
  academiaCardWrap: {
    display: 'flex',
    justifyContent: 'center',
    padding: '0 8px',
  },

  academiaCard: {
    background: '#fff',
    borderRadius: 12,
    padding: '20px 28px',
    cursor: 'pointer',
    maxWidth: 600,
    width: '100%',
    textAlign: 'center' as const,
  },

  // Track card
  trackCard: {
    background: '#fff',
    borderRadius: 12,
    padding: '14px 16px',
    cursor: 'pointer',
    width: 180,
    minWidth: 160,
    flexShrink: 0,
  },

  cardTitle: {
    fontSize: 15,
    fontWeight: 700,
    color: DEEP_BLUE,
    marginBottom: 2,
  },
  cardGroup: {
    fontSize: 11,
    fontWeight: 600,
    marginBottom: 6,
  },
  cardSkills: {
    fontSize: 11,
    color: '#64748b',
    lineHeight: 1.4,
  },
  cardCerts: {
    fontSize: 10,
    color: '#fff',
    background: '#64748b',
    padding: '2px 8px',
    borderRadius: 6,
    display: 'inline-block',
    marginTop: 6,
    lineHeight: 1.4,
  },

  // Summary panel
  summaryPanel: {
    position: 'fixed' as const,
    bottom: 0,
    left: 0,
    right: 0,
    background: '#fff',
    borderTop: `3px solid ${CYAN}`,
    boxShadow: '0 -4px 24px rgba(0,0,0,0.12)',
    padding: '14px 24px',
    zIndex: 1000,
  },
  summaryHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  summaryTitle: {
    fontSize: 14,
    fontWeight: 700,
    color: DEEP_BLUE,
  },
  summaryClear: {
    fontSize: 12,
    fontWeight: 600,
    padding: '4px 12px',
    borderRadius: 12,
    border: '1px solid #ef4444',
    background: '#fff',
    color: '#ef4444',
    cursor: 'pointer',
  },
  summaryCards: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    overflowX: 'auto' as const,
    paddingBottom: 4,
  },
  summaryItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    flexShrink: 0,
  },
  summaryDot: {
    width: 8,
    height: 8,
    borderRadius: '50%',
    flexShrink: 0,
  },
  summaryInfo: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 1,
  },
  summaryStage: {
    fontSize: 9,
    fontWeight: 700,
    color: '#94a3b8',
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
  },
  summaryRole: {
    fontSize: 12,
    fontWeight: 700,
    color: DEEP_BLUE,
    whiteSpace: 'nowrap' as const,
  },
  summaryTrack: {
    fontSize: 10,
    fontWeight: 600,
  },
  summaryArrow: {
    fontSize: 16,
    color: '#94a3b8',
    margin: '0 4px',
    flexShrink: 0,
  },
};
