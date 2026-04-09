# 《DeerFlow Frontend 新模块 Studio 对接 Article Studio 接口实现方案》

## 1. 目标

在 **不破坏 DeerFlow 现有前端分层** 的前提下，基于 `frontend/src` 新增一个 **Studio 模块**，用于完成：

* 模板列表
* 模板详情/版本管理
* 新建生文任务
* 任务状态查看
* 文档编辑
* 提交审批
* 审批通过/拒绝
* RAGFlow 入库状态查看与重试

DeerFlow 当前前端结构已经明确分为 `app / components / core / hooks / lib` 等目录，且 `workspace` 已经是主要业务工作区入口；`workspace` 布局中已经注入了 `QueryClientProvider`、Sidebar、CommandPalette 和 Toaster，因此 Studio 应作为 **`/workspace` 下的新业务子模块** 接入，而不是新起一套顶级应用。([GitHub][1])

---

# 2. 结论

## 推荐落地方式

采用：

* **路由层**：`src/app/workspace/studio/*`
* **组件层**：`src/components/workspace/studio/*`
* **业务层**：`src/core/studio/*`
* **接口层**：`src/core/studio/api/*`
* **状态/查询层**：React Query
* **接口目标**：`article_studio` FastAPI

## 不采用

* 不把 Studio 逻辑塞进现有聊天线程模块
* 不复用 LangGraph `getAPIClient()` 做 Article Studio REST
* 不把模板生文页面做成 Artifact 面板的子功能

因为 DeerFlow 现有 `getAPIClient()` 明确是 LangGraph SDK 客户端，服务的是线程/流式对话链路；Article Studio 是独立 REST 业务域，应单独建 REST client。([GitHub][2])

---

# 3. 与 DeerFlow 现有前端结构的贴合点

## 3.1 现有前端结构

DeerFlow 当前前端目录中已经存在：

* `src/app`
* `src/components`
* `src/core`
* `src/hooks`
* `src/lib` ([GitHub][1])

其中：

* `src/app/workspace` 是工作区入口
* `src/components/workspace/*` 承载工作区 UI
* `src/core/*` 按业务域拆分 API、threads、artifacts、settings 等
* `workspace` 布局已经提供 QueryClient 和 Sidebar 容器 ([GitHub][3])

## 3.2 现有导航结构

当前 `WorkspaceNavChatList` 只暴露了 `Chats` 和 `Agents` 两项，因此新增 Studio，最小侵入做法是给该导航增加第三项 `Studio`。([GitHub][4])

## 3.3 现有环境变量能力

前端已经支持：

* `NEXT_PUBLIC_BACKEND_BASE_URL`
* `NEXT_PUBLIC_LANGGRAPH_BASE_URL`

并且 `getBackendBaseURL()` 已经存在，因此 Article Studio REST 应该直接挂在 DeerFlow Backend Base URL 之下，例如：

* `/api/article-studio/templates`
* `/api/article-studio/jobs`
* `/api/article-studio/documents` ([GitHub][5])

---

# 4. 页面信息架构

```mermaid
graph TD
    A[/workspace/studio] --> B[模板列表页]
    A --> C[新建文章页]
    A --> D[任务列表页]
    A --> E[文档列表页]

    B --> B1[模板详情页]
    B1 --> B2[模板版本页]

    D --> D1[任务详情页]
    D1 --> E1[对应文档页]

    E --> E1[文档详情/编辑页]
    E1 --> E2[提交审批]
    E1 --> E3[审批通过/拒绝]
    E1 --> E4[RAGFlow 状态查看]
```

---

# 5. 路由设计

## 5.1 新增路由目录

```text
frontend/src/app/workspace/studio/
├── page.tsx                         # studio 首页，重定向到 templates
├── layout.tsx                       # studio 局部布局
├── templates/
│   ├── page.tsx
│   ├── [templateId]/page.tsx
│   └── [templateId]/versions/page.tsx
├── jobs/
│   ├── page.tsx
│   └── [jobId]/page.tsx
├── documents/
│   ├── page.tsx
│   └── [documentId]/page.tsx
└── create/
    └── page.tsx
```

