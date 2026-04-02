# DeerFlow 文件页 Markdown 编辑模式改造 PRD

**目标版本**：V1
**实现方式**：前端单点改造
**执行对象**：Cursor
**范围文件**：`frontend/**`
**后端改动**：无

---

## 1. 背景

DeerFlow 当前文件页组件 `artifact-file-detail.tsx` 已承担文件选择、预览/代码切换、下载/复制/关闭、`.skill` 安装等职责。Markdown 预览当前使用 `Streamdown`，代码视图使用 `CodeEditor`；`.skill` 文件被强制识别为 `markdown`；支持预览的类型只有 `markdown` 和 `html`；内容读取通过 `useArtifactContent` 完成；当前 `viewMode` 只有 `"code" | "preview"` 两种，并且支持预览的文件会默认进入 `preview`。([GitHub][1])

DeerFlow 前端当前技术栈是 **Next.js 16 + App Router、React 19、Tailwind CSS 4、Shadcn UI**，源码结构中存在独立的 `src/styles/` 全局样式目录；前端 `package.json` 当前并未包含任何 BlockNote 相关依赖。([GitHub][2])

DeerFlow 后端 API 文档当前只公开了 artifact 的 **读取接口** `GET /api/threads/{thread_id}/artifacts/{path}`，没有公开 artifact 内容回写接口。因此本阶段不能设计“编辑后保存回 DeerFlow artifact”的能力。([GitHub][3])

---

## 2. 目标

在不修改 DeerFlow 后端的前提下，为 Markdown 文件页新增一个 **显式“编辑”模式**：

1. `preview` 模式保持现状，继续使用 `Streamdown`
2. `code` 模式保持现状，继续使用 `CodeEditor`
3. 仅当用户点击“编辑”时，才加载并渲染 `BlockNote`
4. 不提供保存、回写、发布、自动同步能力
5. `html` 文件不进入编辑模式
6. 非 Markdown 文件行为不变

---

## 3. 非目标

本期不包含以下内容：

* 不新增任何 DeerFlow 后端接口
* 不新增 artifact 保存按钮
* 不回写 Markdown 到 DeerFlow 文件系统
* 不做 Wechatsync / article-syncjs 集成
* 不做 BlockNote 工具栏深度定制
* 不做 BlockNote 文档 JSON 存储
* 不修改 DeerFlow 现有 HTML 预览分支
* 不修改 `CodeEditor` 组件
* 不修改 `useArtifactContent` 数据流

---

## 4. 最终约束

### 4.1 DeerFlow 当前结构约束

Cursor 必须把改动限定在 DeerFlow 当前前端结构内：

* 主改造文件：`frontend/src/components/workspace/artifacts/artifact-file-detail.tsx`
* 新增组件须放在 `frontend/src/components/ai-elements/`；**本期仅**新增 `blocknote-editor.tsx`，且不在该目录下再建第二个仅用于 `next/dynamic` 的文件（`dynamic(..., { ssr: false })` 写在 `artifact-file-detail.tsx`）
* 全局样式相关调整只能在 `frontend/src/styles/` 下处理
* 不得改动 `backend/**`，不得改动 DeerFlow API 形态

这些约束来自 DeerFlow 当前前端项目结构与文件页实现。([GitHub][2])

### 4.2 数据流约束

Markdown 编辑模式只消费 `useArtifactContent` 已获取到的字符串内容。
本阶段不允许自行新增写回 API、Mutation Hook、保存状态机或本地持久化。DeerFlow 当前 API 公开的是 artifact 读取接口，而不是写入接口。([GitHub][1])

### 4.3 交互约束

Markdown 文件必须保留三态：

* `preview`
* `code`
* `edit`

其中：

* 默认进入 `preview`
* 用户手动切到 `edit` 后才挂载 BlockNote
* 切换文件时必须恢复默认态，不得记忆上一个文件的 `edit` 状态

`.skill` 文件由于当前逻辑被识别为 `markdown`，因此同样进入三态逻辑。([GitHub][1])

### 4.4 BlockNote 接入约束

BlockNote 官方 Next.js 文档明确要求：

* 只能在 **Client Component** 中渲染
* 推荐拆到单独文件并以 `"use client"` 声明
* 推荐通过 `next/dynamic(..., { ssr: false })` 做客户端动态导入，确保不会在服务端渲染
* 官方文档当前仍标注 React 19 / Next 15 StrictMode 兼容性问题，并建议 `reactStrictMode: false` 作为规避方式

因此，本期实现必须遵循 **client-only + dynamic import**，但**不得修改 `next.config.*`**；若出现 StrictMode 兼容问题，只记录为已知风险，不在本 PRD 内扩展处理。([BlockNote][4])

