# Studio Chat 模块编码任务

## 阶段一：基础类型与 Hooks 层

### Task 1: 创建 Chat 专用类型定义

**文件**: `frontend/src/components/workspace/studio/chat/types.ts`

**内容**:
- 定义 `ChatMessage` 接口：id, type(human/ai/system), content, timestamp, toolCalls?, reasoningContent?, isStreaming?
- 定义 `ChatToolCall` 接口：name, args?, result?
- 定义 `ChatPanelState` 接口：requestContext, showTimeline, showFollowups
- 从 `@/core/studio/types/runtime` 导入并复用 RuntimeEvent, RuntimeSessionStatus, RuntimeRequestContext, ApplyMode 等类型

**依赖**: 无

---

### Task 2: 创建 use-chat-session Hook

**文件**: `frontend/src/components/workspace/studio/chat/hooks/use-chat-session.ts`

**内容**:
- 导入并委托 `useRuntimeSession`（来自 `@/core/studio/hooks/use-runtime-session`）
- 导入 `startRuntimeRun`（来自 `@/core/studio/api/runtime-sessions`）
- 实现 `useChatSession(params: { ownerType, ownerId, autoCreate? })` hook
- 返回 `{ session, sessionId, isLoading, error, ensureSessionAndRun }`
- `ensureSessionAndRun(message, context)` 便捷方法：
  1. 若 sessionId 不存在，先调用 `ensureSession()` 等待 Session 创建
  2. 调用 `startRuntimeRun(sessionId, { message, requestContext: context })`
  3. 触发 queryClient invalidateQueries 刷新 Session 状态

**依赖**: Task 1

---

### Task 3: 创建 use-chat-events Hook

**文件**: `frontend/src/components/workspace/studio/chat/hooks/use-chat-events.ts`

**内容**:
- 导入并委托 `useRuntimeEvents`（来自 `@/core/studio/hooks/use-runtime-events`）
- 实现 `useChatEvents(sessionId)` hook
- 实现 `eventsToMessages(events: RuntimeEvent[]): ChatMessage[]` 转换函数：
  - 遍历 events，按 eventType 分类处理：
    - `message_delta` (source=human) → 创建/追加 human ChatMessage
    - `message_delta` (source=ai) → 创建/追加 ai ChatMessage（isStreaming=true）
    - `message_final` → 标记对应消息 isStreaming=false
    - `tool_call` → 追加 ChatToolCall 到当前 ai 消息
    - `tool_result` → 更新对应 ChatToolCall.result
    - `error` → 创建 system ChatMessage
    - `interrupt` → 跳过（由 HITL 面板处理）
  - 使用 useMemo 缓存转换结果，仅在 events 引用变化时重新计算
- 返回 `{ events, messages, isLive, reconnect }`

**依赖**: Task 1

---

### Task 4: 创建 use-chat-message-send Hook

**文件**: `frontend/src/components/workspace/studio/chat/hooks/use-chat-message-send.ts`

**内容**:
- 实现 `useChatMessageSend(params: { sessionId, ensureSessionAndRun })` hook
- 管理 `optimisticMessages: ChatMessage[]` 状态
- 管理 `isSending` 状态（防止重复提交）
- 实现 `sendMessage(message: string)` 方法：
  1. 设置 isSending = true
  2. 创建 optimistic human ChatMessage，追加到 optimisticMessages
  3. 调用 `ensureSessionAndRun(message, currentContext)`
  4. 成功后清空 optimisticMessages
  5. 失败后保留 optimistic 消息但标记错误状态
  6. finally 设置 isSending = false
- 实现 `stop()` 方法（标记本地停止，取消进行中的请求）
- 返回 `{ optimisticMessages, isSending, sendMessage, stop }`

**依赖**: Task 2

---

### Task 5: 创建 Hooks 导出文件

**文件**: `frontend/src/components/workspace/studio/chat/hooks/index.ts`

**内容**:
- 导出 `useChatSession` from `./use-chat-session`
- 导出 `useChatEvents` from `./use-chat-events`
- 导出 `useChatMessageSend` from `./use-chat-message-send`

**依赖**: Task 2, Task 3, Task 4

---

## 阶段二：UI 组件层

### Task 6: 创建 ChatStatusCard 组件

**文件**: `frontend/src/components/workspace/studio/chat/ChatStatusCard.tsx`

**内容**:
- 直接复用 `RuntimeStatusCard`（来自 `@/components/workspace/studio/runtime`）
- 创建薄包装组件，接收 `session` 和 `isLive` props，透传给 RuntimeStatusCard
- 添加 className 支持以便自定义样式

**依赖**: Task 1

---

### Task 7: 创建 ChatMessageList 组件

**文件**: `frontend/src/components/workspace/studio/chat/ChatMessageList.tsx`

**内容**:
- 接收 props: `{ messages: ChatMessage[], optimisticMessages: ChatMessage[], sessionStatus: RuntimeSessionStatus, className? }`
- 合并 messages 和 optimisticMessages 为最终展示列表
- 遍历消息列表，按 type 渲染：
  - `human` 消息：右对齐，显示用户头像和消息内容
  - `ai` 消息：左对齐，显示 AI 头像和消息内容（支持 markdown 渲染）
  - `system` 消息：居中，灰色文字显示系统/错误信息
- AI 消息的 toolCalls 渲染为工具调用卡片（名称 + 参数摘要 + 结果）
- isStreaming 的 AI 消息底部显示流式指示器动画
- sessionStatus 为 streaming 时底部显示全局 StreamingIndicator
- 使用 ScrollArea 包裹，自动滚动到底部

**依赖**: Task 1

---

### Task 8: 创建 ChatInputBox 组件

**文件**: `frontend/src/components/workspace/studio/chat/ChatInputBox.tsx`

