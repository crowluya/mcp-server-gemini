#!/usr/bin/env node
import { createInterface } from 'readline';
import { MCPRequest, MCPResponse } from './types.js';
import { UnifiedAIClient, OPENROUTER_GEMINI_MODELS } from './openrouter-client.js';
import { visionToolHandlers, getVisionToolSchemas } from './vision-tools.js';

// Increase max buffer size for large images (10MB)
if (process.stdin.setEncoding) {
  process.stdin.setEncoding('utf8');
}

// Combine models from both sources for listing
const ALL_GEMINI_MODELS = {
  // Direct Google models (legacy naming)
  'gemini-2.5-pro': {
    description: 'Most capable thinking model, best for complex reasoning and coding',
    features: ['thinking', 'function_calling', 'json_mode', 'grounding', 'system_instructions'],
    contextWindow: 2000000,
    thinking: true,
    provider: 'google'
  },
  'gemini-2.5-flash': {
    description: 'Fast thinking model with best price/performance ratio',
    features: ['thinking', 'function_calling', 'json_mode', 'grounding', 'system_instructions'],
    contextWindow: 1000000,
    thinking: true,
    provider: 'google'
  },
  'gemini-2.0-flash': {
    description: 'Fast, efficient model with 1M context window',
    features: ['function_calling', 'json_mode', 'grounding', 'system_instructions'],
    contextWindow: 1000000,
    provider: 'google'
  },
  'gemini-1.5-pro': {
    description: 'Previous generation pro model',
    features: ['function_calling', 'json_mode', 'system_instructions'],
    contextWindow: 2000000,
    provider: 'google'
  },
  'gemini-1.5-flash': {
    description: 'Previous generation fast model',
    features: ['function_calling', 'json_mode', 'system_instructions'],
    contextWindow: 1000000,
    provider: 'google'
  },
  // OpenRouter models
  ...Object.fromEntries(
    Object.entries(OPENROUTER_GEMINI_MODELS).map(([id, info]) => [
      id,
      { ...info, provider: 'openrouter' as const }
    ])
  )
};

class EnhancedStdioMCPServer {
  private aiClient: UnifiedAIClient;
  private conversations: Map<string, any[]> = new Map();
  private serverVersion = '5.0.0';
  private activeProvider: 'openrouter' | 'google' = 'openrouter';
  private defaultModel: string;
  private availableModels: string[];

  constructor(openRouterKey?: string, googleKey?: string) {
    // Read model configuration from environment
    this.defaultModel = process.env.DEFAULT_MODEL || 'google/gemini-2.5-flash-preview';
    this.availableModels = process.env.AVAILABLE_MODELS
      ? process.env.AVAILABLE_MODELS.split(',').map(m => m.trim())
      : [
          'google/gemini-2.5-flash-preview',
          'google/gemini-2.5-flash-lite',
          'google/gemini-2.5-pro-preview',
          'google/gemini-2.0-flash-exp',
          'anthropic/claude-3.5-sonnet',
          'openai/gpt-4o',
          'openai/gpt-4o-mini'
        ];

    this.aiClient = new UnifiedAIClient(openRouterKey, googleKey);
    this.setupStdioInterface();
    this.logInitialization();
  }

  private logInitialization() {
    console.error(`MCP Server v${this.serverVersion} starting...`);
    if (openRouterKey) {
      console.error('OpenRouter API key detected - will use as primary');
      this.activeProvider = 'openrouter';
    } else if (googleKey) {
      console.error('Google GenAI API key detected - using as primary');
      this.activeProvider = 'google';
    } else {
      console.error('Warning: No API keys detected');
    }
    console.error(`Default model: ${this.defaultModel}`);
    console.error(`Available models: ${this.availableModels.slice(0, 5).join(', ')}${this.availableModels.length > 5 ? '...' : ''}`);
  }

  private setupStdioInterface() {
    const rl = createInterface({
      input: process.stdin,
      output: process.stdout,
      terminal: false,
      crlfDelay: Infinity
    });

    rl.on('line', (line) => {
      if (line.trim()) {
        try {
          const request: MCPRequest = JSON.parse(line);
          this.handleRequest(request);
        } catch (error) {
          console.error('Failed to parse message:', error);
        }
      }
    });

    process.stdin.on('error', (err) => {
      console.error('stdin error:', err);
    });
  }

