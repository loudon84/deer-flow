# Studio API 路由说明

## 正确的路由前缀

Studio 的 API 路由前缀是 **`/api/v1/`**，不是 `/api/article-studio/`。

## 完整的 API 路由列表

### Health Check
- `GET /health` - 健康检查

### Templates API
- `GET /api/v1/templates` - 获取模板列表
- `GET /api/v1/templates/{template_id}` - 获取模板详情
- `POST /api/v1/templates` - 创建模板
- `PUT /api/v1/templates/{template_id}` - 更新模板
- `DELETE /api/v1/templates/{template_id}` - 删除模板
- `GET /api/v1/templates/{template_id}/versions` - 获取模板版本列表
- `POST /api/v1/templates/{template_id}/versions` - 创建模板版本
- `GET /api/v1/templates/{template_id}/versions/{version}` - 获取特定版本

### Jobs API
- `GET /api/v1/jobs` - 获取任务列表
- `GET /api/v1/jobs/{job_id}` - 获取任务详情
- `POST /api/v1/jobs` - 创建任务
- `POST /api/v1/jobs/{job_id}/cancel` - 取消任务
- `POST /api/v1/jobs/{job_id}/retry` - 重试任务

### Documents API
- `GET /api/v1/documents` - 获取文档列表
- `GET /api/v1/documents/{document_id}` - 获取文档详情
- `PUT /api/v1/documents/{document_id}` - 更新文档
- `POST /api/v1/documents/{document_id}/submit-approval` - 提交审批
- `POST /api/v1/documents/{document_id}/approve` - 审批通过
- `POST /api/v1/documents/{document_id}/reject` - 审批驳回
- `GET /api/v1/documents/{document_id}/approvals` - 获取审批历史

## 本地开发配置

### 1. 启动 Studio 服务

```bash
cd backend
PYTHONPATH=packages/studio:. uv run python debug_studio.py
```

服务将运行在：`http://localhost:8320`

### 2. 前端 Rewrite 配置

`frontend/next.config.js` 已配置：

```javascript
// Studio API proxy (runs on port 8320)
rewrites.push({
  source: "/api/v1",
  destination: "http://localhost:8320/api/v1",
});
rewrites.push({
  source: "/api/v1/:path*",
  destination: "http://localhost:8320/api/v1/:path*",
});
```

### 3. 前端 API 调用

前端通过相对路径调用 API：

```typescript
// 正确 ✅
fetch('/api/v1/templates')

// 错误 ❌
fetch('/api/article-studio/templates')
```

### 4. 测试 API

使用 curl：

```bash
# 健康检查
curl http://localhost:8320/health

# 获取模板列表
curl http://localhost:8320/api/v1/templates

# 通过前端代理访问
curl http://localhost:3000/api/v1/templates
```

使用 PyCharm HTTP Client：

打开 `backend/test_studio.http` 文件，运行测试请求。

## 环境变量

可以通过环境变量自定义 Studio 服务地址：

```bash
# 在 frontend/.env.local
DEER_FLOW_INTERNAL_STUDIO_BASE_URL=http://your-studio:port
```

## 常见问题

### Q: 为什么访问 `/api/article-studio/templates` 返回 404？

A: Studio 的路由前缀是 `/api/v1/`，不是 `/api/article-studio/`。请使用正确的路径：
- ✅ `/api/v1/templates`
- ❌ `/api/article-studio/templates`

### Q: 前端如何调用 Studio API？

A: 前端使用相对路径 `/api/v1/*`，Next.js 会自动通过 rewrite 代理到 Studio 服务。

### Q: Studio 服务运行在哪个端口？

A: 默认运行在 `8320` 端口，可通过 `STUDIO_PORT` 环境变量修改。

## 已更新的文件

1. **前端 API 文件**：
   - `frontend/src/core/studio/api/templates.ts`
   - `frontend/src/core/studio/api/jobs.ts`
   - `frontend/src/core/studio/api/documents.ts`

2. **前端配置**：
   - `frontend/next.config.js` - 添加 Studio rewrite

3. **后端调试文件**：
   - `backend/debug_studio.py` - 更新 API 端点说明
   - `backend/test_studio.http` - 更新测试请求路径
