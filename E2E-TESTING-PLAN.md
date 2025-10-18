# Tivra DebugMind v0.2.0-beta - E2E Testing Plan

## Overview
This document outlines the complete end-to-end testing plan for Tivra DebugMind v0.2.0-beta before publishing to the VS Code marketplace.

---

## Pre-Testing Checklist

### Backend Setup
- [ ] Ensure backend server is running at `https://copilot.tivra.ai`
- [ ] Verify backend has the `/api/aws/logs/analyze` endpoint implemented
- [ ] Confirm AWS credentials are properly configured on the backend
- [ ] Test backend health endpoint

### Test Environment
- [ ] Clean VS Code installation or test profile
- [ ] No previous versions of Tivra extensions installed
- [ ] AWS test account with CloudWatch logs available
- [ ] Sample application with error logs in CloudWatch

---

## E2E Testing Steps

### Phase 1: Installation & Activation

#### 1.1 Install Extension from VSIX
**Steps:**
1. Open VS Code
2. Press `Cmd+Shift+P` (Mac) or `Ctrl+Shift+P` (Windows/Linux)
3. Type "Extensions: Install from VSIX..."
4. Select `tivra-debugmind-0.2.0-beta.vsix`
5. Wait for installation to complete
6. Reload VS Code if prompted

**Expected Results:**
- Extension installs without errors
- Status bar shows "DebugMind" icon on the left
- Extension appears in Extensions view

#### 1.2 Verify Extension Activation
**Steps:**
1. Open Command Palette (`Cmd+Shift+P`)
2. Type "Tivra" to see all commands

**Expected Results:**
- Should see exactly 3 commands:
  - `Tivra: Connect to AWS`
  - `Tivra: Start Debugging`
  - `Tivra: Open DebugMind Copilot`

---

### Phase 2: AWS Connection

#### 2.1 Connect to AWS
**Steps:**
1. Click the "DebugMind" status bar item OR
2. Run `Tivra: Connect to AWS` from Command Palette
3. Enter AWS credentials when prompted:
   - AWS Access Key ID
   - AWS Secret Access Key
   - AWS Region (e.g., `us-east-1`)

**Expected Results:**
- Credentials are saved
- Success message appears
- Backend API can now access AWS CloudWatch

#### 2.2 Verify Connection
**Steps:**
1. Check VS Code Output panel for any errors
2. Try to start debugging (next phase)

**Expected Results:**
- No authentication errors
- Backend successfully connects to CloudWatch

---

### Phase 3: Copilot Chat Interface

#### 3.1 Open Copilot Panel
**Steps:**
1. Click "DebugMind" status bar item OR
2. Run `Tivra: Open DebugMind Copilot`

**Expected Results:**
- Copilot panel opens in a new VS Code tab
- Beautiful purple gradient header displays
- Shows "Tivra DebugMind" title
- Message input box at the bottom
- Empty messages area in the center

#### 3.2 Test Chat Functionality
**Steps:**
1. Type "Hello" in the message input
2. Press Enter or click Send
3. Type "What can you help me with?"
4. Send the message

**Expected Results:**
- Messages appear in the chat area
- User messages aligned to the right with blue background
- AI responses aligned to the left with gray background
- Conversation history is maintained
- Chat scrolls to the latest message

---

### Phase 4: Start Debugging Session

#### 4.1 Initialize Debugging
**Steps:**
1. Run `Tivra: Start Debugging` from Command Palette
2. Select or enter service name (e.g., "my-api-service")
3. Select service type (e.g., "Lambda", "ECS", "EC2")

**Expected Results:**
- Backend fetches recent error logs from CloudWatch
- Copilot panel opens automatically (if not already open)
- AI analyzes the errors and sends an initial message like:
  ```
  I've found 3 critical errors in your service over the last hour:

  1. TypeError: Cannot read property 'id' of undefined
     - Occurred 15 times
     - File: api/users.js:42

  2. Database connection timeout
     - Occurred 3 times

  Would you like me to investigate and suggest fixes?
  ```

#### 4.2 Interact with AI Analysis
**Steps:**
1. Reply "Yes, please investigate the TypeError"
2. Wait for AI response

**Expected Results:**
- AI provides root cause analysis
- AI suggests potential code fixes
- Messages are formatted with markdown (headers, code blocks, lists)

---

### Phase 5: Agentic Fix Application

#### 5.1 AI Generates Fix
**Steps:**
1. Ask the AI: "Can you fix the TypeError in api/users.js?"
2. Wait for AI to generate the fix

**Expected Results:**
- AI responds with a detailed explanation
- AI provides the fix in a code block
- AI offers to apply the fix automatically

#### 5.2 Review Diff Preview
**Steps:**
1. Click "Apply Fix" button (if shown in UI) OR
2. Confirm when AI asks "Would you like me to apply this fix?"

