# Tivra DebugMind for VS Code

**AI-powered AWS debugging that automatically fixes production errors in VS Code.**

Close the observability loop: AWS errors → AI analysis → Automatic code fixes.

## Philosophy

> "From error to fix in 10 minutes, not 4 hours"

Tivra DebugMind captures real-time AWS runtime context (CloudWatch Logs, Metrics, X-Ray traces) and uses AI to automatically generate and apply code fixes directly in your VS Code workspace.

## Features

- **🔗 AWS Integration**: Connect to AWS, auto-discover Lambda/ECS/RDS services  
- **📊 Real-Time Monitoring**: Live error rates, metrics, and traces in VS Code
- **🤖 Agentic Fix Generation**: AI automatically generates AND applies code fixes
- **👀 Diff Preview**: Review changes before applying
- **✨ One-Click Apply**: Fix applied directly to your codebase
- **🔍 Intelligent Navigation**: Jump from CloudWatch errors to source code
- **🚨 Error Diagnostics**: See production errors inline in your editor
- **⚡ Auto-Refresh**: Automatic monitoring with configurable intervals
- **✅ Zero Context Switching**: Everything in VS Code - no AWS Console needed

## Quick Start

### 1. Install Extension

Download the `.vsix` file from [GitHub Releases](https://github.com/shrey2525/tivra-debugmind-vscode/releases) and install:

1. Open VS Code
2. Press `Cmd+Shift+P` (Mac) or `Ctrl+Shift+P` (Windows/Linux)
3. Type: `Extensions: Install from VSIX...`
4. Select the downloaded `.vsix` file
5. Reload VS Code

### 2. Connect to AWS

1. Open Command Palette (`Cmd+Shift+P`)
2. Run: `Tivra: Connect to AWS`
3. Enter your AWS credentials:
   - Access Key ID
   - Secret Access Key
   - Region (e.g., us-east-1)

The extension will auto-discover your AWS services!

### 3. Analyze a Service

1. Command Palette → `Tivra: Analyze AWS Service`
2. Select a service (Lambda, ECS, or RDS)
3. Tivra fetches:
   - CloudWatch Logs (errors, stack traces)
   - CloudWatch Metrics (error rate, latency, CPU/memory)
   - X-Ray Traces (distributed tracing, dependencies)

### 4. Generate & Apply Fix Automatically

1. After analysis, click **"Generate Fix"**
2. AI analyzes the complete AWS runtime context
3. Preview the proposed code changes (side-by-side diff)
4. Click **"Apply Fix"** to update your code
5. Done! Code is ready to commit and deploy

## Complete Workflow Example

```
1. Error occurs in production Lambda "payment-processor"
   └─ ConditionalCheckFailedException (89 occurrences)

2. VS Code Extension: "Tivra: Analyze AWS Service"
   └─ Selects "payment-processor"
   └─ Fetches logs, metrics, traces (10 seconds)

3. Analysis Complete:
   ├─ Error Rate: 12.5%
   ├─ Root Cause: "DynamoDB version conflict due to race conditions"
   └─ Click: "Generate Fix"

4. AI generates fix automatically:
   ├─ Adds retry logic with exponential backoff
   ├─ Implements proper error handling
   ├─ Adds input validation
   └─ Shows side-by-side diff preview

5. One-click apply:
   ├─ Code updated in workspace
   ├─ Ready to commit
   └─ Total time: 10 minutes (vs 4 hours manual debugging)
```

## How It Works

### Traditional Way (4 hours)
```
1. Open AWS Console
2. Search CloudWatch Logs manually
3. Copy error messages
4. Google stack traces
5. Try fix #1 → Deploy → Wait → Still failing
6. Try fix #2 → Deploy → Wait → Still failing
7. Try fix #3 → Deploy → Wait → Success!
   Total: 4 hours, 23 context switches, 6 deployments
```

### Tivra DebugMind Way (10 minutes)
```
1. VS Code: Analyze Service
2. AI generates fix with full AWS context
3. Preview diff → Apply fix
4. Commit → Deploy → Success!
   Total: 10 minutes, 0 context switches, 1 deployment
```

## Commands

- `Tivra: Connect to AWS` - Connect with AWS credentials
- `Tivra: Analyze AWS Service` - Analyze a service for errors
- `Tivra: Generate Fix` - AI generates and applies code fix
- `Tivra: Show Runtime Context` - View detailed AWS analysis
- `Tivra: Refresh Services` - Re-discover AWS services
- `Tivra: Navigate to Error` - Jump to error in code

## Configuration

```json
{
  "tivra.apiUrl": "https://copilot.tivra.ai",
  "tivra.autoRefresh": true,
  "tivra.refreshInterval": 300000,
  "tivra.notifyOnErrors": true
}
```

## Requirements

- VS Code 1.85.0+
- AWS account with:
  - CloudWatch Logs read access
  - CloudWatch Metrics read access
  - X-Ray read access (optional)
- AWS credentials (Access Key ID + Secret Access Key)

## Privacy & Security

- AWS credentials are stored securely in VS Code's Secret Storage
- No data is stored on Tivra servers (only temporary analysis)
- All code changes require your explicit approval
- Full undo support via VS Code's built-in undo

## Supported AWS Services

- ✅ AWS Lambda
- ✅ Amazon ECS (Fargate & EC2)
- ✅ Amazon RDS
- ✅ API Gateway
- 🔜 DynamoDB
- 🔜 S3
- 🔜 SQS/SNS

## Feedback & Support

- 🐛 Report issues: [GitHub Issues](https://github.com/shrey2525/tivra-debugmind-vscode/issues)
- 💬 Feature requests: [GitHub Discussions](https://github.com/shrey2525/tivra-debugmind-vscode/discussions)
- 📧 Email: info@tivra.ai

## License

MIT License - see [LICENSE](LICENSE) for details

---

**Made with ❤️ by the Tivra team**

*Closing the observability loop, one fix at a time.*
