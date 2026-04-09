# 文章发布功能集成说明

## 概述

本功能基于 wechatsync 的同步原理，实现了 Markdown 文章的多平台一键发布。

## 架构设计

### 1. 核心组件

- **PublishService** (`frontend/src/lib/publish-service.ts`): 发布服务核心类
  - 管理发布账号
  - 协调多平台发布流程
  - 提供进度回调

- **PublishDialog** (`frontend/src/components/publish/publish-dialog.tsx`): 发布对话框组件
  - 账号选择界面
  - 发布进度展示
  - 结果反馈

- **Publish API** (`frontend/src/app/api/publish/route.ts`): 后端 API
  - 接收发布请求
  - 调用 article-syncjs 进行实际发布
  - 返回发布结果

### 2. 数据流

```
用户点击发布按钮
  ↓
打开 PublishDialog
  ↓
选择目标平台账号
  ↓
调用 PublishService.publishToMultiplePlatforms()
  ↓
对每个账号调用 POST /api/publish
  ↓
后端集成 article-syncjs 执行发布
  ↓
返回发布结果（草稿链接等）
  ↓
前端展示结果
```

## 支持的平台

根据 wechatsync 的适配器，支持以下平台：

- 知乎 (zhihu)
- 今日头条 (toutiao)
- 掘金 (juejin)
- CSDN (csdn)
- 微信公众号 (weixin)
- 哔哩哔哩 (bilibili)
- SegmentFault (segmentfault)
- 简书 (jianshu)
- 微博 (weibo)
- 博客园 (cnblog)
- 豆瓣 (douban)
- 百家号 (baijiahao)
- 搜狐 (sohu)
- 开源中国 (oschina)
- WordPress (wordpress)

## 使用方法

### 1. 在编辑器中发布

在 Markdown 文件编辑页面，点击右上角的"发布"按钮即可打开发布对话框。

### 2. 编程式使用

```typescript
import { PublishService, type PublishAccount, type PublishPost } from '@/lib/publish-service';

// 创建发布服务实例
const service = new PublishService();

// 添加账号
const account: PublishAccount = {
  id: 'zhihu-1',
  type: 'zhihu',
  name: '我的知乎账号',
  config: {
    // 账号配置
  }
};
service.addAccount(account);

// 准备文章内容
const post: PublishPost = {
  title: '文章标题',
  content: '# 正文内容\n\n这是 Markdown 内容',
  desc: '文章摘要',
  tags: ['技术', '前端']
};

// 发布到单个平台
const result = await service.publishToPlatform(post, account, (progress) => {
  console.log(`[${progress.platform}] ${progress.status}: ${progress.message}`);
});

// 批量发布
const results = await service.publishToMultiplePlatforms(
  post,
  ['zhihu-1', 'juejin-1'],
  (progress) => {
    console.log(`[${progress.platform}] ${progress.status}`);
  }
);
```

## 后端集成

### 当前状态

当前实现为模拟发布，返回模拟的草稿链接。要实现真实发布，需要：

### 方案一：集成 article-syncjs（推荐）

```typescript
// frontend/src/app/api/publish/route.ts
import { ArticleSync } from '@wechatsync/article-syncjs';

export async function POST(request: NextRequest) {
  const { post, account } = await request.json();

  // 初始化同步器
  const syncer = new ArticleSync({
    platform: account.type,
    account: account.config
  });

  // 执行发布
  const result = await syncer.publish({
    title: post.title,
    content: post.content,
    // ... 其他字段
  });

  return NextResponse.json(result);
}
```

### 方案二：通过浏览器扩展桥接

1. 用户安装 Wechatsync 浏览器扩展
2. 前端通过 `window.postMessage` 与扩展通信
3. 扩展执行实际发布操作

```typescript
// 前端代码
window.postMessage({
  type: 'WECHATSYNC_PUBLISH',
  data: { post, account }
}, '*');

// 监听结果
window.addEventListener('message', (event) => {
  if (event.data.type === 'WECHATSYNC_RESULT') {
    // 处理发布结果
  }
});
```

### 方案三：使用各平台官方 API

为每个平台实现独立的 API 调用：

```typescript
// 平台适配器
const adapters = {
  zhihu: async (post) => {
    // 调用知乎 API
  },
  juejin: async (post) => {
    // 调用掘金 API
  },
  // ...
};
```

## 账号管理

### 存储账号信息

建议将账号信息存储在：

1. **localStorage**（客户端存储）
2. **数据库**（服务端存储，推荐）
3. **加密存储**（敏感信息安全存储）

### 账号配置示例

```typescript
interface PublishAccount {
  id: string;
  type: PlatformType;
  name: string;
  avatar?: string;
  config: {
    // 通用配置
    cookie?: string;
    token?: string;

    // WordPress 特有配置
    url?: string;
    username?: string;
    password?: string;

    // 其他平台特有配置
    [key: string]: any;
  };
}
```

## 安全考虑

1. **敏感信息加密**: Cookie、Token 等敏感信息必须加密存储
2. **HTTPS 传输**: 所有 API 调用必须使用 HTTPS
3. **权限验证**: 确保用户有权发布到指定平台
4. **频率限制**: 防止滥用发布功能

## 后续优化

1. **图片上传**: 支持文章中的图片自动上传到各平台
2. **格式转换**: 自动处理各平台的格式差异
3. **定时发布**: 支持设置定时发布时间
4. **发布历史**: 记录发布历史和状态
5. **批量管理**: 支持多篇文章批量发布
6. **平台检测**: 自动检测账号登录状态

## 相关链接

- [Wechatsync 项目](https://github.com/wechatsync/Wechatsync)
- [article-syncjs 库](https://github.com/wechatsync/article-syncjs)
- [架构分析文档](../../specs/wiki_wechatsync.md)
