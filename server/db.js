import mysql from "mysql2/promise";

const MYSQL_HOST = process.env.MYSQL_HOST || "localhost";
const MYSQL_PORT = Number(process.env.MYSQL_PORT) || 3306;
const MYSQL_USER = process.env.MYSQL_USER || "root";
const MYSQL_PASSWORD = process.env.MYSQL_PASSWORD || "root";
const MYSQL_DATABASE = process.env.MYSQL_DATABASE || "derdiedas";

let pool = null;

async function createPool(options = {}) {
  return mysql.createPool({
    host: MYSQL_HOST,
    port: MYSQL_PORT,
    user: MYSQL_USER,
    password: MYSQL_PASSWORD,
    waitForConnections: true,
    connectionLimit: 10,
    charset: "utf8mb4",
    ...options
  });
}

export async function ensureDatabaseAndTable() {
  const adminPool = await createPool({ database: null });
  try {
    await adminPool.query(
      "CREATE DATABASE IF NOT EXISTS ?? CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci",
      [MYSQL_DATABASE]
    );
  } finally {
    await adminPool.end();
  }

  pool = await createPool({ database: MYSQL_DATABASE });
  await pool.query(`
    CREATE TABLE IF NOT EXISTS nouns (
      id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      lemma VARCHAR(191) NOT NULL,
      article ENUM('der','die','das') NOT NULL,
      ending VARCHAR(50) DEFAULT NULL,
      base_example TEXT DEFAULT NULL,
      mnemonic TEXT DEFAULT NULL,
      freq_dwds TINYINT UNSIGNED DEFAULT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uq_nouns_lemma (lemma),
      KEY idx_nouns_article (article),
      KEY idx_nouns_freq (freq_dwds)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  return pool;
}

export function getPool() {
  return pool;
}

export async function closePool() {
  if (pool) {
    await pool.end();
    pool = null;
  }
}