## 5.2 路由含义

| 路由                                                  | 作用         |
| --------------------------------------------------- | ---------- |
| `/workspace/studio`                                 | 默认跳转到模板列表  |
| `/workspace/studio/templates`                       | 模板列表       |
| `/workspace/studio/templates/[templateId]`          | 模板详情       |
| `/workspace/studio/templates/[templateId]/versions` | 模板版本管理     |
| `/workspace/studio/create`                          | 按模板创建文章任务  |
| `/workspace/studio/jobs`                            | 生文任务列表     |
| `/workspace/studio/jobs/[jobId]`                    | 任务详情       |
| `/workspace/studio/documents`                       | 文档列表       |
| `/workspace/studio/documents/[documentId]`          | 文档详情/编辑/审批 |

---

# 6. 目录与文件级实现骨架

## 6.1 建议目录结构

```text
frontend/src/
├── app/
│   └── workspace/
│       └── studio/
│           ├── layout.tsx
│           ├── page.tsx
│           ├── templates/
│           │   ├── page.tsx
│           │   ├── [templateId]/page.tsx
│           │   └── [templateId]/versions/page.tsx
│           ├── create/page.tsx
│           ├── jobs/
│           │   ├── page.tsx
│           │   └── [jobId]/page.tsx
│           └── documents/
│               ├── page.tsx
│               └── [documentId]/page.tsx
├── components/
│   └── workspace/
│       └── studio/
│           ├── studio-nav.tsx
│           ├── studio-header.tsx
│           ├── template-list.tsx
│           ├── template-detail.tsx
│           ├── template-version-list.tsx
│           ├── article-create-form.tsx
│           ├── dynamic-schema-form.tsx
│           ├── job-list.tsx
│           ├── job-detail.tsx
│           ├── document-list.tsx
│           ├── document-editor.tsx
│           ├── approval-panel.tsx
│           ├── ragflow-status-card.tsx
│           ├── model-selector.tsx
│           ├── generation-mode-selector.tsx
│           └── prompt-override-editor.tsx
└── core/
    └── studio/
        ├── api/
        │   ├── client.ts
        │   ├── templates.ts
        │   ├── jobs.ts
        │   └── documents.ts
        ├── hooks/
        │   ├── use-templates.ts
        │   ├── use-template-detail.ts
        │   ├── use-create-job.ts
        │   ├── use-jobs.ts
        │   ├── use-job-detail.ts
        │   ├── use-document.ts
        │   ├── use-update-document.ts
        │   ├── use-submit-approval.ts
        │   ├── use-approve-document.ts
        │   ├── use-reject-document.ts
        │   └── use-ragflow-retry.ts
        ├── types.ts
        ├── constants.ts
        ├── utils.ts
        └── schema-form.ts
```

---

# 7. 前端分层规范

## 7.1 `app/*`

只做：

* 路由
* 参数提取
* 页面级拼装

不做：

* REST 调用
* 表单业务逻辑
* 状态机判断

## 7.2 `components/workspace/studio/*`

只做：

* 展示组件
* 表单组件
* 局部交互

## 7.3 `core/studio/*`

只做：

* API client
* React Query hooks
* DTO types
* 请求/响应转换
* 页面共用业务判断

这个拆法与 DeerFlow 现有前端“`components/workspace/*` + `core/*`”组织方式一致。现有 RecentChatList 也是组件层调用 core hooks，不直接写网络逻辑。([GitHub][6])

---

# 8. Studio API Client 设计

## 8.1 不复用 LangGraph Client

现有 `getAPIClient()` 是 LangGraph SDK 客户端，只适合 `threads/runs`。Article Studio 应新增 REST client。([GitHub][2])

