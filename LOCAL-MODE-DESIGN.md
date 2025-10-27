# Local Mode Design - Tivra DebugMind

## Problem Statement

**Current friction**: Users must connect to AWS before trying the extension, which creates barriers:
- AWS credentials setup is complex
- Users can't evaluate the extension quickly
- High drop-off rate at AWS connection step (analytics will show this)

## Solution: Local Mode

Allow users to **paste logs directly** and get AI-powered RCA without AWS connection.

## User Flows

### Flow 1: Quick Try (No AWS)

```
1. Install Extension
2. Open Copilot → See welcome with 2 options:
   ┌──────────────────────────────────────┐
   │ 🚀 Try Local Mode (Paste Logs)      │
   │ 🔗 Connect to AWS (Full Features)   │
   └──────────────────────────────────────┘
3. Click "Try Local Mode"
4. Paste logs in text area
5. AI analyzes logs
6. Get RCA + suggested fixes
7. (Optional) Upgrade to AWS mode for more features
```

### Flow 2: AWS Mode (Existing)

```
1. Install Extension
2. Connect to AWS
3. Select service
4. Auto-fetch logs
5. AI analyzes
6. Get RCA + fixes + monitoring
```

## Local Mode Features

### Phase 1: Basic Local Mode (MVP)

✅ **Core Features**:
- Paste logs (plain text)
- AI analysis with Claude
- Root cause analysis
- Suggested fixes
- No AWS required

❌ **Not Included** (AWS mode only):
- Auto-fetch from CloudWatch
- Real-time monitoring
- Service discovery
- Deployment correlation
- SRE agent investigation

### Phase 2: Enhanced Local Mode

✅ **Additional Features**:
- Upload log files (.log, .txt)
- Drag & drop log files
- Multiple log sources
- Manual service type selection
- Export analysis results

### Phase 3: Hybrid Mode

✅ **Best of Both**:
- Start in local mode
- Upgrade to AWS seamlessly
- Keep local analysis history
- Compare local vs AWS logs

## UI/UX Design

### Welcome Screen (Updated)