**内容**:
- 接收 props: `{ sessionId, sessionStatus, requestContext, onContextChange, onSubmit, onStop, disabled? }`
- UI 结构参考现有 `InputBox`（`@/components/workspace/input-box`）：
  - 顶部：模式选择按钮组（flash/thinking/pro/ultra）
  - 中部：Textarea 输入区域
  - 底部：模型选择下拉框 + 推理强度选择 + 发送/停止按钮
- 模式选择变更时更新 requestContext.mode 并调用 onContextChange
- 模型选择变更时更新 requestContext.modelName 并调用 onContextChange
- 推理强度变更时更新 requestContext.reasoningEffort 并调用 onContextChange
- 发送按钮：调用 onSubmit(inputText)，清空输入框
- 停止按钮：sessionStatus 为 streaming 时显示，调用 onStop
- streaming 状态下禁用发送按钮和输入框
- 支持 Enter 发送（Shift+Enter 换行）
- 使用 PromptInput 组件（来自 `@/components/ai-elements/prompt-input`）

**依赖**: Task 1

---

### Task 9: 创建 ChatHITLPanel 组件

**文件**: `frontend/src/components/workspace/studio/chat/ChatHITLPanel.tsx`

**内容**:
- 直接复用 `RuntimeInterruptPanel`（来自 `@/components/workspace/studio/runtime`）
- 创建薄包装组件，接收 `session` prop，透传给 RuntimeInterruptPanel
- 仅当 session.status === "waiting_human" 时渲染

**依赖**: Task 1

---

### Task 10: 创建 ChatResultPanel 组件

**文件**: `frontend/src/components/workspace/studio/chat/ChatResultPanel.tsx`

**内容**:
- 直接复用 `RuntimeResultPanel`（来自 `@/components/workspace/studio/runtime`）
- 创建薄包装组件，接收 `{ sessionId, documentId?, mode, isDocumentDirty?, onApplyRequest? }` props
- 透传给 RuntimeResultPanel

**依赖**: Task 1

---

### Task 11: 创建 ChatEventTimeline 组件

**文件**: `frontend/src/components/workspace/studio/chat/ChatEventTimeline.tsx`

**内容**:
- 复用 `RuntimeTimeline`（来自 `@/components/workspace/studio/runtime`）
- 包装为可折叠面板（使用 Collapsible 组件）
- 接收 props: `{ events, isLive, onReconnect }`
- 面板标题显示"事件时间线" + 事件数量 badge + 实时/轮询状态指示
- 默认折叠，点击展开显示 RuntimeTimeline
- 右上角刷新按钮调用 onReconnect

**依赖**: Task 1

---

## 阶段三：主面板编排与导出

### Task 12: 创建 StudioChatPanel 主面板组件

**文件**: `frontend/src/components/workspace/studio/chat/StudioChatPanel.tsx`

**内容**:
- 接收 props: `StudioChatPanelProps { ownerType, ownerId, autoCreate?, documentId?, isDocumentDirty?, onApplyRequest? }`
- 使用 `useChatSession` 管理 Session 生命周期
- 使用 `useChatEvents` 订阅事件流和提取消息
- 使用 `useChatMessageSend` 管理消息发送
- 管理 `requestContext` 状态（初始值从 localStorage 读取，变更时持久化）
- 布局结构：
  ```
  <div className="flex flex-col h-full">
    <ChatStatusCard />                    {/* 顶部状态栏 */}
    <ChatMessageList />                   {/* 消息列表（flex-1 占满剩余空间） */}
    <ChatHITLPanel />                     {/* HITL 面板（条件渲染） */}
    <ChatResultPanel />                   {/* 结果面板（条件渲染） */}
    <ChatEventTimeline />                 {/* 事件时间线（可折叠） */}
    <ChatInputBox />                      {/* 底部输入框 */}
  </div>
  ```
- ChatHITLPanel 仅在 session.status === "waiting_human" 时渲染
- ChatResultPanel 仅在 session.status === "completed" 时渲染
- ChatInputBox 的 onSubmit 调用 useChatMessageSend.sendMessage
- ChatInputBox 的 onStop 调用 useChatMessageSend.stop
- 加载状态显示骨架屏
- 错误状态显示错误信息

**依赖**: Task 5, Task 6, Task 7, Task 8, Task 9, Task 10, Task 11

---

### Task 13: 创建模块导出文件

**文件**: `frontend/src/components/workspace/studio/chat/index.ts`

**内容**:
- 导出 `StudioChatPanel` from `./StudioChatPanel`
- 导出 `ChatMessageList` from `./ChatMessageList`
- 导出 `ChatInputBox` from `./ChatInputBox`
- 导出 `ChatHITLPanel` from `./ChatHITLPanel`
- 导出 `ChatResultPanel` from `./ChatResultPanel`
- 导出 `ChatEventTimeline` from `./ChatEventTimeline`
- 导出 `ChatStatusCard` from `./ChatStatusCard`
- 导出类型 `ChatMessage`, `ChatToolCall`, `ChatPanelState` from `./types`
- 导出 hooks `useChatSession`, `useChatEvents`, `useChatMessageSend` from `./hooks`

**依赖**: Task 12

---

## 阶段四：集成与验证

### Task 14: 更新 Studio 模块导出

**文件**: `frontend/src/components/workspace/studio/index.ts`

**内容**:
- 在现有导出中新增 chat 子模块的导出
- 导出 `StudioChatPanel` 及相关组件和 hooks

**依赖**: Task 13

---

### Task 15: 验证 TypeScript 编译

**内容**:
- 运行 `npx tsc --noEmit` 检查所有新增文件的类型正确性
- 修复任何类型错误
- 确保与现有 Studio 和 Chats 模块的类型兼容

**依赖**: Task 14
