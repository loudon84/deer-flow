# WechatSync JSSDK 集成说明

## 概述

WechatSync 浏览器插件会在网页中注入全局变量 `window.$syncer`，提供 JSSDK 用于直接调用插件功能。

## JSSDK API

### 全局变量

WechatSync 插件安装后，会在页面中注入以下全局变量：

```typescript
interface Window {
  // 主要 API
  $syncer?: {
    // 获取所有已登录账号
    getAccounts?: () => Promise<WechatSyncAccount[]>;
    
    // 发布文章到指定平台
    publish?: (platform: string, post: WechatSyncPost) => Promise<PublishResult>;
    
    // 检测指定平台的登录态
    checkLogin?: (platform: string) => Promise<boolean>;
    
    // 版本信息
    version?: string;
  };
  
  // 备用 API（旧版本）
  $poster?: {
    post?: (platform: string, content: any) => Promise<any>;
  };
}
```

### 数据类型

```typescript
// 账号信息
interface WechatSyncAccount {
  platform: PlatformType;  // 平台类型
  uid: string;             // 用户 ID
  name: string;            // 用户名
  avatar?: string;         // 头像 URL
  home?: string;           // 主页 URL
  supportTypes?: string[]; // 支持的文章类型
}

// 文章内容
interface WechatSyncPost {
  title: string;      // 标题
  content: string;    // Markdown 内容
  desc?: string;      // 摘要
  thumb?: string;     // 封面图 URL
  tags?: string[];    // 标签
}

// 发布结果
interface PublishResult {
  postId?: string;     // 文章 ID
  post_id?: string;    // 文章 ID（备用）
  draftUrl?: string;   // 草稿链接
  draft_link?: string; // 草稿链接（备用）
  editUrl?: string;    // 编辑链接
  edit_link?: string;  // 编辑链接（备用）
}
```

## 使用方式

### 1. 检测插件

```typescript
// 检查 JSSDK 是否存在
if (window.$syncer) {
  console.log('WechatSync 已安装', window.$syncer.version);
}
```

### 2. 获取已登录账号

```typescript
// 获取所有已登录账号
const accounts = await window.$syncer.getAccounts();

console.log('已登录账号:', accounts);
// [
//   { platform: 'zhihu', uid: 'xxx', name: '用户名', ... },
//   { platform: 'juejin', uid: 'yyy', name: '用户名', ... }
// ]
```

### 3. 发布文章

```typescript
// 发布文章到知乎
const result = await window.$syncer.publish('zhihu', {
  title: '文章标题',
  content: '# 正文\n\n这是 Markdown 内容',
  desc: '文章摘要',
  tags: ['技术', '前端']
});

console.log('发布成功:', result.draftUrl);
```

### 4. 监听发布进度

```typescript
// 监听进度事件
window.addEventListener('wechatsync:progress', (event) => {
  const { status, message } = event.detail;
  console.log(`[${status}] ${message}`);
});

// 发布文章
await window.$syncer.publish('zhihu', post);
```

## DeerFlow 中的实现

### 插件检测

```typescript
export async function detectWechatSyncPlugin(): Promise<boolean> {
  // 方式1: 检查 JSSDK（推荐）
  if (window.$syncer) {
    return true;
  }
  
  // 方式2: 检查 $poster API
  if (window.$poster) {
    return true;
  }
  
  // 方式3: 其他检测方式...
  return false;
}
```

### 获取账号

```typescript
export async function getLoggedInAccounts(): Promise<WechatSyncAccount[]> {
  // 优先使用 JSSDK
  if (window.$syncer?.getAccounts) {
    return await window.$syncer.getAccounts();
  }
  
  // 降级到消息通信
  // ...
}
```

### 发布文章

```typescript
export async function publishToPlatform(
  platform: PlatformType,
  post: WechatSyncPost
): Promise<WechatSyncPublishResult> {
  // 优先使用 JSSDK
  if (window.$syncer?.publish) {
    const result = await window.$syncer.publish(platform, post);
    return {
      success: true,
      platform,
      postId: result.postId,
      draftUrl: result.draftUrl
    };
  }
  
  // 降级到其他方式...
}
```