```
┌─────────────────────────────────────────────────────────────┐
│  🤖 Welcome to Tivra DebugMind!                             │
│                                                              │
│  Your AI debugging assistant for production services        │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  🚀 Try Local Mode                                   │  │
│  │                                                       │  │
│  │  Paste logs and get instant AI analysis             │  │
│  │  • No AWS setup required                             │  │
│  │  • Works in 30 seconds                               │  │
│  │  • Perfect for trying the extension                  │  │
│  │                                                       │  │
│  │  [Start with Local Mode] ─────────────────────────►  │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  🔗 Connect to AWS                                   │  │
│  │                                                       │  │
│  │  Full features with auto log fetching               │  │
│  │  • Auto-fetch from CloudWatch                        │  │
│  │  • Real-time monitoring                              │  │
│  │  • Service discovery                                 │  │
│  │  • Deployment correlation                            │  │
│  │                                                       │  │
│  │  [Connect to AWS] ────────────────────────────────►  │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### Local Mode Interface

```
┌─────────────────────────────────────────────────────────────┐
│  📝 Local Mode - Paste Your Logs                            │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ Service Name (Optional): [payment-processor]          │ │
│  │ Service Type: [Lambda ▼] [ECS] [EC2] [Other]          │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ Paste your logs here:                                  │ │
│  │                                                         │ │
│  │ [INFO] 2025-10-25 12:00:01 - Processing payment        │ │
│  │ [ERROR] 2025-10-25 12:00:05 - NullPointerException     │ │
│  │   at com.example.PaymentService.process(...)           │ │
│  │   at com.example.OrderController.checkout(...)         │ │
│  │ [ERROR] 2025-10-25 12:00:08 - NullPointerException     │ │
│  │                                                         │ │
│  │                                                         │ │
│  │  [or drop log file here]                               │ │
│  │                                                         │ │
│  │                         [📎 Upload Log File]           │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                              │
│  Tips:                                                       │
│  • Paste error logs from your production service            │
│  • Include stack traces for better analysis                 │
│  • Minimum 10 lines recommended                             │
│                                                              │
│  [🔍 Analyze Logs]               [🔗 Upgrade to AWS Mode]  │
└─────────────────────────────────────────────────────────────┘
```

### Analysis Results (Same as AWS Mode)

```
┌─────────────────────────────────��───────────────────────────┐
│  ⚠️ Errors Found in payment-processor                       │
│                                                              │
│  Found 89 error(s) in pasted logs.                          │
│                                                              │
│  Top Errors:                                                 │
│  1. NullPointerException (42 occurrences)                    │
│  2. TimeoutException (28 occurrences)                        │
│  3. IllegalStateException (19 occurrences)                   │
│                                                              │
│  🔍 Root Cause Analysis                                      │
│  [AI-generated RCA here...]                                  │
│                                                              │
│  💡 Suggested Fixes                                          │
│  [AI-generated fixes here...]                                │
│                                                              │
│  [Apply Fix] [Create PR] [Analyze More Logs]                │
│                                                              │
│  💡 Upgrade to AWS Mode for:                                 │
│  • Auto-fetch logs from CloudWatch                           │
│  • Real-time monitoring                                      │
│  • Deployment correlation                                    │
│  [Connect to AWS] ────────────────────────────────────────►  │
└─────────────────────────────────────────────────────────────┘
```

## Technical Implementation

### Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                   VSCode Extension                          │
│  ┌────────────────────────────────────────────────────────┐ │
│  │              Mode Selector                             │ │
│  │  ┌─────────────┐         ┌──────────────┐             │ │
│  │  │ Local Mode  │         │  AWS Mode    │             │ │
│  │  └──────┬──────┘         └──────┬───────┘             │ │
│  │         │                       │                      │ │
│  │         ▼                       ▼                      │ │
│  │  ┌─────────────┐         ┌──────────────┐             │ │
│  │  │ Paste Logs  │         │ CloudWatch   │             │ │
│  │  │ Text Area   │         │ Auto-Fetch   │             │ │
│  │  └──────┬──────┘         └──────┬───────┘             │ │
│  │         │                       │                      │ │
│  │         └───────────┬───────────┘                      │ │
│  │                     ▼                                  │ │
│  │         ┌───────────────────────┐                      │ │
│  │         │  Log Parser & Analyzer│                      │ │
│  │         └───────────┬───────────┘                      │ │
│  │                     ▼                                  │ │
│  │         ┌───────────────────────┐                      │ │
│  │         │  Claude AI (RCA + Fix)│                      │ │
│  │         └───────────────────────┘                      │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

### Data Flow

```
Local Mode:
1. User pastes logs → 2. Parse & extract errors →
3. Send to Claude → 4. Get RCA + fixes → 5. Display results

AWS Mode:
1. Connect to AWS → 2. Fetch from CloudWatch →
3. Parse & extract errors → 4. Send to Claude →
5. Get RCA + fixes → 6. Display results
```

### Log Parser

```typescript
interface ParsedLogs {
  totalLines: number;
  errors: Array<{
    timestamp?: string;
    level: 'ERROR' | 'FATAL' | 'CRITICAL';
    message: string;
    stackTrace?: string[];
    count: number;
  }>;
  warnings: number;
  info: number;
  timeRange?: {
    start: string;
    end: string;
  };
}

