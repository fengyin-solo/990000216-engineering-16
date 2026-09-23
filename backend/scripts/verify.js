#!/usr/bin/env node
/**
 * Reproducible local verification for the article query API.
 *
 * What it does:
 *   1. Creates an isolated temporary SQLite database (never touches dev data).
 *   2. Seeds exactly 15 sample articles into it.
 *   3. Boots the real Express server on PORT=3101 and waits for /api/health.
 *   4. Runs checks for pagination, tag filter, search, empty results,
 *      illegal parameter combinations and response-contract compatibility.
 *   5. Shuts the server down and removes every temporary file, so repeated
 *      runs never leave test records or files behind.
 *
 * Usage:
 *   npm run verify                 # from backend/
 *   PORT=3200 npm run verify       # custom port if 3101 is busy
 *
 * Exit code is non-zero on the first failed check.
 */

const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');

const PORT = process.env.PORT || 3101;
const BASE = `http://127.0.0.1:${PORT}/api`;
const RUN_ID = `verify-${Date.now()}-${process.pid}`;
const TMP_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'blog-verify-'));
const TMP_DB = path.join(TMP_DIR, `${RUN_ID}.db`);

let serverProc = null;
let failures = 0;
let passed = 0;

// ---------------------------------------------------------------------------
// Tiny test framework (no external dependencies)
// ---------------------------------------------------------------------------

function check(name, condition, detail = '') {
  if (condition) {
    passed += 1;
    console.log(`  ✓ ${name}`);
  } else {
    failures += 1;
    console.log(`  ✗ ${name}${detail ? `\n      ${detail}` : ''}`);
  }
}

async function get(pathname) {
  const res = await fetch(`${BASE}${pathname}`, {
    headers: { Accept: 'application/json' }
  });
  let body = null;
  try {
    body = await res.json();
  } catch {
    body = null;
  }
  return { status: res.status, body };
}

function waitForServer(timeoutMs = 10000) {
  const deadline = Date.now() + timeoutMs;
  return new Promise((resolve, reject) => {
    const attempt = async () => {
      try {
        const res = await fetch(`${BASE}/health`);
        if (res.ok) return resolve();
      } catch {
        // server not up yet
      }
      if (Date.now() > deadline) {
        return reject(new Error(`Server did not become ready within ${timeoutMs}ms`));
      }
      setTimeout(attempt, 150);
    };
    attempt();
  });
}

function runStep(label, fn) {
  steps.push({ label, fn });
}
const steps = [];

// ---------------------------------------------------------------------------
// Test definitions
// ---------------------------------------------------------------------------

runStep('Startup readiness: port, database and sample data', async () => {
  const { status, body } = await get('/health');
  check('GET /api/health returns 200', status === 200, `status=${status}`);
  check('health reports status ok', body && body.status === 'ok', JSON.stringify(body));
  check('health reports the expected port', body && body.port === Number(PORT), `port=${body && body.port}`);
  check('health reports database connected', body && body.database && body.database.connected === true);
  check('health points at the isolated verify database',
    body && body.database.path === TMP_DB, `path=${body && body.database.path}`);
  check('health reports 15 seeded articles',
    body && body.database.articleCount === 15, `count=${body && body.database.articleCount}`);
  check('health reports seeded=true', body && body.database.seeded === true);
});

runStep('Shared response envelope (list and tag summary)', async () => {
  const list = await get('/articles');
  check('list body has success=true', list.body.success === true);
  check('list body.data is an array', Array.isArray(list.body.data));
  check('list body.meta.pagination exists', !!(list.body.meta && list.body.meta.pagination));
  check('list body.meta.filters exists', !!(list.body.meta && list.body.meta.filters));

  const tags = await get('/tags');
  check('tags body has success=true', tags.body.success === true);
  check('tags body.data is an array', Array.isArray(tags.body.data));
  check('tags body.meta.count matches data length',
    tags.body.meta && tags.body.meta.count === tags.body.data.length);

  const tagsAlias = await get('/articles/tags');
  check('/api/articles/tags returns the identical tag summary',
    JSON.stringify(tagsAlias.body) === JSON.stringify(tags.body));
});

