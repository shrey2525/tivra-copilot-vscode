// Tivra DebugMind - Simplified v1.0
// Focus: Logs + AI Copilot Chat

import * as vscode from 'vscode';
import { DebugCopilot } from './panels/debugCopilot';

let copilot: DebugCopilot | undefined;
let statusBarItem: vscode.StatusBarItem;
let apiUrl: string;

export async function activate(context: vscode.ExtensionContext) {
  console.log('🤖 Tivra DebugMind activated!');

  // Get API URL from config
  apiUrl = vscode.workspace.getConfiguration('tivra').get<string>('apiUrl') || 'https://copilot.tivra.ai';

  // Create status bar
  statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
  statusBarItem.text = '$(bug) DebugMind';
  statusBarItem.command = 'tivra.openCopilot';
  statusBarItem.tooltip = 'Open Tivra DebugMind';
  statusBarItem.show();
  context.subscriptions.push(statusBarItem);

  // Command: Open Debug Copilot
  context.subscriptions.push(
    vscode.commands.registerCommand('tivra.openCopilot', async () => {
      copilot = DebugCopilot.createOrShow(context.extensionUri, apiUrl);
    })
  );

  // Command: Start Debugging (with service selection)
  context.subscriptions.push(
    vscode.commands.registerCommand('tivra.startDebugging', async () => {
      await startDebugging(context);
    })
  );

  // Command: Connect to AWS
  context.subscriptions.push(
    vscode.commands.registerCommand('tivra.connectAWS', async () => {
      await connectToAWS();
    })
  );

  // Show welcome message on first activation
  const hasShownWelcome = context.globalState.get('hasShownWelcome');
  if (!hasShownWelcome) {
    showWelcomeMessage(context);
    context.globalState.update('hasShownWelcome', true);
  }
}

async function startDebugging(context: vscode.ExtensionContext) {
  // Open copilot if not already open
  if (!copilot) {
    copilot = DebugCopilot.createOrShow(context.extensionUri, apiUrl);
  }

  // Ask user to select service
  const serviceName = await vscode.window.showInputBox({
    prompt: 'Enter AWS service name (e.g., payment-processor)',
    placeHolder: 'payment-processor',
    validateInput: (value) => {
      return value.trim() ? null : 'Service name cannot be empty';
    }
  });

  if (!serviceName) {
    return;
  }

  const serviceType = await vscode.window.showQuickPick(
    ['Lambda', 'ECS', 'RDS'],
    {
      placeHolder: 'Select service type'
    }
  );

  if (!serviceType) {
    return;
  }

  // Start debugging in copilot
  await copilot.startDebugging(serviceName, serviceType.toLowerCase());
}

async function connectToAWS() {
  const accessKeyId = await vscode.window.showInputBox({
    prompt: 'Enter AWS Access Key ID',
    password: false,
    ignoreFocusOut: true
  });

  if (!accessKeyId) {
    return;
  }

  const secretAccessKey = await vscode.window.showInputBox({
    prompt: 'Enter AWS Secret Access Key',
    password: true,
    ignoreFocusOut: true
  });

  if (!secretAccessKey) {
    return;
  }

  const region = await vscode.window.showQuickPick(
    ['us-east-1', 'us-west-2', 'eu-west-1', 'ap-south-1'],
    {
      placeHolder: 'Select AWS Region'
    }
  );

  if (!region) {
    return;
  }

  // Store credentials securely
  await vscode.workspace.getConfiguration('tivra').update('awsRegion', region, true);

  vscode.window.showInformationMessage(
    `✅ Connected to AWS (${region}). Run "Tivra: Start Debugging" to begin!`
  );

  statusBarItem.text = '$(bug) DebugMind (Connected)';
}

function showWelcomeMessage(context: vscode.ExtensionContext) {
  vscode.window.showInformationMessage(
    '🤖 Welcome to Tivra DebugMind! Your AI debugging assistant for AWS.',
    'Connect to AWS',
    'Open Copilot'
  ).then(choice => {
    if (choice === 'Connect to AWS') {
      vscode.commands.executeCommand('tivra.connectAWS');
    } else if (choice === 'Open Copilot') {
      copilot = DebugCopilot.createOrShow(context.extensionUri, apiUrl);
    }
  });
}

export function deactivate() {
  if (copilot) {
    copilot.dispose();
  }
}
