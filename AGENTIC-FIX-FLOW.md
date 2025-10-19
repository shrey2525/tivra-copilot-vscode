# Tivra DebugMind - Agentic Fix Flow Documentation

## Overview

This document explains the complete end-to-end flow of how Tivra DebugMind detects errors, generates fixes, and applies them agentically to your IDE.

---

## Complete Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│ 1. User Opens Tivra DebugMind (Cmd+Shift+P → "Tivra DebugMind") │
└────────────────────┬────────────────────────────────────────────┘
                     │
                     ▼
          ┌──────────────────────┐
          │ Check AWS Connection │
          └──────────┬───────────┘
                     │
        ┌────────────┴────────────┐
        │                         │
        ▼                         ▼
┌──────────────┐          ┌──────────────┐
│   Connected  │          │ Not Connected│
└──────┬───────┘          └──────┬───────┘
       │                         │
       ▼                         ▼
┌─────────────────┐      ┌─────────────────────┐
│ Show features & │      │ Start AWS Connection│
│ example prompts │      │   Flow (3 steps)    │
└─────────────────┘      └──────┬──────────────┘
                                │
                                ▼
                  ┌─────────────────────────────┐
                  │ Step 1: AWS Access Key ID   │
                  │ Step 2: AWS Secret Key      │
                  │ Step 3: AWS Region          │
                  └──────────┬──────────────────┘
                             │
                             ▼
                  ┌─────────────────────┐
                  │ Connected to AWS ✅  │
                  └──────────┬──────────┘
                             │
┌────────────────────────────┴────────────────────────────┐
│ 2. User Asks to Analyze Errors                          │
│    e.g., "Show me recent errors in my Lambda functions" │
└────────────────────────┬────────────────────────────────┘
                         │
                         ▼
              ┌─────────────────────┐
              │ Backend fetches     │
              │ CloudWatch Logs     │
              │ via AWS SDK         │
              └──────────┬──────────┘
                         │
                         ▼
              ┌──────────────────────┐
              │ Errors found?        │
              └────┬────────────┬────┘
                   │ YES        │ NO
                   ▼            ▼
         ┌──────────────┐  ┌─────────────┐
         │ AI analyzes  │  │ "No errors  │
         │ with Claude  │  │  found! ✅" │
         └──────┬───────┘  └─────────────┘
                │
                ▼
    ┌───────────────────────────┐
    │ Show error summary in chat│
    │ - Error message           │
    │ - Occurrences count       │
    │ - Time last seen          │
    │ - Stack trace (if any)    │
    └───────────┬───────────────┘
                │
┌───────────────┴────────────────────────────┐
│ 3. User Asks for Fix                       │
│    e.g., "Can you fix the TypeError?"      │
└───────────────┬────────────────────────────┘
                │
                ▼
     ┌──────────────────────┐
     │ Claude AI generates: │
     │ 1. Root cause        │
     │ 2. Fix explanation   │
     │ 3. New code          │
     │ 4. File path         │
     └──────────┬───────────┘
                │
                ▼
    ┌────────────────────────┐
    │ Display in copilot:    │
    │ - Fix explanation      │
    │ - "Apply Fix" button   │
    └──────────┬─────────────┘
                │
┌───────────────┴──────────────────────┐
│ 4. User Clicks "Apply Fix" Button    │
└───────────────┬──────────────────────┘
                │
                ▼
       ┌──────────────────┐
       │ VS Code opens    │
       │ DIFF PREVIEW     │
       │                  │
       │ [Old Code] | [New Code with Fix] │
       │                  │
       │ Side-by-side comparison           │
       └──────────┬───────┘
                  │
                  ▼
      ┌────────────────────────┐
      │ Confirmation Popup:    │
      │ "Apply fix to file?"   │
      │ [Apply] [Cancel]       │
      └──────┬────────┬────────┘
             │        │
        [Apply]    [Cancel]
             │        │
             ▼        ▼
    ┌────────────┐  ┌─────────────┐
    │ Apply fix  │  │ Close diff, │
    │ to file    │  │ no changes  │
    │ Save file  │  └─────────────┘
    └──────┬─────┘
           │
           ▼
