-- ============================================================
-- 007_add_career_certs.sql
-- Insert certifications referenced in CareerMapPage but missing
-- from the seed data. Uses ON CONFLICT DO NOTHING for safety.
-- ============================================================

-- IVEC series (QA推奨)
INSERT INTO certifications (name, description, level, category, reward, sort_order)
VALUES
  ('IVEC アシスタントクラス', 'IVECテスト技術者資格の入門レベル。テスト実施の基礎力を認定', 'entry', 'QA推奨', NULL, 100),
  ('IVEC テスタークラス', 'IVECテスト技術者資格。テスト設計・分析の実践力を認定', 'associate', 'QA推奨', NULL, 101),
  ('IVEC デザイナークラス', 'IVECテスト技術者資格。テスト計画・戦略策定の能力を認定', 'professional', 'QA推奨', NULL, 102),
  ('IVEC アーキテクトクラス', 'IVECテスト技術者資格の最上位。組織的品質マネジメント力を認定', 'expert', 'QA推奨', NULL, 103)
ON CONFLICT (name) DO NOTHING;

-- JCSQE series (QA推奨)
INSERT INTO certifications (name, description, level, category, reward, sort_order)
VALUES
  ('JCSQE 初級', 'ソフトウェア品質技術者資格の初級。品質管理の基礎知識を認定', 'associate', 'QA推奨', NULL, 104),
  ('JCSQE 中級', 'ソフトウェア品質技術者資格の中級。品質保証の実践的能力を認定', 'professional', 'QA推奨', NULL, 105),
  ('JCSQE 上級', 'ソフトウェア品質技術者資格の上級。品質戦略の策定・推進力を認定', 'expert', 'QA推奨', NULL, 106)
ON CONFLICT (name) DO NOTHING;

-- セキュリティ系 (ベンダーニュートラル系)
INSERT INTO certifications (name, description, level, category, reward, sort_order)
VALUES
  ('CompTIA Security+', 'CompTIA認定のセキュリティ基礎資格。ネットワークセキュリティの実務知識を認定', 'associate', 'ベンダーニュートラル系', NULL, 107),
  ('CEH', 'Certified Ethical Hacker。倫理的ハッキング技術とペネトレーションテストの能力を認定', 'professional', 'ベンダーニュートラル系', NULL, 108),
  ('OSCP', 'Offensive Security Certified Professional。実践的な侵入テスト技術を認定する上級資格', 'expert', 'ベンダーニュートラル系', NULL, 109),
  ('SecuriST 脆弱性診断士', 'Webアプリケーションの脆弱性診断スキルを認定する資格', 'professional', 'ベンダーニュートラル系', NULL, 110),
  ('徳丸基礎試験', 'ウェブ・セキュリティ基礎試験。Webセキュリティの基本知識を認定', 'professional', 'ベンダーニュートラル系', NULL, 111)
ON CONFLICT (name) DO NOTHING;

-- GitHub Foundations (ベンダー系)
INSERT INTO certifications (name, description, level, category, reward, sort_order)
VALUES
  ('GitHub Foundations', 'GitHub公式の基礎認定。GitHubプラットフォームの基本操作と概念を認定', 'professional', 'ベンダー系', NULL, 112)
ON CONFLICT (name) DO NOTHING;

-- ISACA CISA (ベンダーニュートラル系)
INSERT INTO certifications (name, description, level, category, reward, sort_order)
VALUES
  ('ISACA CISA', '公認情報システム監査人。情報システムの監査・管理・セキュリティの専門資格', 'expert', 'ベンダーニュートラル系', NULL, 113)
ON CONFLICT (name) DO NOTHING;

-- 認定スクラムマスター (ベンダーニュートラル系)
INSERT INTO certifications (name, description, level, category, reward, sort_order)
VALUES
  ('認定スクラムマスター', 'Scrum Allianceが認定するスクラムマスター資格。アジャイル開発の推進力を認定', 'expert', 'ベンダーニュートラル系', NULL, 114),
  ('認定スクラムマスター(CSM)', 'Certified ScrumMaster。スクラムフレームワークの実践的理解を認定', 'associate', 'ベンダーニュートラル系', NULL, 115)
ON CONFLICT (name) DO NOTHING;

-- G検定・E資格 (AI系)
INSERT INTO certifications (name, description, level, category, reward, sort_order)
VALUES
  ('G検定', 'JDLA認定。ディープラーニングの基礎知識と事業活用能力を認定', 'professional', 'AI系', NULL, 116),
  ('G検定・E資格', 'JDLA認定のG検定およびE資格。AI・深層学習の理論と実装力を認定', 'expert', 'AI系', NULL, 117)
ON CONFLICT (name) DO NOTHING;

-- RPA技術者検定 (ベンダーニュートラル系)
INSERT INTO certifications (name, description, level, category, reward, sort_order)
VALUES
  ('RPA技術者検定', 'RPA導入・構築に関する技術知識を認定する資格', 'associate', 'ベンダーニュートラル系', NULL, 118)
ON CONFLICT (name) DO NOTHING;

-- ITコーディネータ (国家資格)
INSERT INTO certifications (name, description, level, category, reward, sort_order)
VALUES
  ('ITコーディネータ', '経済産業省推進のIT経営推進資格。IT戦略策定と実行支援力を認定', 'professional', '国家資格', NULL, 119)
ON CONFLICT (name) DO NOTHING;

-- HDI系 (ベンダーニュートラル系)
INSERT INTO certifications (name, description, level, category, reward, sort_order)
VALUES
  ('HDI-CSCA', 'HDI認定カスタマーサービスアナリスト。顧客対応の分析・改善力を認定', 'associate', 'ベンダーニュートラル系', NULL, 120),
  ('HDI-CSCTL', 'HDI認定カスタマーサービスチームリーダー。CS組織のリーダーシップ力を認定', 'professional', 'ベンダーニュートラル系', NULL, 121)
ON CONFLICT (name) DO NOTHING;

-- 統計検定 (ベンダーニュートラル系)
INSERT INTO certifications (name, description, level, category, reward, sort_order)
VALUES
  ('統計検定2級', '大学基礎課程レベルの統計学知識と応用力を認定する検定', 'associate', 'ベンダーニュートラル系', NULL, 122),
  ('統計検定1級', '大学専門課程レベルの高度な統計学理論と応用力を認定する検定', 'professional', 'ベンダーニュートラル系', NULL, 123)
ON CONFLICT (name) DO NOTHING;

-- マーケティング系 (ベンダーニュートラル系 / ベンダー系)
INSERT INTO certifications (name, description, level, category, reward, sort_order)
VALUES
  ('ウェブ解析士', 'ウェブ解析の基礎知識とデータ活用力を認定する資格', 'entry', 'ベンダーニュートラル系', NULL, 124),
  ('ウェブ解析士マスター', 'ウェブ解析の上級資格。戦略立案と組織指導力を認定', 'associate', 'ベンダーニュートラル系', NULL, 125),
  ('GAIQ', 'Google Analytics Individual Qualification。Googleアナリティクスの活用能力を認定', 'associate', 'ベンダー系', NULL, 126),
  ('Google 広告認定', 'Google公式の広告認定資格。Google広告の運用・最適化スキルを認定', 'associate', 'ベンダー系', NULL, 127),
  ('HubSpot認定', 'HubSpot公式認定。インバウンドマーケティングとCRM活用力を認定', 'professional', 'ベンダー系', NULL, 128)
ON CONFLICT (name) DO NOTHING;