class LocalLogParser {
  parse(rawLogs: string): ParsedLogs {
    // 1. Split into lines
    // 2. Identify log levels (ERROR, WARN, INFO)
    // 3. Extract timestamps
    // 4. Group errors by message
    // 5. Extract stack traces
    // 6. Count occurrences
  }
}
```

## API Changes

### Backend: Add Local Mode Endpoint

```javascript
// server/routes/chat.js
router.post('/api/local/analyze', async (req, res) => {
  const { logs, serviceName, serviceType } = req.body;

  // 1. Parse logs
  const parsedLogs = parseLocalLogs(logs);

  // 2. Extract errors
  const topErrors = extractTopErrors(parsedLogs);

  // 3. Send to Claude for RCA
  const rca = await analyzeWithClaude({
    serviceName,
    serviceType,
    errors: topErrors,
    mode: 'local'
  });

  // 4. Return analysis
  res.json({
    errorCount: parsedLogs.errors.length,
    topErrors,
    analysis: rca,
    suggestedFix: rca.suggestedFix
  });
});
```

## Comparison: Local vs AWS Mode

| Feature | Local Mode | AWS Mode |
|---------|-----------|----------|
| **Setup Time** | 30 seconds | 5-10 minutes |
| **AWS Credentials** | ❌ Not needed | ✅ Required |
| **Log Source** | Paste/Upload | Auto-fetch CloudWatch |
| **Real-time Monitoring** | ❌ | ✅ |
| **Service Discovery** | ❌ | ✅ |
| **Deployment Correlation** | ❌ | ✅ |
| **SRE Investigation** | ❌ | ✅ |
| **AI Analysis (RCA)** | ✅ | ✅ |
| **Suggested Fixes** | ✅ | ✅ |
| **Create PR** | ✅ | ✅ |
| **Best For** | Quick try, demo | Production use |

## Benefits

### For Users

1. **Instant Value**: Try extension in 30 seconds
2. **No Friction**: No AWS setup needed initially
3. **Risk-Free**: Test before connecting production AWS
4. **Flexible**: Works with any log source (AWS, GCP, Azure, local)

### For Product

1. **Lower Barrier**: Reduce drop-off at AWS connection
2. **Higher Adoption**: More users try the extension
3. **Better Funnel**: Local → AWS upgrade path
4. **Wider Use Cases**: Works beyond AWS

## Analytics Tracking

### Local Mode Events

```typescript
// Funnel
'local_mode_started'
'logs_pasted'
'local_analysis_completed'
'upgraded_to_aws'

// Feature usage
'local.paste_logs'
'local.upload_file'
'local.analyze'
'local.upgrade_to_aws'
```

### Metrics to Track

- **Conversion**: Local mode → AWS mode upgrade rate
- **Engagement**: # analyses in local mode
- **Drop-off**: Where users stop in local flow
- **Time to value**: Time from install to first analysis

## Implementation Phases

### Phase 1: MVP (Week 1)

- ✅ Update welcome screen with 2 modes
- ✅ Add paste logs text area
- ✅ Basic log parser
- ✅ Send to Claude for analysis
- ✅ Display results
- ✅ Analytics tracking

### Phase 2: Enhanced (Week 2)

- ✅ Upload log files
- ✅ Drag & drop support
- ✅ Better log parsing (multiple formats)
- ✅ Service type selection
- ✅ Export results

### Phase 3: Polish (Week 3)

- ✅ Example logs (pre-filled for demo)
- ✅ Upgrade to AWS prompt
- ✅ Local mode history
- ✅ Keyboard shortcuts
- ✅ Better error messages

## Success Metrics

### Primary

- **Activation Rate**: % users who complete first analysis
  - Target: 70% (vs 30% with AWS-only)
- **Time to First Value**: Time from install to first RCA
  - Target: < 2 minutes (vs 10+ minutes with AWS)

### Secondary

- **Upgrade Rate**: % local users who upgrade to AWS
  - Target: 40%
- **Local Mode Usage**: # analyses per user in local mode
  - Target: 3+ analyses

## Risks & Mitigations

### Risk 1: Users Stay in Local Mode

**Risk**: Users don't upgrade to AWS mode

**Mitigation**:
- Show upgrade prompts after 3 analyses
- Highlight AWS-only features
- Offer limited analyses in local mode (e.g., 10/day)

### Risk 2: Log Format Confusion

**Risk**: Users don't know what logs to paste

**Mitigation**:
- Show example logs
- Provide log format guide
- Auto-detect format and show helpful errors

### Risk 3: Large Log Files

**Risk**: Users paste huge logs, API times out

**Mitigation**:
- Limit to 10,000 lines
- Show warning for large files
- Offer to analyze recent logs only

## Future Enhancements

1. **Smart Log Sampling**: Auto-select relevant log lines
2. **Multi-File Upload**: Analyze logs from multiple services
3. **Log Format Detection**: Auto-detect Java, Python, Node.js, etc.
4. **Diff Analysis**: Compare logs before/after deployment
5. **Shareable Analysis**: Export and share RCA reports

## Recommendation

**Implement Local Mode MVP (Phase 1)** to:
- Reduce AWS connection friction
- Increase trial-to-activation rate
- Gather analytics on user behavior
- Build upgrade path to AWS mode

This will significantly improve user onboarding and reduce the current friction point.
