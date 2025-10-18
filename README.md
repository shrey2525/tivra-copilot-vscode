# Tivra CoPilot for VS Code

**Bring AWS runtime context directly into VS Code and Claude Code.**

Close the observability loop: AWS errors → Tivra analysis → Claude Code generates fixes.

## Philosophy

> "Where Claude leaves off, we start - we pass runtime context back to Claude"

Tivra CoPilot captures real-time AWS runtime context (CloudWatch Logs, Metrics, X-Ray traces) and passes it directly to Claude Code in your IDE, enabling Claude to generate fixes with full knowledge of production errors + your complete codebase.

## Features

- **🔗 AWS Integration**: Connect to AWS with credentials, auto-discover Lambda/ECS/RDS services
- **📊 Real-Time Monitoring**: Live error rates, metrics, and traces in VS Code
- **🤖 Claude Code Integration**: Send comprehensive runtime context to Claude with one click
- **🔍 Intelligent Navigation**: Jump from CloudWatch errors directly to source code
- **🚨 Error Diagnostics**: See production errors inline in your editor
- **⚡ Auto-Refresh**: Automatic monitoring with configurable intervals
- **✅ Zero Context Switching**: Everything in VS Code - no AWS Console needed

## Quick Start

### 1. Install & Setup

1. Install Tivra CoPilot backend:
   ```bash
   cd tivra-copilot
   npm install
   npm start  # Runs on http://localhost:3001
   ```

2. Install this VS Code extension (or load in dev mode)

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

### 4. Generate Fix with Claude

1. After analysis, click **"Generate Fix with Claude"**
2. Complete AWS runtime context is:
   - Copied to clipboard
   - Saved as `.tivra-context-{service}.md` in workspace
   - Ready to paste into Claude Code
3. Claude receives:
   - Error patterns and counts
   - Stack traces
   - Metrics (error rate, latency percentiles)
   - X-Ray traces
   - AI-generated root cause analysis
   - Suggested fix recommendations

### 5. Claude Generates Fix

Claude Code now has:
- **Full codebase access** (via VS Code workspace)
- **Complete runtime context** (from Tivra)

Claude can:
- Locate the exact file causing errors
- Generate fixes with proper error handling
- Add retry logic, logging, validation
- Optimize based on metrics

## Complete Workflow Example

```
1. Error occurs in production Lambda "payment-processor"
   └─ ConditionalCheckFailedException (89 occurrences)

2. VS Code Extension: "Tivra: Analyze AWS Service"
   └─ Selects "payment-processor"
   └─ Fetches logs, metrics, traces

3. Analysis Complete:
   ├─ Error Rate: 12.5%
   ├─ Root Cause: "DynamoDB version conflict due to race conditions"
   └─ Click: "Generate Fix with Claude"

4. Context sent to Claude Code:
   ├─ 89 DynamoDB errors with stack traces
   ├─ P99 latency: 1200ms
   ├─ Suggested fix: "Retry logic with exponential backoff"
   └─ Full codebase access

5. Claude generates fix:
   ├─ Adds retry mechanism to lambda/payment-processor/index.js
   ├─ Implements exponential backoff
   ├─ Adds CloudWatch logging
   └─ Creates PR

6. Deploy & Validate:
   └─ Error rate: 12.5% → 0.2% ✅

Total time: ~10 minutes | Manual effort: ~2 minutes | Context switches: 0
```

## Commands

- `Tivra: Connect to AWS` - Connect AWS credentials
- `Tivra: Analyze AWS Service` - Analyze specific service
- `Tivra: Generate Fix with Claude` - Send context to Claude Code
- `Tivra: Show Runtime Context` - Open runtime panel
- `Tivra: Refresh Services` - Refresh service list
- `Tivra: Navigate to Error` - Jump to error in code

## Configuration

Open VS Code Settings and search for "Tivra":

- `tivra.apiUrl`: Tivra CoPilot API URL (default: `http://localhost:3001`)
- `tivra.autoRefresh`: Auto-refresh runtime context (default: `true`)
- `tivra.refreshInterval`: Refresh interval in ms (default: `300000` = 5min)
- `tivra.notifyOnErrors`: Show notifications on errors (default: `true`)

## Requirements

- **Tivra CoPilot Backend**: Must be running on `localhost:3001`
- **AWS Account**: With appropriate IAM permissions (CloudWatch, X-Ray, Lambda/ECS/RDS read access)
- **Claude Code Extension**: Optional but recommended for AI-powered fixes

## IAM Permissions

Recommended read-only IAM policy:

```json
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Action": [
      "logs:FilterLogEvents",
      "logs:DescribeLogGroups",
      "cloudwatch:GetMetricData",
      "cloudwatch:ListMetrics",
      "xray:GetTraceSummaries",
      "xray:GetServiceGraph",
      "lambda:ListFunctions",
      "ecs:ListServices",
      "ecs:DescribeServices",
      "rds:DescribeDBInstances"
    ],
    "Resource": "*"
  }]
}
```

## Example Context Sent to Claude

```markdown
# AWS Runtime Context for payment-processor (LAMBDA)

## 🚨 Issue Summary
**Root Cause**: DynamoDB conditional check failures due to version conflict

**Confidence**: high

**Suggested Fix**: Implement retry logic with exponential backoff

## 📊 CloudWatch Metrics (Last Hour)
- Error Rate: 12.5%
- Error Count: 145
- P99 Latency: 1200ms

## 📝 CloudWatch Logs - Top Errors
### 1. ConditionalCheckFailedException (89 occurrences)

**Stack Trace**:
```
ConditionalCheckFailedException: The conditional request failed
    at Request.extractError (/var/task/node_modules/aws-sdk/lib/protocol/json.js:52:27)
    at Request.callListeners (/var/task/node_modules/aws-sdk/lib/sequential_executor.js:106:20)
    ...
```

## 🔍 X-Ray Distributed Traces
- Total Traces: 1160
- Error Traces: 145
- 61% of errors from DynamoDB operations

## 💡 AI Recommendations
1. Implement retry logic with exponential backoff (Priority: high)
2. Add CloudWatch alarms for error rate (Priority: medium)
```

## Troubleshooting

**Extension not connecting to Tivra**:
- Verify Tivra backend is running: `curl http://localhost:3001/api/aws/status`
- Check extension logs: View → Output → Select "Tivra CoPilot"

**No services found**:
- Ensure AWS credentials have correct permissions
- Check AWS region is correct
- Try demo mode in Tivra: `USE_MOCK_DATA=true`

**Claude Code not receiving context**:
- Context is copied to clipboard and saved as `.tivra-context-{service}.md`
- Manually paste into Claude Code chat
- Reference the .md file directly in chat

## Development

To run extension in development mode:

```bash
cd tivra-copilot-vscode
npm install
npm run compile
```

Then press `F5` in VS Code to launch Extension Development Host.

## Roadmap

- [ ] WebSocket real-time updates from Tivra backend
- [ ] Deployment validation (pre/post error rate comparison)
- [ ] Multi-cloud support (Azure, GCP)
- [ ] Custom dashboards in VS Code
- [ ] Team collaboration features

## License

MIT

## Support

- Issues: [GitHub Issues](https://github.com/your-org/tivra-copilot-vscode/issues)
- Docs: [Tivra CoPilot Documentation](https://tivra.dev/docs)

---

**Built with the philosophy**: *Where Claude leaves off, we start - we pass runtime context back to Claude.* 🚀
