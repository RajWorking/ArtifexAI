import Anthropic from "@anthropic-ai/sdk";
import { createMcpClient } from "@artifexai/mcp";
import type { Finding } from "./types.js";
import type { Hunt } from "./huntLoader.js";
import { config } from "./config.js";

export interface HuntExecutorConfig {
  mcpCommand: string;
  mcpArgs: string[];
  mcpEnv: Record<string, string>;
  timeRange: string;
}

const SYSTEM_PROMPT = `You are an expert cybersecurity threat hunting agent. Your role is to interpret threat hunting playbooks (provided as markdown) and execute them autonomously to identify security threats.

When given a hunt:
1. Read and understand the hunt's hypothesis and goals
2. Execute the suggested SPL queries using the execute_splunk_query tool
3. Analyze the results to identify suspicious activity
4. Generate findings with appropriate severity and confidence based on what you actually discover

Guidelines for findings:
- **Severity**: Assess dynamically based on the threat level
  - CRITICAL: Active compromise, data exfiltration, ransomware
  - HIGH: Privilege escalation, lateral movement, exploitation attempts
  - MEDIUM: Suspicious activity, policy violations, misconfigurations
  - LOW: Informational findings, best practice gaps

- **Confidence**: Base on the quality and quantity of evidence
  - 90-100%: Multiple strong indicators, clear malicious intent
  - 70-89%: Strong indicators but some ambiguity
  - 50-69%: Suspicious patterns but could be benign
  - Below 50%: Weak signals, likely false positives

- **Evidence**: Extract the most suspicious command lines, IPs, user accounts, etc. (top 5)
- **Affected Entities**: List unique hostnames, user accounts, or systems involved
- **Recommendation**: Provide specific, actionable remediation steps based on what you found

If no suspicious activity is found, return an empty findings array. Only create findings when there is actual evidence of security concerns.`;

const EXECUTE_QUERY_TOOL: Anthropic.Tool = {
  name: "execute_splunk_query",
  description: "Execute a Splunk SPL (Search Processing Language) query and return results. Use this to investigate security events and gather evidence.",
  input_schema: {
    type: "object",
    properties: {
      spl: {
        type: "string",
        description: "The Splunk SPL query to execute"
      },
      description: {
        type: "string",
        description: "Brief description of what this query is looking for (for logging)"
      }
    },
    required: ["spl", "description"]
  }
};

/**
 * Execute a hunt using Claude as an autonomous threat hunting agent
 */
export async function executeHunt(
  hunt: Hunt,
  executorConfig: HuntExecutorConfig
): Promise<Finding[]> {
  if (!config.anthropicApiKey) {
    throw new Error("ANTHROPIC_API_KEY not configured");
  }

  const anthropic = new Anthropic({
    apiKey: config.anthropicApiKey
  });

  // Create MCP client for executing queries
  let mcpClient: Awaited<ReturnType<typeof createMcpClient>> | null = null;

  try {
    mcpClient = await createMcpClient({
      name: "hunt-executor",
      version: "1.0.0",
      timeoutMs: 30000,
      transport: {
        type: "stdio",
        command: executorConfig.mcpCommand,
        args: executorConfig.mcpArgs,
        env: executorConfig.mcpEnv
      }
    });

    // Get available tools from MCP
    const mcpTools = await mcpClient.listTools();
    const queryTool = mcpTools.find((t) =>
      t.name.includes("query") || t.name.includes("search")
    );

    if (!queryTool) {
      throw new Error("No query tool found in Splunk MCP server");
    }

    // Initial message to Claude with the hunt
    const messages: Anthropic.MessageParam[] = [
      {
        role: "user",
        content: `Execute this threat hunt and generate findings if you discover suspicious activity:\n\nTime Range: Last ${executorConfig.timeRange} days\n\n${hunt.content}`
      }
    ];

    let findings: Finding[] = [];
    let continueLoop = true;
    let maxIterations = 10; // Prevent infinite loops
    let iterations = 0;

    // Agentic loop - let Claude decide when it's done
    while (continueLoop && iterations < maxIterations) {
      iterations++;

      const response = await anthropic.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 8000,
        system: SYSTEM_PROMPT,
        messages,
        tools: [EXECUTE_QUERY_TOOL]
      });

      // Add assistant's response to conversation
      messages.push({
        role: "assistant",
        content: response.content
      });

      // Handle tool calls
      if (response.stop_reason === "tool_use") {
        const toolResults: Anthropic.MessageParam = {
          role: "user",
          content: []
        };

        for (const block of response.content) {
          if (block.type === "tool_use" && block.name === "execute_splunk_query") {
            const input = block.input as { spl: string; description: string };

            console.log(`[Hunt Executor] Executing query: ${input.description}`);
            console.log(`[Hunt Executor] SPL: ${input.spl.substring(0, 100)}...`);

            try {
              // Try different argument strategies for the query tool
              const strategies = [
                { query: input.spl },
                { spl: input.spl },
                { search: input.spl }
              ];

              let result: any = null;
              let lastError: Error | null = null;

              for (const args of strategies) {
                try {
                  result = await mcpClient!.callTool(queryTool.name, args);
                  break;
                } catch (err) {
                  lastError = err as Error;
                }
              }

              if (!result) {
                throw lastError || new Error("All query strategies failed");
              }

              (toolResults.content as Anthropic.ToolResultBlockParam[]).push({
                type: "tool_result",
                tool_use_id: block.id,
                content: JSON.stringify(result, null, 2)
              });
            } catch (err) {
              const errorMsg = err instanceof Error ? err.message : "Unknown error";
              (toolResults.content as Anthropic.ToolResultBlockParam[]).push({
                type: "tool_result",
                tool_use_id: block.id,
                content: `Error executing query: ${errorMsg}`,
                is_error: true
              });
            }
          }
        }

        messages.push(toolResults);
      } else if (response.stop_reason === "end_turn") {
        // Claude is done - extract findings from final response
        for (const block of response.content) {
          if (block.type === "text") {
            findings = extractFindingsFromText(block.text, hunt);
          }
        }
        continueLoop = false;
      } else {
        // Unexpected stop reason
        continueLoop = false;
      }
    }

    return findings;
  } finally {
    if (mcpClient) {
      await mcpClient.close();
    }
  }
}

/**
 * Extract Finding objects from Claude's text response
 * Looks for JSON-formatted findings in the response
 */
function extractFindingsFromText(text: string, hunt: Hunt): Finding[] {
  try {
    // Look for JSON array of findings in the response
    const jsonMatch = text.match(/```json\s*([\s\S]*?)\s*```/) ||
                      text.match(/\[[\s\S]*"id"[\s\S]*\]/);

    if (jsonMatch) {
      const jsonText = jsonMatch[1] || jsonMatch[0];
      const parsed = JSON.parse(jsonText);

      if (Array.isArray(parsed)) {
        return parsed.map((f) => ({
          id: f.id || `${hunt.id}-${Date.now()}`,
          severity: f.severity || "medium",
          title: f.title || hunt.id,
          affectedEntities: f.affectedEntities || [],
          evidenceCount: f.evidence?.length || 0,
          confidence: f.confidence || 50,
          description: f.description || "",
          evidence: f.evidence || [],
          queries: f.queries || [],
          recommendation: f.recommendation || ""
        }));
      }
    }

    // If no JSON found, return empty array
    return [];
  } catch (err) {
    console.error("[Hunt Executor] Failed to parse findings from response:", err);
    return [];
  }
}