**本期文件拆分约定**：BlockNote 编辑器实现只新建 **一个** `frontend/src/components/ai-elements/blocknote-editor.tsx`（`"use client"` + 业务封装）。**不在** `ai-elements` 下再建第二个仅用于 `dynamic` 的文件；`next/dynamic(..., { ssr: false })` 写在 `artifact-file-detail.tsx` 中，动态加载上述模块，避免同目录自引用循环。

### 4.5 BlockNote UI 包约束

由于 DeerFlow 当前前端栈已使用 Shadcn UI + Tailwind CSS 4，BlockNote 的接入应使用 `@blocknote/shadcn` 版本。BlockNote 官方 ShadCN 文档要求：

* 安装 `@blocknote/core @blocknote/react @blocknote/shadcn`
* 从 `@blocknote/shadcn` 引入 `BlockNoteView`
* 从 `@blocknote/shadcn/style.css` 引入样式
* 在 Tailwind 样式入口增加 `@source "../node_modules/@blocknote/shadcn"` 以生成所需 utility class

因此，本期依赖必须按该方案落地。([BlockNote][5])

### 4.6 Markdown 互转约束

BlockNote 官方文档明确说明：

* Markdown 导入是 **lossy**
* Markdown 导出也是 **lossy**
* Markdown -> Blocks 应使用 `editor.tryParseMarkdownToBlocks(markdown)`
* Blocks -> Markdown 应使用 `editor.blocksToMarkdownLossy(...)`

由于本期不做保存，因此只使用 **Markdown 导入**。禁止在本期引入 Markdown 导出回写逻辑。([BlockNote][6])

---

## 5. 用户故事

### US-01

作为 DeerFlow 用户，我打开 Markdown artifact 时，仍然先看到当前只读预览，不会直接进入编辑器。

### US-02

作为 DeerFlow 用户，我点击“编辑”后，可以在当前文件页中看到 BlockNote 编辑器，并基于当前 Markdown 内容进行可视化编辑。

### US-03

作为 DeerFlow 用户，我可以随时从“编辑”切回“预览”或“代码”，且内容来源仍然基于 DeerFlow 当前 artifact 内容。

### US-04

作为 DeerFlow 用户，我打开 HTML artifact 时，不会看到“编辑”模式。

---

## 6. 功能需求

## 6.1 文件类型行为

### Markdown / `.skill`

必须支持三种视图模式：

* `preview`：沿用现有 `Streamdown`
* `code`：沿用现有 `CodeEditor`
* `edit`：新增 `BlockNote`

### HTML

必须继续仅支持：

* `preview`
* `code`

不得出现 `edit`。

### 非代码文件

保持现状，不引入任何编辑器。

---

## 6.2 默认行为

### 初次打开文件

* 若 `language === "markdown"`：默认 `preview`
* 若 `language === "html"`：默认 `preview`
* 其他：默认 `code`

### 切换 artifact 文件

必须重新执行默认模式判定。
不得因为前一个文件处于 `edit`，导致新文件也进入 `edit`。

---

## 6.3 编辑器挂载策略

BlockNote 只允许在以下条件同时满足时渲染：

```ts
isCodeFile && language === "markdown" && viewMode === "edit"
```

其他情况不得渲染 BlockNote，避免无意义初始化和 SSR 风险。

---

## 6.4 内容加载逻辑

BlockNote 编辑器初始化后，必须按以下流程导入 Markdown：

1. 使用 `useCreateBlockNote()` 创建 editor
2. 在 `useEffect` 中对传入的 `markdown` 执行：

   * `await editor.tryParseMarkdownToBlocks(markdown)`
   * `editor.replaceBlocks(editor.document, blocks)`
3. 使用 `lastLoadedMarkdownRef` 或等价机制防止重复灌入同一份内容
4. 文件切换时允许重新导入新内容

该流程基于 BlockNote 官方 Markdown Import 文档。([BlockNote][6])

---

## 7. 技术方案

## 7.1 文件级改造清单

### 修改文件 1

`frontend/package.json`

**新增 dependencies**

```json
{
  "@blocknote/core": "latest",
  "@blocknote/react": "latest",
  "@blocknote/shadcn": "latest"
}
```

**禁止**

* 删除 `streamdown`
* 升级无关依赖
* 改 scripts

---

### 修改文件 2

`frontend/src/styles/**` 中实际被 App Router 引入的 Tailwind 入口样式文件

**新增**

```css
@source "../node_modules/@blocknote/shadcn";
```

**要求**

* 只加这条 source 配置
* 不顺手大改全局主题
* 不新增无关 reset

**备注**
具体文件名由 Cursor 在 `src/styles/` 下定位 DeerFlow 当前 Tailwind 入口后处理。README 已明确 DeerFlow 维护了独立的 `src/styles/` 目录。([GitHub][2])

