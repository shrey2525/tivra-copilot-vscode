// Agentic Fix Client - Automatically generates and applies code fixes in VS Code
// Similar to how Claude Code works

import * as vscode from 'vscode';
import axios from 'axios';

export interface FixProposal {
  filePath: string;
  originalCode: string;
  fixedCode: string;
  explanation: string;
  changes: CodeChange[];
}

export interface CodeChange {
  type: 'add' | 'modify' | 'delete';
  lineStart: number;
  lineEnd: number;
  oldCode: string;
  newCode: string;
  description: string;
}

export class AgenticClient {
  private apiUrl: string;

  constructor(apiUrl: string) {
    this.apiUrl = apiUrl;
  }

  /**
   * Generate and apply a fix automatically in VS Code
   * This is the agentic approach - no manual copy/paste needed!
   */
  async generateAndApplyFix(analysis: any): Promise<void> {
    try {
      // Step 1: Show progress
      await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: 'Tivra CoPilot',
        cancellable: true
      }, async (progress, token) => {

        progress.report({ message: 'Analyzing AWS runtime context...' });

        // Step 2: Call backend to generate fix
        progress.report({ message: 'AI generating code fix...', increment: 30 });
        const fixProposal = await this.generateFix(analysis);

        if (token.isCancellationRequested) {
          return;
        }

        // Step 3: Show preview of changes
        progress.report({ message: 'Preparing code changes...', increment: 30 });
        const userApproved = await this.showFixPreview(fixProposal);

        if (!userApproved || token.isCancellationRequested) {
          vscode.window.showInformationMessage('Fix cancelled.');
          return;
        }

        // Step 4: Apply the fix to the workspace
        progress.report({ message: 'Applying fix to code...', increment: 30 });
        await this.applyFix(fixProposal);

        // Step 5: Success!
        progress.report({ message: 'Fix applied successfully!', increment: 10 });

        vscode.window.showInformationMessage(
          `✅ Fix applied to ${fixProposal.filePath}`,
          'View File',
          'Create PR'
        ).then(choice => {
          if (choice === 'View File') {
            this.openFile(fixProposal.filePath);
          } else if (choice === 'Create PR') {
            this.createPullRequest(fixProposal);
          }
        });
      });

    } catch (error: any) {
      console.error('Agentic fix error:', error);
      vscode.window.showErrorMessage(`Failed to generate fix: ${error.message}`);
    }
  }

  /**
   * Call backend API to generate code fix
   */
  private async generateFix(analysis: any): Promise<FixProposal> {
    try {
      const response = await axios.post(`${this.apiUrl}/api/aws/propose-fix`, {
        serviceName: analysis.service?.name || analysis.service,
        serviceType: analysis.serviceType,
        analysis: analysis,
        workspaceRoot: vscode.workspace.workspaceFolders?.[0]?.uri.fsPath
      }, {
        timeout: 60000 // 60 second timeout for AI generation
      });

      return response.data.fixProposal;
    } catch (error: any) {
      if (error.response?.status === 404) {
        throw new Error('Fix generation endpoint not found. Please update your backend.');
      }
      throw new Error(error.response?.data?.error || error.message);
    }
  }

  /**
   * Show a diff preview of the proposed changes
   * Let the user review before applying
   */
  private async showFixPreview(fixProposal: FixProposal): Promise<boolean> {
    // Create a temporary file with the proposed changes
    const originalUri = vscode.Uri.file(fixProposal.filePath);
    const modifiedUri = vscode.Uri.parse(`tivra-preview:${fixProposal.filePath}`);

    // Register a text document content provider for preview
    const provider = new class implements vscode.TextDocumentContentProvider {
      provideTextDocumentContent(uri: vscode.Uri): string {
        return fixProposal.fixedCode;
      }
    };

    const providerDisposable = vscode.workspace.registerTextDocumentContentProvider('tivra-preview', provider);

    try {
      // Show diff view
      await vscode.commands.executeCommand(
        'vscode.diff',
        originalUri,
        modifiedUri,
        `Tivra Fix Preview: ${fixProposal.filePath.split('/').pop()}`,
        { preview: true }
      );

      // Ask user to confirm
      const choice = await vscode.window.showInformationMessage(
        `🤖 Tivra AI proposes changes to ${fixProposal.filePath}:\n\n${fixProposal.explanation}`,
        { modal: true },
        'Apply Fix',
        'Cancel'
      );

      return choice === 'Apply Fix';

    } finally {
      providerDisposable.dispose();
    }
  }

  /**
   * Apply the fix to the actual file in the workspace
   */
  private async applyFix(fixProposal: FixProposal): Promise<void> {
    const uri = vscode.Uri.file(fixProposal.filePath);

    try {
      // Check if file exists
      let document: vscode.TextDocument;
      try {
        document = await vscode.workspace.openTextDocument(uri);
      } catch {
        // File doesn't exist, create it
        const workspaceEdit = new vscode.WorkspaceEdit();
        workspaceEdit.createFile(uri, { ignoreIfExists: true });
        await vscode.workspace.applyEdit(workspaceEdit);
        document = await vscode.workspace.openTextDocument(uri);
      }

      // Apply the changes using WorkspaceEdit for proper undo/redo
      const edit = new vscode.WorkspaceEdit();
      const fullRange = new vscode.Range(
        document.positionAt(0),
        document.positionAt(document.getText().length)
      );

      edit.replace(uri, fullRange, fixProposal.fixedCode);

      const success = await vscode.workspace.applyEdit(edit);

      if (!success) {
        throw new Error('Failed to apply edit to workspace');
      }

      // Save the document
      await document.save();

      console.log(`✅ Successfully applied fix to ${fixProposal.filePath}`);

    } catch (error: any) {
      console.error('Error applying fix:', error);
      throw new Error(`Failed to apply fix: ${error.message}`);
    }
  }

  /**
   * Open the file in the editor
   */
  private async openFile(filePath: string): Promise<void> {
    const uri = vscode.Uri.file(filePath);
    const document = await vscode.workspace.openTextDocument(uri);
    await vscode.window.showTextDocument(document);
  }

  /**
   * Create a pull request with the fix (if GitHub integration is available)
   */
  private async createPullRequest(fixProposal: FixProposal): Promise<void> {
    try {
      // Check if GitHub extension is available
      const ghExtension = vscode.extensions.getExtension('GitHub.vscode-pull-request-github');

      if (!ghExtension) {
        vscode.window.showWarningMessage(
          'GitHub Pull Request extension not installed. Install it to create PRs directly from VS Code.',
          'Install'
        ).then(choice => {
          if (choice === 'Install') {
            vscode.commands.executeCommand('workbench.extensions.installExtension', 'GitHub.vscode-pull-request-github');
          }
        });
        return;
      }

      // Call backend to create PR via GitHub API
      const response = await axios.post(`${this.apiUrl}/api/aws/create-pr`, {
        fixProposal: fixProposal,
        title: `Fix: ${fixProposal.explanation}`,
        body: `## AI-Generated Fix

${fixProposal.explanation}

### Changes Made:
${fixProposal.changes.map(c => `- ${c.description}`).join('\n')}

---
🤖 Generated by Tivra CoPilot`
      });

      const prUrl = response.data.pullRequestUrl;
      vscode.window.showInformationMessage(
        `✅ Pull request created!`,
        'Open PR'
      ).then(choice => {
        if (choice === 'Open PR') {
          vscode.env.openExternal(vscode.Uri.parse(prUrl));
        }
      });

    } catch (error: any) {
      console.error('Error creating PR:', error);
      vscode.window.showErrorMessage(`Failed to create PR: ${error.message}`);
    }
  }

  /**
   * Generate fix in the background and show a quick pick when ready
   * This is a non-blocking approach for better UX
   */
  async generateFixInBackground(analysis: any): Promise<void> {
    // Show a status bar message while generating
    const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
    statusBarItem.text = '$(sync~spin) Tivra: Generating fix...';
    statusBarItem.show();

    try {
      const fixProposal = await this.generateFix(analysis);
      statusBarItem.hide();

      // Show quick action
      const choice = await vscode.window.showInformationMessage(
        `🤖 Fix ready for ${analysis.service?.name || analysis.service}`,
        'Preview & Apply',
        'Dismiss'
      );

      if (choice === 'Preview & Apply') {
        const userApproved = await this.showFixPreview(fixProposal);
        if (userApproved) {
          await this.applyFix(fixProposal);
          vscode.window.showInformationMessage(`✅ Fix applied to ${fixProposal.filePath}`);
        }
      }

    } catch (error: any) {
      statusBarItem.hide();
      vscode.window.showErrorMessage(`Failed to generate fix: ${error.message}`);
    } finally {
      statusBarItem.dispose();
    }
  }
}