┌──────────────────────────┐
│ 5. Fix Applied ✅         │
│ - File updated           │
│ - Changes saved          │
│ - Copilot confirms       │
└──────────────────────────┘
```

---

## Detailed Step-by-Step Implementation

### Step 1: AWS Connection Check

**File**: `src/panels/debugCopilot.ts:55-85`

```typescript
private async showWelcomeMessage() {
  try {
    const statusResponse = await axios.get(`${this._apiUrl}/api/aws/status`);
    const isConnected = statusResponse.data?.connected || false;

    if (isConnected) {
      // Show connected message with features
    } else {
      // Show AWS connection setup instructions
    }
  } catch (error) {
    // Show generic welcome
  }
}
```

**What happens:**
- Extension checks AWS connection status via backend `/api/aws/status`
- Shows different welcome messages based on connection state
- If not connected, prompts user to connect via chat

---

### Step 2: Error Detection & Analysis

**Backend Endpoint**: `/api/aws/logs/analyze`
**Backend File**: `server/routes/aws.js:321`

```javascript
router.post('/analyze', async (req, res) => {
  const { serviceName, serviceType, timeRange } = req.body;

  // Fetch CloudWatch logs
  const logs = await cloudWatchLogs.filterLogEvents({
    logGroupName: `/aws/${serviceType}/${serviceName}`,
    startTime: timeRange.start,
    endTime: timeRange.end,
    filterPattern: '?ERROR ?Error ?Exception'
  });

  // Group and count errors
  const errors = processErrors(logs.events);

  return res.json({
    serviceName,
    serviceType,
    totalErrors: errors.length,
    errors: errors
  });
});
```

**Frontend**: `src/panels/debugCopilot.ts:223-285`

```typescript
public async startDebugging(serviceName: string, serviceType: string) {
  const response = await axios.post(`${this._apiUrl}/api/aws/logs/analyze`, {
    serviceName,
    serviceType,
    timeRange: {
      start: Date.now() - 60 * 60 * 1000, // Last 1 hour
      end: Date.now()
    }
  });

  const analysis = response.data;

  if (analysis.totalErrors === 0) {
    this.addMessage({
      type: 'ai',
      content: `✅ Good news! No errors found in **${serviceName}**`
    });
  } else {
    // AI analyzes errors with Claude
    await this.analyzeErrorsWithAI(analysis);
  }
}
```

**What happens:**
- User asks to analyze a service (e.g., "Show me errors in my Lambda function")
- Backend fetches CloudWatch logs for that service
- Filters for ERROR/Exception patterns
- Groups duplicate errors
- Counts occurrences
- Returns structured error data

---

### Step 3: AI-Powered Error Analysis

**Backend Endpoint**: `/api/chat`
**Backend File**: `server/routes/chat.js:122-272`

```javascript
router.post('/', async (req, res) => {
  const { message, context } = req.body;

  // Build context with recent errors
  let contextInfo = '';
  if (context?.recentErrors) {
    contextInfo += `\n\nRecent Errors: ${JSON.stringify(context.recentErrors)}`;
  }

  // Call Claude AI
  const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': CLAUDE_API_KEY,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: 'claude-3-5-haiku-20241022',
      max_tokens: 4096,
      system: SYSTEM_PROMPT, // Expert debugging copilot
      messages: [
        ...conversationHistory,
        {
          role: 'user',
          content: message + contextInfo
        }
      ]
    })
  });

  const data = await claudeRes.json();

  return res.json({
    response: data.content[0].text,
    suggestedFix: extractFixIfPresent(data.content[0].text)
  });
});
```

**Frontend**: `src/panels/debugCopilot.ts:407-467`

```typescript
private async handleUserMessage(text: string) {
  // Send to Claude AI with full context
  const aiResponse = await axios.post(`${this._apiUrl}/api/chat`, {
    message: text,
    context: {
      service: this._conversationContext.service,
      recentErrors: this._conversationContext.recentErrors,
      appliedFixes: this._conversationContext.appliedFixes,
      conversationHistory: this._conversationContext.conversationHistory
    }
  });

  const { response, suggestedFix } = aiResponse.data;

  // Display AI response
  this.updateLastMessage({
    type: 'ai',
    content: response,
    suggestedFix: suggestedFix // Contains { filePath, newCode, explanation }
  });
}
```

**What happens:**
- User's question + error context sent to Claude AI
- Claude analyzes the error with full context:
  - Error message
  - Stack trace
  - Service type
  - Previous conversation
- Claude generates:
  - Root cause explanation
  - Fix suggestion
  - Complete new code
  - File path where fix should be applied

---

### Step 4: Fix Generation & Suggestion

**Response Format from Claude**:

```json
{
  "response": "I found the issue! The TypeError occurs because the user object is null when accessing user.id. Here's the fix:\n\n...",
  "suggestedFix": {
    "filePath": "/path/to/api/users.js",
    "newCode": "async function getUser(req, res) {\n  const user = await User.findById(req.params.id);\n  if (!user) {\n    return res.status(404).json({ error: 'User not found' });\n  }\n  return res.json({ id: user.id, name: user.name });\n}",
    "explanation": "Added null check to prevent TypeError"
  }
}
```

**Frontend Rendering**: `src/panels/debugCopilot.ts:692-701`

```typescript
if (msg.suggestedFix) {
  html += `<div class="fix-actions">
    <button class="fix-button" onclick='applyFix(${JSON.stringify(msg.suggestedFix)})'>
      ✨ Apply Fix
    </button>
    <button class="fix-button secondary" onclick="rejectFix()">
      Not Now
    </button>
  </div>`;
}
```

**What happens:**
- Copilot displays the AI's explanation
- Shows clickable "Apply Fix" button
- Button contains the complete fix data (file path + new code)

---

### Step 5: Agentic Fix Application

**File**: `src/panels/debugCopilot.ts:502-588`

```typescript
private async applyFix(fix: CodeFix) {
  try {
    // 1. Get file URI
    const uri = vscode.Uri.file(fix.filePath);

    // 2. Open the file (or create if doesn't exist)
    let document = await vscode.workspace.openTextDocument(uri);

    // 3. Create temporary document with proposed fix
    const tempUri = vscode.Uri.parse(`untitled:${fix.filePath}.proposed`);
    const edit = new vscode.WorkspaceEdit();
    edit.insert(tempUri, new vscode.Position(0, 0), fix.newCode);
    await vscode.workspace.applyEdit(edit);

    // 4. Show SIDE-BY-SIDE DIFF
    await vscode.commands.executeCommand(
      'vscode.diff',
      uri,              // Left: Original file
      tempUri,          // Right: Proposed fix
      `${fix.filePath.split('/').pop()} - Proposed Fix`
    );

    // 5. Ask for user confirmation
    const choice = await vscode.window.showInformationMessage(
      `Apply fix to ${fix.filePath}?`,
      'Apply',
      'Cancel'
    );

    if (choice === 'Apply') {
      // 6. Apply the fix
      const fullRange = new vscode.Range(
        document.positionAt(0),
        document.positionAt(document.getText().length)
      );
      const finalEdit = new vscode.WorkspaceEdit();
      finalEdit.replace(uri, fullRange, fix.newCode);
      await vscode.workspace.applyEdit(finalEdit);

      // 7. Save the file
      await document.save();

      // 8. Track the fix
      this._conversationContext.appliedFixes.push({
        filePath: fix.filePath,
        timestamp: new Date()
      });

      // 9. Confirm in chat
      this.addMessage({
        type: 'ai',
        content: `✅ Fix applied to **${fix.filePath}**! The changes should resolve the error.`
      });
    } else {
      // User canceled
      this.addMessage({
        type: 'system',
        content: `Fix not applied.`
      });
    }
  } catch (error) {
    this.addMessage({
      type: 'system',
      content: `❌ Failed to apply fix: ${error.message}`
    });
  }
}
```

**What happens:**

1. **Get File**: Opens the target file in VS Code
2. **Create Temp Doc**: Creates a temporary document with the proposed fix
3. **Show Diff**: Opens side-by-side diff viewer
   - Left: Current code
   - Right: Proposed fix
   - User can review every change line-by-line
4. **User Confirmation**: Shows popup asking to apply or cancel
5. **Apply Fix**: If user clicks "Apply":
   - Replaces entire file content with new code
   - Saves the file
   - Tracks fix in conversation context
   - Shows success message in copilot
6. **Cancel**: If user clicks "Cancel":
   - Closes diff viewer
   - No changes made
   - Shows cancellation message

---

## User Experience Flow

### Example Scenario: TypeError in Lambda Function

**Step 1: User opens copilot**
```
User: Opens "Tivra DebugMind"
Copilot: "Welcome! Please connect to AWS..."
```

**Step 2: Connect to AWS**
```
User: Clicks "Connect me to AWS"
Copilot: "Step 1 of 3: Enter AWS Access Key ID"
User: Enters key
Copilot: "Step 2 of 3: Enter Secret Key"
User: Enters secret
Copilot: "Step 3 of 3: Choose region"
User: Clicks "us-east-1"
Copilot: "🎉 Successfully connected to AWS!"
```

**Step 3: Ask for error analysis**
```
User: "Show me recent errors in my getUserById Lambda function"
Copilot: "🔍 Analyzing errors in getUserById..."
Copilot: "I found 15 errors in the last hour:

