import express from 'express';
import cors from 'cors';
import { authRouter } from './routes/auth';
import { pricingRouter } from './routes/pricing';
import { ridesRouter } from './routes/rides';
import { driversRouter } from './routes/drivers';
import { profileRouter } from './routes/profile';
import { messagesRouter } from './routes/messages';
import { adminRouter } from './routes/admin';
import { errorHandler, notFoundHandler } from './middleware/error';

export const app = express();

app.use(cors());
app.use(express.json());

app.get('/api/health', (_req, res) => {
	res.json({ status: 'ok' });
});

app.use('/api/auth', authRouter);
app.use('/api', pricingRouter);
app.use('/api/rides', ridesRouter);
app.use('/api/drivers', driversRouter);
app.use('/api/profile', profileRouter);
app.use('/api/messages', messagesRouter);
app.use('/api/admin', adminRouter);

app.use(notFoundHandler);
app.use(errorHandler);
