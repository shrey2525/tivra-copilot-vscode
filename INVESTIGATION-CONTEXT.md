# Investigation Context Passed to SRE Agent

This document explains what context is passed to the SRE Agent when "Trigger Investigation" is clicked.

## Overview

When a user clicks "Trigger Investigation", the VSCode extension automatically gathers comprehensive context from multiple sources and sends it to the SRE Agent for deep investigation.

## Context Structure

```typescript
{
  service: {
    name: string,              // Service name (e.g., "user-service")
    type: string,              // Service type: "ec2", "lambda", "ecs"
    logGroupName: string,      // CloudWatch log group
    region: string             // AWS region (default: "us-east-1")
  },
  errors: [
    {
      message: string,         // Error message
      count: number,           // Number of occurrences
      timestamp: string,       // ISO timestamp
      stackTrace: string,      // Stack trace (if available)
      samples: string[]        // Sample log messages
    }
  ],
  cloudwatchData: {            // ⭐ NEW: Pre-fetched CloudWatch data
    logs: {
      errorCount: number,      // Total error count
      errorRate: number,       // Error rate percentage
      topErrors: [],           // Top error patterns
      recentLogs: [],          // Recent log entries
      timeRange: {}            // Time range of analysis
    },
    fetchedAt: string          // When data was fetched
  },
  context: {
    githubRepo: string,        // GitHub repo (e.g., "myorg/myrepo")
    branch: string,            // Current git branch
    workspace: string,         // VSCode workspace path
    awsServices: string[],     // All discovered AWS services
    conversationHistory: []    // Last 5 chat messages for context
  }
}
```

## How Context is Gathered

### 1. Service Information
**Source**: `this._conversationContext.service`

Stored when a service is analyzed:
- `name`: From AWS service discovery
- `type`: Detected from service metadata (Lambda, ECS, EC2)
- `logGroupName`: User-provided or auto-detected
- `region`: AWS region

**Example**:
```json
{
  "name": "payment-processor",
  "type": "lambda",
  "logGroupName": "/aws/lambda/payment-processor",
  "region": "us-east-1"
}
```

### 2. Error Information
**Source**: `this._conversationContext.recentErrors`

Populated from CloudWatch log analysis:
- Top error patterns with counts
- Stack traces when available
- Recent timestamps

**Example**:
```json
[
  {
    "message": "ConditionalCheckFailedException",
    "count": 89,
    "timestamp": "2025-10-25T12:30:00Z",
    "stackTrace": "ConditionalCheckFailedException: The conditional request failed\n    at Request.extractError (/var/task/node_modules/aws-sdk/lib/protocol/json.js:52:27)\n    ..."
  },
  {
    "message": "Timeout waiting for response",
    "count": 23,
    "timestamp": "2025-10-25T12:35:00Z",
    "stackTrace": null
  }
]
```

### 3. GitHub Repository
**Source**: VSCode Git Extension API

Automatically extracted from workspace:
- Reads git remote URL from `.git/config`
- Parses GitHub repo name (e.g., `owner/repo`)
- Supports SSH and HTTPS formats

**Formats Supported**:
- SSH: `git@github.com:myorg/myrepo.git` → `myorg/myrepo`
- HTTPS: `https://github.com/myorg/myrepo.git` → `myorg/myrepo`
- HTTPS (no .git): `https://github.com/myorg/myrepo` → `myorg/myrepo`

**Example**:
```typescript
githubRepo: "tivra-ai/payment-service"
```

### 4. Current Branch
**Source**: VSCode Git Extension API

Gets the active git branch:
- Reads from Git HEAD
- Falls back to "main" if unavailable

**Example**:
```typescript
branch: "feature/retry-logic"
```

### 5. Workspace Path
**Source**: `vscode.workspace.workspaceFolders`

Absolute path to the workspace:
```typescript
workspace: "/Users/developer/projects/payment-service"
```

### 6. AWS Services
**Source**: `this._awsServices`

All AWS services discovered in the account:
```typescript
awsServices: [
  "payment-processor",
  "user-service",
  "notification-service",
  "database-rds"
]
```

### 7. CloudWatch Data (Pre-fetched) ⭐ NEW
**Source**: `this._errorAnalysisData`

Previously fetched CloudWatch logs and analysis:
- Stored when "Analyze Service" is run
- Includes all error patterns and log samples
- Avoids redundant CloudWatch API calls
- Timestamp of when data was fetched

**Example**:
```json
{
  "logs": {
    "errorCount": 112,
    "errorRate": 12.5,
    "topErrors": [
      {
        "message": "ConditionalCheckFailedException",
        "type": "ConditionalCheckFailedException",
        "count": 89,
        "samples": ["...", "...", "..."],
        "stackTrace": "..."
      }
    ],
    "recentLogs": [
      {
        "timestamp": 1729864800000,
        "message": "ERROR: Payment processing failed...",
        "severity": "ERROR"
      }
    ],
    "timeRange": {
      "start": 1729861200000,
      "end": 1729864800000
    }
  },
  "fetchedAt": "2025-10-25T12:30:00Z"
}
```

**Benefits**:
- ✅ Faster investigation (no CloudWatch API delay)
- ✅ Same data that user saw in analysis
- ✅ Consistent with initial RCA
- ✅ Fallback to fresh fetch if not available

### 8. Conversation History
**Source**: `this._conversationContext.conversationHistory`

Last 5 messages for context:
```json
[
  {
    "role": "user",
    "content": "Analyze payment-processor"
  },
  {
    "role": "assistant",
    "content": "Found 89 errors in payment-processor..."
  }
]
```

