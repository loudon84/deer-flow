# Article Studio

文章生成与管理系统，基于 FastAPI + MongoDB + RAGFlow 构建。

## 功能特性

- **模板管理**：创建和管理文章生成模板，支持版本控制
- **文章生成**：基于模板和输入参数自动生成文章
- **审批流程**：文档审批工作流，支持通过/驳回
- **知识入库**：审批通过后自动入库到 RAGFlow

## 技术栈

- **Web 框架**：FastAPI
- **数据验证**：Pydantic v2
- **MongoDB 驱动**：Motor (async)
- **HTTP 客户端**：httpx
- **模板引擎**：Jinja2
- **应用服务器**：uvicorn

## 目录结构

```
article_studio/
├── api/                    # API 路由层
│   ├── app.py             # FastAPI 应用实例
│   ├── deps.py            # 依赖注入
│   ├── router_templates.py # 模板管理路由
│   ├── router_jobs.py     # 任务管理路由
│   ├── router_documents.py # 文档管理路由
│   └── router_health.py   # 健康检查路由
├── db/                    # 数据层
│   ├── mongo.py           # MongoDB 连接管理
│   ├── collections.py     # 集合名常量
│   └── indexes.py         # 索引定义
├── integrations/          # 集成层
│   ├── model_factory_adapter.py # Model Factory 适配器
│   └── ragflow_client.py  # RAGFlow 客户端
├── models/                # 数据模型
│   ├── dto/               # 数据传输对象
│   └── persistence/       # 持久化文档模型
├── repositories/          # Repository 层
├── services/              # Service 层
│   └── strategy/          # 生成策略
├── settings/              # 配置管理
├── workers/               # Worker 层
└── scripts/               # 脚本
```

## 环境配置

创建 `.env` 文件或设置环境变量：

```bash
# 服务配置
ARTICLE_STUDIO_HOST=0.0.0.0
ARTICLE_STUDIO_PORT=8320

# MongoDB 配置
ARTICLE_STUDIO_MONGODB_URI=mongodb://localhost:27017
ARTICLE_STUDIO_MONGODB_DB=article_studio

# RAGFlow 配置
ARTICLE_STUDIO_RAGFLOW_BASE_URL=http://127.0.0.1:9380
ARTICLE_STUDIO_RAGFLOW_API_KEY=your_api_key

# 模型配置
ARTICLE_STUDIO_MODEL_CONFIG_PATH=./article-models.yaml

# Worker 配置
ARTICLE_WORKER_POLL_SECONDS=3
ARTICLE_RAGFLOW_WORKER_POLL_SECONDS=5
```

## 安装依赖

```bash
pip install fastapi uvicorn motor pydantic httpx jinja2 pyyaml jsonschema
```

## 初始化数据库索引

```bash
python -m article_studio.scripts.init_mongo_indexes
```

## 启动服务

### 启动 API 服务

```bash
python -m article_studio.main
```

或使用 uvicorn：

```bash
uvicorn article_studio.api.app:app --host 0.0.0.0 --port 8320
```

### 启动 Generation Worker

```bash
python -m article_studio.workers.run_generation_worker
```

### 启动 RAGFlow Worker

```bash
python -m article_studio.workers.run_ragflow_worker
```

## API 文档

启动服务后访问：

- Swagger UI: http://localhost:8320/docs
- ReDoc: http://localhost:8320/redoc

## 主要接口

### 模板管理

- `POST /api/v1/templates` - 创建模板
- `GET /api/v1/templates/{id}` - 获取模板详情
- `GET /api/v1/templates` - 列表查询模板
- `PUT /api/v1/templates/{id}` - 更新模板
- `DELETE /api/v1/templates/{id}` - 删除模板
- `POST /api/v1/templates/{id}/versions` - 创建模板版本
- `GET /api/v1/templates/{id}/versions` - 获取模板版本列表

### 任务管理

- `POST /api/v1/jobs` - 创建生成任务
- `GET /api/v1/jobs/{id}` - 获取任务详情
- `GET /api/v1/jobs` - 列表查询任务
- `POST /api/v1/jobs/{id}/cancel` - 取消任务
- `POST /api/v1/jobs/{id}/retry` - 重试任务

### 文档管理

- `GET /api/v1/documents/{id}` - 获取文档详情
- `GET /api/v1/documents` - 列表查询文档
- `PUT /api/v1/documents/{id}` - 更新文档内容
- `POST /api/v1/documents/{id}/submit-approval` - 提交审批
- `POST /api/v1/documents/{id}/approve` - 审批通过
- `POST /api/v1/documents/{id}/reject` - 审批驳回

### 健康检查

- `GET /health` - 健康检查

## 生成策略

系统支持两种生成策略：

1. **single_pass**：单次生成，直接调用模型生成完整文章
2. **outline_then_write**：大纲后写作，先生成大纲再逐段生成内容

可以在创建任务时通过 `generation_mode` 参数指定。

## 架构设计

系统采用分层架构：

1. **API Layer**：处理 HTTP 请求，参数校验，响应序列化
2. **Service Layer**：业务逻辑编排，事务管理，领域规则校验
3. **Repository Layer**：数据访问抽象，ObjectId 转换，查询封装
4. **Worker Layer**：异步任务处理，模型调用，外部系统集成

## 约束和原则

- MongoDB 为主存储
- sandbox/虚拟文件夹仅为临时工作区
- 审批通过后写入 RAGFlow
- Article Studio 模型配置独立，不读取 DeerFlow 原 config.yaml
- 环境变量前缀统一为 `ARTICLE_*`
- `article_studio.*` 不得 import `deerflow.agents.*`
- `article_studio.*` 不得调用 DeerFlow 原 `create_chat_model()`

## 许可证

MIT
