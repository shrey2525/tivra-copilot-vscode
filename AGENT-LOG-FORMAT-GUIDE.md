# Agent-Friendly Log Format Guide

## Overview

This guide defines the log format requirements for the Tivra Agentic SRE Agent to effectively analyze errors and generate fixes.

## ✅ Best Practices for Agent-Friendly Logging

### 1. **Structured Error Logging**

The agent works best with logs that provide:
- **Request/Transaction ID** - For tracing related events
- **Error Classification** - Type, code, category
- **Context** - What was being attempted
- **Root Cause** - Why it failed
- **Fix Suggestions** - How to resolve (when known)
- **File Location** - Exact file and line number

### 2. **Minimum Log Format**

For the agent to work effectively, **every error** must include:

```
[REQUEST_ID] [ERROR] ERROR_CODE
[REQUEST_ID] File: path/to/file.js:line
[REQUEST_ID] Issue: What went wrong
[REQUEST_ID] Root cause: Why it happened
[REQUEST_ID] Fix needed: How to resolve
[REQUEST_ID] Context: {JSON data}
```

**Real Example from Datadog validation bug:**

```
[dd-1761633682520] [ERROR] INVALID_DATADOG_CREDENTIALS
[dd-1761633682520] File: server/routes/datadog.js:POST /connect
[dd-1761633682520] Issue: API call was made with malformed credentials
[dd-1761633682520] Root cause: Missing input validation before API call
[dd-1761633682520] Fix needed: Add format validation for apiKey (32 hex) and appKey (40 hex)
[dd-1761633682520] Regex patterns needed:
[dd-1761633682520]   - apiKey: /^[a-f0-9]{32}$/i
[dd-1761633682520]   - appKey: /^[a-f0-9]{40}$/i
```

This format allows the agent to:
1. ✅ Identify the bug immediately
2. ✅ Locate the exact file and line
3. ✅ Understand the root cause
4. ✅ Generate the correct fix
5. ✅ Validate the solution

### 3. **Log Format Examples by Error Type**

#### Validation Error

```javascript
console.error(`[${requestId}] [ERROR] VALIDATION_ERROR`);
console.error(`[${requestId}] File: server/routes/datadog.js:69`);
console.error(`[${requestId}] Function: POST /api/datadog/connect`);
console.error(`[${requestId}] Issue: Datadog API key format invalid`);
console.error(`[${requestId}] Root cause: Missing format validation before API call`);
console.error(`[${requestId}] Fix needed: Add regex validation /^[a-f0-9]{32}$/i`);
console.error(`[${requestId}] Provided:`, JSON.stringify({
  apiKeyLength: apiKey.length,
  expectedLength: 32,
  pattern: 'hexadecimal'
}));
```

#### Network/API Error

```javascript
console.error(`[${requestId}] [ERROR] API_TIMEOUT`);
console.error(`[${requestId}] File: server/utils/datadogClient.js:45`);
console.error(`[${requestId}] Issue: Datadog API request timed out after 20s`);
console.error(`[${requestId}] Root cause: No retry logic for failed requests`);
console.error(`[${requestId}] Fix needed: Add exponential backoff retry with max 3 attempts`);
console.error(`[${requestId}] Endpoint: ${options.hostname}${options.path}`);
```

#### Authentication Error

```javascript
console.error(`[${requestId}] [ERROR] AUTH_FAILED`);
console.error(`[${requestId}] File: server/middleware/auth.js:23`);
console.error(`[${requestId}] Issue: JWT token expired`);
console.error(`[${requestId}] Root cause: Token lifetime too short (5 min)`);
console.error(`[${requestId}] Fix needed: Extend token lifetime to 1 hour or add refresh token`);
console.error(`[${requestId}] Token age: ${tokenAge}ms, Max age: ${maxAge}ms`);
```

#### Database Error

