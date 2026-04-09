# WechatSync 浏览器插件集成说明

## 概述

本文档说明如何通过 WechatSync 浏览器插件实现真实的多平台文章发布功能。

## 架构设计

### 通信流程

```
DeerFlow 前端
  ↓ window.postMessage
WechatSync 浏览器插件 (background.js)
  ↓ 调用平台适配器
目标平台 API (知乎/掘金/...)
  ↓ 返回结果
WechatSync 浏览器插件
  ↓ window.postMessage
DeerFlow 前端
```

### 关键组件

1. **wechatsync-bridge.ts**: 浏览器插件通信桥接
   - 消息发送和接收
   - 插件检测
   - 账号获取
   - 发布调用

2. **wechatsync-status.tsx**: 插件状态组件
   - 插件安装检测
   - 已登录账号展示
   - 状态刷新

3. **publish-accounts-settings.tsx**: 账号设置页面
   - 插件状态显示
   - 手动账号管理

4. **publish-dialog.tsx**: 发布对话框
   - 插件检测
   - 真实发布调用
   - 进度展示

## 消息协议

### 1. 插件检测

**请求**:
```javascript
window.postMessage({
  type: 'WECHATSYNC_DETECT',
  id: 'deerflow-xxx',
  source: 'deerflow'
}, '*');
```

**响应**:
```javascript
{
  type: 'WECHATSYNC_DETECT_RESPONSE',
  id: 'deerflow-xxx',
  success: true,
  data: true
}
```

### 2. 获取已登录账号

**请求**:
```javascript
window.postMessage({
  type: 'WECHATSYNC_GET_ACCOUNTS',
  id: 'deerflow-xxx',
  source: 'deerflow'
}, '*');
```

**响应**:
```javascript
{
  type: 'WECHATSYNC_GET_ACCOUNTS_RESPONSE',
  id: 'deerflow-xxx',
  success: true,
  data: [
    {
      platform: 'zhihu',
      uid: 'xxx',
      name: '用户名',
      avatar: 'https://...',
      home: 'https://zhihu.com/people/xxx'
    }
  ]
}
```

### 3. 发布文章

**请求**:
```javascript
window.postMessage({
  type: 'WECHATSYNC_PUBLISH',
  id: 'deerflow-xxx',
  source: 'deerflow',
  data: {
    platform: 'zhihu',
    post: {
      title: '文章标题',
      content: 'Markdown 内容',
      desc: '摘要',
      thumb: '封面图URL',
      tags: ['标签1', '标签2']
    }
  }
}, '*');
```

**进度消息**:
```javascript
{
  type: 'WECHATSYNC_PUBLISH_PROGRESS',
  status: 'uploading', // preparing | uploading | publishing | success | error
  message: '正在上传图片...'
}
```

**响应**:
```javascript
{
  type: 'WECHATSYNC_PUBLISH_RESPONSE',
  id: 'deerflow-xxx',
  success: true,
  data: {
    success: true,
    platform: 'zhihu',
    postId: 'xxx',
    draftUrl: 'https://zhihu.com/draft/xxx',
    editUrl: 'https://zhihu.com/edit/xxx'
  }
}
```

## WechatSync 插件改造

### 需要添加的消息监听

在 `packages/web-extension/src/background.js` 中添加：

```javascript
// 监听来自 DeerFlow 的消息
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.source === 'deerflow') {
    switch (message.type) {
      case 'WECHATSYNC_DETECT':
        sendResponse({ success: true, data: true });
        break;

      case 'WECHATSYNC_GET_ACCOUNTS':
        getLoggedInAccounts().then(accounts => {
          sendResponse({ success: true, data: accounts });
        });
        return true; // 异步响应

      case 'WECHATSYNC_PUBLISH':
        handlePublish(message.data).then(result => {
          sendResponse({ success: true, data: result });
        });
        return true;

      // ... 其他消息处理
    }
  }
});

// content script 转发消息
window.addEventListener('message', (event) => {
  if (event.source === window && event.data?.source === 'deerflow') {
    chrome.runtime.sendMessage(event.data, (response) => {
      window.postMessage({
        type: `${event.data.type}_RESPONSE`,
        id: event.data.id,
        ...response
      }, '*');
    });
  }
});
```

