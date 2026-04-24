# Local Development Guide

## 启动脚本对比

### serve.sh vs start-daemon.sh

| 特性 | serve.sh | start-daemon.sh | start-backend.sh |
|------|----------|-----------------|------------------|
| **运行模式** | 前台运行 | 后台守护进程 | 前台运行 |
| **Nginx** | ✅ 启动 | ✅ 启动 | ❌ 不启动 |
| **前端** | ✅ 启动 | ✅ 启动 | ❌ 不启动 |
| **后端** | ✅ 启动 | ✅ 启动 | ✅ 启动 |
| **适用场景** | 服务器部署 | 后台服务 | 本地开发调试 |

## 本地开发流程

### 方式一：使用 start-backend.sh（推荐）

这种方式不使用 Nginx，前端通过 Next.js rewrite 直接访问后端服务。

#### 1. 启动后端服务

```bash
# 启动所有后端服务（LangGraph + Gateway）
./scripts/start-backend.sh

# 或者跳过 LangGraph（如果不需要）
./scripts/start-backend.sh --skip-langgraph
```

后端服务将运行在：
- LangGraph: http://localhost:2024
- Gateway: http://localhost:8001

#### 2. 启动前端（新终端）

```bash
cd frontend
pnpm dev
```

前端将运行在：http://localhost:3000

#### 3. 访问应用

打开浏览器访问：http://localhost:3000

#### 4. 停止服务

- 后端：在运行 `start-backend.sh` 的终端按 `Ctrl+C`
- 前端：在运行 `pnpm dev` 的终端按 `Ctrl+C`

或者使用停止脚本：

```bash
./scripts/stop-backend.sh
```

### 方式二：使用 serve.sh（完整服务）

这种方式启动所有服务，包括 Nginx 反向代理。

```bash
./scripts/serve.sh
```

所有服务通过 Nginx 统一访问：http://localhost:2026

## API 代理配置

### Next.js Rewrite 配置

前端 `next.config.js` 已配置以下 rewrite 规则：

```javascript
// LangGraph API
/api/langgraph/* → http://localhost:2024/*

// Gateway API
/api/models      → http://localhost:8001/api/models
/api/agents/*    → http://localhost:8001/api/agents/*
/api/article-studio/* → http://localhost:8001/api/article-studio/*
```

### 环境变量配置

如果需要自定义后端地址，可以设置环境变量：

```bash
# 在项目根目录创建 .env.local
DEER_FLOW_INTERNAL_LANGGRAPH_BASE_URL=http://your-langgraph:port
DEER_FLOW_INTERNAL_GATEWAY_BASE_URL=http://your-gateway:port
```

或者直接设置公开的 backend URL：

```bash
# 在 frontend/.env.local
NEXT_PUBLIC_BACKEND_BASE_URL=http://your-backend:port
NEXT_PUBLIC_LANGGRAPH_BASE_URL=http://your-langgraph:port
```

## 常见问题

### Q: 为什么不能直接使用 start-daemon.sh？

A: `start-daemon.sh` 会启动 Nginx，所有请求都通过 Nginx 的 2026 端口。这样会导致：
- Next.js 的 rewrite 配置失效
- 无法直接调试前端和后端的交互
- 不适合本地开发调试

### Q: 什么时候使用 serve.sh？

A: 当你需要：
- 完整的生产环境模拟
- 测试 Nginx 配置
- 验证反向代理行为

### Q: 什么时候使用 start-backend.sh？

A: 当你需要：
- 本地开发调试
- 前端热重载
- 后端热重载
- 直接访问后端 API（不经过 Nginx）

## 日志查看

所有脚本都会将日志写入 `logs/` 目录：

```bash
# 查看后端日志
tail -f logs/langgraph.log
tail -f logs/gateway.log

# 查看前端日志
tail -f logs/frontend.log
```

## Studio 模块开发

对于 Studio 模块的开发，推荐使用 `start-backend.sh`：

```bash
# 终端 1：启动后端
./scripts/start-backend.sh

# 终端 2：启动前端
cd frontend && pnpm dev

# 访问 Studio
# http://localhost:3000/workspace/studio/templates
```

Studio API 将通过 Next.js rewrite 自动代理到后端：
- `/api/article-studio/templates` → `http://localhost:8001/api/article-studio/templates`
- `/api/article-studio/jobs` → `http://localhost:8001/api/article-studio/jobs`
- 等等
