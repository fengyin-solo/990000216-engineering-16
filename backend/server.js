const initDb = require('./db/init');
const { getDb, getDbPath } = require('./db/init');
const { createApp } = require('./app');

const PORT = process.env.PORT || 3001;

// 启动检查：先确认数据库与示例数据是否就绪，再监听端口
initDb();
const db = getDb();
const articleCount = db.prepare('SELECT COUNT(*) AS count FROM articles').get().count;

const app = createApp();

const server = app.listen(PORT, () => {
  console.log('--- 启动检查 ---');
  console.log(`[端口] 服务已就绪: http://localhost:${PORT}`);
  console.log(`[数据库] ${getDbPath()}`);
  if (articleCount > 0) {
    console.log(`[示例数据] 已就绪：${articleCount} 篇文章`);
  } else {
    console.warn('[示例数据] 为空，请先运行 npm run seed');
  }
  console.log('----------------');
  console.log('Server running on port', PORT);
});

function shutdown() {
  server.close(() => {
    db.close();
    process.exit(0);
  });
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
