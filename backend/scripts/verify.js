#!/usr/bin/env node
/**
 * 可重复的本地开发验证（端到端，零副作用）：
 *   npm run verify
 *
 * 工作方式：
 *   1. 在系统临时目录创建一次性的验证数据库（通过 BLOG_DB_PATH 指向），
 *      不触碰 backend/data/blog.db 开发库；
 *   2. 写入标准示例数据；
 *   3. 在随机空闲端口启动与生产相同的 Express 应用；
 *   4. 通过真实 HTTP 请求覆盖：分页、标签、搜索、空结果、非法参数组合，
 *      以及列表/标签统一响应约定与详情字段兼容性；
 *   5. 无论成功失败都关闭服务并删除临时数据库文件，重复执行不残留记录。
 */
const fs = require('fs');
const os = require('os');
const path = require('path');

// 必须在引入 db 模块前指定临时数据库
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'blog-verify-'));
const tempDbPath = path.join(tempDir, 'verify.db');
process.env.BLOG_DB_PATH = tempDbPath;

const { getDbPath, closeDb } = require('../db/init');
const { seedDatabase } = require('../db/seed');
const { createApp } = require('../app');

const TOTAL = 15;

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function section(name) {
  console.log(`\n--- ${name} ---`);
}

async function check(name, fn) {
  try {
    await fn();
    passed += 1;
    console.log(`✓ ${name}`);
  } catch (err) {
    failed += 1;
    console.error(`✗ ${name}\n    ${err.message}`);
  }
}

async function api(url, options) {
  const response = await fetch(`${baseUrl}${url}`, options);
  let body = null;
  const text = await response.text();
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }
  }
  return { status: response.status, body };
}

function cleanup(server) {
  return new Promise(resolve => {
    server.close(() => {
      closeDb();
      for (const suffix of ['', '-wal', '-shm']) {
        const file = tempDbPath + suffix;
        if (fs.existsSync(file)) {
          try { fs.unlinkSync(file); } catch { /* 忽略删除失败，下方会报告 */ }
        }
      }
      try { fs.rmdirSync(tempDir); } catch { /* 目录非空时保留，下方会报告 */ }
      resolve();
    });
  });
}