---

### 新增文件 3（仅此一个）

`frontend/src/components/ai-elements/blocknote-editor.tsx`

**职责**

* Client Component
* 封装 BlockNote editor
* 接收 markdown 字符串并导入
* 不做保存
* 不做对外命令暴露

**目标接口（合法 TypeScript / React 命名）**

```ts
export type BlockNoteEditorProps = {
  markdown: string;
  className?: string;
  editable?: boolean;
};

export function BlockNoteEditor(props: BlockNoteEditorProps);
```

**实现硬约束**

* 文件头使用 `"use client"`
* 引入：

  * `@blocknote/core/fonts/inter.css`
  * `@blocknote/shadcn/style.css`
* 使用 `useCreateBlockNote`
* 使用 `BlockNoteView` from `@blocknote/shadcn`
* 在 `useEffect` 中做 Markdown -> Blocks 导入
* 允许传入 `editable`
* 不暴露 `onChange`，因为本期无保存链路
* **命名导出** `BlockNoteEditor`（供消费方用 `dynamic` 做 `ssr: false` 加载）；若团队更偏好默认导出，则 `artifact-file-detail.tsx` 中的 `dynamic` 改为加载 `default`。

---

### 修改文件 4

`frontend/src/components/workspace/artifacts/artifact-file-detail.tsx`

**改动点**

#### A. 用 `next/dynamic` 加载 BlockNote（ssr: false）

在文件顶部（与其它 import 同级）增加对 `blocknote-editor` 的**动态**加载，避免 BlockNote 进入服务端渲染路径。示例（与命名导出 `BlockNoteEditor` 配合）：

```ts
import dynamic from "next/dynamic";

const BlockNoteEditorDynamic = dynamic(
  () =>
    import("@/components/ai-elements/blocknote-editor").then((mod) => ({
      default: mod.BlockNoteEditor,
    })),
  { ssr: false },
);
```

渲染 edit 分支时使用 `<BlockNoteEditorDynamic ... />`，而不是静态 `import` `BlockNoteEditor`。

#### B. 保留现有导入

必须保留：

```ts
import { Streamdown } from "streamdown";
import { streamdownPlugins } from "@/core/streamdown";
import { CodeEditor } from "@/components/workspace/code-editor";
import { useArtifactContent } from "@/core/artifacts/hooks";
```

#### C. 修改 `viewMode`

从：

```ts
"code" | "preview"
```

扩展为：

```ts
"code" | "preview" | "edit"
```

#### D. 修改默认模式 effect

增加 `filepathFromProps` 依赖。
切换文件时重置为默认模式：

* 支持预览：`preview`
* 不支持预览：`code`

#### E. 修改 ToggleGroup

* HTML：显示 `code / preview`
* Markdown：显示 `code / preview / edit`

#### F. 保留 `ArtifactFilePreview`

不得修改 `ArtifactFilePreview` 中的 Markdown 预览逻辑。
`language === "markdown"` 分支继续使用 `Streamdown`。

#### G. 新增 Edit 渲染分支

在主渲染区新增（使用 **A** 中的 `BlockNoteEditorDynamic`）：

```tsx
{isCodeFile && language === "markdown" && viewMode === "edit" && (
  <ArtifactContent className="min-h-0">
    <BlockNoteEditorDynamic
      markdown={displayContent ?? ""}
      className="size-full"
      editable={!isWriteFile}
    />
  </ArtifactContent>
)}
```

---

## 7.2 推荐渲染结构

```tsx
{isSupportPreview && viewMode === "preview" && (language === "markdown" || language === "html") && (
  <ArtifactFilePreview
    content={displayContent}
    isWriteFile={isWriteFile}
    language={language}
    url={url}
  />
)}

{isCodeFile && viewMode === "code" && (
  <ArtifactContent className="min-h-0">
    <CodeEditor ... />
  </ArtifactContent>
)}

{isCodeFile && language === "markdown" && viewMode === "edit" && (
  <ArtifactContent className="min-h-0">
    <BlockNoteEditorDynamic
      markdown={displayContent ?? ""}
      className="size-full"
      editable={!isWriteFile}
    />
  </ArtifactContent>
)}
```

---

## 8. 不可修改项

Cursor 必须遵守：

* 不改 `backend/**`
* 不改 DeerFlow API 文档
* 不改 `frontend/src/core/artifacts/hooks.ts`
* 不改 `frontend/src/core/artifacts/utils.ts`
* 不改 `frontend/src/components/workspace/code-editor.tsx`
* 不改 `ArtifactFilePreview` 的 HTML 分支
* 不新增保存按钮
* 不新增发布按钮
* 不新增本地缓存
* 不修改 `next.config.*`

---