## 8.2 新增文件

### `src/core/studio/api/client.ts`

```ts
import { getBackendBaseURL } from "@/core/config";

async function request<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const base = getBackendBaseURL() || "";
  const res = await fetch(`${base}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `HTTP ${res.status}`);
  }

  return res.json() as Promise<T>;
}

export const articleStudioClient = {
  get: <T>(path: string) => request<T>(path, { method: "GET" }),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, {
      method: "POST",
      body: body === undefined ? undefined : JSON.stringify(body),
    }),
  put: <T>(path: string, body?: unknown) =>
    request<T>(path, {
      method: "PUT",
      body: body === undefined ? undefined : JSON.stringify(body),
    }),
};
```

---

# 9. types.ts 规范

### `src/core/studio/types.ts`

```ts
export interface TemplateSummary {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  category: string;
  status: string;
  current_version: number;
  default_model_name: string;
  default_generation_mode: string;
  tags: string[];
}

export interface TemplateVersion {
  id: string;
  version: number;
  schema: Record<string, unknown>;
  system_prompt?: string | null;
  user_prompt_template: string;
  default_model_name: string;
  default_generation_mode: string;
  example_input?: Record<string, unknown> | null;
  example_output?: string | null;
}

export interface JobSummary {
  id: string;
  status: string;
  document_id?: string | null;
  last_error?: string | null;
}

export interface DocumentDetail {
  id: string;
  title: string;
  content_markdown: string;
  summary?: string | null;
  keywords: string[];
  approval_status: "draft" | "pending_approval" | "approved" | "rejected";
  ragflow_status:
    | "not_indexed"
    | "queued"
    | "indexing"
    | "indexed"
    | "failed"
    | "stale";
  version: number;
}
```

---

# 10. API 文件拆分

## 10.1 templates.ts

```ts
import { articleStudioClient } from "./client";
import type { TemplateSummary, TemplateVersion } from "../types";

export function listTemplates() {
  return articleStudioClient.get<TemplateSummary[]>(
    "/api/article-studio/templates",
  );
}

export function getTemplate(templateId: string) {
  return articleStudioClient.get<TemplateSummary>(
    `/api/article-studio/templates/${templateId}`,
  );
}

export function createTemplateVersion(
  templateId: string,
  payload: Record<string, unknown>,
) {
  return articleStudioClient.post<{ id: string; version: number }>(
    `/api/article-studio/templates/${templateId}/versions`,
    payload,
  );
}
```

## 10.2 jobs.ts

```ts
import { articleStudioClient } from "./client";
import type { JobSummary } from "../types";

export function createJob(payload: Record<string, unknown>) {
  return articleStudioClient.post<JobSummary>(
    "/api/article-studio/jobs",
    payload,
  );
}

export function getJob(jobId: string) {
  return articleStudioClient.get<JobSummary>(
    `/api/article-studio/jobs/${jobId}`,
  );
}

export function retryJob(jobId: string) {
  return articleStudioClient.post<{ ok: true }>(
    `/api/article-studio/jobs/${jobId}/retry`,
  );
}
```

## 10.3 documents.ts

```ts
import { articleStudioClient } from "./client";
import type { DocumentDetail } from "../types";

export function getDocument(documentId: string) {
  return articleStudioClient.get<DocumentDetail>(
    `/api/article-studio/documents/${documentId}`,
  );
}

export function updateDocument(documentId: string, payload: Record<string, unknown>) {
  return articleStudioClient.put<{ ok: true }>(
    `/api/article-studio/documents/${documentId}`,
    payload,
  );
}

export function submitApproval(documentId: string, payload?: Record<string, unknown>) {
  return articleStudioClient.post<{ ok: true }>(
    `/api/article-studio/documents/${documentId}/submit-approval`,
    payload ?? {},
  );
}

export function approveDocument(documentId: string, payload: Record<string, unknown>) {
  return articleStudioClient.post<{ ok: true }>(
    `/api/article-studio/documents/${documentId}/approve`,
    payload,
  );
}

