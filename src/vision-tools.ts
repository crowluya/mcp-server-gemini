/**
 * Vision and Video Analysis Tools for MCP Server
 * Provides specialized tools for image and video analysis
 */

import { MCPClient } from './openrouter-client.js';

export interface ToolResponse {
  content: Array<{ type: string; text: string }>;
  metadata?: Record<string, any>;
  isError?: boolean;
}

/**
 * Model keyword mappings for natural language detection
 */
const MODEL_KEYWORDS: Record<string, string[]> = {
  'google/gemini-3-flash-preview': ['gemini 3', 'gemini-3', 'g-3', 'g3'],
  'google/gemini-2.5-flash': ['gemini 2.5', 'gemini-2.5', '2.5 flash', 'g-2.5'],
  'google/gemini-2.5-flash-lite': ['gemini 2.5 lite', 'gemini-2.5-lite', '2.5 lite', 'g-lite'],
  'google/gemini-2.5-pro-preview': ['gemini 2.5 pro', 'gemini-2.5-pro', '2.5 pro', 'g-pro'],
  'google/gemini-2.0-flash-exp': ['gemini 2.0', 'gemini-2.0', 'g-2.0'],
  'anthropic/claude-3.5-sonnet': ['claude', 'claude 3.5', 'c-3.5'],
  'openai/gpt-4o': ['gpt-4o', 'gpt4o', 'gpt4'],
};

const KEYWORD_TO_MODEL: Map<string, string> = new Map();
for (const [modelId, keywords] of Object.entries(MODEL_KEYWORDS)) {
  for (const keyword of keywords) {
    KEYWORD_TO_MODEL.set(keyword.toLowerCase(), modelId);
    KEYWORD_TO_MODEL.set(keyword.replace(/\s+/g, '').toLowerCase(), modelId);
  }
}

/**
 * Detect model from text using keyword matching
 */
export function detectModelFromText(text: string, defaultModel: string): string {
  if (!text) return defaultModel;

  const lowerText = text.toLowerCase();

  // Check for exact keywords
  for (const [keyword, modelId] of KEYWORD_TO_MODEL) {
    if (lowerText.includes(keyword)) {
      return modelId;
    }
  }

  // Check for gemini X.Y pattern
  const geminiPattern = /gemini[-\s]?(\d+\.\d+)(?:[-\s]?(\w+))?/i;
  const match = lowerText.match(geminiPattern);
  if (match) {
    const version = match[1];
    const suffix = match[2];

    let modelId = `google/gemini-${version}`;
    if (suffix === 'pro' || suffix === 'p') {
      modelId += '-pro-preview';
    } else if (suffix === 'lite' || suffix === 'l') {
      modelId += '-flash-lite';
    } else {
      modelId += '-flash-preview';
    }

    // For version 3, use the correct preview name
    if (version === '3' || version === '3.0') {
      modelId = 'google/gemini-3-flash-preview';
    }

    return modelId;
  }

  return defaultModel;
}

/**
 * ui_to_artifact - Convert UI screenshots to code, prompts, design specs, or descriptions
 */
