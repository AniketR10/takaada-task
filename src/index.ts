import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import pool from './db.js';
import { runSync } from './sync.js';
import { getCustomerBalance, getOverdueInvoices } from './insights.js';

dotenv.config();

const app = express();
const port  = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.get('/health', async (req, res) => {
    try {
        const dbres = await pool.query('SELECT NOW()');
        res.json({
            status: 'ok',
            message: 'server and db are healthy',
            db_time: dbres.rows[0].now
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({status: 'error', message: 'db connection failed'});
    }
});

app.post(`/api/sync`, async (req, res) => {
    try {
        await runSync();
        res.json({status: 'success', message: 'data synced successfully'});
    } catch(err) {
        res.status(500).json({status: 'error', message: 'failed to sync data'});
    }
});

app.get('/api/insights/customers/:id/balance', getCustomerBalance);
app.get('/api/insights/invoices/overdue', getOverdueInvoices);

app.listen(port, () => {
    console.log(` service is running on http://localhost:${port}`);
})