export function rejectDocument(documentId: string, payload: Record<string, unknown>) {
  return articleStudioClient.post<{ ok: true }>(
    `/api/article-studio/documents/${documentId}/reject`,
    payload,
  );
}

export function getRagflowStatus(documentId: string) {
  return articleStudioClient.get<{
    document_id: string;
    ragflow_status: string;
    ragflow_document_id?: string | null;
    knowledgebase_id?: string | null;
  }>(`/api/article-studio/documents/${documentId}/ragflow-status`);
}

export function retryRagflow(documentId: string) {
  return articleStudioClient.post<{ ok: true }>(
    `/api/article-studio/documents/${documentId}/ragflow-retry`,
  );
}
```

---

# 11. React Query Hooks 规范

当前 `workspace` 已经在 layout 中包裹了 QueryClientProvider，因此 Studio 直接复用 React Query 即可。([GitHub][3])

## 示例：`use-templates.ts`

```ts
"use client";

import { useQuery } from "@tanstack/react-query";
import { listTemplates } from "../api/templates";

export function useTemplates() {
  return useQuery({
    queryKey: ["article-studio", "templates"],
    queryFn: listTemplates,
  });
}
```

## 示例：`use-create-job.ts`

```ts
"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createJob } from "../api/jobs";

export function useCreateJob() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: createJob,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["article-studio", "jobs"] });
    },
  });
}
```

---

# 12. 页面设计

## 12.1 模板列表页 `/workspace/studio/templates`

功能：

* 搜索
* 分类筛选
* 模板卡片列表
* 进入模板详情
* 进入创建文章

### 页面骨架

```tsx
export default function StudioTemplatesPage() {
  return (
    <StudioPageShell
      title="Studio Templates"
      description="Template-driven article generation"
    >
      <StudioHeader />
      <TemplateList />
    </StudioPageShell>
  );
}
```

## 12.2 创建文章页 `/workspace/studio/create`

功能：

* 选择模板
* 根据 schema 动态生成表单
* 选择模型
* 选择生文方式
* 可选提示词覆盖
* 创建任务后跳转 `/workspace/studio/jobs/[jobId]`

### 核心点

动态表单应来自模板 schema，而不是手写固定字段。

## 12.3 任务详情页 `/workspace/studio/jobs/[jobId]`

功能：

* 显示任务状态
* 显示错误信息
* 若 `document_id` 存在，跳转文档详情
* 失败可 retry

## 12.4 文档详情页 `/workspace/studio/documents/[documentId]`

功能：

* Markdown 编辑
* 提交审批
* 审批通过/拒绝
* 展示 RAGFlow 状态
* RAGFlow retry

---

# 13. 关键组件设计

## 13.1 `components/workspace/studio/studio-nav.tsx`

作用：

* Studio 内部二级导航
* Templates / Create / Jobs / Documents 四标签

## 13.2 `dynamic-schema-form.tsx`

作用：

* 将模板 JSON Schema 渲染为 React 表单
* 第一版只支持：

  * string
  * number
  * boolean
  * array[string]
  * enum/select

### 不建议

第一版就做全 JSON Schema 全能力渲染。
只做 Article Studio 当前模板需要的 80% 字段类型。

## 13.3 `document-editor.tsx`

建议：

* 第一版直接用 `Textarea + Markdown Preview`
* 不要一开始就把 BlockNote / Yoopta 引入这个子模块
* 先把审批与入库链路打通

---

# 14. 导航接入点

## 修改文件

### `src/components/workspace/workspace-nav-chat-list.tsx`

当前只有 `Chats` 和 `Agents` 两个入口。应新增：

```tsx
<Link href="/workspace/studio/templates">
  Studio