runStep('List fields stay compatible with the existing frontend', async () => {
  const { body } = await get('/articles');
  check('meta.pagination exposes total/page/limit/totalPages',
    body.meta.pagination.total === 15 &&
    body.meta.pagination.page === 1 &&
    body.meta.pagination.limit === 10 &&
    body.meta.pagination.totalPages === 2);

  const a = body.data[0];
  check('article items expose id/title/summary/tags/created_at/updated_at',
    'id' in a && 'title' in a && 'summary' in a &&
    'tags' in a && 'created_at' in a && 'updated_at' in a,
    `keys=${Object.keys(a).join(',')}`);
  check('list items do NOT expose body', !('body' in a));
  check('tags are returned as an array', Array.isArray(a.tags));
  check('ordered newest first by created_at',
    body.data.every((x, i, arr) => i === 0 || arr[i - 1].created_at >= x.created_at));
});

runStep('Pagination: page sizes, offsets and stable totals', async () => {
  const p1 = await get('/articles?page=1&limit=5');
  const p2 = await get('/articles?page=2&limit=5');
  const p3 = await get('/articles?page=3&limit=5');

  check('page 1 returns 5 items', p1.body.data.length === 5);
  check('page 2 returns 5 items', p2.body.data.length === 5);
  check('page 3 returns 5 items (total 15)', p3.body.data.length === 5);
  check('totalPages = ceil(15/5) = 3', p1.body.meta.pagination.totalPages === 3);

  const ids = [...p1.body.data, ...p2.body.data, ...p3.body.data].map(a => a.id);
  check('pages return disjoint ids (no overlap)', new Set(ids).size === 15);
  check('pages cover all 15 articles', ids.length === 15);

  const defaultLimit = await get('/articles');
  check('default limit is 10', defaultLimit.body.data.length === 10);
  check('default page is 1', defaultLimit.body.meta.pagination.page === 1);
});

runStep('Tag filtering', async () => {
  const all = await get('/tags');
  check('tag summary contains known seed tags',
    ['JavaScript', 'Vue', 'CSS', '前端'].every(t => all.body.data.includes(t)));
  check('tag summary is sorted', all.body.data.every((t, i, arr) => i === 0 || arr[i - 1] <= t));

  const js = await get('/articles?tag=JavaScript');
  // Seed: ES6, Vue3, Node streams, TypeScript, React = 5 articles
  check('tag=JavaScript matches 5 articles', js.body.data.length === 5, `got ${js.body.data.length}`);
  check('pagination.total reflects the filter (5)', js.body.meta.pagination.total === 5);
  check('every returned article carries the tag',
    js.body.data.every(a => a.tags.includes('JavaScript')));
  check('meta.filters echoes tag', js.body.meta.filters.tag === 'JavaScript');

  const jsP2 = await get('/articles?tag=JavaScript&page=2&limit=2');
  check('tag filter paginates (limit=2 => 3 pages)',
    jsP2.body.meta.pagination.totalPages === 3);
  check('tag filter page 2 with limit 2 has 2 items', jsP2.body.data.length === 2);

  const css = await get('/articles?tag=CSS'); // Flexbox, Grid = 2
  check('tag=CSS matches 2 articles', css.body.data.length === 2);

  const spaced = await get('/articles?tag=%E5%89%8D%E7%AB%AF'); // 前端
  check('multi-byte tag matches (前端 = 10 seed articles)',
    spaced.body.data.length === 10, `got ${spaced.body.data.length}`);
});

runStep('Search', async () => {
  const byTitle = await get('/articles?search=Docker');
  check('search by title hit', byTitle.body.data.length === 1 &&
    byTitle.body.data[0].title.includes('Docker'));

  const bySummary = await get('/articles?search=%E7%B1%BB%E5%9E%8B%E7%B3%BB%E7%BB%9F'); // 类型系统
  check('search matches summary field', bySummary.body.data.length === 1 &&
    bySummary.body.data[0].title.includes('TypeScript'));

  const likeChars = await get('/articles?search=100%25_done'); // 100%_done
  check('LIKE wildcards in search are escaped (no false positives)',
    likeChars.status === 200 && likeChars.body.data.length === 0);

  check('meta.filters echoes search', byTitle.body.meta.filters.search === 'Docker');
});

