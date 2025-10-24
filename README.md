# Tivra DebugMind for VS Code

**Your AI debugging copilot for production services.**

Automatically fetch production logs, get AI-powered root cause analysis, and receive actionable fixes — all without leaving VS Code.

## Philosophy

> "From production error to fix in 5 minutes, not 4 hours"

Stop context-switching between log dashboards, consoles, and code. Tivra DebugMind brings production debugging directly into your IDE with intelligent log analysis and AI-powered root cause analysis.

## What's New in v0.1.0 🎉

**Initial Release - AI Debugging Copilot for Production Services**

- **🎯 EC2 & ECS Support**: Monitor virtual machines and containerized services
- **🔍 Intelligent Log Analysis**: Automatically fetch and analyze production logs
- **✅ Smart "No Errors" Detection**: Know when everything is working perfectly
- **🤖 AI-Powered RCA**: Claude AI analyzes logs and provides actionable fixes
- **✨ Agentic Code Fixes**: Apply AI-generated fixes directly in your IDE with one click
- **⚡ Multi-Service Scanning**: Analyze errors across all services in one click
- **💬 Conversational Interface**: Chat with AI about production errors
- **🔄 Auto-Discovery**: Services automatically detected on startup

## Features

- **🔗 Production Debugging**: Connect to your cloud services and fetch real production logs
- **🔍 Intelligent Log Analysis**: Automatically scan logs for errors, exceptions, and failures
- **🤖 AI Root Cause Analysis**: Get detailed analysis of error patterns and suggested fixes
- **✨ Agentic Code Fixes**: One-click application of AI-generated fixes directly in your workspace
  - Review suggested code changes with inline diffs
  - Apply fixes to your codebase instantly
  - Full undo support
  - No manual copy-pasting required
- **✅ Zero False Positives**: Get positive feedback when services are healthy
- **⚡ One-Click Analysis**: Scan all services for errors with a single click
- **💬 Conversational Debugging**: Ask questions about errors and get instant insights
- **🔄 Automatic PR Creation**: Generate pull requests with fixes ready for review
- **✅ Zero Context Switching**: Everything in VS Code - no log dashboards, no cloud consoles

## Why Tivra DebugMind?

**The Problem:**
- Production errors require jumping between cloud consoles, log dashboards, and code
- Searching through thousands of log lines manually
- Copying error messages to Google/Stack Overflow
- Multiple deploy cycles to test fixes
- Hours of context switching and debugging toil

**The Solution:**
```
┌─────────────────┐
│  Write Code     │
└─────────────────┘
        ↓
┌─────────────────┐
│  Deploy         │
└─────────────────┘
        ↓
┌─────────────────┐
│  Error Occurs   │ ← Production logs
└─────────────────┘
        ↓
┌─────────────────┐
│  DebugMind      │ → Fetch logs → Analyze → Suggest fix
└─────────────────┘
        ↓
┌─────────────────┐
│  Apply Fix      │ → Back to code
└─────────────────┘
```

Tivra DebugMind reduces debugging toil by bringing production context directly into your IDE.

## Quick Start

### 1. Install Extension

