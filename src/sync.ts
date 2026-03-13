import axios from "axios";
import pool from "./db.js";

const MOCK_API_URL = process.env.MOCK_API_URL || 'http://localhost:3001';

export async function runSync() {
    const client = await pool.connect();

    try {
        console.log('starting integration sync...');

        const [customerRes, invoiceRes, paymentRes] = await Promise.all([
            axios.get(`${MOCK_API_URL}/customers`),
            axios.get(`${MOCK_API_URL}/invoices`),
            axios.get(`${MOCK_API_URL}/payments`),
        ]);

        const customers = customerRes.data;
        const invoices = invoiceRes.data;
        const payments = paymentRes.data;

        await client.query('BEGIN');

        for (const c of customers) {
           await client.query(
            `INSERT INTO customers (id, name, email)
             VALUES ($1, $2, $3)
             ON CONFLICT (id) DO UPDATE
             SET name = EXCLUDED.name, email = EXCLUDED.email, updated_at = CURRENT_TIMESTAMP
            `,
            [c.id, c.name, c.email]
           );
        }
        console.log(`synced ${customers.length} customers.`)

        for (const i of invoices) {
            await client.query(
             `INSERT INTO invoices (id, customer_id, amount, status, due_date) 
              VALUES ($1, $2, $3, $4, $5) 
              ON CONFLICT (id) DO UPDATE 
              SET amount = EXCLUDED.amount, status = EXCLUDED.status, due_date = EXCLUDED.due_date, updated_at = CURRENT_TIMESTAMP`,
              [i.id, i.customer_id, i.amount, i.status, i.due_date]
            );
        }
        console.log(`synced ${invoices.length} invoices.`);

        for (const p of payments) {
            await client.query(
             `INSERT INTO payments (id, invoice_id, amount, payment_date) 
              VALUES ($1, $2, $3, $4) 
              ON CONFLICT (id) DO UPDATE 
              SET amount = EXCLUDED.amount, payment_date = EXCLUDED.payment_date`,
              [p.id, p.invoice_id, p.amount, p.date]
            );
        }
        console.log(`synced ${payments.length} payments.`);

        await client.query('COMMIT');
        console.log('sync completed successfully!');
    } catch(err) {
        await client.query('ROLLBACK'),
        console.error('sync failed, rolled back db changes', err);
        throw err;
    } finally {
        client.release();
    }
}