import { Pool } from "pg";
import dotenv from 'dotenv';

dotenv.config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL
})

pool.connect()
    .then(() => console.log('connected to the postgres db'))
    .catch((err) => console.error('db connection error:', err.stack));

export default pool;