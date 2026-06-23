import { useState } from 'react';
import type { CSSProperties } from 'react';

// ── Brand colors ──
const DEEP_BLUE = '#03202F';
const CYAN = '#3DB7E4';

// ── Types ──
type StageKey = 'ACADEMIA' | 'ENTRY' | 'ASSOCIATE' | 'PROFESSIONAL' | 'EXPERT';

interface StageInfo {
  key: StageKey;
  label: string;
  sublabel: string;
  period: string;
  gradient: string;
}

interface CellData {
  title: string;
  role: string;
  skills: string[];
  certs?: string[];
}

interface TrackDef {
  name: string;
  cells: Partial<Record<StageKey, CellData>>;
}

interface TrackGroupDef {
  id: string;
  name: string;
  color: string;
  tracks: TrackDef[];
}

// ── Stage definitions ──
const STAGES: StageInfo[] = [
  {
    key: 'ACADEMIA',
    label: 'ACADEMIA',
    sublabel: 'IT未経験者',
    period: '0〜半年',
    gradient: 'linear-gradient(135deg, #1e293b 0%, #334155 100%)',
  },
  {
    key: 'ENTRY',
    label: 'ENTRY',
    sublabel: 'IT初心者',
    period: '半年〜1年',
    gradient: `linear-gradient(135deg, ${CYAN} 0%, #2196F3 100%)`,
  },
  {
    key: 'ASSOCIATE',
    label: 'ASSOCIATE',
    sublabel: 'IT中級者',
    period: '1〜3年',
    gradient: 'linear-gradient(135deg, #50DAB0 0%, #26a69a 100%)',
  },
  {
    key: 'PROFESSIONAL',
    label: 'PROFESSIONAL',
    sublabel: 'IT上級者',
    period: '3〜5年',
    gradient: 'linear-gradient(135deg, #E21776 0%, #c2185b 100%)',
  },
  {
    key: 'EXPERT',
    label: 'EXPERT',
    sublabel: 'ITエキスパート',
    period: '5年〜',
    gradient: 'linear-gradient(135deg, #7c3aed 0%, #5b21b6 100%)',
  },
];

