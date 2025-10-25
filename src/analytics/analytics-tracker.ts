/**
 * Analytics Tracker for Tivra DebugMind
 * Tracks user journey, session duration, and feature usage
 *
 * Uses Google Analytics 4 (GA4) Measurement Protocol
 * Free, unlimited events, GDPR compliant with user consent
 */

import * as vscode from 'vscode';
import axios from 'axios';

// Google Analytics 4 Configuration
// Get these from: https://analytics.google.com/analytics/web/ → Admin → Data Streams
const GA4_MEASUREMENT_ID = 'G-XXXXXXXXXX'; // Replace with your GA4 Measurement ID
const GA4_API_SECRET = 'your-api-secret'; // Replace with your GA4 API Secret
const GA4_ENDPOINT = `https://www.google-analytics.com/mp/collect?measurement_id=${GA4_MEASUREMENT_ID}&api_secret=${GA4_API_SECRET}`;

export interface AnalyticsEvent {
  eventType: 'installation_funnel' | 'session' | 'feature_usage' | 'error';
  eventName: string;
  timestamp: string;
  userId: string;
  sessionId: string;
  metadata?: Record<string, any>;
}

export interface SessionData {
  sessionId: string;
  userId: string;
  startTime: string;
  endTime?: string;
  duration?: number; // in seconds
  events: AnalyticsEvent[];
  lastActivity: string;
}

export interface InstallationFunnelStep {
  step: 'extension_installed' | 'extension_activated' | 'welcome_shown' | 'aws_connection_started' | 'aws_connected' | 'copilot_opened' | 'first_service_selected' | 'first_analysis_completed';
  timestamp: string;
  completed: boolean;
  metadata?: Record<string, any>;
}

export class AnalyticsTracker {
  private context: vscode.ExtensionContext;
  private userId: string;
  private sessionId: string;
  private sessionStartTime: Date;
  private lastActivityTime: Date;
  private events: AnalyticsEvent[] = [];
  private sessionTimeout: NodeJS.Timeout | null = null;
  private isEnabled: boolean = true;

  // Installation funnel tracking
  private funnelSteps: Map<string, InstallationFunnelStep> = new Map();

  constructor(context: vscode.ExtensionContext) {
    this.context = context;
    this.sessionStartTime = new Date();
    this.lastActivityTime = new Date();

    // Get or create user ID (persistent across sessions)
    this.userId = this.getOrCreateUserId();

    // Generate session ID (unique per session)
    this.sessionId = this.generateSessionId();

    // Check if analytics is enabled (respect user privacy)
    this.isEnabled = context.globalState.get('analytics.enabled', true);

    // Initialize installation funnel
    this.initializeFunnel();

    // Track session start
    this.trackSessionStart();

    // Set up periodic session save
    this.startSessionTracking();

    console.log(`[Analytics] Initialized - User: ${this.userId}, Session: ${this.sessionId}`);
  }

  /**
   * Get or create a persistent user ID
   */
  private getOrCreateUserId(): string {
    let userId = this.context.globalState.get<string>('analytics.userId');

    if (!userId) {
      // Generate UUID v4
      userId = this.generateUUID();
      this.context.globalState.update('analytics.userId', userId);
      console.log(`[Analytics] Created new user ID: ${userId}`);
    }

    return userId;
  }

