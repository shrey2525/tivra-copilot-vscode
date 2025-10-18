import * as vscode from 'vscode';
import { ServiceAnalysis } from './tivraClient';

export class ClaudeIntegration {
  /**
   * Build formatted context for Claude Code
   * This is the CORE of "Where Claude leaves off, we start - we pass runtime context back to Claude"
   */
  buildContext(analysis: ServiceAnalysis): string {
    const { service, metrics, logs, traces, rootCause, recommendations } = analysis;

    // Add defensive checks
    if (!service || !service.name) {
      console.error('Invalid analysis: missing service information', analysis);
      return '# Error: Invalid service analysis data';
    }

    const serviceType = service.type ? service.type.toUpperCase() : 'UNKNOWN';

    let context = `# AWS Runtime Context for ${service.name} (${serviceType})\n\n`;
    context += `*This context was automatically gathered by Tivra CoPilot from AWS CloudWatch Logs, Metrics, and X-Ray traces.*\n\n`;
    context += `---\n\n`;

    // Root Cause Summary
    context += `## 🚨 Issue Summary\n\n`;
    if (rootCause) {
      context += `**Root Cause**: ${rootCause.summary}\n\n`;
      context += `**Confidence**: ${rootCause.confidence}\n\n`;
      context += `**Suggested Fix**: ${rootCause.suggestedFix}\n\n`;
    } else {
      context += `*Root cause analysis in progress...*\n\n`;
    }

    // CloudWatch Metrics
    context += `## 📊 CloudWatch Metrics (Last Hour)\n\n`;
    context += `| Metric | Value |\n`;
    context += `|--------|-------|\n`;
    context += `| Error Rate | **${metrics.errorRate}%** |\n`;
    context += `| Error Count | ${metrics.errorCount} |\n`;
    if (metrics.latency) {
      context += `| P50 Latency | ${metrics.latency.p50}ms |\n`;
      context += `| P95 Latency | ${metrics.latency.p95}ms |\n`;
      context += `| P99 Latency | **${metrics.latency.p99}ms** |\n`;
    }
    if (metrics.throughput !== undefined) {
      context += `| Throughput | ${metrics.throughput} req/min |\n`;
    }
    if (metrics.cpuUtilization !== undefined) {
      context += `| CPU Utilization | ${metrics.cpuUtilization}% |\n`;
    }
    if (metrics.memoryUtilization !== undefined) {
      context += `| Memory Utilization | ${metrics.memoryUtilization}% |\n`;
    }
    context += `\n`;

    // CloudWatch Logs - Top Errors
    context += `## 📝 CloudWatch Logs - Top Errors\n\n`;
    if (logs.errorPatterns && logs.errorPatterns.length > 0) {
      logs.errorPatterns.slice(0, 5).forEach((error, i) => {
        context += `### ${i + 1}. ${error.message} (${error.count} occurrences)\n\n`;

        if (error.stackTrace) {
          context += `**Stack Trace**:\n\`\`\`\n${error.stackTrace.slice(0, 800)}\n${error.stackTrace.length > 800 ? '...' : ''}\n\`\`\`\n\n`;
        }

        if (error.samples && error.samples.length > 0) {
          context += `**Sample Log Entry**:\n\`\`\`\n${error.samples[0].slice(0, 500)}\n${error.samples[0].length > 500 ? '...' : ''}\n\`\`\`\n\n`;
        }

        if (error.firstSeen && error.lastSeen) {
          const firstSeenDate = new Date(error.firstSeen).toLocaleString();
          const lastSeenDate = new Date(error.lastSeen).toLocaleString();
          context += `**First Seen**: ${firstSeenDate}\n`;
          context += `**Last Seen**: ${lastSeenDate}\n\n`;
        }
      });
    } else {
      context += `No errors found in CloudWatch Logs.\n\n`;
    }

    // X-Ray Traces
    if (traces) {
      context += `## 🔍 X-Ray Distributed Traces\n\n`;
      context += `| Metric | Value |\n`;
      context += `|--------|-------|\n`;
      context += `| Total Traces | ${traces.totalTraces} |\n`;
      context += `| Error Traces | **${traces.errorTraces}** |\n`;
      context += `| Error % | ${((traces.errorTraces / (traces.totalTraces || 1)) * 100).toFixed(1)}% |\n`;
      if (traces.p50Latency !== undefined) {
        context += `| P50 Latency | ${traces.p50Latency}ms |\n`;
        context += `| P95 Latency | ${traces.p95Latency}ms |\n`;
        context += `| P99 Latency | **${traces.p99Latency}ms** |\n`;
      }
      context += `\n`;

      if (traces.serviceDependencies && traces.serviceDependencies.length > 0) {
        context += `**Service Dependencies**:\n`;
        traces.serviceDependencies.forEach(dep => {
          context += `- ${dep}\n`;
        });
        context += `\n`;
      }
    }

    // AI Recommendations
    if (recommendations && recommendations.length > 0) {
      context += `## 💡 AI-Generated Recommendations\n\n`;
      recommendations.forEach((rec, i) => {
        const priorityEmoji = rec.priority === 'high' ? '🔴' : rec.priority === 'medium' ? '🟡' : '🟢';
        context += `${i + 1}. ${priorityEmoji} **${rec.action}** (Priority: ${rec.priority})\n`;
        context += `   - ${rec.rationale}\n\n`;
      });
    }

    // Task for Claude
    context += `---\n\n`;
    context += `## 🎯 Your Task\n\n`;
    context += `You are Claude Code running inside VS Code. You have full access to the codebase and this comprehensive AWS runtime context.\n\n`;
    context += `**Please analyze this AWS runtime data and:**\n\n`;
    context += `1. Review the error patterns, stack traces, and metrics above\n`;
    context += `2. Locate the relevant source code files in the workspace\n`;
    context += `3. Generate a fix for the **${serviceType}** service\n`;
    context += `4. Include:\n`;
    context += `   - Proper error handling and try-catch blocks\n`;
    context += `   - Retry logic with exponential backoff (if applicable)\n`;
    context += `   - Enhanced CloudWatch logging\n`;
    context += `   - Input validation\n`;
    context += `   - Performance optimizations based on metrics\n\n`;

    // Service-specific guidance
    if (service.type && service.type.toLowerCase() === 'lambda') {
      context += `**Lambda Function Details**:\n`;
      context += `- Expected file location: \`lambda/${service.name}/index.js\` or \`functions/${service.name}/\`\n`;
      context += `- Focus on: Timeout handling, memory optimization, async/await patterns\n`;
      context += `- Consider: DynamoDB retry logic, API throttling, cold start optimization\n\n`;
    } else if (service.type && service.type.toLowerCase() === 'ecs') {
      context += `**ECS Service Details**:\n`;
      context += `- Expected file locations: \`services/${service.name}/\` or \`ecs/${service.name}/\`\n`;
      context += `- Task definition file: \`ecs/${service.name}-task-def.json\`\n`;
      context += `- Focus on: Resource limits (CPU/Memory), connection pooling, health checks\n`;
      context += `- Consider: Database connection management, graceful shutdown, container health\n\n`;
    }

    context += `**After generating the fix:**\n`;
    context += `- Explain what caused the issue\n`;
    context += `- Show the code changes\n`;
    context += `- Suggest testing approach\n\n`;

    context += `---\n\n`;
    context += `*This runtime context was captured by Tivra CoPilot and automatically passed to Claude Code to close the observability → fix → deploy loop.*\n`;

    return context;
  }

