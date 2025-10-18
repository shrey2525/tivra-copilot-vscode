// Tivra DebugMind - Smart Debugging Copilot
// Conversational AI that analyzes errors and fixes code

import * as vscode from 'vscode';
import axios from 'axios';

export class DebugCopilot {
  public static currentPanel: DebugCopilot | undefined;
  private readonly _panel: vscode.WebviewPanel;
  private _disposables: vscode.Disposable[] = [];
  private _messages: ChatMessage[] = [];
  private _conversationContext: ConversationContext;
  private _apiUrl: string;

  private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri, apiUrl: string) {
    this._panel = panel;
    this._apiUrl = apiUrl;
    this._conversationContext = {
      service: null,
      recentErrors: [],
      appliedFixes: [],
      conversationHistory: []
    };

    this._panel.webview.html = this._getHtmlForWebview(this._panel.webview, extensionUri);

    // Handle messages from webview
    this._panel.webview.onDidReceiveMessage(
      message => {
        switch (message.type) {
          case 'userMessage':
            this.handleUserMessage(message.text);
            break;
          case 'applyFix':
            this.applyFix(message.fix);
            break;
          case 'rejectFix':
            this.handleFixRejection(message.reason);
            break;
        }
      },
      null,
      this._disposables
    );

    this._panel.onDidDispose(() => this.dispose(), null, this._disposables);
  }

  public static createOrShow(extensionUri: vscode.Uri, apiUrl: string) {
    const column = vscode.ViewColumn.Two;

    if (DebugCopilot.currentPanel) {
      DebugCopilot.currentPanel._panel.reveal(column);
      return DebugCopilot.currentPanel;
    }

    const panel = vscode.window.createWebviewPanel(
      'tivraDebugMind',
      '🤖 Tivra DebugMind',
      column,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [extensionUri]
      }
    );

    DebugCopilot.currentPanel = new DebugCopilot(panel, extensionUri, apiUrl);
    return DebugCopilot.currentPanel;
  }

  /**
   * Analyze service errors and start debugging conversation
   */
  public async startDebugging(serviceName: string, serviceType: string) {
    this._conversationContext.service = { name: serviceName, type: serviceType };

    this.addMessage({
      type: 'system',
      content: `🔍 Analyzing errors in **${serviceName}**...`,
      timestamp: new Date()
    });

    try {
      // Fetch error logs from backend
      const response = await axios.post(`${this._apiUrl}/api/aws/logs/analyze`, {
        serviceName,
        serviceType,
        timeRange: {
          start: Date.now() - 60 * 60 * 1000,
          end: Date.now()
        }
      });

      const analysis = response.data;
      this._conversationContext.recentErrors = analysis.errors || [];

      if (analysis.totalErrors === 0) {
        this.addMessage({
          type: 'ai',
          content: `✅ Good news! No errors found in **${serviceName}** in the last hour.\n\nEverything looks healthy. Let me know if you want to:\n- Check a different time range\n- Monitor another service\n- Analyze warnings`,
          timestamp: new Date()
        });
        return;
      }

      // AI analyzes the errors and starts conversation
      await this.analyzeErrorsWithAI(analysis);

    } catch (error: any) {
      this.addMessage({
        type: 'system',
        content: `❌ Failed to analyze ${serviceName}: ${error.message}`,
        timestamp: new Date()
      });
    }
  }

  /**
   * AI analyzes errors and suggests fixes conversationally
   */
  private async analyzeErrorsWithAI(analysis: any) {
    // Add AI's initial analysis
    this.addMessage({
      type: 'ai',
      content: `I found **${analysis.totalErrors} error(s)** in **${this._conversationContext.service?.name}**. Let me analyze them...`,
      timestamp: new Date(),
      isTyping: true
    });

    try {
      // Call backend AI to get intelligent summary and fix
      const aiResponse = await axios.post(`${this._apiUrl}/api/ai/analyze-errors`, {
        service: this._conversationContext.service,
        errors: this._conversationContext.recentErrors,
        conversationHistory: this._conversationContext.conversationHistory
      });

      const { summary, rootCause, suggestedFix, confidence } = aiResponse.data;

      // Update with AI's analysis
      this.updateLastMessage({
        type: 'ai',
        content: this.formatAIAnalysis(summary, rootCause, confidence),
        timestamp: new Date(),
        suggestedFix: suggestedFix
      });

      // Add to conversation history
      this._conversationContext.conversationHistory.push({
        role: 'assistant',
        content: summary
      });

    } catch (error: any) {
      this.updateLastMessage({
        type: 'ai',
        content: `I analyzed the errors. Here's what I found:\n\n${this.formatSimpleAnalysis(analysis)}`,
        timestamp: new Date()
      });
    }
  }

  /**
   * Format AI's analysis in a conversational way
   */
  private formatAIAnalysis(summary: string, rootCause: string, confidence: string): string {
    let message = `## 🔍 Analysis Complete\n\n`;
    message += `${summary}\n\n`;
    message += `**Root Cause**: ${rootCause}\n\n`;
    message += `**Confidence**: ${confidence}\n\n`;
    message += `💡 I can generate a fix for this. Would you like me to:\n`;
    message += `1. Show you the proposed code changes\n`;
    message += `2. Explain the error in more detail\n`;
    message += `3. Check for similar issues in other services`;
    return message;
  }

  /**
   * Format simple analysis when AI endpoint unavailable
   */
  private formatSimpleAnalysis(analysis: any): string {
    let message = `Found ${analysis.totalErrors} error(s):\n\n`;

    analysis.errors.slice(0, 3).forEach((error: any, i: number) => {
      message += `**${i + 1}. ${error.message}**\n`;
      message += `- Occurred: ${error.count || 1} time(s)\n`;
      message += `- Last seen: ${new Date(error.timestamp).toLocaleTimeString()}\n\n`;
    });

    if (analysis.totalErrors > 3) {
      message += `_...and ${analysis.totalErrors - 3} more errors_\n\n`;
    }

    message += `How can I help you debug this?`;
    return message;
  }

  /**
   * Handle user's message in the chat
   */
  private async handleUserMessage(text: string) {
    // Add user message
    this.addMessage({
      type: 'user',
      content: text,
      timestamp: new Date()
    });

    // Add to conversation history
    this._conversationContext.conversationHistory.push({
      role: 'user',
      content: text
    });

    // Show AI is thinking
    this.addMessage({
      type: 'ai',
      content: '',
      timestamp: new Date(),
      isTyping: true
    });

    try {
      // Send to AI with full context
      const aiResponse = await axios.post(`${this._apiUrl}/api/ai/chat`, {
        message: text,
        context: this._conversationContext
      });

      const { response, suggestedFix } = aiResponse.data;

      // Update AI's response
      this.updateLastMessage({
        type: 'ai',
        content: response,
        timestamp: new Date(),
        suggestedFix: suggestedFix
      });

      // Add to conversation history
      this._conversationContext.conversationHistory.push({
        role: 'assistant',
        content: response
      });

    } catch (error: any) {
      // Fallback to simple response
      this.updateLastMessage({
        type: 'ai',
        content: this.generateFallbackResponse(text),
        timestamp: new Date()
      });
    }
  }

  /**
   * Generate fallback response when AI unavailable
   */
  private generateFallbackResponse(userMessage: string): string {
    const lowerMessage = userMessage.toLowerCase();

    if (lowerMessage.includes('fix') || lowerMessage.includes('solve')) {
      return `I can help you fix this! Let me analyze the errors and generate a code fix. Give me a moment... 🔧`;
    }

    if (lowerMessage.includes('why') || lowerMessage.includes('cause')) {
      return `Based on the error logs, this appears to be related to the errors I showed earlier. Would you like me to dive deeper into the root cause?`;
    }

    if (lowerMessage.includes('show') || lowerMessage.includes('code')) {
      return `I can show you the relevant code sections. Which error would you like to investigate first?`;
    }

    return `I understand. Let me help you with that. Based on the errors I found, what would you like to focus on first?`;
  }

  /**
   * Apply code fix to the workspace
   */
  private async applyFix(fix: CodeFix) {
    try {
      const uri = vscode.Uri.file(fix.filePath);

      // Check if file exists
      let document: vscode.TextDocument;
      try {
        document = await vscode.workspace.openTextDocument(uri);
      } catch {
        // Create file if doesn't exist
        const workspaceEdit = new vscode.WorkspaceEdit();
        workspaceEdit.createFile(uri, { ignoreIfExists: true });
        await vscode.workspace.applyEdit(workspaceEdit);
        document = await vscode.workspace.openTextDocument(uri);
      }

      // Show diff preview
      const tempUri = vscode.Uri.parse(`untitled:${fix.filePath}.proposed`);
      const tempDoc = await vscode.workspace.openTextDocument(tempUri);
      const edit = new vscode.WorkspaceEdit();
      edit.insert(tempUri, new vscode.Position(0, 0), fix.newCode);
      await vscode.workspace.applyEdit(edit);

      // Show side-by-side diff
      await vscode.commands.executeCommand(
        'vscode.diff',
        uri,
        tempUri,
        `${fix.filePath.split('/').pop()} - Proposed Fix`
      );

      // Ask for confirmation
      const choice = await vscode.window.showInformationMessage(
        `Apply fix to ${fix.filePath}?`,
        'Apply', 'Cancel'
      );

      if (choice === 'Apply') {
        // Apply the fix
        const fullRange = new vscode.Range(
          document.positionAt(0),
          document.positionAt(document.getText().length)
        );
        const finalEdit = new vscode.WorkspaceEdit();
        finalEdit.replace(uri, fullRange, fix.newCode);
        const success = await vscode.workspace.applyEdit(finalEdit);

        if (success) {
          await document.save();

          // Track applied fix
          this._conversationContext.appliedFixes.push({
            filePath: fix.filePath,
            timestamp: new Date()
          });

          this.addMessage({
            type: 'system',
            content: `✅ Fix applied to **${fix.filePath}**`,
            timestamp: new Date()
          });

          this.addMessage({
            type: 'ai',
            content: `Great! I've applied the fix. The changes should:\n\n${fix.explanation}\n\nWould you like me to:\n- Verify the fix works\n- Check for similar issues\n- Help with testing`,
            timestamp: new Date()
          });
        }
      } else {
        this.addMessage({
          type: 'system',
          content: `Fix not applied.`,
          timestamp: new Date()
        });
      }

    } catch (error: any) {
      this.addMessage({
        type: 'system',
        content: `❌ Failed to apply fix: ${error.message}`,
        timestamp: new Date()
      });
    }
  }

  /**
   * Handle when user rejects a fix
   */
  private handleFixRejection(reason?: string) {
    this.addMessage({
      type: 'ai',
      content: `I understand. ${reason ? `You mentioned: "${reason}". ` : ''}Let me suggest an alternative approach. What would you prefer?\n\n1. A different implementation\n2. More explanation about the issue\n3. Break down the fix into smaller steps`,
      timestamp: new Date()
    });
  }

  private addMessage(message: ChatMessage) {
    this._messages.push(message);
    this._updateWebview();
  }

  private updateLastMessage(message: ChatMessage) {
    if (this._messages.length > 0) {
      this._messages[this._messages.length - 1] = message;
      this._updateWebview();
    }
  }

  private _updateWebview() {
    this._panel.webview.postMessage({
      type: 'update',
      messages: this._messages
    });
  }

  private _getHtmlForWebview(webview: vscode.Webview, extensionUri: vscode.Uri) {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Tivra DebugMind</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }

    body {
      font-family: var(--vscode-font-family);
      color: var(--vscode-foreground);
      background-color: var(--vscode-editor-background);
      height: 100vh;
      display: flex;
      flex-direction: column;
    }

    .header {
      padding: 16px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .header h2 {
      font-size: 16px;
      font-weight: 600;
    }

    .status { font-size: 12px; opacity: 0.9; }

    .messages {
      flex: 1;
      overflow-y: auto;
      padding: 20px;
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    .message {
      padding: 14px 16px;
      border-radius: 12px;
      max-width: 85%;
      animation: slideIn 0.3s ease-out;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    }

    @keyframes slideIn {
      from { opacity: 0; transform: translateY(10px); }
      to { opacity: 1; transform: translateY(0); }
    }

    .message.user {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      align-self: flex-end;
    }

    .message.ai {
      background-color: var(--vscode-editor-selectionBackground);
      align-self: flex-start;
      border-left: 3px solid #667eea;
    }

    .message.system {
      background-color: var(--vscode-inputValidation-infoBackground);
      align-self: center;
      font-size: 13px;
      text-align: center;
      max-width: 60%;
      border-radius: 20px;
    }

    .message-header {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 10px;
      font-size: 12px;
      font-weight: 600;
      opacity: 0.8;
    }

    .message-content {
      line-height: 1.6;
      font-size: 14px;
    }

    .message-content h2 { font-size: 16px; margin: 12px 0 8px; }
    .message-content h3 { font-size: 14px; margin: 10px 0 6px; }
    .message-content strong { font-weight: 600; }
    .message-content code {
      background-color: rgba(0,0,0,0.1);
      padding: 2px 6px;
      border-radius: 4px;
      font-size: 13px;
    }

    .message-content pre {
      background-color: var(--vscode-textBlockQuote-background);
      padding: 12px;
      border-radius: 6px;
      overflow-x: auto;
      margin: 10px 0;
    }

    .typing-indicator {
      display: inline-flex;
      gap: 4px;
      align-items: center;
    }

    .typing-indicator span {
      width: 8px;
      height: 8px;
      background-color: #667eea;
      border-radius: 50%;
      animation: bounce 1.4s infinite;
    }

    .typing-indicator span:nth-child(2) { animation-delay: 0.2s; }
    .typing-indicator span:nth-child(3) { animation-delay: 0.4s; }

    @keyframes bounce {
      0%, 60%, 100% { transform: translateY(0); }
      30% { transform: translateY(-10px); }
    }

    .fix-actions {
      margin-top: 16px;
      display: flex;
      gap: 10px;
    }

    .fix-button {
      padding: 10px 18px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      border: none;
      border-radius: 8px;
      cursor: pointer;
      font-size: 13px;
      font-weight: 500;
      transition: transform 0.2s;
    }

    .fix-button:hover { transform: scale(1.05); }

    .fix-button.secondary {
      background: var(--vscode-button-secondaryBackground);
      color: var(--vscode-button-secondaryForeground);
    }

    .input-container {
      padding: 16px;
      background-color: var(--vscode-editor-background);
      border-top: 1px solid var(--vscode-panel-border);
      display: flex;
      gap: 10px;
    }

    #messageInput {
      flex: 1;
      padding: 12px 16px;
      background-color: var(--vscode-input-background);
      color: var(--vscode-input-foreground);
      border: 1px solid var(--vscode-input-border);
      border-radius: 24px;
      font-family: var(--vscode-font-family);
      font-size: 14px;
    }

    #sendButton {
      padding: 12px 24px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      border: none;
      border-radius: 24px;
      cursor: pointer;
      font-size: 14px;
      font-weight: 500;
    }

    #sendButton:hover { opacity: 0.9; }
  </style>
