-- ============================================================
-- seed_certifications.sql  –  Insert all certification data
-- ============================================================

-- Clear existing data
TRUNCATE certifications CASCADE;

-- ============================================================
-- Academia (level: academia, reward: どちらかマストで取得)
-- ============================================================
INSERT INTO certifications (name, description, level, category, reward, sort_order) VALUES
  ('JSTQB Foundation Level',  '', 'academia', 'QA推奨', 'どちらかマストで取得', 1),
  ('ISTQB Foundation Level',  '', 'academia', 'QA推奨', 'どちらかマストで取得', 2);

-- ============================================================
-- Entry (level: entry, reward: 報奨金10,000円)
-- ============================================================
INSERT INTO certifications (name, description, level, category, reward, sort_order) VALUES
  ('ITパスポート試験',                                                          '', 'entry', '国家資格',           '報奨金10,000円', 1),
  ('情報セキュリティマネジメント試験',                                          '', 'entry', '国家資格',           '報奨金10,000円', 2),
  ('AWS Certified Cloud Practitioner',                                          '', 'entry', 'ベンダー系',         '報奨金10,000円', 3),
  ('AWS Certified AI Practitioner',                                             '', 'entry', 'ベンダー系',         '報奨金10,000円', 4),
  ('Oracle Master Bronze',                                                      '', 'entry', 'ベンダー系',         '報奨金10,000円', 5),
  ('Oracle Certified Java Programmer, Bronze SE',                               '', 'entry', 'ベンダー系',         '報奨金10,000円', 6),
  ('Microsoft Certified: Azure Fundamentals',                                   '', 'entry', 'ベンダー系',         '報奨金10,000円', 7),
  ('Microsoft Certified: Azure Data Fundamentals',                              '', 'entry', 'ベンダー系',         '報奨金10,000円', 8),
  ('Microsoft Certified: Security, Compliance, and Identity Fundamentals',      '', 'entry', 'ベンダー系',         '報奨金10,000円', 9),
  ('LPIC-1',                                                                    '', 'entry', 'ベンダーニュートラル系', '報奨金10,000円', 10),
  ('LinuCレベル1',                                                              '', 'entry', 'ベンダーニュートラル系', '報奨金10,000円', 11),
  ('Pythonエンジニア認定基礎試験',                                              '', 'entry', 'ベンダーニュートラル系', '報奨金10,000円', 12),
  ('Pythonエンジニア認定データ分析試験',                                        '', 'entry', 'ベンダーニュートラル系', '報奨金10,000円', 13),
  ('HTML5プロフェッショナル認定試験 レベル1',                                   '', 'entry', 'ベンダーニュートラル系', '報奨金10,000円', 14),
  ('Javaプログラミング能力認定試験 3級',                                        '', 'entry', 'ベンダーニュートラル系', '報奨金10,000円', 15),
  ('Certified in Cybersecurity (CC)',                                            '', 'entry', 'ベンダーニュートラル系', '報奨金10,000円', 16),
  ('Microsoft Certified: Azure AI Fundamentals',                                '', 'entry', 'AI系',               '報奨金10,000円', 17),
  ('生成AIプラクティショナー 社内認定資格',                                    '', 'entry', '社内認定資格',       '報奨金10,000円', 18),
  ('Playwright 社内認定資格',                                                   '', 'entry', '社内認定資格',       '報奨金10,000円', 19);

