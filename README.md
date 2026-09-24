# Blog Platform

A lightweight personal blog platform built with Vue 3 + Vite (frontend) and Node.js + Express (backend).

## Tech Stack

### Frontend
- **Vue 3** - Progressive JavaScript framework
- **Vite** - Next generation frontend tooling
- **Vue Router** - Official router for Vue.js
- **Pinia** - State management library
- **Element Plus** - Vue 3 UI component library
- **Axios** - HTTP client
- **Marked** - Markdown parser

### Backend
- **Node.js** - JavaScript runtime
- **Express** - Web application framework
- **better-sqlite3** - Fast SQLite3 library
- **jsonwebtoken** - JWT implementation
- **cors** - Cross-Origin Resource Sharing

## Project Structure

```
blog-platform/
├── frontend/          # Vue 3 + Vite frontend
│   ├── src/
│   │   ├── api/       # API client
│   │   ├── components/# Reusable components
│   │   ├── router/    # Vue Router configuration
│   │   ├── stores/    # Pinia stores
│   │   └── views/     # Page components
│   └── ...
├── backend/           # Node.js + Express backend
│   ├── db/            # Database initialization and seeds
│   ├── routes/        # API routes
│   ├── middleware/    # Express middleware
│   └── data/          # SQLite database file
└── README.md
```

## Getting Started

### Prerequisites

- Node.js 18+ 
- npm or yarn

### Installation

1. **Clone or navigate to the project directory**

```bash
cd blog-platform
```

2. **Install backend dependencies**

```bash
cd backend
npm install
```

3. **Install frontend dependencies**

```bash
cd ../frontend
npm install
```

4. **Initialize the database with seed data**

```bash
cd ../backend
npm run seed
```

### Running the Application

1. **Start the backend server (port 3001)**

```bash
cd backend
npm run dev
```

The API server will start at `http://localhost:3001`

2. **Start the frontend development server (port 5173)**

Open a new terminal:

```bash
cd frontend
npm run dev
```

The frontend will be available at `http://localhost:5173`

## Local Development Verification

Two scripts make the article-query API verifiable in a repeatable way.

### 1. Startup environment check (read-only)

With the backend running (`npm run dev`), confirm that the port, database and
seed data are ready:

```bash
cd backend
npm run check
```

Example output:

```text
=== 本地开发环境启动检查 ===
✓ 端口 3001 -> 已有服务监听
✓ 数据库文件 -> /workspace/blog-platform/backend/data/blog.db
✓ 数据表 'articles' -> 结构存在
✓ 示例数据 -> 15 篇文章
✓ 接口冒烟测试 GET /api/articles -> 200 OK
环境就绪，可以开始本地验证。
```

The script never writes to the database (it opens it read-only) and exits with a
non-zero status when anything is missing.

### 2. End-to-end verification (fully isolated)

```bash
cd backend
npm run verify
```

This provisions a throwaway database in the OS temp directory (via
`BLOG_DB_PATH`), seeds it with the standard sample data, starts the same
Express app on a random free port, runs real HTTP requests, and removes the
temporary database afterwards. Your development database
(`backend/data/blog.db`) is never touched, and repeated runs leave no records.

Coverage:

- **Pagination** — defaults, custom `page`/`limit`, `totalPages`, ordering, limit bounds
- **Tags** — exact tag matching (no `Java` → `JavaScript` leaks), tag + pagination
- **Search** — title/summary search, ASCII case-insensitivity, Chinese terms, tag + search, LIKE wildcard escaping
- **Empty results** — unknown tag / search / combination / page beyond range all return `200` with an empty list
- **Invalid parameter combinations** — `page`/`limit` that are zero, negative, non-numeric, decimals, or over the limit return `400`
- **Response convention** — list and tags share the same envelope; frontend field contract is asserted
- **Detail compatibility** — the flat detail object (including `body`) is unchanged
- **Repeatability** — re-seeding resets ids to `1..15`, temp files are deleted

### Response convention

Collection endpoints (`GET /api/articles`, `GET /api/tags`) share one envelope:

```json
{
  "articles": [ /* ... */ ],
  "pagination": { "total": 15, "page": 1, "limit": 10, "totalPages": 2 }
}
```

```json
{
  "tags": ["CSS", "JavaScript"],
  "pagination": { "total": 27, "page": 1, "limit": 27, "totalPages": 1 }
}
```

- List item fields (used by the frontend): `id`, `title`, `summary`, `tags` (array), `created_at`, `updated_at`
- Detail / create / update return the flat article object, which additionally includes `body`
- Errors return `{ "error": "message" }` with an appropriate status (`400` / `404` / `500`)

Query parameter rules for `GET /api/articles`:

| Parameter | Rule |
|-----------|------|
| `page` | Positive integer; defaults to `1`; invalid values return `400` |
| `limit` | Integer `1`–`100`; defaults to `10`; out-of-range values return `400` |
| `tag` | Optional, matches complete comma-separated tags; empty/whitespace is ignored |
| `search` | Optional, matches `title` or `summary`; empty/whitespace is ignored |

`BLOG_DB_PATH` overrides the database file location (used by `npm run verify`);
`PORT` overrides the listening port.

## Features

- **Article Management**: Create, read, update, and delete blog articles
- **Markdown Support**: Write articles in Markdown with live preview
- **Tag System**: Organize articles with tags and filter by tags
- **Pagination**: Navigate through articles with pagination (10 per page)
- **Admin Panel**: Protected admin area for managing articles
- **JWT Authentication**: Secure admin login with JSON Web Tokens

## API Endpoints

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | `/api/auth/login` | Admin login | No |
| GET | `/api/articles` | List articles (with pagination and tag filter) | No |
| GET | `/api/articles/:id` | Get single article | No |
| POST | `/api/articles` | Create new article | Yes |
| PUT | `/api/articles/:id` | Update article | Yes |
| DELETE | `/api/articles/:id` | Delete article | Yes |
| GET | `/api/tags` | Get all unique tags | No |

## Admin Credentials

- **Username**: admin
- **Password**: admin123

## Configuration

### Backend

- Server port: `3001` (configurable via `PORT` environment variable)
- JWT secret: `blog-platform-secret-key` (hardcoded in middleware/auth.js)
- Database file: `backend/data/blog.db`

### Frontend

- Dev server port: `5173`
- API proxy: `/api` requests are proxied to `http://localhost:3001`

## Build for Production

### Backend

The backend runs directly with Node.js:

```bash
cd backend
npm start
```

### Frontend

Build the frontend for production:

```bash
cd frontend
npm run build
```

The built files will be in `frontend/dist/`

## License

MIT