**Expected Results:**
- VS Code opens a diff view showing:
  - Left side: Current code
  - Right side: Proposed fix
- Diff is side-by-side with syntax highlighting
- Changes are clearly highlighted

#### 5.3 Apply Fix
**Steps:**
1. Review the diff carefully
2. Click "Apply" when prompted with the message:
   `Apply fix to api/users.js?`

**Expected Results:**
- File is automatically updated with the new code
- File is saved (or marked as dirty if auto-save is off)
- AI confirms: "Fix applied successfully!"
- Fix is tracked in conversation context

#### 5.4 Reject Fix
**Steps:**
1. Ask AI for another fix
2. When diff preview appears, click "Cancel"

**Expected Results:**
- File is NOT modified
- AI acknowledges: "Fix was not applied"
- Conversation continues normally

---

### Phase 6: Context Awareness

#### 6.1 Test Conversation History
**Steps:**
1. Ask: "What errors did we discuss earlier?"
2. Ask: "What fixes have we applied so far?"

**Expected Results:**
- AI recalls previous errors discussed
- AI lists all applied fixes with file paths
- Conversation context is maintained throughout the session

#### 6.2 Test Service Context
**Steps:**
1. Start debugging a different service
2. Ask: "What service am I currently debugging?"

**Expected Results:**
- AI correctly identifies the current service name and type
- AI switches context to the new service

---

### Phase 7: Error Handling

#### 7.1 Test Backend Connection Failure
**Steps:**
1. Temporarily disconnect from internet OR
2. Change API URL in settings to an invalid URL
3. Try to start debugging

**Expected Results:**
- User-friendly error message appears
- AI says: "I couldn't connect to the backend. Please check your connection."
- Extension doesn't crash

#### 7.2 Test Invalid AWS Credentials
**Steps:**
1. Enter incorrect AWS credentials
2. Try to start debugging

**Expected Results:**
- Error message: "AWS authentication failed. Please check your credentials."
- Copilot suggests re-running `Tivra: Connect to AWS`

#### 7.3 Test No Logs Found
**Steps:**
1. Debug a service with no error logs in the time range

**Expected Results:**
- AI responds: "No errors found in the last hour. Your service looks healthy!"
- No crashes or empty screens

---

### Phase 8: UI/UX Validation

#### 8.1 Visual Design
**Check:**
- [ ] Purple gradient header is beautiful and readable
- [ ] Message bubbles have proper spacing and padding
- [ ] Code blocks have syntax highlighting
- [ ] Scrolling is smooth
- [ ] Input box is always visible at the bottom
- [ ] Status indicator updates correctly

#### 8.2 Responsiveness
**Steps:**
1. Resize the copilot panel (drag the edge)
2. Send long messages
3. Receive messages with large code blocks

**Expected Results:**
- UI adapts to different panel sizes
- Long messages wrap properly
- Code blocks are scrollable if needed
- No horizontal scrollbar on main panel

---

### Phase 9: Performance Testing

#### 9.1 Load Testing
**Steps:**
1. Send 10 messages quickly in succession
2. Start debugging a service with 100+ error logs

**Expected Results:**
- UI remains responsive
- No lag or freezing
- Messages load progressively if needed

#### 9.2 Memory Usage
**Steps:**
1. Check VS Code's Task Manager (`Cmd+Shift+P` > "Developer: Open Process Explorer")
2. Note memory usage before and after opening copilot

**Expected Results:**
- Memory increase is reasonable (<50MB)
- No memory leaks over time

---

## VS Code Marketplace Publishing

### Pre-Publishing Checklist

#### 1. Update Repository Information
- [ ] Ensure `package.json` has `repository` field pointing to GitHub
- [ ] Add `publisher` field to `package.json`
- [ ] Update `icon` path in `package.json` (must be 128x128 PNG)
- [ ] Add `categories` (currently "Machine Learning")
- [ ] Add `keywords` for discoverability

#### 2. Create Publishing Assets

**Required:**
- [ ] **README.md** - Comprehensive with:
  - Screenshots/GIFs of the copilot in action
  - Installation instructions
  - Quick start guide
  - Feature list
  - Configuration options
- [ ] **CHANGELOG.md** - Version history
- [ ] **LICENSE.txt** - Already exists
- [ ] **Extension Icon** - 128x128 PNG in `media/` folder

**Optional but Recommended:**
- [ ] Demo video (GIF or YouTube link)
- [ ] Comparison with other debugging tools
- [ ] FAQ section

