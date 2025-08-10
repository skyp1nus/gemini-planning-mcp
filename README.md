# Gemini Planning MCP

MCP server that integrates Google Gemini with Context7 documentation for intelligent project planning in Claude.

## What it does

When you ask Claude to plan a project, this MCP server:

1. Fetches relevant documentation from Context7
2. Uses Gemini to generate detailed implementation plans
3. Returns structured, actionable project plans

## Installation

```bash
claude mcp add planning -s user -- env GEMINI_API_KEY=your_key npx gemini-planning-mcp
```

Get your Gemini API key: https://makersuite.google.com/app/apikey

## Usage

In Claude, use these commands:

```
# 1. Create project context
"Create project context for an e-commerce site with React and Node.js"

# 2. Generate plan with documentation
"Generate plan with libraries: [{name: 'next.js'}, {name: 'stripe'}, {name: 'supabase'}]"

# 3. View as checklist
"Render plan checklist"
```

## Available Tools

- `test_gemini_connection` - Test Gemini API
- `test_context7_connection` - Test Context7 API
- `create_project_context` - Create new project
- `generate_plan_with_gemini` - Generate plan with docs
- `render_plan_checklist` - Show plan as checklist

## Environment Variables

- `GEMINI_API_KEY` - Required, your Gemini API key
- `GEMINI_MODEL` - Optional, default: `gemini-2.0-flash-exp`
- `CONTEXT7_URL` - Optional, default: `https://mcp.context7.com/mcp`

## License

MIT