export async function uiToArtifact(
  client: MCPClient,
  params: {
    image: string; // base64 or URL
    outputType: 'code' | 'prompt' | 'spec' | 'description';
    framework?: string; // For code output: react, vue, html, etc.
    language?: string; // Programming language
    model?: string; // Custom model ID (any OpenRouter model)
  }
): Promise<ToolResponse> {
  const { image, outputType, framework = 'react', language = 'typescript', model = 'google/gemini-2.5-flash' } = params;

  const systemInstructions: Record<string, string> = {
    code: `You are an expert frontend developer specializing in converting UI designs into clean, modern code.
Generate production-ready ${framework} code in ${language} that matches the visual design exactly.
Include:
- Component structure with proper separation of concerns
- Accurate styling (CSS/Tailwind/styled-components as appropriate)
- Responsive design considerations
- Accessibility attributes
- Proper state management for interactive elements

Return ONLY the code with brief comments explaining key sections.`,

    prompt: `You are a UX/UI specialist and AI prompt engineer.
Create a detailed, comprehensive prompt that would allow another AI to recreate this UI design from scratch.
The prompt should include:
- Layout structure and grid system
- Color palette (exact hex codes if visible)
- Typography (font families, sizes, weights, line heights)
- Spacing and padding
- Component hierarchy
- Interactive elements and their states
- Any animations or transitions
- Overall design style and aesthetic

Format as a structured, detailed prompt.`,

    spec: `You are a UX designer and technical specification writer.
Create a comprehensive design specification document for this UI.
Include:
- Overview and purpose
- Layout and grid system
- Color system with hex codes
- Typography scale
- Spacing system
- Component breakdown (each element's properties)
- Interactive states (hover, active, disabled, focus)
- Responsive breakpoints
- Accessibility requirements
- Assets needed (icons, images, etc.)

Format as a structured markdown specification.`,

    description: `You are a UI/UX analyst.
Provide a detailed natural language description of this UI design.
Cover:
- Overall layout and structure
- Visual hierarchy and flow
- Key components and their purpose
- Design style and aesthetic
- Notable patterns or decisions
- Potential user experience considerations
- Accessibility observations

Write in clear, descriptive prose.`
  };

  const prompts: Record<string, string> = {
    code: `Convert this UI design into clean, modern ${framework} code (${language}). Make it production-ready with proper styling, responsiveness, and accessibility.`,
    prompt: `Create a detailed prompt that would enable an AI to recreate this UI design exactly. Include all visual details, layout, colors, typography, and interactions.`,
    spec: `Create a comprehensive design specification for this UI. Document all visual properties, layout, colors, typography, spacing, and component details.`,
    description: `Provide a detailed natural language description of this UI design, covering layout, components, style, and user experience.`
  };

  try {
    const result = await client.chat({
      model,
      prompt: prompts[outputType],
      systemInstruction: systemInstructions[outputType],
      images: [image],
      temperature: 0.3,
      maxTokens: 8192
    });

    return {
      content: [{
        type: 'text',
        text: result.text
      }],
      metadata: {
        outputType,
        framework,
        language,
        model
      }
    };
  } catch (error) {
    return {
      content: [{
        type: 'text',
        text: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`
      }],
      isError: true
    };
  }
}

/**
 * extract_text_from_screenshot - Extract and recognize text from screenshots using OCR
 */
export async function extractTextFromScreenshot(
  client: MCPClient,
  params: {
    image: string; // base64 or URL
    preserveFormatting?: boolean;
    includeConfidence?: boolean;
    programmingLanguage?: string; // If code, specify language for better extraction
    model?: string; // Custom model ID (any OpenRouter model)
  }
): Promise<ToolResponse> {
  const { image, preserveFormatting = true, includeConfidence = false, programmingLanguage, model = 'google/gemini-2.5-flash' } = params;

  let systemInstruction = `You are an expert OCR (Optical Character Recognition) specialist with exceptional accuracy in extracting text from images.
Your task is to extract ALL text from the provided image with perfect accuracy.

Guidelines:
- Preserve original line breaks and spacing
- Maintain the structure and hierarchy of the text
- Include headers, footers, and marginal text
- For code, maintain exact indentation and syntax
- For tables, preserve the table structure
- Handle multiple columns appropriately
- Transcribe numbers and symbols accurately
- Preserve punctuation exactly as shown`;

  if (programmingLanguage) {
    systemInstruction += `\n\nThe image contains ${programmingLanguage} code. Pay extra attention to:
- Syntax characters (brackets, braces, parentheses, quotes, semicolons)
- Indentation and whitespace
- Comments and docstrings
- Variable names and function signatures
- String literals and escape sequences`;
  }

  const prompt = includeConfidence
    ? 'Extract all text from this image. If any text is unclear, indicate it with [unclear] in your output. Preserve the original formatting and structure.'
    : 'Extract all text from this image exactly as it appears. Preserve formatting, line breaks, and structure.';

  try {
    const result = await client.chat({
      model,
      prompt,
      systemInstruction,
      images: [image],
      temperature: 0.1,
      maxTokens: 16384
    });

    return {
      content: [{
        type: 'text',
        text: result.text
      }],
      metadata: {
        preserveFormatting,
        programmingLanguage,
        model
      }
    };
  } catch (error) {
    return {
      content: [{
        type: 'text',
        text: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`
      }],
      isError: true
    };
  }
}