#### 3. Create Publisher Account
**Steps:**
1. Go to https://marketplace.visualstudio.com/manage
2. Sign in with Microsoft account
3. Create a new publisher (if you don't have one)
4. Note your publisher ID (e.g., "tivra-ai" or "shrey2525")

#### 4. Update package.json
**Required fields:**
```json
{
  "name": "tivra-debugmind",
  "publisher": "your-publisher-id",
  "repository": {
    "type": "git",
    "url": "https://github.com/shrey2525/tivra-copilot-vscode.git"
  },
  "icon": "media/icon.png",
  "galleryBanner": {
    "color": "#667eea",
    "theme": "dark"
  },
  "keywords": [
    "debugging",
    "aws",
    "cloudwatch",
    "ai",
    "copilot",
    "logs",
    "error-analysis"
  ]
}
```

#### 5. Generate Personal Access Token
**Steps:**
1. Go to https://dev.azure.com/
2. Create an organization (if needed)
3. Go to User Settings > Personal Access Tokens
4. Click "New Token"
5. Name: "VS Code Marketplace"
6. Organization: "All accessible organizations"
7. Scopes: **Marketplace > Manage**
8. Copy and save the token securely

#### 6. Publish Commands

**First-time publish:**
```bash
cd /Users/sansy/Documents/Tivra-AI/tivra-copilot-vscode

# Login with your PAT
npx @vscode/vsce login your-publisher-id

# Publish to marketplace
npx @vscode/vsce publish
```

**Update existing extension:**
```bash
# Increment version and publish
npx @vscode/vsce publish patch  # 0.2.0 -> 0.2.1
# or
npx @vscode/vsce publish minor  # 0.2.0 -> 0.3.0
# or
npx @vscode/vsce publish major  # 0.2.0 -> 1.0.0
```

**Publish specific version:**
```bash
npx @vscode/vsce publish 0.2.0
```

#### 7. Post-Publishing
- [ ] Verify extension appears on marketplace
- [ ] Test installation from marketplace (not VSIX)
- [ ] Check ratings and reviews
- [ ] Monitor download statistics
- [ ] Set up GitHub Issues for bug reports
- [ ] Create discussion board for feature requests

---

## Test Results Log

### Test Date: ___________
### Tester: ___________

| Phase | Test Case | Status | Notes |
|-------|-----------|--------|-------|
| 1.1 | Install from VSIX | ⬜ Pass ⬜ Fail | |
| 1.2 | Extension activation | ⬜ Pass ⬜ Fail | |
| 2.1 | AWS connection | ⬜ Pass ⬜ Fail | |
| 3.1 | Open copilot | ⬜ Pass ⬜ Fail | |
| 3.2 | Chat functionality | ⬜ Pass ⬜ Fail | |
| 4.1 | Start debugging | ⬜ Pass ⬜ Fail | |
| 4.2 | AI analysis | ⬜ Pass ⬜ Fail | |
| 5.1 | Generate fix | ⬜ Pass ⬜ Fail | |
| 5.2 | Diff preview | ⬜ Pass ⬜ Fail | |
| 5.3 | Apply fix | ⬜ Pass ⬜ Fail | |
| 6.1 | Conversation history | ⬜ Pass ⬜ Fail | |
| 7.1 | Backend failure | ⬜ Pass ⬜ Fail | |
| 8.1 | UI design | ⬜ Pass ⬜ Fail | |
| 9.1 | Performance | ⬜ Pass ⬜ Fail | |

---

## Known Issues & Limitations (v0.2.0-beta)

1. **Backend Dependency** - Requires backend server at copilot.tivra.ai
2. **AWS Only** - Only supports AWS CloudWatch (GCP, Azure coming in v2.0)
3. **Logs Only** - No metrics or traces yet (planned for v2.0)
4. **Single File Fixes** - Can only apply fixes to one file at a time
5. **Manual Service Selection** - No auto-discovery of services yet

---

## Success Criteria

The extension is ready for marketplace publishing when:

- [ ] All Phase 1-6 tests pass
- [ ] No critical bugs in Phase 7 error handling
- [ ] UI/UX meets design standards (Phase 8)
- [ ] Performance is acceptable (Phase 9)
- [ ] README has screenshots and clear instructions
- [ ] Publisher account is created and verified
- [ ] Personal Access Token is generated
- [ ] package.json has all required fields
- [ ] Icon file exists and looks good

---

## Rollback Plan

If critical issues are found after publishing:

1. **Unpublish immediately:**
   ```bash
   npx @vscode/vsce unpublish your-publisher-id.tivra-debugmind 0.2.0-beta
   ```

2. **Mark as deprecated** (if users already installed):
   - Update description to say "DEPRECATED - Use v0.2.1 instead"
   - Publish fixed version as 0.2.1-beta

3. **Notify users:**
   - Update GitHub README
   - Post issue on GitHub
   - Update marketplace description

---

## Next Steps After Publishing

1. **Marketing:**
   - Post on Reddit (r/vscode, r/aws)
   - Tweet announcement
   - LinkedIn post
   - Dev.to article

2. **Monitoring:**
   - Set up error tracking (Sentry/LogRocket)
   - Monitor GitHub Issues
   - Track download statistics

3. **Iterate:**
   - Gather user feedback
   - Plan v0.3.0 features
   - Work towards v1.0.0 (stable release)
