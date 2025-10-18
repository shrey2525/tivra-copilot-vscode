// Simplified Logs-Only Client for v1.0
// Focus on CloudWatch Logs analysis without metrics/traces

import axios from 'axios';

export interface LogEntry {
  timestamp: string;
  message: string;
  level: 'ERROR' | 'WARN' | 'INFO';
  stackTrace?: string;
  count?: number;
  service: string;
}

export interface LogsAnalysis {
  service: string;
  serviceType: string;
  totalErrors: number;
  timeRange: {
    start: number;
    end: number;
  };
  errors: LogEntry[];
  summary: string;
}

export class LogsClient {
  constructor(private apiUrl: string) {}

  /**
   * Fetch and analyze CloudWatch logs for a service
   */
  async analyzeLogs(serviceName: string, serviceType: string): Promise<LogsAnalysis> {
    try {
      const response = await axios.post(`${this.apiUrl}/api/aws/logs/analyze`, {
        serviceName,
        serviceType,
        timeRange: {
          start: Date.now() - 60 * 60 * 1000, // Last hour
          end: Date.now()
        }
      }, {
        timeout: 30000
      });

      return response.data;
    } catch (error: any) {
      if (error.response?.status === 404) {
        throw new Error('Logs endpoint not found. Please update your backend.');
      }
      throw new Error(error.response?.data?.error || error.message);
    }
  }

  /**
   * Stream logs in real-time (for monitoring)
   */
  async streamLogs(serviceName: string, callback: (log: LogEntry) => void): Promise<() => void> {
    // TODO: Implement WebSocket streaming
    // For now, poll every 10 seconds
    const interval = setInterval(async () => {
      try {
        const analysis = await this.analyzeLogs(serviceName, 'lambda');
        if (analysis.errors.length > 0) {
          callback(analysis.errors[0]);
        }
      } catch (error) {
        console.error('Stream error:', error);
      }
    }, 10000);

    return () => clearInterval(interval);
  }
}
