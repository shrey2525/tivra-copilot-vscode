/**
 * Permission Manager for Auto-Healing
 * Checks and manages permissions for GitHub, AWS, and other services
 */

import * as vscode from 'vscode';
import axios from 'axios';

export interface Permissions {
  github: {
    connected: boolean;
    canReadCode: boolean;
    canCreatePR: boolean;
    scopes?: string[];
  };
  aws: {
    connected: boolean;
    canReadLogs: boolean;
    canReadServices: boolean;
  };
}

export class PermissionManager {
  private apiUrl: string;

  constructor(apiUrl: string) {
    this.apiUrl = apiUrl;
  }

  /**
   * Check all required permissions for auto-healing
   */
  async checkPermissions(): Promise<Permissions> {
    const [github, aws] = await Promise.all([
      this.checkGitHubPermissions(),
      this.checkAWSPermissions()
    ]);

    return {
      github,
      aws
    };
  }

  /**
   * Check GitHub permissions
   */
  private async checkGitHubPermissions(): Promise<Permissions['github']> {
    try {
      const response = await axios.get(`${this.apiUrl}/api/github/status`, {
        timeout: 5000
      });

      if (response.data.authenticated) {
        return {
          connected: true,
          canReadCode: true, // OAuth scope: repo or public_repo
          canCreatePR: response.data.scopes?.includes('repo') || false,
          scopes: response.data.scopes || []
        };
      }

      return {
        connected: false,
        canReadCode: false,
        canCreatePR: false
      };
    } catch (error) {
      console.error('[PermissionManager] GitHub permission check failed:', error);
      return {
        connected: false,
        canReadCode: false,
        canCreatePR: false
      };
    }
  }

  /**
   * Check AWS permissions
   */
  private async checkAWSPermissions(): Promise<Permissions['aws']> {
    try {
      const response = await axios.get(`${this.apiUrl}/api/aws/status`, {
        timeout: 5000
      });

      return {
        connected: response.data.connected || false,
        canReadLogs: response.data.connected || false,
        canReadServices: response.data.connected || false
      };
    } catch (error) {
      console.error('[PermissionManager] AWS permission check failed:', error);
      return {
        connected: false,
        canReadLogs: false,
        canReadServices: false
      };
    }
  }

  /**
   * Request GitHub OAuth permission
   */
  async requestGitHubPermission(): Promise<boolean> {
    try {
      // Initiate GitHub OAuth flow
      const authUrl = `${this.apiUrl}/api/github/auth?redirect=vscode`;

      // Open browser for OAuth
      const opened = await vscode.env.openExternal(vscode.Uri.parse(authUrl));

      if (!opened) {
        vscode.window.showErrorMessage('Failed to open GitHub authorization page');
        return false;
      }

      // Show message to user
      const action = await vscode.window.showInformationMessage(
        '🔗 GitHub Authorization Required',
        'Complete the authorization in your browser, then click "Done"',
        'Done',
        'Cancel'
      );

      if (action === 'Done') {
        // Re-check permissions
        const permissions = await this.checkGitHubPermissions();
        return permissions.connected;
      }

      return false;
    } catch (error) {
      console.error('[PermissionManager] GitHub permission request failed:', error);
      vscode.window.showErrorMessage('Failed to request GitHub permission');
      return false;
    }
  }

  /**
   * Request AWS permission (already handled by AWS connection flow)
   */
  async requestAWSPermission(): Promise<boolean> {
    const action = await vscode.window.showInformationMessage(
      '🔗 AWS Connection Required',
      'Connect to AWS to enable auto-healing features',
      'Connect to AWS',
      'Cancel'
    );

    if (action === 'Connect to AWS') {
      // Trigger AWS connection command
      await vscode.commands.executeCommand('tivra.connectAWS');

      // Re-check permissions
      const permissions = await this.checkAWSPermissions();
      return permissions.connected;
    }

    return false;
  }

  /**
   * Prompt user for missing permissions
   */
  async promptForMissingPermissions(permissions: Permissions): Promise<boolean> {
    const missing: string[] = [];

    if (!permissions.github.connected) {
      missing.push('GitHub (for code context and PR creation)');
    }
    if (!permissions.aws.connected) {
      missing.push('AWS (for log access and service info)');
    }

    if (missing.length === 0) {
      return true;
    }

    const message = `🔒 Additional permissions needed:\n\n${missing.map(m => `• ${m}`).join('\n')}`;

    const action = await vscode.window.showWarningMessage(
      message,
      'Grant Permissions',
      'Skip Auto-Healing',
      'Cancel'
    );

    if (action === 'Grant Permissions') {
      // Request missing permissions
      if (!permissions.github.connected) {
        const githubGranted = await this.requestGitHubPermission();
        if (!githubGranted) {
          return false;
        }
      }

      if (!permissions.aws.connected) {
        const awsGranted = await this.requestAWSPermission();
        if (!awsGranted) {
          return false;
        }
      }

      return true;
    } else if (action === 'Skip Auto-Healing') {
      // User wants to proceed without auto-healing
      return true;
    }

    return false;
  }

  /**
   * Check if auto-healing can proceed
   */
  async canEnableAutoHealing(): Promise<{ enabled: boolean; reason?: string }> {
    const permissions = await this.checkPermissions();

    // Minimum requirements: AWS connection
    if (!permissions.aws.connected) {
      return {
        enabled: false,
        reason: 'AWS connection required'
      };
    }

    // GitHub is optional but recommended
    if (!permissions.github.connected) {
      return {
        enabled: true, // Can proceed but with limited features
        reason: 'GitHub not connected - PR creation disabled'
      };
    }

    // Check specific permissions
    if (!permissions.github.canCreatePR) {
      return {
        enabled: true,
        reason: 'Limited GitHub permissions - PR creation may fail'
      };
    }

    return { enabled: true };
  }

  /**
   * Get permission summary for display
   */
  async getPermissionSummary(): Promise<string> {
    const permissions = await this.checkPermissions();

    let summary = '**Permissions:**\n\n';

    // GitHub
    if (permissions.github.connected) {
      summary += `✅ GitHub Connected\n`;
      summary += `  • Read code: ${permissions.github.canReadCode ? '✅' : '❌'}\n`;
      summary += `  • Create PRs: ${permissions.github.canCreatePR ? '✅' : '❌'}\n`;
    } else {
      summary += `❌ GitHub Not Connected\n`;
    }

    summary += '\n';

    // AWS
    if (permissions.aws.connected) {
      summary += `✅ AWS Connected\n`;
      summary += `  • Read logs: ✅\n`;
      summary += `  • Read services: ✅\n`;
    } else {
      summary += `❌ AWS Not Connected\n`;
    }

    return summary;
  }
}