  private async handleRequest(request: MCPRequest) {
    console.error('Handling request:', request.method);
    try {
      let response: MCPResponse;

      switch (request.method) {
        case 'initialize':
          response = this.handleInitialize(request);
          break;

        case 'tools/list':
          response = this.handleToolsList(request);
          break;

        case 'tools/call':
          response = await this.handleToolCall(request);
          break;

        case 'resources/list':
          response = this.handleResourcesList(request);
          break;

        case 'resources/read':
          response = await this.handleResourceRead(request);
          break;

        case 'prompts/list':
          response = this.handlePromptsList(request);
          break;

        default:
          if (!('id' in request)) {
            console.error(`Notification received: ${(request as any).method}`);
            return;
          }
          response = {
            jsonrpc: '2.0',
            id: request.id,
            error: {
              code: -32601,
              message: 'Method not found'
            }
          };
      }

      this.sendResponse(response);
    } catch (error) {
      const errorResponse: MCPResponse = {
        jsonrpc: '2.0',
        id: request.id,
        error: {
          code: -32603,
          message: error instanceof Error ? error.message : 'Internal error'
        }
      };
      this.sendResponse(errorResponse);
    }
  }

  private handleInitialize(request: MCPRequest): MCPResponse {
    return {
      jsonrpc: '2.0',
      id: request.id,
      result: {
        protocolVersion: '2024-11-05',
        serverInfo: {
          name: 'mcp-server-gemini-enhanced',
          version: this.serverVersion
        },
        capabilities: {
          tools: {},
          resources: {},
          prompts: {}
        }
      }
    };
  }

  private handleToolsList(request: MCPResponse): MCPResponse {
    const modelEnum = this.availableModels.length > 0 ? this.availableModels : undefined;
    const modelDescription = modelEnum
      ? `Model to use. Available: ${modelEnum.slice(0, 5).join(', ')}${modelEnum.length > 5 ? ', ...' : ''}. Or specify any OpenRouter model ID.`
      : 'Any OpenRouter model ID (e.g., google/gemini-2.5-flash-preview, anthropic/claude-3.5-sonnet, openai/gpt-4o, etc.)';

    const originalTools = [
      {
        name: 'generate_text',
        description: 'Generate text using any model on OpenRouter or Google GenAI. Supports thinking mode, JSON output, and grounding.',
        inputSchema: {
          type: 'object',
          properties: {
            prompt: {
              type: 'string',
              description: 'The prompt to send to the model'
            },
            model: {
              type: 'string',
              description: modelDescription,
              default: this.defaultModel,
              enum: modelEnum
            },
            systemInstruction: {
              type: 'string',
              description: 'System instruction to guide model behavior'
            },
            temperature: {
              type: 'number',
              description: 'Temperature for generation (0-2)',
              default: 0.7,
              minimum: 0,
              maximum: 2
            },
            maxTokens: {
              type: 'number',
              description: 'Maximum tokens to generate',
              default: 2048
            },
            jsonMode: {
              type: 'boolean',
              description: 'Enable JSON mode for structured output',
              default: false
            },
            conversationId: {
              type: 'string',
              description: 'ID for maintaining conversation context'
            }
          },
          required: ['prompt']
        }
      },
      {
        name: 'analyze_image',
        description: 'Analyze images using any vision-capable model on OpenRouter. (Legacy - consider using specialized vision tools for specific use cases)',
        inputSchema: {
          type: 'object',
          properties: {
            prompt: {
              type: 'string',
              description: 'Question or instruction about the image'
            },
            image: {
              type: 'string',
              description: 'Base64-encoded image data URL or public URL'
            },
            model: {
              type: 'string',
              description: modelDescription,
              default: this.defaultModel,
              enum: modelEnum
            }
          },
          required: ['prompt', 'image']
        }
      },
      {
        name: 'count_tokens',
        description: 'Count tokens for a given text (approximate for non-Google models)',
        inputSchema: {
          type: 'object',
          properties: {
            text: {
              type: 'string',
              description: 'Text to count tokens for'
            },
            model: {
              type: 'string',
              description: 'Model to use for token counting',
              default: this.defaultModel,
              enum: modelEnum
            }
          },
          required: ['text']
        }
      },
      {
        name: 'list_models',
        description: 'List all available Gemini models from both OpenRouter and Google GenAI',
        inputSchema: {
          type: 'object',
          properties: {
            filter: {
              type: 'string',
              description: 'Filter models by capability',
              enum: ['all', 'thinking', 'vision', 'video'],
              default: 'all'
            }
          }
        }
      },
      {
        name: 'embed_text',
        description: 'Generate embeddings for text (Google GenAI only)',
        inputSchema: {
          type: 'object',
          properties: {
            text: {
              type: 'string',
              description: 'Text to generate embeddings for'
            },
            model: {
              type: 'string',
              description: 'Embedding model to use',
              enum: ['text-embedding-004', 'text-multilingual-embedding-002'],
              default: 'text-embedding-004'
            }
          },
          required: ['text']
        }
      },
      {
        name: 'get_help',
        description: 'Get help and usage information for the Gemini MCP server',
        inputSchema: {
          type: 'object',
          properties: {
            topic: {
              type: 'string',
              description: 'Help topic to get information about',
              enum: ['overview', 'tools', 'models', 'vision-tools', 'parameters', 'examples', 'quick-start'],
              default: 'overview'
            }
          }
        }
      }
    ];

    // Add vision tools
    const visionTools = getVisionToolSchemas();

    return {
      jsonrpc: '2.0',
      id: request.id,
      result: {
        tools: [...originalTools, ...visionTools]
      }
    };
  }

