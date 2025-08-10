#!/usr/bin/env node

import { config as dotenvConfig } from "dotenv";
import { homedir } from "os";
import { join } from "path";

// Шукаємо .env в домашній папці
dotenvConfig({ path: join(homedir(), ".env") });

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { GoogleGenerativeAI } from "@google/generative-ai";

const CONTEXT7_URL = process.env.CONTEXT7_URL || "https://mcp.context7.com/mcp";

// Configuration
const config = {
  apiKey: process.env.GEMINI_API_KEY || "",
  model: process.env.GEMINI_MODEL || "gemini-2.5-pro",
  temperature: parseFloat(process.env.GEMINI_TEMPERATURE || "0.3"),
  maxTokens: parseInt(process.env.GEMINI_MAX_TOKENS || "8000"),
};

// Initialize Gemini
const genAI = new GoogleGenerativeAI(config.apiKey);
const model = genAI.getGenerativeModel({
  model: config.model,
  generationConfig: {
    temperature: config.temperature,
    maxOutputTokens: config.maxTokens,
  },
});

// Context store - simple in-memory storage
const contexts = new Map();

// Initialize MCP Server
const server = new Server(
  {
    name: "gemini-planning-server",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  },
);

// Context7 client
async function callContext7(method, params = {}) {
  const body = {
    jsonrpc: "2.0",
    id: String(Date.now()),
    method,
    params,
  };

  const res = await fetch(CONTEXT7_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "application/json, text/event-stream",
    },
    body: JSON.stringify(body),
  });

  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Context7 HTTP ${res.status}: ${text}`);
  }

  // Parse response (handle SSE format)
  let data;
  try {
    if (text.includes("data:")) {
      const lines = text.split("\n").filter((l) => l.startsWith("data:"));
      const lastLine = lines[lines.length - 1];
      data = JSON.parse(lastLine.replace("data:", "").trim());
    } else {
      data = JSON.parse(text);
    }
  } catch (e) {
    throw new Error(`Failed to parse Context7 response: ${text}`);
  }

  if (data.error) throw new Error(data.error.message);
  return data.result;
}

// Tool handlers
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "test_gemini_connection",
        description: "Test connection to Gemini",
        inputSchema: {
          type: "object",
          properties: {},
          required: [],
        },
      },
      {
        name: "test_context7_connection",
        description: "Test connection to Context7 MCP",
        inputSchema: {
          type: "object",
          properties: {},
          required: [],
        },
      },
      {
        name: "create_project_context",
        description: "Create a new project planning context",
        inputSchema: {
          type: "object",
          properties: {
            projectName: { type: "string", description: "Name of the project" },
            requirements: {
              type: "string",
              description: "Project requirements",
            },
            constraints: { type: "string", description: "Any constraints" },
          },
          required: ["projectName", "requirements"],
        },
      },
      {
        name: "generate_plan_with_gemini",
        description:
          "Generate implementation plan using Gemini with Context7 docs",
        inputSchema: {
          type: "object",
          properties: {
            contextId: { type: "string", description: "Project context ID" },
            projectName: {
              type: "string",
              description: "Project name (if no contextId)",
            },
            requirements: {
              type: "string",
              description: "Requirements (if no contextId)",
            },
            constraints: {
              type: "string",
              description: "Additional constraints",
            },
            libraries: {
              type: "array",
              description: "Libraries to fetch docs for",
              items: {
                type: "object",
                properties: {
                  name: { type: "string" },
                  topic: { type: "string" },
                  tokens: { type: "number" },
                },
                required: ["name"],
              },
            },
          },
        },
      },
      {
        name: "render_plan_checklist",
        description: "Render plan as a checklist",
        inputSchema: {
          type: "object",
          properties: {
            contextId: { type: "string", description: "Context ID" },
          },
          required: ["contextId"],
        },
      },
    ],
  };
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  try {
    const { name, arguments: args } = request.params;

    switch (name) {
      case "test_gemini_connection": {
        const result = await model.generateContent(
          'Say "Connection successful" in JSON format',
        );
        const response = result.response.text();
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  success: true,
                  message: "Gemini connection successful",
                  model: config.model,
                  response,
                },
                null,
                2,
              ),
            },
          ],
        };
      }

      case "test_context7_connection": {
        try {
          const result = await callContext7("tools/list");
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(
                  {
                    success: true,
                    url: CONTEXT7_URL,
                    tools: result,
                  },
                  null,
                  2,
                ),
              },
            ],
          };
        } catch (e) {
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(
                  {
                    success: false,
                    error: e.message,
                  },
                  null,
                  2,
                ),
              },
            ],
            isError: true,
          };
        }
      }

      case "create_project_context": {
        const { projectName, requirements, constraints } = args;
        const contextId = `${projectName.toLowerCase().replace(/\s+/g, "-")}-${Date.now()}`;

        const context = {
          id: contextId,
          projectName,
          requirements,
          constraints,
          planningHistory: [],
          createdAt: new Date(),
        };

        contexts.set(contextId, context);

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  success: true,
                  contextId,
                  message: `Created project context: ${contextId}`,
                  projectName,
                },
                null,
                2,
              ),
            },
          ],
        };
      }

      case "generate_plan_with_gemini": {
        const {
          contextId,
          projectName,
          requirements,
          constraints,
          libraries = [],
        } = args;

        // Get or create context
        let context;
        if (contextId) {
          context = contexts.get(contextId);
          if (!context) throw new Error(`Context ${contextId} not found`);
        } else {
          if (!projectName || !requirements) {
            throw new Error("Provide contextId OR projectName + requirements");
          }
          const newContextId = `${projectName.toLowerCase().replace(/\s+/g, "-")}-${Date.now()}`;
          context = {
            id: newContextId,
            projectName,
            requirements,
            constraints,
            planningHistory: [],
            createdAt: new Date(),
          };
          contexts.set(newContextId, context);
        }

        // Fetch Context7 docs if libraries provided
        let referenceDocs = "";
        if (libraries.length > 0) {
          for (const lib of libraries) {
            try {
              // Resolve library ID
              const idResult = await callContext7("tools/call", {
                name: "resolve-library-id",
                arguments: { libraryName: lib.name },
              });
              const libraryId = idResult.content?.[0]?.text?.trim();

              // Get docs
              const docsArgs = { context7CompatibleLibraryID: libraryId };
              if (lib.topic) docsArgs.topic = lib.topic;
              if (lib.tokens) docsArgs.tokens = lib.tokens;

              const docsResult = await callContext7("tools/call", {
                name: "get-library-docs",
                arguments: docsArgs,
              });

              const docs = docsResult.content?.[0]?.text || "";
              referenceDocs += `\n\nLibrary: ${lib.name}${lib.topic ? ` (${lib.topic})` : ""}\n${docs}`;
            } catch (e) {
              console.error(`Failed to fetch docs for ${lib.name}:`, e);
            }
          }
        }

        // Build prompt
        const prompt = `Create a concrete implementation plan for this project.