async function main() {
  // ---- 准备隔离环境 ----
  const defaultDbPath = path.join(__dirname, '..', 'data', 'blog.db');
  const devBefore = fs.existsSync(defaultDbPath)
    ? fs.statSync(defaultDbPath).mtimeMs
    : null;

  seedDatabase();

  const app = createApp();
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const port = server.address().port;
  baseUrl = `http://127.0.0.1:${port}`;

  console.log('=== 文章查询接口本地验证 ===');
  console.log(`临时数据库: ${getDbPath()}（开发库不受影响）`);
  console.log(`验证服务: ${baseUrl}`);

  // ---- 1. 分页 ----
  section('1. 分页');

  await check('默认请求：page=1 limit=10，返回 10 条且 total=15', async () => {
    const { status, body } = await api('/api/articles');
    assert(status === 200, `状态码应为 200，实际 ${status}`);
    assert(body.articles.length === 10, `应返回 10 条，实际 ${body.articles.length}`);
    assert(body.pagination.total === TOTAL, 'total 应为 15');
    assert(body.pagination.page === 1, 'page 应为 1');
    assert(body.pagination.limit === 10, 'limit 应为 10');
    assert(body.pagination.totalPages === 2, 'totalPages 应为 2');
  });

  await check('按 created_at 倒序，最新文章（id=15）排在首位', async () => {
    const { body } = await api('/api/articles');
    assert(body.articles[0].id === 15, `首条 id 应为 15，实际 ${body.articles[0].id}`);
    const dates = body.articles.map(a => a.created_at);
    const sorted = [...dates].sort().reverse();
    assert(JSON.stringify(dates) === JSON.stringify(sorted), 'created_at 未按倒序排列');
  });

  await check('自定义分页 page=3&limit=4：offset 8，返回 4 条，totalPages=4', async () => {
    const { status, body } = await api('/api/articles?page=3&limit=4');
    assert(status === 200, `状态码应为 200，实际 ${status}`);
    assert(body.articles.length === 4, `应返回 4 条，实际 ${body.articles.length}`);
    assert(body.pagination.page === 3, 'page 应为 3');
    assert(body.pagination.limit === 4, 'limit 应为 4');
    assert(body.pagination.totalPages === 4, 'totalPages 应为 4');
  });

  await check('limit=1：每页 1 条，totalPages=15', async () => {
    const { body } = await api('/api/articles?limit=1');
    assert(body.articles.length === 1, '应只返回 1 条');
    assert(body.pagination.totalPages === 15, 'totalPages 应为 15');
  });

  await check('合法上限 limit=100 被接受', async () => {
    const { status, body } = await api('/api/articles?limit=100');
    assert(status === 200, `状态码应为 200，实际 ${status}`);
    assert(body.articles.length === TOTAL, '应一次性返回全部 15 条');
    assert(body.pagination.totalPages === 1, 'totalPages 应为 1');
  });

  // ---- 2. 标签 ----
  section('2. 标签过滤');

  await check("tag=前端：命中 10 篇，且每条都携带该标签", async () => {
    const { status, body } = await api('/api/articles?tag=' + encodeURIComponent('前端'));
    assert(status === 200, `状态码应为 200，实际 ${status}`);
    assert(body.articles.length === 10, `应命中 10 篇，实际 ${body.articles.length}`);
    assert(body.pagination.total === 10, 'pagination.total 应为 10');
    assert(body.articles.every(a => a.tags.includes('前端')), '存在不包含该标签的结果');
  });

  await check("tag=Node.js：完整标签匹配，命中 2 篇", async () => {
    const { body } = await api('/api/articles?tag=' + encodeURIComponent('Node.js'));
    assert(body.articles.length === 2, `应命中 2 篇，实际 ${body.articles.length}`);
    assert(body.articles.every(a => a.tags.includes('Node.js')), '结果标签不正确');
  });

  await check("tag=CSS：命中 2 篇（含点号等字符的标签正常匹配）", async () => {
    const { body } = await api('/api/articles?tag=CSS');
    assert(body.articles.length === 2, `应命中 2 篇，实际 ${body.articles.length}`);
  });

  await check("tag=Java 不会误匹配 JavaScript（逗号包裹的完整匹配）", async () => {
    const { body } = await api('/api/articles?tag=Java');
    assert(body.articles.length === 0, `不应命中任何文章，实际 ${body.articles.length}`);
  });

  await check('标签 + 分页组合：tag=前端&page=2&limit=4 返回 4 条，total=10', async () => {
    const { status, body } = await api(
      `/api/articles?tag=${encodeURIComponent('前端')}&page=2&limit=4`
    );
    assert(status === 200, `状态码应为 200，实际 ${status}`);
    assert(body.articles.length === 4, `应返回 4 条，实际 ${body.articles.length}`);
    assert(body.pagination.total === 10, '过滤后 total 应为 10');
    assert(body.pagination.totalPages === 3, 'totalPages 应为 3');
  });

  // ---- 3. 搜索 ----
  section('3. 搜索');

  await check('search=JavaScript：仅搜索标题与摘要，命中 1 篇', async () => {
    const { body } = await api('/api/articles?search=' + encodeURIComponent('JavaScript'));
    assert(body.articles.length === 1, `应命中 1 篇，实际 ${body.articles.length}`);
    assert(body.pagination.total === 1, 'total 应为 1');
  });

  await check('search=css：ASCII 大小写不敏感，命中 2 篇', async () => {
    const { body } = await api('/api/articles?search=css');
    assert(body.articles.length === 2, `应命中 2 篇，实际 ${body.articles.length}`);
  });

  await check("search=布局：中文标题/摘要命中 2 篇", async () => {
    const { body } = await api('/api/articles?search=' + encodeURIComponent('布局'));
    assert(body.articles.length === 2, `应命中 2 篇，实际 ${body.articles.length}`);
  });

  await check('标签 + 搜索组合：tag=前端&search=JavaScript 命中 1 篇', async () => {
    const { body } = await api(
      `/api/articles?tag=${encodeURIComponent('前端')}&search=${encodeURIComponent('JavaScript')}`
    );
    assert(body.articles.length === 1, `应命中 1 篇，实际 ${body.articles.length}`);
  });

  await check('搜索中的 LIKE 通配符 % 被转义，不会匹配全部记录', async () => {
    const { status, body } = await api('/api/articles?search=' + encodeURIComponent('%'));
    assert(status === 200, `状态码应为 200，实际 ${status}`);
    assert(body.articles.length === 0, `通配符应被当字面量，命中 0 篇，实际 ${body.articles.length}`);
  });

  // ---- 4. 空结果 ----
  section('4. 空结果');

  await check('不存在的标签返回 200 + 空数组，分页信息完整', async () => {
    const { status, body } = await api('/api/articles?tag=' + encodeURIComponent('不存在的标签'));
    assert(status === 200, `状态码应为 200，实际 ${status}`);
    assert(Array.isArray(body.articles) && body.articles.length === 0, 'articles 应为空数组');
    assert(body.pagination.total === 0, 'total 应为 0');
    assert(body.pagination.totalPages === 0, 'totalPages 应为 0');
  });

  await check('不存在的搜索词返回 200 + 空数组', async () => {
    const { status, body } = await api('/api/articles?search=zzzz-not-exist');
    assert(status === 200, `状态码应为 200，实际 ${status}`);
    assert(body.articles.length === 0, 'articles 应为空数组');
  });

  await check('标签与搜索组合无交集时返回 200 + 空数组', async () => {
    const { body } = await api(
      `/api/articles?tag=${encodeURIComponent('后端')}&search=${encodeURIComponent('JavaScript')}`
    );
    assert(body.articles.length === 0, `交集应为 0，实际 ${body.articles.length}`);
  });

  await check('超出范围的页码返回 200 + 空数组（而不是 500）', async () => {
    const { status, body } = await api('/api/articles?page=999&limit=10');
    assert(status === 200, `状态码应为 200，实际 ${status}`);
    assert(body.articles.length === 0, '超出范围应返回空数组');
    assert(body.pagination.total === TOTAL, 'total 仍应为 15');
  });

  await check('空字符串参数等同于未传：tag= 与 search= 返回全部', async () => {
    const { status, body } = await api('/api/articles?tag=&search=');
    assert(status === 200, `状态码应为 200，实际 ${status}`);
    assert(body.pagination.total === TOTAL, '空参数不应触发过滤');
  });

  // ---- 5. 非法参数组合 ----
  section('5. 非法参数组合');

  const invalidCases = [
    ['page=0', 'page 为 0'],
    ['page=-1', 'page 为负数'],
    ['page=abc', 'page 非数字'],
    ['page=1.5', 'page 为小数'],
    ['limit=0', 'limit 为 0'],
    ['limit=-5', 'limit 为负数'],
    ['limit=2.5', 'limit 为小数'],
    ['limit=abc', 'limit 非数字'],
    ['limit=101', 'limit 超过上限 100'],
    ['page=2&limit=0', '合法 page 搭配非法 limit'],
    ['page=-1&limit=abc', '两个参数都非法']
  ];

  for (const [query, label] of invalidCases) {
    await check(`非法参数（${label}）?${query} 返回 400 与错误信息`, async () => {
      const { status, body } = await api(`/api/articles?${query}`);
      assert(status === 400, `状态码应为 400，实际 ${status}`);
      assert(typeof body.error === 'string' && body.error.length > 0, '应返回 error 错误信息');
    });
  }

  // ---- 6. 列表 / 标签汇总统一响应约定 + 前端字段兼容 ----
  section('6. 统一响应约定与前端兼容性');

  await check('列表项保持前端字段：id/title/summary/tags[]/created_at/updated_at，且不含 body', async () => {
    const { body } = await api('/api/articles?limit=100');
    const expectedKeys = ['id', 'title', 'summary', 'tags', 'created_at', 'updated_at'];
    for (const article of body.articles) {
      const keys = Object.keys(article).sort();
      assert(
        JSON.stringify(keys) === JSON.stringify([...expectedKeys].sort()),
        `文章 id=${article.id} 字段不一致：${keys.join(',')}`
      );
      assert(Array.isArray(article.tags), `id=${article.id} 的 tags 应为数组`);
      assert(typeof article.created_at === 'string', 'created_at 应为字符串');
      assert(typeof article.updated_at === 'string', 'updated_at 应为字符串');
    }
  });

  await check('分页对象保持前端字段：total/page/limit/totalPages', async () => {
    const { body } = await api('/api/articles');
    const keys = Object.keys(body.pagination).sort();
    assert(
      JSON.stringify(keys) === JSON.stringify(['limit', 'page', 'total', 'totalPages']),
      `pagination 字段不一致：${keys.join(',')}`
    );
  });

  await check('GET /api/tags 与列表共用集合约定：{ tags, pagination }', async () => {
    const { status, body } = await api('/api/tags');
    assert(status === 200, `状态码应为 200，实际 ${status}`);
    assert(Array.isArray(body.tags), 'tags 应为数组');
    assert(body.pagination, '应包含 pagination');
    assert(body.pagination.total === body.tags.length, 'pagination.total 应等于标签数');
    assert(body.pagination.page === 1, 'page 应为 1');
    assert(body.pagination.limit === body.tags.length, 'limit 应等于标签数');
    assert(body.pagination.totalPages === 1, 'totalPages 应为 1');
  });

  await check('标签汇总：共 27 个唯一标签且已排序去重', async () => {
    const { body } = await api('/api/tags');
    assert(body.tags.length === 27, `应有 27 个唯一标签，实际 ${body.tags.length}`);
    const sorted = [...body.tags].sort();
    assert(JSON.stringify(body.tags) === JSON.stringify(sorted), '标签未排序');
    assert(new Set(body.tags).size === body.tags.length, '标签存在重复');
    assert(body.tags.includes('前端') && body.tags.includes('Node.js'), '应包含关键标签');
  });

  // ---- 7. 详情接口兼容性 ----
  section('7. 详情接口');

  await check('详情为扁平对象，含前端依赖的 body 与全部基础字段', async () => {
    const list = await api('/api/articles?limit=1');
    const firstId = list.body.articles[0].id;
    const { status, body } = await api(`/api/articles/${firstId}`);
    assert(status === 200, `状态码应为 200，实际 ${status}`);
    for (const key of ['id', 'title', 'body', 'summary', 'tags', 'created_at', 'updated_at']) {
      assert(body[key] !== undefined, `详情缺少字段 ${key}`);
    }
    assert(Array.isArray(body.tags), 'tags 应为数组');
    assert(typeof body.body === 'string' && body.body.length > 0, 'body 应为非空 Markdown 字符串');
    assert(!body.pagination, '详情不应包含分页包装');
  });

  await check('不存在的文章 id 返回 404', async () => {
    const { status, body } = await api('/api/articles/999999');
    assert(status === 404, `状态码应为 404，实际 ${status}`);
    assert(typeof body.error === 'string', '应返回 error 信息');
  });

  await check('非数字文章 id 返回 404（不抛出 500）', async () => {
    const { status } = await api('/api/articles/abc');
    assert(status === 404, `状态码应为 404，实际 ${status}`);
  });

  // ---- 8. 可重复性：重新 seed 不残留旧记录 ----
  section('8. 可重复性');

  await check('重复写入示例数据后仍为 15 篇，id 连续为 1..15', async () => {
    const count = seedDatabase();
    assert(count === TOTAL, `应写入 15 篇，实际 ${count}`);
    const { body } = await api('/api/articles?limit=100');
    assert(body.articles.length === TOTAL, `总数应仍为 15，实际 ${body.articles.length}`);
    const idsDesc = body.articles.map(a => a.id);
    const expected = Array.from({ length: TOTAL }, (_, i) => TOTAL - i);
    assert(
      JSON.stringify(idsDesc) === JSON.stringify(expected),
      `id 序列应为 15..1，实际 ${idsDesc.join(',')}`
    );
  });

  // ---- 清理：关闭服务并删除临时数据库 ----
  await cleanup(server);

  section('清理');
  const residue = fs.existsSync(tempDir) || fs.existsSync(tempDbPath);
  console.log(`${residue ? '✗' : '✓'} 临时数据库与目录已删除：${tempDbPath}`);

  const devAfter = fs.existsSync(defaultDbPath)
    ? fs.statSync(defaultDbPath).mtimeMs
    : null;
  const devUntouched = devBefore === devAfter;
  console.log(`${devUntouched ? '✓' : '✗'} 开发库 ${defaultDbPath} 未被修改`);
  if (residue) failed += 1;
  if (!devUntouched) failed += 1;

  console.log('\n============================');
  console.log(`验证结果：${passed} 通过，${failed} 失败`);
  if (failed > 0) {
    console.log('存在失败项，请检查上述输出。');
    process.exitCode = 1;
  } else {
    console.log('全部通过，且未残留任何测试记录。');
  }
}

let baseUrl;

main().catch(err => {
  console.error('验证脚本执行失败：', err);
  process.exit(1);
});