  private async handleToolCall(request: MCPRequest): Promise<MCPResponse> {
    const { name, arguments: args } = request.params || {};

    console.error(`Tool called: ${name}`);

    // Handle vision tools first
    if (name in visionToolHandlers) {
      const handler = visionToolHandlers[name as keyof typeof visionToolHandlers];
      try {
        const result = await handler(this.aiClient, args);
        return {
          jsonrpc: '2.0',
          id: request.id,
          result: result.isError
            ? { error: { message: result.content[0].text } }
            : result
        };
      } catch (error) {
        return {
          jsonrpc: '2.0',
          id: request.id,
          error: {
            code: -32603,
            message: error instanceof Error ? error.message : 'Internal error'
          }
        };
      }
    }

    // Handle original tools
    switch (name) {
      case 'generate_text':
        return await this.generateText(request.id, args);

      case 'analyze_image':
        return await this.analyzeImage(request.id, args);

      case 'count_tokens':
        return await this.countTokens(request.id, args);

      case 'list_models':
        return this.listModels(request.id, args);

      case 'embed_text':
        return await this.embedText(request.id, args);

      case 'get_help':
        return this.getHelp(request.id, args);

      default:
        return {
          jsonrpc: '2.0',
          id: request.id,
          error: {
            code: -32601,
            message: `Unknown tool: ${name}`
          }
        };
    }
  }

  private async generateText(id: any, args: any): Promise<MCPResponse> {
    try {
      const model = args.model || 'google/gemini-2.5-flash-preview';

      const result = await this.aiClient.chat({
        model,
        prompt: args.prompt,
        systemInstruction: args.systemInstruction,
        temperature: args.temperature,
        maxTokens: args.maxTokens,
        responseFormat: args.jsonMode ? { type: 'json_object' } : undefined
      });

      // Update conversation history if needed
      if (args.conversationId) {
        const history = this.conversations.get(args.conversationId) || [];
        history.push({ role: 'user', content: args.prompt });
        history.push({ role: 'assistant', content: result.text });
        this.conversations.set(args.conversationId, history);
      }

      return {
        jsonrpc: '2.0',
        id,
        result: {
          content: [{
            type: 'text',
            text: result.text
          }],
          metadata: {
            model,
            provider: result.provider,
            tokensUsed: result.usage?.total_tokens
          }
        }
      };
    } catch (error) {
      console.error('Error in generateText:', error);
      return {
        jsonrpc: '2.0',
        id,
        error: {
          code: -32603,
          message: error instanceof Error ? error.message : 'Internal error'
        }
      };
    }
  }

  private async analyzeImage(id: any, args: any): Promise<MCPResponse> {
    try {
      const model = args.model || 'google/gemini-2.5-flash-preview';

      if (!args.image) {
        throw new Error('Image parameter is required');
      }

      const result = await this.aiClient.chat({
        model,
        prompt: args.prompt,
        images: [args.image],
        temperature: 0.4,
        maxTokens: 2048
      });

      return {
        jsonrpc: '2.0',
        id,
        result: {
          content: [{
            type: 'text',
            text: result.text
          }],
          metadata: {
            provider: result.provider
          }
        }
      };
    } catch (error) {
      console.error('Error in analyzeImage:', error);
      return {
        jsonrpc: '2.0',
        id,
        error: {
          code: -32603,
          message: `Image analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`
        }
      };
    }
  }

