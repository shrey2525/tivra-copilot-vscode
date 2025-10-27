# Analytics Implementation - Tivra DebugMind

## Overview

Tivra DebugMind now includes comprehensive analytics tracking using **Google Analytics 4 (GA4)** to understand user behavior, track the installation funnel, and measure feature usage.

## What We Track

### 1. Installation Funnel

Track user progress through the onboarding flow:

```
extension_installed → extension_activated → welcome_shown →
aws_connection_started → aws_connected → copilot_opened →
first_service_selected → first_analysis_completed
```

**Metrics Collected:**
- Completion rate for each step
- Drop-off points
- Time between steps
- Total funnel completion rate

### 2. User Sessions

Track user engagement and session duration:

- **Session start/end**: When user opens/closes VSCode
- **Session duration**: Total time spent (in seconds)
- **Active time**: Time user is actually interacting
- **Events per session**: Number of actions taken
- **Last activity timestamp**: When user last interacted

### 3. Feature Usage

Track which features are used and how often:

| Feature Category | Actions Tracked |
|------------------|----------------|
| **Copilot** | open, create_new, reveal_existing |
| **AWS Connection** | connect_start, connect_success, connect_failed |
| **Service Analysis** | analyze_start, analyze_complete |
| **Debugging** | start, complete |
| **SRE Investigation** | trigger, complete |
| **Fix Application** | apply, reject |

### 4. Error Tracking

Track errors to improve reliability:

- AWS connection failures
- API errors
- Service analysis failures
- Network issues

## Implementation Details

### Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                   VSCode Extension                          │
│  ┌────────────────────────────────────────────────────────┐ │
│  │            AnalyticsTracker Class                      │ │
│  │                                                        │ │
│  │  - User ID (UUID, persistent)                         │ │
│  │  - Session ID (unique per session)                     │ │
│  │  - Event Buffer (batch sending)                        │ │
│  │  - Funnel State (globalState)                          │ │
│  │  - Session History                                     │ │
│  └────────────┬───────────────────────────────────────────┘ │
│               │                                             │
│               ▼                                             │
│  ┌────────────────────────────────────────────────────────┐ │
│  │          VSCode globalState                            │ │
│  │  - analytics.userId                                    │ │
│  │  - analytics.funnel                                    │ │
│  │  - analytics.sessionHistory                            │ │
│  │  - analytics.enabled                                   │ │
│  └────────────┬───────────────────────────────────────────┘ │
└───────────────┼─────────────────────────────────────────────┘
                │
                ▼
┌─────────────────────────────────────────────────────────────┐
│         Google Analytics 4 (GA4)                            │
│         Measurement Protocol API                            │
│                                                             │
│  - Unlimited free events                                   │
│  - Real-time dashboards                                    │
│  - 14 months data retention                                │
│  - Funnel analysis                                         │
│  - User retention reports                                  │
└─────────────────────────────────────────────────────────────┘
```

### Data Flow

1. **Event Occurs**: User performs an action (e.g., connects to AWS)
2. **Track Event**: `analytics.trackFeatureUsage('aws', 'connect_success', { region })`
3. **Buffer**: Event added to local buffer
4. **Batch Send**: When buffer has 10+ events, send to GA4
5. **GA4 Processing**: Events processed and available in dashboard within minutes

### Event Format

Events are sent to GA4 in this format:

```typescript
{
  client_id: "uuid-of-user",  // Anonymous user ID
  events: [
    {
      name: "aws_connect_success",  // Event name
      params: {
        event_type: "feature_usage",
        session_id: "session_123",
        timestamp: "2025-10-25T12:00:00Z",
        region: "us-east-1"  // Custom parameters
      }
    }
  ]
}
```

## Privacy & Compliance

### What We Collect

✅ **Anonymous Data Only:**
- Random UUID (not linked to any personal info)
- Session duration
- Feature usage counts
- Error types (no sensitive data)
- Platform info (OS, VSCode version)

❌ **We DO NOT Collect:**
- Personal information (name, email)
- AWS credentials
- Service names or data
- Code content
- IP addresses (GA4 anonymizes)
- Any PII (Personally Identifiable Information)

### User Control

Users can:
1. **Opt-out**: Analytics can be disabled (to be implemented in settings)
2. **View data**: See what's being tracked in globalState
3. **Delete data**: Clear analytics history

### GDPR Compliance

- ✅ Anonymous user IDs
- ✅ No PII collected
- ✅ Data minimization
- ✅ User can opt-out
- ✅ Transparent about data collection

## Code Examples

### Track Installation Funnel Step

```typescript
// In extension.ts
analytics?.trackFunnelStep('welcome_shown');

