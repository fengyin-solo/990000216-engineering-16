#!/usr/bin/env node
/**
 * 启动环境检查（只读，不写入任何数据）：
 *   npm run check
 * 明确报告端口、数据库、示例数据是否就绪。
 *
 * 可用环境变量：
 *   PORT       期望服务监听的端口（默认 3001）
 *   BLOG_DB_PATH  数据库文件路径（默认 backend/data/blog.db）
 */
const fs = require('fs');
const net = require('net');
const http = require('http');
const path = require('path');
const Database = require('better-sqlite3');
const { getDbPath } = require('../db/init');

const PORT = Number(process.env.PORT) || 3001;
const DB_PATH = process.env.BLOG_DB_PATH
  ? path.resolve(process.env.BLOG_DB_PATH)
  : getDbPath();

let failures = 0;

function mark(ok, label, detail = '') {
  const icon = ok ? '✓' : '✗';
  console.log(`${icon} ${label}${detail ? ` -> ${detail}` : ''}`);
  if (!ok) failures += 1;
}

async function checkPort(port) {
  return new Promise(resolve => {
    const socket = net.connect({ port, host: '127.0.0.1' });
    socket.setTimeout(1000);

    socket.on('connect', () => {
      socket.destroy();
      resolve(true);
    });
    socket.on('timeout', () => {
      socket.destroy();
      resolve(false);
    });
    socket.on('error', () => resolve(false));
  });
}

function checkApi(port) {
  return new Promise(resolve => {
    const req = http.get(`http://127.0.0.1:${port}/api/articles?limit=1`, res => {
      let raw = '';
      res.on('data', chunk => { raw += chunk; });
      res.on('end', () => {
        try {
          const body = JSON.parse(raw);
          resolve(
            res.statusCode === 200 &&
            Array.isArray(body.articles) &&
            body.pagination &&
            typeof body.pagination.total === 'number'
          );
        } catch {
          resolve(false);
        }
      });
    });
    req.on('error', () => resolve(false));
    req.setTimeout(1500, () => {
      req.destroy();
      resolve(false);
    });
  });
}

async function main() {
  console.log('=== 本地开发环境启动检查 ===');

  // 1) 端口
  const portOpen = await checkPort(PORT);
  mark(portOpen, `端口 ${PORT}`, portOpen ? '已有服务监听' : '未监听（先运行 npm run dev）');

  // 2) 数据库
  const dbExists = fs.existsSync(DB_PATH);
  mark(dbExists, '数据库文件', DB_PATH);

  // 3) 表结构与示例数据（只读方式打开，绝不写入）
  let articleCount = 0;
  let tableReady = false;
  if (dbExists) {
    let db;
    try {
      db = new Database(DB_PATH, { readonly: true, fileMustExist: true });
      tableReady = db
        .prepare("SELECT COUNT(*) AS count FROM sqlite_master WHERE type = 'table' AND name = 'articles'")
        .get().count === 1;
      if (tableReady) {
        articleCount = db.prepare('SELECT COUNT(*) AS count FROM articles').get().count;
      }
    } catch (err) {
      tableReady = false;
    } finally {
      if (db) db.close();
    }
  }
  mark(tableReady, "数据表 'articles'", tableReady ? '结构存在' : '缺失（运行 npm run seed）');
  mark(tableReady && articleCount > 0, '示例数据', tableReady ? `${articleCount} 篇文章` : '无法读取');

  // 4) 端口开放时顺带确认是本服务在响应
  if (portOpen) {
    const apiOk = await checkApi(PORT);
    mark(apiOk, `接口冒烟测试 GET /api/articles`, apiOk ? '200 OK' : '响应异常');
  }

  console.log('============================');
  if (failures > 0) {
    console.log(`检查未通过：${failures} 项。请先执行 npm run seed，再执行 npm run dev。`);
    process.exit(1);
  }
  console.log('环境就绪，可以开始本地验证。');
}

main().catch(err => {
  console.error('检查脚本执行失败：', err);
  process.exit(1);
});