  private async countTokens(id: any, args: any): Promise<MCPResponse> {
    // Approximate token count (OpenRouter doesn't have a dedicated token count endpoint)
    const approximateCount = Math.ceil(args.text.length / 4);

    return {
      jsonrpc: '2.0',
      id,
      result: {
        content: [{
          type: 'text',
          text: `Approximate token count: ${approximateCount}\n\nNote: Exact token counting requires Google GenAI API. For precise counts, use the Google GenAI client directly.`
        }],
        metadata: {
          approximateTokenCount: approximateCount,
          characterCount: args.text.length
        }
      }
    };
  }

  private listModels(id: any, args: any): MCPResponse {
    const filter = args?.filter || 'all';
    const models = this.aiClient.listModels(filter as any);

    // Add Google direct models
    const googleModels = Object.entries(ALL_GEMINI_MODELS)
      .filter(([_, info]) => (info as any).provider === 'google')
      .filter(([_, info]) => {
        if (filter === 'all') return true;
        if (filter === 'thinking') return (info as any).thinking === true;
        if (filter === 'vision') return true;
        if (filter === 'video') return (info as any).contextWindow >= 1000000;
        return true;
      })
      .map(([name, info]) => ({
        id: name,
        name,
        ...info
      }));

    const allModels = [...models, ...googleModels];

    return {
      jsonrpc: '2.0',
      id,
      result: {
        content: [{
          type: 'text',
          text: JSON.stringify(allModels, null, 2)
        }],
        metadata: {
          count: allModels.length,
          filter,
          activeProvider: this.activeProvider
        }
      }
    };
  }

  private async embedText(id: any, args: any): Promise<MCPResponse> {
    // Note: Embeddings only available through Google GenAI
    return {
      jsonrpc: '2.0',
      id,
      error: {
        code: -32603,
        message: 'Embeddings are only available through Google GenAI API. Please use the Google GenAI client directly or add GEMINI_API_KEY to your environment.'
      }
    };
  }

  private handleResourcesList(request: MCPRequest): MCPResponse {
    return {
      jsonrpc: '2.0',
      id: request.id,
      result: {
        resources: [
          {
            uri: 'gemini://models',
            name: 'Available Gemini Models',
            description: 'List of all available Gemini models from OpenRouter and Google GenAI',
            mimeType: 'application/json'
          },
          {
            uri: 'gemini://capabilities',
            name: 'API Capabilities',
            description: 'Detailed information about Gemini API capabilities',
            mimeType: 'text/markdown'
          },
          {
            uri: 'gemini://help/usage',
            name: 'Usage Guide',
            description: 'Complete guide on using all tools and features',
            mimeType: 'text/markdown'
          },
          {
            uri: 'gemini://help/vision-tools',
            name: 'Vision Tools Guide',
            description: 'Guide for specialized vision and video analysis tools',
            mimeType: 'text/markdown'
          }
        ]
      }
    };
  }

  private async handleResourceRead(request: MCPRequest): Promise<MCPResponse> {
    const uri = request.params?.uri;

    if (!uri) {
      return {
        jsonrpc: '2.0',
        id: request.id,
        error: {
          code: -32602,
          message: 'Missing required parameter: uri'
        }
      };
    }

    let content = '';
    let mimeType = 'text/plain';

    switch (uri) {
      case 'gemini://models':
        content = JSON.stringify(ALL_GEMINI_MODELS, null, 2);
        mimeType = 'application/json';
        break;

      case 'gemini://capabilities':
        content = this.getCapabilitiesContent();
        mimeType = 'text/markdown';
        break;

      case 'gemini://help/usage':
        content = this.getHelpContent('overview') + '\n\n' + this.getHelpContent('tools');
        mimeType = 'text/markdown';
        break;

      case 'gemini://help/vision-tools':
        content = this.getHelpContent('vision-tools');
        mimeType = 'text/markdown';
        break;

      default:
        return {
          jsonrpc: '2.0',
          id: request.id,
          error: {
            code: -32602,
            message: `Unknown resource: ${uri}`
          }
        };
    }

    return {
      jsonrpc: '2.0',
      id: request.id,
      result: {
        contents: [{
          uri,
          mimeType,
          text: content
        }]
      }
    };
  }