## Complete Example

```json
{
  "service": {
    "name": "payment-processor",
    "type": "lambda",
    "logGroupName": "/aws/lambda/payment-processor",
    "region": "us-east-1"
  },
  "errors": [
    {
      "message": "ConditionalCheckFailedException: The conditional request failed",
      "count": 89,
      "timestamp": "2025-10-25T12:30:00Z",
      "stackTrace": "ConditionalCheckFailedException: The conditional request failed\n    at Request.extractError (/var/task/node_modules/aws-sdk/lib/protocol/json.js:52:27)\n    at Request.callListeners (/var/task/node_modules/aws-sdk/lib/sequential_executor.js:106:20)\n    ...",
      "samples": [
        "Payment ID pay_123 failed: version mismatch",
        "Payment ID pay_456 failed: version mismatch",
        "Payment ID pay_789 failed: version mismatch"
      ]
    },
    {
      "message": "Timeout waiting for DynamoDB response",
      "count": 23,
      "timestamp": "2025-10-25T12:35:00Z",
      "stackTrace": null,
      "samples": []
    }
  ],
  "cloudwatchData": {
    "logs": {
      "errorCount": 112,
      "errorRate": 12.5,
      "topErrors": [
        {
          "message": "ConditionalCheckFailedException",
          "type": "ConditionalCheckFailedException",
          "count": 89,
          "samples": ["...", "...", "..."],
          "stackTrace": "..."
        }
      ],
      "recentLogs": [
        {
          "timestamp": 1729864800000,
          "message": "2025-10-25T12:00:00.123Z ERROR Payment processing failed...",
          "severity": "ERROR"
        }
      ]
    },
    "fetchedAt": "2025-10-25T12:25:00Z"
  },
  "context": {
    "githubRepo": "tivra-ai/payment-service",
    "branch": "main",
    "workspace": "/Users/developer/projects/payment-service",
    "awsServices": [
      "payment-processor",
      "user-service",
      "notification-service"
    ],
    "conversationHistory": [
      {
        "role": "user",
        "content": "Connect to AWS"
      },
      {
        "role": "assistant",
        "content": "Connected successfully. Found 3 services."
      },
      {
        "role": "user",
        "content": "Analyze payment-processor"
      },
      {
        "role": "assistant",
        "content": "Found 112 errors in last hour..."
      },
      {
        "role": "user",
        "content": "Trigger Investigation"
      }
    ]
  }
}
```

## How SRE Agent Uses This Context

### 1. CloudWatch Tool
Uses `service.logGroupName` and `service.region` to:
- Fetch detailed error logs
- Analyze error patterns
- Extract stack traces
- Build error timeline

### 2. Code Context Tool
Uses `context.githubRepo` and `context.branch` to:
- Get recent commits
- Analyze code changes
- Fetch file contents from stack traces
- Search for related code
- Get blame information

### 3. Deployment Tool
Uses `service.name` and `service.type` to:
- Get deployment history (ECS/EC2/Lambda)
- Correlate deployments with error timing
- Identify suspicious deployments
- Extract deployment metadata

### 4. Evidence Correlation
Combines all context to:
- Match error timestamps with deployment times
- Correlate code changes with error patterns
- Link stack traces to recent commits
- Build comprehensive evidence trail

## Benefits of Rich Context

### ✅ Better Root Cause Analysis
- Agent knows exactly where to look in code
- Can correlate errors with specific commits
- Understands deployment timeline

### ✅ More Accurate Fixes
- Knows the actual codebase structure
- Can suggest changes to specific files
- Understands recent code changes

### ✅ Faster Investigation
- No need to manually provide repo info
- Automatic context gathering
- Pre-filled with all necessary data

### ✅ Comprehensive Evidence
- Logs + Code + Deployments
- Cross-referenced timestamps
- Complete investigation trail

## Debugging Context Issues

### Missing GitHub Repo

**Symptom**: `githubRepo` is `undefined`

**Possible Causes**:
1. Not a git repository
2. No remote named "origin"
3. Not a GitHub repository

**Solution**:
```bash
# Check git remote
git remote -v

# Add GitHub remote
git remote add origin https://github.com/user/repo.git
```

### Missing Branch

**Symptom**: `branch` defaults to "main"

**Possible Causes**:
1. Detached HEAD state
2. Git extension not loaded

**Solution**:
```bash
# Check current branch
git branch

# Checkout a branch
git checkout main
```

### Empty Errors Array

**Symptom**: `errors: []`

**Possible Causes**:
1. No errors in CloudWatch
2. Service not analyzed yet

**Solution**:
- Run "Analyze AWS Service" first
- Check CloudWatch for actual errors

## Configuration

No configuration needed! Context is automatically gathered from:
- ✅ Stored service analysis results
- ✅ VSCode Git extension
- ✅ Workspace folders
- ✅ Conversation history

## Manual Override (Future)

In the future, you could add settings to override:

```json
{
  "tivra.defaultGitHubRepo": "myorg/myrepo",
  "tivra.defaultBranch": "develop",
  "tivra.includeConversationHistory": true
}
```

## Summary

The SRE Agent receives **comprehensive, automatically-gathered context** including:

1. **Service details** - Name, type, log group, region
2. **Error information** - Messages, counts, stack traces
3. **GitHub repository** - Auto-detected from git remote
4. **Current branch** - From git HEAD
5. **Workspace path** - For file references
6. **AWS services** - All discovered services
7. **Conversation history** - Recent context

This rich context enables the SRE Agent to perform **deep, evidence-based investigation** that correlates logs, code changes, and deployments to identify the true root cause with high confidence.
