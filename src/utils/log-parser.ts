/**
 * Log Parser for Local Mode
 * Parses pasted logs and extracts errors, warnings, and structured data
 */

export interface ParsedError {
  timestamp?: string;
  level: 'ERROR' | 'FATAL' | 'CRITICAL' | 'SEVERE';
  message: string;
  stackTrace?: string[];
  count: number;
  samples: string[];
  rawLines: string[];
}

export interface ParsedLogs {
  totalLines: number;
  errors: ParsedError[];
  warnings: number;
  info: number;
  debug: number;
  timeRange?: {
    start: string;
    end: string;
  };
  detectedFormat?: string;
}

export class LocalLogParser {
  /**
   * Parse raw log text into structured format
   */
  public parse(rawLogs: string): ParsedLogs {
    if (!rawLogs || rawLogs.trim().length === 0) {
      throw new Error('No logs provided');
    }

    const lines = rawLogs.split('\n').filter(line => line.trim().length > 0);

    if (lines.length < 5) {
      throw new Error('Too few log lines (minimum 5 required)');
    }

    const detectedFormat = this.detectLogFormat(lines);

    // Parse each line
    const parsedLines = lines.map(line => this.parseLine(line));

    // Count by level
    const errorLines = parsedLines.filter(l => l.level === 'ERROR' || l.level === 'FATAL' || l.level === 'CRITICAL' || l.level === 'SEVERE');
    const warnLines = parsedLines.filter(l => l.level === 'WARN' || l.level === 'WARNING');
    const infoLines = parsedLines.filter(l => l.level === 'INFO');
    const debugLines = parsedLines.filter(l => l.level === 'DEBUG' || l.level === 'TRACE');

    // Group errors by message
    const groupedErrors = this.groupErrors(errorLines, lines);

    // Extract time range
    const timestamps = parsedLines
      .map(l => l.timestamp)
      .filter(t => t !== undefined) as string[];

    const timeRange = timestamps.length > 0 ? {
      start: timestamps[0],
      end: timestamps[timestamps.length - 1]
    } : undefined;

    return {
      totalLines: lines.length,
      errors: groupedErrors,
      warnings: warnLines.length,
      info: infoLines.length,
      debug: debugLines.length,
      timeRange,
      detectedFormat
    };
  }

  /**
   * Detect log format (Java, Python, Node.js, etc.)
   */
  private detectLogFormat(lines: string[]): string {
    const sample = lines.slice(0, Math.min(10, lines.length)).join('\n');

    // Java/Spring Boot
    if (sample.match(/^\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}\.\d{3}\s+(ERROR|INFO|WARN|DEBUG)/m)) {
      return 'Java/Spring Boot';
    }

    // Python logging
    if (sample.match(/^(ERROR|INFO|WARNING|DEBUG):[\w.]+:/m)) {
      return 'Python';
    }

    // Node.js/Winston
    if (sample.match(/"level":"(error|info|warn|debug)"/)) {
      return 'Node.js/Winston (JSON)';
    }

    // AWS CloudWatch format
    if (sample.match(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z/m)) {
      return 'AWS CloudWatch';
    }

    // Generic timestamp + level
    if (sample.match(/\[(ERROR|INFO|WARN|DEBUG)\]/i)) {
      return 'Generic';
    }

