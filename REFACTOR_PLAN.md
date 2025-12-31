# 移除 Google GenAI 支持 - 只保留 OpenRouter

## 目标
将项目简化为只使用 OpenRouter API，移除所有 Google GenAI 相关代码和回退逻辑。

## 影响范围

### 1. package.json
| 行号 | 修改 |
|------|------|
| 21 | 删除 `"@google/genai": "^1.8.0"` 依赖 |
| 3 | 更新 description，移除 Google GenAI 提及 |
| 版本 | 更新版本号到 6.0.0 |

### 2. src/openrouter-client.ts
| 行号 | 修改 |
|------|------|
| 1-5 | 更新文件头部注释，移除 "with fallback to direct Google GenAI API" |
| 316-465 | **删除整个 `UnifiedAIClient` 类**，用简化的 `MCPClient` 替代 |

新 `MCPClient` 类设计：
```typescript
class MCPClient {
  private openRouterClient: OpenRouterClient;

  constructor(openRouterKey: string, baseURL?: string) {
    this.openRouterClient = new OpenRouterClient({ apiKey: openRouterKey, baseURL });
  }

  async chat(params): Promise<{ text: string; usage?: { total_tokens: number } }> {
    return await this.openRouterClient.chat(params);
  }

  listModels(filter?: string) {
    return this.openRouterClient.listModels(filter);
  }
}
```

### 3. src/enhanced-stdio-server.ts
| 行号 | 修改 |
|------|------|
| 4 | 更新导入：`import { MCPClient, OPENROUTER_GEMINI_MODELS } from './openrouter-client.js';` |
| 13-54 | **删除 `ALL_GEMINI_MODELS`**，直接使用 `OPENROUTER_GEMINI_MODELS` |
| 57 | 重命名 `aiClient: UnifiedAIClient` → `aiClient: MCPClient` |
| 59-60 | 删除 `activeProvider` 属性 |
| 64-82 | 简化构造函数，只接受 `openRouterKey` |
| 84-97 | 简化 `logInitialization()` |
| 1168-1173 | 简化环境变量读取和验证 |
| 207-346 | 更新工具描述，移除 Google GenAI 引用 |
| 298-331 | **删除 `embed_text` 工具**（只支持 Google GenAI） |
| 533-570 | 简化 `listModels()`，移除 Google 模型合并逻辑 |
| 572-582 | **删除 `embedText()` 方法** |
| 716-767 | 更新 `getCapabilitiesContent()` |
| 769-804 | 更新 `getHelpContent('overview')` |
| 994-1038 | 更新 `getHelpContent('models')` |

### 4. README.md
| 修改 |
|------|
| 完全重写配置说明，只提及 OpenRouter |
| 移除 `GEMINI_API_KEY` 配置 |
| 更新所有示例配置 |

### 5. 其他文档文件
| 文件 | 修改 |
|------|------|
| `.env.example` | 只保留 `OPENROUTER_API_KEY` |
| `CHANGELOG.md` | 添加 v6.0.0 更新日志 |

## 实施步骤

### Phase 1: 核心代码修改
1. [ ] 修改 `src/openrouter-client.ts` - 删除 `UnifiedAIClient`，创建 `MCPClient`
2. [ ] 修改 `src/enhanced-stdio-server.ts` - 更新导入和类型引用
3. [ ] 修改 `src/enhanced-stdio-server.ts` - 简化构造函数
4. [ ] 修改 `src/enhanced-stdio-server.ts` - 删除 `embed_text` 工具
5. [ ] 修改 `src/enhanced-stdio-server.ts` - 简化 `listModels` 和帮助内容

### Phase 2: 依赖和配置
6. [ ] 修改 `package.json` - 删除 `@google/genai`
7. [ ] 更新 `package.json` - 版本号 6.0.0
8. [ ] 修改 `.env.example`

### Phase 3: 文档
9. [ ] 重写 `README.md`
10. [ ] 更新 `CHANGELOG.md`

### Phase 4: 构建和测试
11. [ ] 运行 `npm run build`
12. [ ] 测试所有工具功能
13. [ ] 修复任何发现的问题

## 关键代码变更预览

### openrouter-client.ts 结尾新代码
```typescript
/**
 * Main MCP Client - uses OpenRouter exclusively
 */
export class MCPClient {
  private openRouterClient: OpenRouterClient;

  constructor(openRouterKey: string, baseURL?: string) {
    this.openRouterClient = new OpenRouterClient({
      apiKey: openRouterKey,
      baseURL
    });
  }

  async chat(params: {
    model?: string;
    prompt: string;
    systemInstruction?: string;
    images?: string[];
    videos?: string[];
    temperature?: number;
    maxTokens?: number;
    responseFormat?: { type: 'text' | 'json_object' };
  }): Promise<{ text: string; usage?: { total_tokens: number } }> {
    return await this.openRouterClient.chat(params);
  }

  listModels(filter?: 'all' | 'thinking' | 'vision' | 'video') {
    return this.openRouterClient.listModels(filter);
  }
}
```

### enhanced-stdio-server.ts 结尾新代码
```typescript
// Get API key from environment
const openRouterKey = process.env.OPENROUTER_API_KEY;

if (!openRouterKey) {
  console.error('Error: OPENROUTER_API_KEY environment variable is required');
  process.exit(1);
}

new EnhancedStdioMCPServer(openRouterKey);
```

## 验证清单
- [ ] 构建成功无错误
- [ ] `generate_text` 工具正常
- [ ] `analyze_image` 工具正常
- [ ] `list_models` 工具正常（只显示 OpenRouter 模型）
- [ ] 所有视觉工具正常
- [ ] `embed_text` 工具已被移除
- [ ] 配置只需要 `OPENROUTER_API_KEY`
