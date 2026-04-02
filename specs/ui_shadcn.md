---

## 1. 仓库定位

shadcn/ui **不是一个传统的 npm 组件库**，而是一套"按需复制到本地"的 UI 组件集合。其核心理念是：组件源码属于你的项目，而非被封装在不可修改的 `node_modules` 包中。仓库本身是一个 monorepo，同时承担：

- 组件注册表（Registry）的维护
- CLI 工具（`shadcn` 包）的开发
- 文档站点（`apps/v4`）的运行
- 多框架脚手架模板的提供 [1](#0-0) 

---

## 2. 适用框架与技术栈

**核心技术栈：**

| 层次 | 技术 |
|---|---|
| UI 框架 | React 18+ |
| 类型系统 | TypeScript |
| 样式引擎 | Tailwind CSS v4 |
| 原语层 | Radix UI（`radix-ui` 单包）/ Base UI |
| 变体管理 | `class-variance-authority` (CVA) |
| 类名合并 | `clsx` + `tailwind-merge` → `cn()` |
| 表单 | `react-hook-form` + `zod` |
| 图标 | `lucide-react` / `@tabler/icons-react` |
| 通知 | `sonner` |
| 图表 | `recharts` |
| 表格 | `@tanstack/react-table` |
| 拖拽 | `@dnd-kit/*` |

**支持框架（templates）：** [2](#0-1) 

模板覆盖：`next-app`、`vite-app`、`react-router-app`、`astro-app`、`start-app`，以及对应的 `*-monorepo` 变体。

`cn()` 工具函数是样式层的核心基础设施： [3](#0-2) 

---

## 3. 仓库目录结构与各子包职责

```
shadcn-ui/ui
├── apps/
│   └── v4/                  # 文档站点 + 组件注册表（Next.js）
│       ├── registry/
│       │   ├── new-york-v4/ # v4 版组件源码（UI / Blocks / Hooks）
│       │   │   ├── ui/      # 核心原子组件（50+ 个）
│       │   │   ├── blocks/  # 页面级 Block（dashboard / sidebar / login）
│       │   │   ├── hooks/   # 工具 Hook（use-mobile 等）
│       │   │   └── lib/     # utils.ts (cn)
│       │   ├── themes.ts    # 全部主题 CSS 变量定义
│       │   └── styles.tsx   # 样式预设（vega/nova/maia/lyra/mira）
│       └── lib/             # 文档站专用工具
├── packages/
│   └── shadcn/              # CLI 工具包（npx shadcn）
│       └── src/
│           ├── commands/    # init / add / diff / build 命令
│           ├── registry/    # 注册表 API 客户端
│           ├── schema/      # 配置 schema（Zod）
│           └── utils/       # 项目检测、文件写入等
├── templates/               # 各框架脚手架模板
│   ├── next-app/
│   ├── vite-app/
│   └── ...
└── scripts/                 # 构建脚本
```

**`apps/v4/registry/new-york-v4/ui/_registry.ts`** 是组件清单文件，声明每个组件的依赖关系： [4](#0-3) 

---

## 4. shadcn/ui 的组件分发模式与普通组件库的差异

### 核心差异：Copy-to-Project 模式

| 维度 | 传统组件库（如 MUI/Ant Design） | shadcn/ui |
|---|---|---|
| 安装方式 | `npm install xxx` | `npx shadcn add button` → 源码写入项目 |
| 升级方式 | 升级 npm 包版本 | 重新 `add` 覆盖，或手动合并 diff |
| 修改方式 | 主题变量 / 覆盖样式 | 直接修改组件源码（`.tsx` 文件） |
| 依赖关系 | 组件库管理所有依赖 | 组件显式声明第三方依赖（Radix/vaul/cmdk） |
| 产物 | 构建后的 JS bundle | 原始 TypeScript 源码 |

**注册表依赖声明示例（`form` 组件）：** [5](#0-4) 

**注册表依赖声明示例（`sidebar` 组件）：** [6](#0-5) 

`add` 命令会自动解析 `registryDependencies` 并递归安装所有依赖组件： [7](#0-6) 

---

## 5. 组件组织方式

### 5.1 三层组件粒度

```
原子组件 (Atoms)    → apps/v4/registry/new-york-v4/ui/
  Button, Input, Badge, Checkbox, Switch, Skeleton, Spinner…

复合组件 (Compounds) → 同层，多子组件导出
  Table → TableHeader + TableBody + TableRow + TableCell…
  Form  → FormField + FormItem + FormLabel + FormControl + FormMessage…
  Sidebar → SidebarProvider + Sidebar + SidebarContent + SidebarMenu…

页面 Block (Blocks)  → apps/v4/registry/new-york-v4/blocks/
  dashboard-01/  → AppSidebar + SiteHeader + DataTable + ChartArea + SectionCards
  sidebar-01~16/ → 各类侧边栏布局
  login-01~05/   → 登录页面模板
```

### 5.2 组件内部结构规律

每个组件遵循以下模式：

1. **`data-slot` 属性**：每个 DOM 节点打上语义标签，用于样式覆盖和调试
2. **`cn()` 合并**：所有 className 通过 `cn()` 处理，保证 Tailwind 优先级正确
3. **`asChild` 模式**：通过 `Slot.Root` 实现多态渲染，避免 DOM 嵌套问题
4. **`VariantProps`**：CVA 驱动的变体系统，类型安全

`Button` 组件示范完整模式： [8](#0-7) 

`Badge` 组件展示 `asChild` 模式： [9](#0-8) 

---

## 6. 样式体系与 Tailwind 的耦合关系

### 6.1 设计令牌层（CSS Variables → Tailwind 语义色）

所有颜色均通过 CSS 变量定义，采用 **OKLCH** 色彩空间（v4 新特性）。主题变量按语义分组： [10](#0-9) 

**变量语义分类：**

| 变量组 | 用途 |
|---|---|
| `background` / `foreground` | 页面背景与文字 |
| `card` / `card-foreground` | 卡片容器 |
| `primary` / `primary-foreground` | 主操作按钮 |
| `secondary` / `secondary-foreground` | 次要操作 |
| `muted` / `muted-foreground` | 禁用/辅助文字 |
| `accent` / `accent-foreground` | 悬停高亮 |
| `destructive` | 危险/删除操作 |
| `border` / `input` / `ring` | 边框/输入框/焦点环 |
| `chart-1~5` | 图表颜色序列 |
| `sidebar-*` | 侧边栏独立色系（8 个变量） |
| `radius` | 全局圆角基准 |

### 6.2 Tailwind v4 深度集成

- 使用 `@theme inline` 注入动画 keyframes
- 使用 `@custom-variant` 注册 Radix UI 数据属性变体： [11](#0-10) 

### 6.3 样式预设（Styles）

5 种视觉风格预设，影响圆角、间距、字体风格： [12](#0-11) 

| 预设名 | 特征 |
|---|---|
| `vega` | 干净、中性、圆角适中 |
| `nova` | 紧凑，减少 padding |
| `maia` | 圆润，宽松间距 |
| `lyra` | 方正锐利，适合等宽字体 |
| `mira` | 极度紧凑，适合密度高界面 |

### 6.4 Tailwind 与组件的耦合点

- **`group-data-[...]` 选择器**：父组件状态驱动子组件样式（Sidebar 大量使用） [13](#0-12) 

- **`data-[state=...]` 动画**：Radix 状态驱动开关动画（Dialog/Sheet） [14](#0-13) 

- **`@container` 查询**：CardHeader 使用容器查询响应内部布局 [15](#0-14) 

---

## 7. 哪些组件适合作为企业中后台基础组件

### 7.1 数据展示层（必装）

| 组件 | 用途 | 关键 API |
|---|---|---|
| `Table` | 数据表格容器 | `TableHeader/Body/Row/Cell/Head` |
| `Badge` | 状态标签 | `variant: default/secondary/destructive/outline` |
| `Card` | 数据卡片 | `CardHeader/Title/Description/Action/Content/Footer` |
| `Chart` | 数据可视化 | `ChartContainer/Tooltip/Legend` + recharts |
| `Skeleton` | 加载占位 | 单一 `className` 控制尺寸 |
| `Spinner` | 加载指示 | `size` via className |
| `Empty` | 空状态 | `EmptyMedia/Title/Description/Content` |

### 7.2 表单操作层（必装）

| 组件 | 用途 |
|---|---|
| `Form` | react-hook-form 集成封装 |
| `Input` | 文本输入 |
| `Select` | 单选下拉 |
| `Combobox` | 可搜索下拉（Base UI 驱动）|
| `Checkbox` / `Switch` / `RadioGroup` | 状态选择 |
| `Textarea` | 多行文本 |
| `DatePicker` / `Calendar` | 日期选择（react-day-picker）|

`Form` 组件与 react-hook-form 的集成方式（关键）： [16](#0-15) 

### 7.3 导航与布局层

| 组件 | 用途 |
|---|---|
| `Sidebar` | 主导航侧边栏（含折叠/移动端自适应）|
| `Breadcrumb` | 页面路径导航 |
| `Tabs` | 内容分组切换 |
| `Pagination` | 分页控制 |
| `NavigationMenu` | 顶部导航菜单 |

### 7.4 反馈与弹层

| 组件 | 用途 |
|---|---|
| `Dialog` | 确认/表单模态框 |
| `Sheet` | 侧拉抽屉（右侧面板场景）|
| `Drawer` | 底部/侧边抽屉（移动端友好）|
| `Alert` / `AlertDialog` | 提示/危险操作确认 |
| `Sonner (Toast)` | 操作反馈通知 |
| `Tooltip` | 悬停提示 |
| `Popover` | 浮层容器 |
| `Command` | 全局搜索/命令面板 |

---

## 8. 哪些组件适合 AI Work 平台中的页面骨架

### 8.1 推荐页面骨架：`SidebarProvider` + `Sidebar` + `SidebarInset`

官方 dashboard-01 Block 展示了完整的企业应用骨架： [17](#0-16) 

### 8.2 骨架层次图

```mermaid
graph TD
  "SidebarProvider" --> "AppSidebar"
  "SidebarProvider" --> "SidebarInset (main)"
  "SidebarInset (main)" --> "SiteHeader (top bar)"
  "SidebarInset (main)" --> "Page Content Area"
  "Page Content Area" --> "SectionCards (KPI 卡片)"
  "Page Content Area" --> "ChartArea (图表区)"
  "Page Content Area" --> "DataTable (数据表)"
  "AppSidebar" --> "SidebarHeader (logo)"
  "AppSidebar" --> "SidebarContent (nav)"
  "AppSidebar" --> "SidebarFooter (user)"
```

### 8.3 AI Work 平台特需组件

| 场景 | 组件组合 |
|---|---|
| AI 任务输入 | `Textarea` + `Button` + `Spinner` |
| 结果流式展示 | `ScrollArea` + `Separator` |
| 模型配置面板 | `Sheet (right)` + `Form` + `Slider` |
| 任务历史记录 | `Command` (搜索) + `Table` |
| 空任务状态 | `Empty` + `EmptyMedia (icon)` + `EmptyTitle` |
| 权限/状态标签 | `Badge (variant)` |
| 任务进度 | `Progress` + `Skeleton` |
| 多 Agent 切换 | `Tabs (variant=line)` |

`SidebarProvider` 支持 CSS 变量自定义尺寸，适合 AI 平台的动态布局： [18](#0-17) 

移动端自动降级为 `Sheet`： [19](#0-18) 

---

## 9. 推荐二次封装方式

> 以下封装均基于 shadcn/ui 原语组件，保留 `className` 透传，符合 shadcn 设计规范。

### 9.1 `PageHeader`

**基于：** `Breadcrumb` + `Separator` + `SidebarTrigger`

参考 `SiteHeader` 的实现模式： [20](#0-19) 

**封装规范：**
```tsx
// components/page-header.tsx
interface PageHeaderProps {
  title: string
  breadcrumbs?: { label: string; href?: string }[]
  actions?: React.ReactNode
  className?: string
}
```

### 9.2 `FilterBar`

**基于：** `Input` + `Select` + `Button` + `DropdownMenu`

参考 DataTable 工具栏中的 Filter 区域： [21](#0-20) 

**封装规范：**
```tsx
// components/filter-bar.tsx
interface FilterBarProps {
  searchPlaceholder?: string
  filters?: FilterConfig[]
  onSearch?: (value: string) => void
  onFilterChange?: (key: string, value: string) => void
  actions?: React.ReactNode
}
```

### 9.3 `DataTableToolbar`

**基于：** `DropdownMenu` (列显隐) + `Button` (操作) + `Select` (分页)

DataTable 的完整分页+工具栏实现： [22](#0-21) 

### 9.4 `EmptyState`

**直接使用 `Empty` 组件系列（shadcn/ui v4 新增）：** [23](#0-22) 

**封装规范：**
```tsx
// components/empty-state.tsx
interface EmptyStateProps {
  icon?: React.ComponentType
  title: string
  description?: string
  action?: { label: string; onClick: () => void }
}
```

### 9.5 `RightDrawer`（详情/编辑面板）

**基于：** `Sheet` (`side="right"`) + `SheetHeader` + `SheetContent` + `SheetFooter`

Sheet 组件支持四个方向，`right` 最适合企业后台详情面板： [24](#0-23) 

**封装规范：**
```tsx
// components/right-drawer.tsx
interface RightDrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: string
  children: React.ReactNode
  footer?: React.ReactNode
  width?: "sm" | "md" | "lg" // 通过 className 映射到 max-w-*
}
```

### 9.6 `DataTable`（完整封装模板）

完整 TanStack Table + shadcn Table 集成，包含 drag-to-reorder： [25](#0-24) 

### 9.7 `AppSidebar`（可配置导航骨架） [26](#0-25) 

---

## 10. 适合 Cursor / Claude Code 消费的代码生成规则

### 10.1 导入路径规则

```
// ✅ 正确：从本地 components/ui/ 导入
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

// ❌ 错误：从 npm 包导入
import { Button } from "shadcn-ui"
```

### 10.2 组件使用的标准模式

**Button 所有变体：** [27](#0-26) 

**Select 完整结构（必须包含所有子组件）：** [28](#0-27) 

**Form 字段标准写法（必须用 FormField 包裹）：** [29](#0-28) 

### 10.3 CVA 变体扩展规则

当 AI 生成自定义组件变体时，遵循 `cva()` 模式： [27](#0-26) 

### 10.4 表格生成规则

Table 必须有包裹 `div`（`overflow-x-auto`），AI 生成时不可省略： [30](#0-29) 

### 10.5 Chart 配置规则

ChartConfig 必须先定义，颜色引用 CSS 变量： [31](#0-30) 

ChartContainer 的 `config` prop 驱动 `<ChartStyle>` 注入 CSS 变量： [32](#0-31) 

---

## 11. 页面开发时的最佳实践

### 11.1 布局骨架：始终从 `SidebarProvider` 开始 [33](#0-32) 

### 11.2 `"use client"` 边界管理

服务器组件（无 `"use client"`）：`Button`, `Card`, `Badge`, `Alert`, `Breadcrumb`, `Table` 系列、`Skeleton`。

客户端组件（含 `"use client"`）：`Sidebar`, `Dialog`, `Sheet`, `Form`, `Tabs`, `Select`, `Command`, `Chart`。

**判断依据**：含有 `React.useState`、`React.useContext`、事件监听的组件必须标注 `"use client"`。 [34](#0-33) 

### 11.3 主题变量引用规则

在 Tailwind 类名中使用语义色（永远不硬编码颜色值）：

```
✅ bg-primary text-primary-foreground
✅ bg-muted text-muted-foreground
✅ border-border
✅ text-destructive
❌ bg-blue-500
❌ text-gray-600
```

`Input` 组件展示了正确的颜色语义使用： [35](#0-34) 

### 11.4 Sidebar CSS 变量自定义

Sidebar 尺寸通过 CSS 变量在 `SidebarProvider` 的 `style` prop 配置： [18](#0-17) 

### 11.5 `data-slot` 的父子样式联动

利用 `data-slot` 实现跨层级样式覆盖（无需 CSS Modules）： [36](#0-35) 

### 11.6 响应式设计使用 `@container`

Card、DataTable 已使用容器查询，自定义组件优先使用 `@container` 替代视口断点： [37](#0-36) 

---

## 12. 反模式与常见误用

### 12.1 ❌ 在 `node_modules` 中修改源码

shadcn/ui 的组件已复制到项目中，**直接修改 `node_modules`** 无任何效果。需修改 `components/ui/` 下的本地文件。

### 12.2 ❌ 不通过 `cn()` 合并 className

```tsx
// ❌ 错误：Tailwind 类名冲突，后者不会覆盖前者
<Button className="bg-red-500" />  // 可能被组件内置类覆盖

// ✅ 正确：cn() 内部使用 twMerge 保证覆盖优先级
// cn() 已在组件内部处理，直接传 className 即可
``` [3](#0-2) 

### 12.3 ❌ 硬编码 Tailwind 颜色值替代语义色

```tsx
// ❌ 暗色模式下失效
<div className="bg-gray-100 text-gray-900" />

// ✅ 自动适配 dark mode
<div className="bg-muted text-muted-foreground" />
```

### 12.4 ❌ 不使用 `asChild` 导致 DOM 嵌套错误

```tsx
// ❌ 生成 <button><a>...</a></button> 的非法嵌套
<Button><Link href="/xxx">跳转</Link></Button>

// ✅ 使用 asChild，Button 渲染为 <a>
<Button asChild><Link href="/xxx">跳转</Link></Button>
``` [38](#0-37) 

### 12.5 ❌ Tooltip 未包裹 `TooltipProvider` [39](#0-38) 

### 12.6 ❌ 在 Sheet/Dialog 外直接使用 `SheetContent`/`DialogContent`

这两个组件必须在对应的 Root 组件上下文中使用（Radix UI Portal 机制）。 [40](#0-39) 

### 12.7 ❌ Form 字段绕过 `FormField` 直接使用控件

`FormField` 负责注入 `FormFieldContext`

### Citations

**File:** packages/shadcn/src/commands/init.ts (L97-101)
```typescript
export const init = new Command()
  .name("init")
  .alias("create")
  .description("initialize your project and install dependencies")
  .argument("[components...]", "names, url or local path to component")
```

**File:** templates (L1-1)
```text
[{"name":"astro-app","path":"templates/astro-app","sha":"3f4205edb63a360dcc88b295f19cfc72887ce685","size":0,"url":"https://api.github.com/repos/shadcn-ui/ui/contents/templates/astro-app?ref=main","html_url":"https://github.com/shadcn-ui/ui/tree/main/templates/astro-app","git_url":"https://api.github.com/repos/shadcn-ui/ui/git/trees/3f4205edb63a360dcc88b295f19cfc72887ce685","download_url":null,"type":"dir","_links":{"self":"https://api.github.com/repos/shadcn-ui/ui/contents/templates/astro-app?ref=main","git":"https://api.github.com/repos/shadcn-ui/ui/git/trees/3f4205edb63a360dcc88b295f19cfc72887ce685","html":"https://github.com/shadcn-ui/ui/tree/main/templates/astro-app"}},{"name":"astro-monorepo","path":"templates/astro-monorepo","sha":"5b26c1d1f7fff0ea7bfa3b0b2b858844a6200ed0","size":0,"url":"https://api.github.com/repos/shadcn-ui/ui/contents/templates/astro-monorepo?ref=main","html_url":"https://github.com/shadcn-ui/ui/tree/main/templates/astro-monorepo","git_url":"https://api.github.com/repos/shadcn-ui/ui/git/trees/5b26c1d1f7fff0ea7bfa3b0b2b858844a6200ed0","download_url":null,"type":"dir","_links":{"self":"https://api.github.com/repos/shadcn-ui/ui/contents/templates/astro-monorepo?ref=main","git":"https://api.github.com/repos/shadcn-ui/ui/git/trees/5b26c1d1f7fff0ea7bfa3b0b2b858844a6200ed0","html":"https://github.com/shadcn-ui/ui/tree/main/templates/astro-monorepo"}},{"name":"next-app","path":"templates/next-app","sha":"3678547db19f70aa5ce9b583028b4e462da9618f","size":0,"url":"https://api.github.com/repos/shadcn-ui/ui/contents/templates/next-app?ref=main","html_url":"https://github.com/shadcn-ui/ui/tree/main/templates/next-app","git_url":"https://api.github.com/repos/shadcn-ui/ui/git/trees/3678547db19f70aa5ce9b583028b4e462da9618f","download_url":null,"type":"dir","_links":{"self":"https://api.github.com/repos/shadcn-ui/ui/contents/templates/next-app?ref=main","git":"https://api.github.com/repos/shadcn-ui/ui/git/trees/3678547db19f70aa5ce9b583028b4e462da9618f","html":"https://github.com/shadcn-ui/ui/tree/main/templates/next-app"}},{"name":"next-monorepo","path":"templates/next-monorepo","sha":"cb480c2df9f4909a568263a572d3020b8bb2dec8","size":0,"url":"https://api.github.com/repos/shadcn-ui/ui/contents/templates/next-monorepo?ref=main","html_url":"https://github.com/shadcn-ui/ui/tree/main/templates/next-monorepo","git_url":"https://api.github.com/repos/shadcn-ui/ui/git/trees/cb480c2df9f4909a568263a572d3020b8bb2dec8","download_url":null,"type":"dir","_links":{"self":"https://api.github.com/repos/shadcn-ui/ui/contents/templates/next-monorepo?ref=main","git":"https://api.github.com/repos/shadcn-ui/ui/git/trees/cb480c2df9f4909a568263a572d3020b8bb2dec8","html":"https://github.com/shadcn-ui/ui/tree/main/templates/next-monorepo"}},{"name":"react-router-app","path":"templates/react-router-app","sha":"2f7cab97e1c2da2d1e0989cb082161fe0a6d0c69","size":0,"url":"https://api.github.com/repos/shadcn-ui/ui/contents/templates/react-router-app?ref=main","html_url":"https://github.com/shadcn-ui/ui/tree/main/templates/react-router-app","git_url":"https://api.github.com/repos/shadcn-ui/ui/git/trees/2f7cab97e1c2da2d1e0989cb082161fe0a6d0c69","download_url":null,"type":"dir","_links":{"self":"https://api.github.com/repos/shadcn-ui/ui/contents/templates/react-router-app?ref=main","git":"https://api.github.com/repos/shadcn-ui/ui/git/trees/2f7cab97e1c2da2d1e0989cb082161fe0a6d0c69","html":"https://github.com/shadcn-ui/ui/tree/main/templates/react-router-app"}},{"name":"react-router-monorepo","path":"templates/react-router-monorepo","sha":"7f02585667f9e2579078f893a6336f448d78255e","size":0,"url":"https://api.github.com/repos/shadcn-ui/ui/contents/templates/react-router-monorepo?ref=main","html_url":"https://github.com/shadcn-ui/ui/tree/main/templates/react-router-monorepo","git_url":"https://api.github.com/repos/shadcn-ui/ui/git/trees/7f02585667f9e2579078f893a6336f448d78255e","download_url":null,"type":"dir","_links":{"self":"https://api.github.com/repos/shadcn-ui/ui/contents/templates/react-router-monorepo?ref=main","git":"https://api.github.com/repos/shadcn-ui/ui/git/trees/7f02585667f9e2579078f893a6336f448d78255e","html":"https://github.com/shadcn-ui/ui/tree/main/templates/react-router-monorepo"}},{"name":"start-app","path":"templates/start-app","sha":"2606ade3ae94769eb16fbc24463f45b07317dc8e","size":0,"url":"https://api.github.com/repos/shadcn-ui/ui/contents/templates/start-app?ref=main","html_url":"https://github.com/shadcn-ui/ui/tree/main/templates/start-app","git_url":"https://api.github.com/repos/shadcn-ui/ui/git/trees/2606ade3ae94769eb16fbc24463f45b07317dc8e","download_url":null,"type":"dir","_links":{"self":"https://api.github.com/repos/shadcn-ui/ui/contents/templates/start-app?ref=main","git":"https://api.github.com/repos/shadcn-ui/ui/git/trees/2606ade3ae94769eb16fbc24463f45b07317dc8e","html":"https://github.com/shadcn-ui/ui/tree/main/templates/start-app"}},{"name":"start-monorepo","path":"templates/start-monorepo","sha":"7881727009d45cf5900be15582711b274f9f667f","size":0,"url":"https://api.github.com/repos/shadcn-ui/ui/contents/templates/start-monorepo?ref=main","html_url":"https://github.com/shadcn-ui/ui/tree/main/templates/start-monorepo","git_url":"https://api.github.com/repos/shadcn-ui/ui/git/trees/7881727009d45cf5900be15582711b274f9f667f","download_url":null,"type":"dir","_links":{"self":"https://api.github.com/repos/shadcn-ui/ui/contents/templates/start-monorepo?ref=main","git":"https://api.github.com/repos/shadcn-ui/ui/git/trees/7881727009d45cf5900be15582711b274f9f667f","html":"https://github.com/shadcn-ui/ui/tree/main/templates/start-monorepo"}},{"name":"vite-app","path":"templates/vite-app","sha":"78f9004dcbf8d30078f60945054228468f66a172","size":0,"url":"https://api.github.com/repos/shadcn-ui/ui/contents/templates/vite-app?ref=main","html_url":"https://github.com/shadcn-ui/ui/tree/main/templates/vite-app","git_url":"https://api.github.com/repos/shadcn-ui/ui/git/trees/78f9004dcbf8d30078f60945054228468f66a172","download_url":null,"type":"dir","_links":{"self":"https://api.github.com/repos/shadcn-ui/ui/contents/templates/vite-app?ref=main","git":"https://api.github.com/repos/shadcn-ui/ui/git/trees/78f9004dcbf8d30078f60945054228468f66a172","html":"https://github.com/shadcn-ui/ui/tree/main/templates/vite-app"}},{"name":"vite-monorepo","path":"templates/vite-monorepo","sha":"028664cf9aaad28cfdb342b30f2440da7a21f896","size":0,"url":"https://api.github.com/repos/shadcn-ui/ui/contents/templates/vite-monorepo?ref=main","html_url":"https://github.com/shadcn-ui/ui/tree/main/templates/vite-monorepo","git_url":"https://api.github.com/repos/shadcn-ui/ui/git/trees/028664cf9aaad28cfdb342b30f2440da7a21f896","download_url":null,"type":"dir","_links":{"self":"https://api.github.com/repos/shadcn-ui/ui/contents/templates/vite-monorepo?ref=main","git":"https://api.github.com/repos/shadcn-ui/ui/git/trees/028664cf9aaad28cfdb342b30f2440da7a21f896","html":"https://github.com/shadcn-ui/ui/tree/main/templates/vite-monorepo"}}]
```

**File:** apps/v4/registry/new-york-v4/lib/utils.ts (L1-6)
```typescript
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
```

**File:** apps/v4/registry/new-york-v4/ui/_registry.ts (L1-50)
```typescript
import { type Registry } from "shadcn/schema"

export const ui: Registry["items"] = [
  {
    name: "accordion",
    type: "registry:ui",
    dependencies: ["radix-ui"],
    files: [
      {
        path: "ui/accordion.tsx",
        type: "registry:ui",
      },
    ],
  },
  {
    name: "alert",
    type: "registry:ui",
    files: [
      {
        path: "ui/alert.tsx",
        type: "registry:ui",
      },
    ],
  },
  {
    name: "alert-dialog",
    type: "registry:ui",
    dependencies: ["radix-ui"],
    registryDependencies: ["button"],
    files: [
      {
        path: "ui/alert-dialog.tsx",
        type: "registry:ui",
      },
    ],
  },
  {
    name: "aspect-ratio",
    type: "registry:ui",
    dependencies: ["radix-ui"],
    files: [
      {
        path: "ui/aspect-ratio.tsx",
        type: "registry:ui",
      },
    ],
  },
  {
    name: "avatar",
    type: "registry:ui",
```

**File:** apps/v4/registry/new-york-v4/ui/_registry.ts (L261-271)
```typescript
    name: "form",
    type: "registry:ui",
    dependencies: ["radix-ui", "@hookform/resolvers", "zod", "react-hook-form"],
    registryDependencies: ["button", "label"],
    files: [
      {
        path: "ui/form.tsx",
        type: "registry:ui",
      },
    ],
  },
```

**File:** apps/v4/registry/new-york-v4/ui/_registry.ts (L460-520)
```typescript
    name: "sidebar",
    type: "registry:ui",
    dependencies: ["radix-ui", "class-variance-authority", "lucide-react"],
    registryDependencies: [
      "button",
      "separator",
      "sheet",
      "tooltip",
      "input",
      "use-mobile",
      "skeleton",
    ],
    files: [
      {
        path: "ui/sidebar.tsx",
        type: "registry:ui",
      },
    ],
    tailwind: {
      config: {
        theme: {
          extend: {
            colors: {
              sidebar: {
                DEFAULT: "hsl(var(--sidebar-background))",
                foreground: "hsl(var(--sidebar-foreground))",
                primary: "hsl(var(--sidebar-primary))",
                "primary-foreground": "hsl(var(--sidebar-primary-foreground))",
                accent: "hsl(var(--sidebar-accent))",
                "accent-foreground": "hsl(var(--sidebar-accent-foreground))",
                border: "hsl(var(--sidebar-border))",
                ring: "hsl(var(--sidebar-ring))",
              },
            },
          },
        },
      },
    },
    cssVars: {
      light: {
        "sidebar-background": "0 0% 98%",
        "sidebar-foreground": "240 5.3% 26.1%",
        "sidebar-primary": "240 5.9% 10%",
        "sidebar-primary-foreground": "0 0% 98%",
        "sidebar-accent": "240 4.8% 95.9%",
        "sidebar-accent-foreground": "240 5.9% 10%",
        "sidebar-border": "220 13% 91%",
        "sidebar-ring": "217.2 91.2% 59.8%",
      },
      dark: {
        "sidebar-background": "240 5.9% 10%",
        "sidebar-foreground": "240 4.8% 95.9%",
        "sidebar-primary": "224.3 76.3% 48%",
        "sidebar-primary-foreground": "0 0% 100%",
        "sidebar-accent": "240 3.7% 15.9%",
        "sidebar-accent-foreground": "240 4.8% 95.9%",
        "sidebar-border": "240 3.7% 15.9%",
        "sidebar-ring": "217.2 91.2% 59.8%",
      },
    },
  },
```

**File:** apps/v4/registry/new-york-v4/ui/_registry.ts (L652-674)
```typescript
    docs: `The \`tooltip\` component has been added. Remember to wrap your app with the \`TooltipProvider\` component.

\`\`\`tsx title="app/layout.tsx"
import { TooltipProvider } from "@/components/ui/tooltip"

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <TooltipProvider>{children}</TooltipProvider>
      </body>
    </html>
  )
}
\`\`\`
`,
    files: [
      {
        path: "ui/tooltip.tsx",
        type: "registry:ui",
      },
    ],
  },
```

**File:** packages/shadcn/src/commands/add.ts (L33-45)
```typescript
export const addOptionsSchema = z.object({
  components: z.array(z.string()).optional(),
  yes: z.boolean(),
  overwrite: z.boolean(),
  cwd: z.string(),
  all: z.boolean(),
  path: z.string().optional(),
  silent: z.boolean(),
  dryRun: z.boolean(),
  diff: z.union([z.string(), z.literal(true)]).optional(),
  view: z.union([z.string(), z.literal(true)]).optional(),
})

```

**File:** apps/v4/registry/new-york-v4/ui/button.tsx (L1-64)
```typescript
import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Slot } from "radix-ui"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 rounded-md text-sm font-medium whitespace-nowrap transition-all outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        destructive:
          "bg-destructive text-white hover:bg-destructive/90 focus-visible:ring-destructive/20 dark:bg-destructive/60 dark:focus-visible:ring-destructive/40",
        outline:
          "border bg-background shadow-xs hover:bg-accent hover:text-accent-foreground dark:border-input dark:bg-input/30 dark:hover:bg-input/50",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost:
          "hover:bg-accent hover:text-accent-foreground dark:hover:bg-accent/50",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-9 px-4 py-2 has-[>svg]:px-3",
        xs: "h-6 gap-1 rounded-md px-2 text-xs has-[>svg]:px-1.5 [&_svg:not([class*='size-'])]:size-3",
        sm: "h-8 gap-1.5 rounded-md px-3 has-[>svg]:px-2.5",
        lg: "h-10 rounded-md px-6 has-[>svg]:px-4",
        icon: "size-9",
        "icon-xs": "size-6 rounded-md [&_svg:not([class*='size-'])]:size-3",
        "icon-sm": "size-8",
        "icon-lg": "size-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot.Root : "button"

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
```

**File:** apps/v4/registry/new-york-v4/ui/badge.tsx (L29-46)
```typescript
function Badge({
  className,
  variant = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"span"> &
  VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : "span"

  return (
    <Comp
      data-slot="badge"
      data-variant={variant}
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  )
}
```

**File:** apps/v4/registry/themes.ts (L1-77)
```typescript
import { type RegistryItem } from "shadcn/schema"

export const THEMES: RegistryItem[] = [
  {
    name: "neutral",
    title: "Neutral",
    type: "registry:theme",
    cssVars: {
      light: {
        background: "oklch(1 0 0)",
        foreground: "oklch(0.145 0 0)",
        card: "oklch(1 0 0)",
        "card-foreground": "oklch(0.145 0 0)",
        popover: "oklch(1 0 0)",
        "popover-foreground": "oklch(0.145 0 0)",
        primary: "oklch(0.205 0 0)",
        "primary-foreground": "oklch(0.985 0 0)",
        secondary: "oklch(0.97 0 0)",
        "secondary-foreground": "oklch(0.205 0 0)",
        muted: "oklch(0.97 0 0)",
        "muted-foreground": "oklch(0.556 0 0)",
        accent: "oklch(0.97 0 0)",
        "accent-foreground": "oklch(0.205 0 0)",
        destructive: "oklch(0.577 0.245 27.325)",
        border: "oklch(0.922 0 0)",
        input: "oklch(0.922 0 0)",
        ring: "oklch(0.708 0 0)",
        "chart-1": "oklch(0.809 0.105 251.813)",
        "chart-2": "oklch(0.623 0.214 259.815)",
        "chart-3": "oklch(0.546 0.245 262.881)",
        "chart-4": "oklch(0.488 0.243 264.376)",
        "chart-5": "oklch(0.424 0.199 265.638)",
        radius: "0.625rem",
        sidebar: "oklch(0.985 0 0)",
        "sidebar-foreground": "oklch(0.145 0 0)",
        "sidebar-primary": "oklch(0.205 0 0)",
        "sidebar-primary-foreground": "oklch(0.985 0 0)",
        "sidebar-accent": "oklch(0.97 0 0)",
        "sidebar-accent-foreground": "oklch(0.205 0 0)",
        "sidebar-border": "oklch(0.922 0 0)",
        "sidebar-ring": "oklch(0.708 0 0)",
      },
      dark: {
        background: "oklch(0.145 0 0)",
        foreground: "oklch(0.985 0 0)",
        card: "oklch(0.205 0 0)",
        "card-foreground": "oklch(0.985 0 0)",
        popover: "oklch(0.205 0 0)",
        "popover-foreground": "oklch(0.985 0 0)",
        primary: "oklch(0.922 0 0)",
        "primary-foreground": "oklch(0.205 0 0)",
        secondary: "oklch(0.269 0 0)",
        "secondary-foreground": "oklch(0.985 0 0)",
        muted: "oklch(0.269 0 0)",
        "muted-foreground": "oklch(0.708 0 0)",
        accent: "oklch(0.269 0 0)",
        "accent-foreground": "oklch(0.985 0 0)",
        destructive: "oklch(0.704 0.191 22.216)",
        border: "oklch(1 0 0 / 10%)",
        input: "oklch(1 0 0 / 15%)",
        ring: "oklch(0.556 0 0)",
        "chart-1": "oklch(0.809 0.105 251.813)",
        "chart-2": "oklch(0.623 0.214 259.815)",
        "chart-3": "oklch(0.546 0.245 262.881)",
        "chart-4": "oklch(0.488 0.243 264.376)",
        "chart-5": "oklch(0.424 0.199 265.638)",
        sidebar: "oklch(0.205 0 0)",
        "sidebar-foreground": "oklch(0.985 0 0)",
        "sidebar-primary": "oklch(0.488 0.243 264.376)",
        "sidebar-primary-foreground": "oklch(0.985 0 0)",
        "sidebar-accent": "oklch(0.269 0 0)",
        "sidebar-accent-foreground": "oklch(0.985 0 0)",
        "sidebar-border": "oklch(1 0 0 / 10%)",
        "sidebar-ring": "oklch(0.556 0 0)",
      },
    },
  },
```

**File:** packages/shadcn/src/tailwind.css (L1-85)
```css
@theme inline {
  @keyframes accordion-down {
    from {
      height: 0;
    }
    to {
      height: var(
        --radix-accordion-content-height,
        var(--accordion-panel-height, auto)
      );
    }
  }

  @keyframes accordion-up {
    from {
      height: var(
        --radix-accordion-content-height,
        var(--accordion-panel-height, auto)
      );
    }
    to {
      height: 0;
    }
  }
}

/* Custom variants */
@custom-variant data-open {
  &:where([data-state="open"]),
  &:where([data-open]:not([data-open="false"])) {
    @slot;
  }
}

@custom-variant data-closed {
  &:where([data-state="closed"]),
  &:where([data-closed]:not([data-closed="false"])) {
    @slot;
  }
}

@custom-variant data-checked {
  &:where([data-state="checked"]),
  &:where([data-checked]:not([data-checked="false"])) {
    @slot;
  }
}

@custom-variant data-unchecked {
  &:where([data-state="unchecked"]),
  &:where([data-unchecked]:not([data-unchecked="false"])) {
    @slot;
  }
}

@custom-variant data-selected {
  &:where([data-selected="true"]) {
    @slot;
  }
}

@custom-variant data-disabled {
  &:where([data-disabled="true"]),
  &:where([data-disabled]:not([data-disabled="false"])) {
    @slot;
  }
}

@custom-variant data-active {
  &:where([data-state="active"]),
  &:where([data-active]:not([data-active="false"])) {
    @slot;
  }
}

@custom-variant data-horizontal {
  &:where([data-orientation="horizontal"]) {
    @slot;
  }
}

@custom-variant data-vertical {
  &:where([data-orientation="vertical"]) {
    @slot;
  }
```

**File:** apps/v4/registry/styles.tsx (L1-30)
```typescript
import * as React from "react"

export const STYLES = [
  {
    name: "vega",
    title: "Vega",
    description: "Clean, neutral, and familiar",
    icon: (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="128"
        height="128"
        viewBox="0 0 24 24"
        fill="none"
        role="img"
        color="currentColor"
      >
        <path
          d="M2.5 12C2.5 7.52166 2.5 5.28249 3.89124 3.89124C5.28249 2.5 7.52166 2.5 12 2.5C16.4783 2.5 18.7175 2.5 20.1088 3.89124C21.5 5.28249 21.5 7.52166 21.5 12C21.5 16.4783 21.5 18.7175 20.1088 20.1088C18.7175 21.5 16.4783 21.5 12 21.5C7.52166 21.5 5.28249 21.5 3.89124 20.1088C2.5 18.7175 2.5 16.4783 2.5 12Z"
          stroke="currentColor"
          strokeWidth="2"
        ></path>
      </svg>
    ),
  },
  {
    name: "nova",
    title: "Nova",
    description: "Reduced padding and margins",
    icon: (
```

**File:** apps/v4/registry/new-york-v4/ui/sidebar.tsx (L1-2)
```typescript
"use client"

```

**File:** apps/v4/registry/new-york-v4/ui/sidebar.tsx (L129-152)
```typescript
  return (
    <SidebarContext.Provider value={contextValue}>
      <TooltipProvider delayDuration={0}>
        <div
          data-slot="sidebar-wrapper"
          style={
            {
              "--sidebar-width": SIDEBAR_WIDTH,
              "--sidebar-width-icon": SIDEBAR_WIDTH_ICON,
              ...style,
            } as React.CSSProperties
          }
          className={cn(
            "group/sidebar-wrapper flex min-h-svh w-full has-data-[variant=inset]:bg-sidebar",
            className
          )}
          {...props}
        >
          {children}
        </div>
      </TooltipProvider>
    </SidebarContext.Provider>
  )
}
```

**File:** apps/v4/registry/new-york-v4/ui/sidebar.tsx (L183-206)
```typescript
  if (isMobile) {
    return (
      <Sheet open={openMobile} onOpenChange={setOpenMobile} {...props}>
        <SheetContent
          data-sidebar="sidebar"
          data-slot="sidebar"
          data-mobile="true"
          className="w-(--sidebar-width) bg-sidebar p-0 text-sidebar-foreground [&>button]:hidden"
          style={
            {
              "--sidebar-width": SIDEBAR_WIDTH_MOBILE,
            } as React.CSSProperties
          }
          side={side}
        >
          <SheetHeader className="sr-only">
            <SheetTitle>Sidebar</SheetTitle>
            <SheetDescription>Displays the mobile sidebar.</SheetDescription>
          </SheetHeader>
          <div className="flex h-full w-full flex-col">{children}</div>
        </SheetContent>
      </Sheet>
    )
  }
```

**File:** apps/v4/registry/new-york-v4/ui/sidebar.tsx (L208-254)
```typescript
  return (
    <div
      className="group peer hidden text-sidebar-foreground md:block"
      data-state={state}
      data-collapsible={state === "collapsed" ? collapsible : ""}
      data-variant={variant}
      data-side={side}
      data-slot="sidebar"
    >
      {/* This is what handles the sidebar gap on desktop */}
      <div
        data-slot="sidebar-gap"
        className={cn(
          "relative w-(--sidebar-width) bg-transparent transition-[width] duration-200 ease-linear",
          "group-data-[collapsible=offcanvas]:w-0",
          "group-data-[side=right]:rotate-180",
          variant === "floating" || variant === "inset"
            ? "group-data-[collapsible=icon]:w-[calc(var(--sidebar-width-icon)+(--spacing(4)))]"
            : "group-data-[collapsible=icon]:w-(--sidebar-width-icon)"
        )}
      />
      <div
        data-slot="sidebar-container"
        className={cn(
          "fixed inset-y-0 z-10 hidden h-svh w-(--sidebar-width) transition-[left,right,width] duration-200 ease-linear md:flex",
          side === "left"
            ? "left-0 group-data-[collapsible=offcanvas]:left-[calc(var(--sidebar-width)*-1)]"
            : "right-0 group-data-[collapsible=offcanvas]:right-[calc(var(--sidebar-width)*-1)]",
          // Adjust the padding for floating and inset variants.
          variant === "floating" || variant === "inset"
            ? "p-2 group-data-[collapsible=icon]:w-[calc(var(--sidebar-width-icon)+(--spacing(4))+2px)]"
            : "group-data-[collapsible=icon]:w-(--sidebar-width-icon) group-data-[side=left]:border-r group-data-[side=right]:border-l",
          className
        )}
        {...props}
      >
        <div
          data-sidebar="sidebar"
          data-slot="sidebar-inner"
          className="flex h-full w-full flex-col bg-sidebar group-data-[variant=floating]:rounded-lg group-data-[variant=floating]:border group-data-[variant=floating]:border-sidebar-border group-data-[variant=floating]:shadow-sm"
        >
          {children}
        </div>
      </div>
    </div>
  )
}
```

**File:** apps/v4/registry/new-york-v4/ui/dialog.tsx (L34-48)
```typescript
function DialogOverlay({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Overlay>) {
  return (
    <DialogPrimitive.Overlay
      data-slot="dialog-overlay"
      className={cn(
        "fixed inset-0 z-50 bg-black/50 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0",
        className
      )}
      {...props}
    />
  )
}
```

**File:** apps/v4/registry/new-york-v4/ui/card.tsx (L18-29)
```typescript
function CardHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-header"
      className={cn(
        "@container/card-header grid auto-rows-min grid-rows-[auto_auto] items-start gap-2 px-6 has-data-[slot=card-action]:grid-cols-[1fr_auto] [.border-b]:pb-6",
        className
      )}
      {...props}
    />
  )
}
```

**File:** apps/v4/registry/new-york-v4/ui/form.tsx (L32-66)
```typescript
const FormField = <
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>,
>({
  ...props
}: ControllerProps<TFieldValues, TName>) => {
  return (
    <FormFieldContext.Provider value={{ name: props.name }}>
      <Controller {...props} />
    </FormFieldContext.Provider>
  )
}

const useFormField = () => {
  const fieldContext = React.useContext(FormFieldContext)
  const itemContext = React.useContext(FormItemContext)
  const { getFieldState } = useFormContext()
  const formState = useFormState({ name: fieldContext.name })
  const fieldState = getFieldState(fieldContext.name, formState)

  if (!fieldContext) {
    throw new Error("useFormField should be used within <FormField>")
  }

  const { id } = itemContext

  return {
    id,
    name: fieldContext.name,
    formItemId: `${id}-form-item`,
    formDescriptionId: `${id}-form-item-description`,
    formMessageId: `${id}-form-item-message`,
    ...fieldState,
  }
}
```

**File:** apps/v4/registry/new-york-v4/blocks/dashboard-01/page.tsx (L1-40)
```typescript
import { AppSidebar } from "@/registry/new-york-v4/blocks/dashboard-01/components/app-sidebar"
import { ChartAreaInteractive } from "@/registry/new-york-v4/blocks/dashboard-01/components/chart-area-interactive"
import { DataTable } from "@/registry/new-york-v4/blocks/dashboard-01/components/data-table"
import { SectionCards } from "@/registry/new-york-v4/blocks/dashboard-01/components/section-cards"
import { SiteHeader } from "@/registry/new-york-v4/blocks/dashboard-01/components/site-header"
import {
  SidebarInset,
  SidebarProvider,
} from "@/registry/new-york-v4/ui/sidebar"

import data from "./data.json"

export default function Page() {
  return (
    <SidebarProvider
      style={
        {
          "--sidebar-width": "calc(var(--spacing) * 72)",
          "--header-height": "calc(var(--spacing) * 12)",
        } as React.CSSProperties
      }
    >
      <AppSidebar variant="inset" />
      <SidebarInset>
        <SiteHeader />
        <div className="flex flex-1 flex-col">
          <div className="@container/main flex flex-1 flex-col gap-2">
            <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
              <SectionCards />
              <div className="px-4 lg:px-6">
                <ChartAreaInteractive />
              </div>
              <DataTable data={data} />
            </div>
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
```

**File:** apps/v4/registry/new-york-v4/blocks/dashboard-01/components/site-header.tsx (L1-30)
```typescript
import { Button } from "@/registry/new-york-v4/ui/button"
import { Separator } from "@/registry/new-york-v4/ui/separator"
import { SidebarTrigger } from "@/registry/new-york-v4/ui/sidebar"

export function SiteHeader() {
  return (
    <header className="flex h-(--header-height) shrink-0 items-center gap-2 border-b transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-(--header-height)">
      <div className="flex w-full items-center gap-1 px-4 lg:gap-2 lg:px-6">
        <SidebarTrigger className="-ml-1" />
        <Separator
          orientation="vertical"
          className="mx-2 data-[orientation=vertical]:h-4"
        />
        <h1 className="text-base font-medium">Documents</h1>
        <div className="ml-auto flex items-center gap-2">
          <Button variant="ghost" asChild size="sm" className="hidden sm:flex">
            <a
              href="https://github.com/shadcn-ui/ui/tree/main/apps/v4/app/(examples)/dashboard"
              rel="noopener noreferrer"
              target="_blank"
              className="dark:text-foreground"
            >
              GitHub
            </a>
          </Button>
        </div>
      </div>
    </header>
  )
}
```

**File:** apps/v4/registry/new-york-v4/blocks/dashboard-01/components/data-table.tsx (L339-403)
```typescript
export function DataTable({
  data: initialData,
}: {
  data: z.infer<typeof schema>[]
}) {
  const [data, setData] = React.useState(() => initialData)
  const [rowSelection, setRowSelection] = React.useState({})
  const [columnVisibility, setColumnVisibility] =
    React.useState<VisibilityState>({})
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>(
    []
  )
  const [sorting, setSorting] = React.useState<SortingState>([])
  const [pagination, setPagination] = React.useState({
    pageIndex: 0,
    pageSize: 10,
  })
  const sortableId = React.useId()
  const sensors = useSensors(
    useSensor(MouseSensor, {}),
    useSensor(TouchSensor, {}),
    useSensor(KeyboardSensor, {})
  )

  const dataIds = React.useMemo<UniqueIdentifier[]>(
    () => data?.map(({ id }) => id) || [],
    [data]
  )

  const table = useReactTable({
    data,
    columns,
    state: {
      sorting,
      columnVisibility,
      rowSelection,
      columnFilters,
      pagination,
    },
    getRowId: (row) => row.id.toString(),
    enableRowSelection: true,
    onRowSelectionChange: setRowSelection,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFacetedRowModel: getFacetedRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
  })

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (active && over && active.id !== over.id) {
      setData((data) => {
        const oldIndex = dataIds.indexOf(active.id)
        const newIndex = dataIds.indexOf(over.id)
        return arrayMove(data, oldIndex, newIndex)
      })
    }
  }

```

**File:** apps/v4/registry/new-york-v4/blocks/dashboard-01/components/data-table.tsx (L404-477)
```typescript
  return (
    <Tabs
      defaultValue="outline"
      className="w-full flex-col justify-start gap-6"
    >
      <div className="flex items-center justify-between px-4 lg:px-6">
        <Label htmlFor="view-selector" className="sr-only">
          View
        </Label>
        <Select defaultValue="outline">
          <SelectTrigger
            className="flex w-fit @4xl/main:hidden"
            size="sm"
            id="view-selector"
          >
            <SelectValue placeholder="Select a view" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="outline">Outline</SelectItem>
            <SelectItem value="past-performance">Past Performance</SelectItem>
            <SelectItem value="key-personnel">Key Personnel</SelectItem>
            <SelectItem value="focus-documents">Focus Documents</SelectItem>
          </SelectContent>
        </Select>
        <TabsList className="hidden **:data-[slot=badge]:size-5 **:data-[slot=badge]:rounded-full **:data-[slot=badge]:bg-muted-foreground/30 **:data-[slot=badge]:px-1 @4xl/main:flex">
          <TabsTrigger value="outline">Outline</TabsTrigger>
          <TabsTrigger value="past-performance">
            Past Performance <Badge variant="secondary">3</Badge>
          </TabsTrigger>
          <TabsTrigger value="key-personnel">
            Key Personnel <Badge variant="secondary">2</Badge>
          </TabsTrigger>
          <TabsTrigger value="focus-documents">Focus Documents</TabsTrigger>
        </TabsList>
        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <IconLayoutColumns />
                <span className="hidden lg:inline">Customize Columns</span>
                <span className="lg:hidden">Columns</span>
                <IconChevronDown />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              {table
                .getAllColumns()
                .filter(
                  (column) =>
                    typeof column.accessorFn !== "undefined" &&
                    column.getCanHide()
                )
                .map((column) => {
                  return (
                    <DropdownMenuCheckboxItem
                      key={column.id}
                      className="capitalize"
                      checked={column.getIsVisible()}
                      onCheckedChange={(value) =>
                        column.toggleVisibility(!!value)
                      }
                    >
                      {column.id}
                    </DropdownMenuCheckboxItem>
                  )
                })}
            </DropdownMenuContent>
          </DropdownMenu>
          <Button variant="outline" size="sm">
            <IconPlus />
            <span className="hidden lg:inline">Add Section</span>
          </Button>
        </div>
      </div>
```

**File:** apps/v4/registry/new-york-v4/blocks/dashboard-01/components/data-table.tsx (L509-509)
```typescript
              <TableBody className="**:data-[slot=table-cell]:first:w-8">
```

**File:** apps/v4/registry/new-york-v4/blocks/dashboard-01/components/data-table.tsx (L533-609)
```typescript
        <div className="flex items-center justify-between px-4">
          <div className="hidden flex-1 text-sm text-muted-foreground lg:flex">
            {table.getFilteredSelectedRowModel().rows.length} of{" "}
            {table.getFilteredRowModel().rows.length} row(s) selected.
          </div>
          <div className="flex w-full items-center gap-8 lg:w-fit">
            <div className="hidden items-center gap-2 lg:flex">
              <Label htmlFor="rows-per-page" className="text-sm font-medium">
                Rows per page
              </Label>
              <Select
                value={`${table.getState().pagination.pageSize}`}
                onValueChange={(value) => {
                  table.setPageSize(Number(value))
                }}
              >
                <SelectTrigger size="sm" className="w-20" id="rows-per-page">
                  <SelectValue
                    placeholder={table.getState().pagination.pageSize}
                  />
                </SelectTrigger>
                <SelectContent side="top">
                  {[10, 20, 30, 40, 50].map((pageSize) => (
                    <SelectItem key={pageSize} value={`${pageSize}`}>
                      {pageSize}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex w-fit items-center justify-center text-sm font-medium">
              Page {table.getState().pagination.pageIndex + 1} of{" "}
              {table.getPageCount()}
            </div>
            <div className="ml-auto flex items-center gap-2 lg:ml-0">
              <Button
                variant="outline"
                className="hidden h-8 w-8 p-0 lg:flex"
                onClick={() => table.setPageIndex(0)}
                disabled={!table.getCanPreviousPage()}
              >
                <span className="sr-only">Go to first page</span>
                <IconChevronsLeft />
              </Button>
              <Button
                variant="outline"
                className="size-8"
                size="icon"
                onClick={() => table.previousPage()}
                disabled={!table.getCanPreviousPage()}
              >
                <span className="sr-only">Go to previous page</span>
                <IconChevronLeft />
              </Button>
              <Button
                variant="outline"
                className="size-8"
                size="icon"
                onClick={() => table.nextPage()}
                disabled={!table.getCanNextPage()}
              >
                <span className="sr-only">Go to next page</span>
                <IconChevronRight />
              </Button>
              <Button
                variant="outline"
                className="hidden size-8 lg:flex"
                size="icon"
                onClick={() => table.setPageIndex(table.getPageCount() - 1)}
                disabled={!table.getCanNextPage()}
              >
                <span className="sr-only">Go to last page</span>
                <IconChevronsRight />
              </Button>
            </div>
          </div>
        </div>
```

**File:** apps/v4/registry/new-york-v4/blocks/dashboard-01/components/data-table.tsx (L639-648)
```typescript
const chartConfig = {
  desktop: {
    label: "Desktop",
    color: "var(--primary)",
  },
  mobile: {
    label: "Mobile",
    color: "var(--primary)",
  },
} satisfies ChartConfig
```

**File:** apps/v4/registry/new-york-v4/ui/empty.tsx (L1-104)
```typescript
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

function Empty({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="empty"
      className={cn(
        "flex min-w-0 flex-1 flex-col items-center justify-center gap-6 rounded-lg border-dashed p-6 text-center text-balance md:p-12",
        className
      )}
      {...props}
    />
  )
}

function EmptyHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="empty-header"
      className={cn(
        "flex max-w-sm flex-col items-center gap-2 text-center",
        className
      )}
      {...props}
    />
  )
}

const emptyMediaVariants = cva(
  "mb-2 flex shrink-0 items-center justify-center [&_svg]:pointer-events-none [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-transparent",
        icon: "flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted text-foreground [&_svg:not([class*='size-'])]:size-6",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function EmptyMedia({
  className,
  variant = "default",
  ...props
}: React.ComponentProps<"div"> & VariantProps<typeof emptyMediaVariants>) {
  return (
    <div
      data-slot="empty-icon"
      data-variant={variant}
      className={cn(emptyMediaVariants({ variant, className }))}
      {...props}
    />
  )
}

function EmptyTitle({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="empty-title"
      className={cn("text-lg font-medium tracking-tight", className)}
      {...props}
    />
  )
}

function EmptyDescription({ className, ...props }: React.ComponentProps<"p">) {
  return (
    <div
      data-slot="empty-description"
      className={cn(
        "text-sm/relaxed text-muted-foreground [&>a]:underline [&>a]:underline-offset-4 [&>a:hover]:text-primary",
        className
      )}
      {...props}
    />
  )
}

function EmptyContent({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="empty-content"
      className={cn(
        "flex w-full max-w-sm min-w-0 flex-col items-center gap-4 text-sm text-balance",
        className
      )}
      {...props}
    />
  )
}

export {
  Empty,
  EmptyHeader,
  EmptyTitle,
  EmptyDescription,
  EmptyContent,
  EmptyMedia,
}
```

**File:** apps/v4/registry/new-york-v4/ui/sheet.tsx (L9-29)
```typescript
function Sheet({ ...props }: React.ComponentProps<typeof SheetPrimitive.Root>) {
  return <SheetPrimitive.Root data-slot="sheet" {...props} />
}

function SheetTrigger({
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Trigger>) {
  return <SheetPrimitive.Trigger data-slot="sheet-trigger" {...props} />
}

function SheetClose({
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Close>) {
  return <SheetPrimitive.Close data-slot="sheet-close" {...props} />
}

function SheetPortal({
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Portal>) {
  return <SheetPrimitive.Portal data-slot="sheet-portal" {...props} />
}
```

**File:** apps/v4/registry/new-york-v4/ui/sheet.tsx (L47-86)
```typescript
function SheetContent({
  className,
  children,
  side = "right",
  showCloseButton = true,
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Content> & {
  side?: "top" | "right" | "bottom" | "left"
  showCloseButton?: boolean
}) {
  return (
    <SheetPortal>
      <SheetOverlay />
      <SheetPrimitive.Content
        data-slot="sheet-content"
        className={cn(
          "fixed z-50 flex flex-col gap-4 bg-background shadow-lg transition ease-in-out data-[state=closed]:animate-out data-[state=closed]:duration-300 data-[state=open]:animate-in data-[state=open]:duration-500",
          side === "right" &&
            "inset-y-0 right-0 h-full w-3/4 border-l data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right sm:max-w-sm",
          side === "left" &&
            "inset-y-0 left-0 h-full w-3/4 border-r data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left sm:max-w-sm",
          side === "top" &&
            "inset-x-0 top-0 h-auto border-b data-[state=closed]:slide-out-to-top data-[state=open]:slide-in-from-top",
          side === "bottom" &&
            "inset-x-0 bottom-0 h-auto border-t data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom",
          className
        )}
        {...props}
      >
        {children}
        {showCloseButton && (
          <SheetPrimitive.Close className="absolute top-4 right-4 rounded-xs opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:outline-hidden disabled:pointer-events-none data-[state=open]:bg-secondary">
            <XIcon className="size-4" />
            <span className="sr-only">Close</span>
          </SheetPrimitive.Close>
        )}
      </SheetPrimitive.Content>
    </SheetPortal>
  )
}
```

**File:** apps/v4/registry/new-york-v4/blocks/dashboard-01/components/app-sidebar.tsx (L153-181)
```typescript
export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  return (
    <Sidebar collapsible="offcanvas" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              className="data-[slot=sidebar-menu-button]:p-1.5!"
            >
              <a href="#">
                <IconInnerShadowTop className="size-5!" />
                <span className="text-base font-semibold">Acme Inc.</span>
              </a>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={data.navMain} />
        <NavDocuments items={data.documents} />
        <NavSecondary items={data.navSecondary} className="mt-auto" />
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={data.user} />
      </SidebarFooter>
    </Sidebar>
  )
}
```

**File:** apps/v4/registry/new-york-v4/ui/select.tsx (L9-52)
```typescript
function Select({
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Root>) {
  return <SelectPrimitive.Root data-slot="select" {...props} />
}

function SelectGroup({
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Group>) {
  return <SelectPrimitive.Group data-slot="select-group" {...props} />
}

function SelectValue({
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Value>) {
  return <SelectPrimitive.Value data-slot="select-value" {...props} />
}

function SelectTrigger({
  className,
  size = "default",
  children,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Trigger> & {
  size?: "sm" | "default"
}) {
  return (
    <SelectPrimitive.Trigger
      data-slot="select-trigger"
      data-size={size}
      className={cn(
        "flex w-fit items-center justify-between gap-2 rounded-md border border-input bg-transparent px-3 py-2 text-sm whitespace-nowrap shadow-xs transition-[color,box-shadow] outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 data-[placeholder]:text-muted-foreground data-[size=default]:h-9 data-[size=sm]:h-8 *:data-[slot=select-value]:line-clamp-1 *:data-[slot=select-value]:flex *:data-[slot=select-value]:items-center *:data-[slot=select-value]:gap-2 dark:bg-input/30 dark:hover:bg-input/50 dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 [&_svg:not([class*='text-'])]: ... (truncated)
        className
      )}
      {...props}
    >
      {children}
      <SelectPrimitive.Icon asChild>
        <ChevronDownIcon className="size-4 opacity-50" />
      </SelectPrimitive.Icon>
    </SelectPrimitive.Trigger>
  )
}

```

**File:** apps/v4/registry/new-york-v4/ui/table.tsx (L7-20)
```typescript
function Table({ className, ...props }: React.ComponentProps<"table">) {
  return (
    <div
      data-slot="table-container"
      className="relative w-full overflow-x-auto"
    >
      <table
        data-slot="table"
        className={cn("w-full caption-bottom text-sm", className)}
        {...props}
      />
    </div>
  )
}
```

**File:** apps/v4/registry/new-york-v4/ui/chart.tsx (L37-70)
```typescript
function ChartContainer({
  id,
  className,
  children,
  config,
  ...props
}: React.ComponentProps<"div"> & {
  config: ChartConfig
  children: React.ComponentProps<
    typeof RechartsPrimitive.ResponsiveContainer
  >["children"]
}) {
  const uniqueId = React.useId()
  const chartId = `chart-${id || uniqueId.replace(/:/g, "")}`

  return (
    <ChartContext.Provider value={{ config }}>
      <div
        data-slot="chart"
        data-chart={chartId}
        className={cn(
          "flex aspect-video justify-center text-xs [&_.recharts-cartesian-axis-tick_text]:fill-muted-foreground [&_.recharts-cartesian-grid_line[stroke='#ccc']]:stroke-border/50 [&_.recharts-curve.recharts-tooltip-cursor]:stroke-border [&_.recharts-dot[stroke='#fff']]:stroke-transparent [&_.recharts-layer]:outline-hidden [&_.recharts-polar-grid_[stroke='#ccc']]:stroke-border [&_.recharts-radial-bar-background-sector]:fill-muted [&_.recharts-rectangle.recharts-tooltip-cursor]:fill-muted [&_.recharts-reference-line_[stroke='#ccc']]:stroke-border [&_.recharts-sector]:outline-hidden [&_.recharts-sector[stroke='#fff']]:stroke-transparent [&_.recharts-surface]:outline-hidden",
          className
        )}
        {...props}
      >
        <ChartStyle id={chartId} config={config} />
        <RechartsPrimitive.ResponsiveContainer>
          {children}
        </RechartsPrimitive.ResponsiveContainer>
      </div>
    </ChartContext.Provider>
  )
}
```

**File:** apps/v4/registry/new-york-v4/ui/input.tsx (L5-19)
```typescript
function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "h-9 w-full min-w-0 rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-xs transition-[color,box-shadow] outline-none selection:bg-primary selection:text-primary-foreground file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm dark:bg-input/30",
        "focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50",
        "aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40",
        className
      )}
      {...props}
    />
  )
}
```