-- ============================================================
-- Associate (level: associate, reward: 報奨金30,000円)
-- ============================================================
INSERT INTO certifications (name, description, level, category, reward, sort_order) VALUES
  ('基本情報技術者試験',                                                                '', 'associate', '国家資格',           '報奨金30,000円', 1),
  ('JSTQB Advanced Level テストアナリスト',                                              '', 'associate', 'QA推奨',             '報奨金30,000円', 2),
  ('JSTQB Advanced Level テストマネージャ',                                              '', 'associate', 'QA推奨',             '報奨金30,000円', 3),
  ('ISTQB Advanced Level',                                                               '', 'associate', 'QA推奨',             '報奨金30,000円', 4),
  ('AWS Certified Solutions Architect - Associate',                                       '', 'associate', 'ベンダー系',         '報奨金30,000円', 5),
  ('AWS Certified Developer - Associate',                                                 '', 'associate', 'ベンダー系',         '報奨金30,000円', 6),
  ('AWS Certified SysOps Administrator - Associate',                                      '', 'associate', 'ベンダー系',         '報奨金30,000円', 7),
  ('AWS Certified Data Engineer - Associate',                                             '', 'associate', 'ベンダー系',         '報奨金30,000円', 8),
  ('AWS Certified Machine Learning Engineer - Associate',                                 '', 'associate', 'ベンダー系',         '報奨金30,000円', 9),
  ('CCNA',                                                                                '', 'associate', 'ベンダー系',         '報奨金30,000円', 10),
  ('Oracle Master Silver',                                                                '', 'associate', 'ベンダー系',         '報奨金30,000円', 11),
  ('Oracle Master Silver SQL',                                                            '', 'associate', 'ベンダー系',         '報奨金30,000円', 12),
  ('Oracle Certified Java Programmer, Silver SE 11',                                      '', 'associate', 'ベンダー系',         '報奨金30,000円', 13),
  ('Microsoft Certified: Azure Security Engineer Associate',                              '', 'associate', 'ベンダー系',         '報奨金30,000円', 14),
  ('Microsoft Certified: Azure Network Engineer Associate',                               '', 'associate', 'ベンダー系',         '報奨金30,000円', 15),
  ('Microsoft Certified: Azure Administrator Associate',                                  '', 'associate', 'ベンダー系',         '報奨金30,000円', 16),
  ('Microsoft Certified: Azure Developer Associate',                                      '', 'associate', 'ベンダー系',         '報奨金30,000円', 17),
  ('Microsoft Certified: Windows Server Hybrid Administrator Associate',                  '', 'associate', 'ベンダー系',         '報奨金30,000円', 18),
  ('Microsoft Certified: Azure Database Administrator Associate',                         '', 'associate', 'ベンダー系',         '報奨金30,000円', 19),
  ('Microsoft Certified: Azure Data Scientist Associate',                                 '', 'associate', 'ベンダー系',         '報奨金30,000円', 20),
  ('Microsoft Certified: Fabric Analytics Engineer Associate',                            '', 'associate', 'ベンダー系',         '報奨金30,000円', 21),
  ('Microsoft Certified: Fabric Data Engineer Associate',                                 '', 'associate', 'ベンダー系',         '報奨金30,000円', 22),
  ('Microsoft Certified: Identity and Access Administrator Associate',                    '', 'associate', 'ベンダー系',         '報奨金30,000円', 23),
  ('Microsoft Certified: Security Operations Analyst Associate',                          '', 'associate', 'ベンダー系',         '報奨金30,000円', 24),
  ('Microsoft Certified: Information Security Administrator Associate',                   '', 'associate', 'ベンダー系',         '報奨金30,000円', 25),
  ('LPIC-2',                                                                              '', 'associate', 'ベンダーニュートラル系', '報奨金30,000円', 26),
  ('LinuCレベル2',                                                                        '', 'associate', 'ベンダーニュートラル系', '報奨金30,000円', 27),
  ('Pythonエンジニア認定データ分析実践試験',                                              '', 'associate', 'ベンダーニュートラル系', '報奨金30,000円', 28),
  ('Pythonエンジニア認定実践試験',                                                        '', 'associate', 'ベンダーニュートラル系', '報奨金30,000円', 29),
  ('HTML5プロフェッショナル認定試験 レベル2',                                             '', 'associate', 'ベンダーニュートラル系', '報奨金30,000円', 30),
  ('Javaプログラミング能力認定試験 2級',                                                  '', 'associate', 'ベンダーニュートラル系', '報奨金30,000円', 31),
  ('OpenJS Node.js Application Developer (JSNAD)',                                        '', 'associate', 'ベンダーニュートラル系', '報奨金30,000円', 32),
  ('Systems Security Certified Practitioner (SSCP)',                                      '', 'associate', 'ベンダーニュートラル系', '報奨金30,000円', 33),
  ('Microsoft Certified: Azure AI Engineer Associate',                                    '', 'associate', 'AI系',               '報奨金30,000円', 34);