## 9. 风险与取舍

## 9.1 React 19 / Next StrictMode 风险

BlockNote 官方 Next.js 文档当前仍写明其与 React 19 / Next 15 StrictMode 存在兼容性问题，并建议关闭 `reactStrictMode`。DeerFlow 当前是 Next.js 16 + React 19，因此这属于已知外部依赖风险。([GitHub][2])

**本期取舍**

* 不动 `next.config.*`
* 只采用 client-only + dynamic import 规避 SSR 路径
* 若仍出现兼容性报错，本期只记录问题，不扩 scope

## 9.2 Markdown 非无损转换风险

BlockNote 对 Markdown 的导入导出都是 lossy。即使本期不保存，也要接受“BlockNote 编辑态视觉结构 ≠ 原始 Markdown 代码态完全等价”的事实。([BlockNote][6])

**本期取舍**

* 保留 `code` 模式，作为原始文本参考
* 不做保存
* 不做回写

## 9.3 样式注入风险

采用 `@blocknote/shadcn` 时，若 Tailwind 入口未加入 `@source "../node_modules/@blocknote/shadcn"`，会出现样式缺失。([BlockNote][5])

**本期取舍**

* 明确要求在 DeerFlow 当前 Tailwind 入口样式中添加 `@source`
* 不自行复制官方整段 ShadCN CSS 变量

---

## 10. 验收标准

## 10.1 功能验收

1. 打开 Markdown artifact，默认显示 `preview`
2. `preview` 模式仍使用 `Streamdown`
3. `code` 模式仍使用 `CodeEditor`
4. 点击 `edit` 后才显示 BlockNote
5. Markdown 文件存在 `edit` 选项
6. HTML 文件不存在 `edit` 选项
7. 非 Markdown 文件行为无变化
8. `.skill` 文件存在 `edit` 选项
9. 切换 artifact 文件后，模式重置为默认态

## 10.2 工程验收

必须通过：

```bash
pnpm typecheck
pnpm lint
pnpm build
```

DeerFlow 前端 README 当前也将这三项列为标准开发检查命令。([GitHub][2])

---

## 11. Cursor 执行步骤

```md
任务：为 DeerFlow 文件页增加 Markdown 编辑模式，但不替换现有预览模式。

目标：
- preview 继续使用 Streamdown
- code 继续使用 CodeEditor
- 只有点击 edit 时才使用 BlockNote
- 不改后端
- 不新增保存接口

执行步骤：

1. 修改 frontend/package.json
   - 增加依赖：
     - @blocknote/core
     - @blocknote/react
     - @blocknote/shadcn
   - 不删除 streamdown

2. 在 frontend/src/styles/ 下定位当前 Tailwind 入口样式文件
   - 增加：
     @source "../node_modules/@blocknote/shadcn";

3. 新建 frontend/src/components/ai-elements/blocknote-editor.tsx（仅此一个新建文件）
   - "use client"
   - 命名导出 BlockNoteEditor（及 BlockNoteEditorProps）
   - 引入：
     - @blocknote/core/fonts/inter.css
     - @blocknote/shadcn/style.css
   - 使用 useCreateBlockNote
   - 使用 BlockNoteView from @blocknote/shadcn
   - props:
     - markdown: string
     - className?: string
     - editable?: boolean
   - 在 useEffect 中执行：
     - const blocks = await editor.tryParseMarkdownToBlocks(markdown)
     - editor.replaceBlocks(editor.document, blocks)
   - 不做保存逻辑

4. 修改 frontend/src/components/workspace/artifacts/artifact-file-detail.tsx
   - 保留 Streamdown、streamdownPlugins、CodeEditor、useArtifactContent
   - 使用 next/dynamic 从 @/components/ai-elements/blocknote-editor 加载 BlockNoteEditor，ssr: false（见 7.1 节示例变量名 BlockNoteEditorDynamic）
   - viewMode 从 "code" | "preview" 改为 "code" | "preview" | "edit"
   - 默认模式逻辑：
     - 支持预览 -> preview
     - 否则 -> code
     - 切换文件时重置
   - ToggleGroup:
     - html -> code / preview
     - markdown -> code / preview / edit
   - 保留 ArtifactFilePreview 的 markdown 分支，不改 Streamdown
   - 新增 edit 分支，仅在 markdown + viewMode === "edit" 时渲染 BlockNoteEditorDynamic

5. 验证
   - pnpm typecheck
   - pnpm lint
   - pnpm build

禁止事项：
- 不改 backend/**
- 不改 frontend/src/core/artifacts/hooks.ts
- 不改 frontend/src/components/workspace/code-editor.tsx
- 不加保存按钮
- 不加发布按钮
- 不改 HTML 预览逻辑
- 不改 next.config.*
```

---
