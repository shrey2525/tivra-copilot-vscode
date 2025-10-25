# Google Analytics 4 (GA4) Setup Guide

## Overview

This guide walks you through setting up Google Analytics 4 for Tivra DebugMind to track user analytics, installation funnel, and feature usage.

## Prerequisites

- Google Account
- Access to [Google Analytics](https://analytics.google.com)

## Step 1: Create GA4 Property

### 1.1 Go to Google Analytics

Visit: https://analytics.google.com

### 1.2 Create Account (if needed)

1. Click **Admin** (gear icon, bottom left)
2. Click **Create Account**
3. Enter account name: `Tivra AI`
4. Configure data sharing settings (recommended: enable all)
5. Click **Next**

### 1.3 Create Property

1. Property name: `Tivra DebugMind`
2. Reporting time zone: Your timezone
3. Currency: Your currency
4. Click **Next**

### 1.4 Business Information

1. Industry: `Software`
2. Business size: Select your size
3. How you plan to use Analytics: `Examine user behavior`
4. Click **Create**

5. Accept Terms of Service

## Step 2: Set Up Data Stream

### 2.1 Create Web Data Stream

Even though this is a VSCode extension, we'll use a Web data stream because we're using the Measurement Protocol API.

1. Click **Web** (under "Choose a platform")
2. Website URL: `https://marketplace.visualstudio.com/items?itemName=shreychaturvedi.tivra-debugmind`
3. Stream name: `Tivra DebugMind Extension`
4. Click **Create stream**

### 2.2 Get Measurement ID

After creating the stream, you'll see:

```
Measurement ID: G-XXXXXXXXXX
```

**Copy this!** You'll need it for the code.

Example: `G-ABC123DEF4`

## Step 3: Create API Secret

### 3.1 Generate Measurement Protocol API Secret

1. In the Data Stream details, scroll down
2. Find **Measurement Protocol API secrets**
3. Click **Create**
4. Nickname: `VSCode Extension`
5. Click **Create**

### 3.2 Copy API Secret

You'll see:

```
Secret value: abc123XYZ456_def789
```

**Copy this and store it securely!** You can only see it once.

## Step 4: Configure Extension Code

### 4.1 Update analytics-tracker.ts

Open `src/analytics/analytics-tracker.ts` and update:

```typescript
// Replace these values
const GA4_MEASUREMENT_ID = 'G-YOUR_ID_HERE'; // From Step 2.2
const GA4_API_SECRET = 'your_api_secret_here'; // From Step 3.2
```

Example:

```typescript
const GA4_MEASUREMENT_ID = 'G-ABC123DEF4';
const GA4_API_SECRET = 'abc123XYZ456_def789';
```

### 4.2 Environment Variables (Recommended)

For better security, use environment variables:

**Create `.env` file:**

```bash
GA4_MEASUREMENT_ID=G-ABC123DEF4
GA4_API_SECRET=abc123XYZ456_def789
```

**Update code to use env vars:**

```typescript
const GA4_MEASUREMENT_ID = process.env.GA4_MEASUREMENT_ID || 'G-XXXXXXXXXX';
const GA4_API_SECRET = process.env.GA4_API_SECRET || 'fallback-secret';
```

**Add to `.gitignore`:**

```gitignore
.env
```

## Step 5: Configure GA4 Dashboard

### 5.1 Enable Enhanced Measurement

1. Go to **Admin > Data Streams > [Your Stream]**
2. Click **Enhanced measurement**
3. Enable:
   - Page views
   - Scrolls
   - Outbound clicks
   - Site search
   - Form interactions

### 5.2 Create Custom Events (Optional)

GA4 will automatically track events sent via Measurement Protocol, but you can create custom events for better organization:

1. Go to **Configure > Events**
2. Click **Create event**
3. Add custom event names matching your tracked events:
   - `extension_activated`
   - `aws_connected`
   - `service_analyzed`
   - etc.

### 5.3 Configure Conversions

Mark important events as conversions:

1. Go to **Configure > Events**
2. Find these events:
   - `aws_connected`
   - `first_analysis_completed`
3. Toggle **Mark as conversion**

## Step 6: Create Dashboards

### 6.1 Installation Funnel Dashboard

1. Go to **Explore**
2. Click **Funnel exploration**
3. Add steps:
   - Step 1: `extension_installed`
   - Step 2: `extension_activated`
   - Step 3: `welcome_shown`
   - Step 4: `aws_connected`
   - Step 5: `first_service_selected`
   - Step 6: `first_analysis_completed`
4. Save as: `Installation Funnel`

### 6.2 Feature Usage Dashboard

1. Go to **Reports > Engagement > Events**
2. Add custom report:
   - Event name
   - Event count
   - Users
   - Sessions
3. Filter by event category: `feature_usage`

### 6.3 Session Metrics Dashboard

1. Go to **Reports > Engagement > Overview**
2. Customize metrics:
   - Average session duration
   - Events per session
   - Sessions per user
   - New vs returning users

## Step 7: Test Integration

### 7.1 Send Test Event

Build and run the extension:

```bash
npm run compile
```

Open VSCode and activate the extension. You should see in console:

```
[Analytics] Initialized - User: xxxx-xxxx-xxxx
[Analytics] Event: session.session_start
```

### 7.2 Verify in GA4 Real-Time

1. Go to **Reports > Realtime**
2. You should see:
   - 1 user active
   - Events: `session_start`, `extension_activated`, etc.

**Note**: Real-time may take 1-2 minutes to show events.

### 7.3 Check Network Requests

1. Open VSCode Developer Tools: `Help > Toggle Developer Tools`
2. Go to Network tab
3. Filter by `google-analytics.com`
4. Trigger some events
5. You should see POST requests to:
   ```
   https://www.google-analytics.com/mp/collect?measurement_id=G-XXX...
   ```
6. Check response: Should be `204 No Content` (success)

## Step 8: Set Up Alerts (Optional)

### 8.1 Create Alert for Low Usage

1. Go to **Admin > Data display > Custom alerts**
2. Click **Create alert**
3. Alert name: `Low Daily Active Users`
4. Apply to: Your property
5. Condition: `Daily active users < 10`
6. Notify: Your email
7. Save

### 8.2 Create Alert for High Error Rate

1. Create alert: `High Error Rate`
2. Condition: `Event count (aws_connection_failed) > 50`
3. Period: `1 day`
4. Notify: Your email

## Step 9: Configure Data Retention

### 9.1 Set Retention Period

1. Go to **Admin > Data Settings > Data Retention**
2. Event data retention: **14 months** (maximum for free tier)
3. Reset user data on new activity: **Off**
4. Save

### 9.2 Enable BigQuery Export (Optional, Paid)

For advanced analysis:

1. Go to **Admin > Product Links > BigQuery Links**
2. Link to BigQuery project
3. Enable daily/streaming export
4. **Note**: Requires BigQuery (paid service)

## Step 10: Privacy & Compliance

### 10.1 Configure Data Settings

1. Go to **Admin > Data Settings > Data Collection**
2. Enable:
   - **Google signals**: Off (for privacy)
   - **IP anonymization**: On
3. Save

### 10.2 Add Privacy Policy

1. Update your extension's README or marketplace page
2. Include privacy policy:

```markdown
## Privacy Policy

Tivra DebugMind collects anonymous usage analytics using Google Analytics 4:

### What We Collect:
- Anonymous user ID (UUID, not linked to any personal information)
- Session duration and feature usage
- Extension version and platform information
- Error types (no sensitive data or credentials)

### What We DO NOT Collect:
- Personal information (name, email, etc.)
- AWS credentials or service data
- Code content or file names
- IP addresses (anonymized by GA4)

### How to Opt-Out:
Analytics can be disabled in extension settings.

For questions: info@tivra.ai
```

### 10.3 GDPR Compliance

1. Go to **Admin > Account Settings**
2. Enable **Data Processing Amendment**
3. Review and accept terms

## Troubleshooting

### Events Not Showing Up

**Problem**: Events sent but not visible in GA4

**Solutions**:
1. **Wait 24-48 hours**: Full data processing takes time
2. **Check Real-time**: Go to Reports > Realtime (shows within 1-2 minutes)
3. **Verify Measurement ID**: Double-check `G-XXXXXXXXXX` matches exactly
4. **Check API Secret**: Ensure it's correct and not expired
5. **Network errors**: Check browser console for errors

### Invalid Measurement ID Error

**Problem**: `403 Forbidden` or `Invalid Measurement ID`

**Solutions**:
1. Regenerate API Secret
2. Check Measurement ID format: Must be `G-XXXXXXXXXX`
3. Ensure Data Stream is active

### Too Many Events

**Problem**: Hitting rate limits

**Solutions**:
1. GA4 limits: 500 events per request, 25 events per batch
2. Reduce event frequency
3. Increase batch size in code

### No Users Showing

**Problem**: Events tracked but no users

**Solutions**:
1. Check `client_id` is being sent
2. Ensure User ID is persistent (using VSCode globalState)
3. Wait for data processing

## Best Practices

### 1. Event Naming

Use consistent, descriptive names:
- ✅ `aws_connect_success`
- ❌ `connect`

### 2. Parameter Naming

Use snake_case for parameters:
- ✅ `service_type`
- ❌ `serviceType`

### 3. Batch Events

Don't send events one by one:
```typescript
// ❌ Bad
analytics.track('event1');
analytics.track('event2');

// ✅ Good (batched automatically)
events.push(event1, event2);
sendBatch(events);
```

### 4. Error Handling

Always handle errors silently:
```typescript
try {
  await sendToGA4(events);
} catch (error) {
  // Log but don't show user
  console.error('Analytics failed:', error);
  // Never throw or show error to user
}
```

### 5. Data Minimization

Only collect what you need:
- ❌ Don't collect: Service names, AWS account IDs, code content
- ✅ Do collect: Service type, error count, region

## Resources

- [GA4 Measurement Protocol](https://developers.google.com/analytics/devguides/collection/protocol/ga4)
- [GA4 Events Reference](https://developers.google.com/analytics/devguides/collection/ga4/reference/events)
- [GA4 Dashboard Guide](https://support.google.com/analytics/answer/9143382)
- [GA4 Privacy Guide](https://support.google.com/analytics/topic/2919631)

## Support

For help with GA4 setup:
1. Check [Analytics Implementation Guide](ANALYTICS-IMPLEMENTATION.md)
2. GA4 Help Center: https://support.google.com/analytics
3. Contact: info@tivra.ai

---

**Setup Version**: 1.0
**Last Updated**: October 2025
