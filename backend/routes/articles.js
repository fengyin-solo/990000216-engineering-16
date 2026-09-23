const express = require('express');
const { getDb } = require('../db/init');
const { authenticateToken } = require('../middleware/auth');
const { sendSuccess, sendError } = require('../utils/response');
const { getTags } = require('../utils/tags');

const router = express.Router();

const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 100;

// Escape LIKE wildcards so user input (e.g. "100%_done") is matched literally.
function escapeLike(value) {
  return value.replace(/[\\%_]/g, '\\$&');
}

// A query value may arrive as an array when the key is repeated (?tag=a&tag=b).
// Reject those explicitly instead of silently coercing "[object Object]".
function singleStringParam(raw) {
  if (raw === undefined) return undefined;
  if (typeof raw !== 'string') return { invalid: true };
  return raw;
}

function parsePositiveInt(raw, fallback) {
  if (raw === undefined) return { value: fallback };
  if (!/^\d+$/.test(raw)) return { invalid: true };
  const value = Number(raw);
  if (value < 1) return { invalid: true };
  return { value };
}

// GET /api/articles - List articles with pagination, tag filter and search.
// Success envelope (shared with GET /api/tags):
//   { success: true, data: [...], meta: { pagination, filters } }
router.get('/', (req, res) => {
  const db = getDb();

  // Reject repeated query keys such as ?page=1&page=2.
  for (const key of ['page', 'limit', 'tag', 'search']) {
    if (Array.isArray(req.query[key])) {
      return sendError(res, 400, `Query parameter "${key}" must be provided only once`);
    }
  }

  const pageResult = parsePositiveInt(req.query.page, 1);
  if (pageResult.invalid) {
    return sendError(res, 400, 'Query parameter "page" must be a positive integer');
  }

  const limitResult = parsePositiveInt(req.query.limit, DEFAULT_LIMIT);
  if (limitResult.invalid) {
    return sendError(res, 400, 'Query parameter "limit" must be a positive integer');
  }

  const page = pageResult.value;
  const limit = limitResult.value;
  if (limit > MAX_LIMIT) {
    return sendError(res, 400, `Query parameter "limit" must not exceed ${MAX_LIMIT}`);
  }

  let tag = singleStringParam(req.query.tag);
  if (tag && tag.invalid) {
    return sendError(res, 400, 'Query parameter "tag" must be a string');
  }
  let search = singleStringParam(req.query.search);
  if (search && search.invalid) {
    return sendError(res, 400, 'Query parameter "search" must be a string');
  }

  // Treat absent or whitespace-only values as "no filter".
  tag = typeof tag === 'string' && tag.trim() ? tag.trim() : null;
  search = typeof search === 'string' && search.trim() ? search.trim() : null;

  if (tag && tag.length > 50) {
    return sendError(res, 400, 'Query parameter "tag" must not exceed 50 characters');
  }
  if (search && search.length > 100) {
    return sendError(res, 400, 'Query parameter "search" must not exceed 100 characters');
  }

  const whereClauses = [];
  const params = [];

  if (tag) {
    // Exact tag-token match: wrap the normalized tag list in commas and match
    // ",tag,". Spaces are stripped so stored "Vue, Vue3" still matches "Vue3".
    whereClauses.push(`(',' || REPLACE(IFNULL(tags, ''), ' ', '') || ',') LIKE ? ESCAPE '\\'`);
    params.push(`%,${escapeLike(tag)},%`);
  }

  if (search) {
    whereClauses.push('(title LIKE ? ESCAPE \'\\\' OR summary LIKE ? ESCAPE \'\\\')');
    const searchTerm = `%${escapeLike(search)}%`;
    params.push(searchTerm, searchTerm);
  }

  const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';
  const countQuery = `SELECT COUNT(*) AS total FROM articles ${whereSql}`;
  const articlesQuery = `
    SELECT id, title, summary, tags, created_at, updated_at
    FROM articles ${whereSql}
    ORDER BY created_at DESC, id DESC
    LIMIT ? OFFSET ?
  `;

  try {
    const { total } = db.prepare(countQuery).get(...params);
    const totalPages = Math.ceil(total / limit);
    const articles = db
      .prepare(articlesQuery)
      .all(...params, limit, (page - 1) * limit)
      .map(article => ({
        ...article,
        tags: article.tags ? article.tags.split(',').map(t => t.trim()).filter(Boolean) : []
      }));

    // Out-of-range pages are valid requests: they return an empty page while
    // pagination metadata lets the client correct itself.
    return sendSuccess(res, articles, {
      pagination: { total, page, limit, totalPages },
      filters: { tag, search }
    });
  } catch (err) {
    console.error(err);
    return sendError(res, 500, 'Failed to fetch articles');
  }
});

