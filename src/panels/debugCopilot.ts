// Tivra DebugMind - Smart Debugging Copilot
// Conversational AI that analyzes errors and fixes code

import * as vscode from 'vscode';
import axios from 'axios';
import { E2EEncryption } from '../utils/e2e-encryption';
import { CredentialManager, AWSCredentials } from '../utils/credential-manager';
import { AnalyticsTracker } from '../analytics/analytics-tracker';

export class DebugCopilot {
  public static currentPanel: DebugCopilot | undefined;
  private readonly _panel: vscode.WebviewPanel;
  private _disposables: vscode.Disposable[] = [];
  private _messages: ChatMessage[] = [];
  private _conversationContext: ConversationContext;
  private _apiUrl: string;
  private _awsConnectionState: {
    step: 'ACCESS_KEY' | 'SECRET_KEY' | 'REGION' | 'EC2_LOG_GROUP';
    accessKeyId?: string;
    secretAccessKey?: string;
    region?: string;
    serviceName?: string;
    logGroupName?: string;
  } | null = null;
  private _monitoringInterval: NodeJS.Timeout | null = null;
  private _isMonitoring: boolean = false;
  private _awsServices: any[] = [];
  private _errorAnalysisData: any = null; // Store analysis for context
  private _servicesNeedingLogGroup: any[] = []; // Services that need manual log group config

  // Real-time monitoring with polling only (WebSocket removed)
  private _pollingInterval: NodeJS.Timeout | null = null;
  private _lastPollTime: Map<string, number> = new Map(); // Track last poll time per service

  // E2E Encryption
  private _encryption: E2EEncryption | null = null;
  private _encryptionEnabled: boolean = true; // Enable encryption by default

  // Credential Manager
  private _credentialManager: CredentialManager;

  // Analytics
  private _analytics: AnalyticsTracker | undefined;

