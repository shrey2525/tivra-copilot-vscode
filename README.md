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
- **⚡ Multi-Service Scanning**: Analyze errors across all services in one click
- **💬 Conversational Interface**: Chat with AI about production errors
- **🔄 Auto-Discovery**: Services automatically detected on startup

## Features

- **🔗 Production Debugging**: Connect to your cloud services and fetch real production logs
- **🔍 Intelligent Log Analysis**: Automatically scan logs for errors, exceptions, and failures
- **🤖 AI Root Cause Analysis**: Get detailed analysis of error patterns and suggested fixes
- **✅ Zero False Positives**: Get positive feedback when services are healthy
- **⚡ One-Click Analysis**: Scan all services for errors with a single click
- **💬 Conversational Debugging**: Ask questions about errors and get instant insights
- **✨ Context-Aware Fixes**: AI understands your service type and provides relevant solutions
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
   └─ Shows exact code changes needed

5. Apply the fix:
   ├─ Review suggested changes
   ├─ Apply to your code
   ├─ Deploy the fixed code
   └─ Total debugging time: 5 minutes (vs 2-4 hours manual)
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

## Privacy & Security

- Credentials are stored securely in VS Code's Secret Storage
- Logs are analyzed in real-time, not stored permanently
- All fixes require your explicit review and approval
- Full undo support via VS Code's built-in undo

## Supported Services (v1)

- ✅ Amazon EC2 (Virtual machines)
- ✅ Amazon ECS (Containerized services - Fargate & EC2)

**Coming in future versions:**
- 🔜 AWS Lambda
- 🔜 Amazon RDS
- 🔜 Kubernetes
- 🔜 Google Cloud Platform
- 🔜 Azure

## Roadmap

### v1.0 (Current)
- ✅ EC2 and ECS service discovery
- ✅ Log analysis and error detection
- ✅ AI-powered root cause analysis
- ✅ Conversational debugging interface

### v2.0 (Planned)
- Lambda and RDS support
- Kubernetes integration
- Multi-cloud support (GCP, Azure)
- Performance metrics analysis
- Distributed tracing

### v3.0 (Future)
- Automatic PR generation with fixes
- Deployment rollback suggestions
- Cost optimization recommendations
- Custom alerting rules

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