  /**
   * Send context to Claude Code
   * Method 1: Copy to clipboard + open markdown preview
   * Method 2: Create .tivra-context.md file that user can reference
   */
  async sendToClaudeCode(context: string, serviceName: string): Promise<void> {
    // Copy to clipboard
    await vscode.env.clipboard.writeText(context);

    // Create a markdown file in workspace
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (workspaceFolders) {
      const contextFilePath = vscode.Uri.joinPath(workspaceFolders[0].uri, `.tivra-context-${serviceName}.md`);

      try {
        const encoder = new TextEncoder();
        await vscode.workspace.fs.writeFile(contextFilePath, encoder.encode(context));

        // Open the file
        const doc = await vscode.workspace.openTextDocument(contextFilePath);
        await vscode.window.showTextDocument(doc, {
          preview: true,
          viewColumn: vscode.ViewColumn.Beside
        });
      } catch (error) {
        console.error('Failed to create context file:', error);
      }
    }

    // Show notification with clear instructions
    const choice = await vscode.window.showInformationMessage(
      `✅ AWS Runtime Context for ${serviceName} is ready!\n\n📋 Copied to clipboard\n📄 File: .tivra-context-${serviceName}.md`,
      'Open Copilot Chat',
      'Copy Again',
      'Show File'
    );

    if (choice === 'Open Copilot Chat') {
      // Open GitHub Copilot chat with the context
      try {
        // Try to open Copilot chat with the file reference
        await vscode.commands.executeCommand('workbench.action.chat.open', {
          query: `@workspace Please analyze the file .tivra-context-${serviceName}.md and generate a fix for the issues described. The file contains complete AWS runtime context including error patterns, stack traces, metrics, and recommendations.`
        });
        vscode.window.showInformationMessage('🤖 Copilot chat opened! Asking it to analyze the context file...');
      } catch (error) {
        // Fallback: just open the chat and show instructions
        try {
          await vscode.commands.executeCommand('workbench.panel.chat.view.copilot.focus');
        } catch {
          await vscode.commands.executeCommand('workbench.action.chat.open');
        }
        vscode.window.showInformationMessage('💡 Copilot opened! Paste the context with Cmd+V or ask: "@workspace analyze .tivra-context-' + serviceName + '.md"');
      }
    } else if (choice === 'Copy Again') {
      await vscode.env.clipboard.writeText(context);
      vscode.window.showInformationMessage('✅ Context copied! Paste into Copilot with Cmd+V');
    } else if (choice === 'Show File') {
      // Re-open the file
      const workspaceFolders = vscode.workspace.workspaceFolders;
      if (workspaceFolders) {
        const contextFilePath = vscode.Uri.joinPath(workspaceFolders[0].uri, `.tivra-context-${serviceName}.md`);
        const doc = await vscode.workspace.openTextDocument(contextFilePath);
        await vscode.window.showTextDocument(doc, { viewColumn: vscode.ViewColumn.Beside });
      }
    }
  }