-- ============================================================
-- Professional (level: professional, reward: 報奨金40,000円)
-- ============================================================
INSERT INTO certifications (name, description, level, category, reward, sort_order) VALUES
  ('応用情報技術者試験',                                                        '', 'professional', '国家資格',           '報奨金40,000円', 1),
  ('JSTQB Specialist テスト自動化エンジニア',                                    '', 'professional', 'QA推奨',             '報奨金40,000円', 2),
  ('AWS Certified Solutions Architect - Professional',                           '', 'professional', 'ベンダー系',         '報奨金40,000円', 3),
  ('AWS Certified DevOps Engineer - Professional',                               '', 'professional', 'ベンダー系',         '報奨金40,000円', 4),
  ('CCNP',                                                                       '', 'professional', 'ベンダー系',         '報奨金40,000円', 5),
  ('Oracle Master Gold',                                                         '', 'professional', 'ベンダー系',         '報奨金40,000円', 6),
  ('Oracle Certified Java Programmer, Gold SE 11',                               '', 'professional', 'ベンダー系',         '報奨金40,000円', 7),
  ('Microsoft Certified: Azure Solutions Architect Expert',                      '', 'professional', 'ベンダー系',         '報奨金40,000円', 8),
  ('Microsoft Certified: DevOps Engineer Expert',                                '', 'professional', 'ベンダー系',         '報奨金40,000円', 9),
  ('Microsoft Certified: Cybersecurity Architect Expert',                        '', 'professional', 'ベンダー系',         '報奨金40,000円', 10),
  ('Claude Certified Architect',                                                 '', 'professional', 'ベンダー系',         '報奨金40,000円', 11),
  ('LPIC-3',                                                                     '', 'professional', 'ベンダーニュートラル系', '報奨金40,000円', 12),
  ('LinuCレベル3',                                                               '', 'professional', 'ベンダーニュートラル系', '報奨金40,000円', 13),
  ('Meta Front-End Developer Professional Certificate',                          '', 'professional', 'ベンダーニュートラル系', '報奨金40,000円', 14),
  ('Pythonとネットワークの自動化基礎検定',                                      '', 'professional', 'ベンダーニュートラル系', '報奨金40,000円', 15),
  ('Javaプログラミング能力認定試験 1級',                                        '', 'professional', 'ベンダーニュートラル系', '報奨金40,000円', 16),
  ('Certified Cloud Security Professional (CCSP)',                               '', 'professional', 'ベンダーニュートラル系', '報奨金40,000円', 17),
  ('Certified Secure Software Lifecycle Professional (CSSLP)',                   '', 'professional', 'ベンダーニュートラル系', '報奨金40,000円', 18),
  ('Professional Cloud Developer',                                               '', 'professional', 'AI系',               '報奨金40,000円', 19),
  ('TensorFlow Developer Certificate',                                           '', 'professional', 'AI系',               '報奨金40,000円', 20);

-- ============================================================
-- Expert (level: expert, reward: 毎月10,000円（2つ目から5,000円）)
-- ============================================================
INSERT INTO certifications (name, description, level, category, reward, sort_order) VALUES
  ('データベーススペシャリスト試験',                                              '', 'expert', '国家資格',           '毎月10,000円（2つ目から5,000円）', 1),
  ('ネットワークスペシャリスト試験',                                              '', 'expert', '国家資格',           '毎月10,000円（2つ目から5,000円）', 2),
  ('プロジェクトマネージャ試験',                                                  '', 'expert', '国家資格',           '毎月10,000円（2つ目から5,000円）', 3),
  ('システムアーキテクト試験',                                                    '', 'expert', '国家資格',           '毎月10,000円（2つ目から5,000円）', 4),
  ('ITストラテジスト試験',                                                        '', 'expert', '国家資格',           '毎月10,000円（2つ目から5,000円）', 5),
  ('ITサービスマネージャ試験',                                                    '', 'expert', '国家資格',           '毎月10,000円（2つ目から5,000円）', 6),
  ('システム監査技術者試験',                                                      '', 'expert', '国家資格',           '毎月10,000円（2つ目から5,000円）', 7),
  ('情報処理安全確保支援士試験',                                                  '', 'expert', '国家資格',           '毎月10,000円（2つ目から5,000円）', 8),
  ('ISTQB Certified Tester Expert Level (ISTQB EL)',                              '', 'expert', 'QA推奨',             '毎月10,000円（2つ目から5,000円）', 9),
  ('AWS Certified Advanced Networking - Specialty',                               '', 'expert', 'ベンダー系',         '毎月10,000円（2つ目から5,000円）', 10),
  ('Microsoft Certified: Azure for SAP Workloads Specialty',                      '', 'expert', 'ベンダー系',         '毎月10,000円（2つ目から5,000円）', 11),
  ('Microsoft Certified: Azure Virtual Desktop Specialty',                        '', 'expert', 'ベンダー系',         '毎月10,000円（2つ目から5,000円）', 12),
  ('Microsoft Certified: Azure Cosmos DB Developer Specialty',                    '', 'expert', 'ベンダー系',         '毎月10,000円（2つ目から5,000円）', 13),
  ('AWS Certified Machine Learning - Specialty',                                  '', 'expert', 'ベンダー系',         '毎月10,000円（2つ目から5,000円）', 14),
  ('AWS Certified Security - Specialty',                                          '', 'expert', 'ベンダー系',         '毎月10,000円（2つ目から5,000円）', 15),
  ('Oracle Master Platinum',                                                      '', 'expert', 'ベンダー系',         '毎月10,000円（2つ目から5,000円）', 16),
  ('PMP® (Project Management Professional)',                                      '', 'expert', 'ベンダーニュートラル系', '毎月10,000円（2つ目から5,000円）', 17),
  ('Certified Kubernetes Administrator (CKA)',                                    '', 'expert', 'ベンダーニュートラル系', '毎月10,000円（2つ目から5,000円）', 18),
  ('Certified Information Systems Security Professional (CISSP)',                 '', 'expert', 'ベンダーニュートラル系', '毎月10,000円（2つ目から5,000円）', 19);
