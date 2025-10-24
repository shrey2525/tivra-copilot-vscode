// Credential Manager for Tivra DebugMind
// Securely stores AWS credentials using VS Code SecretStorage API
// Supports both manual AWS keys and SSO tokens

import * as vscode from 'vscode';

export interface AWSManualCredentials {
  type: 'manual';
  accessKeyId: string;
  secretAccessKey: string;
  region: string;
}

export interface AWSSSOCredentials {
  type: 'sso';
  accessToken: string;
  accountId: string;
  roleName: string;
  region: string;
  expiresAt: number; // Unix timestamp
}

export type AWSCredentials = AWSManualCredentials | AWSSSOCredentials;

export class CredentialManager {
  private static readonly MANUAL_ACCESS_KEY_ID = 'tivra.aws.manual.accessKeyId';
  private static readonly MANUAL_SECRET_ACCESS_KEY = 'tivra.aws.manual.secretAccessKey';
  private static readonly MANUAL_REGION = 'tivra.aws.manual.region';

  private static readonly SSO_ACCESS_TOKEN = 'tivra.aws.sso.accessToken';
  private static readonly SSO_ACCOUNT_ID = 'tivra.aws.sso.accountId';
  private static readonly SSO_ROLE_NAME = 'tivra.aws.sso.roleName';
  private static readonly SSO_REGION = 'tivra.aws.sso.region';
  private static readonly SSO_EXPIRES_AT = 'tivra.aws.sso.expiresAt';

  private static readonly CREDENTIAL_TYPE = 'tivra.aws.credentialType';

  constructor(private secrets: vscode.SecretStorage) {}

  /**
   * Store manual AWS credentials (access key + secret key)
   */
  async storeManualCredentials(credentials: Omit<AWSManualCredentials, 'type'>): Promise<void> {
    try {
      await this.secrets.store(CredentialManager.MANUAL_ACCESS_KEY_ID, credentials.accessKeyId);
      await this.secrets.store(CredentialManager.MANUAL_SECRET_ACCESS_KEY, credentials.secretAccessKey);
      await this.secrets.store(CredentialManager.MANUAL_REGION, credentials.region);
      await this.secrets.store(CredentialManager.CREDENTIAL_TYPE, 'manual');

      console.log('[CredentialManager] Manual AWS credentials stored securely');
    } catch (error) {
      console.error('[CredentialManager] Failed to store manual credentials:', error);
      throw new Error('Failed to store AWS credentials securely');
    }
  }

  /**
   * Store SSO credentials (access token + account info)
   */
  async storeSSOCredentials(credentials: Omit<AWSSSOCredentials, 'type'>): Promise<void> {
    try {
      await this.secrets.store(CredentialManager.SSO_ACCESS_TOKEN, credentials.accessToken);
      await this.secrets.store(CredentialManager.SSO_ACCOUNT_ID, credentials.accountId);
      await this.secrets.store(CredentialManager.SSO_ROLE_NAME, credentials.roleName);
      await this.secrets.store(CredentialManager.SSO_REGION, credentials.region);
      await this.secrets.store(CredentialManager.SSO_EXPIRES_AT, credentials.expiresAt.toString());
      await this.secrets.store(CredentialManager.CREDENTIAL_TYPE, 'sso');

      console.log('[CredentialManager] SSO credentials stored securely');
    } catch (error) {
      console.error('[CredentialManager] Failed to store SSO credentials:', error);
      throw new Error('Failed to store SSO credentials securely');
    }
  }

  /**
   * Get stored AWS credentials (either manual or SSO)
   */
  async getCredentials(): Promise<AWSCredentials | null> {
    try {
      const credentialType = await this.secrets.get(CredentialManager.CREDENTIAL_TYPE);

      if (!credentialType) {
        console.log('[CredentialManager] No credentials stored');
        return null;
      }

      if (credentialType === 'manual') {
        return await this.getManualCredentials();
      } else if (credentialType === 'sso') {
        return await this.getSSOCredentials();
      }

      console.warn('[CredentialManager] Unknown credential type:', credentialType);
      return null;
    } catch (error) {
      console.error('[CredentialManager] Failed to retrieve credentials:', error);
      return null;
    }
  }

  /**
   * Get manual AWS credentials
   */
  private async getManualCredentials(): Promise<AWSManualCredentials | null> {
    const accessKeyId = await this.secrets.get(CredentialManager.MANUAL_ACCESS_KEY_ID);
    const secretAccessKey = await this.secrets.get(CredentialManager.MANUAL_SECRET_ACCESS_KEY);
    const region = await this.secrets.get(CredentialManager.MANUAL_REGION);

    if (!accessKeyId || !secretAccessKey || !region) {
      console.log('[CredentialManager] Incomplete manual credentials');
      return null;
    }

    return {
      type: 'manual',
      accessKeyId,
      secretAccessKey,
      region
    };
  }