  private handlePromptsList(request: MCPRequest): MCPResponse {
    return {
      jsonrpc: '2.0',
      id: request.id,
      result: {
        prompts: [
          {
            name: 'code_review',
            description: 'Comprehensive code review with Gemini 2.5 Pro',
            arguments: [
              { name: 'code', description: 'Code to review', required: true },
              { name: 'language', description: 'Programming language', required: false }
            ]
          },
          {
            name: 'explain_with_thinking',
            description: 'Deep explanation using Gemini 2.5 thinking capabilities',
            arguments: [
              { name: 'topic', description: 'Topic to explain', required: true },
              { name: 'level', description: 'Explanation level', required: false }
            ]
          },
          {
            name: 'ui_to_code',
            description: 'Convert UI screenshot to production-ready code',
            arguments: [
              { name: 'image', description: 'Base64 screenshot', required: true },
              { name: 'framework', description: 'Framework (react, vue, etc.)', required: false }
            ]
          }
        ]
      }
    };
  }

  private getCapabilitiesContent(): string {
    return `# Gemini MCP Server Capabilities v${this.serverVersion}

## API Provider
- **Primary**: OpenRouter (with fallback to Google GenAI)
- **Active Provider**: ${this.activeProvider}

## Text Generation
- All models support advanced text generation
- System instructions for behavior control
- Temperature, topK, topP for output control
- Token limits vary by model (1M-2M)

## Thinking Models (2.5 Series)
- Step-by-step reasoning before responding
- Better accuracy for complex problems
- Ideal for coding, analysis, and problem-solving

## JSON Mode
- Structured output with schema validation
- Available on all models
- Ensures consistent response format

## Vision Capabilities
- Image analysis and understanding
- Specialized tools for specific vision tasks:
  - **ui_to_artifact**: Convert UI to code/prompts/specs
  - **extract_text_from_screenshot**: OCR text extraction
  - **diagnose_error_screenshot**: Error analysis
  - **understand_technical_diagram**: Diagram interpretation
  - **analyze_data_visualization**: Chart/graph analysis
  - **ui_diff_check**: Visual comparison
  - **analyze_image**: General image analysis

## Video Analysis
- Support for MP4, MOV, M4V formats
- Key moment extraction
- Action and object recognition
- Transcription capabilities

## Model Selection
### OpenRouter Models (Recommended)
- \`google/gemini-2.5-flash-preview\` - Best balance (⭐ Recommended)
- \`google/gemini-2.5-pro-preview\` - Most capable
- \`google/gemini-2.0-flash-exp\` - Fast with video support

### Direct Google Models
- \`gemini-2.5-flash\` - Fast thinking model
- \`gemini-2.5-pro\` - Most capable
- \`gemini-2.0-flash\` - Fast with video support
`;
  }

