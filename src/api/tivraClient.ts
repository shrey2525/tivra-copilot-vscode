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

  async proposeFix(
    serviceName: string,
    serviceType: string,
    analysis: ServiceAnalysis,
    githubOwner: string,
    githubRepo: string
  ): Promise<any> {
    try {
      const response = await this.client.post('/api/aws/propose-fix', {
        serviceName,
        serviceType,
        analysis,
        githubOwner,
        githubRepo
      });
      return response.data;
    } catch (error) {
      console.error('Propose fix failed:', error);
      return null;
    }
  }

  async createPR(
    serviceName: string,
    serviceType: string,
    fix: any,
    githubOwner: string,
    githubRepo: string,
    analysis: ServiceAnalysis
  ): Promise<any> {
    try {
      const response = await this.client.post('/api/aws/create-pr', {
        serviceName,
        serviceType,
        fix,
        githubOwner,
        githubRepo,
        analysis
      });
      return response.data;
    } catch (error) {
      console.error('Create PR failed:', error);
      return null;
    }
  }
}
