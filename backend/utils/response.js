// 统一的 API 响应约定：
// - 集合类接口（文章列表、标签汇总）：{ <资源名>: [...], pagination: { total, page, limit, totalPages } }
// - 单个资源（详情、创建、更新）：直接返回对象
// - 错误：{ error: '错误信息' }

/**
 * 输出集合类响应，文章列表与标签汇总共用同一套结构。
 * @param {import('express').Response} res
 * @param {string} key 资源字段名，如 'articles' / 'tags'
 * @param {Array} items 当前页的数据
 * @param {{ total?: number, page?: number, limit?: number }} pagination
 */
function sendCollection(res, key, items, { total, page = 1, limit = items.length } = {}) {
  const totalCount = Number.isInteger(total) ? total : items.length;
  // totalPages 为 0 时使用 1 作为除数，避免空集合出现 limit=1 的假象
  const safeLimit = limit > 0 ? limit : 1;

  res.json({
    [key]: items,
    pagination: {
      total: totalCount,
      page,
      limit,
      totalPages: Math.ceil(totalCount / safeLimit)
    }
  });
}

/**
 * 输出单个资源（详情、创建、更新）。
 */
function sendItem(res, item, status = 200) {
  res.status(status).json(item);
}

/**
 * 输出错误响应。
 */
function sendError(res, status, message) {
  res.status(status).json({ error: message });
}

/**
 * 将数据库中逗号分隔的标签字符串解析为标签数组。
 */
function parseTags(tagsStr) {
  if (!tagsStr) return [];
  return String(tagsStr)
    .split(',')
    .map(tag => tag.trim())
    .filter(Boolean);
}

/**
 * 转义 LIKE 模式中的通配符（%、_、\），配合 ESCAPE '\' 使用，
 * 避免用户输入被当作通配符匹配。
 */
function escapeLike(value) {
  return String(value).replace(/[\\%_]/g, '\\$&');
}

module.exports = {
  sendCollection,
  sendItem,
  sendError,
  parseTags,
  escapeLike
};