## 检测优先级

DeerFlow 按以下优先级检测和使用插件：

1. **JSSDK (`window.$syncer`)** - 推荐，直接调用，性能最好
2. **$poster API (`window.$poster`)** - 旧版本兼容
3. **Chrome Extension ID** - 需要用户配置扩展 ID
4. **消息通信** - 需要插件支持消息监听

## 调试技巧

### 1. 检查 JSSDK 是否加载

在浏览器控制台执行：

```javascript
console.log('$syncer:', window.$syncer);
console.log('$poster:', window.$poster);
console.log('version:', window.$syncer?.version);
```

### 2. 测试获取账号

```javascript
const accounts = await window.$syncer.getAccounts();
console.log('账号列表:', accounts);
```

### 3. 测试发布

```javascript
const result = await window.$syncer.publish('zhihu', {
  title: '测试文章',
  content: '# 测试\n\n这是测试内容。'
});
console.log('发布结果:', result);
```

### 4. 监听所有事件

```javascript
// 监听进度
window.addEventListener('wechatsync:progress', (e) => {
  console.log('进度:', e.detail);
});

// 监听所有消息
window.addEventListener('message', (e) => {
  if (e.data?.type?.startsWith('WECHATSYNC')) {
    console.log('消息:', e.data);
  }
});
```

## 常见问题

### Q: 为什么检测不到插件？

A: 可能的原因：
1. 插件未安装或未启用
2. 页面未刷新（插件注入需要刷新页面）
3. 插件版本过旧，不支持 JSSDK

**解决方案**：
- 确认插件已安装并启用
- 刷新页面
- 更新插件到最新版本
- 使用 MCP 方式作为备选

### Q: 获取不到账号？

A: 可能的原因：
1. 未在平台网站登录
2. Cookie 已过期
3. 平台不支持

**解决方案**：
- 在平台网站重新登录
- 检查浏览器 Cookie 设置
- 查看插件支持的账号列表

### Q: 发布失败？

A: 可能的原因：
1. 文章内容不符合平台要求
2. 图片上传失败
3. 网络问题

**解决方案**：
- 检查文章格式和内容
- 确认图片可以正常访问
- 查看浏览器控制台错误信息
- 查看插件后台日志

## WechatSync 插件开发

如果需要修改 WechatSync 插件以支持 JSSDK，可以参考以下实现：

### 注入 JSSDK

在 `content.js` 中：

```javascript
// 注入 JSSDK 到页面
function injectJSSDK() {
  const script = document.createElement('script');
  script.textContent = `
    window.$syncer = {
      version: '1.0.0',
      
      async getAccounts() {
        return new Promise((resolve) => {
          window.postMessage({ type: 'GET_ACCOUNTS' }, '*');
          window.addEventListener('message', function handler(e) {
            if (e.data.type === 'ACCOUNTS_RESPONSE') {
              window.removeEventListener('message', handler);
              resolve(e.data.accounts);
            }
          });
        });
      },
      
      async publish(platform, post) {
        return new Promise((resolve) => {
          window.postMessage({ type: 'PUBLISH', platform, post }, '*');
          window.addEventListener('message', function handler(e) {
            if (e.data.type === 'PUBLISH_RESPONSE') {
              window.removeEventListener('message', handler);
              resolve(e.data.result);
            }
          });
        });
      }
    };
  `;
  (document.head || document.documentElement).appendChild(script);
}

injectJSSDK();
```

### 处理消息

在 `background.js` 中：

```javascript
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'GET_ACCOUNTS') {
    getLoggedInAccounts().then(accounts => {
      sendResponse({ accounts });
    });
    return true;
  }
  
  if (message.type === 'PUBLISH') {
    publishToPlatform(message.platform, message.post).then(result => {
      sendResponse({ result });
    });
    return true;
  }
});
```

## 相关链接

- [WechatSync 项目](https://github.com/wechatsync/Wechatsync)
- [架构分析文档](../../specs/wiki_wechatsync.md)
- [MCP 集成指南](./mcp-publish-guide.md)
