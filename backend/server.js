const express = require('express');
const cors = require('cors');
const fs = require('fs');
const initDb = require('./db/init');
const { getDb, DB_PATH } = require('./db/init');
const { sendError } = require('./utils/response');
const articlesRouter = require('./routes/articles');
const authRouter = require('./routes/auth');
const { getTags } = require('./utils/tags');

const app = express();
const PORT = process.env.PORT || 3001;

// Initialize database
initDb();

// Middleware
app.use(cors());
app.use(express.json());

// GET /api/health - Startup/readiness probe: reports whether the port is
// serving, the database file is reachable and whether seed data is present.
app.get('/api/health', (req, res) => {
  try {
    const db = getDb();
    const { total } = db.prepare('SELECT COUNT(*) AS total FROM articles').get();
    res.json({
      status: 'ok',
      port: Number(PORT),
      database: {
        connected: true,
        path: DB_PATH,
        articleCount: total,
        seeded: total > 0
      }
    });
  } catch (err) {
    res.status(503).json({
      status: 'error',
      port: Number(PORT),
      database: { connected: false, path: DB_PATH }
    });
  }
});

// Routes
app.use('/api/auth', authRouter);
app.use('/api/articles', articlesRouter);
// /api/tags is an alias of GET /api/articles/tags using the same handler, so
// list and tag summary always share one response contract.
app.get('/api/tags', getTags);

// Error handling
app.use((err, req, res, next) => {
  console.error(err.stack);
  sendError(res, 500, 'Internal server error');
});

function articleCount() {
  try {
    return getDb().prepare('SELECT COUNT(*) AS total FROM articles').get().total;
  } catch {
    return -1;
  }
}

const server = app.listen(PORT, () => {
  const count = articleCount();
  // Explicit startup checklist: port, database file and sample data.
  console.log('--- Startup checks ---');
  console.log(`[ready] HTTP server listening on http://localhost:${PORT}`);
  console.log(`[ready] Database file: ${DB_PATH} (${fs.existsSync(DB_PATH) ? 'present' : 'missing'})`);
  if (count >= 0) {
    if (count > 0) {
      console.log(`[ready] Sample data: ${count} articles loaded`);
    } else {
      console.log('[warn]  Sample data: database is empty - run "npm run seed" to load sample articles');
    }
  } else {
    console.log('[error] Sample data: database is not reachable');
  }
  console.log('----------------------');
});

module.exports = { app, server };
