const express = require('express');
const { getDb } = require('../db/init');
const { authenticateToken } = require('../middleware/auth');
const {
  sendCollection,
  sendItem,
  sendError,
  parseTags,
  escapeLike
} = require('../utils/response');

const router = express.Router();

const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 100;

// 校验正整数查询参数：缺省时使用默认值；非法（0、负数、小数、非数字）直接判为非法参数
function parsePositiveInt(rawValue, defaultValue, { max } = {}) {
  if (rawValue === undefined) return { value: defaultValue };
  if (!/^\d+$/.test(String(rawValue).trim())) return { invalid: true };

  const value = Number(rawValue);
  if (value < 1) return { invalid: true };
  if (max !== undefined && value > max) return { invalid: true };

  return { value };
}

// GET /api/articles - 文章列表，支持分页、标签过滤与标题/摘要搜索
router.get('/', (req, res) => {
  const db = getDb();

  // 非法参数组合统一返回 400，而不是落入 SQL 报错（如负数 OFFSET）
  const pageResult = parsePositiveInt(req.query.page, 1);
  if (pageResult.invalid) {
    return sendError(res, 400, 'Invalid query parameter: page must be a positive integer');
  }
  const limitResult = parsePositiveInt(req.query.limit, DEFAULT_LIMIT, { max: MAX_LIMIT });
  if (limitResult.invalid) {
    return sendError(res, 400, `Invalid query parameter: limit must be an integer between 1 and ${MAX_LIMIT}`);
  }

  const page = pageResult.value;
  const limit = limitResult.value;
  const tag = typeof req.query.tag === 'string' ? req.query.tag.trim() : '';
  const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
  const offset = (page - 1) * limit;

  const whereClauses = [];
  const params = [];
  const countParams = [];

  if (tag) {
    // 逗号包裹后做完整标签匹配，避免前缀误匹配；转义用户输入中的 LIKE 通配符
    whereClauses.push(`(',' || tags || ',') LIKE ? ESCAPE '\\'`);
    const tagPattern = `%,${escapeLike(tag)},%`;
    params.push(tagPattern);
    countParams.push(tagPattern);
  }

  if (search) {
    whereClauses.push(`(title LIKE ? ESCAPE '\\' OR summary LIKE ? ESCAPE '\\')`);
    const searchPattern = `%${escapeLike(search)}%`;
    params.push(searchPattern, searchPattern);
    countParams.push(searchPattern, searchPattern);
  }

  const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';
  const countQuery = `SELECT COUNT(*) AS total FROM articles ${whereSql}`;
  const listQuery = `
    SELECT id, title, summary, tags, created_at, updated_at
    FROM articles ${whereSql}
    ORDER BY created_at DESC, id DESC
    LIMIT ? OFFSET ?
  `;
  params.push(limit, offset);

  try {
    const { total } = db.prepare(countQuery).get(...countParams);
    const rows = db.prepare(listQuery).all(...params);

    const articles = rows.map(article => ({
      id: article.id,
      title: article.title,
      summary: article.summary,
      tags: parseTags(article.tags),
      created_at: article.created_at,
      updated_at: article.updated_at
    }));

    sendCollection(res, 'articles', articles, { total, page, limit });
  } catch (err) {
    console.error(err);
    sendError(res, 500, 'Failed to fetch articles');
  }
});

// GET /api/articles/:id - 文章详情（保持现有前端依赖的扁平字段结构，包含 body）
router.get('/:id', (req, res) => {
  const db = getDb();
  const { id } = req.params;

  try {
    const article = db.prepare('SELECT * FROM articles WHERE id = ?').get(id);

    if (!article) {
      return sendError(res, 404, 'Article not found');
    }

    sendItem(res, {
      ...article,
      tags: parseTags(article.tags)
    });
  } catch (err) {
    console.error(err);
    sendError(res, 500, 'Failed to fetch article');
  }
});

// POST /api/articles - 创建文章（需要鉴权）
router.post('/', authenticateToken, (req, res) => {
  const db = getDb();
  const { title, body, summary, tags } = req.body;

  if (!title || !body) {
    return sendError(res, 400, 'Title and body are required');
  }

  try {
    const tagsStr = Array.isArray(tags) ? tags.join(',') : (tags || '');
    const now = new Date().toISOString();

    const result = db.prepare(`
      INSERT INTO articles (title, body, summary, tags, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(title, body, summary || '', tagsStr, now, now);

    const article = db.prepare('SELECT * FROM articles WHERE id = ?').get(result.lastInsertRowid);

    sendItem(res, {
      ...article,
      tags: parseTags(article.tags)
    }, 201);
  } catch (err) {
    console.error(err);
    sendError(res, 500, 'Failed to create article');
  }
});

// PUT /api/articles/:id - 更新文章（需要鉴权）
router.put('/:id', authenticateToken, (req, res) => {
  const db = getDb();
  const { id } = req.params;
  const { title, body, summary, tags } = req.body;

  if (!title || !body) {
    return sendError(res, 400, 'Title and body are required');
  }

  try {
    const existing = db.prepare('SELECT * FROM articles WHERE id = ?').get(id);
    if (!existing) {
      return sendError(res, 404, 'Article not found');
    }

    const tagsStr = Array.isArray(tags) ? tags.join(',') : (tags || '');
    const now = new Date().toISOString();

    db.prepare(`
      UPDATE articles SET title = ?, body = ?, summary = ?, tags = ?, updated_at = ?
      WHERE id = ?
    `).run(title, body, summary || '', tagsStr, now, id);

    const article = db.prepare('SELECT * FROM articles WHERE id = ?').get(id);

    sendItem(res, {
      ...article,
      tags: parseTags(article.tags)
    });
  } catch (err) {
    console.error(err);
    sendError(res, 500, 'Failed to update article');
  }
});

// DELETE /api/articles/:id - 删除文章（需要鉴权）
router.delete('/:id', authenticateToken, (req, res) => {
  const db = getDb();
  const { id } = req.params;

  try {
    const existing = db.prepare('SELECT * FROM articles WHERE id = ?').get(id);
    if (!existing) {
      return sendError(res, 404, 'Article not found');
    }

    db.prepare('DELETE FROM articles WHERE id = ?').run(id);
    res.json({ message: 'Article deleted successfully' });
  } catch (err) {
    console.error(err);
    sendError(res, 500, 'Failed to delete article');
  }
});

module.exports = router;