```javascript
console.error(`[${requestId}] [ERROR] DB_QUERY_FAILED`);
console.error(`[${requestId}] File: server/models/user.js:89`);
console.error(`[${requestId}] Issue: Query timeout after 30s`);
console.error(`[${requestId}] Root cause: Missing index on users.email column`);
console.error(`[${requestId}] Fix needed: CREATE INDEX idx_user_email ON users(email)`);
console.error(`[${requestId}] Query: ${query}, Execution time: ${executionTime}ms`);
```

### 4. **JSON Structured Logging**

For production systems, use structured JSON logs:

```javascript
logger.error({
  requestId: 'req-1234567890',
  timestamp: new Date().toISOString(),
  level: 'ERROR',
  errorType: 'ValidationError',
  errorCode: 'INVALID_API_KEY_FORMAT',
  file: 'server/routes/datadog.js',
  function: 'POST /connect',
  line: 69,
  message: 'Datadog API Key format is invalid',
  issue: 'API call made with malformed credentials',
  rootCause: 'Missing input validation before API call',
  fixNeeded: 'Add regex validation: /^[a-f0-9]{32}$/i',
  provided: { apiKeyLength: 10, expectedLength: 32 },
  expected: { pattern: '/^[a-f0-9]{32}$/i' },
  stack: err.stack
});
```

### 5. **Log Levels**

| Level | When to Use | Agent Action |
|-------|-------------|--------------|
| **ERROR** | Something failed, needs fixing | Triggers investigation |
| **WARN** | Potential issue, degraded performance | Monitors, may suggest optimization |
| **INFO** | Normal operation, state changes | Provides context for errors |
| **DEBUG** | Detailed trace | Ignored (too verbose) |

### 6. **Anti-Patterns to Avoid**

#### ❌ Vague Messages

```javascript
// BAD - Agent cannot understand
console.error("Error occurred");
console.error("Invalid input");
console.error(err);

// GOOD - Agent can diagnose
console.error(`[${requestId}] [ERROR] VALIDATION_FAILED`);
console.error(`[${requestId}] File: api.js:123`);
console.error(`[${requestId}] Issue: Email validation missing`);
console.error(`[${requestId}] Fix needed: Add regex /^[\\w-\\.]+@/`);
```

#### ❌ No Context

```javascript
// BAD
throw new Error("Failed");

// GOOD
const error = new Error(`[${requestId}] Database query failed`);
error.details = { query, duration, connection };
throw error;
```

### 7. **Testing Logs for Agent Compatibility**

#### Checklist

- [ ] Request ID present and consistent
- [ ] Error type/code clearly stated
- [ ] File location provided
- [ ] Root cause explained
- [ ] Fix suggestion included
- [ ] Context data (provided/expected) included
- [ ] Stack trace for exceptions

#### Test Command

```bash
# Trigger error and check logs
curl -X POST http://localhost:3001/api/datadog/connect \
  -H "Content-Type: application/json" \
  -d '{"apiKey": "invalid", "appKey": "invalid"}'

# Agent should extract:
# 1. Error type
# 2. File location
# 3. Root cause
# 4. Fix suggestion
```

### 8. **CloudWatch Integration**

When using AWS CloudWatch:

```javascript
const logger = winston.createLogger({
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new WinstonCloudWatch({
      logGroupName: '/aws/lambda/my-function',
      jsonMessage: true  // IMPORTANT for agent parsing
    })
  ]
});
```

### 9. **Agent Investigation Flow**

The agent uses logs to:

1. **Identify Error Location**
   - Searches for `[ERROR]` markers
   - Extracts file and line number

2. **Understand Context**
   - Reads "Issue" and "Root cause"
   - Analyzes provided vs expected data

3. **Search Similar Incidents**
   - Uses error type + message for semantic search
   - Finds past solutions from Pinecone

4. **Generate Fix**
   - Uses "Fix needed" suggestions
   - Fetches code from GitHub
   - Creates code patch

---

## Conclusion

**Agent-friendly logging** provides enough context for the AI agent to:
- Understand what failed
- Identify why it failed
- Determine how to fix it
- Validate the solution

Follow these patterns for high-accuracy automatic investigations!
