import { Pool } from "pg";
import dotenv from "dotenv";
const path = require("path");

dotenv.config({ path: path.resolve(__dirname, "../../config/.env") });
export const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: String(process.env.DB_PASSWORD),
  port: Number(process.env.DB_PORT || 5432),
});
