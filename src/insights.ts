import type { Request, Response } from "express";
import pool from "./db.js";

export const getCustomerBalance = async (req: Request, res: Response) => {
    const {id} = req.params;

    try {
        // used common table expression to aggregate invoices and payments separately before joining, this prevents the bug where joining multiple payments to multiple invoices causes duplicated sums.
        const query = `
        WITH InvoiceTotals AS (
            SELECT customer_id, SUM(amount) as total_invoiced
            FROM invoices
            WHERE customer_id = $1
            GROUP BY customer_id
        ),
        PaymentTotals AS (
            SELECT i.customer_id, SUM(p.amount) as total_paid
            FROM payments p
            JOIN invoices i ON p.invoice_id = i.id
            WHERE i.customer_id = $1
            GROUP BY i.customer_id
        )
        SELECT
            c.id, c.name, 
            COALESCE(i.total_invoiced, 0) AS total_invoiced,
            COALESCE(p.total_paid, 0) AS total_paid,
            (COALESCE(i.total_invoiced, 0) - COALESCE(p.total_paid, 0)) AS outstanding_balance
        FROM customers c
        LEFT JOIN InvoiceTotals i ON c.id = i.customer_id
        LEFT JOIN PaymentTotals p ON c.id = p.customer_id
        WHERE c.id = $1;
        `;

        const {rows} = await pool.query(query, [id]);
        if(rows.length === 0) {
            return res.status(404).json({error: 'customer not found'});
        }

        res.json(rows[0]);
    } catch(err) {
       console.error('error fetching customer balance:', err);
       res.status(500).json({error: 'internal server error'});
    }
};

export const getOverdueInvoices = async (req: Request, res: Response) => {
    try {
        // We join invoices and payments, group by the invoice, and use a HAVING to only return invoices where the due date is in the past AND the balance > 0.
        const query = `
            SELECT 
                i.id AS invoice_id,
                c.name AS customer_name,
                i.amount AS invoice_total,
                COALESCE(SUM(p.amount), 0) AS amount_paid,
                (i.amount - COALESCE(SUM(p.amount), 0)) AS balance_due,
                i.due_date
            FROM invoices i
            JOIN customers c ON i.customer_id = c.id
            LEFT JOIN payments p ON i.id = p.invoice_id
            WHERE i.due_date < CURRENT_TIMESTAMP
            GROUP BY i.id, c.name, i.amount, i.due_date
            HAVING (i.amount - COALESCE(SUM(p.amount), 0)) > 0
            ORDER BY i.due_date ASC;
          `;
        
        const {rows} = await pool.query(query);
        res.json({count: rows.length, overdue_invoices: rows});

    } catch(err) {
        console.error('Error fetching overdue invoices:', err);
        res.status(500).json({error: 'internal server error'});
    }
};