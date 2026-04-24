# 依赖安装完成

## 已安装的依赖

### @radix-ui/react-label

```bash
pnpm add @radix-ui/react-label
```

**版本**: 2.1.8

**用途**: Label 组件的基础依赖

## Label 组件

**文件**: `frontend/src/components/ui/label.tsx`

### 使用方法

```tsx
import { Label } from "@/components/ui/label";

// 基本使用
<Label htmlFor="email">Email</Label>
<Input id="email" type="email" />

// 带样式
<Label className="text-red-500" htmlFor="name">
  Name
</Label>
```

### 特性

- 基于 Radix UI 的 Label 原语
- 自动关联表单控件
- 支持禁用状态样式
- 可自定义样式

### 样式

默认样式：
```css
text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70
```

## 验证

### 1. 检查依赖是否安装

```bash
cd frontend
pnpm list @radix-ui/react-label
```

应该显示：
```
@radix-ui/react-label 2.1.8
```

### 2. 检查组件是否可用

在代码中导入：
```tsx
import { Label } from "@/components/ui/label";
```

如果没有报错，说明组件可用。

### 3. 测试组件

创建测试页面：
```tsx
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

export default function TestPage() {
  return (
    <div className="space-y-2">
      <Label htmlFor="test">Test Label</Label>
      <Input id="test" placeholder="Test input" />
    </div>
  );
}
```

## 相关组件

Label 组件通常与以下组件一起使用：

- `Input` - 输入框
- `Textarea` - 文本域
- `Select` - 选择器
- `Checkbox` - 复选框

## 示例：表单字段

```tsx
<div className="space-y-2">
  <Label htmlFor="title">Title *</Label>
  <Input
    id="title"
    value={title}
    onChange={(e) => setTitle(e.target.value)}
    placeholder="Enter title"
  />
</div>
```

## 已解决的问题

✅ Module not found: Can't resolve '@radix-ui/react-label'

**解决方案**: 安装 `@radix-ui/react-label` 依赖

```bash
pnpm add @radix-ui/react-label
```

## 下一步

现在可以正常使用 Label 组件了：

1. ✅ 依赖已安装
2. ✅ 组件已创建
3. ✅ 可以在表单中使用

所有问题已解决！
