import axios, { AxiosInstance } from 'axios';

export interface AWSService {
  id: string;
  name: string;
  type: string;
  errorRate: number;
  invocations24h?: number;
  metadata?: any;
}

export interface ServiceAnalysis {
  service: {
    name: string;
    type: string;
  };
  metrics: {
    errorRate: number;
    errorCount: number;
    latency?: {
      p50: number;
      p95: number;
      p99: number;
    };
    throughput?: number;
    cpuUtilization?: number;
    memoryUtilization?: number;
  };
  logs: {
    totalErrors: number;
    errorPatterns: Array<{
      message: string;
      count: number;
      stackTrace?: string;
      samples: string[];
      firstSeen?: number;
      lastSeen?: number;
    }>;
  };
  traces?: {
    totalTraces: number;
    errorTraces: number;
    serviceDependencies: string[];
    p50Latency?: number;
    p95Latency?: number;
    p99Latency?: number;
  };
  rootCause?: {
    summary: string;
    confidence: string;
    suggestedFix: string;
  };
  recommendations?: Array<{
    action: string;
    priority: string;
    rationale: string;
  }>;
}

export class TivraClient {
  private client: AxiosInstance;

  constructor(baseURL: string) {
    this.client = axios.create({
      baseURL,
      timeout: 30000
    });
  }

  async checkConnection(): Promise<boolean> {
    try {
      const response = await this.client.get('/api/aws/status');
      return response.data.connected === true;
    } catch (error) {
      console.error('Tivra connection check failed:', error);
      return false;
    }
  }

  async connect(accessKeyId: string, secretAccessKey: string, region: string): Promise<any> {
    try {
      const response = await this.client.post('/api/aws/connect', {
        accessKeyId,
        secretAccessKey,
        region
      });
      return response.data;
    } catch (error: any) {
      return { ok: false, error: error.message };
    }
  }

  async disconnect(): Promise<boolean> {
    try {
      const response = await this.client.post('/api/aws/disconnect');
      return response.data.ok === true;
    } catch (error) {
      console.error('Tivra disconnect failed:', error);
      return false;
    }
  }

  async discoverServices(): Promise<AWSService[]> {
    try {
      const response = await this.client.get('/api/aws/services/discover');
      return response.data.services || [];
    } catch (error) {
      console.error('Service discovery failed:', error);
      return [];
    }
  }

  async analyzeService(serviceName: string, serviceType: string): Promise<ServiceAnalysis | null> {
    try {
      const response = await this.client.post('/api/aws/analyze', {
        serviceName,
        serviceType
      });
      return response.data.analysis;
    } catch (error) {
      console.error('Service analysis failed:', error);
      return null;
    }
  }

  async getLogs(serviceName: string, serviceType: string): Promise<any> {
    try {
      const response = await this.client.get('/api/aws/logs', {
        params: { serviceName, serviceType }
      });
      return response.data;
    } catch (error) {
      console.error('Get logs failed:', error);
      return null;
    }
  }

  async getMetrics(serviceName: string, serviceType: string): Promise<any> {
    try {
      const response = await this.client.get('/api/aws/metrics', {
        params: { serviceName, serviceType }
      });
      return response.data;
    } catch (error) {
      console.error('Get metrics failed:', error);
      return null;
    }
  }

  async getXRay(serviceName: string): Promise<any> {
    try {
      const response = await this.client.get('/api/aws/xray', {
        params: { serviceName }
      });
      return response.data;
    } catch (error) {
      console.error('Get X-Ray failed:', error);
      return null;
    }
  }

  // REMOVED: proposeFix() and createPR() methods
  // These called old duplicate endpoints (/api/aws/propose-fix, /api/aws/create-pr)
  // Use the unified SRE agent flow instead:
  // 1. POST /api/sre-agent/investigate (Steps 1-5: Trigger → Context → RCA → Fix)
  // 2. POST /api/v2/approve-fix (Step 6: Human approval)
  // 3. POST /api/v2/apply-fix (Step 7: Apply fix & create PR)
  // 4. POST /api/v2/store-learnings (Step 8: Store in Debug Memory)
}