</head>
<body>
  <div class="header">
    <span>🤖</span>
    <div>
      <h2>Tivra DebugMind</h2>
      <div class="status">AI Debugging Assistant</div>
    </div>
  </div>

  <div class="messages" id="messages"></div>

  <div class="input-container">
    <input
      type="text"
      id="messageInput"
      placeholder="Ask me about your errors..."
      autocomplete="off"
    />
    <button id="sendButton">Send</button>
  </div>

  <script>
    const vscode = acquireVsCodeApi();
    const messagesContainer = document.getElementById('messages');
    const messageInput = document.getElementById('messageInput');
    const sendButton = document.getElementById('sendButton');

    window.addEventListener('message', event => {
      const message = event.data;
      if (message.type === 'update') {
        renderMessages(message.messages);
      }
    });

    function renderMessages(messages) {
      messagesContainer.innerHTML = '';

      messages.forEach(msg => {
        const messageDiv = document.createElement('div');
        messageDiv.className = \`message \${msg.type}\`;

        let html = '';

        if (msg.type !== 'system') {
          html += \`<div class="message-header">\`;
          html += msg.type === 'user' ? '👤 You' : '🤖 DebugMind';
          html += \` • \${new Date(msg.timestamp).toLocaleTimeString()}\`;
          html += \`</div>\`;
        }

        if (msg.isTyping) {
          html += \`<div class="typing-indicator"><span></span><span></span><span></span></div>\`;
        } else {
          html += \`<div class="message-content">\${formatContent(msg.content)}</div>\`;

          if (msg.suggestedFix) {
            html += \`<div class="fix-actions">
              <button class="fix-button" onclick='applyFix(\${JSON.stringify(msg.suggestedFix).replace(/'/g, "&apos;")})'>
                ✨ Apply Fix
              </button>
              <button class="fix-button secondary" onclick="rejectFix()">
                Not Now
              </button>
            </div>\`;
          }
        }

        messageDiv.innerHTML = html;
        messagesContainer.appendChild(messageDiv);
      });

      messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

    function formatContent(content) {
      const backtick = String.fromCharCode(96);
      content = content.replace(/\\n/g, '<br>');
      content = content.replace(/\`\`\`([\\s\\S]*?)\`\`\`/g, '<pre><code>$1</code></pre>');
      const singleBacktickRegex = new RegExp(backtick + '([^' + backtick + ']+)' + backtick, 'g');
      content = content.replace(singleBacktickRegex, '<code>$1</code>');
      content = content.replace(/\\*\\*(.+?)\\*\\*/g, '<strong>$1</strong>');
      content = content.replace(/^### (.+)$/gm, '<h3>$1</h3>');
      content = content.replace(/^## (.+)$/gm, '<h2>$1</h2>');
      return content;
    }

    function sendMessage() {
      const text = messageInput.value.trim();
      if (!text) return;

      vscode.postMessage({ type: 'userMessage', text: text });
      messageInput.value = '';
    }

    function applyFix(fix) {
      vscode.postMessage({ type: 'applyFix', fix: fix });
    }

    function rejectFix() {
      vscode.postMessage({ type: 'rejectFix' });
    }

    sendButton.addEventListener('click', sendMessage);
    messageInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') sendMessage();
    });
  </script>
</body>
</html>`;
  }

  public dispose() {
    DebugCopilot.currentPanel = undefined;
    this._panel.dispose();
    while (this._disposables.length) {
      const disposable = this._disposables.pop();
      if (disposable) disposable.dispose();
    }
  }
}

interface ChatMessage {
  type: 'user' | 'ai' | 'system';
  content: string;
  timestamp: Date;
  suggestedFix?: CodeFix;
  isTyping?: boolean;
}

interface CodeFix {
  filePath: string;
  newCode: string;
  explanation: string;
}

interface ConversationContext {
  service: { name: string; type: string } | null;
  recentErrors: any[];
  appliedFixes: Array<{ filePath: string; timestamp: Date }>;
  conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }>;
}