/**
 * diagnose_error_screenshot - Diagnose error messages, stack traces, and exception screenshots
 */
export async function diagnoseErrorScreenshot(
  client: MCPClient,
  params: {
    image: string; // base64 or URL
    context?: string; // Additional context about when the error occurred
    programmingLanguage?: string; // Language/framework being used
    model?: string; // Custom model ID (any OpenRouter model)
  }
): Promise<ToolResponse> {
  const { image, context, programmingLanguage, model = 'google/gemini-2.5-pro-preview' } = params;

  const baseSystemInstruction = `You are an expert debugging specialist with deep knowledge across all programming languages, frameworks, and platforms.
Your task is to analyze error messages, stack traces, and logs to provide actionable solutions.

For each error, provide:
1. **Error Summary**: Brief description of what went wrong
2. **Root Cause**: The underlying issue that triggered the error
3. **Location**: Where in the code the error originated (file, line, function)
4. **Solution**: Step-by-step fix with code examples
5. **Prevention**: How to avoid this error in the future

Be specific, practical, and include working code examples when relevant.`;

  let systemInstruction = baseSystemInstruction;
  let prompt = 'Analyze this error screenshot and provide a detailed diagnosis with actionable solutions.';

  if (context) {
    prompt += `\n\nAdditional context: ${context}`;
  }

  if (programmingLanguage) {
    prompt += `\n\nProgramming language/framework: ${programmingLanguage}`;
    systemInstruction = baseSystemInstruction + `\n\nSpecialize in ${programmingLanguage} errors and patterns.`;
  }

  prompt += `\n\nFormat your response as a structured analysis with clear sections for summary, root cause, location, solution, and prevention.`;

  try {
    const result = await client.chat({
      model,
      prompt,
      systemInstruction,
      images: [image],
      temperature: 0.2,
      maxTokens: 4096
    });

    return {
      content: [{
        type: 'text',
        text: result.text
      }],
      metadata: {
        hasContext: !!context,
        programmingLanguage,
        model
      }
    };
  } catch (error) {
    return {
      content: [{
        type: 'text',
        text: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`
      }],
      isError: true
    };
  }
}

/**
 * understand_technical_diagram - Understand architecture diagrams, flowcharts, UML, ER diagrams
 */
export async function understandTechnicalDiagram(
  client: MCPClient,
  params: {
    image: string; // base64 or URL
    diagramType?: 'architecture' | 'flowchart' | 'uml' | 'er-diagram' | 'sequence' | 'network' | 'auto';
    detailLevel?: 'brief' | 'detailed' | 'comprehensive';
    model?: string; // Custom model ID (any OpenRouter model)
  }
): Promise<ToolResponse> {
  const { image, diagramType = 'auto', detailLevel = 'detailed', model = 'google/gemini-2.5-flash' } = params;

  const systemInstructions: Record<string, string> = {
    architecture: `You are a software architect specializing in system design.
Analyze architecture diagrams and explain:
- System components and their responsibilities
- Data flow between components
- Communication protocols and patterns
- Scalability considerations
- Potential bottlenecks or failure points
- Technology choices and trade-offs`,

    flowchart: `You are a process analyst specializing in workflow optimization.
Analyze flowcharts and explain:
- Process steps and their sequence
- Decision points and logic branches
- Start and end conditions
- Loop structures
- Exception handling paths
- Potential optimizations`,

    uml: `You are a software engineer specializing in UML modeling.
Analyze UML diagrams (class, sequence, activity, state, etc.) and explain:
- Classes/entities and their relationships
- Methods and attributes
- Inheritance and composition hierarchies
- Sequence of interactions
- State transitions
- Design patterns used`,

    'er-diagram': `You are a database architect specializing in data modeling.
Analyze ER diagrams and explain:
- Entities and their attributes
- Relationships (one-to-one, one-to-many, many-to-many)
- Keys (primary, foreign, composite)
- Cardinality and participation constraints
- Normalization level
- Potential data integrity issues`,

    sequence: `You are a systems analyst specializing in interaction design.
Analyze sequence diagrams and explain:
- Participants/actors in the interaction
- Message flow and sequencing
- Synchronous vs asynchronous calls
- Return values and responses
- Timing considerations
- Error handling scenarios`,

    network: `You are a network engineer specializing in network topology.
Analyze network diagrams and explain:
- Network devices and their roles
- Connection types and protocols
- IP addressing and subnets
- Security boundaries (firewalls, DMZs)
- Redundancy and failover paths
- Potential single points of failure`,

    auto: `You are a technical analyst with expertise across all types of technical diagrams.
Identify the type of diagram and provide an appropriate analysis based on its structure and content.
Cover the key elements, relationships, flow, and any technical implications.`
  };

  const detailPrompts: Record<string, string> = {
    brief: 'Provide a concise summary of this diagram, covering only the main components and their relationships.',
    detailed: 'Provide a comprehensive analysis of this diagram, explaining all components, relationships, flows, and technical implications.',
    comprehensive: 'Provide an exhaustive analysis of this diagram, including every element, relationship, edge case, potential issue, and implementation consideration.'
  };

  try {
    const result = await client.chat({
      model,
      prompt: detailPrompts[detailLevel],
      systemInstruction: systemInstructions[diagramType],
      images: [image],
      temperature: 0.3,
      maxTokens: 6144
    });

    return {
      content: [{
        type: 'text',
        text: result.text
      }],
      metadata: {
        diagramType,
        detailLevel,
        model
      }
    };
  } catch (error) {
    return {
      content: [{
        type: 'text',
        text: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`
      }],
      isError: true
    };
  }
}

