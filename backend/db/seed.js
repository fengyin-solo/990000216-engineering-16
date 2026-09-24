const initDb = require('./init');

// 示例数据：供本地开发与验证环境复用。
// 直接执行本文件（npm run seed）时写入默认开发库；
// 被验证脚本调用时通过 BLOG_DB_PATH 写入临时库。
const articles = [
  {
    title: 'JavaScript ES6+ 新特性详解',
    body: `# JavaScript ES6+ 新特性详解

## 箭头函数

箭头函数提供了更简洁的函数写法：

\`\`\`javascript
const add = (a, b) => a + b;
const square = x => x * x;
\`\`\`

## 解构赋值

从数组或对象中提取值：

\`\`\`javascript
const [a, b, c] = [1, 2, 3];
const { name, age } = person;
\`\`\`

## 模板字符串

使用反引号创建模板字符串：

\`\`\`javascript
const greeting = \`Hello, \${name}!\`;
\`\`\`

## Promise 与 async/await

异步编程的现代写法：

\`\`\`javascript
async function fetchData() {
  try {
    const response = await fetch(url);
    const data = await response.json();
    return data;
  } catch (error) {
    console.error(error);
  }
}
\`\`\`

## 总结

ES6+ 带来了许多实用特性，大大提升了开发效率。`,
    summary: '深入讲解 JavaScript ES6+ 的重要新特性，包括箭头函数、解构赋值、模板字符串、async/await 等。',
    tags: 'JavaScript,ES6,前端'
  },
  {
    title: 'Vue 3 Composition API 入门指南',
    body: `# Vue 3 Composition API 入门指南

## 什么是 Composition API

Composition API 是 Vue 3 引入的一组新的 API，它允许我们使用函数来组织组件逻辑。

## setup 函数

\`\`\`javascript
import { ref, computed, onMounted } from 'vue';

export default {
  setup() {
    const count = ref(0);
    const doubleCount = computed(() => count.value * 2);

    function increment() {
      count.value++;
    }

    onMounted(() => {
      console.log('Component mounted');
    });

    return { count, doubleCount, increment };
  }
};
\`\`\`

## 响应式数据

使用 \`ref\` 和 \`reactive\` 创建响应式数据：

\`\`\`javascript
const count = ref(0);
const state = reactive({ name: 'Vue', version: 3 });
\`\`\`

## 生命周期钩子

\`\`\`javascript
import { onMounted, onUpdated, onUnmounted } from 'vue';

onMounted(() => { /* ... */ });
onUpdated(() => { /* ... */ });
onUnmounted(() => { /* ... */ });
\`\`\`

## 总结

Composition API 让组件逻辑复用变得更加容易。`,
    summary: '从零开始学习 Vue 3 Composition API，掌握 setup、ref、reactive 等核心概念。',
    tags: 'Vue,Vue3,前端,JavaScript'
  },
  {
    title: 'CSS Flexbox 完全指南',
    body: `# CSS Flexbox 完全指南

## 基础概念

Flexbox 是一种一维布局模型，用于在容器中分配空间和对齐项目。

## 容器属性

\`\`\`css
.container {
  display: flex;
  flex-direction: row;
  justify-content: center;
  align-items: center;
  flex-wrap: wrap;
  gap: 16px;
}
\`\`\`

## 项目属性

\`\`\`css
.item {
  flex: 1;
  flex-grow: 2;
  flex-shrink: 1;
  flex-basis: 200px;
  align-self: flex-end;
}
\`\`\`

## 常见布局

### 水平垂直居中

\`\`\`css
.center {
  display: flex;
  justify-content: center;
  align-items: center;
}
\`\`\`

### 等分布局

\`\`\`css
.equal-width {
  display: flex;
}
.equal-width > * {
  flex: 1;
}
\`\`\`

## 总结

Flexbox 是现代 CSS 布局的基础工具。`,
    summary: '全面介绍 CSS Flexbox 布局，包括容器属性、项目属性和常见布局模式。',
    tags: 'CSS,前端,布局'
  },
  {
    title: 'Node.js 流(Stream)详解',
    body: `# Node.js 流(Stream)详解

## 什么是流

流是一种处理数据的方式，它允许你逐块处理数据，而不是一次性将所有数据加载到内存中。

## 流的类型

- **Readable**: 可读流
- **Writable**: 可写流
- **Duplex**: 双向流
- **Transform**: 转换流

## 可读流示例

\`\`\`javascript
const fs = require('fs');
const readStream = fs.createReadStream('large-file.txt', { encoding: 'utf8' });

readStream.on('data', (chunk) => {
  console.log('Received chunk:', chunk.length);
});

readStream.on('end', () => {
  console.log('File read complete');
});
\`\`\`

## 管道(Pipe)

\`\`\`javascript
const fs = require('fs');
const readStream = fs.createReadStream('input.txt');
const writeStream = fs.createWriteStream('output.txt');

readStream.pipe(writeStream);
\`\`\`

## 总结

流是处理大文件和网络数据的最佳方式。`,
    summary: '深入理解 Node.js 流的概念、类型和使用方法，包含实际代码示例。',
    tags: 'Node.js,后端,JavaScript'
  },
  {
    title: 'TypeScript 类型体操入门',
    body: `# TypeScript 类型体操入门

## 基础类型

\`\`\`typescript
type StringOrNumber = string | number;
type Readonly<T> = { readonly [P in keyof T]: T[P] };
\`\`\`

## 条件类型

\`\`\`typescript
type IsString<T> = T extends string ? true : false;
type A = IsString<string>; // true
type B = IsString<number>; // false
\`\`\`

## 映射类型

\`\`\`typescript
type Partial<T> = {
  [P in keyof T]?: T[P];
};

type Required<T> = {
  [P in keyof T]-?: T[P];
};
\`\`\`

## 实用工具类型

\`\`\`typescript
interface User {
  id: number;
  name: string;
  email: string;
  age: number;
}

type UserPartial = Partial<User>;
type UserReadonly = Readonly<User>;
type UserKeys = keyof User;
type UserName = Pick<User, 'name'>;
\`\`\`

## 总结

掌握类型体操可以写出更安全、更优雅的 TypeScript 代码。`,
    summary: '学习 TypeScript 高级类型系统，包括条件类型、映射类型和实用工具类型。',
    tags: 'TypeScript,前端,JavaScript'
  },
  {
    title: 'React Hooks 最佳实践',
    body: `# React Hooks 最佳实践

## useState

\`\`\`jsx
const [count, setCount] = useState(0);
const [user, setUser] = useState({ name: '', age: 0 });
\`\`\`

## useEffect

\`\`\`jsx
useEffect(() => {
  const subscription = subscribe(id);
  return () => subscription.unsubscribe();
}, [id]);
\`\`\`

## 自定义 Hook

\`\`\`jsx
function useLocalStorage(key, initialValue) {
  const [value, setValue] = useState(() => {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : initialValue;
  });

  useEffect(() => {
    localStorage.setItem(key, JSON.stringify(value));
  }, [key, value]);

  return [value, setValue];
}
\`\`\`

## useMemo 和 useCallback

\`\`\`jsx
const memoizedValue = useMemo(() => expensiveCalc(a, b), [a, b]);
const memoizedCallback = useCallback(() => doSomething(a), [a]);
\`\`\`

## 总结

合理使用 Hooks 可以让 React 组件更加简洁和可维护。`,
    summary: '总结 React Hooks 的使用经验和最佳实践，包括自定义 Hook 的编写技巧。',
    tags: 'React,前端,JavaScript'
  },
  {
    title: 'Git 工作流与团队协作',
    body: `# Git 工作流与团队协作

## Git Flow

\`\`\`bash
git checkout -b feature/login
# 开发...
git add .
git commit -m "feat: add login page"
git push origin feature/login
\`\`\`

## 常用命令

\`\`\`bash
git log --oneline --graph
git rebase -i HEAD~3
git stash
git stash pop
git cherry-pick <commit>
\`\`\`

## 提交规范

- feat: 新功能
- fix: 修复
- docs: 文档
- style: 格式
- refactor: 重构
- test: 测试
- chore: 构建

## 分支策略

1. **main**: 生产环境代码
2. **develop**: 开发分支
3. **feature/***: 功能分支
4. **hotfix/***: 紧急修复

## 总结

良好的 Git 工作流可以提高团队协作效率。`,
    summary: '介绍 Git 工作流、分支策略和团队协作的最佳实践。',
    tags: 'Git,工具,团队协作'
  },
  {
    title: 'Docker 容器化部署实战',
    body: `# Docker 容器化部署实战

## Dockerfile 示例

\`\`\`dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
EXPOSE 3000
CMD ["node", "server.js"]
\`\`\`

## docker-compose.yml

\`\`\`yaml
version: '3.8'
services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
    depends_on:
      - db
  db:
    image: postgres:14
    volumes:
      - pgdata:/var/lib/postgresql/data
volumes:
  pgdata:
\`\`\`

## 常用命令

\`\`\`bash
docker build -t myapp .
docker run -d -p 3000:3000 myapp
docker-compose up -d
docker logs <container_id>
\`\`\`

## 总结

Docker 让应用部署变得简单和一致。`,
    summary: '学习使用 Docker 容器化部署 Node.js 应用，包括 Dockerfile 和 docker-compose 配置。',
    tags: 'Docker,部署,DevOps'
  },
  {
    title: 'Webpack 5 配置详解',
    body: `# Webpack 5 配置详解

## 基础配置

\`\`\`javascript
module.exports = {
  mode: 'production',
  entry: './src/index.js',
  output: {
    filename: '[name].[contenthash].js',
    path: path.resolve(__dirname, 'dist'),
    clean: true
  },
  module: {
    rules: [
      { test: /\\.css$/, use: ['style-loader', 'css-loader'] },
      { test: /\\.(png|jpg)$/, type: 'asset/resource' }
    ]
  }
};
\`\`\`

## 代码分割

\`\`\`javascript
optimization: {
  splitChunks: {
    chunks: 'all'
  }
}
\`\`\`

## 插件

\`\`\`javascript
const HtmlWebpackPlugin = require('html-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');

plugins: [
  new HtmlWebpackPlugin({ template: './src/index.html' }),
  new MiniCssExtractPlugin()
]
\`\`\`

## 总结

Webpack 5 带来了更好的开箱体验和持久化缓存。`,
    summary: '详解 Webpack 5 的配置方法，包括模块规则、代码分割和常用插件。',
    tags: 'Webpack,构建工具,前端'
  },
  {
    title: 'MongoDB 聚合管道实战',
    body: `# MongoDB 聚合管道实战

## 基础聚合

\`\`\`javascript
db.orders.aggregate([
  { $match: { status: 'completed' } },
  { $group: { _id: '$customerId', total: { $sum: '$amount' } } },
  { $sort: { total: -1 } },
  { $limit: 10 }
]);
\`\`\`

## 常用阶段

- **$match**: 过滤文档
- **$group**: 分组聚合
- **$project**: 重塑文档
- **$lookup**: 联表查询
- **$unwind**: 展开数组

## 联表查询

\`\`\`javascript
db.orders.aggregate([
  {
    $lookup: {
      from: 'customers',
      localField: 'customerId',
      foreignField: '_id',
      as: 'customer'
    }
  }
]);
\`\`\`

## 总结

聚合管道是 MongoDB 数据分析的强大工具。`,
    summary: '实战演练 MongoDB 聚合管道的各种操作，包括分组、联表查询等。',
    tags: 'MongoDB,数据库,后端'
  },
  {
    title: 'CSS Grid 布局实战',
    body: `# CSS Grid 布局实战

## 基础网格

\`\`\`css
.grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  grid-gap: 20px;
}
\`\`\`

## 命名区域

\`\`\`css
.layout {
  display: grid;
  grid-template-areas:
    "header header header"
    "sidebar main main"
    "footer footer footer";
  grid-template-columns: 200px 1fr 1fr;
}

.header { grid-area: header; }
.sidebar { grid-area: sidebar; }
.main { grid-area: main; }
.footer { grid-area: footer; }
\`\`\`

## 响应式网格

\`\`\`css
.responsive-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 16px;
}
\`\`\`

## 总结

CSS Grid 是创建二维布局的最佳选择。`,
    summary: '通过实际案例学习 CSS Grid 布局，包括命名区域和响应式网格。',
    tags: 'CSS,前端,布局'
  },
  {
    title: 'Express.js 中间件机制解析',
    body: `# Express.js 中间件机制解析

## 什么是中间件

中间件函数是可以访问请求对象、响应对象和 next 函数的函数。

## 基本用法

\`\`\`javascript
const logger = (req, res, next) => {
  console.log(\`\${req.method} \${req.url}\`);
  next();
};

app.use(logger);
\`\`\`

## 错误处理中间件

\`\`\`javascript
const errorHandler = (err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: err.message });
};

app.use(errorHandler);
\`\`\`

## 认证中间件

\`\`\`javascript
const authenticate = (req, res, next) => {
  const token = req.headers.authorization;
  if (!token) return res.status(401).json({ error: 'Unauthorized' });

  try {
    req.user = verifyToken(token);
    next();
  } catch (err) {
    res.status(403).json({ error: 'Invalid token' });
  }
};
\`\`\`

## 总结

中间件是 Express 的核心概念，理解它对于构建健壮的应用至关重要。`,
    summary: '深入理解 Express.js 中间件机制，包括日志、错误处理和认证中间件的实现。',
    tags: 'Node.js,Express,后端'
  },
  {
    title: 'Pinia 状态管理实战',
    body: `# Pinia 状态管理实战

## 安装与配置

\`\`\`javascript
import { createPinia } from 'pinia';

const app = createApp(App);
const pinia = createPinia();

app.use(pinia);
\`\`\`

## 定义 Store

\`\`\`javascript
import { defineStore } from 'pinia';

export const useCounterStore = defineStore('counter', {
  state: () => ({
    count: 0
  }),
  getters: {
    doubleCount: (state) => state.count * 2
  },
  actions: {
    increment() {
      this.count++;
    },
    async fetchCount() {
      const res = await api.getCount();
      this.count = res.data;
    }
  }
});
\`\`\`

## Composition API 风格

\`\`\`javascript
export const useUserStore = defineStore('user', () => {
  const user = ref(null);
  const isLoggedIn = computed(() => !!user.value);

  function login(credentials) {
    // ...
  }

  return { user, isLoggedIn, login };
});
\`\`\`

## 总结

Pinia 是 Vue 3 推荐的状态管理库，API 简洁直观。`,
    summary: '学习 Pinia 状态管理库的使用，包括 Options API 和 Composition API 两种风格。',
    tags: 'Vue,Pinia,前端,状态管理'
  },
  {
    title: 'HTTP 缓存策略详解',
    body: `# HTTP 缓存策略详解

## 强缓存

\`\`\`
Cache-Control: max-age=31536000
Expires: Wed, 21 Oct 2025 07:28:00 GMT
\`\`\`

## 协商缓存

\`\`\`
ETag: "abc123"
Last-Modified: Tue, 15 Nov 2024 12:45:26 GMT

If-None-Match: "abc123"
If-Modified-Since: Tue, 15 Nov 2024 12:45:26 GMT
\`\`\`

## 缓存策略

| 资源类型 | 策略 |
|---------|------|
| HTML | no-cache |
| CSS/JS | max-age=31536000 |
| 图片 | max-age=86400 |
| API | no-store |

## 最佳实践

1. 使用内容哈希命名静态资源
2. HTML 文件使用 no-cache
3. 静态资源使用长期缓存
4. API 响应根据需求设置缓存

## 总结

合理的缓存策略可以显著提升网站性能。`,
    summary: '详解 HTTP 缓存的两种策略：强缓存和协商缓存，以及最佳实践。',
    tags: 'HTTP,性能优化,前端,后端'
  },
  {
    title: 'Vite 构建工具入门与进阶',
    body: `# Vite 构建工具入门与进阶

## 为什么选择 Vite

- 极快的冷启动
- 即时热更新
- 优化的构建

## 基础配置

\`\`\`javascript
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

export default defineConfig({
  plugins: [vue()],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:3001'
    }
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['vue', 'vue-router']
        }
      }
    }
  }
});
\`\`\`

## 环境变量

\`\`\`bash
VITE_API_URL=http://localhost:3001
VITE_APP_TITLE=My Blog
\`\`\`

\`\`\`javascript
const apiUrl = import.meta.env.VITE_API_URL;
\`\`\`

## 插件开发

\`\`\`javascript
function myPlugin() {
  return {
    name: 'my-plugin',
    transform(code, id) {
      // 转换代码
    }
  };
}
\`\`\`

## 总结

Vite 是现代前端开发的最佳构建工具选择。`,
    summary: '学习 Vite 构建工具的配置和使用，包括环境变量、插件开发和构建优化。',
    tags: 'Vite,构建工具,前端'
  }
];

