const express = require('express');
const cors = require('cors');
const articlesRouter = require('./routes/articles');
const authRouter = require('./routes/auth');
const tagsRouter = require('./routes/tags');

// Express 应用工厂：不绑定端口，便于本地验证脚本在临时端口上复用同一套路由
function createApp() {
  const app = express();

  app.use(cors());
  app.use(express.json());

  app.use('/api/auth', authRouter);
  app.use('/api/articles', articlesRouter);
  app.use('/api/tags', tagsRouter);

  // 统一错误处理
  app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ error: 'Internal server error' });
  });

  return app;
}

module.exports = { createApp };