  /**
   * Create a formatted summary for VS Code status bar
   */
  getStatusBarSummary(analysis: ServiceAnalysis): string {
    const { service, metrics } = analysis;
    const errorIcon = metrics.errorRate > 5 ? '$(error)' : metrics.errorRate > 2 ? '$(warning)' : '$(check)';
    return `${errorIcon} ${service.name}: ${metrics.errorRate.toFixed(1)}% errors`;
  }

  /**
   * Create diagnostic markers in the editor for errors
   */
  async createDiagnostics(analysis: ServiceAnalysis): Promise<vscode.DiagnosticCollection> {
    const diagnostics = vscode.languages.createDiagnosticCollection('tivra-copilot');

    for (const error of analysis.logs.errorPatterns) {
      if (!error.stackTrace) continue;

      // Extract file path and line from stack trace
      // Pattern: "at functionName (/path/to/file.js:123:45)"
      const fileMatch = error.stackTrace.match(/at\s+.*?\(([^:]+):(\d+):(\d+)\)/);

      if (!fileMatch) continue;

      const [, filePath, line, column] = fileMatch;

      try {
        const uri = vscode.Uri.file(filePath);
        const lineNum = parseInt(line) - 1;
        const colNum = parseInt(column) - 1;

        const range = new vscode.Range(
          new vscode.Position(lineNum, colNum),
          new vscode.Position(lineNum, colNum + 20)
        );

        const diagnostic = new vscode.Diagnostic(
          range,
          `AWS CloudWatch: ${error.message} (${error.count} occurrences in production)`,
          vscode.DiagnosticSeverity.Error
        );

        diagnostic.source = 'Tivra CoPilot';
        diagnostic.code = {
          value: 'aws-runtime-error',
          target: vscode.Uri.parse(`https://console.aws.amazon.com/cloudwatch`)
        };

        diagnostics.set(uri, [diagnostic]);
      } catch (error) {
        console.error('Failed to create diagnostic:', error);
      }
    }

    return diagnostics;
  }

  /**
   * Build a concise context suitable for quick AI queries
   */
  buildQuickContext(analysis: ServiceAnalysis): string {
    const { service, metrics, logs, rootCause } = analysis;

    let quick = `Service: ${service.name} (${service.type})\n`;
    quick += `Error Rate: ${metrics.errorRate}% (${metrics.errorCount} errors)\n`;

    if (logs.errorPatterns.length > 0) {
      quick += `\nTop Error: ${logs.errorPatterns[0].message} (${logs.errorPatterns[0].count}x)\n`;
      if (logs.errorPatterns[0].stackTrace) {
        const firstLine = logs.errorPatterns[0].stackTrace.split('\n')[0];
        quick += `Stack: ${firstLine}\n`;
      }
    }

    if (rootCause) {
      quick += `\nRoot Cause: ${rootCause.summary}\n`;
      quick += `Fix: ${rootCause.suggestedFix}\n`;
    }

    return quick;
  }
}