/**
 * analyze_data_visualization - Analyze charts, graphs, dashboards, and data visualizations
 */
export async function analyzeDataVisualization(
  client: MCPClient,
  params: {
    image: string; // base64 or URL
    focus?: 'trends' | 'anomalies' | 'comparisons' | 'insights' | 'comprehensive';
    includeMetrics?: boolean;
    model?: string; // Custom model ID (any OpenRouter model)
  }
): Promise<ToolResponse> {
  const { image, focus = 'comprehensive', includeMetrics = true, model = 'google/gemini-2.5-flash' } = params;

  const systemInstruction = `You are a data analyst specializing in visualization interpretation and business intelligence.
Your task is to extract meaningful insights from data visualizations.

For each analysis, provide:
1. **Chart Identification**: Type of chart(s) and their purpose
2. **Data Summary**: What data is being shown
3. **Key Insights**: The most important takeaways
4. **Patterns & Trends**: Notable patterns in the data
5. **Anomalies**: Unexpected values or outliers
6. **Comparisons**: Relative differences between data points
7. **Recommendations**: Actionable insights based on the data

Be precise, data-driven, and focus on business-relevant insights.`;

  const focusPrompts: Record<string, string> = {
    trends: 'Analyze this visualization with a focus on trends over time. Identify upward, downward, seasonal, or cyclical patterns.',
    anomalies: 'Analyze this visualization with a focus on anomalies, outliers, and unusual patterns. Identify and explain any data points that deviate significantly from the norm.',
    comparisons: 'Analyze this visualization with a focus on comparisons. Highlight relative differences between categories, time periods, or data series.',
    insights: 'Analyze this visualization and extract the most important business insights and actionable takeaways.',
    comprehensive: 'Provide a comprehensive analysis of this visualization, covering trends, anomalies, comparisons, and key insights.'
  };

  const prompt = includeMetrics
    ? focusPrompts[focus] + '\n\nInclude specific values and metrics where visible in the chart.'
    : focusPrompts[focus];

  try {
    const result = await client.chat({
      model,
      prompt,
      systemInstruction,
      images: [image],
      temperature: 0.3,
      maxTokens: 4096
    });

    return {
      content: [{
        type: 'text',
        text: result.text
      }],
      metadata: {
        focus,
        includeMetrics,
        model
      }
    };
  } catch (error) {
    return {
      content: [{
        type: 'text',
        text: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`
      }],
      isError: true
    };
  }
}

/**
 * ui_diff_check - Compare two UI screenshots to identify visual differences
 */
export async function uiDiffCheck(
  client: MCPClient,
  params: {
    expectedImage: string; // base64 or URL - the reference/design
    actualImage: string; // base64 or URL - the implementation
    detailLevel?: 'summary' | 'detailed' | 'pixel-perfect';
    checkAccessibility?: boolean;
    model?: string; // Custom model ID (any OpenRouter model)
  }
): Promise<ToolResponse> {
  const { expectedImage, actualImage, detailLevel = 'detailed', checkAccessibility = true, model = 'google/gemini-2.5-pro-preview' } = params;

  const systemInstruction = `You are a QA engineer and UI specialist with expertise in visual regression testing.
Your task is to compare two UI screenshots and identify differences between the expected (reference) and actual (implementation) designs.

Structure your analysis as:
1. **Overall Match**: High-level assessment of similarity
2. **Layout Differences**: Structural variations
3. **Visual Differences**: Colors, fonts, spacing, sizing
4. **Missing Elements**: Elements present in expected but not actual
5. **Extra Elements**: Elements present in actual but not expected
6. **Alignment Issues**: Positioning discrepancies
7. **Accessibility Concerns**: Contrast, focus states, ARIA labels
8. **Severity Assessment**: Critical/Minor/Cosmetic issues
9. **Recommendations**: Specific fixes needed

Be thorough and precise in your comparisons.`;

  const detailInstructions: Record<string, string> = {
    summary: 'Provide a brief summary of the main differences between these two UIs.',
    detailed: 'Provide a comprehensive comparison of these two UIs, documenting all visual, structural, and accessibility differences.',
    'pixel-perfect': 'Perform an exhaustive pixel-level comparison. Document even the smallest differences in spacing, sizing, color, alignment, and rendering.'
  };

  const prompt = `Compare these two UI screenshots:
- IMAGE 1 (Expected/Reference): The design specification or reference UI
- IMAGE 2 (Actual/Implementation): The implemented UI to verify

${detailInstructions[detailLevel]}

${checkAccessibility ? '\nPay special attention to accessibility issues like contrast ratios, focus indicator visibility, and semantic structure.' : ''}

Format as a structured comparison report.`;

  try {
    const result = await client.chat({
      model,
      prompt,
      systemInstruction,
      images: [expectedImage, actualImage],
      temperature: 0.2,
      maxTokens: 6144
    });

    return {
      content: [{
        type: 'text',
        text: result.text
      }],
      metadata: {
        detailLevel,
        checkAccessibility,
        model
      }
    };
  } catch (error) {
    return {
      content: [{
        type: 'text',
        text: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`
      }],
      isError: true
    };
  }
}

