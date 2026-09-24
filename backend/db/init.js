const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

// 允许通过 BLOG_DB_PATH 指定数据库文件，供本地验证使用独立的临时数据库
const DB_PATH = process.env.BLOG_DB_PATH
  ? path.resolve(process.env.BLOG_DB_PATH)
  : path.join(__dirname, '..', 'data', 'blog.db');

let db;

function getDbPath() {
  return DB_PATH;
}

function getDb() {
  if (!db) {
    fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
  }
  return db;
}

function initDb() {
  const db = getDb();

  db.exec(`
    CREATE TABLE IF NOT EXISTS articles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      body TEXT NOT NULL,
      summary TEXT,
      tags TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  return db;
}

function closeDb() {
  if (db) {
    db.close();
    db = null;
  }
}

module.exports = initDb;
module.exports.getDb = getDb;
module.exports.getDbPath = getDbPath;
module.exports.closeDb = closeDb;
