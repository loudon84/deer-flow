# 模板 Model Configuration 优化

## 已完成的优化

### 1. 模型选择优化

#### 之前
- 手动输入模型名称
- 无法知道哪些模型可用
- 无法知道模型支持哪些功能

#### 现在
- ✅ 从下拉列表选择模型
- ✅ 自动加载 `config.yaml` 中配置的模型
- ✅ 显示模型显示名称和描述
- ✅ 显示模型支持的功能（thinking、reasoning effort）

### 2. 推理深度选项

#### 新增功能
- ✅ 根据选择的模型动态显示
- ✅ 仅当模型支持 `reasoning_effort` 时显示
- ✅ 三个级别：Low、Medium、High

#### 推理深度说明
- **Low** - 快速响应，适合简单任务
- **Medium** - 平衡模式，适合大多数任务
- **High** - 深度推理，适合复杂任务

## 实现细节

### 1. 加载模型列表

**API**: `frontend/src/core/models/api.ts`

```typescript
export async function loadModels() {
  const res = await fetch(`${getBackendBaseURL()}/api/models`);
  const { models } = (await res.json()) as { models: Model[] };
  return models;
}
```

**Model 类型**:

```typescript
export interface Model {
  id: string;
  name: string;
  model: string;
  display_name: string;
  description?: string | null;
  supports_thinking?: boolean;
  supports_reasoning_effort?: boolean;
}
```

### 2. 表单组件更新

**文件**: `frontend/src/components/workspace/studio/template-create-form.tsx`

#### 模型选择

```tsx
<Select 
  value={defaultModelName} 
  onValueChange={setDefaultModelName}
  disabled={modelsLoading}
>
  <SelectTrigger>
    {modelsLoading ? (
      <div className="flex items-center gap-2">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span>Loading models...</span>
      </div>
    ) : (
      <SelectValue placeholder="Select a model" />
    )}
  </SelectTrigger>
  <SelectContent>
    {models.map((model) => (
      <SelectItem key={model.name} value={model.name}>
        <div className="flex flex-col">
          <span>{model.display_name}</span>
          {model.description && (
            <span className="text-muted-foreground text-xs">
              {model.description}
            </span>
          )}
        </div>
      </SelectItem>
    ))}
  </SelectContent>
</Select>
```

#### 模型能力提示

```tsx
{selectedModel && (
  <p className="text-muted-foreground text-sm">
    {selectedModel.supports_thinking && "✓ Supports thinking"}
    {selectedModel.supports_thinking && selectedModel.supports_reasoning_effort && " • "}
    {selectedModel.supports_reasoning_effort && "✓ Supports reasoning effort"}
  </p>
)}
```

#### 推理深度选择

```tsx
{supportsReasoningEffort && (
  <div className="mt-4 space-y-2">
    <Label htmlFor="reasoningEffort">Reasoning Effort</Label>
    <Select value={reasoningEffort} onValueChange={setReasoningEffort}>
      <SelectTrigger>
        <SelectValue placeholder="Select reasoning effort level" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="low">Low - Quick responses</SelectItem>
        <SelectItem value="medium">Medium - Balanced</SelectItem>
        <SelectItem value="high">High - Deep reasoning</SelectItem>
      </SelectContent>
    </Select>
    <p className="text-muted-foreground text-sm">
      Controls how much effort the model puts into reasoning. 
      Higher effort = better quality but slower.
    </p>
  </div>
)}
```

## 使用流程

### 1. 访问创建模板页面

```
/workspace/studio/templates/new
```

### 2. 填写基本信息

- Name
- Code
- Description
- Category
- Status
- Tags

### 3. 配置模型

#### 步骤 1: 选择模型
- 从下拉列表选择已配置的模型
- 查看模型支持的功能

#### 步骤 2: 选择生成模式
- Single Pass - 单次生成
- Outline Then Write - 先大纲后正文

#### 步骤 3: 设置推理深度（可选）
- 如果模型支持，会自动显示推理深度选项
- 选择 Low/Medium/High

### 4. 配置 Prompt

- System Prompt
- User Prompt Template

### 5. 定义输入 Schema

- JSON Schema 格式

### 6. 提交创建

## 示例

### 示例 1: DeepSeek V3 模板

**模型配置**:
- Model: DeepSeek V3
- Generation Mode: Outline Then Write
- Reasoning Effort: High

**模型能力显示**:
```
✓ Supports thinking • ✓ Supports reasoning effort
```

### 示例 2: GPT-4 模板

**模型配置**:
- Model: GPT-4
- Generation Mode: Single Pass
- Reasoning Effort: (不显示，因为 GPT-4 不支持)

**模型能力显示**:
```
(无特殊能力提示)
```

## 后端要求

### 模型列表 API

```
GET /api/models
```

响应：
```json
{
  "models": [
    {
      "id": "deepseek-v3",
      "name": "deepseek-v3",
      "model": "deepseek-reasoner",
      "display_name": "DeepSeek V3",
      "description": "DeepSeek's reasoning model",
      "supports_thinking": true,
      "supports_reasoning_effort": true
    },
    {
      "id": "gpt-4",
      "name": "gpt-4",
      "model": "gpt-4",
      "display_name": "GPT-4",
      "description": "OpenAI's GPT-4",
      "supports_thinking": false,
      "supports_reasoning_effort": false
    }
  ]
}
```

### 创建模板 API

```
POST /api/v1/templates
```

请求体（新增 `reasoning_effort` 字段）：
```json
{
  "name": "Blog Article Template",
  "code": "blog-article",
  "category": "blog",
  "default_model_name": "deepseek-v3",
  "default_generation_mode": "outline_then_write",
  "reasoning_effort": "high",
  ...
}
```

## 优化效果

### 用户体验提升

1. ✅ **无需记忆模型名称** - 从列表选择
2. ✅ **了解模型能力** - 显示支持的功能
3. ✅ **智能表单** - 根据模型动态显示选项
4. ✅ **加载状态** - 显示加载进度
5. ✅ **错误提示** - 加载失败时提示

### 数据准确性提升

1. ✅ **模型名称正确** - 从配置加载
2. ✅ **功能匹配** - 根据模型能力显示选项
3. ✅ **避免错误配置** - 不支持的功能不显示

## 文件变更

**修改文件**:
- `frontend/src/components/workspace/studio/template-create-form.tsx`

**依赖文件**:
- `frontend/src/core/models/api.ts` - 模型加载 API
- `frontend/src/core/models/types.ts` - Model 类型定义

## 下一步

模板创建表单已优化完成，现在可以：

1. ✅ 从配置的模型列表选择
2. ✅ 查看模型支持的功能
3. ✅ 根据模型设置推理深度
4. ✅ 创建更准确的模板配置

所有优化已完成！
