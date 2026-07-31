import express from 'express';
import cors from 'cors';
import { requireAuth } from './auth.js';
import { masterRouter } from './routes/master.js';
import { profilesRouter } from './routes/profiles.js';
import { assessmentsRouter } from './routes/assessments.js';
import { invitationsRouter } from './routes/invitations.js';
import { certificationsRouter } from './routes/certifications.js';

const app = express();
app.use(cors({ origin: (process.env.CORS_ORIGIN ?? '').split(',').filter(Boolean) }));
app.use(express.json());

// 注: /healthz はGCP側で予約済みのパスでCloud Runまで到達しないため使わない
app.get('/health', (_req, res) => res.status(200).send('ok'));

app.use(requireAuth);

app.get('/me', (req, res) => res.json(req.profile));

app.use(masterRouter);
app.use(profilesRouter);
app.use(assessmentsRouter);
app.use(invitationsRouter);
app.use(certificationsRouter);

// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  res.status(500).json({ error: err.message });
});

const port = process.env.PORT ? Number(process.env.PORT) : 8080;
app.listen(port, () => console.log(`ssi-qa-advance-api listening on ${port}`));
