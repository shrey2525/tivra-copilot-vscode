import * as vscode from 'vscode';
import { TivraClient, AWSService, ServiceAnalysis } from './api/tivraClient';
import { ClaudeIntegration } from './api/claudeClient';
import { TivraWebSocketClient, ServiceUpdate } from './api/wsClient';
import { AgenticClient } from './api/agenticClient';

let tivraClient: TivraClient;
let claudeIntegration: ClaudeIntegration;
let agenticClient: AgenticClient;
let wsClient: TivraWebSocketClient | null = null;
let statusBarItem: vscode.StatusBarItem;
let currentAnalysis: ServiceAnalysis | null = null;
let awsServices: AWSService[] = [];
let diagnosticsCollection: vscode.DiagnosticCollection;

export async function activate(context: vscode.ExtensionContext) {
  console.log('Tivra CoPilot extension activated!');

  // Initialize clients
  const apiUrl = vscode.workspace.getConfiguration('tivra').get<string>('apiUrl') || 'https://copilot.tivra.ai';
  tivraClient = new TivraClient(apiUrl);
  claudeIntegration = new ClaudeIntegration();
  agenticClient = new AgenticClient(apiUrl);

  // Create status bar item
  statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
  statusBarItem.command = 'tivra.showRuntimeContext';
  context.subscriptions.push(statusBarItem);

  // Create diagnostics collection
  diagnosticsCollection = vscode.languages.createDiagnosticCollection('tivra-copilot');
  context.subscriptions.push(diagnosticsCollection);

  // Register commands
  context.subscriptions.push(
    vscode.commands.registerCommand('tivra.connectAWS', async () => {
      await connectToAWS();
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('tivra.analyzeService', async () => {
      await analyzeService();
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('tivra.generateFix', async (analysis?: ServiceAnalysis) => {
      await generateFixWithClaude(analysis || currentAnalysis);
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('tivra.showRuntimeContext', async () => {
      if (currentAnalysis) {
        await showRuntimeContextPanel(currentAnalysis);
      } else {
        vscode.window.showWarningMessage('No analysis available. Run "Tivra: Analyze AWS Service" first.');
      }
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('tivra.navigateToError', async (error: any) => {
      await navigateToError(error);
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('tivra.refreshServices', async () => {
      await refreshServices();
    })
  );

  // Initialize WebSocket client for real-time updates
  const wsUrl = apiUrl.replace('http://', 'ws://').replace('https://', 'wss://').replace(':3001', ':3002');
  wsClient = new TivraWebSocketClient(
    wsUrl,
    (update: ServiceUpdate) => handleServiceUpdate(update),
    (connected: boolean) => handleWebSocketConnectionChange(connected)
  );

  // Check Tivra connection on startup
  const connected = await tivraClient.checkConnection();
  if (connected) {
    vscode.window.showInformationMessage('✅ Tivra CoPilot connected to AWS');
    statusBarItem.text = '$(cloud) Tivra: Connected';
    statusBarItem.show();

    // Auto-discover services
    await refreshServices();

    // Connect WebSocket for real-time updates
    wsClient.connect();
  } else {
    statusBarItem.text = '$(cloud-offline) Tivra: Not Connected';
    statusBarItem.show();

    const choice = await vscode.window.showWarningMessage(
      'Tivra CoPilot is not connected to AWS',
      'Connect Now',
      'Dismiss'
    );

    if (choice === 'Connect Now') {
      await vscode.commands.executeCommand('tivra.connectAWS');
    }
  }

  // Auto-refresh if enabled
  const autoRefresh = vscode.workspace.getConfiguration('tivra').get<boolean>('autoRefresh');
  if (autoRefresh && connected) {
    const interval = vscode.workspace.getConfiguration('tivra').get<number>('refreshInterval') || 300000;
    setInterval(async () => {
      await refreshServices();
      await checkForCriticalErrors();
    }, interval);
  }
}

async function connectToAWS() {
  const accessKeyId = await vscode.window.showInputBox({
    prompt: 'AWS Access Key ID',
    password: false,
    placeHolder: 'AKIAIOSFODNN7EXAMPLE',
    ignoreFocusOut: true
  });

  if (!accessKeyId) return;

  const secretAccessKey = await vscode.window.showInputBox({
    prompt: 'AWS Secret Access Key',
    password: true,
    placeHolder: '********',
    ignoreFocusOut: true
  });

  if (!secretAccessKey) return;

  const region = await vscode.window.showQuickPick(
    ['us-east-1', 'us-west-2', 'us-east-2', 'us-west-1', 'eu-west-1', 'eu-central-1', 'ap-southeast-1', 'ap-northeast-1'],
    { placeHolder: 'Select AWS Region', ignoreFocusOut: true }
  );

  if (!region) return;

  await vscode.window.withProgress({
    location: vscode.ProgressLocation.Notification,
    title: 'Connecting to AWS...',
    cancellable: false
  }, async (progress) => {
    progress.report({ increment: 0, message: 'Authenticating...' });

    const result = await tivraClient.connect(accessKeyId, secretAccessKey, region);

    if (result.ok) {
      progress.report({ increment: 50, message: 'Connected! Discovering services...' });

      statusBarItem.text = '$(cloud) Tivra: Connected';
      statusBarItem.show();

      vscode.window.showInformationMessage(
        `✅ AWS Connected! Account: ${result.account.id}, Region: ${result.account.region}`
      );

      // Discover services
      await refreshServices();

      progress.report({ increment: 100, message: 'Done!' });
    } else {
      statusBarItem.text = '$(cloud-offline) Tivra: Connection Failed';
      statusBarItem.show();

      vscode.window.showErrorMessage(`❌ Failed to connect to AWS: ${result.error}`);
    }
  });
}

async function refreshServices(): Promise<void> {
  awsServices = await tivraClient.discoverServices();

  if (awsServices.length > 0) {
    vscode.window.showInformationMessage(
      `🎉 Found ${awsServices.length} AWS Services: ${awsServices.slice(0, 3).map(s => s.name).join(', ')}${awsServices.length > 3 ? '...' : ''}`
    );
  }
}

async function analyzeService() {
  if (awsServices.length === 0) {
    const choice = await vscode.window.showWarningMessage(
      'No AWS services found. Connect to AWS first.',
      'Connect Now'
    );

    if (choice === 'Connect Now') {
      await vscode.commands.executeCommand('tivra.connectAWS');
    }
    return;
  }

  // Show quick pick with services
  const selected = await vscode.window.showQuickPick(
    awsServices.map(s => ({
      label: `$(${getServiceIcon(s.type)}) ${s.name}`,
      description: s.type.toUpperCase(),
      detail: `Error Rate: ${s.errorRate.toFixed(1)}% | Invocations (24h): ${s.invocations24h?.toLocaleString() || 'N/A'}`,
      service: s
    })),
    {
      placeHolder: 'Select AWS service to analyze',
      matchOnDescription: true,
      matchOnDetail: true
    }
  );

  if (!selected) return;

  // Analyze the service
  await vscode.window.withProgress({
    location: vscode.ProgressLocation.Notification,
    title: `Analyzing ${selected.service.name}...`,
    cancellable: false
  }, async (progress) => {
    progress.report({ increment: 0, message: 'Fetching CloudWatch Logs...' });

    const analysis = await tivraClient.analyzeService(
      selected.service.name,
      selected.service.type
    );

    if (!analysis) {
      vscode.window.showErrorMessage(`Failed to analyze ${selected.service.name}`);
      return;
    }

    // Transform backend response to expected format
    // Backend returns: { service: "name", serviceType: "type", ... }
    // We need: { service: { name: "name", type: "type" }, ... }
    if (typeof (analysis as any).service === 'string') {
      const serviceName = (analysis as any).service;
      const serviceType = (analysis as any).serviceType;
      analysis.service = {
        name: serviceName,
        type: serviceType
      };
    } else if (!analysis.service) {
      // Fallback: use the service we selected
      analysis.service = {
        name: selected.service.name,
        type: selected.service.type
      };
    }

    currentAnalysis = analysis;

    progress.report({ increment: 100, message: 'Analysis complete!' });

    // Update status bar
    statusBarItem.text = claudeIntegration.getStatusBarSummary(analysis);
    statusBarItem.show();

    // Create diagnostics
    await claudeIntegration.createDiagnostics(analysis);

    // Show summary
    const errorRate = analysis.metrics.errorRate;
    const severity = errorRate > 5 ? 'critical' : errorRate > 2 ? 'warning' : 'healthy';

    let message = '';
    if (severity === 'critical') {
      message = `🚨 ${selected.service.name}: ${errorRate.toFixed(1)}% error rate (${analysis.logs.totalErrors} errors)\n\n`;
      message += `Root Cause: ${analysis.rootCause?.summary || 'Analyzing...'}`;
    } else if (severity === 'warning') {
      message = `⚠️  ${selected.service.name}: ${errorRate.toFixed(1)}% error rate (${analysis.logs.totalErrors} errors)`;
    } else {
      message = `✅ ${selected.service.name}: ${errorRate.toFixed(1)}% error rate (healthy)`;
    }

    const choice = await vscode.window.showInformationMessage(
      message,
      'Generate Fix with Claude',
      'View Full Context',
      'Dismiss'
    );

    if (choice === 'Generate Fix with Claude') {
      await vscode.commands.executeCommand('tivra.generateFix', analysis);
    } else if (choice === 'View Full Context') {
      await showRuntimeContextPanel(analysis);
    }
  });
}

async function generateFixWithClaude(analysis: ServiceAnalysis | null) {
  if (!analysis) {
    vscode.window.showWarningMessage('No analysis available. Run "Tivra: Analyze AWS Service" first.');
    return;
  }

  // Ensure analysis has service info (it might be missing from backend or passed incorrectly)
  // Try to get it from currentAnalysis if available
  if (!analysis.service && currentAnalysis && currentAnalysis.service) {
    analysis.service = currentAnalysis.service;
  }

  // If still missing, we can't continue
  if (!analysis.service || !analysis.service.name) {
    console.error('Invalid analysis object - missing service info:', JSON.stringify(analysis, null, 2));
    vscode.window.showErrorMessage('Invalid analysis data. Service information is missing. Please try analyzing the service again.');
    return;
  }

  // NEW: Use agentic client to automatically generate and apply fix
  // This replaces the manual copy/paste to Copilot chat workflow
  // The fix will be generated by AI, shown as a diff preview, and applied directly to the code
  await agenticClient.generateAndApplyFix(analysis);
}

async function showRuntimeContextPanel(analysis: ServiceAnalysis) {
  const panel = vscode.window.createWebviewPanel(
    'tivraRuntimeContext',
    `AWS Context: ${analysis.service.name}`,
    vscode.ViewColumn.Two,
    {
      enableScripts: true
    }
  );

  panel.webview.html = getWebviewContent(analysis);

  // Handle messages from webview
  panel.webview.onDidReceiveMessage(async (message) => {
    switch (message.command) {
      case 'generateFix':
        await vscode.commands.executeCommand('tivra.generateFix', analysis);
        break;
      case 'copyContext':
        const context = claudeIntegration.buildContext(analysis);
        await vscode.env.clipboard.writeText(context);
        vscode.window.showInformationMessage('Context copied to clipboard!');
        break;
    }
  });
}

function getWebviewContent(analysis: ServiceAnalysis): string {
  const { service, metrics, logs, traces, rootCause, recommendations } = analysis;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>AWS Runtime Context</title>
  <style>
    body {
      padding: 20px;
      color: var(--vscode-foreground);
      font-family: var(--vscode-font-family);
      font-size: var(--vscode-font-size);
      line-height: 1.6;
    }
    h1 {
      color: var(--vscode-textLink-foreground);
      border-bottom: 2px solid var(--vscode-textLink-foreground);
      padding-bottom: 10px;
    }
    h2 {
      color: var(--vscode-textLink-foreground);
      margin-top: 30px;
    }
    .metric-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 15px;
      margin: 20px 0;
    }
    .metric-card {
      background: var(--vscode-editor-background);
      border: 1px solid var(--vscode-panel-border);
      border-radius: 4px;
      padding: 15px;
    }
    .metric-label {
      font-size: 12px;
      color: var(--vscode-descriptionForeground);
      text-transform: uppercase;
    }
    .metric-value {
      font-size: 24px;
      font-weight: bold;
      margin-top: 5px;
    }
    .metric-value.critical { color: #f48771; }
    .metric-value.warning { color: #ddb15f; }
    .metric-value.healthy { color: #89d185; }
    .error-card {
      background: var(--vscode-editor-background);
      border-left: 3px solid #f48771;
      padding: 15px;
      margin: 10px 0;
    }
    .error-title {
      font-weight: bold;
      color: #f48771;
    }
    .code-block {
      background: var(--vscode-textBlockQuote-background);
      border: 1px solid var(--vscode-textBlockQuote-border);
      padding: 10px;
      border-radius: 4px;
      font-family: var(--vscode-editor-font-family);
      font-size: 12px;
      overflow-x: auto;
      margin: 10px 0;
    }
    .recommendation {
      background: var(--vscode-textBlockQuote-background);
      border-left: 3px solid var(--vscode-textLink-foreground);
      padding: 10px;
      margin: 10px 0;
    }
    .button {
      background: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
      border: none;
      padding: 10px 20px;
      border-radius: 4px;
      cursor: pointer;
      font-size: 14px;
      margin-right: 10px;
    }
    .button:hover {
      background: var(--vscode-button-hoverBackground);
    }
    .actions {
      margin-top: 30px;
      padding-top: 20px;
      border-top: 1px solid var(--vscode-panel-border);
    }
  </style>
</head>
<body>
  <h1>🔍 AWS Runtime Context: ${service.name}</h1>
  <p style="color: var(--vscode-descriptionForeground);">
    Service Type: <strong>${service.type.toUpperCase()}</strong> |
    Last Updated: <strong>${new Date().toLocaleString()}</strong>
  </p>

  <h2>📊 CloudWatch Metrics</h2>
  <div class="metric-grid">
    <div class="metric-card">
      <div class="metric-label">Error Rate</div>
      <div class="metric-value ${metrics.errorRate > 5 ? 'critical' : metrics.errorRate > 2 ? 'warning' : 'healthy'}">
        ${metrics.errorRate.toFixed(1)}%
      </div>
    </div>
    <div class="metric-card">
      <div class="metric-label">Error Count</div>
      <div class="metric-value">${metrics.errorCount}</div>
    </div>
    ${metrics.latency ? `
      <div class="metric-card">
        <div class="metric-label">P99 Latency</div>
        <div class="metric-value">${metrics.latency.p99}ms</div>
      </div>
    ` : ''}
    ${metrics.cpuUtilization !== undefined ? `
      <div class="metric-card">
        <div class="metric-label">CPU Utilization</div>
        <div class="metric-value ${metrics.cpuUtilization > 80 ? 'critical' : 'healthy'}">
          ${metrics.cpuUtilization.toFixed(1)}%
        </div>
      </div>
    ` : ''}
  </div>

  ${rootCause ? `
    <h2>🚨 Root Cause Analysis</h2>
    <div class="error-card">
      <p><strong>Summary:</strong> ${rootCause.summary}</p>
      <p><strong>Confidence:</strong> ${rootCause.confidence}</p>
      <p><strong>Suggested Fix:</strong> ${rootCause.suggestedFix}</p>
    </div>
  ` : ''}

  <h2>📝 CloudWatch Logs - Top Errors</h2>
  ${logs.errorPatterns.slice(0, 5).map((error, i) => `
    <div class="error-card">
      <div class="error-title">${i + 1}. ${error.message} (${error.count} occurrences)</div>
      ${error.stackTrace ? `
        <div class="code-block">${error.stackTrace.slice(0, 500).replace(/</g, '&lt;').replace(/>/g, '&gt;')}${error.stackTrace.length > 500 ? '...' : ''}</div>
      ` : ''}
    </div>
  `).join('')}

  ${traces ? `
    <h2>🔍 X-Ray Traces</h2>
    <p>
      Total Traces: <strong>${traces.totalTraces}</strong> |
      Error Traces: <strong>${traces.errorTraces}</strong> |
      Error %: <strong>${((traces.errorTraces / (traces.totalTraces || 1)) * 100).toFixed(1)}%</strong>
    </p>
    ${traces.serviceDependencies.length > 0 ? `
      <p><strong>Dependencies:</strong> ${traces.serviceDependencies.join(', ')}</p>
    ` : ''}
  ` : ''}

  ${recommendations && recommendations.length > 0 ? `
    <h2>💡 AI Recommendations</h2>
    ${recommendations.map((rec, i) => `
      <div class="recommendation">
        <strong>${i + 1}. ${rec.action}</strong> (Priority: ${rec.priority})<br>
        ${rec.rationale}
      </div>
    `).join('')}
  `: ''}

  <div class="actions">
    <button class="button" onclick="generateFix()">🤖 Generate Fix with Claude</button>
    <button class="button" onclick="copyContext()">📋 Copy Full Context</button>
  </div>

  <script>
    const vscode = acquireVsCodeApi();

    function generateFix() {
      vscode.postMessage({ command: 'generateFix' });
    }

    function copyContext() {
      vscode.postMessage({ command: 'copyContext' });
    }
  </script>
</body>
</html>`;
}

async function navigateToError(error: any) {
  if (!error || !error.stackTrace) {
    vscode.window.showWarningMessage('No stack trace available for this error');
    return;
  }

  // Extract file path and line from stack trace
  const fileMatch = error.stackTrace.match(/at\s+.*?\(([^:]+):(\d+):(\d+)\)/);

  if (!fileMatch) {
    vscode.window.showWarningMessage('Could not extract file location from stack trace');
    return;
  }

  const [, filePath, line, column] = fileMatch;

  try {
    const uri = vscode.Uri.file(filePath);
    const position = new vscode.Position(parseInt(line) - 1, parseInt(column) - 1);

    const doc = await vscode.workspace.openTextDocument(uri);
    const editor = await vscode.window.showTextDocument(doc);
    editor.selection = new vscode.Selection(position, position);
    editor.revealRange(new vscode.Range(position, position), vscode.TextEditorRevealType.InCenter);
  } catch (error) {
    vscode.window.showErrorMessage(`Failed to open file: ${filePath}`);
  }
}

async function checkForCriticalErrors(): Promise<void> {
  const notifyOnErrors = vscode.workspace.getConfiguration('tivra').get<boolean>('notifyOnErrors');
  if (!notifyOnErrors) return;

  const criticalServices = awsServices.filter(s => s.errorRate > 5);

  if (criticalServices.length > 0) {
    const choice = await vscode.window.showWarningMessage(
      `⚠️ ${criticalServices.length} service(s) with high error rates: ${criticalServices.map(s => s.name).join(', ')}`,
      'Analyze Now',
      'Dismiss'
    );

    if (choice === 'Analyze Now') {
      await vscode.commands.executeCommand('tivra.analyzeService');
    }
  }
}

function getServiceIcon(type: string): string {
  switch (type) {
    case 'lambda': return 'zap';
    case 'ecs': return 'server';
    case 'rds': return 'database';
    case 'apigateway': return 'globe';
    default: return 'cloud';
  }
}

// WebSocket event handlers
function handleServiceUpdate(update: ServiceUpdate): void {
  console.log(`Received service update for ${update.serviceName}`);

  // Update current analysis if it's the same service
  if (currentAnalysis && currentAnalysis.service.name === update.serviceName) {
    currentAnalysis = update.analysis;
    statusBarItem.text = claudeIntegration.getStatusBarSummary(update.analysis);
  }

  // Update diagnostics
  if (update.analysis) {
    claudeIntegration.createDiagnostics(update.analysis);
  }
}

function handleWebSocketConnectionChange(connected: boolean): void {
  if (connected) {
    console.log('WebSocket connected - real-time updates enabled');
    // Subscribe to services with high error rates
    const criticalServices = awsServices.filter(s => s.errorRate > 5);
    criticalServices.forEach(service => {
      if (wsClient) {
        wsClient.subscribe(service.name);
      }
    });
  } else {
    console.log('WebSocket disconnected - real-time updates disabled');
  }
}

export function deactivate() {
  console.log('Tivra CoPilot extension deactivated');

  if (diagnosticsCollection) {
    diagnosticsCollection.dispose();
  }

  if (wsClient) {
    wsClient.disconnect();
  }
}
