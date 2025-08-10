# Gemini Planning MCP

MCP server that integrates Google Gemini with Context7 documentation for intelligent project planning in Claude.

## Prerequisites

Before installation, make sure you have:

- **Node.js 18+** - [Download](https://nodejs.org/)
- **NPM** (comes with Node.js)
- **Claude Code** - [Download](https://github.com/anthropics/claude-code)
- **Gemini CLI** - [Download](https://github.com/google-gemini/gemini-cli)

Check your versions:

```bash
node --version  # Should be v18 or higher
npm --version   # Should be v8 or higher
claude --version  # Should show Claude CLI version
```

## What it does

When you ask Claude to plan a project, this MCP server:

1. Fetches relevant documentation from Context7
2. Uses Gemini to generate detailed implementation plans
3. Returns structured, actionable project plans

## Installation

### Step 1: Get Gemini API Key

Get your free API key from: https://makersuite.google.com/app/apikey

### Step 2: Create Configuration File

**Windows:**

```bash
(echo GEMINI_API_KEY=your_key_here && echo GEMINI_MODEL=gemini-2.5-pro) > %USERPROFILE%\.env
```

**Mac/Linux:**

```bash
cat > ~/.env << EOF
GEMINI_API_KEY=your_key_here
GEMINI_MODEL=gemini-2.5-pro
EOF
```

### Step 3: Install and Add to Claude

```bash
# Install globally
npm install -g gemini-planning-mcp

# Add to Claude
claude mcp add planning -s user -- gemini-planning

# Verify it's working
claude mcp list
```

You should see: `planning: gemini-planning - ✓ Connected`

## Usage in Claude

```
# Test connection
"Test gemini connection"

# Create project
"Create project context for an e-commerce site with React and Node.js"

# Generate plan with documentation
"Generate plan with libraries: [{name: 'next.js'}, {name: 'stripe'}, {name: 'supabase'}]"

# View as checklist
"Render plan checklist"
```

## Example Workflow

1. **Create a project:**

   ```
   Create project context for a SaaS dashboard with authentication and payments
   ```

2. **Generate detailed plan:**

   ```
   Generate plan with libraries: [{name: 'next.js'}, {name: 'supabase'}, {name: 'stripe'}]
   ```

3. **Get implementation checklist:**
   ```
   Render the plan as a checklist
   ```

## Available Tools

- `test_gemini_connection` - Verify Gemini API connection
- `test_context7_connection` - Verify Context7 documentation service
- `create_project_context` - Start a new project planning session
- `generate_plan_with_gemini` - Create detailed plan with library documentation
- `render_plan_checklist` - Display plan as actionable checklist

## Troubleshooting

### "Failed to connect" error

1. Check your API key in `~/.env` or `%USERPROFILE%\.env`
2. Try reinstalling: `npm install -g gemini-planning-mcp`
3. Restart Claude after adding the MCP server

### Test your setup

```bash
# Check if installed
npm list -g gemini-planning-mcp

# Test directly
gemini-planning
```

## Supported Models

- `gemini-2.5-pro` (recommended)
- `gemini-1.5-pro`
- `gemini-2.0-flash-exp`

## License

MIT