// ── Track group data ──
const TRACK_GROUPS: TrackGroupDef[] = [
  {
    id: 'qa',
    name: 'QAエンジニア',
    color: '#7B2FB0',
    tracks: [
      {
        name: 'QAエンジニア',
        cells: {
          ACADEMIA: {
            title: 'QA基礎',
            role: 'QA基礎知識を学び、テスト実施の基本を身につける',
            skills: ['社会人基礎力', 'QA基礎知識', 'テスト技法理解', 'テスト実施（指導下）'],
            certs: ['JSTQB FL'],
          },
          ENTRY: {
            title: '実行者',
            role: 'テスト仕様書に基づき、バグを確実に発見・報告すること',
            skills: ['テスト技法の基礎', 'Jira等バグ管理ツールの操作', '不具合起票'],
            certs: ['IVEC アシスタントクラス'],
          },
          ASSOCIATE: {
            title: '設計者',
            role: '仕様書を読み解き、抜け漏れのないテストケースを設計すること',
            skills: ['高度なテスト設計技法', '基本的な自動化ツールの運用', '開発者との円滑なコミュニケーション'],
            certs: ['JSTQB TA', 'JCSQE 初級', 'IVEC テスタークラス'],
          },
          PROFESSIONAL: {
            title: '推進者',
            role: '効率的なテスト計画と、リスクに基づいた優先順位付け',
            skills: ['テスト戦略の策定', '自動化フレームワークの構築', '不具合分析によるプロセス改善提案'],
            certs: ['JSTQB TM', 'JCSQE 中級', 'IVEC デザイナークラス'],
          },
          EXPERT: {
            title: 'マネージャー',
            role: 'QAチームの採用・育成、予算管理、組織全体の品質指標の定義化',
            skills: ['プロダクト経営視点', '品質保証コスト（CoQ）の最適化'],
            certs: ['JCSQE 上級', 'IVEC アーキテクトクラス', '認定スクラムマスター'],
          },
        },
      },
      {
        name: '自動化系',
        cells: {
          ENTRY: {
            title: '実行者',
            role: 'テスト仕様書に基づき、バグを確実に発見・報告すること',
            skills: ['テスト技法の基礎', 'Jira等バグ管理ツールの操作', '不具合起票'],
            certs: ['ITパスポート', 'IVEC アシスタントクラス'],
          },
          ASSOCIATE: {
            title: '自動化ユーザー',
            role: 'ノーコードツールや録画機能でテストを作成できる。HTML構造を理解し要素を特定できる',
            skills: ['Autify/mabl/Selenium IDE', 'HTML/CSS', 'SQL基礎'],
            certs: ['Python 3 基礎試験', 'Oracle Java Silver'],
          },
          PROFESSIONAL: {
            title: '自動化エンジニア',
            role: 'コードを書いてテストを自動化できる。APIテストやCI/CDへの組み込みができる',
            skills: ['Python/Playwright', 'GitHub', 'CI/CDツール', 'API(Postman)'],
            certs: ['AWS CLF', 'JSTQB TAE', 'GitHub Foundations'],
          },
          EXPERT: {
            title: 'QAアーキテクト',
            role: '組織全体の自動化戦略を立てる。保守性の高いフレームワークを設計し、ROIを管理する',
            skills: ['アーキテクチャ設計', 'Docker', '負荷テスト', 'チームマネジメント'],
            certs: ['AWS SAA/SAP', 'JSTQB AL-TM', 'ISACA CISA'],
          },
        },
      },
      {
        name: 'セキュリティ系',
        cells: {
          ASSOCIATE: {
            title: '侵害分析',
            role: '代表的な脆弱性を理解し、脆弱性の再現確認やリスク説明ができる',
            skills: ['OWASP基礎', '認証/認可の基本', '情報漏えい対策', '脆弱性再現', '基本対策の説明'],
            certs: ['ISC2 CC', 'CompTIA Security+'],
          },
          PROFESSIONAL: {
            title: '防御設計支援',
            role: 'セキュリティ観点でテスト設計・診断・優先度判断を行い、設計改善や対策提案を支援できる',
            skills: ['攻撃シナリオ設計', '脆弱性連鎖分析', '認証設計レビュー', '被害影響分析', 'リスク評価'],
            certs: ['徳丸基礎試験', 'SecuriST 脆弱性診断士', 'SSCP', 'CEH'],
          },
          EXPERT: {
            title: 'セキュリティレビュー・リード',
            role: '仕様・設計レビューを通じて問題を指摘し、教育・改善活動を通じて組織へ影響を与えられる',
            skills: ['セキュア構成レビュー', 'アクセス制御設計', 'データ保護設計', 'セキュリティ教育設計', '組織改善推進'],
            certs: ['情報処理安全確保支援士(SC)', 'CISSP', 'OSCP'],
          },
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
          ENTRY: {
            title: 'プログラマー',
            role: 'プログラミング基礎を習得し、詳細設計に基づくコーディングを行う',
            skills: ['プログラミング基礎', '詳細設計', 'バージョン管理', 'AIツール補完活用'],
            certs: ['ITパスポート', 'Java 3級', 'Oracle Bronze', 'Python基礎試験'],
          },
          ASSOCIATE: {
            title: 'ジュニアエンジニア',
            role: '基本設計・DB設計・API設計を行い、非機能要件を把握できる',
            skills: ['基本設計', 'DB設計', 'API設計', '非機能要件の把握', 'クラウド基礎'],
            certs: ['基本情報技術者', 'Java Silver', 'AWS CLF', 'AWS AIP'],
          },
          PROFESSIONAL: {
            title: 'シニアエンジニア',
            role: '要件定義・顧客折衝・見積もり・プロジェクト技術リードを行う',
            skills: ['要件定義', '顧客折衝', '見積もり', 'パフォーマンス設計', 'LLM API組み込み'],
            certs: ['応用情報技術者', 'Java Gold', 'AWS SAA', 'G検定'],
          },
          EXPERT: {
            title: 'システムコンサルタント',
            role: 'ドメイン知識を深化し、業務コンサルティング・提案・PoC主導を行う',
            skills: ['ドメイン知識の深化', '業務コンサルティング', '提案・PoC主導', 'RAG/エージェント構築'],
            certs: ['システムアーキテクト', 'ITストラテジスト', 'AWS SAP', 'AWS MLA'],
          },
        },
      },
      {
        name: 'アーキテクチャ',
        cells: {
          PROFESSIONAL: {
            title: 'テックリード',
            role: 'アーキテクチャ設計・技術選定・チームの技術指導を行う',
            skills: ['アーキテクチャ設計', '技術選定', 'チームの技術指導', 'パフォーマンス設計'],
            certs: ['応用情報技術者', 'AWS SAP', 'Azure Solutions Architect'],
          },
          EXPERT: {
            title: 'チーフアーキテクト',
            role: '全社技術戦略・大規模システム設計・技術組織のリードを行う',
            skills: ['全社技術戦略', '大規模システム設計', '技術組織のリード'],
            certs: ['システムアーキテクト', 'CKA', 'AWS SAP'],
          },
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
          ENTRY: {
            title: 'インフラオペレーター',
            role: 'サーバ基本設定・運用、NW基本設定・疎通確認を行う',
            skills: ['サーバ基本設定・運用', 'NW基本設定', 'EC2・VPC基礎', '監視ツール運用'],
            certs: ['ITパスポート', 'AWS CLF', 'LPIC-1', 'Azure Fundamentals'],
          },
          ASSOCIATE: {
            title: 'インフラエンジニア',
            role: 'サーバ・NW設計書作成、可用性設計、IaC基礎を行う',
            skills: ['サーバ・NW設計書作成', '可用性設計', 'IaC基礎', 'クラウド構成設計'],
            certs: ['基本情報技術者', 'AWS SAA', 'CCNA', 'LPIC-2'],
          },
          PROFESSIONAL: {
            title: 'シニアインフラエンジニア',
            role: '会社全体のサーバ・NW構成統括・設計・管理を行う',
            skills: ['インフラ最適化検討', 'コスト管理', 'セキュリティ設計', 'インフラ構築自動化'],
            certs: ['応用情報技術者', 'AWS DOP', 'CCNP', 'LPIC-3'],
          },
          EXPERT: {
            title: 'インフラアーキテクト',
            role: '大規模・複雑環境の統括・設計（マルチクラウド・グローバル対応等）',
            skills: ['インフラ最適化推進', '組織・チームリード', 'AIワークロードのインフラ設計'],
            certs: ['ITサービスマネージャ', 'ネットワークスペシャリスト', 'AWS SAP', 'CKA'],
          },
        },
      },
      {
        name: 'セキュリティ',
        cells: {
          PROFESSIONAL: {
            title: 'セキュリティエンジニア',
            role: '防御設計・アクセス制御・インシデント対応・セキュリティポリシー運用',
            skills: ['防御設計', 'アクセス制御', 'インシデント対応', 'セキュリティポリシー運用'],
            certs: ['応用情報技術者', 'AWS SCS', 'CCSP', 'CompTIA Security+'],
          },
          EXPERT: {
            title: 'セキュリティアーキテクト',
            role: 'SOC運用統括・サイバー攻撃対策・セキュリティガバナンス',
            skills: ['SOC運用統括', 'サイバー攻撃対策', 'セキュリティガバナンス'],
            certs: ['情報処理安全確保支援士', 'CISSP', 'AWS SCS'],
          },
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
          ASSOCIATE: {
            title: 'PMO',
            role: '進捗・課題管理、ドキュメント整備、会議運営の補佐',
            skills: ['進捗・課題管理', 'ドキュメント整備', '会議運営の補佐'],
            certs: ['ITパスポート', '基本情報技術者', '認定スクラムマスター(CSM)'],
          },
          PROFESSIONAL: {
            title: 'PL',
            role: 'QA・ソフトウェア・インフラなど領域ごとのリーダーが該当',
            skills: ['チームリード', '領域別プロジェクト管理'],
          },
          EXPERT: {
            title: 'PM',
            role: 'プロジェクト全体責任、予算・リスク管理、ステークホルダー調整',
            skills: ['プロジェクト全体責任', '予算・リスク管理', 'ステークホルダー調整'],
            certs: ['プロジェクトマネージャ試験', 'PMP', 'ITサービスマネージャ'],
          },
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
          ENTRY: {
            title: 'IT管理担当',
            role: 'IT機器キッティング・管理、アカウント管理、担当業務理解',
            skills: ['IT機器キッティング・管理', 'アカウント管理', '担当業務理解'],
            certs: ['ITパスポート'],
          },
          ASSOCIATE: {
            title: 'IT運用・改善担当',
            role: 'ヘルプデスク対応、社内システム運用、ベンダー管理',
            skills: ['ヘルプデスク対応', '社内システム運用', 'ベンダー管理', 'RPA構築'],
            certs: ['情報セキュリティマネジメント', 'RPA技術者検定'],
          },
          PROFESSIONAL: {
            title: 'ITアドミン・DX推進',
            role: '社内IT環境の設計・改善、セキュリティポリシー運用',
            skills: ['社内IT環境の設計・改善', 'セキュリティポリシー運用', 'RPA・自動化推進'],
            certs: ['基本情報技術者', 'AWS CLF', 'ITコーディネータ'],
          },
          EXPERT: {
            title: 'IT戦略・DX企画',
            role: 'IT投資計画、全社DX推進・システム刷新、情報セキュリティ戦略',
            skills: ['IT投資計画', '全社DX推進', '情報セキュリティ戦略'],
            certs: ['応用情報技術者', 'ITストラテジスト', 'PMP'],
          },
        },
      },
      {
        name: 'カスタマーサポート',
        cells: {
          ENTRY: {
            title: 'CS担当者',
            role: '問い合わせ対応、一次切り分け、FAQ整備',
            skills: ['問い合わせ対応', '一次切り分け', 'FAQ整備'],
            certs: ['ITパスポート'],
          },
          ASSOCIATE: {
            title: 'CSアナリスト',
            role: '問い合わせ傾向の分析、FAQ高度化、対応品質の改善提案',
            skills: ['問い合わせ傾向の分析', 'FAQ高度化', '対応品質の改善提案'],
            certs: ['情報セキュリティマネジメント', 'HDI-CSCA'],
          },
          PROFESSIONAL: {
            title: 'CSスペシャリスト',
            role: '関係部門との連携、不具合エスカレーション、技術的な問題解決',
            skills: ['関係部門との連携', '不具合エスカレーション', '技術的な問題解決'],
            certs: ['基本情報技術者', 'HDI-CSCTL'],
          },
          EXPERT: {
            title: 'CS企画・推進',
            role: 'CS組織の設計、KPI策定、プロダクト改善への提言',
            skills: ['CS組織の設計', 'KPI策定', 'プロダクト改善への提言'],
            certs: ['応用情報技術者', 'ITサービスマネージャ'],
          },
        },
      },
      {
        name: 'データアナリスト',
        cells: {
          ENTRY: {
            title: 'データオペレーター',
            role: 'SQL・BIツール基礎、データ抽出・集計、レポート作成',
            skills: ['SQL・BIツール基礎', 'データ抽出・集計', 'レポート作成'],
            certs: ['ITパスポート', 'Python基礎試験', 'AWS AIP'],
          },
          ASSOCIATE: {
            title: 'データアナリスト',
            role: '分析手法・統計学を用い、仮説立案・可視化・課題発見',
            skills: ['分析手法・統計学', 'DWH理解', '仮説立案・可視化', '課題発見'],
            certs: ['基本情報技術者', 'AWS DEA', '統計検定2級'],
          },
          PROFESSIONAL: {
            title: 'データコンサルタント',
            role: '改善提案・施策立案、クライアントへのプレゼン',
            skills: ['改善提案・施策立案', 'クライアントプレゼン', 'Python・機械学習基礎'],
            certs: ['応用情報技術者', 'AWS MLA', '統計検定1級'],
          },
          EXPERT: {
            title: 'データストラテジスト',
            role: 'クライアントのデータ戦略立案、データ基盤設計、データ活用推進',
            skills: ['データ戦略立案', 'データ基盤設計', 'データ活用推進'],
            certs: ['DBスペシャリスト', 'AWS MLS', 'G検定・E資格'],
          },
        },
      },
      {
        name: 'マーケティング',
        cells: {
          ENTRY: {
            title: 'コンテンツ担当',
            role: 'コンテンツ制作、SEO基礎、Web・SNS運用',
            skills: ['コンテンツ制作', 'SEO基礎', 'Web・SNS運用'],
            certs: ['ITパスポート', 'ウェブ解析士'],
          },
          ASSOCIATE: {
            title: 'マーケター',
            role: 'Web・SNS広告運用、効果測定・分析、PDCAサイクル',
            skills: ['広告運用', '効果測定・分析', 'PDCAサイクル'],
            certs: ['ウェブ解析士マスター', 'GAIQ', 'Google 広告認定'],
          },
          PROFESSIONAL: {
            title: 'マーケティングプランナー',
            role: '施策企画・立案、マルチチャネル戦略、データに基づく改善提案',
            skills: ['施策企画・立案', 'マルチチャネル戦略', 'データに基づく改善'],
            certs: ['GAIQ', 'HubSpot認定', 'Python基礎試験'],
          },
          EXPERT: {
            title: 'マーケティングストラテジスト',
            role: 'マーケ戦略立案、ブランディング、クライアントの市場戦略推進',
            skills: ['マーケ戦略立案', 'ブランディング', '市場戦略推進'],
            certs: ['応用情報技術者', 'ITストラテジスト'],
          },
        },
      },
    ],
  },
];