Download the `.vsix` file from [GitHub Releases](https://github.com/shrey2525/tivra-copilot-vscode/releases) and install:

1. Open VS Code
2. Press `Cmd+Shift+P` (Mac) or `Ctrl+Shift+P` (Windows/Linux)
3. Type: `Extensions: Install from VSIX...`
4. Select the downloaded `.vsix` file
5. Reload VS Code

### 2. Open Tivra DebugMind Copilot

1. Click the **DebugMind** button in the VS Code status bar (bottom left)
   - Or open Command Palette (`Cmd+Shift+P`) and run: `Tivra DebugMind`
2. The AI copilot chat panel will open

### 3. Connect to Your Services

In the chat panel:

1. Click the suggested prompt **"Connect me to AWS"**
2. Enter your credentials when prompted:
   - **Access Key ID**
   - **Secret Access Key**
   - **Region** (e.g., us-east-1, ap-south-1)
3. The extension will automatically discover your EC2 and ECS services

### 4. Analyze Production Logs

1. Click **"Analyze errors in my services"** from the suggested prompts
2. The AI will:
   - Automatically fetch production logs from ALL your services
   - Detect errors, exceptions, and failures from the last hour
   - Group errors by service and severity
   - Perform root cause analysis
   - Suggest actionable code fixes

**If no errors are found:**
```
✅ No Errors Found!
All your services are running smoothly with no errors in the last hour.
Everything looks perfect! 🎉
```

**If errors are detected:**
```
⚠️ Errors Found
Found 5 error(s) across 2 service(s)

### payment-api (ecs)
**3 error(s)**
1. NullPointerException in payment processing
2. Database connection timeout

🔍 Root Cause Analysis
The NullPointerException occurs when processing payments without
a payment method specified. Add null validation before accessing
payment.method property.

Suggested Fix:
[Code changes with explanations]
```

### 5. Chat About Production Issues

Ask the copilot anything about production errors:
- "Why is my payment-api timing out?"
- "Show me errors from my EC2 instances"
- "What's causing the NullPointerException?"
- "How do I fix the database connection issue?"

## Complete Workflow Example

```
1. Deploy new payment processing feature to production

2. Error occurs in production ECS service "payment-api"
   └─ NullPointerException (47 occurrences in logs)

3. Open Tivra DebugMind copilot in VS Code
   └─ Click "Analyze errors in my services"
   └─ AI fetches production logs automatically

4. AI Root Cause Analysis:
   ├─ Error: "NullPointerException in PaymentProcessor.java:142"
   ├─ Root Cause: "Missing null check for optional payment method"
   ├─ Suggested Fix: Add null validation and default handling
   └─ Shows exact code changes with inline diff

5. Apply the AI-generated fix:
   ├─ Click "Apply Fix" button in the chat
   ├─ Code automatically updated in your workspace
   ├─ Review the changes with VS Code's diff view
   ├─ Optionally click "Create PR" to generate pull request
   └─ Deploy → Total debugging time: 5 minutes (vs 2-4 hours manual)
```

## How It Works

### Traditional Debugging (2-4 hours)
```
1. Get alert about production error
2. Open cloud console / log dashboard
3. Search through thousands of log lines
4. Copy error messages to Google/Stack Overflow
5. Guess at the fix
6. Try fix #1 → Deploy → Wait → Still failing
7. Try fix #2 → Deploy → Wait → Still failing
8. Try fix #3 → Deploy → Wait → Success!
   Total: 2-4 hours, 15+ context switches, 4+ deployments
```

### With Tivra DebugMind (5 minutes)
```
1. Open DebugMind copilot in VS Code
2. Click "Analyze errors in my services"
3. AI fetches logs, performs RCA, suggests fix
4. Apply fix → Deploy → Success!
   Total: 5 minutes, 0 context switches, 1 deployment
```

## Commands

- `Tivra DebugMind` - Open the AI copilot chat panel
- `Tivra: Start Debugging` - Quick start debugging with service selection
- `Tivra: Connect to AWS` - Connect your cloud account (also available in chat)

**In the Chat Panel:**
- Click "Connect me to AWS" - Connect your account
- Click "Analyze errors in my services" - Scan all services for errors
- Type any question about your production errors
- Use suggested prompts for common debugging tasks

## Configuration

The extension uses the production API by default (`https://copilot.tivra.ai`).

For local development, you can override the API URL in your VS Code settings:

```json
{
  "tivra.apiUrl": "http://localhost:3001"
}
```

Then run the backend server locally:
```bash
cd tivra-copilot/server
npm install
node index.js
```

## Requirements

- VS Code 1.85.0+
- Cloud account with log access (currently supports AWS)
- API credentials for log fetching

## 🔒 Security & Privacy

Your security and privacy are our top priorities. Tivra DebugMind is designed with enterprise-grade security practices.

### 🛡️ Credential Security

**OS-Level Encryption:**
- **AWS credentials stored in VS Code Secret Storage** (OS-level encrypted storage)
  - macOS: Keychain
  - Windows: Windows Credential Manager
  - Linux: Secret Service API (libsecret)
- **No plaintext credentials** in workspace settings or configuration files
- **Server-side encryption** for API credentials (AES-256-CBC)
- **Access Keys authentication** with secure storage

### 🔐 Data Privacy

**Zero Data Persistence:**
- **Logs analyzed in-memory only** - never written to disk
- **No log storage** - all analysis happens in real-time
- **Session-based processing** - data discarded after analysis
- **No telemetry** or usage tracking

### 🌐 Network Security

**HTTPS-Only Communication:**
- **Production API:** `https://copilot.tivra.ai` (TLS 1.3)
- **All API calls encrypted in transit**
- **Certificate validation** enforced

### ✋ User Control

**Explicit Approval Required:**
- **All fixes require review and approval** before application
- **Preview before apply** - see exactly what will change
- **Full undo support** via VS Code's built-in undo
- **Reject option** - decline fixes without consequence

### 🔍 AWS Permissions Required

Tivra DebugMind requires **read-only** AWS permissions:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "logs:DescribeLogGroups",
        "logs:FilterLogEvents",
        "cloudwatch:GetMetricData",
        "cloudwatch:ListMetrics",
        "xray:GetServiceGraph",
        "xray:GetTraceSummaries",
        "xray:BatchGetTraces",
        "lambda:ListFunctions",
        "lambda:GetFunction",
        "ecs:ListClusters",
        "ecs:ListServices",
        "ecs:DescribeServices",
        "ec2:DescribeInstances",
        "rds:DescribeDBInstances"
      ],
      "Resource": "*"
    }
  ]
}
```

**Note:** All permissions are **read-only**. Tivra DebugMind never modifies your AWS infrastructure.

### 📞 Security Concerns?

If you discover a security vulnerability, please report it responsibly:
- **Email:** security@tivra.ai
- **Response time:** Within 24 hours

## Supported Services (v1)

- ✅ Amazon EC2 (Virtual machines)
- ✅ Amazon ECS (Containerized services - Fargate & EC2)

**Coming in future versions:**
- 🔜 AWS Lambda
- 🔜 Amazon RDS
- 🔜 Kubernetes
- 🔜 Google Cloud Platform
- 🔜 Azure

## Use Cases

**1. Debugging Production Errors**
- Your code works locally but breaks in production
- Tivra fetches production logs and shows you exactly what's failing

**2. Post-Deployment Validation**
- Just deployed new code
- Run a quick health check to ensure no new errors

**3. On-Call Debugging**
- Got paged about an error
- Quickly analyze logs and get AI-suggested fixes

**4. Reducing Debugging Toil**
- Stop jumping between cloud consoles and log dashboards
- Get all debugging context in one place

## Feedback & Support

- 🐛 Report issues: [GitHub Issues](https://github.com/shrey2525/tivra-copilot-vscode/issues)
- 💬 Feature requests: [GitHub Discussions](https://github.com/shrey2525/tivra-copilot-vscode/discussions)
- 📧 Email: info@tivra.ai

## License

MIT License - see [LICENSE](LICENSE) for details

---

**Made with ❤️ by the Tivra team**

*Reducing debugging toil, one log at a time.*
