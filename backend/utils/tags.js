const { getDb } = require('../db/init');
const { sendSuccess, sendError } = require('./response');

// GET tag summary. Shared by GET /api/articles/tags and the /api/tags alias
// so both endpoints return exactly the same collection envelope as the
// article list: { success: true, data: [...], meta: { count } }.
function getTags(req, res) {
  const db = getDb();

  try {
    const articles = db
      .prepare("SELECT tags FROM articles WHERE tags IS NOT NULL AND tags != ''")
      .all();
    const tagSet = new Set();

    articles.forEach(article => {
      article.tags.split(',').forEach(rawTag => {
        const trimmed = rawTag.trim();
        if (trimmed) tagSet.add(trimmed);
      });
    });

    const tags = Array.from(tagSet).sort();
    return sendSuccess(res, tags, { count: tags.length });
  } catch (err) {
    console.error(err);
    return sendError(res, 500, 'Failed to fetch tags');
  }
}

module.exports = { getTags };
