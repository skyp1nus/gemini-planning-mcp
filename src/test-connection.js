#!/usr/bin/env node

import { GoogleGenerativeAI } from "@google/generative-ai";
import chalk from "chalk";
import ora from "ora";

const CONTEXT7_URL = process.env.CONTEXT7_URL || "https://mcp.context7.com/mcp";

async function testConnection() {
  console.log(
    chalk.cyan(`
╔══════════════════════════════════════════════════════╗
║             🧪 Testing MCP Gemini                     ║
╚══════════════════════════════════════════════════════╝
`),
  );

  const config = {
    apiKey: process.env.GEMINI_API_KEY || "",
    model: process.env.GEMINI_MODEL || "gemini-2.0-flash-exp",
    temperature: parseFloat(process.env.GEMINI_TEMPERATURE || "0.3"),
    maxTokens: parseInt(process.env.GEMINI_MAX_TOKENS || "8000"),
  };

  // Check API key
  if (!config.apiKey) {
    console.log(chalk.red("❌ GEMINI_API_KEY not set!"));
    console.log(
      chalk.yellow("Get your key at: https://makersuite.google.com/app/apikey"),
    );
    console.log(chalk.gray("Set it: export GEMINI_API_KEY=your_key_here"));
    process.exit(1);
  }

  let spinner;
  let successCount = 0;
  let failCount = 0;

  // Test Gemini
  console.log(chalk.bold("1. Testing Gemini Connection..."));
  spinner = ora("Connecting to Gemini...").start();

  try {
    const genAI = new GoogleGenerativeAI(config.apiKey);
    const model = genAI.getGenerativeModel({
      model: config.model,
      generationConfig: {
        temperature: config.temperature,
        maxOutputTokens: config.maxTokens,
      },
    });

    spinner.text = "Sending test request...";
    const result = await model.generateContent(
      'Respond with exactly: "Connection successful!"',
    );
    const response = result.response.text();

    spinner.succeed("Gemini connected successfully!");
    console.log(chalk.gray(`  Response: ${response.substring(0, 50)}...`));
    console.log(chalk.gray(`  Model: ${config.model}`));
    successCount++;
  } catch (error) {
    spinner.fail("Gemini connection failed!");
    console.log(chalk.red(`  Error: ${error.message}`));
    failCount++;
  }

  console.log();

  // Test Context7
  console.log(chalk.bold("2. Testing Context7 Connection..."));
  spinner = ora("Connecting to Context7...").start();

  try {
    const res = await fetch(CONTEXT7_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "application/json, text/event-stream",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: String(Date.now()),
        method: "tools/list",
      }),
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const text = await res.text();
    let data;

    try {
      if (text.includes("data:")) {
        const lines = text.split("\n").filter((l) => l.startsWith("data:"));
        const lastLine = lines[lines.length - 1];
        data = JSON.parse(lastLine.replace("data:", "").trim());
      } else {
        data = JSON.parse(text);
      }
    } catch {
      throw new Error("Failed to parse response");
    }

    if (data.error) throw new Error(data.error.message);

    spinner.succeed("Context7 connected successfully!");
    console.log(chalk.gray(`  URL: ${CONTEXT7_URL}`));
    if (data.result?.tools) {
      console.log(chalk.gray(`  Available tools: ${data.result.tools.length}`));
    }
    successCount++;
  } catch (error) {
    spinner.fail("Context7 connection failed!");
    console.log(chalk.red(`  Error: ${error.message}`));
    failCount++;
  }

  console.log();

  // Test tool integration
  console.log(chalk.bold("3. Testing Tool Integration..."));
  const toolTests = [
    {
      name: "Library Resolution",
      test: async () => {
        const res = await fetch(CONTEXT7_URL, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            jsonrpc: "2.0",
            id: "1",
            method: "tools/call",
            params: {
              name: "resolve-library-id",
              arguments: { libraryName: "react" },
            },
          }),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return true;
      },
    },
    {
      name: "Documentation Fetch",
      test: async () => {
        const genAI = new GoogleGenerativeAI(config.apiKey);
        const model = genAI.getGenerativeModel({ model: config.model });
        const result = await model.generateContent(
          "List 3 React hooks in one line",
        );
        return result.response.text().length > 0;
      },
    },
  ];

  for (const { name, test } of toolTests) {
    const testSpinner = ora(`Testing ${name}...`).start();
    try {
      await test();
      testSpinner.succeed(`${name}: OK`);
      successCount++;
    } catch (error) {
      testSpinner.fail(`${name}: Failed`);
      failCount++;
    }
  }

  // Summary
  console.log();
  console.log(chalk.cyan("═══════════════════════════════════════════"));

  if (failCount === 0) {
    console.log(chalk.green("✅ All tests passed!"));
  } else {
    console.log(
      chalk.yellow(`⚠️  ${successCount} passed, ${failCount} failed`),
    );
  }

  console.log(chalk.cyan("═══════════════════════════════════════════"));
  console.log();

  // System info
  console.log(chalk.bold("System Information:"));
  console.log(`  Model: ${chalk.cyan(config.model)}`);
  console.log(`  Temperature: ${chalk.cyan(config.temperature)}`);
  console.log(`  Max Tokens: ${chalk.cyan(config.maxTokens)}`);
  console.log(`  API Key: ${chalk.cyan("***" + config.apiKey.slice(-4))}`);
  console.log(`  Context7 URL: ${chalk.cyan(CONTEXT7_URL)}`);
  console.log();

  if (failCount === 0) {
    console.log(chalk.green("🚀 MCP Gemini is ready to use!"));
  } else {
    console.log(chalk.yellow("⚠️  Some components need attention."));
    process.exit(1);
  }
}

testConnection().catch((error) => {
  console.error(chalk.red("Fatal error:"), error);
  process.exit(1);
});