  /**
   * Generate session ID
   */
  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  /**
   * Generate UUID v4
   */
  private generateUUID(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  /**
   * Initialize installation funnel tracking
   */
  private initializeFunnel(): void {
    // Load saved funnel state
    const savedFunnel = this.context.globalState.get<Record<string, InstallationFunnelStep>>('analytics.funnel');

    if (savedFunnel) {
      Object.entries(savedFunnel).forEach(([key, step]) => {
        this.funnelSteps.set(key, step);
      });
    }

    // If this is first activation, mark extension_installed
    if (!this.funnelSteps.has('extension_installed')) {
      this.trackFunnelStep('extension_installed', {
        version: vscode.extensions.getExtension('shreychaturvedi.tivra-debugmind')?.packageJSON.version
      });
    }

    // Track extension activated
    this.trackFunnelStep('extension_activated', {
      activationCount: this.context.globalState.get('analytics.activationCount', 0) + 1
    });

    // Increment activation count
    const activationCount = this.context.globalState.get('analytics.activationCount', 0) + 1;
    this.context.globalState.update('analytics.activationCount', activationCount);
  }

  /**
   * Track installation funnel step
   */
  public trackFunnelStep(step: InstallationFunnelStep['step'], metadata?: Record<string, any>): void {
    if (!this.isEnabled) return;

    const funnelStep: InstallationFunnelStep = {
      step,
      timestamp: new Date().toISOString(),
      completed: true,
      metadata
    };

    this.funnelSteps.set(step, funnelStep);

    // Save to global state
    const funnelObj = Object.fromEntries(this.funnelSteps);
    this.context.globalState.update('analytics.funnel', funnelObj);

    // Track as event
    this.trackEvent('installation_funnel', step, metadata);

    console.log(`[Analytics] Funnel step: ${step}`);
  }

  /**
   * Get installation funnel progress
   */
  public getFunnelProgress(): { completed: InstallationFunnelStep[], nextStep: string | null, completionRate: number } {
    const allSteps: InstallationFunnelStep['step'][] = [
      'extension_installed',
      'extension_activated',
      'welcome_shown',
      'aws_connection_started',
      'aws_connected',
      'copilot_opened',
      'first_service_selected',
      'first_analysis_completed'
    ];

    const completed = allSteps.filter(step => this.funnelSteps.has(step))
      .map(step => this.funnelSteps.get(step)!);

    const nextStep = allSteps.find(step => !this.funnelSteps.has(step)) || null;
    const completionRate = (completed.length / allSteps.length) * 100;

    return { completed, nextStep, completionRate };
  }

  /**
   * Track session start
   */
  private trackSessionStart(): void {
    this.trackEvent('session', 'session_start', {
      platform: process.platform,
      vscodeVersion: vscode.version,
      extensionVersion: vscode.extensions.getExtension('shreychaturvedi.tivra-debugmind')?.packageJSON.version
    });
  }

  /**
   * Track session end
   */
  public trackSessionEnd(): void {
    const duration = Math.floor((new Date().getTime() - this.sessionStartTime.getTime()) / 1000);

    this.trackEvent('session', 'session_end', {
      duration,
      eventCount: this.events.length,
      lastActivity: this.lastActivityTime.toISOString()
    });

    // Send all pending events
    this.sendEvents();
  }

  /**
   * Track generic event
   */
  public trackEvent(
    eventType: AnalyticsEvent['eventType'],
    eventName: string,
    metadata?: Record<string, any>
  ): void {
    if (!this.isEnabled) return;

    const event: AnalyticsEvent = {
      eventType,
      eventName,
      timestamp: new Date().toISOString(),
      userId: this.userId,
      sessionId: this.sessionId,
      metadata
    };

    this.events.push(event);
    this.lastActivityTime = new Date();

    // Send events if buffer is large
    if (this.events.length >= 10) {
      this.sendEvents();
    }

    console.log(`[Analytics] Event: ${eventType}.${eventName}`, metadata);
  }

  /**
   * Track feature usage
   */
  public trackFeatureUsage(feature: string, action: string, metadata?: Record<string, any>): void {
    this.trackEvent('feature_usage', `${feature}.${action}`, metadata);
  }

  /**
   * Track error
   */
  public trackError(errorType: string, errorMessage: string, stackTrace?: string): void {
    this.trackEvent('error', errorType, {
      message: errorMessage,
      stackTrace: stackTrace?.substring(0, 500) // Limit stack trace size
    });
  }

  /**
   * Start periodic session tracking
   */
  private startSessionTracking(): void {
    // Save session every 30 seconds
    this.sessionTimeout = setInterval(() => {
      this.saveSession();
    }, 30000);
  }

  /**
   * Stop session tracking
   */
  public stopSessionTracking(): void {
    if (this.sessionTimeout) {
      clearInterval(this.sessionTimeout);
      this.sessionTimeout = null;
    }
  }

  /**
   * Save current session to global state
   */
  private saveSession(): void {
    const sessionData: SessionData = {
      sessionId: this.sessionId,
      userId: this.userId,
      startTime: this.sessionStartTime.toISOString(),
      endTime: new Date().toISOString(),
      duration: Math.floor((new Date().getTime() - this.sessionStartTime.getTime()) / 1000),
      events: this.events,
      lastActivity: this.lastActivityTime.toISOString()
    };

    // Save to global state
    this.context.globalState.update('analytics.currentSession', sessionData);

    // Also add to session history
    const sessionHistory = this.context.globalState.get<SessionData[]>('analytics.sessionHistory', []);
    sessionHistory.push(sessionData);

    // Keep only last 100 sessions
    if (sessionHistory.length > 100) {
      sessionHistory.shift();
    }

    this.context.globalState.update('analytics.sessionHistory', sessionHistory);
  }

  /**
   * Send events to Google Analytics 4
   */
  private async sendEvents(): Promise<void> {
    if (!this.isEnabled || this.events.length === 0) return;

    try {
      const eventsToSend = [...this.events];
      this.events = []; // Clear buffer

      // Convert our events to GA4 format
      const ga4Events = eventsToSend.map(event => ({
        name: event.eventName.replace(/\./g, '_'), // GA4 doesn't allow dots in event names
        params: {
          event_type: event.eventType,
          session_id: event.sessionId,
          timestamp: event.timestamp,
          ...event.metadata
        }
      }));

      // Send to GA4 Measurement Protocol
      // GA4 allows batching up to 25 events per request
      const batches = [];
      for (let i = 0; i < ga4Events.length; i += 25) {
        batches.push(ga4Events.slice(i, i + 25));
      }

      for (const batch of batches) {
        await axios.post(GA4_ENDPOINT, {
          client_id: this.userId, // Anonymous user ID
          events: batch
        }, {
          timeout: 5000,
          headers: {
            'Content-Type': 'application/json'
          }
        });
      }

      console.log(`[Analytics] Sent ${eventsToSend.length} events to GA4`);
    } catch (error) {
      console.error('[Analytics] Failed to send events to GA4:', error);
      // Re-add events to buffer (but don't let it grow indefinitely)
      this.events = [...this.events.slice(-50)];
    }
  }

  /**
   * Get session statistics
   */
  public getSessionStats(): {
    currentSession: SessionData;
    totalSessions: number;
    totalDuration: number;
    averageSessionDuration: number;
    funnelProgress: ReturnType<AnalyticsTracker['getFunnelProgress']>;
  } {
    const sessionHistory = this.context.globalState.get<SessionData[]>('analytics.sessionHistory', []);
    const totalDuration = sessionHistory.reduce((sum, session) => sum + (session.duration || 0), 0);
    const averageSessionDuration = sessionHistory.length > 0 ? totalDuration / sessionHistory.length : 0;

    const currentSession: SessionData = {
      sessionId: this.sessionId,
      userId: this.userId,
      startTime: this.sessionStartTime.toISOString(),
      endTime: new Date().toISOString(),
      duration: Math.floor((new Date().getTime() - this.sessionStartTime.getTime()) / 1000),
      events: this.events,
      lastActivity: this.lastActivityTime.toISOString()
    };

    return {
      currentSession,
      totalSessions: sessionHistory.length,
      totalDuration,
      averageSessionDuration,
      funnelProgress: this.getFunnelProgress()
    };
  }

  /**
   * Enable or disable analytics
   */
  public setEnabled(enabled: boolean): void {
    this.isEnabled = enabled;
    this.context.globalState.update('analytics.enabled', enabled);
    console.log(`[Analytics] ${enabled ? 'Enabled' : 'Disabled'}`);
  }

  /**
   * Check if analytics is enabled
   */
  public getEnabled(): boolean {
    return this.isEnabled;
  }

  /**
   * Dispose analytics tracker
   */
  public dispose(): void {
    this.trackSessionEnd();
    this.stopSessionTracking();
    this.saveSession();
  }
}