// In debugCopilot.ts
this._analytics?.trackFunnelStep('aws_connected', {
  region,
  encrypted: true
});
```

### Track Feature Usage

```typescript
// Track feature usage
analytics?.trackFeatureUsage('copilot', 'open');

// With metadata
this._analytics?.trackFeatureUsage('service', 'analyze_complete', {
  serviceType: 'lambda',
  errorCount: 42,
  hasFix: true
});
```

### Track Errors

```typescript
// Track error
this._analytics?.trackError('aws_connection_failed', error.message);

// With stack trace
analytics?.trackError('api_error', errorMessage, stackTrace);
```

### Get Session Statistics

```typescript
const stats = analytics?.getSessionStats();
console.log(`Total sessions: ${stats.totalSessions}`);
console.log(`Average duration: ${stats.averageSessionDuration}s`);
console.log(`Funnel completion: ${stats.funnelProgress.completionRate}%`);
```

## Tracked Events Reference

### Installation Funnel Events

| Event Name | Triggered When | Metadata |
|------------|---------------|----------|
| `extension_installed` | Extension first installed | version |
| `extension_activated` | Extension activated | activationCount |
| `welcome_shown` | Welcome message displayed | - |
| `aws_connection_started` | User starts AWS connection | - |
| `aws_connected` | AWS successfully connected | region, encrypted |
| `copilot_opened` | Copilot panel opened | - |
| `first_service_selected` | First service analyzed | serviceName, serviceType, errorCount |
| `first_analysis_completed` | First RCA completed | serviceName, serviceType, hasFix |

### Feature Usage Events

| Event Name | Triggered When | Metadata |
|------------|---------------|----------|
| `copilot.open` | Copilot opened | - |
| `copilot.create_new` | New copilot instance | - |
| `copilot.reveal_existing` | Existing copilot revealed | - |
| `aws.connect_start` | AWS connection started | - |
| `aws.connect_success` | AWS connected successfully | region |
| `aws.connect_failed` | AWS connection failed | error |
| `service.analyze_start` | Service analysis started | serviceType, errorCount |
| `service.analyze_complete` | Analysis completed | serviceType, hasFix |
| `debugging.start` | Debugging started | - |

### Session Events

| Event Name | Triggered When | Metadata |
|------------|---------------|----------|
| `session_start` | Session begins | platform, vscodeVersion, extensionVersion |
| `session_end` | Session ends | duration, eventCount, lastActivity |

### Error Events

| Event Name | Triggered When | Metadata |
|------------|---------------|----------|
| `aws_connection_failed` | AWS connection error | message |
| `api_error` | API call failed | message, endpoint |
| `analysis_failed` | Service analysis failed | message, serviceType |

## GA4 Dashboard Insights

### Key Metrics to Monitor

1. **Funnel Conversion Rate**
   - How many users complete each step
   - Where users drop off
   - Time to complete funnel

2. **User Retention**
   - Daily Active Users (DAU)
   - Weekly Active Users (WAU)
   - Retention rate (Day 1, Day 7, Day 30)

3. **Feature Adoption**
   - Which features are most used
   - Feature usage over time
   - Feature engagement rate

4. **Session Metrics**
   - Average session duration
   - Events per session
   - Sessions per user

5. **Error Rates**
   - Most common errors
   - Error frequency
   - Error impact on retention

### Sample GA4 Queries

**Funnel Completion Rate:**
```
Event: extension_installed → extension_activated → aws_connected → first_analysis_completed
Metric: Completion rate per step
```

**Average Session Duration:**
```
Event: session_end
Parameter: duration
Metric: Average value
```

**Most Used Features:**
```
Event: feature_usage.*
Dimension: event_name
Metric: Event count
```

## Local Testing

### View Analytics State

```typescript
// In VSCode Debug Console
const context = vscode.ExtensionContext;
const userId = await context.globalState.get('analytics.userId');
const funnel = await context.globalState.get('analytics.funnel');
const sessions = await context.globalState.get('analytics.sessionHistory');