runStep('Combined tag + search filters', async () => {
  // All JavaScript-tagged articles with "Vue" in title/summary: only the
  // Vue 3 Composition API guide.
  const combo = await get('/articles?tag=JavaScript&search=Vue');
  check('tag+search intersect (1 article)', combo.body.data.length === 1,
    `got ${combo.body.data.length}`);
  check('intersection article is the Vue 3 guide',
    combo.body.data[0] && combo.body.data[0].title.includes('Vue 3'));
  check('combined meta echoes both filters',
    combo.body.meta.filters.tag === 'JavaScript' && combo.body.meta.filters.search === 'Vue');
});

runStep('Empty results are valid 200 responses', async () => {
  for (const qs of [
    'search=zzz_no_such_article_zzz',
    'tag=zzz_no_such_tag_zzz',
    'tag=JavaScript&search=zzz_no_such_article_zzz',
    'page=999',
    'page=999&tag=CSS'
  ]) {
    const r = await get(`/articles?${qs}`);
    check(`empty result for ?${qs} => 200 with empty data`,
      r.status === 200 && Array.isArray(r.body.data) && r.body.data.length === 0,
      `status=${r.status} len=${r.body && r.body.data && r.body.data.length}`);
  }
  const beyond = await get('/articles?page=999');
  check('out-of-range page keeps total but reports empty page',
    beyond.body.meta.pagination.total === 15 && beyond.body.meta.pagination.page === 999);
});

runStep('Illegal parameter combinations are rejected with 400', async () => {
  const cases = [
    ['page=0', 'page zero'],
    ['page=-1', 'negative page'],
    ['page=abc', 'non-numeric page'],
    ['page=1.5', 'fractional page'],
    ['limit=0', 'limit zero'],
    ['limit=-5', 'negative limit'],
    ['limit=abc', 'non-numeric limit'],
    ['limit=101', 'limit above maximum'],
    ['limit=1000', 'limit far above maximum'],
    ['page=1&page=2', 'repeated page key'],
    ['tag=a&tag=b', 'repeated tag key'],
    ['tag=' + 'x'.repeat(51), 'tag too long'],
    ['search=' + 'y'.repeat(101), 'search too long']
  ];

  for (const [qs, label] of cases) {
    const r = await get(`/articles?${qs}`);
    check(`${label} => 400 error envelope`,
      r.status === 400 &&
      r.body && r.body.success === false &&
      r.body.error && typeof r.body.error.message === 'string' &&
      r.body.error.code === 'BAD_REQUEST',
      `status=${r.status} body=${JSON.stringify(r.body)}`);
  }
});

runStep('Whitespace / blank filters are ignored', async () => {
  const blankTag = await get('/articles?tag=%20%20');
  check('blank tag is treated as no filter (15 articles)',
    blankTag.body.data.length === 10 && blankTag.body.meta.pagination.total === 15);
  const blankSearch = await get('/articles?search=');
  check('blank search is treated as no filter',
    blankSearch.body.meta.pagination.total === 15);
  check('filters echo null when absent/blank',
    blankTag.body.meta.filters.tag === null && blankSearch.body.meta.filters.search === null);
});

runStep('Article detail endpoint compatibility', async () => {
  const first = (await get('/articles?limit=1')).body.data[0];
  const detail = await get(`/articles/${first.id}`);

  check('detail returns 200', detail.status === 200);
  check('detail is the bare resource (no success/data envelope)',
    detail.body.success === undefined && detail.body.data === undefined,
    `keys=${Object.keys(detail.body).join(',')}`);
  for (const field of ['id', 'title', 'body', 'summary', 'tags', 'created_at', 'updated_at']) {
    check(`detail exposes ${field}`, field in detail.body, `keys=${Object.keys(detail.body).join(',')}`);
  }
  check('detail id matches list id', detail.body.id === first.id);
  check('detail tags is an array', Array.isArray(detail.body.tags));

  const missing = await get('/articles/999999');
  check('missing article => 404', missing.status === 404);
  const badId = await get('/articles/abc');
  check('non-numeric id => 404 (no row matches)', badId.status === 404);
});

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------