  private getHelpContent(topic: string): string {
    switch (topic) {
      case 'overview':
        return `# Gemini MCP Server v${this.serverVersion}

Welcome! This server provides access to Google's Gemini AI models through OpenRouter with fallback to Google GenAI.

## Available Tool Categories

### Core Tools
- **generate_text** - Generate text with advanced features
- **analyze_image** - General image analysis
- **list_models** - List all available models
- **get_help** - Get help documentation

### Vision Tools (New!)
- **ui_to_artifact** - Convert UI to code/prompts/specs
- **extract_text_from_screenshot** - OCR text extraction
- **diagnose_error_screenshot** - Error diagnosis
- **understand_technical_diagram** - Diagram analysis
- **analyze_data_visualization** - Chart/graph analysis
- **ui_diff_check** - Visual comparison
- **analyze_video** - Video content analysis

## Quick Start
- "Generate text about [topic]"
- "Convert this UI to React code"
- "Extract text from this screenshot"
- "Analyze this error screenshot"

## Configuration
Set environment variables:
- \`OPENROUTER_API_KEY\` - OpenRouter API key (recommended)
- \`GEMINI_API_KEY\` - Google GenAI API key (fallback)

Both are optional - the server will use whichever is available.`;

      case 'tools':
        return `# Available Tools

## Core Tools

### generate_text
Generate text using Gemini models with advanced features.
- prompt (required): Your text prompt
- model: Gemini model ID
- temperature: 0-2 (default 0.7)
- maxTokens: Max output tokens
- systemInstruction: Guide model behavior
- jsonMode: Enable JSON output

### analyze_image
General-purpose image analysis.
- prompt (required): Question about the image
- image (required): Base64 or URL
- model: Model to use

### list_models
List available models with filtering.
- filter: all, thinking, vision, video

## Vision Tools

### ui_to_artifact
Convert UI screenshots to code, prompts, specs, or descriptions.
- image (required): Screenshot
- outputType (required): code, prompt, spec, or description
- framework: For code output (react, vue, etc.)

### extract_text_from_screenshot
Extract text with OCR accuracy.
- image (required): Screenshot
- preserveFormatting: Keep layout
- programmingLanguage: For code extraction

### diagnose_error_screenshot
Analyze errors and provide fixes.
- image (required): Error screenshot
- context: When the error occurred
- programmingLanguage: Language being used

### understand_technical_diagram
Analyze technical diagrams.
- image (required): Diagram
- diagramType: architecture, flowchart, uml, er-diagram, etc.
- detailLevel: brief, detailed, comprehensive

### analyze_data_visualization
Extract insights from charts and graphs.
- image (required): Visualization
- focus: trends, anomalies, comparisons, insights
- includeMetrics: Show exact values

### ui_diff_check
Compare two UI screenshots.
- expectedImage (required): Reference UI
- actualImage (required): Implementation UI
- detailLevel: summary, detailed, pixel-perfect

### analyze_video
Analyze video content.
- video (required): Base64 or URL
- prompt (required): What to analyze
- focus: summary, actions, objects, transcript`;

      case 'vision-tools':
        return `# Vision Tools Guide

## UI to Artifact
Convert screenshots into:
- **code**: Production-ready React/Vue/HTML
- **prompt**: Detailed AI generation prompt
- **spec**: Design specification document
- **description**: Natural language description

Example:
\`\`\`
{
  "image": "data:image/png;base64,...",
  "outputType": "code",
  "framework": "react",
  "language": "typescript"
}
\`\`\`

## Text Extraction (OCR)
Extract text from:
- Code screenshots (specify language)
- Terminal output
- Documentation pages
- Any text-containing image

Example:
\`\`\`
{
  "image": "data:image/png;base64,...",
  "programmingLanguage": "rust",
  "preserveFormatting": true
}
\`\`\`

## Error Diagnosis
Get actionable solutions for:
- Compile errors
- Runtime exceptions
- Build failures
- Test failures

Example:
\`\`\`
{
  "image": "data:image/png;base64,...",
  "context": "during npm install",
  "programmingLanguage": "nodejs"
}
\`\`\`

## Diagram Understanding
Analyze:
- Architecture diagrams
- Flowcharts
- UML diagrams
- ER diagrams
- Network topology

Example:
\`\`\`
{
  "image": "data:image/png;base64,...",
  "diagramType": "architecture",
  "detailLevel": "detailed"
}
\`\`\`

## Data Visualization
Extract from:
- Line charts
- Bar charts
- Pie charts
- Dashboards
- Statistical plots

Example:
\`\`\`
{
  "image": "data:image/png;base64,...",
  "focus": "trends",
  "includeMetrics": true
}
\`\`\`

## UI Diff Check
Compare design vs implementation:
- Layout differences
- Visual variations
- Missing/extra elements
- Accessibility issues

Example:
\`\`\`
{
  "expectedImage": "data:image/png;base64,...",
  "actualImage": "data:image/png;base64,...",
  "detailLevel": "detailed",
  "checkAccessibility": true
}
\`\`\`

## Video Analysis
Supports:
- MP4, MOV, M4V formats
- Action recognition
- Object tracking
- Transcription

Example:
\`\`\`
{
  "video": "data:video/mp4;base64,...",
  "prompt": "Describe what happens in this video",
  "focus": "detailed"
}
\`\`\`
`;

      case 'models':
        return `# Available Gemini Models

## OpenRouter Models (Recommended)

### Thinking Models (2.5 Series)
**google/gemini-2.5-pro-preview**
- Most capable for complex reasoning
- 2M token context
- Vision and video support

**google/gemini-2.5-flash-preview** ⭐
- Best balance of speed/cost
- 1M token context
- Vision and video support

**google/gemini-2.5-flash-exp**
- Experimental 2.5 Flash
- Same capabilities as preview

### Standard Models
**google/gemini-2.0-flash-exp**
- Fast with 1M context
- Video support
- Cost-efficient

## Direct Google Models

**gemini-2.5-pro**
- Direct access via Google GenAI
- 2M context, thinking mode

**gemini-2.5-flash**
- Direct access, fast thinking
- 1M context

**gemini-2.0-flash**
- Direct access with video
- 1M context

## Selection Guide
- Complex reasoning: gemini-2.5-pro
- General use: gemini-2.5-flash
- Video analysis: gemini-2.0-flash
- Cost-sensitive: gemini-2.0-flash-lite`;

      case 'parameters':
        return `# Parameter Reference

## generate_text
- **prompt** (required): Text prompt
- **model**: Model ID (default: google/gemini-2.5-flash-preview)
- **temperature**: 0-2, default 0.7
- **maxTokens**: Default 2048
- **systemInstruction**: System prompt
- **jsonMode**: Enable JSON output

## ui_to_artifact
- **image** (required): Base64 or URL
- **outputType** (required): code|prompt|spec|description
- **framework**: react|vue|angular|html
- **language**: typescript|javascript|python

## extract_text_from_screenshot
- **image** (required): Base64 or URL
- **preserveFormatting**: Default true
- **includeConfidence**: Mark unclear text
- **programmingLanguage**: For code images

## analyze_video
- **video** (required): Base64 or URL (MP4/MOV/M4V)
- **prompt** (required): Analysis question
- **focus**: summary|actions|objects|transcript|detailed`;

      case 'examples':
        return `# Usage Examples

## Text Generation
"Generate a Python function for binary search"

## UI to Code
"Convert this UI screenshot to React TypeScript code"

## Error Diagnosis
"Analyze this error screenshot and tell me how to fix it"

## Text Extraction
"Extract all the text from this code screenshot"

## Diagram Analysis
"Explain this architecture diagram in detail"

## Data Visualization
"What trends do you see in this chart?"

## Video Analysis
"Summarize what happens in this video"

## UI Comparison
"Compare these two screenshots and list all differences"`;

      case 'quick-start':
        return `# Quick Start Guide

## 1. Installation
\`\`\`bash
npm install mcp-server-gemini
\`\`\`

## 2. Configuration
Add to Claude Desktop config (\`claude_desktop_config.json\`):
\`\`\`json
{
  "mcpServers": {
    "gemini": {
      "command": "node",
      "args": ["path/to/mcp-server-gemini/dist/enhanced-stdio-server.js"],
      "env": {
        "OPENROUTER_API_KEY": "your-key-here"
      }
    }
  }
}
\`\`\`

## 3. Usage in Claude
- "Generate a summary of quantum computing"
- "Convert this UI to code" [attach screenshot]
- "What's wrong with this code?" [attach error screenshot]
- "Extract the text from this image"

## 4. Vision Tools
All vision tools accept base64 data URLs:
\`\`\`
data:image/png;base64,iVBORw0KGgo...
data:image/jpeg;base64,/9j/4AAQ...
data:video/mp4;base64,AAAAIGZ0...
\`\`\`

## 5. Tips
- Use \`gemini-2.5-flash\` for most tasks
- Lower temperature for facts, higher for creativity
- Specify programming language for code extraction
- Use diagram type for better diagram analysis`;

      default:
        return 'Unknown help topic. Available: overview, tools, models, vision-tools, parameters, examples, quick-start';
    }
  }

  private getHelp(id: any, args: any): MCPResponse {
    const topic = args?.topic || 'overview';
    const helpContent = this.getHelpContent(topic);

    return {
      jsonrpc: '2.0',
      id,
      result: {
        content: [{
          type: 'text',
          text: helpContent
        }]
      }
    };
  }

  private sendResponse(response: MCPResponse) {
    const responseStr = JSON.stringify(response);
    process.stdout.write(responseStr + '\n');
  }
}

// Get API keys from environment
const openRouterKey = process.env.OPENROUTER_API_KEY || process.env.OPENROUTER_API_KEY;
const googleKey = process.env.GEMINI_API_KEY;

if (!openRouterKey && !googleKey) {
  console.error('Error: Either OPENROUTER_API_KEY or GEMINI_API_KEY environment variable is required');
  process.exit(1);
}

new EnhancedStdioMCPServer(openRouterKey, googleKey);