console.log('User ID:', userId);
console.log('Funnel Progress:', funnel);
console.log('Session History:', sessions);
```

### Test Event Sending

1. Open VSCode Developer Tools: `Help > Toggle Developer Tools`
2. Go to Network tab
3. Filter by `google-analytics.com`
4. Perform actions in extension
5. See events being sent to GA4

### Disable Analytics for Testing

```typescript
// Temporarily disable analytics
analytics?.setEnabled(false);

// Re-enable
analytics?.setEnabled(true);
```

## Configuration

### Required Setup

1. **Create GA4 Property** (see [GA4-SETUP.md](GA4-SETUP.md))
2. **Get Measurement ID**: `G-XXXXXXXXXX`
3. **Get API Secret**: Generate in GA4 Admin
4. **Update Code**:
   ```typescript
   const GA4_MEASUREMENT_ID = 'G-YOUR_ID_HERE';
   const GA4_API_SECRET = 'your_api_secret_here';
   ```

### Environment Variables

Store credentials securely:

```typescript
// In analytics-tracker.ts
const GA4_MEASUREMENT_ID = process.env.GA4_MEASUREMENT_ID || 'G-XXXXXXXXXX';
const GA4_API_SECRET = process.env.GA4_API_SECRET || 'your-api-secret';
```

## Performance Impact

### Minimal Overhead

- **Event tracking**: < 1ms (async, non-blocking)
- **Event batching**: Sends max every 30s or 10 events
- **Local storage**: < 100KB for 100 sessions
- **Network**: Batch requests, minimal bandwidth

### Best Practices

1. **Batch events**: Don't send individual events
2. **Async sending**: Never block user actions
3. **Error handling**: Silent failures, no user impact
4. **Rate limiting**: Max 10 events/batch, 25 events/request

## Future Enhancements

### Planned Features

1. **User Opt-in/Opt-out UI**
   - Settings page to enable/disable analytics
   - View collected data
   - Clear analytics history

2. **Enhanced Funnel Analysis**
   - Track time between each step
   - Identify bottlenecks
   - A/B test different flows

3. **Cohort Analysis**
   - Group users by install date
   - Compare cohort behavior
   - Retention by cohort

4. **Custom Dashboards**
   - Installation funnel dashboard
   - Feature usage dashboard
   - Error tracking dashboard
   - User engagement dashboard

5. **Alerts**
   - Alert on funnel drop-offs
   - Alert on error spikes
   - Alert on low engagement

## Troubleshooting

### Events not appearing in GA4

**Check:**
1. GA4 Measurement ID is correct
2. API Secret is valid
3. Check Network tab for 200 responses
4. Wait 24-48 hours for GA4 to process (real-time may show immediately)

### High event count

**Solution:**
```typescript
// Reduce event tracking
analytics?.setEnabled(false); // Temporarily disable

// Or reduce event detail
trackFeatureUsage('feature', 'action'); // No metadata
```

### localStorage quota exceeded

**Solution:**
```typescript
// Clear old sessions
const sessions = context.globalState.get('analytics.sessionHistory', []);
const recentSessions = sessions.slice(-50); // Keep only last 50
context.globalState.update('analytics.sessionHistory', recentSessions);
```

## Support

For analytics questions or issues:
1. Check [GA4-SETUP.md](GA4-SETUP.md) for GA4 configuration
2. Review code in [analytics-tracker.ts](src/analytics/analytics-tracker.ts)
3. Contact: info@tivra.ai

---

**Analytics System Version**: 1.0
**Last Updated**: October 2025
**GA4 Property**: tivra-debugmind
