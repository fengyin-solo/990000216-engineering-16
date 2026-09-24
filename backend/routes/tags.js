const express = require('express');
const { getDb } = require('../db/init');
const { sendCollection, sendError } = require('../utils/response');

const router = express.Router();

// GET /api/tags - 获取全部标签汇总
// 与文章列表共用同一套集合响应约定：{ tags: [...], pagination: {...} }
router.get('/', (req, res) => {
  const db = getDb();

  try {
    const rows = db
      .prepare("SELECT tags FROM articles WHERE tags IS NOT NULL AND tags != ''")
      .all();

    const tagSet = new Set();
    rows.forEach(row => {
      row.tags.split(',').forEach(tag => {
        const trimmed = tag.trim();
        if (trimmed) tagSet.add(trimmed);
      });
    });

    const tags = Array.from(tagSet).sort();

    sendCollection(res, 'tags', tags, {
      total: tags.length,
      page: 1,
      limit: tags.length
    });
  } catch (err) {
    console.error(err);
    sendError(res, 500, 'Failed to fetch tags');
  }
});

module.exports = router;
