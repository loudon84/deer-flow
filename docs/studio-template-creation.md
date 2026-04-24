# Studio 模板创建功能

## 已添加的功能

### 1. 模板列表页面增强

**文件**: `frontend/src/app/workspace/studio/templates/page.tsx`

添加了"Create Template"按钮：

```tsx
<Button asChild>
  <Link href="/workspace/studio/templates/new">
    <Plus className="mr-2 h-4 w-4" />
    Create Template
  </Link>
</Button>
```

### 2. 创建模板页面

**文件**: `frontend/src/app/workspace/studio/templates/new/page.tsx`

新建模板的页面路由。

### 3. 创建模板表单组件

**文件**: `frontend/src/components/workspace/studio/template-create-form.tsx`

完整的模板创建表单，包含：

#### 基本信息
- **Name*** - 模板名称（必填）
- **Code*** - 模板代码（必填）
- **Description** - 模板描述
- **Category*** - 分类（必填）
- **Status** - 状态（draft/active/archived）
- **Tags** - 标签（逗号分隔）

#### 模型配置
- **Default Model Name** - 默认模型名称
- **Generation Mode** - 生成模式
  - Single Pass - 单次生成
  - Outline Then Write - 先大纲后正文

#### Prompt 配置
- **System Prompt** - 系统提示词
- **User Prompt Template** - 用户提示词模板
  - 支持 `{{variable}}` 语法引用输入变量

#### 输入 Schema
- **JSON Schema** - 定义模板的输入参数

### 4. API 支持

**文件**: `frontend/src/core/studio/api/templates.ts`

添加了 `createTemplate` API：

```typescript
export function createTemplate(payload: {
  name: string;
  code: string;
  description?: string;
  category: string;
  status?: string;
  default_model_name?: string;
  default_generation_mode?: string;
  tags?: string[];
  system_prompt?: string;
  user_prompt_template?: string;
  schema?: Record<string, unknown>;
}) {
  return articleStudioClient.post<{ id: string }>(
    "/api/v1/templates",
    payload,
  );
}
```

### 5. React Query Hook

**文件**: `frontend/src/core/studio/hooks/use-templates.ts`

添加了 `useCreateTemplate` hook：

```typescript
export function useCreateTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createTemplate,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["article-studio", "templates"] });
    },
  });
}
```

### 6. UI 组件

**文件**: `frontend/src/components/ui/label.tsx`

添加了 Label 组件（基于 Radix UI）。

## 使用流程

### 1. 访问模板列表

```
http://localhost:3000/workspace/studio/templates
```

### 2. 点击"Create Template"按钮

跳转到创建页面：
```
http://localhost:3000/workspace/studio/templates/new
```

### 3. 填写表单

#### 示例：创建博客文章模板

**基本信息**:
- Name: `Blog Article Template`
- Code: `blog-article`
- Description: `Template for creating blog articles`
- Category: `blog`
- Status: `active`
- Tags: `blog, article, content`

**模型配置**:
- Default Model Name: `deepseek-v3`
- Generation Mode: `outline_then_write`

**Prompt 配置**:
- System Prompt:
  ```
  You are a professional blog writer. Write engaging and informative articles.
  ```

- User Prompt Template:
  ```
  Write a blog article about: {{title}}
  
  Target audience: {{audience}}
  Tone: {{tone}}
  Length: {{length}} words
  ```

**输入 Schema**:
```json
{
  "type": "object",
  "properties": {
    "title": {
      "type": "string",
      "description": "Article title"
    },
    "audience": {
      "type": "string",
      "description": "Target audience"
    },
    "tone": {
      "type": "string",
      "enum": ["formal", "casual", "technical"],
      "default": "casual"
    },
    "length": {
      "type": "number",
      "description": "Target word count",
      "default": 1000
    }
  },
  "required": ["title"]
}
```

### 4. 提交创建

点击"Create Template"按钮，成功后自动跳转到模板详情页。

## 表单验证

### 必填字段
- ✅ Name - 不能为空
- ✅ Code - 不能为空
- ✅ Category - 不能为空

### 格式验证
- ✅ Schema - 必须是有效的 JSON

### 提交处理
- ✅ 显示加载状态
- ✅ 成功后跳转到详情页
- ✅ 失败后显示错误提示

## 后端 API 要求

创建模板的 API 端点：

```
POST /api/v1/templates
```

请求体：
```json
{
  "name": "Blog Article Template",
  "code": "blog-article",
  "description": "Template for creating blog articles",
  "category": "blog",
  "status": "active",
  "default_model_name": "deepseek-v3",
  "default_generation_mode": "outline_then_write",
  "tags": ["blog", "article", "content"],
  "system_prompt": "You are a professional blog writer...",
  "user_prompt_template": "Write a blog article about: {{title}}...",
  "schema": {
    "type": "object",
    "properties": {...}
  }
}
```

响应：
```json
{
  "id": "template-id-here"
}
```

## 文件结构

```
frontend/src/
├── app/workspace/studio/templates/
│   ├── page.tsx                    # 模板列表（已添加创建按钮）
│   ├── new/
│   │   └── page.tsx                # 创建模板页面
│   └── [templateId]/
│       └── page.tsx                # 模板详情
├── components/workspace/studio/
│   ├── create-template-form.tsx    # 创建模板表单
│   └── index.ts                    # 导出所有组件
├── core/studio/
│   ├── api/
│   │   └── templates.ts            # API（已添加 createTemplate）
│   └── hooks/
│       └── use-templates.ts        # Hooks（已添加 useCreateTemplate）
└── components/ui/
    └── label.tsx                   # Label 组件
```

## 下一步

模板创建功能已完成，用户现在可以：

1. ✅ 查看模板列表
2. ✅ 创建新模板
3. ✅ 查看模板详情
4. ✅ 查看模板版本
5. ✅ 使用模板创建文章

所有功能已实现并可以正常使用！