/**
 * analyze_image - General-purpose image analysis for scenarios not covered by specialized tools
 */
export async function analyzeImage(
  client: MCPClient,
  params: {
    image: string; // base64 or URL
    prompt: string; // Custom analysis prompt
    detailLevel?: 'concise' | 'standard' | 'detailed';
    model?: string; // Custom model ID (any OpenRouter model)
  }
): Promise<ToolResponse> {
  const { image, prompt, detailLevel = 'standard', model = 'google/gemini-2.5-flash' } = params;

  const systemInstruction = `You are a versatile visual analyst with expertise across multiple domains.
Provide accurate, helpful, and well-structured responses to image analysis requests.
Be thorough but concise, and organize your output clearly.`;

  const temperatureMap: Record<string, number> = {
    concise: 0.2,
    standard: 0.4,
    detailed: 0.5
  };

  const maxTokensMap: Record<string, number> = {
    concise: 1024,
    standard: 2048,
    detailed: 4096
  };

  try {
    const result = await client.chat({
      model,
      prompt,
      systemInstruction,
      images: [image],
      temperature: temperatureMap[detailLevel],
      maxTokens: maxTokensMap[detailLevel]
    });

    return {
      content: [{
        type: 'text',
        text: result.text
      }],
      metadata: {
        detailLevel,
        model
      }
    };
  } catch (error) {
    return {
      content: [{
        type: 'text',
        text: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`
      }],
      isError: true
    };
  }
}

/**
 * analyze_video - Analyze video content using Gemini's video understanding capabilities
 */
export async function analyzeVideo(
  client: MCPClient,
  params: {
    video: string; // base64 data URL (video/mp4, video/mov, video/m4v)
    prompt: string; // What to analyze in the video
    focus?: 'summary' | 'actions' | 'objects' | 'transcript' | 'detailed';
    model?: string; // Custom model ID (any OpenRouter model)
  }
): Promise<ToolResponse> {
  const { video, prompt, focus = 'summary', model = 'google/gemini-2.0-flash-exp' } = params;

  const systemInstructions: Record<string, string> = {
    summary: 'You are a video analyst. Provide a concise summary of the video content, covering the main events, key moments, and overall narrative.',
    actions: 'You are a video analyst specializing in action recognition. Identify and describe all actions, movements, and activities in the video in chronological order.',
    objects: 'You are a video analyst specializing in object recognition. Identify and track all objects, people, animals, and entities visible in the video.',
    transcript: 'You are a video transcription specialist. If the video contains speech or text, provide an accurate transcription with timestamps where possible.',
    detailed: 'You are a comprehensive video analyst. Provide a detailed analysis covering visual content, actions, objects, text, audio (if applicable), and overall context.'
  };

  const finalPrompt = focus === 'detailed'
    ? `${prompt}\n\nProvide a comprehensive analysis covering all aspects of the video content.`
    : prompt;

  try {
    // Try to use OpenRouter first (if it supports video), otherwise use Google GenAI
    const result = await client.chat({
      model,
      prompt: finalPrompt,
      systemInstruction: systemInstructions[focus],
      videos: [video],
      temperature: 0.4,
      maxTokens: 4096
    });

    return {
      content: [{
        type: 'text',
        text: result.text
      }],
      metadata: {
        focus,
        model,
        videoSupported: true
      }
    };
  } catch (error) {
    // If video fails with specific error, provide helpful message
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    if (errorMessage.includes('video') || errorMessage.includes('media')) {
      return {
        content: [{
          type: 'text',
          text: `Video analysis error: The video format may not be supported or the file is too large. Supported formats: MP4, MOV, M4V (max 8MB for local files).\n\nDetails: ${errorMessage}`
        }],
        isError: true,
        metadata: {
          videoSupported: false
        }
      };
    }

    return {
      content: [{
        type: 'text',
        text: `Error: ${errorMessage}`
      }],
      isError: true
    };
  }
}

/**
 * Export all tool handlers
 */
export const visionToolHandlers = {
  ui_to_artifact: uiToArtifact,
  extract_text_from_screenshot: extractTextFromScreenshot,
  diagnose_error_screenshot: diagnoseErrorScreenshot,
  understand_technical_diagram: understandTechnicalDiagram,
  analyze_data_visualization: analyzeDataVisualization,
  ui_diff_check: uiDiffCheck,
  analyze_image: analyzeImage,
  analyze_video: analyzeVideo
};

/**
 * Get tool schemas for MCP registration
 */
export function getVisionToolSchemas() {
  const commonModelProperty = {
    type: 'string',
    description: 'Any OpenRouter model ID (e.g., google/gemini-2.5-flash, anthropic/claude-3.5-sonnet, openai/gpt-4o, etc.)',
    default: 'google/gemini-2.5-flash'
  };

  return [
    {
      name: 'ui_to_artifact',
      description: 'Convert UI screenshots into frontend code, AI prompts, design specifications, or natural language descriptions. Covers the full workflow from UI to implementation or generative design prompts.',
      inputSchema: {
        type: 'object',
        properties: {
          image: {
            type: 'string',
            description: 'Base64-encoded image data URL or public URL of the UI screenshot'
          },
          outputType: {
            type: 'string',
            enum: ['code', 'prompt', 'spec', 'description'],
            description: 'Type of output to generate'
          },
          framework: {
            type: 'string',
            enum: ['react', 'vue', 'angular', 'svelte', 'html', 'nextjs', 'nuxt'],
            description: 'Framework for code output (used when outputType=code)',
            default: 'react'
          },
          language: {
            type: 'string',
            enum: ['typescript', 'javascript', 'python', 'java', 'csharp'],
            description: 'Programming language for code output',
            default: 'typescript'
          },
          model: commonModelProperty
        },
        required: ['image', 'outputType']
      }
    },
    {
      name: 'extract_text_from_screenshot',
      description: 'Extract and recognize text from screenshots using advanced OCR capabilities. Specialized for code, terminal output, documentation, and general text extraction with perfect accuracy.',
      inputSchema: {
        type: 'object',
        properties: {
          image: {
            type: 'string',
            description: 'Base64-encoded image data URL or public URL'
          },
          preserveFormatting: {
            type: 'boolean',
            description: 'Preserve original formatting, line breaks, and spacing',
            default: true
          },
          includeConfidence: {
            type: 'boolean',
            description: 'Mark unclear text with [unclear] indicators',
            default: false
          },
          programmingLanguage: {
            type: 'string',
            description: 'If the image contains code, specify the language for better extraction accuracy (e.g., python, javascript, rust)'
          },
          model: commonModelProperty
        },
        required: ['image']
      }
    },
    {
      name: 'diagnose_error_screenshot',
      description: 'Diagnose and analyze error messages, stack traces, and exception screenshots. Provides actionable solutions with root cause analysis and fix recommendations.',
      inputSchema: {
        type: 'object',
        properties: {
          image: {
            type: 'string',
            description: 'Base64-encoded image data URL or public URL of the error screenshot'
          },
          context: {
            type: 'string',
            description: 'Additional context about when/where the error occurred (e.g., "during npm install", "when running tests")'
          },
          programmingLanguage: {
            type: 'string',
            description: 'Programming language or framework being used (e.g., react, nodejs, python)'
          },
          model: {
            ...commonModelProperty,
            default: 'google/gemini-2.5-pro-preview'
          }
        },
        required: ['image']
      }
    },
    {
      name: 'understand_technical_diagram',
      description: 'Analyze and explain technical diagrams including architecture diagrams, flowcharts, UML diagrams, ER diagrams, sequence diagrams, and network diagrams. Generates structured interpretations.',
      inputSchema: {
        type: 'object',
        properties: {
          image: {
            type: 'string',
            description: 'Base64-encoded image data URL or public URL of the technical diagram'
          },
          diagramType: {
            type: 'string',
            enum: ['architecture', 'flowchart', 'uml', 'er-diagram', 'sequence', 'network', 'auto'],
            description: 'Type of diagram (auto-detect if not specified)',
            default: 'auto'
          },
          detailLevel: {
            type: 'string',
            enum: ['brief', 'detailed', 'comprehensive'],
            description: 'Level of detail in the analysis',
            default: 'detailed'
          },
          model: commonModelProperty
        },
        required: ['image']
      }
    },
    {
      name: 'analyze_data_visualization',
      description: 'Analyze data visualizations including charts, graphs, dashboards, and statistical displays. Extracts trends, anomalies, comparisons, and actionable business insights.',
      inputSchema: {
        type: 'object',
        properties: {
          image: {
            type: 'string',
            description: 'Base64-encoded image data URL or public URL of the data visualization'
          },
          focus: {
            type: 'string',
            enum: ['trends', 'anomalies', 'comparisons', 'insights', 'comprehensive'],
            description: 'Primary focus of the analysis',
            default: 'comprehensive'
          },
          includeMetrics: {
            type: 'boolean',
            description: 'Include specific values and metrics from the chart',
            default: true
          },
          model: commonModelProperty
        },
        required: ['image']
      }
    },
    {
      name: 'ui_diff_check',
      description: 'Compare two UI screenshots to identify visual differences and implementation discrepancies. Specialized for UI quality assurance and design-to-implementation verification.',
      inputSchema: {
        type: 'object',
        properties: {
          expectedImage: {
            type: 'string',
            description: 'Base64-encoded image or URL of the expected/reference UI (design mockup)'
          },
          actualImage: {
            type: 'string',
            description: 'Base64-encoded image or URL of the actual/implemented UI'
          },
          detailLevel: {
            type: 'string',
            enum: ['summary', 'detailed', 'pixel-perfect'],
            description: 'Level of detail in comparison',
            default: 'detailed'
          },
          checkAccessibility: {
            type: 'boolean',
            description: 'Include accessibility checks in the comparison',
            default: true
          },
          model: {
            ...commonModelProperty,
            default: 'google/gemini-2.5-pro-preview'
          }
        },
        required: ['expectedImage', 'actualImage']
      }
    },
    {
      name: 'analyze_image',
      description: 'General-purpose image analysis for scenarios not covered by specialized tools. Provides flexible image understanding for any visual content.',
      inputSchema: {
        type: 'object',
        properties: {
          image: {
            type: 'string',
            description: 'Base64-encoded image data URL or public URL'
          },
          prompt: {
            type: 'string',
            description: 'Specific instructions for what to analyze, extract, or understand from the image'
          },
          detailLevel: {
            type: 'string',
            enum: ['concise', 'standard', 'detailed'],
            description: 'Level of detail in the response',
            default: 'standard'
          },
          model: commonModelProperty
        },
        required: ['image', 'prompt']
      }
    },
    {
      name: 'analyze_video',
      description: 'Analyze video content using advanced AI vision. Supports MP4, MOV, M4V formats (local files max 8MB). Extracts key moments, actions, objects, and provides comprehensive video understanding.',
      inputSchema: {
        type: 'object',
        properties: {
          video: {
            type: 'string',
            description: 'Base64-encoded video data URL (video/mp4, video/mov, video/m4v) or public URL'
          },
          prompt: {
            type: 'string',
            description: 'What to analyze, extract, or understand from the video'
          },
          focus: {
            type: 'string',
            enum: ['summary', 'actions', 'objects', 'transcript', 'detailed'],
            description: 'Primary focus of the video analysis',
            default: 'summary'
          },
          model: {
            ...commonModelProperty,
            default: 'google/gemini-2.0-flash-exp',
            description: 'Any OpenRouter model ID with video support (e.g., google/gemini-2.0-flash-exp, google/gemini-2.5-flash)'
          }
        },
        required: ['video', 'prompt']
      }
    }
  ];
}