  /**
   * Get SSO credentials
   */
  private async getSSOCredentials(): Promise<AWSSSOCredentials | null> {
    const accessToken = await this.secrets.get(CredentialManager.SSO_ACCESS_TOKEN);
    const accountId = await this.secrets.get(CredentialManager.SSO_ACCOUNT_ID);
    const roleName = await this.secrets.get(CredentialManager.SSO_ROLE_NAME);
    const region = await this.secrets.get(CredentialManager.SSO_REGION);
    const expiresAtStr = await this.secrets.get(CredentialManager.SSO_EXPIRES_AT);

    if (!accessToken || !accountId || !roleName || !region || !expiresAtStr) {
      console.log('[CredentialManager] Incomplete SSO credentials');
      return null;
    }

    const expiresAt = parseInt(expiresAtStr, 10);

    // Check if token is expired
    if (Date.now() >= expiresAt) {
      console.log('[CredentialManager] SSO token expired');
      await this.clearCredentials(); // Clean up expired credentials
      return null;
    }

    return {
      type: 'sso',
      accessToken,
      accountId,
      roleName,
      region,
      expiresAt
    };
  }

  /**
   * Check if SSO credentials are expired
   */
  async isSSOTokenExpired(): Promise<boolean> {
    const credentials = await this.getCredentials();

    if (!credentials || credentials.type !== 'sso') {
      return false;
    }

    return Date.now() >= credentials.expiresAt;
  }

  /**
   * Get time until SSO token expires (in milliseconds)
   */
  async getTimeUntilExpiry(): Promise<number | null> {
    const credentials = await this.getCredentials();

    if (!credentials || credentials.type !== 'sso') {
      return null;
    }

    const timeLeft = credentials.expiresAt - Date.now();
    return timeLeft > 0 ? timeLeft : 0;
  }

  /**
   * Check if any credentials are stored
   */
  async hasCredentials(): Promise<boolean> {
    const credentials = await this.getCredentials();
    return credentials !== null;
  }

  /**
   * Get credential type (manual or sso)
   */
  async getCredentialType(): Promise<'manual' | 'sso' | null> {
    const type = await this.secrets.get(CredentialManager.CREDENTIAL_TYPE);
    return type as 'manual' | 'sso' | null;
  }

  /**
   * Clear all stored credentials
   */
  async clearCredentials(): Promise<void> {
    try {
      // Clear manual credentials
      await this.secrets.delete(CredentialManager.MANUAL_ACCESS_KEY_ID);
      await this.secrets.delete(CredentialManager.MANUAL_SECRET_ACCESS_KEY);
      await this.secrets.delete(CredentialManager.MANUAL_REGION);

      // Clear SSO credentials
      await this.secrets.delete(CredentialManager.SSO_ACCESS_TOKEN);
      await this.secrets.delete(CredentialManager.SSO_ACCOUNT_ID);
      await this.secrets.delete(CredentialManager.SSO_ROLE_NAME);
      await this.secrets.delete(CredentialManager.SSO_REGION);
      await this.secrets.delete(CredentialManager.SSO_EXPIRES_AT);

      // Clear credential type
      await this.secrets.delete(CredentialManager.CREDENTIAL_TYPE);

      console.log('[CredentialManager] All credentials cleared');
    } catch (error) {
      console.error('[CredentialManager] Failed to clear credentials:', error);
      throw new Error('Failed to clear credentials');
    }
  }

  /**
   * Update SSO token (for token refresh)
   */
  async updateSSOToken(accessToken: string, expiresAt: number): Promise<void> {
    try {
      await this.secrets.store(CredentialManager.SSO_ACCESS_TOKEN, accessToken);
      await this.secrets.store(CredentialManager.SSO_EXPIRES_AT, expiresAt.toString());

      console.log('[CredentialManager] SSO token updated');
    } catch (error) {
      console.error('[CredentialManager] Failed to update SSO token:', error);
      throw new Error('Failed to update SSO token');
    }
  }

  /**
   * Migrate credentials from workspace config to secret storage
   * (Helper for upgrading existing users)
   */
  async migrateFromWorkspaceConfig(): Promise<boolean> {
    try {
      const config = vscode.workspace.getConfiguration('tivra');
      const accessKeyId = config.get<string>('awsAccessKeyId');
      const secretAccessKey = config.get<string>('awsSecretAccessKey');
      const region = config.get<string>('awsRegion') || 'us-east-1';

      if (accessKeyId && secretAccessKey) {
        console.log('[CredentialManager] Migrating credentials from workspace config to secret storage');

        await this.storeManualCredentials({
          accessKeyId,
          secretAccessKey,
          region
        });

        // Clear from workspace config
        await config.update('awsAccessKeyId', undefined, vscode.ConfigurationTarget.Global);
        await config.update('awsSecretAccessKey', undefined, vscode.ConfigurationTarget.Global);

        vscode.window.showInformationMessage(
          '🔒 AWS credentials have been migrated to secure storage!'
        );

        return true;
      }

      return false;
    } catch (error) {
      console.error('[CredentialManager] Failed to migrate credentials:', error);
      return false;
    }
  }
}
