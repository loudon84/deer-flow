# MCP Token 连接配置指南

## 概述

通过 MCP (Model Context Protocol) Server 连接 WechatSync，实现更稳定可靠的多平台文章发布。

## 为什么使用 MCP？

相比浏览器插件方案，MCP 方案具有以下优势：

1. **更稳定**：不依赖浏览器扩展，避免扩展更新导致的兼容问题
2. **更安全**：Token 认证机制，避免暴露敏感信息
3. **更灵活**：可以部署在本地或远程服务器
4. **更可控**：完整的日志和错误处理

## 架构

```
DeerFlow 前端
  ↓ HTTP/SSE (Token 认证)
WechatSync MCP Server
  ↓ 调用平台适配器
目标平台 API
```

## 配置步骤

### 1. 启动 WechatSync MCP Server

首先需要启动 WechatSync MCP Server。可以：

**方式一：使用官方 MCP Server（推荐）**
```bash
# 安装
npm install -g @wechatsync/mcp-server

# 启动
wechatsync-mcp-server --port 3001
```

**方式二：从源码启动**
```bash
git clone https://github.com/wechatsync/Wechatsync.git
cd Wechatsync/packages/mcp-server
npm install
npm run start
```

启动后会显示：
```
WechatSync MCP Server running on http://localhost:3001
Token: xxx-xxx-xxx-xxx
```

### 2. 在 DeerFlow 中配置

1. 打开设置 → 发布账号
2. 在 "MCP Server 配置" 部分：
   - **MCP Server 地址**：输入 `ws://localhost:9527`
   - **MCP Token**：输入启动时显示的 Token
3. 点击 "保存配置"
4. 点击 "测试连接" 验证配置
5. 点击 "启用" 激活 MCP 连接

### 3. 登录平台账号

在浏览器中登录各平台：
- 知乎：https://zhihu.com
- 掘金：https://juejin.cn
- CSDN：https://csdn.net
- 今日头条：https://mp.toutiao.com
- ...

MCP Server 会自动检测已登录的账号。

### 4. 发布文章

1. 在 Markdown 编辑器中点击 "发布" 按钮
2. 选择目标平台账号
3. 点击 "发布"
4. 查看实时发布进度
5. 完成后跳转到草稿页面

## MCP Server API

### 健康检查

```http
GET /health
Authorization: Bearer <token>
```

**响应**：
```json
{
  "status": "ok",
  "version": "1.0.0"
}
```

### 获取已登录账号

```http
GET /api/accounts
Authorization: Bearer <token>
```

**响应**：
```json
[
  {
    "platform": "zhihu",
    "uid": "xxx",
    "name": "用户名",
    "avatar": "https://...",
    "home": "https://zhihu.com/people/xxx"
  }
]
```

### 发布文章

```http
POST /api/publish
Authorization: Bearer <token>
Content-Type: application/json

{
  "platform": "zhihu",
  "post": {
    "title": "文章标题",
    "content": "Markdown 内容",
    "desc": "摘要",
    "thumb": "封面图URL",
    "tags": ["标签1", "标签2"]
  }
}
```

**响应（SSE 流）**：
```
data: {"type":"progress","status":"preparing","message":"准备发布..."}
data: {"type":"progress","status":"uploading","message":"上传图片..."}
data: {"type":"progress","status":"publishing","message":"创建草稿..."}
data: {"type":"result","result":{"success":true,"draftUrl":"https://..."}}
```

## MCP Server 实现

如果需要自己实现 MCP Server，可以参考以下结构：

### 项目结构

```
wechatsync-mcp-server/
├── src/
│   ├── server.ts          # HTTP 服务器
│   ├── auth.ts            # Token 认证
│   ├── routes/
│   │   ├── accounts.ts    # 账号管理
│   │   ├── publish.ts     # 发布功能
│   │   └── upload.ts      # 图片上传
│   └── adapters/          # 平台适配器
├── package.json
└── README.md
```

### 核心代码示例

```typescript
// server.ts
import express from 'express';
import { authenticate } from './auth';
import accountsRouter from './routes/accounts';
import publishRouter from './routes/publish';

const app = express();
app.use(express.json());

// 认证中间件
app.use(authenticate);

// 路由
app.use('/api/accounts', accountsRouter);
app.use('/api/publish', publishRouter);

// 健康检查
app.get('/health', (req, res) => {
  res.json({ status: 'ok', version: '1.0.0' });
});

app.listen(3001, () => {
  console.log('MCP Server running on http://localhost:3001');
});
```

```typescript
// auth.ts
import { Request, Response, NextFunction } from 'express';

const TOKEN = process.env.MCP_TOKEN || generateToken();

export function authenticate(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const auth = req.headers.authorization;

  if (!auth || !auth.startsWith('Bearer ')) {
    return res.status(401).json({ error: '未授权' });
  }

  const token = auth.slice(7);
  if (token !== TOKEN) {
    return res.status(403).json({ error: 'Token 无效' });
  }

  next();
}
```

```typescript
// routes/publish.ts
import { Router } from 'express';
import { getDriver } from '@wechatsync/drivers';

const router = Router();

router.post('/', async (req, res) => {
  const { platform, post } = req.body;

  // 设置 SSE
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const sendProgress = (status: string, message: string) => {
    res.write(`data: ${JSON.stringify({ type: 'progress', status, message })}\n\n`);
  };

  try {
    const driver = getDriver({ type: platform });

    sendProgress('preparing', '准备发布...');

    // 预处理
    const editedPost = await driver.preEditPost(post);

    // 创建草稿
    sendProgress('publishing', '创建草稿...');
    const { post_id } = await driver.addPost(editedPost);

    // 上传图片
    const images = extractImages(editedPost.content);
    for (const img of images) {
      sendProgress('uploading', `上传图片 ${img.src}`);
      await driver.uploadFile(img);
    }

    // 更新文章
    sendProgress('publishing', '更新文章...');
    const result = await driver.editPost(post_id, editedPost);

    sendProgress('success', '发布成功');

    // 发送结果
    res.write(`data: ${JSON.stringify({
      type: 'result',
      result: {
        success: true,
        platform,
        postId: post_id,
        draftUrl: result.draftLink
      }
    })}\n\n`);

    res.end();
  } catch (error) {
    res.write(`data: ${JSON.stringify({
      type: 'result',
      result: {
        success: false,
        platform,
        error: error.message
      }
    })}\n\n`);

    res.end();
  }
});

export default router;
```

## 安全建议

1. **Token 管理**：
   - 使用强随机 Token
   - 定期更换 Token
   - 不要在代码中硬编码 Token

2. **HTTPS**：
   - 生产环境使用 HTTPS
   - 配置 SSL 证书

3. **访问控制**：
   - 限制 IP 访问（如只允许本地）
   - 使用防火墙规则

4. **日志记录**：
   - 记录所有 API 调用
   - 监控异常请求

## 故障排查

### 连接失败

1. 检查 MCP Server 是否启动
2. 检查地址和端口是否正确
3. 检查防火墙设置
4. 检查 Token 是否正确

### 发布失败

1. 检查平台是否已登录
2. 检查文章内容是否符合平台要求
3. 查看 MCP Server 日志
4. 检查网络连接

### 账号未检测到

1. 确认已在浏览器中登录
2. 检查 Cookie 是否有效
3. 尝试重新登录平台
4. 重启 MCP Server

## 相关链接

- [WechatSync 项目](https://github.com/wechatsync/Wechatsync)
- [MCP 协议规范](https://modelcontextprotocol.io/)
- [架构分析文档](../../specs/wiki_wechatsync.md)