/**
 * 重置并写入示例数据，可安全重复执行。
 * @returns {number} 写入的文章数量
 */
function seedDatabase() {
  const db = initDb();

  const insertStmt = db.prepare(`
    INSERT INTO articles (title, body, summary, tags, created_at, updated_at)
    VALUES (@title, @body, @summary, @tags, @created_at, @updated_at)
  `);

  const insertMany = db.transaction((rows) => {
    // 清空并重置自增序列，保证每次执行后示例数据一致，且不残留任何旧记录
    db.exec('DELETE FROM articles');
    db.exec("DELETE FROM sqlite_sequence WHERE name = 'articles'");
    for (const article of rows) {
      insertStmt.run(article);
    }
  });

  const now = new Date();
  const articlesWithDates = articles.map((article, index) => ({
    ...article,
    created_at: new Date(now.getTime() - (articles.length - index) * 86400000).toISOString(),
    updated_at: new Date(now.getTime() - (articles.length - index) * 86400000).toISOString()
  }));

  insertMany(articlesWithDates);

  return articles.length;
}

module.exports = { articles, seedDatabase };

// 直接运行：npm run seed
if (require.main === module) {
  const { getDbPath, closeDb } = require('./init');
  const dbPath = getDbPath();
  const count = seedDatabase();
  closeDb();

  console.log(`Seeded ${count} articles successfully at ${dbPath}`);
}
