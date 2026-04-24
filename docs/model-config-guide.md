# 模型配置问题解决方案

## 错误原因

```
ValueError: No chat model could be resolved. Please configure at least one model in config.yaml or provide a valid 'model_name'/'model' in the request.
```

这个错误表明 `config.yaml` 中没有配置任何可用的聊天模型。

## 解决方案

### 方案一：配置至少一个模型（推荐）

编辑 `config.yaml` 文件，在 `models` 部分添加至少一个模型配置。

#### 示例 1: OpenAI GPT-4

```yaml
models:
  - name: gpt-4
    display_name: GPT-4
    use: langchain_openai:ChatOpenAI
    model: gpt-4
    api_key: $OPENAI_API_KEY  # 从环境变量读取
    request_timeout: 600.0
    max_retries: 2
    max_tokens: 4096
    temperature: 0.7
    supports_vision: true
```

然后设置环境变量：

```bash
export OPENAI_API_KEY="your-openai-api-key"
```

#### 示例 2: DeepSeek V3 (支持思考模式)

```yaml
models:
  - name: deepseek-v3
    display_name: DeepSeek V3 (Thinking)
    use: deerflow.models.patched_deepseek:PatchedChatDeepSeek
    model: deepseek-reasoner
    api_key: $DEEPSEEK_API_KEY
    timeout: 600.0
    max_retries: 2
    max_tokens: 8192
    supports_thinking: true
    supports_vision: false
    when_thinking_enabled:
      extra_body:
        thinking:
          type: enabled
```

然后设置环境变量：

```bash
export DEEPSEEK_API_KEY="your-deepseek-api-key"
```

#### 示例 3: Kimi K2.5

```yaml
models:
  - name: kimi-k2.5
    display_name: Kimi K2.5
    use: deerflow.models.patched_deepseek:PatchedChatDeepSeek
    model: kimi-k2.5
    api_base: https://api.moonshot.cn/v1
    api_key: $MOONSHOT_API_KEY
    timeout: 600.0
    max_retries: 2
    max_tokens: 32768
    supports_thinking: true
    supports_vision: true
    when_thinking_enabled:
      extra_body:
        thinking:
          type: enabled
```

然后设置环境变量：

```bash
export MOONSHOT_API_KEY="your-moonshot-api-key"
```

#### 示例 4: MiniMax M2.5

```yaml
models:
  - name: minimax-m2.5
    display_name: MiniMax M2.5
    use: langchain_openai:ChatOpenAI
    model: MiniMax-M2.5
    api_key: $MINIMAX_API_KEY
    base_url: https://api.minimax.io/v1
    request_timeout: 600.0
    max_retries: 2
    max_tokens: 4096
    temperature: 1.0  # MiniMax requires temperature in (0.0, 1.0]
    supports_vision: true
```

然后设置环境变量：

```bash
export MINIMAX_API_KEY="your-minimax-api-key"
```

### 方案二：使用 .env 文件

创建或编辑 `.env` 文件：

```bash
# .env 文件示例

# OpenAI
OPENAI_API_KEY=sk-your-openai-api-key

# DeepSeek
DEEPSEEK_API_KEY=your-deepseek-api-key

# Kimi (Moonshot)
MOONSHOT_API_KEY=your-moonshot-api-key

# MiniMax
MINIMAX_API_KEY=your-minimax-api-key

# Anthropic
ANTHROPIC_API_KEY=your-anthropic-api-key

# Google Gemini
GEMINI_API_KEY=your-gemini-api-key
```

### 方案三：在请求中指定模型

如果你不想修改 `config.yaml`，可以在创建 agent 时指定模型：

```python
config = {
    "configurable": {
        "thread_id": "debug-thread-001",
        "model_name": "gpt-4",  # 指定模型名称
        "thinking_enabled": True,
        "is_plan_mode": True,
    }
}
```

但前提是 `config.yaml` 中必须配置了该模型。

## 快速配置步骤

### 1. 选择一个模型提供商

推荐使用以下模型（按成本和性能排序）：

