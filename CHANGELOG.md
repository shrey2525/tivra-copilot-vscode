# Changelog

All notable changes to the Tivra DebugMind extension will be documented in this file.

## [0.1.0] - 2025-01-19

### Initial Release

**AI debugging copilot for production services.**

### Features

- **🎯 EC2 & ECS Service Discovery**: Automatically discover and monitor EC2 instances and ECS containers
  - Captures instance metadata (type, IPs, availability zones, VPC, subnet)
  - Supports instance tags including Name tag
  - Shows instance status (running/stopped)
  - Integrates with CloudWatch logs

- **🔍 Intelligent Log Analysis**: Automatically fetch and analyze production logs
  - One-click analysis across all services
  - Fetches CloudWatch logs from EC2 and ECS
  - Groups errors by service with timestamps
  - Shows error counts and recent occurrences

- **🤖 AI-Powered Root Cause Analysis**: Claude AI integration for error analysis
  - Automatic RCA when errors are detected
  - Provides actionable code fixes with explanations
  - Contextual analysis based on service type and error patterns
  - Learning from past issues via Pinecone RAG

- **✅ Smart "No Errors" Detection**: Positive feedback when services are healthy
  - Lists all analyzed services
  - Confirms everything is running smoothly
  - Provides follow-up action suggestions

- **💬 Conversational Debugging Interface**: Chat with AI about production errors
  - Ask questions about errors and get instant insights
  - Context-aware responses
  - Suggested prompts for common tasks
  - Complete conversation history

- **🔄 Auto-Service Display**: Better UX for returning users
  - Automatically fetches and displays services when AWS is already connected
  - Consistent experience whether connecting fresh or reopening

- **⚡ Production Ready**:
  - Production API at https://copilot.tivra.ai
  - Real AWS integration (no mock data)
  - Secure credential storage
  - Zero context switching - all in VS Code

### Installation

1. Download `tivra-debugmind-0.1.0.vsix`
2. In VS Code: `Cmd+Shift+P` → "Extensions: Install from VSIX..."
3. Select the downloaded file
4. Reload VS Code
5. Click "DebugMind" in status bar to get started!

### Requirements

- VS Code 1.85.0+
- AWS account with EC2/ECS services
- AWS credentials (Access Key ID + Secret Access Key)

---

[0.1.0]: https://github.com/shrey2525/tivra-copilot-vscode/releases/tag/v0.1.0