**1. TypeError: Cannot read property 'id' of null**
- Occurred: 15 times
- Last seen: 2 minutes ago
- File: src/api/users.js:42

This happens when the user object is null..."
```

**Step 4: Request fix**
```
User: "Can you fix this TypeError?"
Copilot: "I can fix this! The issue is that we're not checking if the user exists before accessing user.id.

Here's the fix:

```javascript
async function getUserById(req, res) {
  const user = await User.findById(req.params.id);

  // Added null check
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  return res.json({
    id: user.id,
    name: user.name
  });
}
```

[Apply Fix] [Not Now]"
```

**Step 5: User clicks "Apply Fix"**

*VS Code opens diff viewer:*

```
src/api/users.js - Proposed Fix

OLD CODE                           NEW CODE
─────────────────────────────────────────────────
async function getUserById(...) { | async function getUserById(...) {
  const user = await User...      |   const user = await User...
                                  |
                                  |   if (!user) {
                                  |     return res.status(404)...
                                  |   }
                                  |
  return res.json({               |   return res.json({
    id: user.id,                  |     id: user.id,
    name: user.name               |     name: user.name
  });                             |   });
}                                 | }
```

*Popup appears:*
```
╔═══════════════════════════════╗
║  Apply fix to src/api/users.js?  ║
║                               ║
║  [Apply]  [Cancel]            ║
╚═══════════════════════════════╝
```

**Step 6: User clicks "Apply"**

```
Copilot: "✅ Fix applied to src/api/users.js!

