# BlockNote 源码级深度分析报告

> 面向企业 AI Work 平台的工程落地参考

---

## 一、Monorepo 目录结构与组织

BlockNote 使用 **pnpm + nx** 管理的 monorepo，根 `package.json` 定义了构建和发布脚本。 [1](#0-0) 

**packages 目录全貌：**

```
packages/
├── core/           # 框架核心，无 UI 依赖
├── react/          # React 绑定层
├── mantine/        # Mantine UI 主题实现
├── shadcn/         # ShadCN UI 主题实现
├── ariakit/        # Ariakit UI 主题实现
├── code-block/     # 代码块扩展
├── xl-ai/          # AI 功能扩展（@blocknote/xl-ai）
├── xl-multi-column/# 多列布局扩展
├── xl-docx-exporter/  # DOCX 导出
├── xl-email-exporter/ # Email 导出
├── xl-pdf-exporter/   # PDF 导出
├── xl-odt-exporter/   # ODT 导出
├── server-util/    # 服务端渲染工具
└── dev-scripts/    # 构建脚本
```

**关键分层逻辑：**
- `core` = 编辑器引擎（可在 SSR / headless 环境运行）
- `react` = React 视图层，依赖 core
- `mantine/shadcn/ariakit` = 具体 UI 组件实现，依赖 react
- `xl-*` = 功能扩展包，按需引入

---

## 二、core / react / UI 层的职责边界

### 2.1 `@blocknote/core` 的职责

core 的 `src` 目录：

```
src/
├── editor/         # BlockNoteEditor 主类 + 7个 Manager
├── schema/         # Block/InlineContent/Style 类型系统
├── blocks/         # 内置 Block 实现（14种）
├── extensions/     # 所有扩展（SideMenu、SuggestionMenu 等）
├── pm-nodes/       # ProseMirror 节点定义
├── api/            # 块操作 API、导入导出
├── comments/       # 评论扩展
├── yjs/            # 协作相关
└── i18n/           # 国际化
```

`BlockNoteEditor` 是核心类，内部持有 7 个 Manager 实例： [2](#0-1) 

- `BlockManager` — 块 CRUD API（getBlock/insertBlocks/updateBlock 等）
- `ExportManager` — HTML/Markdown 导入导出
- `ExtensionManager` — 扩展注册与生命周期管理
- `SelectionManager` — 选区管理
- `StateManager` — 状态管理
- `StyleManager` — 文本样式管理
- `EventManager` — 事件系统

**BlockNoteEditor 直接包裹 TiptapEditor**，暴露出 `_tiptapEditor` 和 `pmSchema`： [3](#0-2) 

### 2.2 `@blocknote/react` 的职责

react 的 `src` 目录：

```
src/
├── editor/         # BlockNoteView、Context、DefaultUI
├── components/     # 所有 UI 组件 Controllers
├── hooks/          # React hooks（useCreateBlockNote 等）
├── schema/         # ReactBlockSpec（React 自定义块）
└── blocks/         # React 版块组件（ImageBlock 等）
```

**react 层不持有任何状态**，完全通过 `useExtension`/`useExtensionState` 订阅 core 的 `@tanstack/store`： [4](#0-3) 

### 2.3 UI 主题层（mantine/shadcn/ariakit）

以 `@blocknote/mantine` 为例，它将具体 UI 组件通过 `ComponentsContext.Provider` 注入： [5](#0-4) 

`ComponentsContext` 定义了**完整的 UI 组件接口契约**，包含 FormattingToolbar、SideMenu、SuggestionMenu、TableHandle、Comments 等所有插槽： [6](#0-5) 

> **关键结论：** core 完全框架无关，react 层是 view-only 的订阅者，UI 实现完全可替换。企业二开时可以只替换 `ComponentsContext` 的组件实现，不改动 core 逻辑。

---

## 三、Block-Based 编辑器架构

### 3.1 ProseMirror 节点结构

BlockNote 在 ProseMirror 之上构建了**三层节点包装结构**，详见官方 README： [7](#0-6) 

核心结构：
```
doc
└── blockGroup
    ├── blockContainer [id, data-*]   ← 对应 Block.id
    │   ├── blockContent              ← 对应具体块类型（paragraph/heading/image...）
    │   └── blockGroup (可选)          ← 对应 Block.children
    └── columnList (多列)
        └── column
            └── blockContainer
```

`BlockContainer` 节点的 ProseMirror 实现： [8](#0-7) 

### 3.2 Block 类型系统（Schema）

Block 的 TypeScript 数据模型：
```typescript
{
  id: string;
  type: string;        // "paragraph" | "heading" | "image" | ...
  props: {...};        // 每种 block 自定义的属性
  content: InlineContent[] | undefined;
  children: Block[];
}
```

内置 14 种 Block 类型： [9](#0-8) 

内置 7 种 Style（文本样式）： [10](#0-9) 

### 3.3 Schema 的扩展设计

`CustomBlockNoteSchema` 支持链式 `.extend()` 追加自定义块： [11](#0-10) 

Schema 的初始化会处理依赖排序（topological sort），确保扩展优先级正确： [12](#0-11) 

---

## 四、扩展机制详解

### 4.1 Extension 接口

BlockNote 自定义了一套 **Extension 规范**，独立于 Tiptap Extension： [13](#0-12) 

一个 Extension 可声明：
- `key` — 唯一标识
- `mount(ctx)` — 挂载时回调（含 AbortSignal 生命周期）
- `store` — `@tanstack/store` 状态
- `prosemirrorPlugins` — 直接添加 PM 插件
- `tiptapExtensions` — 添加 Tiptap 扩展
- `keyboardShortcuts` — 键盘快捷键
- `inputRules` — 输入规则（如 `#` 触发 Heading）
- `blockNoteExtensions` — 组合其他 BN 扩展

`createExtension` 是工厂函数： [14](#0-13) 

### 4.2 默认扩展集合

`ExtensionManager` 初始化时注册所有默认扩展（可通过 `disableExtensions` 禁用）： [15](#0-14) 

包含：`BlockChangeExtension`、`DropCursorExtension`、`FilePanelExtension`、`FormattingToolbarExtension`、`LinkToolbarExtension`、`SideMenuExtension`、`SuggestionMenu`、`TrailingNodeExtension`、`HistoryExtension`（协作时替换为 `CollaborationExtension`）、`TableHandlesExtension`

### 4.3 Tiptap 原生扩展列表

底层注册的 Tiptap/ProseMirror 扩展： [16](#0-15) 

### 4.4 ExtensionManager 生命周期

扩展 mount/unmount 由 AbortController 管控： [17](#0-16) 

### 4.5 自定义 Block 规范（BlockSpec）

一个 Block 的配置由 `config`（类型声明）+ `implementation`（渲染逻辑）组成： [18](#0-17) 

Image 块的完整实现示例（core 纯 DOM 版本）： [19](#0-18) 

React 版 Image 块（用 `createReactBlockSpec`）： [20](#0-19) 

### 4.6 FormattingToolbar 扩展实现

Formatting Toolbar 使用 `mount()` + `AbortSignal` + `Store` 模式： [21](#0-20) 

React 层的 `FormattingToolbarController` 通过 `useExtensionState` 订阅 store： [22](#0-21) 

---

## 五、关键能力实现线索

### 5.1 斜杠菜单（Slash Menu）

**Core 层**：`SuggestionMenu` 是一个 ProseMirror Plugin，监听 `handleTextInput`，当检测到触发字符（`/` 或 `:`）时，通过 `setMeta` 激活插件状态： [23](#0-22) 

触发字符在 PM Plugin 的 `apply` 方法里追踪 query： [24](#0-23) 

默认 Slash Menu 项根据 schema 中存在的块类型动态生成： [25](#0-24) 

**React 层**：`SuggestionMenuController` 通过 `FloatingUI` 定位弹出菜单： [26](#0-25) 

**企业侧定制**：只需传 `getItems` 函数即可替换菜单内容，支持异步加载（AI 命令菜单等）。

### 5.2 拖拽（Drag & Drop）

`SideMenu` 扩展实现了块级拖拽。拖拽开始时通过 `setDragImage` 自定义拖拽预览： [27](#0-26) 

SideMenu 扩展根据鼠标坐标计算当前悬停块： [28](#0-27) 

### 5.3 图片块（含文件上传）

图片块支持 `uploadFile`（应用层注入）、`resolveFileUrl`（URL 鉴权）、可调整宽度（`previewWidth` prop）、caption： [29](#0-28) 

上传钩子在 `BlockNoteEditorOptions` 中定义： [30](#0-29) 

`resolveFileUrl` 支持异步 URL 转换（适合 S3 预签名链接场景）： [31](#0-30) 

### 5.4 实时协作（Yjs）

协作通过 `CollaborationExtension` 组合了 4 个子扩展： [32](#0-31) 

`YSyncExtension` 直接使用 `y-prosemirror` 的 `ySyncPlugin`： [33](#0-32) 

`CollaborationOptions` 接口需传入 Yjs Fragment + 用户信息 + Provider： [34](#0-33) 

### 5.5 评论系统

`CommentsExtension` 基于 ProseMirror Mark 实现线程标注，通过 `ThreadStore` 接口解耦存储层： [35](#0-34) 

评论组件在 `BlockNoteDefaultUI` 中懒加载（避免打入主 bundle）： [36](#0-35) 

### 5.6 AI 扩展（xl-ai）

`AIExtension` 基于 **Vercel AI SDK**（`@ai-sdk/react`），内置了"建议修改"能力（`prosemirror-suggest-changes`）： [37](#0-36) 

AI 请求接口由 `AIRequestHelpers` 定义，支持自定义 transport（适合企业内部 LLM 代理）： [38](#0-37) 

AI 状态机含 5 个状态：`user-input` → `thinking` → `ai-writing` → `user-reviewing` → `closed`： [39](#0-38) 

---

## 六、React 集成方式

### 6.1 标准接入流程

**Step 1**：用 `useCreateBlockNote` hook 实例化编辑器（内部 `useMemo` 包裹）： [40](#0-39) 

**Step 2**：用 `BlockNoteView`（mantine 版）或 `BlockNoteViewRaw`（headless）渲染： [41](#0-40) 

`BlockNoteView` 内部建立两个 Context：
- `BlockNoteContext` — 提供 editor 实例、颜色方案等
- `BlockNoteViewContext` — 提供编辑器 DOM props 和默认 UI 开关 [42](#0-41) 

**Step 3**：`BlockNoteDefaultUI` 根据 schema 中存在的扩展条件渲染各 UI 组件： [43](#0-42) 

### 6.2 编辑器内容挂载原理

`BlockNoteViewEditor` 的 `mount` callback 将编辑器挂载到真实 DOM，并将 `contentComponent`（Portal 管理器）注入 TiptapEditor： [44](#0-43) 

这是 BlockNote **绕开 TiptapEditor 官方 React 绑定**自行实现 Portal 的关键：React 组件渲染到编辑器内部的 NodeView 是通过自定义 Portal 实现的，不依赖 `@tiptap/react` 的 `EditorContent`。

### 6.3 自定义 UI 组件接入方式

完全自定义工具栏示例路径：
```tsx
<BlockNoteView editor={editor} formattingToolbar={false}>
  <FormattingToolbarController formattingToolbar={MyCustomToolbar} />
</BlockNoteView>
```

`BlockNoteView` 的 `children` 优先级高于默认 UI： [45](#0-44) 

### 6.4 状态订阅 Hook

`useEditorState` 使用 `useSyncExternalStoreWithSelector` + `fast-deep-equal` 实现精细化重渲染控制： [46](#0-45) 

---

## 七、BlockNoteEditorOptions 配置能力清单

关键配置项（均有类型约束）： [47](#0-46) 

| 配置项 | 作用 |
|---|---|
| `schema` | 自定义 Block/Style/InlineContent Schema |
| `initialContent` | 初始文档（PartialBlock[]） |
| `uploadFile` | 文件上传回调 |
| `resolveFileUrl` | URL 鉴权/转换 |
| `collaboration` | Yjs 协作配置 |
| `extensions` | 追加自定义扩展 |
| `disableExtensions` | 按 key 禁用内置扩展 |
| `pasteHandler` | 自定义粘贴行为（支持 Markdown 优先） |
| `dictionary` | i18n 翻译 |
| `tables` | 表格功能开关（splitCells/headers 等） |
| `dropCursor` | 自定义拖拽指示器 |
| `animations` | 块变换动画开关 |
| `_tiptapOptions` | 透传底层 TiptapEditor 配置（内部使用） |

---

## 八、与 Tiptap / ProseMirror 的关系

### 依赖层级

```
ProseMirror (prosemirror-state/view/model/keymap/...)
     ↑
  Tiptap Core (@tiptap/core)   ← 被直接导入
     ↑
BlockNote Core (packages/core)  ← 封装并扩展
     ↑
BlockNote React (packages/react) ← 用 @tiptap/react 的 ReactNodeViewRenderer
```

### 具体耦合点

1. **`BlockNoteEditor` 持有 `TiptapEditor` 实例**（作为 `_tiptapEditor`）： [48](#0-47) 

2. **Tiptap Extension/Node 仍是 PM Extension 的包装**：BlockNote Schema 中的每个 Block 最终仍是 Tiptap `Node`： [49](#0-48) 

3. **有意暴露 PM 底层**：`pmSchema`、`prosemirrorView`、`transact()` 均为 public API，允许直接操作 PM。

4. **TiptapEditor 配置时关闭了默认核心扩展**（`enableCoreExtensions: false`），由 BlockNote 自行注册： [50](#0-49) 

5. **React NodeView 用的是 `@tiptap/react` 的 `ReactNodeViewRenderer`**： [51](#0-50) 

### 结论

BlockNote **不是对 Tiptap 的简单封装**，而是在其之上构建了一套全新的 Block 数据模型、Schema 类型系统、Extension API 和 UI 架构。但底层仍然可以通过 `_tiptapOptions` 和 `pmSchema` 访问 PM 原语，**Tiptap 扩展生态（如 `@tiptap/extension-link`）可以直接复用**。

---

## 九、适合与不适合的业务场景

### ✅ 适合的场景

| 场景 | 原因 |
|---|---|
| AI 文档编辑器 | 内置 `xl-ai` 包，基于 Vercel AI SDK，支持流式写入 |
| 知识库/Wiki 编辑 | Block 模型天然适合结构化文档，支持嵌套/折叠/多列 |
| 企业内容协作 | 内置 Yjs 协作 + 评论系统，开箱即用 |
| 富文本表单字段 | `editable={false}` 支持只读模式，`headless` 模式可服务端渲染 |
| 需要 Markdown/HTML 互转 | `ExportManager` 提供 `blocksToMarkdown`/`tryParseHTMLToBlocks` |
| 自定义工具栏/菜单 | 组件替换机制完善，`ComponentsContext` 完全可控 |

### ❌ 不适合的场景

| 场景 | 原因 |
|---|---|
| 纯 Markdown 编辑器 | Block 模型与 Markdown 概念有差异，导出 Markdown 是有损转换 |
| 极简单行文本输入 | 过于厚重，适合完整文档场景 |
| 低端移动设备 | ProseMirror 在移动端 IME 支持有历史问题；移动端工具栏为实验性 |
| 严格 SSR 无 JS 输出 | 编辑器本身需要客户端 JS，`server-util` 仅支持 HTML 序列化 |
| 需要直接深度定制 PM Schema | Block 模型对 PM 节点结构有强假设，破坏这些假设会很困难 |

---

## 十、企业级二开建议

### 建议保留

| 模块 | 理由 |
|---|---|
| `@blocknote/core` 全部 | 稳定的 Block API，TypeScript 类型完整，不应修改 |
| `BlockNoteEditor` 选项系统 | 通过配置已能满足大多数需求 |
| `CollaborationExtension` | Yjs 协作已完整封装，工程成本低 |
| `xl-ai` 的 Extension 骨架 | AI 状态机设计合理，建议参考其 `AIExtension` 的结构写自定义 AI 扩展 |
| `ExportManager` | 导入/导出 Markdown/HTML 能力完整 |

### 建议替换/扩展

| 模块 | 建议 |
|---|---|
| UI 主题层 | 替换 `@blocknote/mantine` 为自定义 `ComponentsContext` 实现，配合企业设计系统 |
| `FormattingToolbar` | 通过 `formattingToolbar={false}` 关闭默认，传入自定义组件 |
| `SuggestionMenuController` | 扩展 `getItems`，加入 AI 命令、企业模板等 |
| `uploadFile` / `resolveFileUrl` | 必须替换，接入企业 OSS 鉴权 |
| `dictionary` | 替换为企业中文化词典 |
| 评论 `ThreadStore` | 替换为企业评论存储后端 |
| `_tiptapOptions` | 谨慎使用，用于注入企业专属 PM 插件（如审计 log） |

### 禁止直接修改

- `packages/core/src/pm-nodes/` 中的节点结构（会破坏所有上层 API）
- `BlockNoteSchema` 的初始化逻辑（影响依赖排序）
- `BlockNoteEditor.ts` 构造函数（Tiptap/PM 初始化有隐式依赖顺序）

---

## 十一、Cursor / Claude Code 代码生成提示词模板

基于本分析，可直接使用以下提示词让 AI 代码助手生成页面：

```
你是一位熟悉 BlockNote（@blocknote/react + @blocknote/mantine + @blocknote/core）的 TypeScript 工程师。

项目要求：
1. 使用 useCreateBlockNote() hook 创建编辑器实例
2. schema 需要支持自定义块：[你的自定义块名称]
3. uploadFile 接入 [你的 OSS 服务]
4. 使用 BlockNoteView（from @blocknote/mantine）渲染
5. 斜杠菜单需要增加 [AI 辅助写作] 入口（通过 SuggestionMenuController 的 getItems 扩展）
6. formattingToolbar 替换为自定义工具栏组件 MyFormattingToolbar
7. 编辑器内容变更时通过 onChange 回调保存（blocksToMarkdown 序列化）

请生成完整的页面组件代码，包含 TypeScript 类型、imports 和 CSS 处理。
```

---

## 结论摘要

| 维度 | 结论 |
|---|---|
| **架构层次** | 4

### Citations

**File:** package.json (L1-59)
```json
{
  "name": "root",
  "type": "module",
  "devDependencies": {
    "@nx/js": "^21.6.5",
    "@typescript-eslint/eslint-plugin": "^5.62.0",
    "@typescript-eslint/parser": "^5.62.0",
    "concurrently": "9.1.2",
    "eslint": "^8.57.1",
    "eslint-config-react-app": "^7.0.1",
    "eslint-plugin-import": "^2.32.0",
    "glob": "^10.5.0",
    "nx": "^21.6.5",
    "prettier": "^3.6.2",
    "prettier-plugin-tailwindcss": "^0.6.14",
    "serve": "14.2.4",
    "typescript": "^5.9.3",
    "vitest": "^2.1.9",
    "wait-on": "8.0.3"
  },
  "pnpm": {
    "ignoredBuiltDependencies": [
      "sharp",
      "workerd"
    ],
    "onlyBuiltDependencies": [
      "@parcel/watcher",
      "@sentry/cli",
      "@tailwindcss/oxide",
      "better-sqlite3",
      "canvas",
      "esbuild",
      "msw",
      "nx",
      "unrs-resolver"
    ]
  },
  "packageManager": "pnpm@10.23.0+sha512.21c4e5698002ade97e4efe8b8b4a89a8de3c85a37919f957e7a0f30f38fbc5bbdd05980ffe29179b2fb6e6e691242e098d945d1601772cad0fef5fb6411e2a4b",
  "private": true,
  "scripts": {
    "dev": "nx run @blocknote/example-editor:dev",
    "dev:docs": "nx run docs:dev",
    "build": "nx run-many --target=build",
    "build:clean": "pnpm run clean && pnpm run gen && pnpm run clean && pnpm run build",
    "build:site": "nx run-many --target=build:site",
    "clean": "nx run-many --target=clean",
    "deploy": "nx release --skip-publish",
    "gen": "nx run @blocknote/dev-scripts:gen",
    "install-playwright": "cd tests && pnpx playwright install --with-deps",
    "e2e": "concurrently --success=first -r --kill-others \"pnpm run start -L\" \"wait-on http://localhost:3000 && cd tests && pnpm exec playwright test $PLAYWRIGHT_CONFIG\"",
    "e2e:updateSnaps": "concurrently --success=first -r --kill-others \"pnpm run start -L\" \"wait-on http://localhost:3000 && cd tests && pnpm run test:updateSnaps\"",
    "lint": "nx run-many --target=lint",
    "postpublish": "rm -rf packages/core/README.md && rm -rf packages/react/README.md",
    "prebuild": "cp README.md packages/core/README.md && cp README.md packages/react/README.md",
    "prestart": "pnpm run build",
    "start": "serve playground/dist -c ../serve.json",
    "test": "nx run-many --target=test",
    "format": "prettier --write \"**/*.{js,jsx,ts,tsx,css,scss,md}\""
  }
```

**File:** packages/core/src/editor/BlockNoteEditor.ts (L62-301)
```typescript
export interface BlockNoteEditorOptions<
  BSchema extends BlockSchema,
  ISchema extends InlineContentSchema,
  SSchema extends StyleSchema,
> {
  /**
   * Whether changes to blocks (like indentation, creating lists, changing headings) should be animated or not. Defaults to `true`.
   *
   * @default true
   */
  animations?: boolean;

  /**
   * Whether the editor should be focused automatically when it's created.
   *
   * @default false
   */
  autofocus?: FocusPosition;

  /**
   * When enabled, allows for collaboration between multiple users.
   * See [Real-time Collaboration](https://www.blocknotejs.org/docs/advanced/real-time-collaboration) for more info.
   */
  collaboration?: CollaborationOptions;

  /**
   * Use default BlockNote font and reset the styles of <p> <li> <h1> elements etc., that are used in BlockNote.
   *
   * @default true
   */
  defaultStyles?: boolean;

  /**
   * A dictionary object containing translations for the editor.
   *
   * See [Localization / i18n](https://www.blocknotejs.org/docs/advanced/localization) for more info.
   *
   * @remarks `Dictionary` is a type that contains all the translations for the editor.
   */
  dictionary?: Dictionary & Record<string, any>;

  /**
   * Disable internal extensions (based on keys / extension name)
   *
   * @note Advanced
   */
  disableExtensions?: string[];

  /**
   * An object containing attributes that should be added to HTML elements of the editor.
   *
   * See [Adding DOM Attributes](https://www.blocknotejs.org/docs/theming#adding-dom-attributes) for more info.
   *
   * @example { editor: { class: "my-editor-class" } }
   * @remarks `Record<string, Record<string, string>>`
   */
  domAttributes?: Partial<BlockNoteDOMAttributes>;

  /**
   * A replacement indicator to use when dragging and dropping blocks. Uses the [ProseMirror drop cursor](https://github.com/ProseMirror/prosemirror-dropcursor), or a modified version when [Column Blocks](https://www.blocknotejs.org/docs/document-structure#column-blocks) are enabled.
   * @remarks `() => Plugin`
   */
  dropCursor?: (opts: {
    editor: BlockNoteEditor<
      NoInfer<BSchema>,
      NoInfer<ISchema>,
      NoInfer<SSchema>
    >;
    color?: string | false;
    width?: number;
    class?: string;
  }) => Plugin;

  /**
   * The content that should be in the editor when it's created, represented as an array of {@link PartialBlock} objects.
   *
   * See [Partial Blocks](https://www.blocknotejs.org/docs/editor-api/manipulating-blocks#partial-blocks) for more info.
   *
   * @remarks `PartialBlock[]`
   */
  initialContent?: PartialBlock<
    NoInfer<BSchema>,
    NoInfer<ISchema>,
    NoInfer<SSchema>
  >[];

  /**
   * @deprecated, provide placeholders via dictionary instead
   * @internal
   */
  placeholders?: Record<
    string | "default" | "emptyDocument",
    string | undefined
  >;

  /**
   * Custom paste handler that can be used to override the default paste behavior.
   *
   * See [Paste Handling](https://www.blocknotejs.org/docs/advanced/paste-handling) for more info.
   *
   * @remarks `PasteHandler`
   * @returns The function should return `true` if the paste event was handled, otherwise it should return `false` if it should be canceled or `undefined` if it should be handled by another handler.
   *
   * @example
   * ```ts
   * pasteHandler: ({ defaultPasteHandler }) => {
   *   return defaultPasteHandler({ pasteBehavior: "prefer-html" });
   * }
   * ```
   */
  pasteHandler?: (context: {
    event: ClipboardEvent;
    editor: BlockNoteEditor<
      NoInfer<BSchema>,
      NoInfer<ISchema>,
      NoInfer<SSchema>
    >;
    /**
     * The default paste handler
     * @param context The context object
     * @returns Whether the paste event was handled or not
     */
    defaultPasteHandler: (context?: {
      /**
       * Whether to prioritize Markdown content in `text/plain` over `text/html` when pasting from the clipboard.
       * @default true
       */
      prioritizeMarkdownOverHTML?: boolean;
      /**
       * Whether to parse `text/plain` content from the clipboard as Markdown content.
       * @default true
       */
      plainTextAsMarkdown?: boolean;
    }) => boolean | undefined;
  }) => boolean | undefined;

  /**
   * Resolve a URL of a file block to one that can be displayed or downloaded. This can be used for creating authenticated URL or
   * implementing custom protocols / schemes
   * @returns The URL that's
   */
  resolveFileUrl?: (url: string) => Promise<string>;

  /**
   * The schema of the editor. The schema defines which Blocks, InlineContent, and Styles are available in the editor.
   *
   * See [Custom Schemas](https://www.blocknotejs.org/docs/custom-schemas) for more info.
   * @remarks `BlockNoteSchema`
   */
  schema: CustomBlockNoteSchema<BSchema, ISchema, SSchema>;

  /**
   * A flag indicating whether to set an HTML ID for every block
   *
   * When set to `true`, on each block an id attribute will be set with the block id
   * Otherwise, the HTML ID attribute will not be set.
   *
   * (note that the id is always set on the `data-id` attribute)
   */
  setIdAttribute?: boolean;

  /**
   * Determines behavior when pressing Tab (or Shift-Tab) while multiple blocks are selected and a toolbar is open.
   * - `"prefer-navigate-ui"`: Changes focus to the toolbar. User must press Escape to close toolbar before indenting blocks. Better for keyboard accessibility.
   * - `"prefer-indent"`: Always indents selected blocks, regardless of toolbar state. Keyboard navigation of toolbars not possible.
   * @default "prefer-navigate-ui"
   */
  tabBehavior?: "prefer-navigate-ui" | "prefer-indent";

  /**
   * Allows enabling / disabling features of tables.
   *
   * See [Tables](https://www.blocknotejs.org/docs/editor-basics/document-structure#tables) for more info.
   *
   * @remarks `TableConfig`
   */
  tables?: {
    /**
     * Whether to allow splitting and merging cells within a table.
     *
     * @default false
     */
    splitCells?: boolean;
    /**
     * Whether to allow changing the background color of cells.
     *
     * @default false
     */
    cellBackgroundColor?: boolean;
    /**
     * Whether to allow changing the text color of cells.
     *
     * @default false
     */
    cellTextColor?: boolean;
    /**
     * Whether to allow changing cells into headers.
     *
     * @default false
     */
    headers?: boolean;
  };

  /**
   * An option which user can pass with `false` value to disable the automatic creation of a trailing new block on the next line when the user types or edits any block.
   *
   * @default true
   */
  trailingBlock?: boolean;

  /**
   * The `uploadFile` method is what the editor uses when files need to be uploaded (for example when selecting an image to upload).
   * This method should set when creating the editor as this is application-specific.
   *
   * `undefined` means the application doesn't support file uploads.
   *
   * @param file The file that should be uploaded.
   * @returns The URL of the uploaded file OR an object containing props that should be set on the file block (such as an id)
   * @remarks `(file: File) => Promise<UploadFileResult>`
   */
  uploadFile?: (
    file: File,
    blockId?: string,
  ) => Promise<string | Record<string, any>>;

  /**
   * additional tiptap options, undocumented
   * @internal
   */
  _tiptapOptions?: Partial<EditorOptions>;

  /**
   * Register extensions to the editor.
   *
   * See [Extensions](/docs/features/extensions) for more info.
   *
   * @remarks `ExtensionFactory[]`
   */
  extensions?: Array<ExtensionFactoryInstance>;
}
```

**File:** packages/core/src/editor/BlockNoteEditor.ts (L303-307)
```typescript
const blockNoteTipTapOptions = {
  enableInputRules: true,
  enablePasteRules: true,
  enableCoreExtensions: false,
};
```

**File:** packages/core/src/editor/BlockNoteEditor.ts (L309-350)
```typescript
export class BlockNoteEditor<
  BSchema extends BlockSchema = DefaultBlockSchema,
  ISchema extends InlineContentSchema = DefaultInlineContentSchema,
  SSchema extends StyleSchema = DefaultStyleSchema,
> extends EventEmitter<{
  create: void;
}> {
  /**
   * The underlying prosemirror schema
   */
  public readonly pmSchema: Schema;

  public readonly _tiptapEditor: TiptapEditor & {
    contentComponent: any;
  };

  /**
   * Used by React to store a reference to an `ElementRenderer` helper utility to make sure we can render React elements
   * in the correct context (used by `ReactRenderUtil`)
   */
  public elementRenderer: ((node: any, container: HTMLElement) => void) | null =
    null;

  /**
   * Cache of all blocks. This makes sure we don't have to "recompute" blocks if underlying Prosemirror Nodes haven't changed.
   * This is especially useful when we want to keep track of the same block across multiple operations,
   * with this cache, blocks stay the same object reference (referential equality with ===).
   */
  public blockCache: BlockCache = new WeakMap();

  /**
   * The dictionary contains translations for the editor.
   */
  public readonly dictionary: Dictionary & Record<string, any>;

  /**
   * The schema of the editor. The schema defines which Blocks, InlineContent, and Styles are available in the editor.
   */
  public readonly schema: BlockNoteSchema<BSchema, ISchema, SSchema>;

  public readonly blockImplementations: BlockSpecs;
  public readonly inlineContentImplementations: InlineContentSpecs;
```

**File:** packages/core/src/editor/BlockNoteEditor.ts (L572-589)
```typescript
    this._blockManager = new BlockManager(this as any);

    this._exportManager = new ExportManager(this as any);
    this._selectionManager = new SelectionManager(this as any);
    this._stateManager = new StateManager(this as any);
    this._styleManager = new StyleManager(this as any);

    this.emit("create");
  }

  // Manager instances
  private readonly _blockManager: BlockManager<any, any, any>;
  private readonly _eventManager: EventManager<any, any, any>;
  private readonly _exportManager: ExportManager<any, any, any>;
  private readonly _extensionManager: ExtensionManager;
  private readonly _selectionManager: SelectionManager<any, any, any>;
  private readonly _stateManager: StateManager;
  private readonly _styleManager: StyleManager<any, any, any>;
```

**File:** packages/react/src/hooks/useExtension.ts (L1-63)
```typescript
import {
  BlockNoteEditor,
  createStore,
  Extension,
  ExtensionFactory,
} from "@blocknote/core";
import { useStore } from "@tanstack/react-store";
import { useBlockNoteEditor } from "./useBlockNoteEditor.js";

type Store<T> = ReturnType<typeof createStore<T>>;

/**
 * Use an extension instance
 */
export function useExtension<
  const T extends ExtensionFactory | Extension | string,
>(
  plugin: T,
  ctx?: { editor?: BlockNoteEditor<any, any, any> },
): T extends ExtensionFactory
  ? NonNullable<ReturnType<ReturnType<T>>>
  : T extends string
    ? Extension
    : T extends Extension
      ? T
      : never {
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const editor = ctx?.editor ?? useBlockNoteEditor();

  const instance = editor.getExtension(plugin as any);

  if (!instance) {
    throw new Error("Extension not found", { cause: { plugin } });
  }

  return instance;
}

type ExtractStore<T> = T extends Store<infer U> ? U : never;

/**
 * Use the state of an extension
 */
export function useExtensionState<
  T extends ExtensionFactory | Extension,
  TExtension = T extends ExtensionFactory ? ReturnType<ReturnType<T>> : T,
  TStore = TExtension extends { store: Store<any> }
    ? TExtension["store"]
    : never,
  TSelected = NoInfer<ExtractStore<TStore>>,
>(
  plugin: T,
  ctx?: {
    editor?: BlockNoteEditor<any, any, any>;
    selector?: (state: NoInfer<ExtractStore<TStore>>) => TSelected;
  },
): TSelected {
  const { store } = useExtension(plugin, ctx);
  if (!store) {
    throw new Error("Store not found on plugin", { cause: { plugin } });
  }
  return useStore<ExtractStore<TStore>, TSelected>(store, ctx?.selector as any);
}
```

**File:** packages/mantine/src/BlockNoteView.tsx (L82-113)
```typescript
  const view = (
    <ComponentsContext.Provider value={components}>
      <BlockNoteViewRaw
        data-mantine-color-scheme={finalTheme}
        className={mergeCSSClasses("bn-mantine", className || "")}
        theme={typeof theme === "object" ? undefined : theme}
        {...rest}
        ref={ref}
      />
    </ComponentsContext.Provider>
  );

  if (mantineContext) {
    return view;
  }

  return (
    <MantineProvider
      // By default, Mantine adds its CSS variables to the root. This disables
      // that, as we instead set the variables on `.bn-mantine` in
      // `mantineStyles.css`.
      withCssVariables={false}
      // This gets the element to set `data-mantine-color-scheme` on. This
      // element needs to already be rendered, so we can't set it to the
      // editor container element. Instead, we set it to `undefined` and set it
      // manually in `BlockNoteViewRaw`.
      getRootElement={() => undefined}
    >
      {view}
    </MantineProvider>
  );
};
```

**File:** packages/react/src/editor/ComponentsContext.tsx (L64-200)
```typescript
export type ComponentProps = {
  FormattingToolbar: {
    Root: ToolbarRootType;
    Button: ToolbarButtonType;
    Select: ToolbarSelectType;
  };
  FilePanel: {
    Root: {
      className?: string;
      tabs: {
        name: string;
        tabPanel: ReactNode;
      }[];
      openTab: string;
      setOpenTab: (name: string) => void;
      defaultOpenTab: string;
      loading: boolean;
    };
    Button: {
      className?: string;
      onClick: () => void;
    } & (
      | { children: ReactNode; label?: string }
      | { children?: undefined; label: string }
    );
    FileInput: {
      className?: string;
      accept: string;
      value: File | null;
      placeholder: string;
      onChange: (payload: File | null) => void;
    };
    TabPanel: {
      className?: string;
      children?: ReactNode;
    };
    TextInput: {
      className?: string;
      value: string;
      placeholder: string;
      onChange: (event: ChangeEvent<HTMLInputElement>) => void;
      onKeyDown: (event: KeyboardEvent) => void;
    };
  };
  LinkToolbar: {
    Root: ToolbarRootType;
    Button: ToolbarButtonType;
    Select: ToolbarSelectType;
  };
  SideMenu: {
    Root: {
      className?: string;
      children?: ReactNode;
    };
    Button: {
      className?: string;
      onClick?: (e: MouseEvent) => void;
      icon?: ReactNode;
      onDragStart?: (e: React.DragEvent) => void;
      onDragEnd?: (e: React.DragEvent) => void;
      draggable?: boolean;
    } & (
      | { children: ReactNode; label?: string }
      | { children?: undefined; label: string }
    );
  };
  SuggestionMenu: {
    Root: {
      id: string;
      className?: string;
      children?: ReactNode;
    };
    EmptyItem: {
      className?: string;
      children?: ReactNode;
    };
    Item: {
      className?: string;
      id: string;
      isSelected: boolean;
      onClick: () => void;
      item: Omit<DefaultReactSuggestionItem, "onItemClick">;
    };
    Label: {
      className?: string;
      children?: ReactNode;
    };
    Loader: {
      className?: string;
    };
  };
  GridSuggestionMenu: {
    Root: {
      id: string;
      columns: number;
      className?: string;
      children?: ReactNode;
    };
    EmptyItem: {
      columns: number;
      className?: string;
      children?: ReactNode;
    };
    Item: {
      className?: string;
      id: string;
      isSelected: boolean;
      onClick: () => void;
      item: DefaultReactGridSuggestionItem;
    };
    // Label: {
    //   className?: string;
    //   children?: ReactNode;
    // };
    Loader: {
      columns: number;
      className?: string;
      children?: ReactNode;
    };
  };
  TableHandle: {
    Root: {
      className?: string;
      draggable: boolean;
      onDragStart: (e: React.DragEvent) => void;
      onDragEnd: () => void;
      style?: CSSProperties;
    } & (
      | { children: ReactNode; label?: string }
      | { children?: undefined; label: string }
    );
    ExtendButton: {
      className?: string;
      onClick: (e: React.MouseEvent) => void;
      onMouseDown: (e: React.MouseEvent) => void;
      children: ReactNode;
    };
```

**File:** packages/core/src/pm-nodes/README.md (L1-137)
```markdown
### @blocknote/core/src/pm-nodes

Defines the prosemirror nodes and base node structure. See below:

# Block structure

In the BlockNote API, recall that blocks look like this:

```typescript
{
    id: string;
    type: string;
    children: Block[];
    content: InlineContent[] | undefined;
    props: Record<string, any>;
}
```

`children` describes child blocks that have their own `id` and also map to a `Block` type. Most of the cases these are nested blocks, but they can also be blocks within a `column` or `columnList`.

`content` is the block's Inline Content. Inline content doesn't have any `id`, it's "loose" content within the node.

This is a bit different from the Prosemirror structure we use internally. This document describes the Prosemirror schema architecture.

# Node structure

## BlockGroup

```typescript
name: "blockGroup",
group: "childContainer",
content: "blockGroupChild+"
```

A `blockGroup` is a container node that can contain multiple Blocks. It is used as:

- The root node of the Prosemirror document
- When a block has nested children, they are wrapped in a `blockGroup`

## BlockContainer

```typescript
name: "blockContainer",
group: "blockGroupChild bnBlock",
// A block always contains content, and optionally a blockGroup which contains nested blocks
content: "blockContent blockGroup?",
```

A `blockContainer` is a container node that always contains a `blockContent` node, and optionally a `blockGroup` node (for nested children). It is used as the wrapper for most blocks. This structure makes it possible to nest blocks within blocks.

### BlockContent (group)

Example:

```typescript
name: "paragraph", // name corresponds to the block type in the BlockNote API
content: "inline*", // can also be no content (for image blocks)
group: "blockContent",
```

Blocks that are part of the `blockContent` group define the appearance / behaviour of the main element of the block (i.e.: headings, paragraphs, list items, etc.).
These are only used for "regular" blocks that are represented as `blockContainer` nodes.

## Multi-column

The `multi-column` package makes it possible to order blocks side by side in
columns. It adds the `columnList` and `column` nodes to the schema.

### ColumnList

```typescript
name: "columnList",
group: "childContainer bnBlock blockGroupChild",
// A block always contains content, and optionally a blockGroup which contains nested blocks
content: "column column+", // min two columns
```

The column list contains 2 or more columns.

### Column

```typescript
name: "column",
group: "bnBlock childContainer",
// A block always contains content, and optionally a blockGroup which contains nested blocks
content: "blockContainer+",
```

The column contains 1 or more block containers.

# Groups

We use Prosemirror "groups" to help organize this schema. Here is a list of the different groups:

- `blockContent`: described above (contain the content for blocks that are represented as `BlockContainer` nodes)
- `blockGroupChild`: anything that is allowed inside a `blockGroup`. In practice, `blockContainer` and `columnList`
- `childContainer`: think of this as the container node that can hold nodes corresponding to `block.children` in the BlockNote API. So for regular blocks, this is the `BlockGroup`, but for columns, both `columnList` and `column` are considered to be `childContainer` nodes.
- `bnBlock`: think of this as the node that directly maps to a `Block` in the BlockNote API. For example, this node will store the `id`. Both `blockContainer`, `column` and `columnList` are part of this group.

_Note that the last two groups, `bnBlock` and `childContainer`, are not used anywhere in the schema. They are however helpful while programming. For example, we can check whether a node is a `bnBlock`, and then we know it corresponds to a BlockNote Block. Or, we can check whether a node is a `childContainer`, and then we know it's a container of a BlockNote Block's `children`. See `getBlockInfoFromPos` for an example of how this is used._

## Example document

```xml
<blockGroup>
    <blockContaine id="0">
        <blockContent>Parent element 1</blockContent>
        <blockGroup>
            <blockContainer id="1">
                <blockContent>Nested / child / indented item</blockContent>
            </blockContainer>
        </blockGroup>
    </blockContainer>
    <blockContainer id="2">
        <blockContent>Parent element 2</blockContent>
        <blockGroup>
            <blockContainer id="3">...</blockContainer>
            <blockContainer id="4">...</blockContainer>
        </blockGroup>
    </blockContainer>
    <blockContainer id="5">
        <blockContent>Element 3 without children</blockContent>
    </blockContainer>
    <columnList id="6">
        <column id="7">
            <blockContainer id="8">
                <blockContent>Column 1</blockContent>
            </blockContainer>
        </column>
        <column id="9">
            <blockContainer id="10">
                <blockContent>Column 2</blockContent>
            </blockContainer>
        </column>
    </columnList>
</blockGroup>
```
```

**File:** packages/core/src/pm-nodes/BlockContainer.ts (L19-88)
```typescript
export const BlockContainer = Node.create<{
  domAttributes?: BlockNoteDOMAttributes;
  editor: BlockNoteEditor<any, any, any>;
}>({
  name: "blockContainer",
  group: "blockGroupChild bnBlock",
  // A block always contains content, and optionally a blockGroup which contains nested blocks
  content: "blockContent blockGroup?",
  // Ensures content-specific keyboard handlers trigger first.
  priority: 50,
  defining: true,
  marks: "insertion modification deletion",
  parseHTML() {
    return [
      {
        tag: "div[data-node-type=" + this.name + "]",
        getAttrs: (element) => {
          if (typeof element === "string") {
            return false;
          }

          const attrs: Record<string, string> = {};
          for (const [nodeAttr, HTMLAttr] of Object.entries(BlockAttributes)) {
            if (element.getAttribute(HTMLAttr)) {
              attrs[nodeAttr] = element.getAttribute(HTMLAttr)!;
            }
          }

          return attrs;
        },
      },
      // Ignore `blockOuter` divs, but parse the `blockContainer` divs inside them.
      {
        tag: `div[data-node-type="blockOuter"]`,
        skip: true,
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    const blockOuter = document.createElement("div");
    blockOuter.className = "bn-block-outer";
    blockOuter.setAttribute("data-node-type", "blockOuter");
    for (const [attribute, value] of Object.entries(HTMLAttributes)) {
      if (attribute !== "class") {
        blockOuter.setAttribute(attribute, value);
      }
    }

    const blockHTMLAttributes = {
      ...(this.options.domAttributes?.block || {}),
      ...HTMLAttributes,
    };
    const block = document.createElement("div");
    block.className = mergeCSSClasses("bn-block", blockHTMLAttributes.class);
    block.setAttribute("data-node-type", this.name);
    for (const [attribute, value] of Object.entries(blockHTMLAttributes)) {
      if (attribute !== "class") {
        block.setAttribute(attribute, value);
      }
    }

    blockOuter.appendChild(block);

    return {
      dom: blockOuter,
      contentDOM: block,
    };
  },
});
```

**File:** packages/core/src/blocks/defaultBlocks.ts (L38-53)
```typescript
export const defaultBlockSpecs = {
  audio: createAudioBlockSpec(),
  bulletListItem: createBulletListItemBlockSpec(),
  checkListItem: createCheckListItemBlockSpec(),
  codeBlock: createCodeBlockSpec(),
  divider: createDividerBlockSpec(),
  file: createFileBlockSpec(),
  heading: createHeadingBlockSpec(),
  image: createImageBlockSpec(),
  numberedListItem: createNumberedListItemBlockSpec(),
  paragraph: createParagraphBlockSpec(),
  quote: createQuoteBlockSpec(),
  table: createTableBlockSpec(),
  toggleListItem: createToggleListItemBlockSpec(),
  video: createVideoBlockSpec(),
} as const;
```

**File:** packages/core/src/blocks/defaultBlocks.ts (L134-142)
```typescript
export const defaultStyleSpecs = {
  bold: createStyleSpecFromTipTapMark(Bold, "boolean"),
  italic: createStyleSpecFromTipTapMark(Italic, "boolean"),
  underline: createStyleSpecFromTipTapMark(Underline, "boolean"),
  strike: createStyleSpecFromTipTapMark(Strike, "boolean"),
  code: createStyleSpecFromTipTapMark(Code, "boolean"),
  textColor: TextColor,
  backgroundColor: BackgroundColor,
} satisfies StyleSpecs;
```

**File:** packages/core/src/schema/schema.ts (L82-165)
```typescript
  private init() {
    const getPriority = sortByDependencies(
      Object.entries({
        ...this.opts.blockSpecs,
        ...this.opts.inlineContentSpecs,
        ...this.opts.styleSpecs,
      }).map(([key, val]) => ({
        key: key,
        runsBefore: val.implementation?.runsBefore ?? [],
      })),
    );

    const blockSpecs = Object.fromEntries(
      Object.entries(this.opts.blockSpecs).map(([key, blockSpec]) => {
        return [
          key,
          addNodeAndExtensionsToSpec(
            blockSpec.config,
            blockSpec.implementation,
            blockSpec.extensions,
            getPriority(key),
          ),
        ];
      }),
    ) as {
      [K in keyof BSchema]: K extends string
        ? LooseBlockSpec<K, BSchema[K]["propSchema"], BSchema[K]["content"]>
        : never;
    };

    const inlineContentSpecs = Object.fromEntries(
      Object.entries(this.opts.inlineContentSpecs).map(
        ([key, inlineContentSpec]) => {
          // Case for text and links.
          if (typeof inlineContentSpec.config !== "object") {
            return [key, inlineContentSpec];
          }

          return [
            key,
            {
              ...inlineContentSpec,
              implementation: {
                ...inlineContentSpec.implementation,
                node: inlineContentSpec.implementation?.node.extend({
                  priority: getPriority(key),
                }),
              },
            },
          ];
        },
      ),
    ) as InlineContentSpecs;

    const styleSpecs = Object.fromEntries(
      Object.entries(this.opts.styleSpecs).map(([key, styleSpec]) => [
        key,
        {
          ...styleSpec,
          implementation: {
            ...styleSpec.implementation,
            mark: styleSpec.implementation?.mark.extend({
              priority: getPriority(key),
            }),
          },
        },
      ]),
    ) as StyleSpecs;

    return {
      blockSpecs,
      blockSchema: Object.fromEntries(
        Object.entries(blockSpecs).map(([key, blockDef]) => {
          return [key, blockDef.config];
        }),
      ) as any,
      inlineContentSpecs: removeUndefined(inlineContentSpecs),
      styleSpecs: removeUndefined(styleSpecs),
      inlineContentSchema: getInlineContentSchemaFromSpecs(
        inlineContentSpecs,
      ) as any,
      styleSchema: getStyleSchemaFromSpecs(styleSpecs) as any,
    };
  }
```

**File:** packages/core/src/schema/schema.ts (L174-226)
```typescript
  public extend<
    AdditionalBlockSpecs extends BlockSpecs = Record<string, never>,
    AdditionalInlineContentSpecs extends Record<
      string,
      InlineContentSpec<InlineContentConfig>
    > = Record<string, never>,
    AdditionalStyleSpecs extends StyleSpecs = Record<string, never>,
  >(opts: {
    blockSpecs?: AdditionalBlockSpecs;
    inlineContentSpecs?: AdditionalInlineContentSpecs;
    styleSpecs?: AdditionalStyleSpecs;
  }): CustomBlockNoteSchema<
    AdditionalBlockSpecs extends undefined | Record<string, never>
      ? BSchema
      : BSchema & {
          [K in keyof AdditionalBlockSpecs]: K extends string
            ? AdditionalBlockSpecs[K]["config"]
            : never;
        },
    AdditionalInlineContentSpecs extends undefined | Record<string, never>
      ? ISchema
      : ISchema & {
          [K in keyof AdditionalInlineContentSpecs]: AdditionalInlineContentSpecs[K]["config"];
        },
    AdditionalStyleSpecs extends undefined | Record<string, never>
      ? SSchema
      : SSchema & {
          [K in keyof AdditionalStyleSpecs]: AdditionalStyleSpecs[K]["config"];
        }
  > {
    // Merge the new specs with existing ones
    Object.assign(this.opts.blockSpecs, opts.blockSpecs);
    Object.assign(this.opts.inlineContentSpecs, opts.inlineContentSpecs);
    Object.assign(this.opts.styleSpecs, opts.styleSpecs);

    // Reinitialize the block specs with the merged specs
    const {
      blockSpecs,
      inlineContentSpecs,
      styleSpecs,
      blockSchema,
      inlineContentSchema,
      styleSchema,
    } = this.init();
    this.blockSpecs = blockSpecs;
    this.styleSpecs = styleSpecs;
    this.styleSchema = styleSchema;
    this.inlineContentSpecs = inlineContentSpecs;
    this.blockSchema = blockSchema;
    this.inlineContentSchema = inlineContentSchema;

    return this as any;
  }
```

**File:** packages/core/src/editor/BlockNoteExtension.ts (L16-97)
```typescript
export interface Extension<State = any, Key extends string = string> {
  /**
   * The unique identifier for the extension.
   */
  readonly key: Key;

  /**
   * Triggered when the extension is mounted to the editor.
   */
  readonly mount?: (ctx: {
    /**
     * The DOM element that the editor is mounted to.
     */
    dom: HTMLElement;
    /**
     * The root document of the {@link document} that the editor is mounted to.
     */
    root: Document | ShadowRoot;
    /**
     * An {@link AbortSignal} that will be aborted when the extension is destroyed.
     */
    signal: AbortSignal;
  }) => void | OnDestroy;

  /**
   * The store for the extension.
   */
  readonly store?: Store<State>;

  /**
   * Declares what {@link Extension}s that this extension depends on.
   */
  readonly runsBefore?: ReadonlyArray<string>;

  /**
   * Input rules for a block: An input rule is what is used to replace text in a block when a regular expression match is found.
   * As an example, typing `#` in a paragraph block will trigger an input rule to replace the text with a heading block.
   */
  readonly inputRules?: ReadonlyArray<InputRule>;

  /**
   * A mapping of a keyboard shortcut to a function that will be called when the shortcut is pressed
   *
   * The keys are in the format:
   * - Key names may be strings like `Shift-Ctrl-Enter`—a key identifier prefixed with zero or more modifiers
   * - Key identifiers are based on the strings that can appear in KeyEvent.key
   * - Use lowercase letters to refer to letter keys (or uppercase letters if you want shift to be held)
   * - You may use `Space` as an alias for the " " name
   * - Modifiers can be given in any order: `Shift-` (or `s-`), `Alt-` (or `a-`), `Ctrl-` (or `c-` or `Control-`) and `Cmd-` (or `m-` or `Meta-`)
   * - For characters that are created by holding shift, the Shift- prefix is implied, and should not be added explicitly
   * - You can use Mod- as a shorthand for Cmd- on Mac and Ctrl- on other platforms
   *
   * @example
   * ```typescript
   * keyboardShortcuts: {
   *   "Mod-Enter": (ctx) => {  return true; },
   *   "Shift-Ctrl-Space": (ctx) => { return true; },
   *   "a": (ctx) => { return true; },
   *   "Space": (ctx) => { return true; }
   * }
   * ```
   */
  readonly keyboardShortcuts?: Record<
    string,
    (ctx: { editor: BlockNoteEditor<any, any, any> }) => boolean
  >;

  /**
   * Add additional prosemirror plugins to the editor.
   */
  readonly prosemirrorPlugins?: ReadonlyArray<ProsemirrorPlugin>;

  /**
   * Add additional tiptap extensions to the editor.
   */
  readonly tiptapExtensions?: ReadonlyArray<AnyExtension>;

  /**
   * Add additional BlockNote extensions to the editor.
   */
  readonly blockNoteExtensions?: ReadonlyArray<ExtensionFactoryInstance>;
}
```

**File:** packages/core/src/editor/BlockNoteExtension.ts (L182-234)
```typescript
// This overload is for `createExtension({ key: "test", ... })`
export function createExtension<
  const State = any,
  const Key extends string = string,
  const Ext extends Extension<State, Key> = Extension<State, Key>,
>(factory: Ext): ExtensionFactoryInstance<Ext>;
// This overload is for `createExtension(({editor, options}) => ({ key: "test", ... }))`
export function createExtension<
  const State = any,
  const Options extends Record<string, any> | undefined = any,
  const Key extends string = string,
  const Factory extends (ctx: any) => Extension<State, Key> = (
    ctx: ExtensionOptions<Options>,
  ) => Extension<State, Key>,
>(factory: Factory): ExtensionFactory<State, Key, Factory>;
// This overload is for both of the above overloads as it is the implementation of the function
export function createExtension<
  const State = any,
  const Options extends Record<string, any> | undefined = any,
  const Key extends string = string,
  const Factory extends
    | Extension<State, Key>
    | ((ctx: any) => Extension<State, Key>) = (
    ctx: ExtensionOptions<Options>,
  ) => Extension<State, Key>,
>(
  factory: Factory,
): Factory extends Extension<State, Key>
  ? ExtensionFactoryInstance<Factory>
  : Factory extends (ctx: any) => Extension<State, Key>
    ? ExtensionFactory<State, Key, Factory>
    : never {
  if (typeof factory === "object" && "key" in factory) {
    return function factoryFn() {
      (factory as any)[originalFactorySymbol] = factoryFn;
      return factory;
    } as any;
  }

  if (typeof factory !== "function") {
    throw new Error("factory must be a function");
  }

  return function factoryFn(options: Options) {
    return (ctx: { editor: BlockNoteEditor<any, any, any> }) => {
      const extension = factory({ editor: ctx.editor, options });
      // We stick a symbol onto the extension to allow us to retrieve the original factory for comparison later.
      // This enables us to do things like: `editor.getExtension(YSync).prosemirrorPlugins`
      (extension as any)[originalFactorySymbol] = factoryFn;
      return extension;
    };
  } as any;
}
```

**File:** packages/core/src/editor/managers/ExtensionManager/extensions.ts (L58-168)
```typescript
export function getDefaultTiptapExtensions(
  editor: BlockNoteEditor<any, any, any>,
  options: BlockNoteEditorOptions<any, any, any>,
) {
  const tiptapExtensions: AnyTiptapExtension[] = [
    extensions.ClipboardTextSerializer,
    extensions.Commands,
    extensions.Editable,
    extensions.FocusEvents,
    extensions.Tabindex,
    Gapcursor,

    UniqueID.configure({
      // everything from bnBlock group (nodes that represent a BlockNote block should have an id)
      types: ["blockContainer", "columnList", "column"],
      setIdAttribute: options.setIdAttribute,
    }),
    HardBreak,
    Text,

    // marks:
    SuggestionAddMark,
    SuggestionDeleteMark,
    SuggestionModificationMark,
    Link.extend({
      inclusive: false,
    }).configure({
      defaultProtocol: DEFAULT_LINK_PROTOCOL,
      // only call this once if we have multiple editors installed. Or fix https://github.com/ueberdosis/tiptap/issues/5450
      protocols: LINKIFY_INITIALIZED ? [] : VALID_LINK_PROTOCOLS,
    }),
    ...(Object.values(editor.schema.styleSpecs).map((styleSpec) => {
      return styleSpec.implementation.mark.configure({
        editor: editor,
      });
    }) as any[]),

    TextColorExtension,

    BackgroundColorExtension,
    TextAlignmentExtension,

    // make sure escape blurs editor, so that we can tab to other elements in the host page (accessibility)
    TiptapExtension.create({
      name: "OverrideEscape",
      addKeyboardShortcuts: () => {
        return {
          Escape: () => {
            if (editor.getExtension(SuggestionMenu)?.shown()) {
              // escape should close the suggestion menu, but not blur the editor
              return false;
            }
            editor.blur();
            return true;
          },
        };
      },
    }),

    // nodes
    Doc,
    BlockContainer.configure({
      editor: editor,
      domAttributes: options.domAttributes,
    }),
    KeyboardShortcutsExtension.configure({
      editor: editor,
      tabBehavior: options.tabBehavior,
    }),
    BlockGroup.configure({
      domAttributes: options.domAttributes,
    }),
    ...Object.values(editor.schema.inlineContentSpecs)
      .filter((a) => a.config !== "link" && a.config !== "text")
      .map((inlineContentSpec) => {
        return inlineContentSpec.implementation!.node.configure({
          editor: editor,
        });
      }),

    ...Object.values(editor.schema.blockSpecs).flatMap((blockSpec) => {
      return [
        // the node extension implementations
        ...("node" in blockSpec.implementation
          ? [
              (blockSpec.implementation.node as Node).configure({
                editor: editor,
                domAttributes: options.domAttributes,
              }),
            ]
          : []),
      ];
    }),
    createCopyToClipboardExtension(editor),
    createPasteFromClipboardExtension(
      editor,
      options.pasteHandler ||
        ((context: {
          defaultPasteHandler: (context?: {
            prioritizeMarkdownOverHTML?: boolean;
            plainTextAsMarkdown?: boolean;
          }) => boolean | undefined;
        }) => context.defaultPasteHandler()),
    ),
    createDropFileExtension(editor),
  ];

  LINKIFY_INITIALIZED = true;

  return tiptapExtensions;
}
```

**File:** packages/core/src/editor/managers/ExtensionManager/extensions.ts (L170-204)
```typescript
export function getDefaultExtensions(
  editor: BlockNoteEditor<any, any, any>,
  options: BlockNoteEditorOptions<any, any, any>,
) {
  const extensions = [
    BlockChangeExtension(),
    DropCursorExtension(options),
    FilePanelExtension(options),
    FormattingToolbarExtension(options),
    LinkToolbarExtension(options),
    NodeSelectionKeyboardExtension(),
    PlaceholderExtension(options),
    ShowSelectionExtension(options),
    SideMenuExtension(options),
    SuggestionMenu(options),
    ...(options.trailingBlock !== false ? [TrailingNodeExtension()] : []),
  ] as ExtensionFactoryInstance[];

  if (options.collaboration) {
    extensions.push(CollaborationExtension(options.collaboration));
  } else {
    // YUndo is not compatible with ProseMirror's history plugin
    extensions.push(HistoryExtension());
  }

  if ("table" in editor.schema.blockSpecs) {
    extensions.push(TableHandlesExtension(options));
  }

  if (options.animations !== false) {
    extensions.push(PreviousBlockTypeExtension());
  }

  return extensions;
}
```

**File:** packages/core/src/editor/managers/ExtensionManager/index.ts (L52-100)
```typescript
  constructor(
    private editor: BlockNoteEditor<any, any, any>,
    private options: BlockNoteEditorOptions<any, any, any>,
  ) {
    /**
     * When the editor is first mounted, we need to initialize all the extensions
     */
    editor.onMount(() => {
      for (const extension of this.extensions) {
        // If the extension has an init function, we can initialize it, otherwise, it is already added to the editor
        if (extension.mount) {
          // We create an abort controller for each extension, so that we can abort the extension when the editor is unmounted
          const abortController = new window.AbortController();
          const unmountCallback = extension.mount({
            dom: editor.prosemirrorView.dom,
            root: editor.prosemirrorView.root,
            signal: abortController.signal,
          });
          // If the extension returns a method to unmount it, we can register it to be called when the abort controller is aborted
          if (unmountCallback) {
            abortController.signal.addEventListener("abort", () => {
              unmountCallback();
            });
          }
          // Keep track of the abort controller for each extension, so that we can abort it when the editor is unmounted
          this.abortMap.set(extension, abortController);
        }
      }
    });

    /**
     * When the editor is unmounted, we need to abort all the extensions' abort controllers
     */
    editor.onUnmount(() => {
      for (const [extension, abortController] of this.abortMap.entries()) {
        // No longer track the abort controller for this extension
        this.abortMap.delete(extension);
        // Abort each extension's abort controller
        abortController.abort();
      }
    });

    // TODO do disabled extensions need to be only for editor base extensions? Or all of them?
    this.disabledExtensions = new Set(options.disableExtensions || []);

    // Add the default extensions
    for (const extension of getDefaultExtensions(this.editor, this.options)) {
      this.addExtension(extension);
    }
```

**File:** packages/core/src/schema/blocks/types.ts (L63-100)
```typescript
/**
 * BlockConfig contains the "schema" info about a Block type
 * i.e. what props it supports, what content it supports, etc.
 */
export interface BlockConfig<
  T extends string = string,
  PS extends PropSchema = PropSchema,
  C extends "inline" | "none" | "table" = "inline" | "none" | "table",
> {
  /**
   * The type of the block (unique identifier within a schema)
   */
  type: T;
  /**
   * The properties that the block supports
   * @todo will be zod schema in the future
   */
  readonly propSchema: PS;
  /**
   * The content that the block supports
   */
  content: C;
  // TODO: how do you represent things that have nested content?
  // e.g. tables, alerts (with title & content)
}

// restrict content to "inline" and "none" only
export type CustomBlockConfig<
  T extends string = string,
  PS extends PropSchema = PropSchema,
  C extends "inline" | "none" = "inline" | "none",
> = BlockConfig<T, PS, C>;

// A Spec contains both the Config and Implementation
export type BlockSpec<
  T extends string = string,
  PS extends PropSchema = PropSchema,
  C extends "inline" | "none" | "table" = "inline" | "none" | "table",
```

**File:** packages/core/src/blocks/Image/block.ts (L23-190)
```typescript
export const createImageBlockConfig = createBlockConfig(
  (_ctx: ImageOptions = {}) =>
    ({
      type: "image" as const,
      propSchema: {
        textAlignment: defaultProps.textAlignment,
        backgroundColor: defaultProps.backgroundColor,
        // File name.
        name: {
          default: "" as const,
        },
        // File url.
        url: {
          default: "" as const,
        },
        // File caption.
        caption: {
          default: "" as const,
        },

        showPreview: {
          default: true,
        },
        // File preview width in px.
        previewWidth: {
          default: undefined,
          type: "number" as const,
        },
      },
      content: "none" as const,
    }) as const,
);

export const imageParse =
  (_config: ImageOptions = {}) =>
  (element: HTMLElement) => {
    if (element.tagName === "IMG") {
      // Ignore if parent figure has already been parsed.
      if (element.closest("figure")) {
        return undefined;
      }

      const { backgroundColor } = parseDefaultProps(element);

      return {
        ...parseImageElement(element as HTMLImageElement),
        backgroundColor,
      };
    }

    if (element.tagName === "FIGURE") {
      const parsedFigure = parseFigureElement(element, "img");
      if (!parsedFigure) {
        return undefined;
      }

      const { targetElement, caption } = parsedFigure;

      const { backgroundColor } = parseDefaultProps(element);

      return {
        ...parseImageElement(targetElement as HTMLImageElement),
        backgroundColor,
        caption,
      };
    }

    return undefined;
  };

export const imageRender =
  (config: ImageOptions = {}) =>
  (
    block: BlockFromConfig<ReturnType<typeof createImageBlockConfig>, any, any>,
    editor: BlockNoteEditor<
      Record<"image", ReturnType<typeof createImageBlockConfig>>,
      any,
      any
    >,
  ) => {
    const icon = document.createElement("div");
    icon.innerHTML = config.icon ?? FILE_IMAGE_ICON_SVG;

    const imageWrapper = document.createElement("div");
    imageWrapper.className = "bn-visual-media-wrapper";

    const image = document.createElement("img");
    image.className = "bn-visual-media";
    if (editor.resolveFileUrl) {
      editor.resolveFileUrl(block.props.url).then((downloadUrl) => {
        image.src = downloadUrl;
      });
    } else {
      image.src = block.props.url;
    }

    image.alt = block.props.name || block.props.caption || "BlockNote image";
    image.contentEditable = "false";
    image.draggable = false;
    imageWrapper.appendChild(image);

    return createResizableFileBlockWrapper(
      block,
      editor,
      { dom: imageWrapper },
      imageWrapper,
      icon.firstElementChild as HTMLElement,
    );
  };

export const imageToExternalHTML =
  (_config: ImageOptions = {}) =>
  (
    block: BlockFromConfig<ReturnType<typeof createImageBlockConfig>, any, any>,
    _editor: BlockNoteEditor<
      Record<"image", ReturnType<typeof createImageBlockConfig>>,
      any,
      any
    >,
  ) => {
    if (!block.props.url) {
      const div = document.createElement("p");
      div.textContent = "Add image";

      return {
        dom: div,
      };
    }

    let image;
    if (block.props.showPreview) {
      image = document.createElement("img");
      image.src = block.props.url;
      image.alt = block.props.name || block.props.caption || "BlockNote image";
      if (block.props.previewWidth) {
        image.width = block.props.previewWidth;
      }
    } else {
      image = document.createElement("a");
      image.href = block.props.url;
      image.textContent = block.props.name || block.props.url;
    }

    if (block.props.caption) {
      if (block.props.showPreview) {
        return createFigureWithCaption(image, block.props.caption);
      } else {
        return createLinkWithCaption(image, block.props.caption);
      }
    }

    return {
      dom: image,
    };
  };

export const createImageBlockSpec = createBlockSpec(
  createImageBlockConfig,
  (config) => ({
    meta: {
      fileBlockAccept: ["image/*"],
    },
    parse: imageParse(config),
    render: imageRender(config),
    toExternalHTML: imageToExternalHTML(config),
    runsBefore: ["file"],
  }),
);
```

**File:** packages/react/src/blocks/Image/block.tsx (L1-107)
```typescript
import { createImageBlockConfig, imageParse } from "@blocknote/core";
import { RiImage2Fill } from "react-icons/ri";

import {
  createReactBlockSpec,
  ReactCustomBlockRenderProps,
} from "../../schema/ReactBlockSpec.js";
import { useResolveUrl } from "../File/useResolveUrl.js";
import { FigureWithCaption } from "../File/helpers/toExternalHTML/FigureWithCaption.js";
import { ResizableFileBlockWrapper } from "../File/helpers/render/ResizableFileBlockWrapper.js";
import { LinkWithCaption } from "../File/helpers/toExternalHTML/LinkWithCaption.js";

export const ImagePreview = (
  props: Omit<
    ReactCustomBlockRenderProps<
      ReturnType<typeof createImageBlockConfig>["type"],
      ReturnType<typeof createImageBlockConfig>["propSchema"],
      ReturnType<typeof createImageBlockConfig>["content"]
    >,
    "contentRef"
  >,
) => {
  const resolved = useResolveUrl(props.block.props.url!);

  return (
    <img
      className={"bn-visual-media"}
      src={
        resolved.loadingState === "loading"
          ? props.block.props.url
          : resolved.downloadUrl
      }
      alt={props.block.props.caption || "BlockNote image"}
      contentEditable={false}
      draggable={false}
    />
  );
};

export const ImageToExternalHTML = (
  props: Omit<
    ReactCustomBlockRenderProps<
      ReturnType<typeof createImageBlockConfig>["type"],
      ReturnType<typeof createImageBlockConfig>["propSchema"],
      ReturnType<typeof createImageBlockConfig>["content"]
    >,
    "contentRef"
  >,
) => {
  if (!props.block.props.url) {
    return <p>Add image</p>;
  }

  const image = props.block.props.showPreview ? (
    <img
      src={props.block.props.url}
      alt={
        props.block.props.name || props.block.props.caption || "BlockNote image"
      }
      width={props.block.props.previewWidth}
    />
  ) : (
    <a href={props.block.props.url}>
      {props.block.props.name || props.block.props.url}
    </a>
  );

  if (props.block.props.caption) {
    return props.block.props.showPreview ? (
      <FigureWithCaption caption={props.block.props.caption}>
        {image}
      </FigureWithCaption>
    ) : (
      <LinkWithCaption caption={props.block.props.caption}>
        {image}
      </LinkWithCaption>
    );
  }

  return image;
};

export const ImageBlock = (
  props: ReactCustomBlockRenderProps<
    ReturnType<typeof createImageBlockConfig>["type"],
    ReturnType<typeof createImageBlockConfig>["propSchema"],
    ReturnType<typeof createImageBlockConfig>["content"]
  >,
) => {
  return (
    <ResizableFileBlockWrapper
      {...(props as any)}
      buttonIcon={<RiImage2Fill size={24} />}
    >
      <ImagePreview {...(props as any)} />
    </ResizableFileBlockWrapper>
  );
};

export const ReactImageBlock = createReactBlockSpec(
  createImageBlockConfig,
  (config) => ({
    render: ImageBlock,
    parse: imageParse(config),
    toExternalHTML: ImageToExternalHTML,
  }),
);
```

**File:** packages/core/src/extensions/FormattingToolbar/FormattingToolbar.ts (L1-119)
```typescript
import { NodeSelection, TextSelection } from "prosemirror-state";

import {
  createExtension,
  createStore,
} from "../../editor/BlockNoteExtension.js";

export const FormattingToolbarExtension = createExtension(({ editor }) => {
  const store = createStore(false);

  const shouldShow = () => {
    return editor.transact((tr) => {
      // Don't show if the selection is empty, or is a text selection with no
      // text.
      if (tr.selection.empty) {
        return false;
      }

      // Don't show if a block with inline content is selected.
      if (
        tr.selection instanceof NodeSelection &&
        (tr.selection.node.type.spec.content === "inline*" ||
          tr.selection.node.firstChild?.type.spec.content === "inline*")
      ) {
        return false;
      }

      // Don't show if the selection is a text selection but contains no text.
      if (
        tr.selection instanceof TextSelection &&
        tr.doc.textBetween(tr.selection.from, tr.selection.to).length === 0
      ) {
        return false;
      }

      // Searches the content of the selection to see if it spans a node with a
      // code spec.
      let spansCode = false;
      tr.selection.content().content.descendants((node) => {
        if (node.type.spec.code) {
          spansCode = true;
        }
        return !spansCode; // keep descending if we haven't found a code block
      });

      // Don't show if the selection spans a code block.
      if (spansCode) {
        return false;
      }

      // Show toolbar otherwise.
      return true;
    });
  };

  return {
    key: "formattingToolbar",
    store,
    mount({ dom, signal }) {
      /**
       * We want to mimic the Notion behavior of not showing the toolbar while the user is holding down the mouse button (to create a selection)
       */
      let preventShowWhileMouseDown = false;

      const unsubscribeOnChange = editor.onChange(() => {
        if (preventShowWhileMouseDown) {
          return;
        }
        // re-evaluate whether the toolbar should be shown
        store.setState(shouldShow());
      });
      const unsubscribeOnSelectionChange = editor.onSelectionChange(() => {
        if (preventShowWhileMouseDown) {
          return;
        }
        // re-evaluate whether the toolbar should be shown
        store.setState(shouldShow());
      });

      // To mimic Notion's behavior, we listen to the mouse down event to set the `preventShowWhileMouseDown` flag
      dom.addEventListener(
        "pointerdown",
        () => {
          preventShowWhileMouseDown = true;
          store.setState(false);
        },
        { signal },
      );
      // To mimic Notion's behavior, we listen to the mouse up event to reset the `preventShowWhileMouseDown` flag and show the toolbar (if it should)
      editor.prosemirrorView.root.addEventListener(
        "pointerup",
        () => {
          preventShowWhileMouseDown = false;
          // We only want to re-show the toolbar if the mouse made the selection
          if (editor.isFocused()) {
            store.setState(shouldShow());
          }
        },
        { signal, capture: true },
      );
      // If the pointer gets cancelled, we don't want to be stuck in the `preventShowWhileMouseDown` state
      dom.addEventListener(
        "pointercancel",
        () => {
          preventShowWhileMouseDown = false;
        },
        {
          signal,
          capture: true,
        },
      );

      signal.addEventListener("abort", () => {
        unsubscribeOnChange();
        unsubscribeOnSelectionChange();
      });
    },
  } as const;
});
```

**File:** packages/react/src/components/FormattingToolbar/FormattingToolbarController.tsx (L1-115)
```typescript
import {
  blockHasType,
  BlockSchema,
  defaultProps,
  DefaultProps,
  InlineContentSchema,
  StyleSchema,
} from "@blocknote/core";
import { FormattingToolbarExtension } from "@blocknote/core/extensions";
import { flip, offset, shift } from "@floating-ui/react";
import { FC, useMemo } from "react";

import { useBlockNoteEditor } from "../../hooks/useBlockNoteEditor.js";
import { useEditorState } from "../../hooks/useEditorState.js";
import { useExtension, useExtensionState } from "../../hooks/useExtension.js";
import { FloatingUIOptions } from "../Popovers/FloatingUIOptions.js";
import { PositionPopover } from "../Popovers/PositionPopover.js";
import { FormattingToolbar } from "./FormattingToolbar.js";
import { FormattingToolbarProps } from "./FormattingToolbarProps.js";

const textAlignmentToPlacement = (
  textAlignment: DefaultProps["textAlignment"],
) => {
  switch (textAlignment) {
    case "left":
      return "top-start";
    case "center":
      return "top";
    case "right":
      return "top-end";
    default:
      return "top-start";
  }
};

export const FormattingToolbarController = (props: {
  formattingToolbar?: FC<FormattingToolbarProps>;
  floatingUIOptions?: FloatingUIOptions;
}) => {
  const editor = useBlockNoteEditor<
    BlockSchema,
    InlineContentSchema,
    StyleSchema
  >();
  const formattingToolbar = useExtension(FormattingToolbarExtension, {
    editor,
  });
  const show = useExtensionState(FormattingToolbarExtension, {
    editor,
  });

  const position = useEditorState({
    editor,
    selector: ({ editor }) =>
      formattingToolbar.store.state
        ? {
            from: editor.prosemirrorState.selection.from,
            to: editor.prosemirrorState.selection.to,
          }
        : undefined,
  });

  const placement = useEditorState({
    editor,
    selector: ({ editor }) => {
      const block = editor.getTextCursorPosition().block;

      if (
        !blockHasType(block, editor, block.type, {
          textAlignment: defaultProps.textAlignment,
        })
      ) {
        return "top-start";
      } else {
        return textAlignmentToPlacement(block.props.textAlignment);
      }
    },
  });

  const floatingUIOptions = useMemo<FloatingUIOptions>(
    () => ({
      ...props.floatingUIOptions,
      useFloatingOptions: {
        open: show,
        // Needed as hooks like `useDismiss` call `onOpenChange` to change the
        // open state.
        onOpenChange: (open, _event, reason) => {
          formattingToolbar.store.setState(open);

          if (reason === "escape-key") {
            editor.focus();
          }
        },
        placement,
        middleware: [offset(10), shift(), flip()],
        ...props.floatingUIOptions?.useFloatingOptions,
      },
      elementProps: {
        style: {
          zIndex: 40,
        },
        ...props.floatingUIOptions?.elementProps,
      },
    }),
    [show, placement, props.floatingUIOptions, formattingToolbar.store, editor],
  );

  const Component = props.formattingToolbar || FormattingToolbar;

  return (
    <PositionPopover position={position} {...floatingUIOptions}>
      {show && <Component />}
    </PositionPopover>
  );
};
```

**File:** packages/core/src/extensions/SuggestionMenu/SuggestionMenu.ts (L164-215)
```typescript
export const SuggestionMenu = createExtension(({ editor }) => {
  const triggerCharacters: string[] = [];
  let view: SuggestionMenuView | undefined = undefined;
  const store = createStore<
    (SuggestionMenuState & { triggerCharacter: string }) | undefined
  >(undefined);
  return {
    key: "suggestionMenu",
    store,
    addTriggerCharacter: (triggerCharacter: string) => {
      triggerCharacters.push(triggerCharacter);
    },
    removeTriggerCharacter: (triggerCharacter: string) => {
      triggerCharacters.splice(triggerCharacters.indexOf(triggerCharacter), 1);
    },
    closeMenu: () => {
      view?.closeMenu();
    },
    clearQuery: () => {
      view?.clearQuery();
    },
    shown: () => {
      return view?.state?.show || false;
    },
    openSuggestionMenu: (
      triggerCharacter: string,
      pluginState?: {
        deleteTriggerCharacter?: boolean;
        ignoreQueryLength?: boolean;
      },
    ) => {
      if (editor.headless) {
        return;
      }

      editor.focus();

      editor.transact((tr) => {
        if (pluginState?.deleteTriggerCharacter) {
          tr.insertText(triggerCharacter);
        }
        tr.scrollIntoView().setMeta(suggestionMenuPluginKey, {
          triggerCharacter: triggerCharacter,
          deleteTriggerCharacter: pluginState?.deleteTriggerCharacter || false,
          ignoreQueryLength: pluginState?.ignoreQueryLength || false,
        });
      });
    },
    // TODO this whole plugin needs to be refactored (but I've done the minimal)
    prosemirrorPlugins: [
      new Plugin({
        key: suggestionMenuPluginKey,
```

**File:** packages/core/src/extensions/SuggestionMenu/SuggestionMenu.ts (L230-350)
```typescript
          init(): SuggestionPluginState {
            return undefined;
          },

          // Apply changes to the plugin state from an editor transaction.
          apply: (
            transaction,
            prev,
            _oldState,
            newState,
          ): SuggestionPluginState => {
            // Ignore transactions in code blocks.
            if (transaction.selection.$from.parent.type.spec.code) {
              return prev;
            }

            // Either contains the trigger character if the menu should be shown,
            // or null if it should be hidden.
            const suggestionPluginTransactionMeta: {
              triggerCharacter: string;
              deleteTriggerCharacter?: boolean;
              ignoreQueryLength?: boolean;
            } | null = transaction.getMeta(suggestionMenuPluginKey);

            if (
              typeof suggestionPluginTransactionMeta === "object" &&
              suggestionPluginTransactionMeta !== null
            ) {
              if (prev) {
                // Close the previous menu if it exists
                view?.closeMenu();
              }
              const trackedPosition = trackPosition(
                editor,
                newState.selection.from -
                  // Need to account for the trigger char that was inserted, so we offset the position by the length of the trigger character.
                  suggestionPluginTransactionMeta.triggerCharacter.length,
              );
              return {
                triggerCharacter:
                  suggestionPluginTransactionMeta.triggerCharacter,
                deleteTriggerCharacter:
                  suggestionPluginTransactionMeta.deleteTriggerCharacter !==
                  false,
                // When reading the queryStartPos, we offset the result by the length of the trigger character, to make it easy on the caller
                queryStartPos: () =>
                  trackedPosition() +
                  suggestionPluginTransactionMeta.triggerCharacter.length,
                query: "",
                decorationId: `id_${Math.floor(Math.random() * 0xffffffff)}`,
                ignoreQueryLength:
                  suggestionPluginTransactionMeta?.ignoreQueryLength,
              };
            }

            // Checks if the menu is hidden, in which case it doesn't need to be hidden or updated.
            if (prev === undefined) {
              return prev;
            }

            // Checks if the menu should be hidden.
            if (
              // Highlighting text should hide the menu.
              newState.selection.from !== newState.selection.to ||
              // Transactions with plugin metadata should hide the menu.
              suggestionPluginTransactionMeta === null ||
              // Certain mouse events should hide the menu.
              // TODO: Change to global mousedown listener.
              transaction.getMeta("focus") ||
              transaction.getMeta("blur") ||
              transaction.getMeta("pointer") ||
              // Moving the caret before the character which triggered the menu should hide it.
              (prev.triggerCharacter !== undefined &&
                newState.selection.from < prev.queryStartPos()) ||
              // Moving the caret to a new block should hide the menu.
              !newState.selection.$from.sameParent(
                newState.doc.resolve(prev.queryStartPos()),
              )
            ) {
              return undefined;
            }

            const next = { ...prev };

            // Updates the current query.
            next.query = newState.doc.textBetween(
              prev.queryStartPos(),
              newState.selection.from,
            );

            return next;
          },
        },

        props: {
          handleTextInput(view, from, to, text) {
            // only on insert
            if (from === to) {
              const doc = view.state.doc;
              for (const str of triggerCharacters) {
                const snippet =
                  str.length > 1
                    ? doc.textBetween(from - str.length, from) + text
                    : text;

                if (str === snippet) {
                  view.dispatch(view.state.tr.insertText(text));
                  view.dispatch(
                    view.state.tr
                      .setMeta(suggestionMenuPluginKey, {
                        triggerCharacter: snippet,
                      })
                      .scrollIntoView(),
                  );
                  return true;
                }
              }
            }
            return false;
          },

```

**File:** packages/core/src/extensions/SuggestionMenu/getDefaultSlashMenuItems.ts (L84-200)
```typescript
export function getDefaultSlashMenuItems<
  BSchema extends BlockSchema,
  I extends InlineContentSchema,
  S extends StyleSchema,
>(editor: BlockNoteEditor<BSchema, I, S>) {
  const items: DefaultSuggestionItem[] = [];

  if (editorHasBlockWithType(editor, "heading", { level: "number" })) {
    (editor.schema.blockSchema.heading.propSchema.level.values || [])
      .filter((level): level is 1 | 2 | 3 => level <= 3)
      .forEach((level) => {
        items.push({
          onItemClick: () => {
            insertOrUpdateBlockForSlashMenu(editor, {
              type: "heading",
              props: { level: level },
            });
          },
          badge: formatKeyboardShortcut(`Mod-Alt-${level}`),
          key:
            level === 1 ? ("heading" as const) : (`heading_${level}` as const),
          ...editor.dictionary.slash_menu[
            level === 1 ? ("heading" as const) : (`heading_${level}` as const)
          ],
        });
      });
  }

  if (editorHasBlockWithType(editor, "quote")) {
    items.push({
      onItemClick: () => {
        insertOrUpdateBlockForSlashMenu(editor, {
          type: "quote",
        });
      },
      key: "quote",
      ...editor.dictionary.slash_menu.quote,
    });
  }

  if (editorHasBlockWithType(editor, "toggleListItem")) {
    items.push({
      onItemClick: () => {
        insertOrUpdateBlockForSlashMenu(editor, {
          type: "toggleListItem",
        });
      },
      badge: formatKeyboardShortcut("Mod-Shift-6"),
      key: "toggle_list",
      ...editor.dictionary.slash_menu.toggle_list,
    });
  }

  if (editorHasBlockWithType(editor, "numberedListItem")) {
    items.push({
      onItemClick: () => {
        insertOrUpdateBlockForSlashMenu(editor, {
          type: "numberedListItem",
        });
      },
      badge: formatKeyboardShortcut("Mod-Shift-7"),
      key: "numbered_list",
      ...editor.dictionary.slash_menu.numbered_list,
    });
  }

  if (editorHasBlockWithType(editor, "bulletListItem")) {
    items.push({
      onItemClick: () => {
        insertOrUpdateBlockForSlashMenu(editor, {
          type: "bulletListItem",
        });
      },
      badge: formatKeyboardShortcut("Mod-Shift-8"),
      key: "bullet_list",
      ...editor.dictionary.slash_menu.bullet_list,
    });
  }

  if (editorHasBlockWithType(editor, "checkListItem")) {
    items.push({
      onItemClick: () => {
        insertOrUpdateBlockForSlashMenu(editor, {
          type: "checkListItem",
        });
      },
      badge: formatKeyboardShortcut("Mod-Shift-9"),
      key: "check_list",
      ...editor.dictionary.slash_menu.check_list,
    });
  }

  if (editorHasBlockWithType(editor, "paragraph")) {
    items.push({
      onItemClick: () => {
        insertOrUpdateBlockForSlashMenu(editor, {
          type: "paragraph",
        });
      },
      badge: formatKeyboardShortcut("Mod-Alt-0"),
      key: "paragraph",
      ...editor.dictionary.slash_menu.paragraph,
    });
  }

  if (editorHasBlockWithType(editor, "codeBlock")) {
    items.push({
      onItemClick: () => {
        insertOrUpdateBlockForSlashMenu(editor, {
          type: "codeBlock",
        });
      },
      badge: formatKeyboardShortcut("Mod-Alt-c"),
      key: "code_block",
      ...editor.dictionary.slash_menu.code_block,
    });
  }
```

**File:** packages/react/src/components/SuggestionMenu/SuggestionMenuController.tsx (L23-174)
```typescript
export function SuggestionMenuController<
  // This is a bit hacky, but only way I found to make types work so the optionality
  // of suggestionMenuComponent depends on the return type of getItems
  GetItemsType extends (query: string) => Promise<any[]> = (
    query: string,
  ) => Promise<DefaultReactSuggestionItem[]>,
>(
  props: {
    triggerCharacter: string;
    getItems?: GetItemsType;
    minQueryLength?: number;
    floatingUIOptions?: FloatingUIOptions;
  } & (ItemType<GetItemsType> extends DefaultReactSuggestionItem
    ? {
        // can be undefined
        suggestionMenuComponent?: FC<
          SuggestionMenuProps<ItemType<GetItemsType>>
        >;
        onItemClick?: (item: ItemType<GetItemsType>) => void;
      }
    : {
        // getItems doesn't return DefaultSuggestionItem, so suggestionMenuComponent is required
        suggestionMenuComponent: FC<
          SuggestionMenuProps<ItemType<GetItemsType>>
        >;
        onItemClick: (item: ItemType<GetItemsType>) => void;
      }),
) {
  const editor = useBlockNoteEditor<
    BlockSchema,
    InlineContentSchema,
    StyleSchema
  >();

  const {
    triggerCharacter,
    suggestionMenuComponent,
    minQueryLength,
    onItemClick,
    getItems,
  } = props;

  const onItemClickOrDefault = useMemo(() => {
    return (
      onItemClick ||
      ((item: ItemType<GetItemsType>) => {
        item.onItemClick(editor);
      })
    );
  }, [editor, onItemClick]);

  const getItemsOrDefault = useMemo(() => {
    return (
      getItems ||
      ((async (query: string) =>
        filterSuggestionItems(
          getDefaultReactSlashMenuItems(editor),
          query,
        )) as any as typeof getItems)
    );
  }, [editor, getItems])!;

  const suggestionMenu = useExtension(SuggestionMenuExtension);

  useEffect(() => {
    suggestionMenu.addTriggerCharacter(triggerCharacter);
  }, [suggestionMenu, triggerCharacter]);

  const state = useExtensionState(SuggestionMenuExtension);
  const reference = useExtensionState(SuggestionMenuExtension, {
    selector: (state) => ({
      // Use first child as the editor DOM element may itself be scrollable.
      // For FloatingUI to auto-update the position during scrolling, the
      // `contextElement` must be a descendant of the scroll container.
      element: editor.domElement?.firstChild || undefined,
      getBoundingClientRect: () => state?.referencePos || new DOMRect(),
    }),
  });

  const floatingUIOptions = useMemo<FloatingUIOptions>(
    () => ({
      ...props.floatingUIOptions,
      useFloatingOptions: {
        open: state?.show && state?.triggerCharacter === triggerCharacter,
        onOpenChange: (open) => {
          if (!open) {
            suggestionMenu.closeMenu();
          }
        },
        placement: "bottom-start",
        middleware: [
          offset(10),
          // Flips the menu placement to maximize the space available, and prevents
          // the menu from being cut off by the confines of the screen.
          autoPlacement({
            allowedPlacements: ["bottom-start", "top-start"],
            padding: 10,
          }),
          shift(),
          size({
            apply({ elements, availableHeight }) {
              elements.floating.style.maxHeight = `${Math.max(0, availableHeight)}px`;
            },
            padding: 10,
          }),
        ],
        ...props.floatingUIOptions?.useFloatingOptions,
      },
      elementProps: {
        // Prevents editor blurring when clicking the scroll bar.
        onMouseDownCapture: (event) => event.preventDefault(),
        style: {
          zIndex: 80,
        },
        ...props.floatingUIOptions?.elementProps,
      },
    }),
    [
      props.floatingUIOptions,
      state?.show,
      state?.triggerCharacter,
      suggestionMenu,
      triggerCharacter,
    ],
  );

  if (
    !state ||
    (!state.ignoreQueryLength &&
      minQueryLength &&
      (state.query.startsWith(" ") || state.query.length < minQueryLength))
  ) {
    return null;
  }

  return (
    <GenericPopover reference={reference} {...floatingUIOptions}>
      {triggerCharacter && (
        <SuggestionMenuWrapper
          query={state.query}
          closeMenu={suggestionMenu.closeMenu}
          clearQuery={suggestionMenu.clearQuery}
          getItems={getItemsOrDefault}
          suggestionMenuComponent={
            suggestionMenuComponent || SuggestionMenu<ItemType<GetItemsType>>
          }
          onItemClick={onItemClickOrDefault}
        />
      )}
    </GenericPopover>
  );
}
```

**File:** packages/core/src/extensions/SideMenu/dragging.ts (L1-80)
```typescript
import { Node } from "prosemirror-model";
import { NodeSelection, Selection } from "prosemirror-state";
import { EditorView } from "prosemirror-view";

import { createExternalHTMLExporter } from "../../api/exporters/html/externalHTMLExporter.js";
import { cleanHTMLToMarkdown } from "../../api/exporters/markdown/markdownExporter.js";
import { fragmentToBlocks } from "../../api/nodeConversions/fragmentToBlocks.js";
import { getNodeById } from "../../api/nodeUtil.js";
import { Block } from "../../blocks/defaultBlocks.js";
import type { BlockNoteEditor } from "../../editor/BlockNoteEditor.js";
import { UiElementPosition } from "../../extensions-shared/UiElementPosition.js";
import {
  BlockSchema,
  InlineContentSchema,
  StyleSchema,
} from "../../schema/index.js";
import { MultipleNodeSelection } from "./MultipleNodeSelection.js";

let dragImageElement: Element | undefined;

export type SideMenuState<
  BSchema extends BlockSchema,
  I extends InlineContentSchema,
  S extends StyleSchema,
> = UiElementPosition & {
  // The block that the side menu is attached to.
  block: Block<BSchema, I, S>;
};

function blockPositionsFromSelection(selection: Selection, doc: Node) {
  // Absolute positions just before the first block spanned by the selection, and just after the last block. Having the
  // selection start and end just before and just after the target blocks ensures no whitespace/line breaks are left
  // behind after dragging & dropping them.
  let beforeFirstBlockPos: number;
  let afterLastBlockPos: number;

  // Even the user starts dragging blocks but drops them in the same place, the selection will still be moved just
  // before & just after the blocks spanned by the selection, and therefore doesn't need to change if they try to drag
  // the same blocks again. If this happens, the anchor & head move out of the block content node they were originally
  // in. If the anchor should update but the head shouldn't and vice versa, it means the user selection is outside a
  // block content node, which should never happen.
  const selectionStartInBlockContent =
    doc.resolve(selection.from).node().type.spec.group === "blockContent";
  const selectionEndInBlockContent =
    doc.resolve(selection.to).node().type.spec.group === "blockContent";

  // Ensures that entire outermost nodes are selected if the selection spans multiple nesting levels.
  const minDepth = Math.min(selection.$anchor.depth, selection.$head.depth);

  if (selectionStartInBlockContent && selectionEndInBlockContent) {
    // Absolute positions at the start of the first block in the selection and at the end of the last block. User
    // selections will always start and end in block content nodes, but we want the start and end positions of their
    // parent block nodes, which is why minDepth - 1 is used.
    const startFirstBlockPos = selection.$from.start(minDepth - 1);
    const endLastBlockPos = selection.$to.end(minDepth - 1);

    // Shifting start and end positions by one moves them just outside the first and last selected blocks.
    beforeFirstBlockPos = doc.resolve(startFirstBlockPos - 1).pos;
    afterLastBlockPos = doc.resolve(endLastBlockPos + 1).pos;
  } else {
    beforeFirstBlockPos = selection.from;
    afterLastBlockPos = selection.to;
  }

  return { from: beforeFirstBlockPos, to: afterLastBlockPos };
}

function setDragImage(view: EditorView, from: number, to = from) {
  if (from === to) {
    // Moves to position to be just after the first (and only) selected block.
    to += view.state.doc.resolve(from + 1).node().nodeSize;
  }

  // Parent element is cloned to remove all unselected children without affecting the editor content.
  const parentClone = view.domAtPos(from).node.cloneNode(true) as Element;
  const parent = view.domAtPos(from).node as Element;

  const getElementIndex = (parentElement: Element, targetElement: Element) =>
    Array.prototype.indexOf.call(parentElement.children, targetElement);

```

**File:** packages/core/src/extensions/SideMenu/SideMenu.ts (L37-100)
```typescript
function getBlockFromCoords(
  view: EditorView,
  coords: { left: number; top: number },
  adjustForColumns = true,
) {
  const elements = view.root.elementsFromPoint(coords.left, coords.top);

  for (const element of elements) {
    if (!view.dom.contains(element)) {
      // probably a ui overlay like formatting toolbar etc
      continue;
    }
    if (adjustForColumns) {
      const column = element.closest("[data-node-type=columnList]");
      if (column) {
        return getBlockFromCoords(
          view,
          {
            // TODO can we do better than this?
            left: coords.left + 50, // bit hacky, but if we're inside a column, offset x position to right to account for the width of sidemenu itself
            top: coords.top,
          },
          false,
        );
      }
    }
    return getDraggableBlockFromElement(element, view);
  }
  return undefined;
}

function getBlockFromMousePos(
  mousePos: {
    x: number;
    y: number;
  },
  view: EditorView,
): { node: HTMLElement; id: string } | undefined {
  // Editor itself may have padding or other styling which affects
  // size/position, so we get the boundingRect of the first child (i.e. the
  // blockGroup that wraps all blocks in the editor) for more accurate side
  // menu placement.
  if (!view.dom.firstChild) {
    return;
  }

  const editorBoundingBox = (
    view.dom.firstChild as HTMLElement
  ).getBoundingClientRect();

  // Gets block at mouse cursor's position.
  const coords = {
    // Clamps the x position to the editor's bounding box.
    left: Math.min(
      Math.max(editorBoundingBox.left + 10, mousePos.x),
      editorBoundingBox.right - 10,
    ),
    top: mousePos.y,
  };

  const referenceBlock = getBlockFromCoords(view, coords);

  if (!referenceBlock) {
    // could not find the reference block
```

**File:** packages/core/src/extensions/Collaboration/Collaboration.ts (L1-55)
```typescript
import type * as Y from "yjs";
import type { Awareness } from "y-protocols/awareness";
import {
  createExtension,
  ExtensionOptions,
} from "../../editor/BlockNoteExtension.js";
import { ForkYDocExtension } from "./ForkYDoc.js";
import { SchemaMigration } from "./schemaMigration/SchemaMigration.js";
import { YCursorExtension } from "./YCursorPlugin.js";
import { YSyncExtension } from "./YSync.js";
import { YUndoExtension } from "./YUndo.js";

export type CollaborationOptions = {
  /**
   * The Yjs XML fragment that's used for collaboration.
   */
  fragment: Y.XmlFragment;
  /**
   * The user info for the current user that's shown to other collaborators.
   */
  user: {
    name: string;
    color: string;
  };
  /**
   * A Yjs provider (used for awareness / cursor information)
   */
  provider?: { awareness?: Awareness };
  /**
   * Optional function to customize how cursors of users are rendered
   */
  renderCursor?: (user: any) => HTMLElement;
  /**
   * Optional flag to set when the user label should be shown with the default
   * collaboration cursor. Setting to "always" will always show the label,
   * while "activity" will only show the label when the user moves the cursor
   * or types. Defaults to "activity".
   */
  showCursorLabels?: "always" | "activity";
};

export const CollaborationExtension = createExtension(
  ({ options }: ExtensionOptions<CollaborationOptions>) => {
    return {
      key: "collaboration",
      blockNoteExtensions: [
        ForkYDocExtension(options),
        YCursorExtension(options),
        YSyncExtension(options),
        YUndoExtension(),
        SchemaMigration(options),
      ],
    } as const;
  },
);
```

**File:** packages/core/src/extensions/Collaboration/YSync.ts (L1-16)
```typescript
import { ySyncPlugin } from "y-prosemirror";
import {
  ExtensionOptions,
  createExtension,
} from "../../editor/BlockNoteExtension.js";
import { CollaborationOptions } from "./Collaboration.js";

export const YSyncExtension = createExtension(
  ({ options }: ExtensionOptions<Pick<CollaborationOptions, "fragment">>) => {
    return {
      key: "ySync",
      prosemirrorPlugins: [ySyncPlugin(options.fragment)],
      runsBefore: ["default"],
    } as const;
  },
);
```

**File:** packages/core/src/comments/extension.ts (L61-70)
```typescript
export const CommentsExtension = createExtension(
  ({
    editor,
    options: { schema: commentEditorSchema, threadStore, resolveUsers },
  }: ExtensionOptions<{
    /**
     * The thread store implementation to use for storing and retrieving comment threads
     */
    threadStore: ThreadStore;
    /**
```

**File:** packages/react/src/editor/BlockNoteDefaultUI.tsx (L21-30)
```typescript
// Lazily load the comments components to avoid pulling in the comments extensions into the main bundle
const FloatingComposerController = lazy(
  () => import("../components/Comments/FloatingComposerController.js"),
);
const FloatingThreadController = lazy(
  () => import("../components/Comments/FloatingThreadController.js"),
);

export type BlockNoteDefaultUIProps = {
  /**
```

**File:** packages/react/src/editor/BlockNoteDefaultUI.tsx (L79-119)
```typescript
export function BlockNoteDefaultUI(props: BlockNoteDefaultUIProps) {
  const editor = useBlockNoteEditor();

  if (!editor) {
    throw new Error(
      "BlockNoteDefaultUI must be used within a BlockNoteContext.Provider",
    );
  }

  return (
    <>
      {editor.getExtension(FormattingToolbarExtension) &&
        props.formattingToolbar !== false && <FormattingToolbarController />}
      {editor.getExtension(LinkToolbarExtension) &&
        props.linkToolbar !== false && <LinkToolbarController />}
      {editor.getExtension(SuggestionMenu) && props.slashMenu !== false && (
        <SuggestionMenuController triggerCharacter="/" />
      )}
      {editor.getExtension(SuggestionMenu) && props.emojiPicker !== false && (
        <GridSuggestionMenuController
          triggerCharacter=":"
          columns={10}
          minQueryLength={2}
        />
      )}
      {editor.getExtension(SideMenuExtension) && props.sideMenu !== false && (
        <SideMenuController />
      )}
      {editor.getExtension(FilePanelExtension) && props.filePanel !== false && (
        <FilePanelController />
      )}
      {editor.getExtension(TableHandlesExtension) &&
        props.tableHandles !== false && <TableHandlesController />}
      {editor.getExtension(CommentsExtension) && props.comments !== false && (
        <Suspense>
          <FloatingComposerController />
          <FloatingThreadController />
        </Suspense>
      )}
    </>
  );
```

**File:** packages/xl-ai/src/AIExtension.ts (L1-100)
```typescript
import { Chat } from "@ai-sdk/react";
import {
  createExtension,
  createStore,
  ExtensionOptions,
  getNodeById,
  UnreachableCaseError,
} from "@blocknote/core";
import {
  ForkYDocExtension,
  ShowSelectionExtension,
} from "@blocknote/core/extensions";
import {
  applySuggestions,
  revertSuggestions,
  suggestChanges,
} from "@handlewithcare/prosemirror-suggest-changes";
import { UIMessage } from "ai";
import { Fragment, Slice } from "prosemirror-model";
import { Plugin, PluginKey } from "prosemirror-state";
import { fixTablesKey } from "prosemirror-tables";
import { buildAIRequest, sendMessageWithAIRequest } from "./api/index.js";
import { createAgentCursorPlugin } from "./plugins/AgentCursorPlugin.js";
import { AIRequestHelpers, InvokeAIOptions } from "./types.js";

type AIPluginState = {
  aiMenuState:
    | ({
        /**
         * The ID of the block that the AI menu is opened at.
         * This changes as the AI is making changes to the document
         */
        blockId: string;
      } & (
        | {
            status: "error";
            error: any;
          }
        | {
            // fix: it might be nice to derive this from the Chat status and Tool call status
            status: "user-input" | "thinking" | "ai-writing" | "user-reviewing";
          }
      ))
    | "closed";
};

const PLUGIN_KEY = new PluginKey(`blocknote-ai-plugin`);

export const AIExtension = createExtension(
  ({
    editor,
    options: editorOptions,
  }: ExtensionOptions<
    | (AIRequestHelpers & {
        /**
         * The name and color of the agent cursor
         *
         * @default { name: "AI", color: "#8bc6ff" }
         */
        agentCursor?: { name: string; color: string };
      })
    | undefined
  >) => {
    // TODO should we really expose it like this?
    const options = createStore<AIRequestHelpers>(editorOptions ?? {});
    const store = createStore<AIPluginState>({
      aiMenuState: "closed",
    });
    let chatSession:
      | {
          previousRequestOptions: InvokeAIOptions;
          chat: Chat<UIMessage>;
          abortController: AbortController;
        }
      | undefined;
    let autoScroll = false;

    const suggestChangesPlugin = suggestChanges();
    // disable decorations for suggest changes, not needed
    // (and the pilcrows are ugly)
    suggestChangesPlugin.props.decorations = undefined;
    return {
      key: "ai",
      options,
      store,
      mount({ signal }: { signal: AbortSignal }) {
        let scrollInProgress = false;
        // Listens for `scroll` and `scrollend` events to see if a new scroll was
        // started before an existing one ended. This is the most reliable way we
        // have of checking if a scroll event was caused by the user and not by
        // `scrollIntoView`, as the events are otherwise indistinguishable. If a
        // scroll was started before an existing one finished (meaning the user has
        // scrolled), auto scrolling is disabled.
        document.addEventListener(
          "scroll",
          () => {
            if (scrollInProgress) {
              autoScroll = false;
            }

```

**File:** packages/xl-ai/src/types.ts (L11-83)
```typescript
export type AIRequestHelpers = {
  /**
   * The Vercel AI SDK transport is responsible for sending the AI SDK Request to the LLM backend
   *
   * Implement this function if you want to:
   * - use a custom backend
   * - change backend URLs
   * - use a different transport layer (e.g.: websockets)
   */
  transport?: ChatTransport<UIMessage>;

  /**
   * Customize which stream tools are available to the LLM
   */
  streamToolsProvider?: StreamToolsProvider<any, any>;

  /**
   * Extra options (header, body, metadata) that can be passed to LLM requests
   * This is a pattern we take from the Vercel AI SDK
   */
  chatRequestOptions?: ChatRequestOptions;

  documentStateBuilder?: DocumentStateBuilder<any>;
} & (
  | {
      /**
       * Use the ChatProvider to customize how the AI SDK Chat instance (orchestrating Message lifecycle) is created
       */
      chatProvider?: () => Chat<UIMessage>;
      /**
       * Not valid if chatProvider is provided
       */
      transport?: never;
    }
  | {
      /**
       * Not valid if transport is provided
       */
      chatProvider?: never;
      /**
       * The Vercel AI SDK transport is responsible for sending the AI SDK Request to the LLM backend
       *
       * Implement this function if you want to:
       * - use a custom backend
       * - change backend URLs
       * - use a different transport layer (e.g.: websockets)
       */
      transport: ChatTransport<UIMessage>;
    }
);

export type InvokeAIOptions = {
  /**
   * The user prompt to use for the LLM call
   */
  userPrompt: string;

  /**
   * Whether to use the editor selection for the LLM call
   *
   * @default true
   */
  useSelection?: boolean;
  /**
   * If the user's cursor is in an empty paragraph, automatically delete it when the AI
   * is starting to write.
   *
   * (This is used when a user starts typing `/ai` in an empty block)
   *
   * @default true
   */
  deleteEmptyCursorBlock?: boolean;
} & AIRequestHelpers;
```

**File:** packages/react/src/hooks/useCreateBlockNote.tsx (L1-36)
```typescript
import {
  BlockNoteEditor,
  BlockNoteEditorOptions,
  CustomBlockNoteSchema,
  DefaultBlockSchema,
  DefaultInlineContentSchema,
  DefaultStyleSchema,
} from "@blocknote/core";
import { DependencyList, useMemo } from "react";

/**
 * Hook to instantiate a BlockNote Editor instance in React
 */
export const useCreateBlockNote = <
  Options extends Partial<BlockNoteEditorOptions<any, any, any>> | undefined,
>(
  options: Options = {} as Options,
  deps: DependencyList = [],
): Options extends {
  schema: CustomBlockNoteSchema<infer BSchema, infer ISchema, infer SSchema>;
}
  ? BlockNoteEditor<BSchema, ISchema, SSchema>
  : BlockNoteEditor<
      DefaultBlockSchema,
      DefaultInlineContentSchema,
      DefaultStyleSchema
    > => {
  return useMemo(() => {
    const editor = BlockNoteEditor.create(options) as any;
    if (window) {
      // for testing / dev purposes
      (window as any).ProseMirror = editor._tiptapEditor;
    }
    return editor;
  }, deps); //eslint-disable-line react-hooks/exhaustive-deps
};
```

**File:** packages/react/src/editor/BlockNoteView.tsx (L88-211)
```typescript
   */
  children?: ReactNode;

  ref?: Ref<HTMLDivElement> | undefined; // only here to get types working with the generics. Regular form doesn't work
} & BlockNoteDefaultUIProps;

function BlockNoteViewComponent<
  BSchema extends BlockSchema,
  ISchema extends InlineContentSchema,
  SSchema extends StyleSchema,
>(
  props: BlockNoteViewProps<BSchema, ISchema, SSchema> &
    Omit<
      HTMLAttributes<HTMLDivElement>,
      "onChange" | "onSelectionChange" | "children"
    >,
  ref: React.Ref<HTMLDivElement>,
) {
  const {
    editor,
    className,
    theme,
    children,
    editable,
    onSelectionChange,
    onChange,
    formattingToolbar,
    linkToolbar,
    slashMenu,
    emojiPicker,
    sideMenu,
    filePanel,
    tableHandles,
    comments,
    autoFocus,
    renderEditor = true,
    ...rest
  } = props;

  // Used so other components (suggestion menu) can set
  // aria related props to the contenteditable div
  const [contentEditableProps, setContentEditableProps] =
    useState<Record<string, any>>();

  const existingContext = useBlockNoteContext();
  const systemColorScheme = usePrefersColorScheme();
  const defaultColorScheme =
    existingContext?.colorSchemePreference || systemColorScheme;

  const editorColorScheme =
    theme || (defaultColorScheme === "dark" ? "dark" : "light");

  useEditorChange(onChange || emptyFn, editor);
  useEditorSelectionChange(onSelectionChange || emptyFn, editor);

  const setElementRenderer = useCallback(
    (ref: (typeof editor)["elementRenderer"]) => {
      editor.elementRenderer = ref;
    },
    [editor],
  );

  // The BlockNoteContext makes sure the editor and some helper methods
  // are always available to nesteed compoenents
  const blockNoteContext: BlockNoteContextValue<any, any, any> = useMemo(() => {
    return {
      ...existingContext,
      editor,
      setContentEditableProps,
      colorSchemePreference: editorColorScheme,
    };
  }, [existingContext, editor, editorColorScheme]);

  // We set defaultUIProps and editorProps on a different context, the BlockNoteViewContext.
  // This BlockNoteViewContext is used to render the editor and the default UI.
  const blockNoteViewContextValue = useMemo(() => {
    return {
      editorProps: {
        autoFocus,
        contentEditableProps,
        editable,
      },
      defaultUIProps: {
        formattingToolbar,
        linkToolbar,
        slashMenu,
        emojiPicker,
        sideMenu,
        filePanel,
        tableHandles,
        comments,
      },
    };
  }, [
    autoFocus,
    contentEditableProps,
    editable,
    formattingToolbar,
    linkToolbar,
    slashMenu,
    emojiPicker,
    sideMenu,
    filePanel,
    tableHandles,
    comments,
  ]);

  return (
    <BlockNoteContext.Provider value={blockNoteContext}>
      <BlockNoteViewContext.Provider value={blockNoteViewContextValue}>
        <ElementRenderer ref={setElementRenderer} />
        <BlockNoteViewContainer
          className={className}
          renderEditor={renderEditor}
          editorColorScheme={editorColorScheme}
          ref={ref}
          {...rest}
        >
          {children}
        </BlockNoteViewContainer>
      </BlockNoteViewContext.Provider>
    </BlockNoteContext.Provider>
  );
}
```

**File:** packages/react/src/editor/BlockNoteView.tsx (L260-298)
```typescript
export const BlockNoteViewEditor = (props: { children?: ReactNode }) => {
  const ctx = useBlockNoteViewContext()!;
  const editor = useBlockNoteEditor();

  const portalManager = useMemo(() => {
    return getContentComponent();
  }, []);

  const mount = useCallback(
    (element: HTMLElement | null) => {
      // Set editable state of the actual editor.
      // We need to re-mount the editor when changing `isEditable` as TipTap 
      // removes the `tabIndex="0"` attribute we set (see 
      // `BlockNoteEditor.ts`). Ideally though, this logic would exist in a 
      // separate hook.
      editor.isEditable = ctx.editorProps.editable !== false;
      // Since we are not using TipTap's React Components, we need to set up the contentComponent it expects
      // This is a simple replacement for the state management that Tiptap does internally
      editor._tiptapEditor.contentComponent = portalManager;
      if (element) {
        editor.mount(element);
      } else {
        editor.unmount();
      }
    },
    [ctx.editorProps.editable, editor, portalManager],
  );

  return (
    <>
      <Portals contentComponent={portalManager} />
      <ContentEditableElement {...ctx.editorProps} {...props} mount={mount} />
      {/* Renders the UI elements such as formatting toolbar, etc, unless they have been explicitly disabled  in defaultUIProps */}
      <BlockNoteDefaultUI {...ctx.defaultUIProps} />
      {/* Manually passed in children, such as customized UI elements / controllers */}
      {props.children}
    </>
  );
};
```

**File:** packages/react/src/hooks/useEditorState.ts (L1-80)
```typescript
import type { BlockNoteEditor } from "@blocknote/core";
import deepEqual from "fast-deep-equal/es6/react";
import { useDebugValue, useEffect, useLayoutEffect, useState } from "react";
import { useSyncExternalStoreWithSelector } from "use-sync-external-store/shim/with-selector";
import { useBlockNoteContext } from "../editor/BlockNoteContext.js";

const useIsomorphicLayoutEffect =
  typeof window !== "undefined" ? useLayoutEffect : useEffect;

export type EditorStateSnapshot<
  TEditor extends BlockNoteEditor<any, any, any> | null = BlockNoteEditor<
    any,
    any,
    any
  > | null,
> = {
  editor: TEditor;
  transactionNumber: number;
};

export type UseEditorStateOptions<
  TSelectorResult,
  TEditor extends BlockNoteEditor<any, any, any> | null = BlockNoteEditor<
    any,
    any,
    any
  > | null,
> = {
  /**
   * The editor instance. If not provided, will use the editor from BlockNoteContext.
   */
  editor?: TEditor;

  /**
   * A selector function to determine the value to compare for re-rendering.
   */
  selector: (context: EditorStateSnapshot<TEditor>) => TSelectorResult;

  /**
   * A custom equality function to determine if the editor should re-render.
   * @default `deepEqual` from `fast-deep-equal`
   */
  equalityFn?: (a: TSelectorResult, b: TSelectorResult | null) => boolean;

  /**
   * The event to subscribe to.
   * @default "all"
   */
  on?: "all" | "selection" | "change";
};

/**
 * To synchronize the editor instance with the component state,
 * we need to create a separate instance that is not affected by the component re-renders.
 */
class EditorStateManager<
  TEditor extends BlockNoteEditor<any, any, any> | null = BlockNoteEditor<
    any,
    any,
    any
  > | null,
> {
  private transactionNumber = 0;

  private lastTransactionNumber = 0;

  private lastSnapshot: EditorStateSnapshot<TEditor>;

  private editor: TEditor;

  private subscribers = new Set<() => void>();

  constructor(initialEditor: TEditor) {
    this.editor = initialEditor;
    this.lastSnapshot = { editor: initialEditor, transactionNumber: 0 };

    this.getSnapshot = this.getSnapshot.bind(this);
    this.getServerSnapshot = this.getServerSnapshot.bind(this);
    this.watch = this.watch.bind(this);
    this.subscribe = this.subscribe.bind(this);
```

**File:** packages/react/src/schema/ReactBlockSpec.tsx (L1-25)
```typescript
import {
  BlockConfig,
  BlockImplementation,
  BlockNoDefaults,
  BlockNoteEditor,
  BlockSpec,
  camelToDataKebab,
  CustomBlockImplementation,
  Extension,
  getBlockFromPos,
  mergeCSSClasses,
  Props,
  PropSchema,
} from "@blocknote/core";
import {
  NodeViewProps,
  NodeViewWrapper,
  ReactNodeViewRenderer,
  useReactNodeView,
} from "@tiptap/react";
import { FC, ReactNode } from "react";
import { renderToDOMSpec } from "./@util/ReactRenderUtil.js";

// this file is mostly analogoues to `customBlocks.ts`, but for React blocks

```
