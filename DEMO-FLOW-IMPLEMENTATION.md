# Tivra DebugMind v1.0 - Demo Flow Implementation

## Target Demo Flow

```
1. User opens "Tivra DebugMind"
   → Shows: "Connect to AWS to see Tivra in action"

2. User clicks "Connect me to AWS"
   → 3-step credential input

3. AWS Connected
   → Shows: "AWS Connected ✅ | Live monitoring enabled"
   → Automatically starts polling for errors

4. Error Detected (automatic)
   → Shows: "🚨 Error detected in [service]!"
   → Displays error details
   → Shows suggested fix with "Apply Fix" button

5. User clicks "Apply Fix"
   → Diff preview opens
   → User confirms
   → Fix applied agentically
   → Shows: "✅ Fix applied!"
```

## Implementation Changes Needed

### 1. Add Automatic Monitoring After AWS Connection

**File**: `src/panels/debugCopilot.ts`

**Add monitoring state**:
```typescript
private _monitoringInterval: NodeJS.Timeout | null = null;
private _isMonitoring: boolean = false;
```

**After AWS connection success**:
```typescript
if (response.data.success) {
  this.addMessage({
    type: 'ai',
    content: `**AWS Connected** ✅\n\nLive monitoring enabled.\n\nWatching for errors...`,
    timestamp: new Date()
  });

  // Start automatic monitoring
  await this.startAutomaticMonitoring();
}
```

**Add monitoring method**:
```typescript
private async startAutomaticMonitoring() {
  this._isMonitoring = true;

  // Poll every 10 seconds for demo
  this._monitoringInterval = setInterval(async () => {
    await this.checkForErrors();
  }, 10000);

  this.addMessage({
    type: 'system',
    content: '🔄 Monitoring AWS services...',
    timestamp: new Date()
  });
}

private async checkForErrors() {
  try {
    // Check for errors in known services
    // For demo, you can hardcode a service name or discover services
    const response = await axios.post(`${this._apiUrl}/api/aws/logs/analyze`, {
      serviceName: 'demo-service', // Or discover dynamically
      serviceType: 'Lambda',
      timeRange: {
        start: Date.now() - 60000, // Last 1 minute
        end: Date.now()
      }
    });

    if (response.data.totalErrors > 0) {
      // Error detected!
      this.handleDetectedError(response.data);

      // Stop monitoring after first error (for demo)
      this.stopMonitoring();
    }
  } catch (error) {
    console.error('Monitoring error:', error);
  }
}

private async handleDetectedError(errorData: any) {
  this.addMessage({
    type: 'ai',
    content: `🚨 **Error Detected!**\n\n` +
      `Service: ${errorData.serviceName}\n` +
      `Errors: ${errorData.totalErrors}\n\n` +
      `Analyzing and generating fix...`,
    timestamp: new Date()
  });

  // Ask Claude to generate a fix
  const fixResponse = await axios.post(`${this._apiUrl}/api/chat`, {
    message: `Generate a fix for this error: ${JSON.stringify(errorData.errors[0])}`,
    context: {
      recentErrors: errorData.errors,
      conversationHistory: []
    }
  });

  const { response, suggestedFix } = fixResponse.data;

  this.addMessage({
    type: 'ai',
    content: response,
    timestamp: new Date(),
    suggestedFix: suggestedFix
  });
}

private stopMonitoring() {
  if (this._monitoringInterval) {
    clearInterval(this._monitoringInterval);
    this._monitoringInterval = null;
  }
  this._isMonitoring = false;
}

public dispose() {
  this.stopMonitoring();
  // ... rest of dispose
}
```

### 2. Change Purple Theme to Blue

**File**: `src/panels/debugCopilot.ts`

Find all purple color references and change to blue:

**Purple → Blue:**
```css
/* OLD Purple Theme */
background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
background: rgba(102, 126, 234, 0.1);
border: 1px solid rgba(102, 126, 234, 0.3);

/* NEW Blue Theme (Tivra Blue) */
background: linear-gradient(135deg, #1e90ff 0%, #0066cc 100%);
background: rgba(30, 144, 255, 0.1);
border: 1px solid rgba(30, 144, 255, 0.3);
```

**All replacements**:
1. Line ~417: `.header` gradient → `#1e90ff 0%, #0066cc 100%`
2. Line ~587: `.fix-button` gradient → `#1e90ff 0%, #0066cc 100%`
3. Line ~625: `#sendButton` gradient → `#1e90ff 0%, #0066cc 100%`
4. Line ~614: `.prompt-button` background → `rgba(30, 144, 255, 0.1)`
5. Line ~615: `.prompt-button` border → `rgba(30, 144, 255, 0.3)`
6. Line ~624: `.prompt-button:hover` background → `rgba(30, 144, 255, 0.2)`
7. Line ~625: `.prompt-button:hover` border → `rgba(30, 144, 255, 0.5)`

### 3. Update Logo

**File**: `src/panels/debugCopilot.ts`

**Current**:
```html
<div class="header">
  <span>🤖</span>
  <div>
    <h2>Tivra DebugMind</h2>
```

**Change to**:
```html
<div class="header">
  <img src="${logoUri}" alt="Tivra Logo" class="logo" />
  <div>
    <h2>DebugMind</h2>
```

**Add logo URI in method**:
```typescript
private _getHtmlForWebview(webview: vscode.Webview, extensionUri: vscode.Uri) {
  const logoPath = vscode.Uri.joinPath(extensionUri, 'media', 'logo.png');
  const logoUri = webview.asWebviewUri(logoPath);

  return `<!DOCTYPE html>
  ...
```

**Add CSS for logo**:
```css
.logo {
  width: 32px;
  height: 32px;
  border-radius: 4px;
}
```

### 4. Simplified Initial Message

**Not Connected**:
```
Connect to AWS to see Tivra DebugMind in action.

[Connect me to AWS]
```

**Connected + Monitoring**:
```
AWS Connected ✅

Live monitoring enabled.

Watching for errors...
```

## Quick Implementation Script

Run these find-and-replace commands:

```bash
# Change purple to blue
sed -i '' 's/#667eea/#1e90ff/g' src/panels/debugCopilot.ts
sed -i '' 's/#764ba2/#0066cc/g' src/panels/debugCopilot.ts
sed -i '' 's/rgba(102, 126, 234/rgba(30, 144, 255/g' src/panels/debugCopilot.ts
```

## Testing the Demo Flow

1. **Start backend**: Ensure server running on port 3001
2. **Install extension**: Install the VSIX
3. **Open copilot**: Run "Tivra DebugMind" command
4. **Connect AWS**: Enter test credentials
5. **Wait**: Monitoring will auto-detect errors within 10 seconds
6. **See fix**: AI generates fix automatically
7. **Apply**: Click "Apply Fix" button
8. **Done**: Fix applied agentically!

## Files to Modify

1. `src/panels/debugCopilot.ts` - Main logic (add monitoring, change colors, update logo)
2. `media/logo.png` - Add Tivra logo (already copied)
3. `package.json` - Update version to 1.0.0 when ready

## Estimated Time

- Monitoring logic: 30 min
- Theme changes: 10 min
- Logo update: 5 min
- Testing: 15 min
**Total: ~1 hour**