1. **DeepSeek V3** - 性价比高，支持思考模式
2. **Kimi K2.5** - 中文能力强，支持长上下文
3. **MiniMax M2.5** - 高性能，204K 上下文
4. **OpenAI GPT-4** - 最稳定，功能最全

### 2. 获取 API Key

- DeepSeek: https://platform.deepseek.com/
- Kimi: https://platform.moonshot.cn/
- MiniMax: https://platform.minimax.io/
- OpenAI: https://platform.openai.com/

### 3. 配置 config.yaml

编辑 `config.yaml`，取消注释或添加模型配置：

```yaml
models:
  # 选择一个或多个模型
  - name: deepseek-v3
    display_name: DeepSeek V3
    use: deerflow.models.patched_deepseek:PatchedChatDeepSeek
    model: deepseek-reasoner
    api_key: $DEEPSEEK_API_KEY
    timeout: 600.0
    max_retries: 2
    max_tokens: 8192
    supports_thinking: true
    supports_vision: false
```

### 4. 设置环境变量

```bash
# 方式 1: 直接设置
export DEEPSEEK_API_KEY="your-api-key"

# 方式 2: 写入 .env 文件
echo 'DEEPSEEK_API_KEY=your-api-key' >> .env
```

### 5. 重启服务

```bash
# 重启后端
./scripts/start-backend.sh

# 或重启 debug_studio
cd backend
PYTHONPATH=packages/studio:. uv run python debug_studio.py
```

## 验证配置

### 检查模型是否加载

```python
from deerflow.config import get_app_config

app_config = get_app_config()
models = app_config.models
print(f"Configured models: {[m.name for m in models]}")
```

### 测试模型调用

```python
from deerflow.agents import make_lead_agent

config = {
    "configurable": {
        "thread_id": "test-thread",
        "model_name": "deepseek-v3",  # 使用配置的模型名称
    }
}

agent = make_lead_agent(config)
print("✓ Agent created successfully!")
```

## 常见问题

### Q: 配置了模型但仍然报错？

A: 检查以下几点：

1. **环境变量是否设置**：
   ```bash
   echo $DEEPSEEK_API_KEY  # 应该输出你的 API key
   ```

2. **config.yaml 格式是否正确**：
   - 确保缩进正确（使用空格，不是 Tab）
   - 确保 `models:` 后面有正确的 `- name:` 列表

3. **模型名称是否正确**：
   - 检查 `model` 字段的值是否是提供商支持的模型名

### Q: 如何使用多个模型？

A: 在 `models` 列表中添加多个模型：

```yaml
models:
  - name: gpt-4
    display_name: GPT-4
    use: langchain_openai:ChatOpenAI
    model: gpt-4
    api_key: $OPENAI_API_KEY
    # ... 其他配置

  - name: deepseek-v3
    display_name: DeepSeek V3
    use: deerflow.models.patched_deepseek:PatchedChatDeepSeek
    model: deepseek-reasoner
    api_key: $DEEPSEEK_API_KEY
    # ... 其他配置
```

然后在请求中指定要使用的模型：

```python
config = {
    "configurable": {
        "model_name": "deepseek-v3",  # 使用 DeepSeek
    }
}
```

### Q: 如何查看当前配置？

A: 运行以下命令：

```bash
# 查看配置文件
cat config.yaml

# 查看环境变量
env | grep API_KEY
```

## 推荐配置示例

以下是推荐的完整配置示例（使用 DeepSeek V3）：

```yaml
# config.yaml

config_version: 4
log_level: info

models:
  - name: deepseek-v3
    display_name: DeepSeek V3
    use: deerflow.models.patched_deepseek:PatchedChatDeepSeek
    model: deepseek-reasoner
    api_key: $DEEPSEEK_API_KEY
    timeout: 600.0
    max_retries: 2
    max_tokens: 8192
    supports_thinking: true
    supports_vision: false
    when_thinking_enabled:
      extra_body:
        thinking:
          type: enabled

# 其他配置保持默认...
```

```bash
# .env
DEEPSEEK_API_KEY=your-deepseek-api-key-here
```

配置完成后，重启服务即可正常使用。