// ── Flatten all tracks with unique IDs ──
interface FlatTrack {
  trackId: string;
  groupId: string;
  groupName: string;
  trackName: string;
  color: string;
  cells: Partial<Record<StageKey, CellData>>;
  /** First stage index where a cell exists */
  startIdx: number;
  /** Last stage index where a cell exists */
  endIdx: number;
}

const STAGE_KEYS: StageKey[] = ['ACADEMIA', 'ENTRY', 'ASSOCIATE', 'PROFESSIONAL', 'EXPERT'];

function buildFlatTracks(): FlatTrack[] {
  const result: FlatTrack[] = [];
  for (const group of TRACK_GROUPS) {
    for (let tIdx = 0; tIdx < group.tracks.length; tIdx++) {
      const track = group.tracks[tIdx];
      const trackId = `${group.id}:${tIdx}`;
      const stageIndices = STAGE_KEYS
        .map((k, i) => (track.cells[k] ? i : -1))
        .filter(i => i >= 0);
      result.push({
        trackId,
        groupId: group.id,
        groupName: group.name,
        trackName: track.name,
        color: group.color,
        cells: track.cells,
        startIdx: stageIndices.length > 0 ? stageIndices[0] : 0,
        endIdx: stageIndices.length > 0 ? stageIndices[stageIndices.length - 1] : 0,
      });
    }
  }
  return result;
}

