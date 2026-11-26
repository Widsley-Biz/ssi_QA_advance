import crypto from 'node:crypto';
import { Router } from 'express';
import { pool } from '../db.js';
import { classifyMfExpenseMail, type ProfileForMatch, type CertificationForMatch } from '../lib/mfExpenseClassifier.js';
import { setCertificationAcquired } from './certifications.js';

export const mfExpenseIntakeRouter = Router();

/**
 * ZapierからのMF経費承認通知メールを受け取るエンドポイント。
 * Firebase IDトークンを持たない外部サービスからの呼び出しのため、
 * server/src/index.ts で /health と同様に requireAuth より前にマウントする。
 * 代わりに共有シークレット(ヘッダー)のみで認証する。
 */
function timingSafeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

interface IntakeBody {
  subject?: string;
  body?: string;
  from?: string;
  messageId?: string;
  receivedAt?: string;
}

mfExpenseIntakeRouter.post('/integrations/mf-expense-intake', async (req, res) => {
  const secret = process.env.MF_INTAKE_SECRET;
  if (!secret) {
    // シークレット未設定のまま受け付けると「誰でも叩ける」状態になるため、
    // ヘッダーの有無に関わらず常に拒否する(fail closed)。
    console.error('MF_INTAKE_SECRET is not set; rejecting all mf-expense-intake requests');
    res.status(500).json({ error: 'intake not configured' });
    return;
  }
  const provided = req.headers['x-intake-secret'];
  if (typeof provided !== 'string' || !timingSafeEqual(provided, secret)) {
    res.status(403).json({ error: 'forbidden' });
    return;
  }

  const { subject = '', body = '', messageId, receivedAt } = req.body as IntakeBody;

  try {
    const inserted = await pool.query<{ id: number }>(
      `INSERT INTO mf_expense_intake_log
         (received_at, source_message_id, raw_subject, raw_body, action_taken)
       VALUES (COALESCE($1::timestamptz, now()), $2, $3, $4, 'needs_review')
       ON CONFLICT (source_message_id) WHERE source_message_id IS NOT NULL DO NOTHING
       RETURNING id`,
      [receivedAt ?? null, messageId ?? null, subject, body],
    );

    if (inserted.rows.length === 0) {
      // Zapierの再送(at-least-once)などで同じメールが2回届いた場合。何もせず成功を返す。
      res.status(200).json({ status: 'duplicate' });
      return;
    }
    const logId = inserted.rows[0].id;

    const [{ rows: profiles }, { rows: certifications }] = await Promise.all([
      pool.query<ProfileForMatch>("SELECT id, display_name FROM profiles WHERE role != 'retired'"),
      pool.query<CertificationForMatch>('SELECT id, name, aliases FROM certifications'),
    ]);

    const classification = classifyMfExpenseMail(subject, body, profiles, certifications);

    if (
      classification.outcome === 'acquired_set' &&
      classification.matchedUserId &&
      classification.matchedCertificationId
    ) {
      await setCertificationAcquired(classification.matchedUserId, classification.matchedCertificationId, {
        confirmedBy: 'system:mf-expense',
        mfApplicationUrl: classification.mfApplicationUrl,
      });
    }

    await pool.query(
      `UPDATE mf_expense_intake_log
       SET parsed = $2, matched_user_id = $3, matched_certification_id = $4,
           action_taken = $5, mf_application_url = $6
       WHERE id = $1`,
      [
        logId,
        JSON.stringify({
          applicantNameGuess: classification.applicantNameGuess,
          certificationNameGuess: classification.certificationNameGuess,
        }),
        classification.matchedUserId,
        classification.matchedCertificationId,
        classification.outcome,
        classification.mfApplicationUrl,
      ],
    );

    if (classification.outcome === 'needs_review') {
      try {
        await notifySlackNeedsReview(logId, subject, classification.applicantNameGuess, classification.certificationNameGuess);
      } catch (err) {
        // Slack通知の失敗で本処理(ログ記録)まで失敗扱いにしない
        console.error('Slack notify failed (non-fatal):', err);
      }
    }

    res.status(200).json({ status: classification.outcome });
  } catch (err) {
    console.error('mf-expense-intake failed:', err);
    res.status(500).json({ error: 'internal error' });
  }
});

async function notifySlackNeedsReview(
  logId: number,
  subject: string,
  applicantNameGuess: string | null,
  certificationNameGuess: string | null,
): Promise<void> {
  const webhookUrl = process.env.SLACK_DX_WEBHOOK_URL;
  if (!webhookUrl) {
    console.warn('SLACK_DX_WEBHOOK_URL not set; skipping Slack notification');
    return;
  }
  const adminLogUrl = `https://skillcheck.widsley.site/admin/certs?intake=${logId}`;
  const text = [
    ':mag: MF経費連携: 要確認の申請があります',
    `件名: ${subject || '(件名なし)'}`,
    `申請者(推定): ${applicantNameGuess ?? '不明'}`,
    `資格(推定): ${certificationNameGuess ?? '不明'}`,
    `管理画面で確認: ${adminLogUrl}`,
  ].join('\n');

  const response = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  });
  if (!response.ok) {
    throw new Error(`Slack webhook returned ${response.status}`);
  }
}
