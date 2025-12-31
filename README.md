# Gemini MCP Server

[![smithery badge](https://smithery.ai/badge/mcp-server-gemini)](https://smithery.ai/server/mcp-server-gemini)
[![npm version](https://img.shields.io/npm/v/mcp-server-gemini)](https://www.npmjs.com/package/mcp-server-gemini)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue)](https://www.typescriptlang.org/)
[![MCP Version](https://img.shields.io/badge/MCP-2024--11--05-green)](https://modelcontextprotocol.io/)

A powerful MCP (Model Context Protocol) server that brings Google's Gemini AI models to your favorite development environment through OpenRouter. Access Gemini 3 and 2.5's thinking capabilities, vision analysis, and more through a seamless integration.

🚀 **Works with**: Claude Desktop, Cursor, Windsurf, and any MCP-compatible client
🎯 **Why use this**: Get Gemini's cutting-edge AI features directly in your IDE with full parameter control
📚 **Self-documenting**: Built-in help system means you never need to leave your editor

## Features

- **12 Powerful Tools**: Text generation, image analysis, token counting, model listing, specialized vision tools, and self-documenting help
- **Latest Gemini Models**: Support for Gemini 3 and 2.5 series with thinking capabilities via OpenRouter
- **Advanced Features**: JSON mode, system instructions, conversation memory
- **Full MCP Protocol**: Standard stdio communication for seamless integration with any MCP client
- **Self-Documenting**: Built-in help system - no external docs needed
- **TypeScript & ESM**: Modern, type-safe implementation

### Supported Models

| Model | Context | Features | Best For |
|-------|---------|----------|----------|
| google/gemini-3-flash-preview 🆕 | 1M tokens | Thinking, Vision, Video | Latest Gemini 3 |
| google/gemini-2.5-pro-preview | 2M tokens | Thinking, Vision, Video | Complex reasoning |
| google/gemini-2.5-flash-preview ⭐ | 1M tokens | Thinking, Vision, Video | General use (default) |
| google/gemini-2.5-flash-exp | 1M tokens | Thinking, Vision, Video | Experimental 2.5 |
| google/gemini-2.5-flash-lite | 1M tokens | Thinking, Vision, Video | Lightweight 2.5 |
| google/gemini-2.0-flash-exp | 1M tokens | Vision, Video | Fast with video |
| google/gemini-exp-1206 | 2M tokens | Thinking, Vision, Video | Latest experimental |
| google/gemini-pro-1.5 | 2M tokens | Vision, Video | Previous generation pro |
| google/gemini-flash-1.5 | 1M tokens | Vision | Quick tasks |

## Quick Start

1. **Get OpenRouter API Key**
   - Visit [OpenRouter](https://openrouter.ai/)
   - Create an account and get your API key
   - **IMPORTANT**: Keep your API key secure and never commit it to version control

2. **Configure Your MCP Client**

   <details>
   <summary><b>Claude Desktop</b></summary>

   Config location:
   - Mac: `~/Library/Application Support/Claude/claude_desktop_config.json`
   - Windows: `%APPDATA%\Claude\claude_desktop_config.json`
   - Linux: `~/.config/Claude/claude_desktop_config.json`

   ```json
   {
     "mcpServers": {
       "gemini": {
         "command": "node",
         "args": ["path/to/mcp-server-gemini/dist/enhanced-stdio-server.js"],
         "env": {
           "OPENROUTER_API_KEY": "your_api_key_here",
           "DEFAULT_MODEL": "google/gemini-2.5-flash"
         }
       }
     }
   }
   ```

   **Default model**: `google/gemini-2.5-flash` (configurable via `DEFAULT_MODEL` env var)
   </details>

   <details>
   <summary><b>Cursor</b></summary>

   Add to Cursor's MCP settings:
   ```json
   {
     "gemini": {
       "command": "node",
       "args": ["path/to/mcp-server-gemini/dist/enhanced-stdio-server.js"],
       "env": {
         "OPENROUTER_API_KEY": "your_api_key_here",
         "DEFAULT_MODEL": "google/gemini-2.5-flash"
       }
     }
   }
   ```
   </details>

   <details>
   <summary><b>Other MCP Clients</b></summary>

   Use the standard MCP stdio configuration:
   ```json
   {
     "command": "node",
     "args": ["path/to/mcp-server-gemini/dist/enhanced-stdio-server.js"],
     "env": {
       "OPENROUTER_API_KEY": "your_api_key_here",
       "DEFAULT_MODEL": "google/gemini-2.5-flash"
     }
   }
   ```
   </details>

3. **Restart Your MCP Client**

## How to Use

Once configured, you can use natural language in your MCP client to access Gemini's capabilities:

### Basic Commands
```
"Use Gemini to explain quantum computing"
"Analyze this image with Gemini"
"List all Gemini models"
"Get help on using Gemini"
```

### Advanced Examples
```
"Use Gemini 3 with temperature 0.3 to review this code"
"Use Gemini 2.5 Pro in JSON mode to extract key points with schema {title, summary, tags}"
"Convert this UI screenshot to React code"
```

## Available Tools

### Core Tools

| Tool | Description |
|------|-------------|
| `generate_text` | Generate text using any OpenRouter model with support for system instructions, JSON mode, and conversation memory |
| `analyze_image` | General-purpose image analysis with vision-capable models |
| `count_tokens` | Estimate token count for text |
| `list_models` | List all available Gemini models on OpenRouter |
| `get_help` | Get built-in help documentation |

### Vision Tools

| Tool | Description |
|------|-------------|
| `ui_to_artifact` | Convert UI screenshots to code, prompts, design specs, or descriptions |
| `extract_text_from_screenshot` | OCR text extraction with code-specific accuracy |
| `diagnose_error_screenshot` | Analyze error messages and provide actionable solutions |
| `understand_technical_diagram` | Analyze architecture diagrams, flowcharts, UML, ER diagrams |
| `analyze_data_visualization` | Extract insights from charts, graphs, dashboards |
| `ui_diff_check` | Compare two UI screenshots for visual differences |
| `analyze_image` | General-purpose image analysis |
| `analyze_video` | Video content analysis (MP4, MOV, M4V) |

## Why Gemini MCP Server?

- **Access Latest Models**: Use Gemini 3 and 2.5 with thinking capabilities through OpenRouter
- **Full Feature Set**: All Gemini API features including JSON mode and system instructions
- **Easy Setup**: One-line npm installation, no complex configuration needed
- **Production Ready**: Comprehensive error handling, TypeScript types, and extensive documentation
- **Active Development**: Regular updates with new Gemini features as they're released

## Documentation

Use the built-in `get_help` tool for comprehensive documentation directly in your MCP client.

## Local Development

```bash
# Clone repository
git clone https://github.com/aliargun/mcp-server-gemini.git
cd mcp-server-gemini

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Edit .env and add your OPENROUTER_API_KEY

# Start development server
npm run dev

# Build for production
npm run build
```

## Contributing

Contributions are welcome! Please see our [Contributing Guide](CONTRIBUTING.md).

## Common Issues

1. **Connection Issues**
   - Ensure your MCP client is properly restarted
   - Check the client's logs
   - Verify internet connection

2. **API Key Problems**
   - Verify API key is correct from OpenRouter
   - Ensure the key is set in the environment variable

## Security

- API keys are handled via environment variables only
- Never commit API keys to version control
- No sensitive data is logged or stored
- If your API key is exposed, regenerate it immediately in OpenRouter

## License

MIT