    return 'Unknown';
  }

  /**
   * Parse a single log line
   */
  private parseLine(line: string): {
    timestamp?: string;
    level?: string;
    message: string;
    isStackTrace: boolean;
  } {
    // Try to extract timestamp
    const timestampMatch = line.match(/^(\d{4}-\d{2}-\d{2}[T\s]\d{2}:\d{2}:\d{2}(?:\.\d{3})?(?:Z|[+-]\d{2}:\d{2})?)/);
    const timestamp = timestampMatch ? timestampMatch[1] : undefined;

    // Try to extract log level
    const levelMatch = line.match(/\b(ERROR|FATAL|CRITICAL|SEVERE|WARN|WARNING|INFO|DEBUG|TRACE)\b/i);
    const level = levelMatch ? levelMatch[1].toUpperCase() : undefined;

    // Check if this is a stack trace line
    const isStackTrace = this.isStackTraceLine(line);

    // Extract message (everything after level or timestamp)
    let message = line;
    if (timestampMatch) {
      message = line.substring(timestampMatch[0].length).trim();
    }
    if (levelMatch && message.includes(levelMatch[0])) {
      message = message.substring(message.indexOf(levelMatch[0]) + levelMatch[0].length).trim();
    }

    return {
      timestamp,
      level,
      message,
      isStackTrace
    };
  }

  /**
   * Check if line is part of a stack trace
   */
  private isStackTraceLine(line: string): boolean {
    // Java stack trace
    if (line.trim().match(/^at\s+[\w.$<>]+\(.*\)/)) {
      return true;
    }

    // Python stack trace
    if (line.trim().match(/^File ".*", line \d+/)) {
      return true;
    }

    // Node.js stack trace
    if (line.trim().match(/^\s+at\s+/)) {
      return true;
    }

    // Caused by
    if (line.trim().match(/^Caused by:/)) {
      return true;
    }

    return false;
  }

  /**
   * Group errors by similar messages
   */
  private groupErrors(errorLines: any[], allLines: string[]): ParsedError[] {
    const errorGroups = new Map<string, ParsedError>();

    let currentError: ParsedError | null = null;
    let currentStackTrace: string[] = [];

    for (let i = 0; i < allLines.length; i++) {
      const line = allLines[i];
      const parsed = this.parseLine(line);

      // Check if this is an error line
      const isError = parsed.level && ['ERROR', 'FATAL', 'CRITICAL', 'SEVERE'].includes(parsed.level);

      if (isError) {
        // Save previous error if exists
        if (currentError) {
          currentError.stackTrace = currentStackTrace.length > 0 ? currentStackTrace : undefined;
          this.addOrUpdateError(errorGroups, currentError);
        }

        // Extract error type
        const errorType = this.extractErrorType(parsed.message);

        // Start new error
        currentError = {
          timestamp: parsed.timestamp,
          level: parsed.level as any,
          message: errorType || parsed.message.substring(0, 200),
          count: 1,
          samples: [line],
          rawLines: [line],
          stackTrace: undefined
        };

        currentStackTrace = [];
      } else if (parsed.isStackTrace && currentError) {
        // Add to current error's stack trace
        currentStackTrace.push(line.trim());
        currentError.rawLines.push(line);
      } else if (currentError) {
        // Non-stack-trace line after error, save current error
        currentError.stackTrace = currentStackTrace.length > 0 ? currentStackTrace : undefined;
        this.addOrUpdateError(errorGroups, currentError);
        currentError = null;
        currentStackTrace = [];
      }
    }

    // Save last error
    if (currentError) {
      currentError.stackTrace = currentStackTrace.length > 0 ? currentStackTrace : undefined;
      this.addOrUpdateError(errorGroups, currentError);
    }

    // Convert map to array and sort by count
    return Array.from(errorGroups.values())
      .sort((a, b) => b.count - a.count);
  }

  /**
   * Extract error type from error message
   */
  private extractErrorType(message: string): string | null {
    // Java exceptions
    const javaMatch = message.match(/\b(\w+Exception|\w+Error)\b/);
    if (javaMatch) {
      return javaMatch[1];
    }

    // Python exceptions
    const pythonMatch = message.match(/^(\w+Error|Exception):/);
    if (pythonMatch) {
      return pythonMatch[1];
    }

    // Node.js errors
    const nodeMatch = message.match(/Error:\s*(.+?)(?:\n|$)/);
    if (nodeMatch) {
      return nodeMatch[1].substring(0, 100);
    }

    // Generic error message
    const genericMatch = message.match(/^([^:]+):/);
    if (genericMatch) {
      return genericMatch[1].substring(0, 100);
    }

    return null;
  }

  /**
   * Add or update error in groups
   */
  private addOrUpdateError(groups: Map<string, ParsedError>, error: ParsedError): void {
    const key = error.message;

    if (groups.has(key)) {
      const existing = groups.get(key)!;
      existing.count++;
      if (existing.samples.length < 3) {
        existing.samples.push(...error.samples);
      }
      existing.rawLines.push(...error.rawLines);

      // Update timestamp to latest
      if (error.timestamp) {
        existing.timestamp = error.timestamp;
      }
    } else {
      groups.set(key, error);
    }
  }

  /**
   * Validate pasted logs
   */
  public validate(rawLogs: string): { valid: boolean; error?: string } {
    if (!rawLogs || rawLogs.trim().length === 0) {
      return { valid: false, error: 'No logs provided' };
    }

    const lines = rawLogs.split('\n').filter(line => line.trim().length > 0);

    if (lines.length < 5) {
      return {
        valid: false,
        error: `Too few log lines (${lines.length} lines). Please paste at least 5 lines of logs.`
      };
    }

    if (lines.length > 50000) {
      return {
        valid: false,
        error: `Too many log lines (${lines.length} lines). Please limit to 50,000 lines.`
      };
    }

    // Check if logs contain any errors
    const hasErrors = lines.some(line =>
      /\b(ERROR|FATAL|CRITICAL|SEVERE|Exception|Error)\b/i.test(line)
    );

    if (!hasErrors) {
      return {
        valid: false,
        error: 'No errors detected in logs. Please paste logs containing error messages.'
      };
    }

    return { valid: true };
  }

  /**
   * Get example logs for demo
   */
  public static getExampleLogs(): string {
    return `2025-10-25 12:00:01.234 INFO  [payment-processor] Processing payment request id=pay_123
2025-10-25 12:00:02.456 INFO  [payment-processor] Validating payment details
2025-10-25 12:00:03.789 ERROR [payment-processor] NullPointerException: Customer ID cannot be null
	at com.example.payment.PaymentService.process(PaymentService.java:142)
	at com.example.payment.PaymentController.checkout(PaymentController.java:78)
	at jdk.internal.reflect.NativeMethodAccessorImpl.invoke0(Native Method)
	at java.base/jdk.internal.reflect.NativeMethodAccessorImpl.invoke(NativeMethodAccessorImpl.java:77)
2025-10-25 12:00:04.012 ERROR [payment-processor] Payment processing failed for order ord_456
2025-10-25 12:00:05.234 INFO  [payment-processor] Retrying payment with exponential backoff
2025-10-25 12:00:07.456 ERROR [payment-processor] NullPointerException: Customer ID cannot be null
	at com.example.payment.PaymentService.process(PaymentService.java:142)
	at com.example.payment.PaymentController.checkout(PaymentController.java:78)
2025-10-25 12:00:08.789 WARN  [payment-processor] Max retry attempts reached for payment pay_123
2025-10-25 12:00:09.012 ERROR [payment-processor] Failed to process payment after 3 retries
2025-10-25 12:00:10.234 ERROR [payment-processor] NullPointerException: Customer ID cannot be null
	at com.example.payment.PaymentService.process(PaymentService.java:142)
2025-10-25 12:00:12.456 INFO  [payment-processor] Payment marked as failed in database
2025-10-25 12:00:13.789 ERROR [payment-processor] TimeoutException: Database connection timeout after 30s
	at com.example.database.ConnectionPool.getConnection(ConnectionPool.java:89)
	at com.example.payment.PaymentRepository.save(PaymentRepository.java:45)
2025-10-25 12:00:15.012 ERROR [payment-processor] TimeoutException: Database connection timeout after 30s
	at com.example.database.ConnectionPool.getConnection(ConnectionPool.java:89)`;
  }
}
