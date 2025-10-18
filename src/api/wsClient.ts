import * as vscode from 'vscode';
import WebSocket from 'ws';

export interface ServiceUpdate {
  type: 'serviceUpdate';
  serviceName: string;
  analysis: any;
}

export class TivraWebSocketClient {
  private ws?: WebSocket;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectTimeout?: NodeJS.Timeout;
  private isConnecting = false;

  constructor(
    private url: string,
    private onUpdate: (data: ServiceUpdate) => void,
    private onConnectionChange: (connected: boolean) => void
  ) {}

  connect(): void {
    if (this.isConnecting) {
      console.log('WebSocket connection already in progress');
      return;
    }

    this.isConnecting = true;

    try {
      this.ws = new WebSocket(this.url);

      this.ws.on('open', () => {
        console.log('Connected to Tivra WebSocket');
        this.reconnectAttempts = 0;
        this.isConnecting = false;
        this.onConnectionChange(true);

        vscode.window.showInformationMessage('🔗 Tivra CoPilot: Real-time monitoring enabled');
      });

      this.ws.on('message', (data) => {
        try {
          const message = JSON.parse(data.toString());

          if (message.type === 'subscribed') {
            console.log(`Subscribed to updates for ${message.service}`);
          } else if (message.type === 'serviceUpdate') {
            this.onUpdate(message as ServiceUpdate);

            // Show notification for new high-severity errors
            const errorRate = message.analysis?.metrics?.errorRate || 0;
            if (errorRate > 5) {
              vscode.window.showWarningMessage(
                `⚠️ ${message.serviceName}: Error rate spike to ${errorRate.toFixed(1)}%`,
                'Analyze Now',
                'Generate Fix',
                'Dismiss'
              ).then(choice => {
                if (choice === 'Analyze Now') {
                  vscode.commands.executeCommand('tivra.showRuntimeContext');
                } else if (choice === 'Generate Fix') {
                  vscode.commands.executeCommand('tivra.generateFix', message.analysis);
                }
              });
            }
          }
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error);
        }
      });

      this.ws.on('close', () => {
        console.log('Disconnected from Tivra WebSocket');
        this.isConnecting = false;
        this.onConnectionChange(false);
        this.reconnect();
      });

      this.ws.on('error', (error) => {
        console.error('WebSocket error:', error);
        this.isConnecting = false;
      });
    } catch (error) {
      console.error('Failed to create WebSocket connection:', error);
      this.isConnecting = false;
      this.reconnect();
    }
  }

  private reconnect(): void {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
    }

    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      const delay = Math.pow(2, this.reconnectAttempts) * 1000; // Exponential backoff

      console.log(`Reconnecting to WebSocket in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);

      this.reconnectTimeout = setTimeout(() => {
        this.connect();
      }, delay);
    } else {
      vscode.window.showWarningMessage(
        'Failed to connect to Tivra WebSocket after multiple attempts. Real-time updates disabled.',
        'Retry'
      ).then(choice => {
        if (choice === 'Retry') {
          this.reconnectAttempts = 0;
          this.connect();
        }
      });
    }
  }

  subscribe(serviceName: string): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        type: 'subscribe',
        serviceName
      }));
      console.log(`Subscribed to updates for ${serviceName}`);
    } else {
      console.warn('Cannot subscribe: WebSocket not connected');
    }
  }

  unsubscribe(serviceName: string): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        type: 'unsubscribe',
        serviceName
      }));
      console.log(`Unsubscribed from updates for ${serviceName}`);
    }
  }

  disconnect(): void {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
    }

    if (this.ws) {
      this.ws.close();
      this.ws = undefined;
    }

    this.reconnectAttempts = 0;
    this.isConnecting = false;
  }

  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }
}
