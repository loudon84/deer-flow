# Article Studio 调试指南

## 快速开始

### 命令行启动

```bash
cd backend
PYTHONPATH=packages/studio:. uv run python debug_studio.py
```

### PyCharm 调试配置

#### 方法一：使用预配置的运行配置

1. 在 PyCharm 中打开项目
2. 在右上角的运行配置下拉菜单中选择 `debug_studio`
3. 点击 Debug 按钮（绿色虫子图标）或按 `Shift+F9`

#### 方法二：手动配置

1. 打开 `Run` → `Edit Configurations...`
2. 点击 `+` 添加新的 `Python` 配置
3. 配置如下：

| 配置项 | 值 |
|--------|-----|
| **Name** | debug_studio |
| **Script path** | `backend/debug_studio.py` |
| **Working directory** | `backend` |
| **Environment variables** | 见下方 |

**环境变量：**
```
PYTHONPATH=packages/studio:.
STUDIO_HOST=0.0.0.0
STUDIO_PORT=8320
STUDIO_MONGODB_URI=mongodb://localhost:27017
STUDIO_MONGODB_DB=studio
```

4. 点击 `OK` 保存配置
5. 点击 Debug 按钮启动调试

## 调试技巧

### 1. 设置断点

在以下文件中设置断点进行调试：

- `packages/studio/api/router_templates.py` - 模板相关 API
- `packages/studio/api/router_jobs.py` - 任务相关 API
- `packages/studio/api/router_documents.py` - 文档相关 API
- `packages/studio/services/*.py` - 业务逻辑层
- `packages/studio/workers/*.py` - 后台任务处理

### 2. 条件断点

在断点上右键，可以设置条件断点：

```python
# 例如：只在特定模板 ID 时触发
template_id == "your-template-id"
```

### 3. 表达式求值

在调试时，可以在 Debug Console 中执行任意 Python 代码：

```python
# 查看变量值
print(template)

# 执行方法
result = await some_service.method()
```

### 4. 热重载

`debug_studio.py` 启用了 `reload=True`，修改代码后会自动重启服务。

## API 测试

### 使用 curl 测试

```bash
# 健康检查
curl http://localhost:8320/health

# 获取模板列表
curl http://localhost:8320/api/article-studio/templates

# 创建任务
curl -X POST http://localhost:8320/api/article-studio/jobs \
  -H "Content-Type: application/json" \
  -d '{
    "template_id": "your-template-id",
    "input_data": {"title": "Test Article"}
  }'
```

### 使用 PyCharm HTTP Client

创建 `test_studio.http` 文件：

```http
### Health Check
GET http://localhost:8320/health

### List Templates
GET http://localhost:8320/api/article-studio/templates

### Create Job
POST http://localhost:8320/api/article-studio/jobs
Content-Type: application/json

{
  "template_id": "your-template-id",
  "input_data": {
    "title": "Test Article"
  }
}

### Get Job Status
GET http://localhost:8320/api/article-studio/jobs/{{job_id}}
```

### 使用 Postman / Insomnia

导入 OpenAPI 文档：

```
http://localhost:8320/openapi.json
```

## 环境变量配置

### 必需的环境变量

| 变量名 | 默认值 | 说明 |
|--------|--------|------|
| `STUDIO_HOST` | `0.0.0.0` | 服务监听地址 |
| `STUDIO_PORT` | `8320` | 服务监听端口 |
| `STUDIO_MONGODB_URI` | `mongodb://localhost:27017` | MongoDB 连接 URI |
| `STUDIO_MONGODB_DB` | `studio` | MongoDB 数据库名 |

### 可选的环境变量

| 变量名 | 默认值 | 说明 |
|--------|--------|------|
| `STUDIO_WORKER_POLL_SECONDS` | `3` | 任务轮询间隔（秒） |
| `STUDIO_RAGFLOW_WORKER_POLL_SECONDS` | `5` | RAGFlow 任务轮询间隔（秒） |
| `STUDIO_MODEL_CONFIG_PATH` | `./article-models.yaml` | 模型配置文件路径 |

### RAGFlow 配置

如果需要使用 RAGFlow 集成：

```bash
RAGFLOW_API_URL=http://your-ragflow:9380
RAGFLOW_API_KEY=your-api-key
RAGFLOW_KB_ID=your-knowledge-base-id
```

## 常见问题

### Q: 启动时报错 "ModuleNotFoundError: No module named 'studio'"

A: 确保 `PYTHONPATH` 设置正确：

```bash
PYTHONPATH=packages/studio:. uv run python debug_studio.py
```

### Q: MongoDB 连接失败

A: 检查 MongoDB 是否运行：

```bash
# 启动 MongoDB (Docker)
docker run -d -p 27017:27017 --name mongodb mongo:latest

# 或使用本地 MongoDB
mongod --dbpath /path/to/data
```

### Q: 端口被占用

A: 修改端口或停止占用端口的进程：

```bash
# 查看端口占用
lsof -i :8320

# 或使用其他端口
STUDIO_PORT=8321 uv run python debug_studio.py
```

### Q: 热重载不工作

A: 确保 `reload_dirs` 配置正确，或手动重启服务。

## 与前端联调

### 1. 启动后端（PyCharm）

运行 `debug_studio` 配置，服务运行在 `http://localhost:8320`

### 2. 配置前端

在 `frontend/.env.local` 中添加：

```bash
# 指向 Studio 服务
NEXT_PUBLIC_STUDIO_BASE_URL=http://localhost:8320
```

或修改 `frontend/next.config.js` 添加 rewrite：

```javascript
rewrites.push({
  source: "/api/article-studio/:path*",
  destination: "http://localhost:8320/api/article-studio/:path*",
});
```

### 3. 启动前端

```bash
cd frontend
pnpm dev
```

### 4. 访问 Studio

打开浏览器访问：`http://localhost:3000/workspace/studio/templates`

## 日志查看

### 控制台日志

启动后，日志会直接输出到 PyCharm 的 Run/Debug 窗口。

### 文件日志

如果需要将日志写入文件，可以修改 `debug_studio.py`：

```python
import logging
from logging.handlers import RotatingFileHandler

# 添加文件处理器
file_handler = RotatingFileHandler(
    'logs/studio.log',
    maxBytes=10*1024*1024,  # 10MB
    backupCount=5
)
file_handler.setFormatter(logging.Formatter(
    "%(asctime)s - %(name)s - %(levelname)s - %(message)s"
))
logging.getLogger().addHandler(file_handler)
```

## 性能分析

### 使用 PyCharm Profiler

1. 在运行配置中选择 `Profile` 而不是 `Debug`
2. 运行后查看性能分析报告

### 使用 cProfile

```python
import cProfile
import pstats

profiler = cProfile.Profile()
profiler.enable()

# ... your code ...

profiler.disable()
stats = pstats.Stats(profiler)
stats.sort_stats('cumulative')
stats.print_stats(10)
```

## 远程调试

如果需要远程调试（例如调试 Docker 容器中的服务）：

1. 安装 `debugpy`：

```bash
uv pip install debugpy
```

2. 在代码中添加：

```python
import debugpy
debugpy.listen(("0.0.0.0", 5678))
print("Waiting for debugger attach...")
debugpy.wait_for_client()
```

3. 在 PyCharm 中配置 Python Debug Server：

- Host: `localhost`
- Port: `5678`

4. 运行 Debug Server 并连接