const FLAT_TRACKS = buildFlatTracks();

// ── Column widths ──
const LABEL_COL_W = 140;
const STAGE_COL_W = 220;
const GAP_COL_W = 48;
const ROW_H = 200;
const HEADER_H = 80;
const TOTAL_W = LABEL_COL_W + STAGE_KEYS.length * STAGE_COL_W + (STAGE_KEYS.length - 1) * GAP_COL_W + 40;

// ── Component ──
export default function CareerMapPage() {
  const [activeGroupFilter, setActiveGroupFilter] = useState<string | null>(null);
  const [selectedTrackId, setSelectedTrackId] = useState<string | null>(null);
  const [hoveredCard, setHoveredCard] = useState<string | null>(null);

  const hasSelection = activeGroupFilter !== null || selectedTrackId !== null;

  const isTrackHighlighted = (track: FlatTrack): boolean => {
    if (selectedTrackId) return track.trackId === selectedTrackId;
    if (activeGroupFilter) return track.groupId === activeGroupFilter;
    return false;
  };

  const getTrackOpacity = (track: FlatTrack): number => {
    if (!hasSelection) return 1;
    return isTrackHighlighted(track) ? 1 : 0.4;
  };

  const toggleGroupFilter = (groupId: string) => {
    setSelectedTrackId(null);
    setActiveGroupFilter(prev => (prev === groupId ? null : groupId));
  };

  const handleCardClick = (trackId: string) => {
    setActiveGroupFilter(null);
    setSelectedTrackId(prev => (prev === trackId ? null : trackId));
  };

  const clearSelection = () => {
    setActiveGroupFilter(null);
    setSelectedTrackId(null);
  };

  /** Get x position for a stage column */
  const stageX = (stageIdx: number): number => {
    return LABEL_COL_W + stageIdx * (STAGE_COL_W + GAP_COL_W);
  };

  /** Get y position for a track row */
  const trackY = (trackIdx: number): number => {
    return HEADER_H + trackIdx * ROW_H;
  };

  // Build selected path summary
  const selectedTrack = selectedTrackId ? FLAT_TRACKS.find(t => t.trackId === selectedTrackId) : null;

  return (
    <div style={styles.page}>
      {/* Title */}
      <div style={styles.titleBar}>
        <h1 style={styles.title}>Career Roadmap</h1>
        <p style={styles.subtitle}>Widsley エンジニア キャリアロードマップ</p>
      </div>

      {/* Instruction + filter chips */}
      <div style={styles.filterBar}>
        <div style={styles.filterInstruction}>
          なりたい職種を選んでルートを確認
        </div>
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
                    background: isActive ? '#fff' : group.color,
                    marginRight: 6,
                    flexShrink: 0,
                  }}
                />
                {group.name}
              </button>
            );
          })}
          {hasSelection && (
            <button onClick={clearSelection} style={styles.clearBtn}>
              クリア
            </button>
          )}
        </div>
        <div style={styles.hintBox}>
          まだ決まってない方へ：Entry/Associateレベルでは幅広くスキルを身につけることで、どの専門にも進めます
        </div>
      </div>

      {/* Horizontal scrollable pathway map */}
      <div style={styles.scrollContainer}>
        <div style={{ ...styles.mapContainer, width: TOTAL_W, height: HEADER_H + FLAT_TRACKS.length * ROW_H + 40 }}>

          {/* Stage column headers */}
          {STAGES.map((stage, sIdx) => {
            const x = stageX(sIdx);
            return (
              <div
                key={stage.key}
                style={{
                  position: 'absolute',
                  left: x,
                  top: 0,
                  width: STAGE_COL_W,
                  height: HEADER_H - 8,
                  background: stage.gradient,
                  borderRadius: 12,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#fff',
                  zIndex: 10,
                }}
              >
                <div style={{ fontSize: 16, fontWeight: 800, letterSpacing: 1 }}>{stage.label}</div>
                <div style={{ fontSize: 11, opacity: 0.85, marginTop: 2 }}>
                  {stage.sublabel} / {stage.period}
                </div>
              </div>
            );
          })}

          {/* Arrow connectors between stage headers */}
          {STAGES.slice(0, -1).map((_, sIdx) => {
            const x1 = stageX(sIdx) + STAGE_COL_W;
            const x2 = stageX(sIdx + 1);
            const midY = (HEADER_H - 8) / 2;
            return (
              <div
                key={`header-arrow-${sIdx}`}
                style={{
                  position: 'absolute',
                  left: x1,
                  top: midY - 1,
                  width: x2 - x1,
                  height: 2,
                  background: '#cbd5e1',
                  zIndex: 5,
                }}
              >
                {/* Arrow head */}
                <div style={{
                  position: 'absolute',
                  right: -1,
                  top: -5,
                  width: 0,
                  height: 0,
                  borderTop: '6px solid transparent',
                  borderBottom: '6px solid transparent',
                  borderLeft: '8px solid #cbd5e1',
                }} />
              </div>
            );
          })}

          {/* Track rows */}
          {FLAT_TRACKS.map((track, tIdx) => {
            const opacity = getTrackOpacity(track);
            const highlighted = isTrackHighlighted(track);
            const rowTop = trackY(tIdx);

            // Line from first to last cell
            const lineStartX = stageX(track.startIdx) + STAGE_COL_W / 2;
            const lineEndX = stageX(track.endIdx) + STAGE_COL_W / 2;
            const lineCenterY = rowTop + ROW_H / 2;

            return (
              <div key={track.trackId} style={{ opacity, transition: 'opacity 0.3s ease' }}>
                {/* Track label (left column) */}
                <div
                  style={{
                    position: 'absolute',
                    left: 0,
                    top: rowTop,
                    width: LABEL_COL_W - 8,
                    height: ROW_H,
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center',
                    alignItems: 'flex-end',
                    paddingRight: 12,
                    zIndex: 5,
                  }}
                >
                  <div
                    style={{
                      width: 10,
                      height: 10,
                      borderRadius: '50%',
                      background: track.color,
                      marginBottom: 4,
                    }}
                  />
                  <div style={{
                    fontSize: 12,
                    fontWeight: 700,
                    color: track.color,
                    textAlign: 'right',
                    lineHeight: 1.3,
                  }}>
                    {track.trackName}
                  </div>
                  <div style={{
                    fontSize: 10,
                    color: '#94a3b8',
                    textAlign: 'right',
                  }}>
                    {track.groupName}
                  </div>
                </div>

                {/* Connecting line through the row */}
                <div
                  style={{
                    position: 'absolute',
                    left: lineStartX,
                    top: lineCenterY - 1,
                    width: lineEndX - lineStartX,
                    height: highlighted ? 4 : 2,
                    background: highlighted ? track.color : '#e2e8f0',
                    borderRadius: 2,
                    zIndex: 1,
                    transition: 'all 0.3s ease',
                    boxShadow: highlighted ? `0 0 8px ${track.color}60` : 'none',
                  }}
                />

                {/* Cells/Cards at each stage */}
                {STAGE_KEYS.map((stageKey, sIdx) => {
                  const cell = track.cells[stageKey];
                  if (!cell) {
                    // If the line passes through this stage, draw a dot
                    if (sIdx > track.startIdx && sIdx < track.endIdx) {
                      return (
                        <div
                          key={`${track.trackId}-${stageKey}-pass`}
                          style={{
                            position: 'absolute',
                            left: stageX(sIdx) + STAGE_COL_W / 2 - 4,
                            top: lineCenterY - 4,
                            width: 8,
                            height: 8,
                            borderRadius: '50%',
                            background: highlighted ? track.color : '#cbd5e1',
                            zIndex: 2,
                            transition: 'all 0.3s ease',
                          }}
                        />
                      );
                    }
                    return null;
                  }

                  const cardKey = `${track.trackId}-${stageKey}`;
                  const isHovered = hoveredCard === cardKey;
                  const isCardActive = highlighted || isHovered;

                  return (
                    <div
                      key={cardKey}
                      onClick={() => handleCardClick(track.trackId)}
                      onMouseEnter={() => setHoveredCard(cardKey)}
                      onMouseLeave={() => setHoveredCard(null)}
                      style={{
                        position: 'absolute',
                        left: stageX(sIdx) + 4,
                        top: rowTop + 12,
                        width: STAGE_COL_W - 8,
                        height: ROW_H - 24,
                        background: '#fff',
                        borderRadius: 10,
                        borderLeft: `4px solid ${track.color}`,
                        padding: '10px 12px',
                        cursor: 'pointer',
                        zIndex: 3,
                        overflow: 'hidden',
                        boxShadow: isCardActive
                          ? `0 0 0 2px ${track.color}40, 0 4px 16px rgba(0,0,0,0.12)`
                          : '0 1px 4px rgba(0,0,0,0.08)',
                        transform: isHovered ? 'scale(1.02)' : 'scale(1)',
                        transition: 'all 0.2s ease',
                      }}
                    >
                      {/* Station dot on the line */}
                      <div style={{
                        position: 'absolute',
                        left: (STAGE_COL_W - 8) / 2 - 8,
                        top: ROW_H / 2 - 12 - 8,
                        width: 16,
                        height: 16,
                        borderRadius: '50%',
                        background: highlighted ? track.color : '#fff',
                        border: `3px solid ${track.color}`,
                        zIndex: 4,
                        boxShadow: highlighted ? `0 0 6px ${track.color}80` : 'none',
                        transition: 'all 0.3s ease',
                      }} />

                      {/* Card content */}
                      <div style={{ position: 'relative', zIndex: 5 }}>
                        <div style={styles.cardTitle}>{cell.title}</div>
                        <div style={{ ...styles.cardTrackLabel, background: `${track.color}18`, color: track.color }}>
                          {track.groupName}
                        </div>
                        <div style={styles.cardRole}>{cell.role}</div>
                        <div style={styles.cardSkillsSection}>
                          {cell.skills.slice(0, 3).map((skill, i) => (
                            <span key={i} style={styles.skillTag}>{skill}</span>
                          ))}
                          {cell.skills.length > 3 && (
                            <span style={styles.skillMore}>+{cell.skills.length - 3}</span>
                          )}
                        </div>
                        {cell.certs && cell.certs.length > 0 && (
                          <div style={styles.certRow}>
                            {cell.certs.slice(0, 2).map((cert, i) => (
                              <span key={i} style={styles.certBadge}>{cert}</span>
                            ))}
                            {cell.certs.length > 2 && (
                              <span style={styles.certMore}>+{cell.certs.length - 2}</span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}

                {/* Arrow segments between consecutive cells in this track */}
                {STAGE_KEYS.map((stageKey, sIdx) => {
                  if (sIdx === 0) return null;
                  const prevKey = STAGE_KEYS[sIdx - 1];
                  const hasCurr = !!track.cells[stageKey];
                  const hasPrev = !!track.cells[prevKey];
                  // Draw arrow only between two existing consecutive cells
                  if (!hasCurr || !hasPrev) return null;
                  const arrowX = stageX(sIdx) - GAP_COL_W / 2;
                  return (
                    <div
                      key={`${track.trackId}-arrow-${sIdx}`}
                      style={{
                        position: 'absolute',
                        left: arrowX - 4,
                        top: lineCenterY - 6,
                        width: 0,
                        height: 0,
                        borderTop: '6px solid transparent',
                        borderBottom: '6px solid transparent',
                        borderLeft: `8px solid ${highlighted ? track.color : '#cbd5e1'}`,
                        zIndex: 2,
                        transition: 'all 0.3s ease',
                      }}
                    />
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>

      {/* Selected track summary panel */}
      {selectedTrack && (
        <div style={styles.summaryPanel}>
          <div style={styles.summaryHeader}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{
                width: 12,
                height: 12,
                borderRadius: '50%',
                background: selectedTrack.color,
              }} />
              <span style={styles.summaryTitle}>
                {selectedTrack.groupName} / {selectedTrack.trackName}
              </span>
            </div>
            <button onClick={clearSelection} style={styles.summaryClear}>
              クリア
            </button>
          </div>
          <div style={styles.summaryCards}>
            {STAGE_KEYS.map((stageKey, sIdx) => {
              const cell = selectedTrack.cells[stageKey];
              if (!cell) return null;
              return (
                <div key={stageKey} style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                  <div style={styles.summaryItem}>
                    <div style={{
                      ...styles.summaryDot,
                      background: selectedTrack.color,
                    }} />
                    <div style={styles.summaryInfo}>
                      <span style={styles.summaryStage}>{stageKey}</span>
                      <span style={styles.summaryRole}>{cell.title}</span>
                    </div>
                  </div>
                  {/* Arrow to next existing cell */}
                  {(() => {
                    const hasNext = STAGE_KEYS.slice(sIdx + 1).some(k => !!selectedTrack.cells[k]);
                    return hasNext ? <div style={styles.summaryArrow}>→</div> : null;
                  })()}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Styles ──
const styles: Record<string, CSSProperties> = {
  page: {
    margin: '0 auto',
    padding: '24px 16px 120px',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    position: 'relative',
    maxWidth: 1400,
  },
  titleBar: {
    textAlign: 'center',
    marginBottom: 20,
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
    marginBottom: 24,
    padding: '16px 20px',
    background: '#f8fafc',
    borderRadius: 14,
    border: '1px solid #e2e8f0',
  },
  filterInstruction: {
    fontSize: 14,
    fontWeight: 700,
    color: DEEP_BLUE,
    marginBottom: 10,
  },
  filterChips: {
    display: 'flex',
    flexWrap: 'wrap' as const,
    gap: 8,
    alignItems: 'center',
    marginBottom: 10,
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
  hintBox: {
    fontSize: 12,
    color: '#64748b',
    background: '#fff',
    border: '1px dashed #cbd5e1',
    borderRadius: 8,
    padding: '8px 12px',
    lineHeight: 1.5,
  },

  // Scroll container
  scrollContainer: {
    overflowX: 'auto' as const,
    overflowY: 'visible' as const,
    paddingBottom: 20,
    WebkitOverflowScrolling: 'touch',
  },
  mapContainer: {
    position: 'relative' as const,
    minHeight: 400,
  },

  // Card content styles
  cardTitle: {
    fontSize: 15,
    fontWeight: 800,
    color: DEEP_BLUE,
    marginBottom: 3,
    lineHeight: 1.2,
  },
  cardTrackLabel: {
    display: 'inline-block',
    fontSize: 10,
    fontWeight: 600,
    padding: '1px 8px',
    borderRadius: 8,
    marginBottom: 4,
  },
  cardRole: {
    fontSize: 11,
    color: '#475569',
    lineHeight: 1.4,
    marginBottom: 6,
    display: '-webkit-box',
    WebkitLineClamp: 2,
    WebkitBoxOrient: 'vertical' as const,
    overflow: 'hidden',
  },
  cardSkillsSection: {
    display: 'flex',
    flexWrap: 'wrap' as const,
    gap: 3,
    marginBottom: 4,
  },
  skillTag: {
    fontSize: 9,
    color: '#64748b',
    background: '#f1f5f9',
    padding: '1px 6px',
    borderRadius: 4,
    whiteSpace: 'nowrap' as const,
  },
  skillMore: {
    fontSize: 9,
    color: '#94a3b8',
    fontWeight: 600,
  },
  certRow: {
    display: 'flex',
    flexWrap: 'wrap' as const,
    gap: 3,
  },
  certBadge: {
    fontSize: 9,
    color: '#fff',
    background: '#64748b',
    padding: '1px 6px',
    borderRadius: 4,
    whiteSpace: 'nowrap' as const,
  },
  certMore: {
    fontSize: 9,
    color: '#94a3b8',
    fontWeight: 600,
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
  summaryArrow: {
    fontSize: 16,
    color: '#94a3b8',
    margin: '0 4px',
    flexShrink: 0,
  },
};