PROJECT: ${context.projectName}
REQUIREMENTS: ${context.requirements}
${constraints ? `CONSTRAINTS: ${constraints}` : ""}
${referenceDocs ? `\nREFERENCE DOCUMENTATION:\n${referenceDocs}` : ""}

Respond with valid JSON using this schema:
{
  "overview": "Project description",
  "architecture": [
    { "component": "string", "purpose": "string", "technologies": ["string"] }
  ],
  "implementation_steps": [
    {
      "id": "string",
      "phase": "setup|core|features|testing",
      "description": "string",
      "files_to_create": ["string"],
      "dependencies": ["string"]
    }
  ],
  "file_structure": {},
  "dependencies": [
    { "name": "string", "version": "string", "purpose": "string" }
  ],
  "testing_strategy": "string",
  "deployment_notes": "string"
}`;

        // Generate plan with Gemini
        const result = await model.generateContent(prompt);
        let planText = result.response.text();

        // Parse JSON from response
        let plan;
        try {
          // Try to extract JSON from markdown code blocks
          const jsonMatch =
            planText.match(/```json\s*([\s\S]*?)\s*```/) ||
            planText.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            plan = JSON.parse(jsonMatch[jsonMatch.length - 1]);
          } else {
            plan = JSON.parse(planText);
          }
        } catch (e) {
          throw new Error(`Failed to parse plan: ${e.message}`);
        }

        // Save to context
        context.planningHistory.push({
          id: `plan-${Date.now()}`,
          timestamp: new Date(),
          plan,
          libraries: libraries.map((l) => l.name),
        });

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  success: true,
                  contextId: context.id,
                  plan,
                  message: "Plan generated successfully",
                },
                null,
                2,
              ),
            },
          ],
        };
      }

      case "render_plan_checklist": {
        const { contextId } = args;
        const context = contexts.get(contextId);
        if (!context) throw new Error(`Context ${contextId} not found`);
        if (!context.planningHistory.length) throw new Error("No plans found");

        const latestPlan =
          context.planningHistory[context.planningHistory.length - 1].plan;

        let checklist = `# ${context.projectName}\n\n`;
        checklist += `## Overview\n${latestPlan.overview}\n\n`;

        if (latestPlan.dependencies?.length) {
          checklist += `## Dependencies\n`;
          latestPlan.dependencies.forEach((dep) => {
            checklist += `- [ ] ${dep.name}@${dep.version} - ${dep.purpose}\n`;
          });
          checklist += "\n";
        }

        if (latestPlan.implementation_steps?.length) {
          checklist += `## Implementation Steps\n`;
          const phases = {};
          latestPlan.implementation_steps.forEach((step) => {
            if (!phases[step.phase]) phases[step.phase] = [];
            phases[step.phase].push(step);
          });

          Object.entries(phases).forEach(([phase, steps]) => {
            checklist += `\n### ${phase}\n`;
            steps.forEach((step) => {
              checklist += `- [ ] ${step.description}\n`;
              if (step.files_to_create?.length) {
                step.files_to_create.forEach((file) => {
                  checklist += `  - Create: ${file}\n`;
                });
              }
            });
          });
        }

        return {
          content: [
            {
              type: "text",
              text: checklist,
            },
          ],
        };
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              success: false,
              error: error.message,
            },
            null,
            2,
          ),
        },
      ],
      isError: true,
    };
  }
});

// Start server
async function main() {
  if (!config.apiKey) {
    console.error("❌ GEMINI_API_KEY not set!");
    console.log("Set it: export GEMINI_API_KEY=your_key_here");
    process.exit(1);
  }

  console.log("🚀 Starting Gemini Planning MCP Server...");
  console.log(`Model: ${config.model}`);

  const transport = new StdioServerTransport();
  await server.connect(transport);

  console.log("✅ Server running");
}

main().catch((error) => {
  console.error("Server failed:", error);
  process.exit(1);
});