async function run(cmd, args, env) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, {
      cwd: path.join(__dirname, '..'),
      env: { ...process.env, ...env },
      stdio: ['ignore', 'pipe', 'pipe']
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', d => { stdout += d; });
    child.stderr.on('data', d => { stderr += d; });
    child.on('error', reject);
    child.on('close', code => code === 0
      ? resolve({ stdout, stderr })
      : reject(new Error(`${cmd} ${args.join(' ')} exited ${code}\n${stderr}`)));
  });
}

let shuttingDown = false;

function cleanup() {
  shuttingDown = true;
  if (serverProc) {
    try { serverProc.kill('SIGTERM'); } catch { /* already gone */ }
    serverProc = null;
  }
  // Remove the verify database and all WAL/SHM sidecars.
  for (const suffix of ['', '-wal', '-shm']) {
    try { fs.rmSync(TMP_DB + suffix, { force: true }); } catch { /* ignore */ }
  }
  try { fs.rmSync(TMP_DIR, { recursive: true, force: true }); } catch { /* ignore */ }
}

async function main() {
  console.log(`Verification run ${RUN_ID}`);
  console.log(`Temporary database: ${TMP_DB}`);

  // Always remove the isolated database/temp directory, even if seeding or
  // server startup fails, so repeated runs never leave residue behind.
  process.on('exit', cleanup);

  // 1. Seed the isolated database.
  console.log('\n[1/3] Seeding isolated sample data...');
  await run(process.execPath, ['db/seed.js'], { DB_PATH: TMP_DB });

  // 2. Start the server against the isolated database.
  console.log('[2/3] Starting API server on port ' + PORT + '...');
  serverProc = spawn(process.execPath, ['server.js'], {
    cwd: path.join(__dirname, '..'),
    env: { ...process.env, PORT: String(PORT), DB_PATH: TMP_DB },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  let serverLog = '';
  serverProc.stdout.on('data', d => { serverLog += d; });
  serverProc.stderr.on('data', d => { serverLog += d; });

  // Fail fast if the port is already taken.
  serverProc.on('exit', code => {
    if (code !== null && !shuttingDown) {
      console.error(`Server exited early (code ${code}). Log:\n${serverLog}`);
      process.exit(1);
    }
  });

  try {
    await waitForServer();
  } catch (err) {
    console.error(err.message + '\nServer log:\n' + serverLog);
    cleanup();
    process.exit(1);
  }

  // Show the server's own startup checklist (port/db/sample data).
  console.log(serverLog.trimEnd());

  // 3. Run all checks.
  console.log('\n[3/3] Running verification checks...');
  try {
    for (const step of steps) {
      console.log(`\n${step.label}`);
      await step.fn();
    }
  } catch (err) {
    console.error('\nVerification crashed:', err);
    failures += 1;
  } finally {
    // Verify no test residue: the isolated database must still hold exactly
    // the 15 seed articles (all checks above are read-only GET requests).
    console.log('\nResidue check');
    try {
      const health = await get('/health');
      check('No test records created (article count still 15)',
        health.body && health.body.database.articleCount === 15,
        `count=${health.body && health.body.database.articleCount}`);
    } catch {
      check('No test records created (health reachable)', false);
    }

    console.log('\n---');
    console.log(`Passed: ${passed}, Failed: ${failures}`);

    cleanup();
    if (failures > 0) {
      console.log('\nVERIFICATION FAILED');
      process.exit(1);
    }
    console.log('\nVERIFICATION PASSED - all temporary files removed');
    process.exit(0);
  }
}

main();
