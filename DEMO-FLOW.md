# Tivra DebugMind - Demo Recording Flow

## Pre-Demo Setup

### 1. Backend Server
```bash
cd /Users/sansy/Documents/Tivra-AI/tivra-copilot/server
node index.js
```
**Status:** Server should be running on `http://localhost:3001` with **USE_MOCK_DATA=true**

### 2. VSCode Extension Settings
Add to your VSCode `settings.json`:
```json
{
  "tivra.apiUrl": "http://localhost:3001"
}
```

### 3. Open a Workspace
- Open any folder in VSCode (this will be where the fix is applied)
- The demo will create `src/lambda/payment-processor/index.js` with the fix

---

## Demo Script (Automated Flow)

### **Step 1: Open Tivra DebugMind**
- Press `Cmd+Shift+P` → Type "Tivra DebugMind: Open Copilot"
- Panel opens on the right side

**What You'll See:**
```
AWS Not Connected ⚠️

Connect to AWS to start debugging.

[Connect me to AWS]
```

---

### **Step 2: Connect to AWS**
- Click the suggested prompt: **"Connect me to AWS"**
- Enter mock credentials:
  - **Access Key:** `MOCK_ACCESS_KEY` (or anything)
  - **Secret Key:** `MOCK_SECRET_KEY` (or anything)
  - **Region:** `us-east-1`

**What You'll See:**
```
AWS Connected ✅

Region: us-east-1

Fetching AWS services...
```

---

### **Step 3: Services Discovered (Immediate)**

**What You'll See:**
```
AWS Services Found ✅

• payment-processor (lambda)
• order-service (ecs)
• notification-sender (lambda)

Live monitoring enabled. Watching for errors...
```

---

### **Step 4: Auto Error Detection (After 2 Seconds)**

**What You'll See:**
```
🔍 Analyzing services for errors...
```

Then:
```
⚠️ Errors Detected!

Service: payment-processor (Lambda)
Error Rate: 12.5%
Total Errors: 145 in last hour

Root Cause:
DynamoDB conditional check failures causing 61% of errors

Top Recommendation:
Add retry logic with exponential backoff

Generating code fix...
```

---

### **Step 5: Code Fix Generated (After 1 Second)**

**What You'll See:**
```
✨ Code Fix Generated!

Fix: Add retry logic with exponential backoff

Impact: Reduce error rate from 12.5% to <1%

```javascript
// Add retry logic with exponential backoff for DynamoDB operations

async function processPaymentWithRetry(paymentData, maxRetries = 3) {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      // Process payment with DynamoDB conditional check
      const result = await dynamoDb.putItem({
        TableName: 'payments',
        Item: paymentData,
        ConditionExpression: 'attribute_not_exists(paymentId) OR version = :currentVersion',
        ExpressionAttributeValues: {
          ':currentVersion': paymentData.version
        }
      });

      return result;
    } catch (error) {
      if (error.name === 'ConditionalCheckFailedException' && attempt < maxRetries - 1) {
        // Exponential backoff: 100ms, 200ms, 400ms
        const delayMs = 100 * Math.pow(2, attempt);
        console.log(`Retry attempt ${attempt + 1} after ${delayMs}ms`);
        await new Promise(resolve => setTimeout(resolve, delayMs));
        continue;
      }
      throw error;
    }
  }
}
```

File: `src/lambda/payment-processor/index.js`

[Apply Fix] [Show full analysis] [Explain the fix]
```

---

### **Step 6: Apply the Fix**
- Click or type: **"Apply Fix"**

**What You'll See:**
```
🔄 Applying fix to src/lambda/payment-processor/index.js...
```

Then:
```
✅ Fix Applied Successfully!

File: src/lambda/payment-processor/index.js
```

**File Opens in Editor:**
- The file `src/lambda/payment-processor/index.js` is created
- Contains the retry logic code
- Opens automatically in the left pane

---

### **Step 7: Deployment Success (After 2 Seconds)**

**What You'll See:**
```
🎉 Deployment Successful!

Error Status: ✅ All Clear

The fix has been deployed and errors have been resolved!

Before Fix:
• Error Rate: 12.5%
• Total Errors: 145/hour
• Failed Requests: ConditionalCheckFailedException (89)

After Fix:
• Error Rate: 0.2%
• Total Errors: 3/hour
• Status: Normal operations

Impact:
✅ 97% reduction in errors
✅ Payment processing restored
✅ Customer transactions flowing normally

Your production services are healthy! 🚀

[Monitor for new errors] [Analyze other services] [Create a PR]
```

---

## Demo Timeline

| Time | Event |
|------|-------|
| 0:00 | Open DebugMind copilot |
| 0:05 | Click "Connect me to AWS" |
| 0:10 | Enter Access Key |
| 0:12 | Enter Secret Key |
| 0:14 | Enter Region (us-east-1) |
| 0:16 | AWS Connected → Services discovered |
| **0:18** | **Auto error detection starts** |
| **0:19** | **Error analysis shown** |
| **0:20** | **Code fix generated** |
| 0:22 | User clicks "Apply Fix" |
| 0:24 | File created and opened |
| **0:26** | **Success message: Errors gone!** |

**Total Demo Duration:** ~30 seconds (after AWS connection)

---

## Key Demo Highlights

1. **Zero Manual Work:** Errors are detected automatically 2 seconds after connection
2. **Instant Root Cause:** AI analyzes 145 errors and identifies the root cause
3. **Ready-to-Use Fix:** Code is generated with proper retry logic and exponential backoff
4. **One-Click Application:** "Apply Fix" button creates the file in your workspace
5. **Success Confirmation:** Shows before/after metrics proving the fix worked

---

## Recording Tips

### Camera Angles
1. **Full Screen VSCode:** Show entire interface
2. **Zoom in on Chat:** When showing error analysis and fix
3. **Split View:** Left = code editor, Right = copilot chat

### Narration Points
- "Watch how it automatically detects errors after connecting"
- "Notice the detailed root cause analysis with 89 occurrences"
- "The AI generates production-ready code with exponential backoff"
- "One click to apply the fix directly in my workspace"
- "And instantly shows the impact: 97% error reduction"

### What Makes This Demo Powerful
- **Speed:** 30 seconds from connection to fix deployed
- **Intelligence:** Analyzes 145 errors, finds the real root cause
- **Actionability:** Generates actual code, not just suggestions
- **Impact:** Shows measurable results (12.5% → 0.2% error rate)

---

## Troubleshooting

### If server doesn't connect:
```bash
# Check server is running
curl http://localhost:3001/api/health

# Should return: {"ok":true}
```

### If errors don't auto-show:
- Check console logs in VSCode Developer Tools
- Verify `USE_MOCK_DATA=true` in `.env`
- Restart the backend server

### If "Apply Fix" fails:
- Make sure you have a workspace folder open
- VSCode needs write permissions to create files

---

## Post-Demo Cleanup

To switch back to production mode:
1. Update VSCode settings: `"tivra.apiUrl": "https://copilot.tivra.ai"`
2. Update server `.env`: `USE_MOCK_DATA=false`
3. Delete the demo fix file if created

---

## Mock Data Details

The demo uses enhanced mock data:
- **Service:** payment-processor Lambda function
- **Error:** ConditionalCheckFailedException from DynamoDB
- **Volume:** 145 errors in 1 hour (12.5% error rate)
- **Root Cause:** Optimistic locking conflicts
- **Fix:** Retry logic with exponential backoff (100ms, 200ms, 400ms)
- **Impact:** 97% error reduction

This scenario is realistic and commonly seen in production systems!