  private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri, apiUrl: string, credentialManager: CredentialManager, analytics?: AnalyticsTracker) {
    this._panel = panel;
    this._apiUrl = apiUrl;
    this._credentialManager = credentialManager;
    this._analytics = analytics;

    // Initialize E2E encryption
    this._encryption = new E2EEncryption(apiUrl);
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

    // Show welcome message
    this.showWelcomeMessage();
  }

  /**
   * Show welcome message with instructions
   */
  private async showWelcomeMessage() {
    try {
      // First, try to migrate credentials from workspace config (for upgrading users)
      await this._credentialManager.migrateFromWorkspaceConfig();

      // Check for stored credentials in SecretStorage
      const storedCredentials = await this._credentialManager.getCredentials();

      if (storedCredentials) {
        console.log(`[Tivra DebugMind] Found stored credentials (type: ${storedCredentials.type})`);

        // Auto-connect using stored credentials
        if (storedCredentials.type === 'manual') {
          this.addMessage({
            type: 'system',
            content: `🔄 Auto-connecting to AWS using saved credentials...`,
            timestamp: new Date()
          });

          await this.connectToAWS(
            storedCredentials.accessKeyId,
            storedCredentials.secretAccessKey,
            storedCredentials.region
          );
          return;
        } else if (storedCredentials.type === 'sso') {
          // TODO: Handle SSO auto-connect when SSO flow is implemented
          console.log('[Tivra DebugMind] SSO credentials found, but SSO auto-connect not yet implemented');
        }
      }

      // If no stored credentials, check server AWS connection status
      const statusResponse = await axios.get(`${this._apiUrl}/api/aws/status`);
      const isConnected = statusResponse.data?.connected || false;

      if (isConnected) {
        const region = statusResponse.data?.account?.region || 'unknown';

        this.addMessage({
          type: 'ai',
          content: `**AWS Connected** ✅\n\nRegion: ${region}\n\nFetching AWS services...`,
          timestamp: new Date()
        });

        // Fetch and display services
        await this.fetchAWSServices(region);
      } else {
        this.addMessage({
          type: 'ai',
          content: `**Connect to AWS** 🔗\n\nI'll help you connect using your AWS Access Keys.`,
          timestamp: new Date(),
          suggestedPrompts: [
            'Use Access Keys'
            // 'Use SSO' // TODO: SSO flow - fix later
          ]
        });
      }
    } catch (error) {
      // If status check fails, show generic welcome
      this.addMessage({
        type: 'ai',
        content: `**Connect to AWS** 🔗\n\nI'll help you connect using your AWS Access Keys.`,
        timestamp: new Date(),
        suggestedPrompts: [
          'Use Access Keys'
          // 'Use SSO' // TODO: SSO flow - fix later
        ]
      });
    }
  }

  public static createOrShow(extensionUri: vscode.Uri, apiUrl: string, credentialManager: CredentialManager, analytics?: AnalyticsTracker) {
    const column = vscode.ViewColumn.Two;

    if (DebugCopilot.currentPanel) {
      DebugCopilot.currentPanel._panel.reveal(column);
      analytics?.trackFeatureUsage('copilot', 'reveal_existing');
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

    DebugCopilot.currentPanel = new DebugCopilot(panel, extensionUri, apiUrl, credentialManager, analytics);
    analytics?.trackFeatureUsage('copilot', 'create_new');
    return DebugCopilot.currentPanel;
  }

  /**
   * Handle AWS credential input
   */
  private async handleAWSCredentialInput(input: string) {
    if (!this._awsConnectionState) return false;

    switch (this._awsConnectionState.step) {
      case 'ACCESS_KEY':
        this._awsConnectionState.accessKeyId = input.trim();
        console.log('[DEBUG] Access Key ID stored, length:', this._awsConnectionState.accessKeyId.length);
        this._awsConnectionState.step = 'SECRET_KEY';
        this.addMessage({
          type: 'ai',
          content: `✅ Access Key ID saved!\n\n**Step 2 of 3: AWS Secret Access Key**\n\nPlease enter your AWS Secret Access Key.\n\n🔒 Don't worry, this will be securely stored and not displayed.\n\n*Type your Secret Access Key below:*`,
          timestamp: new Date()
        });
        return true;

      case 'SECRET_KEY':
        this._awsConnectionState.secretAccessKey = input.trim();
        console.log('[DEBUG] Secret Key stored, length:', this._awsConnectionState.secretAccessKey.length);
        this._awsConnectionState.step = 'REGION';
        this.addMessage({
          type: 'ai',
          content: `✅ Secret Access Key saved!\n\n**Step 3 of 3: AWS Region**\n\nWhich AWS region would you like to connect to?\n\nExamples: \`us-east-1\`, \`us-west-2\`, \`eu-west-1\`\n\n*Type your AWS region below:*`,
          timestamp: new Date(),
          suggestedPrompts: ['us-east-1', 'us-west-2', 'eu-west-1', 'ap-south-1']
        });
        return true;

      case 'REGION':
        this._awsConnectionState.region = input.trim();
        await this.connectToAWS(
          this._awsConnectionState.accessKeyId!,
          this._awsConnectionState.secretAccessKey!,
          this._awsConnectionState.region
        );
        this._awsConnectionState = null;
        return true;

      case 'EC2_LOG_GROUP':
        const serviceName = this._awsConnectionState.serviceName!;
        const logGroupName = input.trim();

        this.addMessage({
          type: 'ai',
          content: `✅ **Log Group Configured**\n\nAnalyzing logs from \`${logGroupName}\` for **${serviceName}**...`,
          timestamp: new Date()
        });

        // Analyze with the provided log group
        await this.analyzeServiceWithLogGroup(serviceName, 'ec2', logGroupName);

        this._awsConnectionState = null;
        return true;
    }

    return false;
  }

  /**
   * Connect to AWS with provided credentials
   */
  private async connectToAWS(accessKeyId: string, secretAccessKey: string, region: string) {
    console.log(`[Tivra DebugMind] Connecting to AWS... Region: ${region}, API: ${this._apiUrl}`);
    console.log('[DEBUG] Access Key ID length:', accessKeyId?.length);
    console.log('[DEBUG] Access Key ID value:', accessKeyId);
    console.log('[DEBUG] Secret Key length:', secretAccessKey?.length);
    console.log('[DEBUG] Region:', region);

    this.addMessage({
      type: 'system',
      content: `🔄 Connecting to AWS...`,
      timestamp: new Date()
    });

    try {
      // Initialize E2E encryption if enabled
      if (this._encryptionEnabled && this._encryption) {
        console.log('[E2E] Establishing secure session...');
        const sessionEstablished = await this._encryption.initiateSession();

        if (!sessionEstablished) {
          console.warn('[E2E] Failed to establish secure session, falling back to unencrypted');
          this._encryptionEnabled = false;
        } else {
          console.log('✅ [E2E] Secure session established');
          this.addMessage({
            type: 'system',
            content: `🔐 Secure connection established (E2E encrypted)`,
            timestamp: new Date()
          });
        }
      }

      let response;

      // Send encrypted request if encryption is enabled
      if (this._encryptionEnabled && this._encryption && this._encryption.isSessionActive()) {
        console.log('[E2E] Sending encrypted AWS credentials...');
        response = await this._encryption.sendEncryptedRequest('/api/aws/connect', {
          accessKeyId,
          secretAccessKey,
          region
        }, 'POST');
      } else {
        // Fallback to unencrypted
        console.log('[E2E] Sending unencrypted request (encryption disabled)');
        response = await axios.post(`${this._apiUrl}/api/aws/connect`, {
          accessKeyId,
          secretAccessKey,
          region
        });
        response = response.data;
      }

      console.log('[Tivra DebugMind] AWS connection response:', response);

      if (response.success) {
        // Store credentials securely in VS Code SecretStorage
        await this._credentialManager.storeManualCredentials({
          accessKeyId,
          secretAccessKey,
          region
        });
        console.log('[Tivra DebugMind] Credentials stored securely in SecretStorage');

        // Track successful AWS connection
        this._analytics?.trackFunnelStep('aws_connected', {
          region,
          encrypted: this._encryptionEnabled
        });
        this._analytics?.trackFeatureUsage('aws', 'connect_success', { region });

        this.addMessage({
          type: 'ai',
          content: `**AWS Connected** ✅\n\nRegion: ${region}\n${this._encryptionEnabled ? '🔐 Using E2E encryption\n' : ''}🔒 Credentials stored securely\n\nFetching AWS services...`,
          timestamp: new Date()
        });

        // Fetch AWS services
        await this.fetchAWSServices(region);
      } else {
        throw new Error(response.error || 'Connection failed');
      }
    } catch (error: any) {
      console.error('[Tivra DebugMind] AWS connection error:', error);

      // Track AWS connection failure
      this._analytics?.trackError('aws_connection_failed', error.message);
      this._analytics?.trackFeatureUsage('aws', 'connect_failed', {
        error: error.message
      });

      this.addMessage({
        type: 'ai',
        content: `❌ **Failed to connect to AWS**\n\nError: ${error.response?.data?.error || error.message}\n\nPlease check your credentials and try again.\n\nWould you like to:\n• Try connecting again\n• Get help with AWS credentials`,
        timestamp: new Date(),
        suggestedPrompts: [
          'Connect me to AWS',
          'How do I get AWS credentials?'
        ]
      });
    }
  }

  /**
   * Disconnect from AWS and clear all credentials
   */
  private async disconnectFromAWS() {
    console.log('[Tivra DebugMind] Disconnecting from AWS...');

    this.addMessage({
      type: 'system',
      content: `🔄 Disconnecting from AWS...`,
      timestamp: new Date()
    });

    try {
      // Clear credentials from VS Code SecretStorage
      await this._credentialManager.clearCredentials();
      console.log('[Tivra DebugMind] Credentials cleared from SecretStorage');

      // Call server disconnect endpoint
      await axios.post(`${this._apiUrl}/api/aws/disconnect`);
      console.log('[Tivra DebugMind] Server disconnected');

      // Clear local state
      this._awsServices = [];
      this._awsConnectionState = null;

      this.addMessage({
        type: 'ai',
        content: `✅ **Disconnected from AWS**\n\nAll credentials have been cleared securely.\n\n**Connect to AWS** 🔗\n\nI'll help you connect using your AWS Access Keys.`,
        timestamp: new Date(),
        suggestedPrompts: [
          'Use Access Keys'
          // 'Use SSO' // TODO: SSO flow - fix later
        ]
      });
    } catch (error: any) {
      console.error('[Tivra DebugMind] Disconnect error:', error);
      this.addMessage({
        type: 'ai',
        content: `⚠️ **Disconnect Warning**\n\nThere was an issue disconnecting: ${error.message}\n\nCredentials have been cleared locally. You can try connecting again.`,
        timestamp: new Date(),
        suggestedPrompts: [
          'Use Access Keys'
          // 'Use SSO' // TODO: SSO flow - fix later
        ]
      });
    }
  }

  /**
   * Start manual AWS keys flow
   */
  private startManualKeysFlow() {
    this.addMessage({
      type: 'ai',
      content: `**AWS Access Keys Authentication** 🔑\n\n**How to get your AWS credentials:**\n\n1. Go to [AWS IAM Console](https://console.aws.amazon.com/iam/)\n2. Click "Users" → Select your user\n3. Go to "Security credentials" tab\n4. Click "Create access key"\n5. Copy the Access Key ID and Secret Access Key\n\n**Step 1 of 3: AWS Access Key ID**\n\n*Type your Access Key ID below:*`,
      timestamp: new Date()
    });

    // Set state to wait for access key
    this._awsConnectionState = { step: 'ACCESS_KEY' };
  }

  /**
   * Start AWS SSO authentication flow
   */
  private async startSSOFlow() {
    console.log('[SSO] Starting SSO authentication flow...');

    // Show help message first
    this.addMessage({
      type: 'ai',
      content: `**AWS SSO Authentication** 🔐\n\n**How to find your SSO Start URL:**\n\n1. Go to your organization's AWS SSO portal\n2. The URL looks like: \`https://my-company.awsapps.com/start\`\n3. Or ask your AWS administrator for the SSO portal URL\n\n**Benefits of SSO:**\n• No long-term credentials to manage\n• Automatic token refresh\n• Enterprise-grade security\n• Multi-account support\n\nI'll now ask you for your SSO Start URL...`,
      timestamp: new Date()
    });

    try {
      // Prompt user for SSO Start URL
      console.log('[SSO] Showing input box for SSO Start URL...');
      const ssoStartUrl = await vscode.window.showInputBox({
        prompt: 'Enter your AWS SSO Start URL',
        placeHolder: 'https://my-company.awsapps.com/start',
        ignoreFocusOut: true,
        validateInput: (value) => {
          if (!value) return 'SSO Start URL is required';
          if (!value.startsWith('https://')) return 'URL must start with https://';
          if (!value.includes('awsapps.com')) return 'Must be a valid AWS SSO portal URL';
          return null;
        }
      });

      console.log('[SSO] Input box returned, value:', ssoStartUrl ? 'provided' : 'null/cancelled');

      if (!ssoStartUrl) {
        console.log('[SSO] User cancelled SSO URL input');
        this._awsConnectionState = null;
        this.addMessage({
          type: 'ai',
          content: `AWS SSO authentication cancelled.\n\nWould you like to try again?`,
          timestamp: new Date(),
          suggestedPrompts: ['Use Access Keys'] // 'Use SSO' - TODO: fix later
        });
        return;
      }

      console.log('[SSO] SSO URL provided:', ssoStartUrl);

      // Prompt for region
      const ssoRegion = await vscode.window.showQuickPick(
        ['us-east-1', 'us-west-2', 'eu-west-1', 'ap-south-1', 'eu-central-1'],
        {
          placeHolder: 'Select your AWS SSO Region',
          ignoreFocusOut: true
        }
      );

      if (!ssoRegion) {
        console.log('[SSO] User cancelled region selection');
        this._awsConnectionState = null;
        this.addMessage({
          type: 'ai',
          content: `AWS SSO authentication cancelled.\n\nWould you like to try again?`,
          timestamp: new Date(),
          suggestedPrompts: ['Use Access Keys'] // 'Use SSO' - TODO: fix later
        });
        return;
      }

      console.log('[SSO] Region selected:', ssoRegion);
      console.log('[SSO] API URL:', this._apiUrl);

      this.addMessage({
        type: 'system',
        content: `🔐 Initiating AWS SSO authentication...\n\nSSO Portal: ${ssoStartUrl}\nRegion: ${ssoRegion}`,
        timestamp: new Date()
      });

      // Step 1: Initialize SSO OAuth flow
      console.log('[SSO] Calling POST', `${this._apiUrl}/api/aws/oauth/init`);
      const initResponse = await axios.post(`${this._apiUrl}/api/aws/oauth/init`, {
        ssoStartUrl,
        ssoRegion
      });

      console.log('[SSO] Init response status:', initResponse.status);
      console.log('[SSO] Init response data:', JSON.stringify(initResponse.data, null, 2));

      if (!initResponse.data.ok) {
        console.error('[SSO] Init failed:', initResponse.data.error);
        throw new Error(initResponse.data.error || 'Failed to initialize SSO');
      }

      const { sessionId, userCode, verificationUriComplete, verificationUri, interval, expiresIn } = initResponse.data;

      // Show device code to user and open browser
      const verifyUrl = verificationUriComplete || verificationUri;

      this.addMessage({
        type: 'ai',
        content: `**📱 Device Authorization Required**\n\n1. I'll open your browser to: ${verifyUrl}\n\n2. Enter this code: **${userCode}**\n\n3. Approve the request in your browser\n\n4. I'll automatically detect when you're authenticated\n\n*Opening browser now...*`,
        timestamp: new Date()
      });

      // Open browser for user to authenticate
      await vscode.env.openExternal(vscode.Uri.parse(verifyUrl));

      // Start polling for authorization
      await this.pollForSSOAuthorization(sessionId, interval || 5, expiresIn);

    } catch (error: any) {
      console.error('[Tivra DebugMind] SSO flow error:', error);
      this._awsConnectionState = null;
      this.addMessage({
        type: 'ai',
        content: `❌ **SSO Authentication Failed**\n\nError: ${error.response?.data?.error || error.message}\n\nWould you like to try again?`,
        timestamp: new Date(),
        suggestedPrompts: ['Use AWS SSO', 'Use Manual Keys']
      });
    }
  }

  /**
   * Poll for SSO authorization completion
   */
  private async pollForSSOAuthorization(sessionId: string, interval: number, expiresIn: number) {
    const maxAttempts = Math.floor(expiresIn / interval);
    let attempts = 0;

    const pollInterval = setInterval(async () => {
      attempts++;

      try {
        const pollResponse = await axios.post(`${this._apiUrl}/api/aws/oauth/poll`, {
          sessionId
        });

        if (pollResponse.data.authorized) {
          clearInterval(pollInterval);

          const { accounts, accessToken, expiresIn } = pollResponse.data;

          this.addMessage({
            type: 'ai',
            content: `✅ **AWS SSO Authentication Successful!**\n\nFound ${accounts.length} AWS account(s):\n${accounts.map((acc: any) => `• ${acc.accountName} (${acc.accountId})`).join('\n')}\n\nSelect an account to continue:`,
            timestamp: new Date()
          });

          // Let user select account
          await this.selectSSOAccount(sessionId, accounts, accessToken, expiresIn);
        } else if (pollResponse.data.expired) {
          clearInterval(pollInterval);
          this._awsConnectionState = null;
          this.addMessage({
            type: 'ai',
            content: `⏰ **Authorization Expired**\n\nThe device code has expired. Please try again.`,
            timestamp: new Date(),
            suggestedPrompts: ['Use Access Keys'] // 'Use SSO' - TODO: fix later
          });
        }

      } catch (error: any) {
        if (attempts >= maxAttempts) {
          clearInterval(pollInterval);
          this._awsConnectionState = null;
          this.addMessage({
            type: 'ai',
            content: `⏰ **Authorization Timeout**\n\nDidn't receive authorization in time. Please try again.`,
            timestamp: new Date(),
            suggestedPrompts: ['Use Access Keys'] // 'Use SSO' - TODO: fix later
          });
        }
      }
    }, interval * 1000);
  }

  /**
   * Let user select AWS account and role for SSO
   */
  private async selectSSOAccount(sessionId: string, accounts: any[], accessToken: string, expiresIn: number) {
    try {
      // Show account picker
      const selectedAccount = await vscode.window.showQuickPick(
        accounts.map((acc: any) => ({
          label: acc.accountName || acc.accountId,
          description: acc.accountId,
          detail: acc.emailAddress,
          account: acc
        })),
        {
          placeHolder: 'Select AWS Account',
          ignoreFocusOut: true
        }
      );

      if (!selectedAccount) {
        this._awsConnectionState = null;
        this.addMessage({
          type: 'ai',
          content: `Account selection cancelled.`,
          timestamp: new Date(),
          suggestedPrompts: ['Use Access Keys'] // 'Use SSO' - TODO: fix later
        });
        return;
      }

      this.addMessage({
        type: 'system',
        content: `🔄 Getting credentials for ${selectedAccount.label}...`,
        timestamp: new Date()
      });

      // Get role credentials
      const credsResponse = await axios.post(`${this._apiUrl}/api/aws/oauth/credentials`, {
        sessionId,
        accountId: selectedAccount.account.accountId
      });

      if (!credsResponse.data.ok) {
        throw new Error(credsResponse.data.error || 'Failed to get credentials');
      }

      const { credentials, account } = credsResponse.data;

      // Store SSO credentials in SecretStorage
      const expiresAt = Date.now() + (expiresIn * 1000);
      await this._credentialManager.storeSSOCredentials({
        accessToken,
        accountId: account.id,
        roleName: account.roleName,
        region: 'us-east-1', // TODO: get from user or SSO config
        expiresAt
      });

      console.log('[Tivra DebugMind] SSO credentials stored securely');

      this._awsConnectionState = null;

      this.addMessage({
        type: 'ai',
        content: `**AWS SSO Connected** ✅\n\nAccount: ${account.name}\nRole: ${account.roleName}\n🔒 SSO credentials stored securely\n\nFetching AWS services...`,
        timestamp: new Date()
      });

      // Fetch AWS services
      await this.fetchAWSServices('us-east-1'); // TODO: use actual region

    } catch (error: any) {
      console.error('[Tivra DebugMind] Account selection error:', error);
      this._awsConnectionState = null;
      this.addMessage({
        type: 'ai',
        content: `❌ **Failed to get credentials**\n\nError: ${error.response?.data?.error || error.message}`,
        timestamp: new Date(),
        suggestedPrompts: ['Use AWS SSO', 'Use Manual Keys']
      });
    }
  }

  /**
   * Fetch AWS services after connection
   */
  private async fetchAWSServices(region: string) {
    console.log(`[Tivra DebugMind] Fetching AWS services for region: ${region}`);

    try {
      const response = await axios.get(`${this._apiUrl}/api/aws/services/discover`);
      console.log('[Tivra DebugMind] Services response:', response.data);

      this._awsServices = response.data.services || [];
      console.log(`[Tivra DebugMind] Found ${this._awsServices.length} services`);

      if (this._awsServices.length > 0) {
        // Build services list message
        const servicesList = this._awsServices.map((service: any) =>
          `• **${service.name}** (${service.type})`
        ).join('\n');

        this.addMessage({
          type: 'ai',
          content: `**AWS Services Found** ✅\n\n${servicesList}\n\nAnalyzing services for errors...`,
          timestamp: new Date()
        });

        // Automatically analyze services after discovery
        await this.analyzeAllServices();
      } else {
        // No services found
        this.addMessage({
          type: 'ai',
          content: `**No AWS Services Running** ℹ️\n\nNo Lambda functions or other services were found in region ${region}.\n\nPlease ensure you have:\n• Lambda functions deployed\n• Proper IAM permissions\n• Services in the selected region\n\nWould you like to try a different region?`,
          timestamp: new Date(),
          suggestedPrompts: [
            'Connect to a different region',
            'Help me deploy a Lambda function'
          ]
        });
      }
    } catch (error: any) {
      console.error('[Tivra DebugMind] Error fetching services:', error);
      this.addMessage({
        type: 'ai',
        content: `⚠️ **Could not fetch services**\n\nError: ${error.response?.data?.error || error.message}\n\nProceeding with manual service selection...`,
        timestamp: new Date()
      });
    }
  }

  /**
   * Analyze a service with a specific log group
   */
  private async analyzeServiceWithLogGroup(serviceName: string, serviceType: string, logGroupName: string) {
    console.log(`[Tivra DebugMind] Analyzing service with provided log group:`);
    console.log(`  Service: ${serviceName}`);
    console.log(`  Type: ${serviceType}`);
    console.log(`  Log Group: ${logGroupName}`);
    console.log(`  API URL: ${this._apiUrl}/api/aws/logs`);

    try {
      console.log('[Tivra DebugMind] Sending API request...');
      const response = await axios.get(`${this._apiUrl}/api/aws/logs`, {
        params: {
          serviceName: serviceName,
          serviceType: serviceType,
          logGroupName: logGroupName
        }
      });

      console.log('[Tivra DebugMind] API Response received:');
      console.log(`  Status: ${response.status}`);
      console.log(`  Error Count: ${response.data.errorCount}`);
      console.log(`  Top Errors: ${response.data.topErrors?.length || 0}`);
      console.log(`  Message: ${response.data.message || 'N/A'}`);

      if (response.data.errorCount > 0) {
        // Store service context with log group for later use
        this._conversationContext.service = {
          name: serviceName,
          type: serviceType,
          logGroupName: logGroupName
        };
        this._conversationContext.recentErrors = response.data.topErrors;

        // Store complete CloudWatch analysis for SRE agent
        this._errorAnalysisData = {
          logs: response.data,
          timestamp: new Date().toISOString()
        };

        // Track service selection and analysis start
        this._analytics?.trackFunnelStep('first_service_selected', {
          serviceName,
          serviceType,
          errorCount: response.data.errorCount
        });
        this._analytics?.trackFeatureUsage('service', 'analyze_start', {
          serviceType,
          errorCount: response.data.errorCount
        });

        // Show errors found
        let errorMessage = `**⚠️ Errors Found in ${serviceName}**\n\n`;
        errorMessage += `Found ${response.data.errorCount} error(s) in the last hour.\n\n`;

        // Show top errors
        if (response.data.topErrors && response.data.topErrors.length > 0) {
          errorMessage += `**Top Errors:**\n\n`;
          response.data.topErrors.slice(0, 3).forEach((err: any, i: number) => {
            errorMessage += `${i + 1}. **${err.message}** (${err.count} occurrences)\n`;
          });
        }

        errorMessage += `\n**Generating Root Cause Analysis...**`;

        this.addMessage({
          type: 'ai',
          content: errorMessage,
          timestamp: new Date()
        });

        // Call Claude for RCA
        const rcaResponse = await axios.post(`${this._apiUrl}/api/chat`, {
          message: `Analyze these errors and provide root cause analysis with fixes:\n\nService: ${serviceName}\nType: ${serviceType}\nLog Group: ${logGroupName}\nErrors: ${JSON.stringify(response.data.topErrors.slice(0, 3), null, 2)}`,
          context: {
            service: {
              name: serviceName,
              type: serviceType,
              logGroupName: logGroupName
            },
            recentErrors: response.data.topErrors,
            connectedServices: this._awsServices.map(s => s.name),
            conversationHistory: []
          }
        });

        const { response: rcaText, suggestedFix } = rcaResponse.data;

        // Track successful analysis completion
        this._analytics?.trackFunnelStep('first_analysis_completed', {
          serviceName,
          serviceType,
          hasFix: !!suggestedFix
        });
        this._analytics?.trackFeatureUsage('service', 'analyze_complete', {
          serviceType,
          hasFix: !!suggestedFix
        });

        this.addMessage({
          type: 'ai',
          content: `## 🔍 Root Cause Analysis\n\n${rcaText}`,
          timestamp: new Date(),
          suggestedFix: suggestedFix,
          suggestedPrompts: [
            'Trigger Investigation',
            'Create a PR with the fix',
            'Analyze other services'
          ]
        });
      } else {
        this.addMessage({
          type: 'ai',
          content: `✅ **No Errors Found**\n\nNo errors detected in **${serviceName}** logs from \`${logGroupName}\` in the last hour.`,
          timestamp: new Date()
        });
      }
    } catch (error: any) {
      console.error('[Tivra DebugMind] Error analyzing service with log group:', error);
      console.error(`  Service: ${serviceName}`);
      console.error(`  Log Group: ${logGroupName}`);
      console.error(`  Error Message: ${error.message}`);
      console.error(`  Response Status: ${error.response?.status}`);
      console.error(`  Response Data:`, error.response?.data);

      this.addMessage({
        type: 'ai',
        content: `❌ **Analysis Failed**\n\nCould not analyze logs: ${error.response?.data?.message || error.message}\n\nPlease verify:\n• Log group name is correct\n• You have CloudWatch Logs permissions\n• The log group exists in your AWS account`,
        timestamp: new Date()
      });
    }
  }

  /**
   * Trigger SRE Agent Investigation
   * Sends comprehensive context to the SRE agent for deep investigation
   */
  private async triggerSREInvestigation() {
    console.log('[Tivra DebugMind] Triggering SRE Agent investigation');

    // Verify we have service context
    if (!this._conversationContext.service) {
      this.addMessage({
        type: 'ai',
        content: `⚠️ **No Service Context**\n\nPlease analyze a service first before triggering an investigation.`,
        timestamp: new Date()
      });
      return;
    }

    const service = this._conversationContext.service;

    this.addMessage({
      type: 'ai',
      content: `🔍 **Starting Deep Investigation**\n\nTriggering SRE Agent to investigate **${service.name}**...\n\nThe agent will:\n• Analyze CloudWatch logs in detail\n• Review recent code changes from GitHub\n• Correlate deployment timing\n• Form and test hypotheses\n• Provide structured root cause analysis\n\nThis may take 15-30 seconds...`,
      timestamp: new Date(),
      isTyping: true
    });

    try {
      // Get GitHub repo info from workspace
      const githubRepo = await this.getGitHubRepoFromWorkspace();
      const branch = await this.getCurrentBranch();

      // Prepare investigation request with comprehensive context
      const investigationRequest = {
        service: {
          name: service.name,
          type: service.type,
          logGroupName: service.logGroupName,
          region: 'us-east-1'
        },
        errors: this._conversationContext.recentErrors.map((error: any) => ({
          message: error.message || error.type || 'Unknown error',
          count: error.count || 1,
          timestamp: error.lastSeen || new Date().toISOString(),
          stackTrace: error.stackTrace || null,
          samples: error.samples || []
        })),
        // Include pre-fetched CloudWatch data to avoid redundant API calls
        cloudwatchData: this._errorAnalysisData ? {
          logs: this._errorAnalysisData.logs,
          fetchedAt: this._errorAnalysisData.timestamp
        } : null,
        context: {
          githubRepo: githubRepo,
          branch: branch || 'main',
          workspace: vscode.workspace.workspaceFolders?.[0]?.uri.fsPath,
          awsServices: this._awsServices.map(s => s.name),
          conversationHistory: this._conversationContext.conversationHistory.slice(-5) // Last 5 messages for context
        }
      };

      console.log('[Tivra DebugMind] Investigation request:', JSON.stringify(investigationRequest, null, 2));

      // Call SRE Agent via backend
      const response = await axios.post(
        `${this._apiUrl}/api/sre-agent/investigate`,
        investigationRequest,
        {
          timeout: 60000 // 60 second timeout
        }
      );

      console.log('[Tivra DebugMind] Investigation completed:', response.data.investigation_id);

      // Format the investigation results
      const investigation = response.data;

      let resultMessage = `## 🎯 Investigation Complete\n\n`;
      resultMessage += `**Investigation ID:** \`${investigation.investigation_id}\`\n`;
      resultMessage += `**Confidence:** ${(investigation.confidence * 100).toFixed(0)}%\n\n`;

      // Root Cause
      if (investigation.root_cause) {
        const rc = investigation.root_cause;
        resultMessage += `### 🔴 Root Cause Identified\n\n`;
        resultMessage += `**Category:** ${rc.category.replace('_', ' ').toUpperCase()}\n`;
        resultMessage += `**Impact:** ${rc.impact.toUpperCase()}\n`;
        resultMessage += `**Confidence:** ${(rc.confidence * 100).toFixed(0)}%\n\n`;
        resultMessage += `**Description:**\n${rc.description}\n\n`;
      }

      // Evidence Summary
      if (investigation.evidence && investigation.evidence.length > 0) {
        resultMessage += `### 📊 Evidence Gathered\n\n`;
        investigation.evidence.forEach((ev: any, idx: number) => {
          resultMessage += `${idx + 1}. **${ev.type.toUpperCase()}** - ${ev.description} (Confidence: ${(ev.confidence * 100).toFixed(0)}%)\n`;
        });
        resultMessage += '\n';
      }

      // Suggested Fixes
      if (investigation.suggested_fixes && investigation.suggested_fixes.length > 0) {
        resultMessage += `### 💡 Suggested Fixes\n\n`;
        investigation.suggested_fixes.forEach((fix: any, idx: number) => {
          resultMessage += `**${idx + 1}. ${fix.type.replace('_', ' ').toUpperCase()}** (Risk: ${fix.risk_level}, Confidence: ${(fix.confidence * 100).toFixed(0)}%)\n`;
          resultMessage += `${fix.description}\n`;
          if (fix.estimated_time) {
            resultMessage += `*Estimated time: ${fix.estimated_time}*\n`;
          }
          resultMessage += '\n';
        });
      }

      // Reasoning Steps (collapsed)
      if (investigation.reasoning_steps && investigation.reasoning_steps.length > 0) {
        resultMessage += `<details>\n<summary>Investigation Steps (${investigation.reasoning_steps.length})</summary>\n\n`;
        investigation.reasoning_steps.forEach((step: string, idx: number) => {
          resultMessage += `${idx + 1}. ${step}\n`;
        });
        resultMessage += `</details>\n\n`;
      }

      // Update the message
      this.updateLastMessage({
        type: 'ai',
        content: resultMessage,
        timestamp: new Date(),
        suggestedPrompts: [
          investigation.suggested_fixes && investigation.suggested_fixes.length > 0 ? 'Create a PR with the fix' : 'Analyze other services',
          'Run another investigation',
          'Analyze other services'
        ]
      });

      // Store investigation results in context
      this._errorAnalysisData = investigation;

    } catch (error: any) {
      console.error('[Tivra DebugMind] Investigation failed:', error);

      let errorMessage = `❌ **Investigation Failed**\n\n`;

      if (error.code === 'ECONNREFUSED') {
        errorMessage += `Could not connect to SRE Agent service.\n\n`;
        errorMessage += `**Please ensure:**\n`;
        errorMessage += `• SRE Agent service is running on port 5001\n`;
        errorMessage += `• Run: \`cd tivra-copilot/sre-agent && python app.py\`\n`;
      } else if (error.response?.status === 503) {
        errorMessage += `SRE Agent service is unavailable.\n\n`;
        errorMessage += `${error.response?.data?.message || 'Service not responding'}\n`;
      } else {
        errorMessage += `${error.response?.data?.message || error.message}\n`;
      }

      this.updateLastMessage({
        type: 'ai',
        content: errorMessage,
        timestamp: new Date(),
        suggestedPrompts: [
          'Try again',
          'Analyze other services'
        ]
      });
    }
  }

  /**
   * Prompt user to provide log group name for a service
   */
  private async promptForLogGroup(serviceName: string) {
    this.addMessage({
      type: 'ai',
      content: `**Provide Log Group for ${serviceName}**\n\nPlease enter the CloudWatch Logs group name for this EC2 instance.\n\nExample log group names:\n• \`/aws/ec2/instance/${serviceName}\`\n• \`/var/log/application\`\n• Custom log group you configured\n\nYou can find log groups in the AWS Console under CloudWatch > Log groups.`,
      timestamp: new Date()
    });

    // Set state to wait for log group input
    this._awsConnectionState = {
      step: 'EC2_LOG_GROUP' as any,
      serviceName: serviceName
    } as any;
  }

  /**
   * Show CloudWatch agent setup instructions
   */
  private async showCloudWatchAgentInstructions() {
    const instructions = `**📖 How to Setup CloudWatch Agent for EC2**\n\n` +
      `To enable CloudWatch Logs for EC2 instances, you need to install and configure the CloudWatch agent:\n\n` +
      `**Step 1: Install CloudWatch Agent**\n` +
      `\`\`\`bash\n` +
      `# Download the agent (Amazon Linux 2)\n` +
      `wget https://s3.amazonaws.com/amazoncloudwatch-agent/amazon_linux/amd64/latest/amazon-cloudwatch-agent.rpm\n` +
      `sudo rpm -U ./amazon-cloudwatch-agent.rpm\n` +
      `\`\`\`\n\n` +
      `**Step 2: Create Configuration File**\n` +
      `Create \`/opt/aws/amazon-cloudwatch-agent/etc/config.json\`:\n` +
      `\`\`\`json\n` +
      `{\n` +
      `  "logs": {\n` +
      `    "logs_collected": {\n` +
      `      "files": {\n` +
      `        "collect_list": [\n` +
      `          {\n` +
      `            "file_path": "/var/log/application.log",\n` +
      `            "log_group_name": "/aws/ec2/your-instance-name",\n` +
      `            "log_stream_name": "{instance_id}"\n` +
      `          }\n` +
      `        ]\n` +
      `      }\n` +
      `    }\n` +
      `  }\n` +
      `}\n` +
      `\`\`\`\n\n` +
      `**Step 3: Start the Agent**\n` +
      `\`\`\`bash\n` +
      `sudo /opt/aws/amazon-cloudwatch-agent/bin/amazon-cloudwatch-agent-ctl \\\n` +
      `  -a fetch-config \\\n` +
      `  -m ec2 \\\n` +
      `  -s \\\n` +
      `  -c file:/opt/aws/amazon-cloudwatch-agent/etc/config.json\n` +
      `\`\`\`\n\n` +
      `**Step 4: Verify Logs in AWS Console**\n` +
      `• Go to CloudWatch Console\n` +
      `• Navigate to Log groups\n` +
      `• Look for your log group: \`/aws/ec2/your-instance-name\`\n\n` +
      `**IAM Permissions Required:**\n` +
      `Your EC2 instance needs an IAM role with these permissions:\n` +
      `• \`logs:CreateLogGroup\`\n` +
      `• \`logs:CreateLogStream\`\n` +
      `• \`logs:PutLogEvents\`\n\n` +
      `📚 **Full Documentation:** https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/Install-CloudWatch-Agent.html`;

    this.addMessage({
      type: 'ai',
      content: instructions,
      timestamp: new Date(),
      suggestedPrompts: [
        'I\'ve installed the agent, analyze again',
        'Skip EC2 log analysis',
        'Provide log group manually'
      ]
    });
  }



  /**
   * Analyze all services for errors
   */
  private async analyzeAllServices() {
    this.addMessage({
      type: 'system',
      content: '🔍 Analyzing all AWS services for errors...',
      timestamp: new Date()
    });

    try {
      // If no services discovered yet, fetch them first
      if (this._awsServices.length === 0) {
        const statusResponse = await axios.get(`${this._apiUrl}/api/aws/status`);
        const region = statusResponse.data?.account?.region || 'us-east-1';
        await this.fetchAWSServices(region);

        if (this._awsServices.length === 0) {
          this.addMessage({
            type: 'ai',
            content: `**No Services Found** ℹ️\n\nI couldn't find any AWS services in your account.\n\nPlease ensure you have services deployed and proper IAM permissions.`,
            timestamp: new Date()
          });
          return;
        }
      }

      let totalErrors = 0;
      let errorsByService: any[] = [];

      // Analyze each service for errors
      const servicesNeedingLogGroup: any[] = [];

      for (const service of this._awsServices) {
        try {
          const response = await axios.get(`${this._apiUrl}/api/aws/logs`, {
            params: {
              serviceName: service.name,
              serviceType: service.type
            }
          });

          if (response.data.errorCount > 0) {
            totalErrors += response.data.errorCount;
            errorsByService.push({
              service: service.name,
              type: service.type,
              errors: response.data.topErrors || [],
              count: response.data.errorCount
            });
          } else if (response.data.needsLogGroup) {
            // Service needs manual log group configuration
            servicesNeedingLogGroup.push({
              service: service.name,
              type: service.type,
              message: response.data.message
            });
          }
        } catch (error) {
          console.error(`Error analyzing ${service.name}:`, error);
        }
      }

      // Show info about services that need log group configuration
      if (servicesNeedingLogGroup.length > 0) {
        let configMessage = `**ℹ️ Configuration Needed**\n\n`;
        configMessage += `The following services could not be analyzed automatically:\n\n`;

        servicesNeedingLogGroup.forEach(svc => {
          configMessage += `**${svc.service}** (${svc.type})\n`;
          configMessage += `${svc.message}\n\n`;
        });

        configMessage += `**What would you like to do?**`;

        this.addMessage({
          type: 'ai',
          content: configMessage,
          timestamp: new Date(),
          suggestedPrompts: servicesNeedingLogGroup.map(svc =>
            `Provide log group for ${svc.service}`
          ).concat([
            'Skip EC2 log analysis',
            'How to setup CloudWatch agent for EC2'
          ])
        });

        // Store services needing configuration for later reference
        this._servicesNeedingLogGroup = servicesNeedingLogGroup;
      }

      // Display results
      if (totalErrors === 0 && servicesNeedingLogGroup.length === 0) {
        // No errors and all services analyzed successfully
        this.addMessage({
          type: 'ai',
          content: `**No Errors Found!** ✅\n\nAll your services are running smoothly with no errors in the last hour.\n\n**Services Analyzed:**\n${this._awsServices.map(s => `• ${s.name} (${s.type})`).join('\n')}\n\nEverything looks perfect! 🎉`,
          timestamp: new Date(),
          suggestedPrompts: [
            'Monitor for new errors',
            'Check service metrics',
            'Show service status'
          ]
        });
      } else if (totalErrors === 0 && servicesNeedingLogGroup.length > 0) {
        // No errors in services that were analyzed, but some need config
        const analyzedServices = this._awsServices.filter(s =>
          !servicesNeedingLogGroup.some(needsConfig => needsConfig.service === s.name)
        );

        if (analyzedServices.length > 0) {
          this.addMessage({
            type: 'ai',
            content: `**No Errors Found!** ✅\n\nThe following services are running smoothly with no errors:\n\n${analyzedServices.map(s => `• ${s.name} (${s.type})`).join('\n')}\n\nNote: Some services need additional configuration to be analyzed.`,
            timestamp: new Date()
          });
        }
      } else {
        // Build error summary
        let errorMessage = `**Errors Found** ⚠️\n\nFound ${totalErrors} error(s) across ${errorsByService.length} service(s) in the last hour.\n\n`;

        errorsByService.forEach(svc => {
          errorMessage += `### ${svc.service} (${svc.type})\n`;
          errorMessage += `**${svc.count} error(s)**\n\n`;

          // Show first 2 errors for each service
          svc.errors.slice(0, 2).forEach((err: any, i: number) => {
            errorMessage += `${i + 1}. ${err.message || 'Unknown error'}\n`;
            if (err.timestamp) {
              errorMessage += `   _${new Date(err.timestamp).toLocaleString()}_\n`;
            }
          });
          errorMessage += '\n';
        });

        errorMessage += `\n**Generating RCA and fix...**`;

        this.addMessage({
          type: 'ai',
          content: errorMessage,
          timestamp: new Date()
        });

        // Call Claude for RCA
        const firstError = errorsByService[0];
        const rcaResponse = await axios.post(`${this._apiUrl}/api/chat`, {
          message: `Analyze these errors and provide root cause analysis with fixes:\n\nService: ${firstError.service}\nType: ${firstError.type}\nErrors: ${JSON.stringify(firstError.errors.slice(0, 3), null, 2)}`,
          context: {
            recentErrors: firstError.errors,
            connectedServices: this._awsServices.map(s => s.name),
            conversationHistory: []
          }
        });

        const { response, suggestedFix } = rcaResponse.data;

        this.addMessage({
          type: 'ai',
          content: `## 🔍 Root Cause Analysis\n\n${response}`,
          timestamp: new Date(),
          suggestedFix: suggestedFix,
          suggestedPrompts: [
            'Create a PR with the fix',
            'Show more error details',
            'Check related services'
          ]
        });

        // Store errors in context
        this._conversationContext.recentErrors = errorsByService.flatMap(s => s.errors);
      }

    } catch (error: any) {
      console.error('Error analyzing services:', error);
      this.addMessage({
        type: 'ai',
        content: `❌ **Analysis Failed**\n\nError: ${error.response?.data?.error || error.message}\n\nPlease try again or check individual services manually.`,
        timestamp: new Date()
      });
    }
  }


  /**
   * Stop monitoring
   */
  private stopMonitoring() {
    if (this._monitoringInterval) {
      clearInterval(this._monitoringInterval);
      this._monitoringInterval = null;
    }
    this._isMonitoring = false;
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

    // Check if we're in AWS credential input flow
    if (this._awsConnectionState) {
      const handled = await this.handleAWSCredentialInput(text);
      if (handled) return;
    }

    const lowerText = text.toLowerCase();

    // Check if user is providing log group for EC2
    if (lowerText.includes('provide log group')) {
      const match = text.match(/provide log group for (\S+)/i);
      if (match && match[1]) {
        const serviceName = match[1];
        await this.promptForLogGroup(serviceName);
        return;
      }
    }

    // Check if user wants to skip EC2 analysis
    if (lowerText.includes('skip') && (lowerText.includes('ec2') || lowerText.includes('log analysis'))) {
      this.addMessage({
        type: 'ai',
        content: `✅ **Skipped EC2 Log Analysis**\n\nEC2 instances will be excluded from log analysis. You can still analyze other services.\n\nIf you change your mind, just ask me to "Analyze EC2 logs" and provide the log group name.`,
        timestamp: new Date()
      });
      this._servicesNeedingLogGroup = []; // Clear the list
      return;
    }

    // Check if user wants CloudWatch agent setup instructions
    if (lowerText.includes('setup cloudwatch') || lowerText.includes('install cloudwatch') ||
        (lowerText.includes('how to') && lowerText.includes('cloudwatch agent'))) {
      await this.showCloudWatchAgentInstructions();
      return;
    }

    // Check if user wants to start real-time monitoring
    if ((lowerText.includes('start') || lowerText.includes('enable')) &&
        (lowerText.includes('real-time') || lowerText.includes('realtime') ||
         lowerText.includes('live') || lowerText.includes('continuous') ||
         lowerText.includes('monitor'))) {
      if (this._awsServices.length > 0) {
        await this.startRealtimeMonitoring(this._awsServices);
        return;
      } else {
        this.addMessage({
          type: 'ai',
          content: `⚠️ **No Services Discovered**\n\nPlease discover your AWS services first by asking me to "analyze my AWS services" or "connect to AWS".`,
          timestamp: new Date()
        });
        return;
      }
    }

    // Check if user wants to stop real-time monitoring
    if ((lowerText.includes('stop') || lowerText.includes('disable')) &&
        (lowerText.includes('monitor') || lowerText.includes('real-time') ||
         lowerText.includes('realtime') || lowerText.includes('live'))) {
      await this.stopRealtimeMonitoring();
      this.addMessage({
        type: 'ai',
        content: `✅ **Real-time monitoring stopped**\n\nYou can restart monitoring anytime by asking me to "start real-time monitoring".`,
        timestamp: new Date()
      });
      return;
    }

    // Check if user wants to disconnect from AWS
    if ((lowerText.includes('disconnect') || lowerText.includes('logout') || lowerText.includes('reset')) &&
        lowerText.includes('aws')) {
      await this.disconnectFromAWS();
      return;
    }

    // Check if user is choosing authentication method
    const usesAccessKeys = lowerText.includes('access key') ||
                          (lowerText.includes('use') && lowerText.includes('key'));
    // TODO: SSO flow - fix later
    // const usesSSO = lowerText.includes('sso') ||
    //                (lowerText.includes('use') && lowerText.includes('sso'));

    if (usesAccessKeys) {
      // Check if already connected
      try {
        const statusResponse = await axios.get(`${this._apiUrl}/api/aws/status`);
        if (statusResponse.data?.connected) {
          this.addMessage({
            type: 'ai',
            content: `✅ You're already connected to AWS!\n\nYour AWS credentials are configured and ready to use.\n\n**What would you like to do?**\n\n• Analyze errors in a service\n• Check CloudWatch logs\n• Debug a specific issue\n\nJust ask me and I'll help!`,
            timestamp: new Date(),
            suggestedPrompts: [
              'Show me recent errors in my services',
              'Analyze Lambda function failures',
              'Help me debug a timeout issue'
            ]
          });
          return;
        }
      } catch (error) {
        // Continue with connection flow
      }

      // Start manual keys flow directly
      this.startManualKeysFlow();
      return;
    }

    // TODO: SSO flow - fix later
    // if (usesSSO) {
    //   // Check if already connected
    //   try {
    //     const statusResponse = await axios.get(`${this._apiUrl}/api/aws/status`);
    //     if (statusResponse.data?.connected) {
    //       this.addMessage({
    //         type: 'ai',
    //         content: `✅ You're already connected to AWS!\n\nYour AWS credentials are configured and ready to use.\n\n**What would you like to do?**\n\n• Analyze errors in a service\n• Check CloudWatch logs\n• Debug a specific issue\n\nJust ask me and I'll help!`,
    //         timestamp: new Date(),
    //         suggestedPrompts: [
    //           'Show me recent errors in my services',
    //           'Analyze Lambda function failures',
    //           'Help me debug a timeout issue'
    //         ]
    //       });
    //       return;
    //     }
    //   } catch (error) {
    //     // Continue with connection flow
    //   }

    //   // Start SSO flow directly
    //   await this.startSSOFlow();
    //   return;
    // }

    // Before processing any other prompt, verify AWS connection
    try {
      const statusResponse = await axios.get(`${this._apiUrl}/api/aws/status`);
      if (!statusResponse.data?.connected) {
        this.addMessage({
          type: 'ai',
          content: `⚠️ **AWS Not Connected**\n\nTo analyze logs and debug AWS services, I need to connect to your AWS account first.\n\n**Connect to AWS** 🔗\n\nChoose your authentication method:`,
          timestamp: new Date(),
          suggestedPrompts: [
            'Use Access Keys',
            // 'Use SSO' // TODO: fix later
            'Use Access Keys'
          ]
        });
        return;
      }
    } catch (error) {
      this.addMessage({
        type: 'ai',
        content: `⚠️ **Unable to verify AWS connection**\n\nI couldn't check your AWS connection status. Please make sure:\n\n1. Backend server is running\n2. You're connected to the internet\n\n**Connect to AWS** 🔗\n\nChoose your authentication method:`,
        timestamp: new Date(),
        suggestedPrompts: [
          'Use Access Keys',
          'Use SSO'
        ]
      });
      return;
    }

    // Check if user clicked "Trigger Investigation" button
    if (lowerText === 'trigger investigation') {
      await this.triggerSREInvestigation();
      return;
    }

    // Check if user is asking to analyze errors
    const analyzeKeywords = ['analyze', 'error', 'show', 'check', 'debug', 'find'];
    const isAnalyzeRequest = analyzeKeywords.some(keyword => lowerText.includes(keyword)) &&
                             (lowerText.includes('error') || lowerText.includes('service') || lowerText.includes('log'));

    if (isAnalyzeRequest) {
      // Automatically fetch logs and analyze
      await this.analyzeAllServices();
      return;
    }

    // Show AI is thinking
    this.addMessage({
      type: 'ai',
      content: '',
      timestamp: new Date(),
      isTyping: true
    });

    try {
      // Send to AI with full context using the correct /api/chat endpoint
      const aiResponse = await axios.post(`${this._apiUrl}/api/chat`, {
        message: text,
        context: {
          ...this._conversationContext,
          service: this._conversationContext.service, // Include full service context with logGroupName
          connectedServices: this._conversationContext.service ? [this._conversationContext.service.name] : [],
          // Include error analysis data if available
          errorAnalysis: this._errorAnalysisData,
          awsServices: this._awsServices
        }
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
            code: fix.newCode,
            description: fix.explanation || 'Code fix applied',
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
    const logoPath = vscode.Uri.joinPath(extensionUri, 'media', 'logo.png');
    const logoUri = webview.asWebviewUri(logoPath);

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
      background: linear-gradient(135deg, #1e90ff 0%, #0066cc 100%);
      color: white;
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .logo {
      width: 32px;
      height: 32px;
      border-radius: 4px;
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
      background: linear-gradient(135deg, #1e90ff 0%, #0066cc 100%);
      color: white;
      align-self: flex-end;
    }

    .message.ai {
      background-color: var(--vscode-editor-selectionBackground);
      align-self: flex-start;
      border-left: 3px solid #1e90ff;
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
      background-color: #1e90ff;
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
      background: linear-gradient(135deg, #1e90ff 0%, #0066cc 100%);
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

    .suggested-prompts {
      margin-top: 12px;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .prompt-button {
      padding: 10px 14px;
      background: rgba(30, 144, 255, 0.1);
      color: var(--vscode-foreground);
      border: 1px solid rgba(30, 144, 255, 0.3);
      border-radius: 8px;
      cursor: pointer;
      font-size: 13px;
      text-align: left;
      transition: all 0.2s;
    }

    .prompt-button:hover {
      background: rgba(30, 144, 255, 0.2);
      border-color: rgba(30, 144, 255, 0.5);
      transform: translateX(4px);
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
      background: linear-gradient(135deg, #1e90ff 0%, #0066cc 100%);
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
    <img src="${logoUri}" alt="Tivra Logo" class="logo" />
    <div>
      <h2>DebugMind</h2>
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

          if (msg.suggestedPrompts && msg.suggestedPrompts.length > 0) {
            html += \`<div class="suggested-prompts">\`;
            msg.suggestedPrompts.forEach(prompt => {
              const escapedPrompt = prompt.replace(/'/g, "&apos;").replace(/"/g, "&quot;");
              html += \`<button class="prompt-button" onclick='sendPrompt("\${escapedPrompt}")'>\${prompt}</button>\`;
            });
            html += \`</div>\`;
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

    function sendPrompt(prompt) {
      messageInput.value = prompt;
      sendMessage();
    }

    sendButton.addEventListener('click', sendMessage);
    messageInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') sendMessage();
    });
  </script>
</body>
</html>`;
  }

  /**
   * Get GitHub repository from workspace
   * Attempts to extract GitHub repo from git remote URL
   */
  private async getGitHubRepoFromWorkspace(): Promise<string | undefined> {
    try {
      const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
      if (!workspaceFolder) {
        return undefined;
      }

      // Try to get git remote URL
      const gitExtension = vscode.extensions.getExtension('vscode.git')?.exports;
      if (!gitExtension) {
        return undefined;
      }

      const api = gitExtension.getAPI(1);
      if (!api.repositories || api.repositories.length === 0) {
        return undefined;
      }

      const repo = api.repositories[0];
      const remotes = repo.state.remotes;

      // Look for origin remote
      const origin = remotes.find((r: any) => r.name === 'origin');
      if (!origin) {
        return undefined;
      }

      // Extract repo from URL (e.g., git@github.com:user/repo.git -> user/repo)
      const url = origin.fetchUrl || origin.pushUrl;
      if (!url) {
        return undefined;
      }

      // Handle different URL formats
      let match;

      // SSH format: git@github.com:user/repo.git
      match = url.match(/git@github\.com:(.+?)\.git$/);
      if (match) {
        return match[1];
      }

      // HTTPS format: https://github.com/user/repo.git
      match = url.match(/https:\/\/github\.com\/(.+?)\.git$/);
      if (match) {
        return match[1];
      }

      // HTTPS without .git: https://github.com/user/repo
      match = url.match(/https:\/\/github\.com\/(.+?)$/);
      if (match) {
        return match[1];
      }

      return undefined;
    } catch (error) {
      console.error('[Tivra DebugMind] Failed to get GitHub repo:', error);
      return undefined;
    }
  }

  /**
   * Get current git branch
   */
  private async getCurrentBranch(): Promise<string | undefined> {
    try {
      const gitExtension = vscode.extensions.getExtension('vscode.git')?.exports;
      if (!gitExtension) {
        return undefined;
      }

      const api = gitExtension.getAPI(1);
      if (!api.repositories || api.repositories.length === 0) {
        return undefined;
      }

      const repo = api.repositories[0];
      return repo.state.HEAD?.name;
    } catch (error) {
      console.error('[Tivra DebugMind] Failed to get current branch:', error);
      return undefined;
    }
  }

  // ========================================
  // Real-time Monitoring Methods
  // ========================================

  /**
   * Start real-time monitoring using polling (every 10 seconds)
   */
  private async startRealtimeMonitoring(services: any[]) {
    if (!services || services.length === 0) {
      console.log('[Tivra DebugMind] No services to monitor');
      return;
    }

    console.log(`[Tivra DebugMind] Starting real-time monitoring for ${services.length} service(s)`);

    // Start polling monitoring
    this.startPollingMonitoring(services);
  }

  /**
   * Start polling monitoring (every 10 seconds)
   */
  private startPollingMonitoring(services: any[]) {
    console.log('[Tivra DebugMind] Starting polling mode (10s interval)');

    this.addMessage({
      type: 'system',
      content: `🔄 **Monitoring started** (polling mode) for ${services.length} service(s)\n\nChecking for errors every 10 seconds.`,
      timestamp: new Date()
    });

    // Initialize last poll time for each service
    services.forEach(service => {
      this._lastPollTime.set(service.name, Date.now());
    });

    // Poll every 10 seconds
    this._pollingInterval = setInterval(async () => {
      for (const service of services) {
        await this.pollServiceLogs(service);
      }
    }, 10000);
  }

  /**
   * Poll logs for a single service
   */
  private async pollServiceLogs(service: any) {
    try {
      const since = this._lastPollTime.get(service.name) || Date.now() - 60000;

      const response = await axios.get(`${this._apiUrl}/api/aws/logs/poll`, {
        params: {
          serviceName: service.name,
          serviceType: service.type,
          logGroupName: service.logGroup,
          since: since
        }
      });

      // Update last poll time
      this._lastPollTime.set(service.name, response.data.lastCheck);

      // Handle new errors
      if (response.data.errorCount > 0) {
        this.handleLogUpdate(service.name, response.data);
      }

    } catch (err: any) {
      console.error(`[Tivra DebugMind] Error polling ${service.name}:`, err);
    }
  }

  /**
   * Handle log update (from WebSocket or polling)
   */
  private handleLogUpdate(serviceName: string, data: any) {
    console.log(`[Tivra DebugMind] Log update for ${serviceName}:`, data);

    if (data.errorCount > 0) {
      this.addMessage({
        type: 'ai',
        content: `📊 **New Errors Detected in ${serviceName}**\n\n` +
                `Found ${data.errorCount} new error(s):\n\n` +
                data.topErrors.slice(0, 3).map((err: any, i: number) =>
                  `${i + 1}. **${err.message}** (${err.count} occurrences)`
                ).join('\n'),
        timestamp: new Date(),
        suggestedPrompts: [
          `Analyze errors in ${serviceName}`,
          'Show detailed root cause analysis',
          'Suggest a fix'
        ]
      });
    }
  }

  /**
   * Handle error alert (critical errors)
   */
  private handleErrorAlert(serviceName: string, data: any) {
    console.log(`[Tivra DebugMind] Error alert for ${serviceName}:`, data);

    this.addMessage({
      type: 'ai',
      content: `🚨 **Critical Alert: ${serviceName}**\n\n` +
              `${data.message}\n\n` +
              `**Top Errors:**\n` +
              data.topErrors.slice(0, 3).map((err: any, i: number) =>
                `${i + 1}. ${err.message} (${err.count} occurrences)`
              ).join('\n'),
      timestamp: new Date(),
      suggestedPrompts: [
        'Perform immediate root cause analysis',
        'What can I do right now to fix this?',
        'Show me the error details'
      ]
    });

    // Show VS Code notification
    vscode.window.showErrorMessage(
      `Tivra DebugMind: Critical errors detected in ${serviceName} (${data.errorCount} errors)`,
      'View Details'
    ).then(selection => {
      if (selection === 'View Details') {
        this._panel.reveal();
      }
    });
  }

  /**
   * Stop real-time monitoring
   */
  private async stopRealtimeMonitoring() {
    console.log('[Tivra DebugMind] Stopping real-time monitoring');

    // Stop polling
    if (this._pollingInterval) {
      clearInterval(this._pollingInterval);
      this._pollingInterval = null;
    }

    this._lastPollTime.clear();
  }

  public async dispose() {
    this.stopMonitoring();
    await this.stopRealtimeMonitoring();

    // Destroy encryption session
    if (this._encryption) {
      await this._encryption.destroySession();
      this._encryption = null;
    }

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
  suggestedPrompts?: string[];
  isTyping?: boolean;
}

interface CodeFix {
  filePath: string;
  newCode: string;
  explanation: string;
}

interface ConversationContext {
  service: { name: string; type: string; logGroupName?: string } | null;
  recentErrors: any[];
  appliedFixes: Array<{ filePath: string; code: string; description: string; timestamp?: Date }>;
  conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }>;
}
