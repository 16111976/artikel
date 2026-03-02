-- Datenbank für DerDieDas (kann per Backend oder einmalig ausgeführt werden)
CREATE DATABASE IF NOT EXISTS derdiedas
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE derdiedas;

CREATE TABLE IF NOT EXISTS nouns (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  lemma VARCHAR(191) NOT NULL,
  article ENUM('der','die','das') NOT NULL,
  ending VARCHAR(50) DEFAULT NULL,
  base_example TEXT DEFAULT NULL,
  mnemonic TEXT DEFAULT NULL,
  freq_dwds TINYINT UNSIGNED DEFAULT NULL COMMENT '0-6 DWDS',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_nouns_lemma (lemma),
  KEY idx_nouns_article (article),
  KEY idx_nouns_freq (freq_dwds)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