The changes should resolve the TypeError. The function now:
1. Checks if user exists before accessing properties
2. Returns proper 404 error if not found
3. Prevents null pointer exceptions

Would you like me to:
- Verify the fix works
- Check for similar issues in other files
- Help with testing"
```

---

## Backend API Endpoints

### 1. AWS Status Check
```
GET /api/aws/status
Response: { connected: true/false, region: "us-east-1" }
```

### 2. AWS Connection
```
POST /api/aws/connect
Body: { accessKeyId, secretAccessKey, region }
Response: { success: true, region: "us-east-1" }
```

### 3. Log Analysis
```
POST /api/aws/logs/analyze
Body: { serviceName, serviceType, timeRange: { start, end } }
Response: {
  serviceName: "getUserById",
  totalErrors: 15,
  errors: [
    {
      message: "TypeError: Cannot read property 'id' of null",
      timestamp: "2025-10-19T01:30:00Z",
      count: 15,
      stackTrace: "..."
    }
  ]
}
```

### 4. Chat with Claude AI
```
POST /api/chat
Body: {
  message: "Can you fix this TypeError?",
  context: {
    service: { name: "getUserById", type: "Lambda" },
    recentErrors: [...],
    conversationHistory: [...]
  }
}
Response: {
  response: "I can fix this! Here's what's wrong...",
  suggestedFix: {
    filePath: "/path/to/file.js",
    newCode: "...",
    explanation: "..."
  }
}
```

---

## Code Interfaces

### ChatMessage Interface
```typescript
interface ChatMessage {
  type: 'user' | 'ai' | 'system';
  content: string;
  timestamp: Date;
  suggestedFix?: CodeFix;
  suggestedPrompts?: string[];
  isTyping?: boolean;
}
```

### CodeFix Interface
```typescript
interface CodeFix {
  filePath: string;
  newCode: string;
  explanation: string;
}
```

### ConversationContext Interface
```typescript
interface ConversationContext {
  service: { name: string; type: string } | null;
  recentErrors: any[];
  appliedFixes: Array<{ filePath: string; timestamp: Date }>;
  conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }>;
}
```

---

## Testing Checklist

### ✅ Manual Testing Steps

1. **AWS Connection**
   - [ ] Open copilot shows "AWS Not Connected" message
   - [ ] Click "Connect me to AWS" prompt
   - [ ] Enter Access Key ID → proceeds to step 2
   - [ ] Enter Secret Key → proceeds to step 3
   - [ ] Select region → shows success message
   - [ ] Verify connection status stored

2. **Error Detection**
   - [ ] Ask "Show me errors in [service]"
   - [ ] Backend fetches CloudWatch logs
   - [ ] Errors displayed in chat with count and timestamp
   - [ ] No errors shows "No errors found ✅" message

3. **Fix Generation**
   - [ ] Ask "Can you fix this error?"
   - [ ] Claude AI generates root cause analysis
   - [ ] Fix suggestion appears with code block
   - [ ] "Apply Fix" button is clickable

4. **Diff Preview**
   - [ ] Click "Apply Fix" button
   - [ ] VS Code opens diff viewer
   - [ ] Left side shows original code
   - [ ] Right side shows fixed code
   - [ ] Changes are highlighted
   - [ ] Confirmation popup appears

5. **Fix Application**
   - [ ] Click "Apply" in popup
   - [ ] File content updates
   - [ ] File is saved
   - [ ] Copilot confirms success
   - [ ] Fix tracked in context

6. **Fix Rejection**
   - [ ] Click "Cancel" in popup
   - [ ] Diff viewer closes
   - [ ] No changes to file
   - [ ] Copilot acknowledges cancellation

---

## Known Limitations (v0.2.1-beta)

1. **Single File Fixes Only** - Can only apply fixes to one file at a time
2. **Full File Replacement** - Replaces entire file content (not line-by-line patches)
3. **No Undo** - Must use Git to revert changes
4. **AWS Only** - Only supports AWS CloudWatch (GCP/Azure in v2.0)
5. **Manual Service Selection** - No auto-discovery of AWS services yet

---

## Future Enhancements (Roadmap)

### v0.2.2
- **Continuous log streaming** - Real-time error detection
- **Proactive debugging** - Auto-notify when errors appear
- **Multi-file fixes** - Apply fixes across multiple files

### v0.3.0
- **Line-by-line patches** - Surgical code edits instead of full file replacement
- **Undo/Redo** - Built-in rollback for fixes
- **Service auto-discovery** - Automatically detect AWS services
- **Test generation** - Generate unit tests for fixes

### v1.0
- **GCP & Azure support** - Multi-cloud debugging
- **Metrics & traces** - Full observability stack
- **PR creation** - Automatically create GitHub PRs with fixes
- **Team collaboration** - Share debugging sessions

---

## Support & Feedback

- **GitHub Issues**: https://github.com/shrey2525/tivra-copilot-vscode/issues
- **Documentation**: https://github.com/shrey2525/tivra-copilot-vscode#readme
- **Email**: info@tivra.ai
