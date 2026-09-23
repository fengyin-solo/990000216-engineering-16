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

This loads 15 sample articles and resets their ids to `1..15`, so the data
is identical on every run.

### Verifying the article query API (reproducible)

A self-contained verification script covers pagination, tag filtering,
search, empty results and illegal parameter combinations, plus the shared
list/tag response contract and detail-endpoint compatibility:

```bash
cd backend
npm run verify
```

The script boots the **real** Express server against an isolated temporary
SQLite database (it never touches `backend/data/blog.db`), runs all checks
over HTTP, then shuts the server down and deletes every temporary file.
Repeated runs leave no test records behind. Use `PORT=3200 npm run verify`
if the default port (3101) is busy.

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
| GET | `/api/health` | Readiness probe (port, database, sample data) | No |
| POST | `/api/auth/login` | Admin login | No |
| GET | `/api/articles` | List articles (pagination, tag filter, search) | No |
| GET | `/api/articles/tags` | Tag summary (same contract as the list) | No |
| GET | `/api/tags` | Alias of `/api/articles/tags` | No |
| GET | `/api/articles/:id` | Get single article | No |
| POST | `/api/articles` | Create new article | Yes |
| PUT | `/api/articles/:id` | Update article | Yes |
| DELETE | `/api/articles/:id` | Delete article | Yes |

### Startup checks

On boot the server prints an explicit checklist showing whether the port is
listening, whether the SQLite database file is present/connected and whether
sample data is loaded (with a hint to run `npm run seed` when empty). The same
information is available at any time via `GET /api/health`.

### Response contract

List/tag **collection** endpoints share one envelope:

```json
{
  "success": true,
  "data": [ ... ],
  "meta": { "pagination": { "total": 15, "page": 1, "limit": 10, "totalPages": 2 },
            "filters": { "tag": null, "search": null } }
}
```

(`GET /api/tags` returns the same envelope with `meta: { count }`.) Errors use
`{ "success": false, "error": { "code", "message" } }` — illegal query
parameters (non-positive/non-numeric `page` or `limit`, `limit` over 100,
repeated keys, overlong filters) return `400`. Out-of-range pages and
no-match filters return `200` with an empty `data` array. The frontend Axios
client flattens this envelope, so views still consume `articles` /
`pagination` / `tags` exactly as before.

The **single-article** detail endpoints keep returning the bare article
object (`id`, `title`, `body`, `summary`, `tags`, `created_at`, `updated_at`)
without an envelope, to stay compatible with the existing detail page and
admin editor.

### Article list query parameters

| Parameter | Rules |
|-----------|-------|
| `page` | Positive integer, default `1` |
| `limit` | Positive integer, default `10`, maximum `100` |
| `tag` | Exact tag match (e.g. `?tag=JavaScript`); blank values are ignored |
| `search` | Matches title or summary; `%`/`_` wildcards are escaped |

## Admin Credentials

- **Username**: admin
- **Password**: admin123

## Configuration

### Backend

- Server port: `3001` (configurable via `PORT` environment variable)
- JWT secret: `blog-platform-secret-key` (hardcoded in middleware/auth.js)
- Database file: `backend/data/blog.db` (overridable via `DB_PATH`; the
  verification script uses this to isolate its temporary database)

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
