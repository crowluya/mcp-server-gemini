# MCP Server Gemini - 会话总结

**日期**: 2025-12-31
**版本**: v6.0.0

---

## 本次完成的工作

### 1. 移除 Google GenAI 支持，只保留 OpenRouter

#### 修改文件
| 文件 | 变更 |
|------|------|
| `src/openrouter-client.ts` | 删除 `UnifiedAIClient` (~150行)，新增 `MCPClient` (~30行) |
| `src/enhanced-stdio-server.ts` | 删除 Google 相关代码、`embed_text` 工具 |
| `src/vision-tools.ts` | 更新类型引用 `UnifiedAIClient` → `MCPClient` |
| `package.json` | 删除 `@google/genai` 依赖，版本 6.0.0 |
| `.env.example` | 只保留 `OPENROUTER_API_KEY` |
| `README.md` | 重写为只使用 OpenRouter |
| `CHANGELOG.md` | 添加 v6.0.0 更新日志 |

#### 代码变更
- 删除 ~200-250 行代码
- 新增 ~100 行代码（智能模型切换）
- 净减少 ~100-150 行代码

---

### 2. 新增智能模型切换功能

#### 功能说明
用户通过自然语言关键词即可自动切换模型，无需手动指定。

#### 支持的关键词

| 关键词示例 | 切换到模型 |
|-----------|-----------|
| `gemini 3`, `g-3`, `g3` | `google/gemini-3-flash-preview` |
| `gemini 2.5`, `g-2.5` | `google/gemini-2.5-flash` |
| `2.5 lite`, `g-lite` | `google/gemini-2.5-flash-lite` |
| `2.5 pro`, `g-pro` | `google/gemini-2.5-pro-preview` |
| `gemini 2.0`, `g-2.0` | `google/gemini-2.0-flash-exp` |
| `claude`, `c-3.5` | `anthropic/claude-3.5-sonnet` |
| `gpt-4o`, `gpt4` | `openai/gpt-4o` |

#### 默认模型
`google/gemini-2.5-flash` (未检测到关键词时使用)

#### 使用示例

```
# 默认使用 gemini 2.5 flash
"帮我分析这张图片"

# 自动切换到 gemini 3
"用 gemini 3 帮我分析这张图片"
"使用 g-3 识图"

# 自动切换到 gemini 2.5 pro
"用 gemini pro 识别这张图"

# 自动切换到 claude
"用 claude 分析一下"
```

#### 工作原理
1. 系统检测文本中的模型关键词
2. 匹配到关键词后自动切换模型
3. 日志显示: `Detected model keyword "gemini 3" -> google/gemini-3-flash-preview`

---

## 配置

### Claude Desktop 配置

**配置文件位置**: `~/Library/Application Support/Claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "gemini": {
      "command": "node",
      "args": [
        "/Users/jing/Desktop/code/gemini-image-mcp/mcp-server-gemini/dist/enhanced-stdio-server.js"
      ],
      "env": {
        "OPENROUTER_API_KEY": "sk-or-v1-xxx"
      }
    }
  }
}
```

### 环境变量

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `OPENROUTER_API_KEY` | OpenRouter API密钥 (必填) | - |
| `DEFAULT_MODEL` | 默认模型 | `google/gemini-2.5-flash` |
| `AVAILABLE_MODELS` | 可用模型列表 (逗号分隔) | `google/gemini-2.5-flash,...` |

---

## 项目路径

- **项目**: `/Users/jing/Desktop/code/gemini-image-mcp/mcp-server-gemini`
- **编译输出**: `dist/enhanced-stdio-server.js`
- **当前分支**: `dev`

---

## 可用工具

### 核心工具
- `generate_text` - 文本生成
- `analyze_image` - 通用图像分析
- `count_tokens` - Token 计数
- `list_models` - 列出模型
- `get_help` - 帮助文档

### 视觉工具
- `ui_to_artifact` - UI 转代码/提示词
- `extract_text_from_screenshot` - OCR 文字提取
- `diagnose_error_screenshot` - 错误诊断
- `understand_technical_diagram` - 技术图分析
- `analyze_data_visualization` - 数据图表分析
- `ui_diff_check` - UI 对比
- `analyze_video` - 视频分析

---

## 下一步测试

1. **重启 Claude Desktop** - 加载新代码
2. **测试默认模型** - "帮我分析这张图" → 使用 `gemini-2.5-flash`
3. **测试关键词切换** - "用 gemini 3 识图" → 使用 `gemini-3-flash-preview`
4. **测试其他关键词** - claude、gpt-4o 等

---

## 待办事项

- [ ] 重启 Claude Desktop
- [ ] 测试智能模型切换功能
- [ ] 验证所有视觉工具正常工作
- [ ] 提交代码到 git
- [ ] 创建 PR 合并到 main