// GET /api/articles/tags - Tag summary. Registered before "/:id" so "tags"
// is not captured as an article id. The handler lives in utils/tags so the
// /api/tags alias can reuse the exact same function and response envelope.
router.get('/tags', getTags);

// GET /api/articles/:id - Get single article
// Kept as a bare resource object so the existing frontend/detail page fields
// (id, title, body, summary, tags, created_at, updated_at) stay compatible.
router.get('/:id', (req, res) => {
  const db = getDb();
  const { id } = req.params;

  try {
    const article = db.prepare('SELECT * FROM articles WHERE id = ?').get(id);

    if (!article) {
      return res.status(404).json({ error: 'Article not found' });
    }

    res.json({
      ...article,
      tags: article.tags ? article.tags.split(',').map(t => t.trim()) : []
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch article' });
  }
});

// POST /api/articles - Create article (requires auth)
router.post('/', authenticateToken, (req, res) => {
  const db = getDb();
  const { title, body, summary, tags } = req.body;

  if (!title || !body) {
    return res.status(400).json({ error: 'Title and body are required' });
  }

  try {
    const tagsStr = Array.isArray(tags) ? tags.join(',') : (tags || '');
    const now = new Date().toISOString();

    const result = db.prepare(`
      INSERT INTO articles (title, body, summary, tags, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(title, body, summary || '', tagsStr, now, now);

    const article = db.prepare('SELECT * FROM articles WHERE id = ?').get(result.lastInsertRowid);

    res.status(201).json({
      ...article,
      tags: article.tags ? article.tags.split(',').map(t => t.trim()) : []
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create article' });
  }
});

// PUT /api/articles/:id - Update article (requires auth)
router.put('/:id', authenticateToken, (req, res) => {
  const db = getDb();
  const { id } = req.params;
  const { title, body, summary, tags } = req.body;

  if (!title || !body) {
    return res.status(400).json({ error: 'Title and body are required' });
  }

  try {
    const existing = db.prepare('SELECT * FROM articles WHERE id = ?').get(id);
    if (!existing) {
      return res.status(404).json({ error: 'Article not found' });
    }

    const tagsStr = Array.isArray(tags) ? tags.join(',') : (tags || '');
    const now = new Date().toISOString();

    db.prepare(`
      UPDATE articles SET title = ?, body = ?, summary = ?, tags = ?, updated_at = ?
      WHERE id = ?
    `).run(title, body, summary || '', tagsStr, now, id);

    const article = db.prepare('SELECT * FROM articles WHERE id = ?').get(id);

    res.json({
      ...article,
      tags: article.tags ? article.tags.split(',').map(t => t.trim()) : []
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update article' });
  }
});

// DELETE /api/articles/:id - Delete article (requires auth)
router.delete('/:id', authenticateToken, (req, res) => {
  const db = getDb();
  const { id } = req.params;

  try {
    const existing = db.prepare('SELECT * FROM articles WHERE id = ?').get(id);
    if (!existing) {
      return res.status(404).json({ error: 'Article not found' });
    }

    db.prepare('DELETE FROM articles WHERE id = ?').run(id);
    res.json({ message: 'Article deleted successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete article' });
  }
});

module.exports = router;
