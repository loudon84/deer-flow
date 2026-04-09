# 发布功能使用指南

## 概述

DeerFlow 提供了多种文章发布方式，您可以根据实际情况选择最适合的方案。

## 发布方式对比

| 方式 | 适用场景 | 优点 | 缺点 |
|------|---------|------|------|
| **MCP Server** | 推荐 | 稳定、安全、可控 | 需要启动服务 |
| **浏览器插件** | 已安装插件 | 直接使用 | 依赖插件支持 |
| **手动配置** | 备选方案 | 简单直接 | 需手动管理 |

## 方式一：MCP Server（推荐）

### 1. 启动 MCP Server

```bash
# 安装
npm install -g @wechatsync/mcp-server

# 启动（WebSocket 模式）
wechatsync-mcp-server --ws --port 9527

# 或启动（HTTP 模式）
wechatsync-mcp-server --port 3001
```

启动后会显示 Token，例如：
```
MCP Server running on ws://localhost:9527
Token: abc-123-xyz
```

### 2. 在 DeerFlow 中配置

1. 打开设置 → 发布账号
2. 在 "MCP Server 配置" 中：
   - Server 地址：`ws://localhost:9527`
   - Token：`abc-123-xyz`
3. 点击 "测试连接"
4. 点击 "启用"

### 3. 登录平台

在浏览器中登录各平台：
- 知乎：https://zhihu.com
- 掘金：https://juejin.cn
- CSDN：https://csdn.net
- 今日头条：https://mp.toutiao.com
- 微信公众号：https://mp.weixin.qq.com

### 4. 发布文章

1. 在 Markdown 编辑器中点击 "发布"
2. 选择目标平台
3. 点击 "发布"
4. 查看实时进度
5. 完成后跳转到草稿页面

## 方式二：浏览器插件

### 1. 安装插件

从 Chrome Web Store 安装 WechatSync 扩展。

### 2. 刷新页面

安装后刷新 DeerFlow 页面，插件会注入 `window.$syncer`。

### 3. 检查插件

在浏览器控制台执行：
```javascript
console.log(window.$syncer);
```

如果输出 `undefined`，说明插件未正确注入，请使用 MCP 方式。

### 4. 登录平台

在各平台网站登录账号。

### 5. 发布文章

在编辑器中点击 "发布"，选择平台后发布。

## 方式三：手动配置账号

如果自动检测失败，可以手动添加账号：

### 1. 添加账号

1. 打开设置 → 发布账号
2. 在 "手动添加账号" 部分
3. 点击 "添加账号"
4. 输入账号名称（如 "我的知乎"）
5. 选择平台类型（如 "知乎"）
6. 点击确认

### 2. 使用 MCP 发布

手动添加的账号需要配合 MCP Server 使用：

1. 配置 MCP Server（见方式一）
2. 在编辑器中发布文章
3. 选择手动添加的账号
4. 执行发布

## 常见问题

### Q: MCP 连接失败？

**检查清单**：
- [ ] MCP Server 是否启动
- [ ] 地址是否正确（ws:// 或 http://）
- [ ] Token 是否正确
- [ ] 防火墙是否阻止连接

**解决方案**：
```bash
# 检查端口是否监听
netstat -an | grep 9527

# 检查服务是否运行
ps aux | grep wechatsync
```

### Q: 检测不到浏览器插件？

**原因**：
1. 插件未安装或未启用
2. 页面未刷新
3. 插件版本过旧

**解决方案**：
- 确认插件已安装
- 刷新页面（F5）
- 更新插件到最新版本
- 使用 MCP 方式作为备选

### Q: 获取不到账号？

**原因**：
1. 未在平台登录
2. Cookie 已过期
3. 平台不支持

**解决方案**：
- 在平台网站重新登录
- 清除 Cookie 后重新登录
- 查看插件支持的账号列表
- 使用手动配置

### Q: 发布失败？

**常见错误**：
- "未登录"：在平台网站登录
- "内容不符合要求"：检查文章格式
- "图片上传失败"：检查图片链接
- "网络错误"：检查网络连接

**调试方法**：
1. 打开浏览器控制台
2. 查看错误日志
3. 检查 MCP Server 日志
4. 检查平台账号状态

## 推荐配置

### 开发环境

```yaml
方式: MCP Server
地址: ws://localhost:9527
优点: 稳定可靠，易于调试
```

### 生产环境

```yaml
方式: MCP Server（远程）
地址: wss://mcp.yourdomain.com
优点: 统一管理，安全可控
```

### 快速测试

```yaml
方式: 手动配置 + MCP
优点: 无需自动检测，直接可用
```

## 技术支持

如果遇到问题：

1. **查看文档**：
   - MCP 集成指南：`docs/mcp-publish-guide.md`
   - JSSDK 集成：`docs/jssdk-integration-guide.md`
   - 架构分析：`specs/wiki_wechatsync.md`

2. **检查日志**：
   - 浏览器控制台
   - MCP Server 日志
   - Network 面板

3. **提交 Issue**：
   - GitHub Issues
   - 附上错误日志
   - 描述复现步骤

## 最佳实践

1. **优先使用 MCP**：稳定性和可控性最好
2. **定期检查登录态**：避免发布时才发现未登录
3. **保存发布历史**：方便追踪和管理
4. **测试后再发布**：先在测试账号验证
5. **备份文章内容**：防止发布失败丢失内容

🎯
