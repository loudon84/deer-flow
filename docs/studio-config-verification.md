# Studio 前后端配置验证

## 后端配置

### Studio 服务端口
- **默认端口**: `8320`
- **配置文件**: `backend/packages/studio/settings/studio_settings.py`
- **环境变量**: `STUDIO_PORT` (默认: 8320)

### 启动命令
```bash
cd backend
PYTHONPATH=packages/studio:. uv run python debug_studio.py
```

### 服务地址
- **监听地址**: `http://0.0.0.0:8320`
- **本地访问**: `http://localhost:8320`

### API 路由
- Health: `GET http://localhost:8320/health`
- Templates: `GET http://localhost:8320/api/v1/templates`
- Jobs: `GET http://localhost:8320/api/v1/jobs`
- Documents: `GET http://localhost:8320/api/v1/documents`

## 前端配置

### Next.js Rewrite 配置
**文件**: `frontend/next.config.js`

```javascript
// Studio API proxy (runs on port 8320)
const LOCAL_STUDIO_URL = "http://localhost:8320";

rewrites.push({
  source: "/api/v1",
  destination: `${studioURL}/api/v1`,
});
rewrites.push({
  source: "/api/v1/:path*",
  destination: `${studioURL}/api/v1/:path*`,
});
```

### API Client 配置
**文件**: `frontend/src/core/studio/api/client.ts`

- 使用 `getBackendBaseURL()` 获取基础 URL
- 当 `NEXT_PUBLIC_BACKEND_BASE_URL` 未设置时，返回空字符串
- 依赖 Next.js rewrite 进行代理

### API 路径
**文件**: `frontend/src/core/studio/api/templates.ts`

```typescript
export function listTemplates() {
  return articleStudioClient.get<TemplateSummary[]>(
    "/api/v1/templates",  // 相对路径，通过 rewrite 代理
  );
}
```

## 配置验证

### ✅ 正确的配置

1. **后端端口**: 8320 ✅
2. **前端 rewrite**: 指向 `http://localhost:8320` ✅
3. **API 路由前缀**: `/api/v1/` ✅
4. **前端 API 路径**: `/api/v1/templates` ✅

### 请求流程

```
前端请求                          Next.js Rewrite              后端服务
──────────────────────────────────────────────────────────────────────
/api/v1/templates         →      localhost:8320/api/v1/templates
                                  (rewrite 代理)                    ↓
                                                              处理请求
```

## 测试验证

### 1. 启动后端 Studio

```bash
cd backend
PYTHONPATH=packages/studio:. uv run python debug_studio.py
```

输出应该显示：
```
  Host: 0.0.0.0
  Port: 8320
  API Endpoints:
    - Health:        http://localhost:8320/health
    - Templates:     http://localhost:8320/api/v1/templates
    - Jobs:          http://localhost:8320/api/v1/jobs
    - Documents:     http://localhost:8320/api/v1/documents
```

### 2. 测试后端 API

```bash
# 健康检查
curl http://localhost:8320/health

# 获取模板列表
curl http://localhost:8320/api/v1/templates
```

### 3. 启动前端

```bash
cd frontend
pnpm dev
```

前端运行在: `http://localhost:3000`

### 4. 测试前端代理

```bash
# 通过前端代理访问 Studio API
curl http://localhost:3000/api/v1/templates

# 应该返回与直接访问后端相同的结果
```

### 5. 访问 Studio 页面

打开浏览器访问：
```
http://localhost:3000/workspace/studio/templates
```

## 环境变量配置

### 可选：自定义 Studio 地址

如果 Studio 运行在其他地址，可以设置环境变量：

```bash
# 在 frontend/.env.local
DEER_FLOW_INTERNAL_STUDIO_BASE_URL=http://your-studio-host:port
```

### 可选：自定义 Studio 端口

```bash
# 启动时指定端口
STUDIO_PORT=9320 uv run python debug_studio.py

# 或在 .env 文件中
STUDIO_PORT=9320
```

然后更新前端配置：
```bash
# frontend/.env.local
DEER_FLOW_INTERNAL_STUDIO_BASE_URL=http://localhost:9320
```

## 常见问题

### Q: 前端请求返回 404？

A: 检查以下几点：

1. **后端是否启动**：
   ```bash
   curl http://localhost:8320/health
   ```

2. **端口是否正确**：
   - 后端默认端口: 8320
   - 前端 rewrite 配置: `http://localhost:8320`

3. **API 路径是否正确**：
   - ✅ `/api/v1/templates`
   - ❌ `/api/article-studio/templates`

### Q: 如何查看 rewrite 是否生效？

A: 在前端启动时，Next.js 会输出 rewrite 配置：

```
- /api/v1/:path* -> http://localhost:8320/api/v1/:path*
```

或在代码中打印：

```javascript
// frontend/next.config.js
console.log('Studio URL:', studioURL);
```

### Q: 如何调试 rewrite？

A: 使用浏览器开发者工具：

1. 打开 Network 标签
2. 访问 `/workspace/studio/templates`
3. 查看请求 URL：
   - Request URL: `http://localhost:3000/api/v1/templates`
   - 实际请求会被代理到: `http://localhost:8320/api/v1/templates`

## 配置总结

| 配置项 | 值 | 文件 |
|--------|-----|------|
| 后端端口 | 8320 | `backend/packages/studio/settings/studio_settings.py` |
| 后端监听 | 0.0.0.0 | `backend/packages/studio/settings/studio_settings.py` |
| API 前缀 | /api/v1/ | `backend/packages/studio/api/router_*.py` |
| 前端 rewrite | localhost:8320 | `frontend/next.config.js` |
| 前端 API 路径 | /api/v1/* | `frontend/src/core/studio/api/*.ts` |

所有配置已正确设置，前后端应该能够正常通信！
