# MCP 服务器报错修复记录

## 问题描述

在使用 `gemini-image-mcp` 工具时出现报错：
```
MCP error -32603: No AI provider available
```

## 问题原因

MCP 服务器 (`enhanced-stdio-server.js`) 在启动时没有读取到 API 密钥配置。

**检测逻辑** (src/openrouter-client.ts:443)：
```typescript
if (!this.openRouterClient && !this.googleGenAI) {
  throw new Error('No AI provider available');
}
```

## 配置文件

位置：`~/Library/Application Support/Claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "gemini": {
      "command": "node",
      "args": [
        "/Users/jing/Desktop/code/gemini-image-mcp/mcp-server-gemini/dist/enhanced-stdio-server.js"
      ],
      "env": {
        "OPENROUTER_API_KEY": "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",
        "DEFAULT_MODEL": "google/gemini-2.5-flash"
      }
    }
  }
}
```

## 解决方案

### 方法一：重启 Claude Desktop（推荐）

完全退出 Claude Desktop 应用，然后重新启动。

### 方法二：杀掉服务器进程

```bash
# 查找进程
ps aux | grep gemini

# 杀掉进程（替换 PID）
kill <PID>
```

Claude Desktop 会自动重启服务器并加载新的环境变量。

## 验证修复

服务器重启后，测试工具是否正常工作：

```bash
# 测试 generate_text 工具
mcp__gemini-image-mcp__generate_text
prompt: "Hello, this is a test"
model: "google/gemini-2.5-flash"
```

## 可用工具列表

| 工具 | 功能 |
|------|------|
| `generate_text` | 生成文本 |
| `analyze_image` | 通用图片分析 |
| `ui_to_artifact` | UI 截图转代码/描述 |
| `extract_text_from_screenshot` | OCR 文字提取 |
| `diagnose_error_screenshot` | 错误截图诊断 |
| `understand_technical_diagram` | 技术图分析 |
| `analyze_data_visualization` | 数据图表分析 |
| `ui_diff_check` | UI 对比检查 |
| `analyze_video` | 视频内容分析 |
| `list_models` | 列出可用模型 |