</Link>
```

并使用 `usePathname()` 判断选中态。
这是最符合当前导航结构的切入点。([GitHub][4])

---

# 15. 页面布局接入点

## 方案

`Studio` 放到 `src/app/workspace/studio/*` 下，自动继承 `src/app/workspace/layout.tsx`：

* Sidebar
* QueryClientProvider
* Toaster
* CommandPalette

因此 **不需要再单独创建 Query Provider**。([GitHub][3])

---

# 16. 与后端 Article Studio 的接口映射

| 前端动作   | 后端接口                                                      |
| ------ | --------------------------------------------------------- |
| 模板列表   | `GET /api/article-studio/templates`                       |
| 模板详情   | `GET /api/article-studio/templates/{id}`                  |
| 创建任务   | `POST /api/article-studio/jobs`                           |
| 任务详情   | `GET /api/article-studio/jobs/{id}`                       |
| 任务重试   | `POST /api/article-studio/jobs/{id}/retry`                |
| 文档详情   | `GET /api/article-studio/documents/{id}`                  |
| 文档编辑   | `PUT /api/article-studio/documents/{id}`                  |
| 提交审批   | `POST /api/article-studio/documents/{id}/submit-approval` |
| 审批通过   | `POST /api/article-studio/documents/{id}/approve`         |
| 审批拒绝   | `POST /api/article-studio/documents/{id}/reject`          |
| 查看入库状态 | `GET /api/article-studio/documents/{id}/ragflow-status`   |
| 重试入库   | `POST /api/article-studio/documents/{id}/ragflow-retry`   |

这与前面已经定下的 Article Studio 后端契约是一致的。

---

# 17. Cursor 编码约束

## 必须遵守

1. **不修改 DeerFlow 现有 chat/thread/artifact 业务语义**
2. **所有 Article Studio REST 调用仅放在 `src/core/studio/api/*`**
3. **所有 React Query hook 仅放在 `src/core/studio/hooks/*`**
4. **所有页面仅负责路由与页面装配**
5. **新增 Studio 入口必须放在 workspace 导航中**
6. **优先复用 DeerFlow 现有 `components/ui/*` 组件**
7. **页面样式遵循 DeerFlow 当前工作区风格，不另起一套视觉体系**

## 第一版允许简化

* 模板版本页可先只读
* 文档编辑先用 Markdown textarea
* 批量任务、批量审批先不做
* 任务页先手动刷新，不做 websocket

---

# 18. 推荐开发顺序

## Phase 1

* `core/studio/api/*`
* `core/studio/hooks/*`
* `workspace-nav-chat-list.tsx` 增加 Studio 入口
* `app/workspace/studio/templates/page.tsx`
* `TemplateList`

## Phase 2

* `create/page.tsx`
* `dynamic-schema-form.tsx`
* `article-create-form.tsx`
* `useCreateJob`

## Phase 3

* `jobs/[jobId]/page.tsx`
* `documents/[documentId]/page.tsx`
* `document-editor.tsx`
* `approval-panel.tsx`
* `ragflow-status-card.tsx`

---

# 19. 最终结论

最合理的前端落地方式不是改 DeerFlow 原聊天页，而是：

> **在 DeerFlow 现有 `workspace` 体系下新增一个 `studio` 子模块，复用其 Sidebar、QueryClient、UI 组件和工作区布局；同时为 Article Studio 建立独立的 `core/studio` REST 客户端与 React Query hooks。**

这样做的原因很直接：

* DeerFlow 当前前端已经按 `app / components / core` 分层，适合扩展新业务域 ([GitHub][1])
* `workspace` 已经是业务工作区入口，天然适合作为 Studio 承载页 ([GitHub][7])
* `getAPIClient()` 是 LangGraph 线程客户端，不适合承载 Article Studio 的 REST 业务接口 ([GitHub][2])
* DeerFlow 整体定位仍应保持为 Agent Runtime，Article Studio 是独立业务模块，不应侵入其原线程运行时边界 

如果你要继续，我下一步直接给你一版：


