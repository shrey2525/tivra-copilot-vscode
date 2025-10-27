# Tivra DebugMind for VS Code

**Your AI-powered debugging copilot with Agentic SRE intelligence.**

[![VSCode Marketplace](https://img.shields.io/visual-studio-marketplace/v/shreychaturvedi.tivra-debugmind)](https://marketplace.visualstudio.com/items?itemName=shreychaturvedi.tivra-debugmind)
[![Installs](https://img.shields.io/visual-studio-marketplace/i/shreychaturvedi.tivra-debugmind)](https://marketplace.visualstudio.com/items?itemName=shreychaturvedi.tivra-debugmind)
[![Rating](https://img.shields.io/visual-studio-marketplace/r/shreychaturvedi.tivra-debugmind)](https://marketplace.visualstudio.com/items?itemName=shreychaturvedi.tivra-debugmind)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

> **From production error to fix in 2 minutes, not 2 hours.**

Automatically fetch production logs, get AI-powered root cause analysis, and receive actionable fixes — all without leaving VS Code. Now with **Agentic SRE Agent** for deep investigations and auto-healing.

![Tivra DebugMind Demo](https://github.com/user-attachments/assets/demo-gif-placeholder)

---

## 🆕 What's New in v0.3.0 - Auto Self-Healing & Agentic SRE

### 🤖 Agentic SRE Agent
A multi-step investigation agent powered by **LangGraph + Claude Sonnet 4.5** that acts like a senior SRE engineer:

- **🔍 Evidence Collection**: Automatically fetches CloudWatch logs, GitHub code, deployment history, and searches past incidents
- **🧠 Hypothesis Formation**: Analyzes patterns and forms ranked hypotheses
- **✅ Validation**: Cross-checks evidence to validate root causes
- **🎯 Root Cause Identification**: Pinpoints exact error location (file:line)
- **🔧 Fix Generation**: Suggests multiple fixes with risk assessment

### 🔄 Auto Self-Healing Mode
- **Auto-trigger** deep investigation after RCA (configurable 2s delay)
- **Permission management** with graceful degradation
- **GitHub OAuth integration** for code context and PR creation
- **One-click fixes** with automatic PR generation

### 📚 Investigation Storage with RAG
- **Learns from history** using Pinecone vector database
- **Semantic similarity search** finds similar past incidents
- **50-70% time savings** on recurring issues
- **Duplicate detection** (>95% similarity)

**Impact**: Reduces debugging from **2-4 hours** to **2-3 minutes** (95% time savings)

---

## Philosophy

> "Debug production like a senior SRE — automatically."

Stop context-switching between log dashboards, cloud consoles, and code. Tivra DebugMind brings **intelligent production debugging** directly into your IDE with:

- **Zero context switching** - everything in VS Code
- **Intelligent automation** - AI handles the tedious work
- **Learning system** - gets smarter with each investigation
- **Auto-healing** - from error to fix automatically

---

## 🎯 Key Features

### 🔗 Production Service Integration
- **AWS Lambda** - Functions, cold starts, timeouts, memory errors
- **Amazon ECS** - Tasks, services, deployment issues, OOM kills
- **Amazon EC2** - Instances, system logs, application logs
- **CloudWatch** - Auto-fetch logs, no manual searching

### 🤖 AI-Powered Analysis
- **Initial RCA** - Claude AI analyzes error patterns instantly
- **Deep Investigation** - Agentic SRE performs multi-step analysis
- **Code Context** - Fetches relevant code from GitHub repos
- **Deployment Correlation** - Links errors to recent deployments
- **Similar Incidents** - Finds related past issues with RAG

### ✨ Auto-Healing & Fixes
- **One-click fixes** - Apply AI-generated code patches
- **PR creation** - Automatic pull requests with fixes
- **Risk assessment** - Each fix rated by complexity/risk
- **Preview & approve** - Review before applying
- **Full undo support** - Safe to experiment

### 💬 Conversational Debugging
- **Natural language** - Ask questions about errors
- **Multi-turn conversations** - Follow-up questions supported
- **Context awareness** - Remembers conversation history
- **Suggested prompts** - Quick actions for common tasks

---

## 🚀 Quick Start

### 1. Install Extension

**From Marketplace (Recommended):**
1. Open VS Code
2. Go to Extensions (⌘+Shift+X / Ctrl+Shift+X)
3. Search for **"Tivra DebugMind"**
4. Click **Install**

**Or via command:**
```bash
code --install-extension shreychaturvedi.tivra-debugmind
```

### 2. Configure Backend

The extension requires the Tivra backend services:

**Option A: Use Production API (Recommended)**
```json
// VS Code settings.json
{
  "tivra.apiUrl": "https://copilot.tivra.ai"
}
```

**Option B: Run Locally**
```bash
# Clone backend repo
git clone https://github.com/shrey2525/Tivra-AI.git
cd Tivra-AI/tivra-copilot

# Copy and configure environment
cp .env.example .env
# Edit .env with your API keys

# Start with Docker
docker-compose up -d

# Or run locally
cd server && npm start              # Terminal 1
cd sre-agent && python app.py      # Terminal 2
```

**Required environment variables:**
```bash
# Backend
CLAUDE_API_KEY=sk-ant-...           # For initial RCA
GITHUB_CLIENT_ID=...                 # GitHub OAuth
GITHUB_CLIENT_SECRET=...             # GitHub OAuth

# Agentic SRE Agent
ANTHROPIC_API_KEY=sk-ant-...        # For deep investigation
OPENAI_API_KEY=sk-...               # For embeddings
PINECONE_API_KEY=pcsk_...           # For investigation storage
```

### 3. Connect to AWS

1. Open **Tivra DebugMind** panel (click status bar icon)
2. Click **"Connect to AWS"**
3. Enter credentials:
   - Access Key ID
   - Secret Access Key
   - Region (e.g., us-east-1)

**Note**: Credentials are encrypted and stored securely using OS-level storage (Keychain/Credential Manager)

### 4. Start Debugging!

**Option 1: Analyze All Services**
1. Click **"Analyze errors in my services"**
2. View initial RCA (2-3 seconds)
3. Wait for auto-investigation (triggers after 2s)
4. Review comprehensive analysis with fixes

**Option 2: Select Specific Service**
1. Browse services in sidebar
2. Click on service with errors
3. View logs and analysis
4. Apply suggested fixes

---

## 🎬 Complete Workflow Example

### Scenario: Lambda Timeout Error

```
┌─ 1. Error Detected ─────────────────────────────────┐
│ Lambda: payment-processor                            │
│ Error: Task timed out after 30.00 seconds          │
│ Occurrences: 47 in last hour                        │
└──────────────────────────────────────────────────────┘
                          ↓
┌─ 2. Open Tivra DebugMind ───────────────────────────┐
│ • Click "Analyze errors in my services"             │
│ • Or select "payment-processor" from sidebar        │
└──────────────────────────────────────────────────────┘
                          ↓
┌─ 3. Initial RCA (3 seconds) ────────────────────────┐
│ Claude AI Analysis:                                  │
│ • Error: Timeout in database query                  │
│ • Pattern: All timeouts in getUserTransactions()    │
│ • Suggestion: Missing index on transactions table   │
└──────────────────────────────────────────────────────┘
                          ↓
┌─ 4. Auto-Investigation Triggers (2s delay) ─────────┐
│ 🤖 Agentic SRE Agent starts deep investigation:     │
│                                                      │
│ Step 1: Gather Evidence                             │
│   ✓ Fetched 100 recent logs from CloudWatch        │
│   ✓ Retrieved code: src/db/queries.js              │
│   ✓ Found deployment: v2.4.1 (2 hours ago)         │
│   ✓ Searching similar incidents...                  │
│   ✓ Found similar issue from 2 weeks ago!          │
│                                                      │
│ Step 2: Form Hypotheses                             │
│   • Hypothesis 1: Missing database index (95%)      │
│   • Hypothesis 2: Increased query load (60%)        │
│   • Hypothesis 3: Network latency (20%)             │
│                                                      │
│ Step 3: Validate Hypotheses                         │
│   ✓ Code shows no index on transactions.userId     │
│   ✓ Similar incident fixed by adding index         │
│   ✓ Deployment v2.4.1 added new query pattern      │
│                                                      │
│ Step 4: Root Cause Identified                       │
│   📍 File: src/db/queries.js:42                     │
│   ⚠️  Cause: Query scans full table (500k rows)    │
│   💡 Previous fix: Added index, resolved in 2h      │
│                                                      │
│ Step 5: Suggest Fixes                               │
│   Fix 1: Add index on transactions.userId (LOW)    │
│   Fix 2: Increase Lambda timeout to 60s (MEDIUM)   │
│   Fix 3: Add query pagination (HIGH)               │
└──────────────────────────────────────────────────────┘
                          ↓
┌─ 5. Apply Fix (30 seconds) ──────────────────────────┐
│ • Click "Create PR" for Fix 1                       │
│ • Review generated code:                            │
│     ALTER TABLE transactions                        │
│     ADD INDEX idx_user_id (userId);                 │
│ • PR created automatically                          │
│ • Deploy → Issue resolved! ✅                       │
└──────────────────────────────────────────────────────┘

⏱️  Total Time: 2 minutes (vs 2 hours manual)
📊 Time Saved: 95%
```

---

## 🔧 Advanced Features

### Auto Self-Healing Configuration

Control behavior in VS Code settings:

```json
{
  "tivra.autoInvestigation": true,     // Auto-trigger SRE agent (default: true)
  "tivra.autoHealing": true,           // Enable healing features (default: true)
  "tivra.autoPRCreation": false,       // Auto-create PRs (default: false)
  "tivra.investigationDelay": 2000     // Delay before auto-trigger (ms)
}
```

### Manual Investigation Trigger

Disable auto-trigger and manually invoke:
- Click **"Trigger Deep Investigation"** button
- Or use command: `Tivra: Start Deep Investigation`

### Investigation History

View past investigations:
- Click **"View Investigation History"** in sidebar
- Browse by service, date, or error type
- Reapply previous fixes with one click

### Permission Management

The extension will prompt for permissions when needed:

**GitHub OAuth** (for code context and PR creation):
- Click "Grant GitHub Permissions"
- Complete OAuth flow in browser
- Extension automatically detects connection

**AWS Credentials** (for log fetching):
- Stored securely in OS credential manager
- Re-enter if needed via "Connect to AWS"

---

## 📊 Performance & Impact

### Time Savings Comparison

| Task | Manual (Before) | With Tivra AI | Savings |
|------|----------------|---------------|---------|
| Find error in logs | 20-30 min | **10 seconds** | 99% |
| Root cause analysis | 1-2 hours | **2-3 min** | 95% |
| Code investigation | 30-60 min | **30 seconds** | 98% |
| Fix implementation | 30-60 min | **5 min** | 90% |
| **Total per incident** | **2.5-4 hours** | **8-9 minutes** | **95%** |

### Recurring Issues (with RAG)

For errors seen before:
- **Detection**: Instant (similar incident found)
- **Analysis**: Reused from previous investigation
- **Fix**: 30 seconds (apply known solution)

**Additional savings**: 50-70% faster on recurring issues

---

## 🎯 Supported Services & Errors

### AWS Services

| Service | Status | Features |
|---------|--------|----------|
| **AWS Lambda** | ✅ Full | Timeouts, cold starts, memory errors, throttling |
| **ECS Fargate** | ✅ Full | Task logs, deployment issues, OOM kills |
| **ECS EC2** | ✅ Full | Container logs, instance health, scaling issues |
| **EC2 Instances** | ✅ Full | System logs, application logs, SSH access |
| **CloudWatch** | ✅ Full | Log groups, streams, metrics, insights |

### Error Types Detected

- ⏱️ **Timeouts** - API calls, database queries, external services
- 💾 **Memory Issues** - OOM errors, memory leaks, heap overflow
- 🔌 **Network Errors** - Connection timeouts, DNS failures, 502/503
- 🗄️ **Database Errors** - Query failures, deadlocks, connection pool exhaustion
- 🔐 **Permission Errors** - IAM issues, S3 access denied, resource policies
- 🐛 **Application Errors** - Exceptions, null pointers, type errors
- 📦 **Deployment Issues** - Version mismatches, config errors, rollback needed

---

## 💬 Conversational Debugging

Ask natural language questions:

**Examples:**
```
"Why is my payment-api timing out?"
"Show me errors from the last hour"
"What changed in the last deployment?"
"Find similar incidents"
"How do I fix the database connection issue?"
"Create a PR with the suggested fix"
```

**Suggested Prompts:**
- 🔗 "Connect me to AWS"
- 🔍 "Analyze errors in my services"
- 🚀 "Trigger deep investigation"
- 📊 "Show investigation history"
- ✅ "Check service health"

---

## 🔒 Security & Privacy

### Credential Security

**OS-Level Encryption:**
- AWS credentials stored in **VS Code Secret Storage**
  - macOS: Keychain
  - Windows: Credential Manager
  - Linux: Secret Service API (libsecret)
- **Server-side encryption** for API credentials (AES-256)
- **No plaintext storage** in config files

### Data Privacy

**Zero Data Persistence:**
- **Logs analyzed in-memory only** - never written to disk
- **No permanent storage** - data discarded after analysis
- **Investigation results** - only embeddings stored (no raw logs)
- **No telemetry** - we don't track your usage

### Network Security

**HTTPS-Only:**
- All API calls encrypted in transit (TLS 1.3)
- Certificate validation enforced
- No unencrypted data transmission

### User Control

**Explicit Approval:**
- All fixes **require review and approval**
- **Preview before apply** - see exact changes
- **Full undo support** via VS Code
- **Reject option** - no consequences

### Required AWS Permissions

**Read-only access** for log fetching:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "logs:DescribeLogGroups",
        "logs:DescribeLogStreams",
        "logs:FilterLogEvents",
        "logs:GetLogEvents",
        "lambda:ListFunctions",
        "lambda:GetFunction",
        "ecs:ListClusters",
        "ecs:ListTasks",
        "ecs:DescribeTasks",
        "ec2:DescribeInstances"
      ],
      "Resource": "*"
    }
  ]
}
```

**Note**: All permissions are **read-only**. Tivra never modifies AWS infrastructure.

### GitHub OAuth Scopes

- `repo` - Read code and create PRs
- `user` - Basic profile info

---

## 📚 Documentation & Resources

- 📖 [User Guide](https://github.com/shrey2525/Tivra-AI#readme)
- 🤖 [Agentic SRE Architecture](https://github.com/shrey2525/Tivra-AI/blob/main/AUTO-HEALING-IMPLEMENTATION.md)
- 📚 [Investigation Storage (RAG)](https://github.com/shrey2525/Tivra-AI/blob/main/PINECONE-RAG-IMPLEMENTATION.md)
- 🚀 [Quick Start Guide](https://github.com/shrey2525/Tivra-AI/blob/main/tivra-copilot/sre-agent/QUICKSTART.md)
- 🔧 [Deployment Guide](https://github.com/shrey2525/Tivra-AI/blob/main/tivra-copilot/sre-agent/DEPLOYMENT.md)

---

## 🛠️ Troubleshooting

### Extension Not Connecting

**Issue**: "Failed to connect to backend"

**Solution**:
```bash
# Check backend is running
curl http://localhost:3001/api/health

# Check settings
CMD+, → Search "Tivra" → Verify API URL
```

### AWS Connection Failed

**Issue**: "AWS credentials not found"

**Solution**:
1. Click "Connect to AWS" again
2. Verify credentials are correct
3. Check IAM permissions match required policy

### Auto-Investigation Not Triggering

**Issue**: RCA completes but no deep investigation

**Solution**:
1. Check setting: `tivra.autoInvestigation` = true
2. Verify backend SRE agent is running:
   ```bash
   curl http://localhost:5001/health
   ```
3. Check logs: View → Output → Tivra DebugMind

### GitHub OAuth Failed

**Issue**: "Failed to connect GitHub"

**Solution**:
1. Visit: `http://localhost:3001/api/github/auth`
2. Complete OAuth flow
3. Verify redirect URI in GitHub app settings

---

## 🤝 Contributing

We welcome contributions! See [CONTRIBUTING.md](https://github.com/shrey2525/tivra-copilot-vscode/blob/main/CONTRIBUTING.md) for guidelines.

**Development Setup:**
```bash
# Clone extension repo
git clone https://github.com/shrey2525/tivra-debugmind.git
cd tivra-debugmind

# Install dependencies
npm install

# Open in VS Code
code .

# Press F5 to run extension in debug mode
```

---

## 📞 Support

- 🐛 **Bug Reports**: [GitHub Issues](https://github.com/shrey2525/tivra-copilot-vscode/issues)
- 💬 **Feature Requests**: [GitHub Discussions](https://github.com/shrey2525/tivra-copilot-vscode/discussions)
- 📧 **Email**: info@tivra.ai
- 🔒 **Security**: security@tivra.ai

---

## 📝 License

MIT License - see [LICENSE](https://github.com/shrey2525/tivra-copilot-vscode/blob/main/LICENSE) for details

---

## 🎉 Acknowledgments

Built with:
- [Claude AI](https://anthropic.com) - Reasoning and analysis
- [LangGraph](https://github.com/langchain-ai/langgraph) - Agent orchestration
- [Pinecone](https://pinecone.io) - Vector database for RAG
- [OpenAI](https://openai.com) - Embeddings for similarity search

---

## ⭐ Support Us

If Tivra DebugMind saves you time, please:
- ⭐ **Star the repo** on [GitHub](https://github.com/shrey2525/Tivra-AI)
- ✍️ **Leave a review** on [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=shreychaturvedi.tivra-debugmind)
- 🐦 **Share your experience** on social media

---

**Made with ❤️ by the Tivra AI Team**

*Transform production debugging from hours to minutes.*