### 获取已登录账号实现

```javascript
async function getLoggedInAccounts() {
  const accounts = [];
  const platforms = ['zhihu', 'juejin', 'csdn', 'toutiao', ...];

  for (const platform of platforms) {
    try {
      const driver = getDriver({ type: platform });
      const meta = await driver.getMetaData();

      if (meta && meta.uid) {
        accounts.push({
          platform,
          uid: meta.uid,
          name: meta.title || meta.displayName,
          avatar: meta.avatar,
          home: meta.home,
          supportTypes: meta.supportTypes
        });
      }
    } catch (error) {
      // 未登录或出错，跳过
    }
  }

  return accounts;
}
```

### 发布处理实现

```javascript
async function handlePublish({ platform, post }) {
  const driver = getDriver({ type: platform });

  // 发送进度
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
    const result = await driver.uploadFile(img);
    // 替换图片 URL
  }

  // 更新文章
  sendProgress('publishing', '更新文章...');
  const result = await driver.editPost(post_id, editedPost);

  sendProgress('success', '发布成功');

  return {
    success: true,
    platform,
    postId: post_id,
    draftUrl: result.draftLink,
    editUrl: result.editLink
  };
}

function sendProgress(status, message) {
  window.postMessage({
    type: 'WECHATSYNC_PUBLISH_PROGRESS',
    status,
    message
  }, '*');
}
```

## 使用流程

### 1. 安装插件

用户需要先安装 WechatSync 浏览器扩展：
- Chrome Web Store 下载安装
- 或从源码构建：`yarn build && yarn load-extension`

### 2. 登录平台

在各平台网站登录账号：
- 知乎：https://zhihu.com
- 掘金：https://juejin.cn
- CSDN：https://csdn.net
- ...

### 3. DeerFlow 中使用

1. 打开设置 → 发布账号
2. 查看插件状态和已登录账号
3. 在 Markdown 编辑器中点击"发布"
4. 选择目标平台
5. 点击发布，查看进度
6. 完成后跳转到草稿页面

## 调试技巧

### 1. 检查插件是否加载

打开 Chrome 扩展管理页面 (`chrome://extensions/`)，确认 WechatSync 已启用。

### 2. 查看消息通信

在浏览器控制台中监听消息：

```javascript
window.addEventListener('message', (event) => {
  if (event.data?.source === 'deerflow' || event.data?.type?.startsWith('WECHATSYNC')) {
    console.log('[Message]', event.data);
  }
});
```

### 3. 查看插件日志

在扩展管理页面点击"背景页"，查看插件的控制台日志。

### 4. 测试单个平台

```javascript
// 在控制台测试
import { publishToPlatform } from '@/lib/wechatsync-bridge';

await publishToPlatform('zhihu', {
  title: '测试文章',
  content: '# 测试内容\n\n这是测试。',
});
```

## 安全考虑

1. **消息来源验证**: 只处理来自 `source: 'deerflow'` 的消息
2. **消息 ID 匹配**: 确保请求和响应的 ID 匹配
3. **超时处理**: 所有消息都有超时限制
4. **错误处理**: 完善的错误捕获和用户提示

## 后续优化

1. **离线检测**: 定期检测插件和账号状态
2. **批量发布**: 支持一次发布到多个平台
3. **发布历史**: 记录发布历史和状态
4. **图片管理**: 图片上传进度和预览
5. **定时发布**: 支持设置定时发布时间
6. **平台配置**: 各平台的特定配置选项

## 相关链接

- [WechatSync 仓库](https://github.com/wechatsync/Wechatsync)
- [架构分析文档](../../specs/wiki_wechatsync.md)
- [Chrome 扩展开发文档](https://developer.chrome.com/docs/extensions/)
