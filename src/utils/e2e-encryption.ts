// Client-Side E2E Encryption Utilities
// Implements ECDH key exchange + AES-256-GCM encryption

import * as crypto from 'crypto';
import axios from 'axios';

export interface EncryptedPayload {
  ciphertext: string;
  nonce: string;
  authTag: string;
  timestamp: number;
}

export interface SecureSession {
  sessionId: string;
  ecdh: crypto.ECDH;
  publicKey: Buffer;
  sharedSecret: Buffer | null;
  aesKey: Buffer | null;
  serverPublicKey: Buffer | null;
  createdAt: number;
}

export class E2EEncryption {
  private session: SecureSession | null = null;
  private apiUrl: string;

  constructor(apiUrl: string) {
    this.apiUrl = apiUrl;
  }

  /**
   * Initialize secure session with server
   */
  async initiateSession(): Promise<boolean> {
    try {
      console.log('[E2E] Initiating secure session...');

      // Request session from server
      const response = await axios.post(`${this.apiUrl}/api/encryption/initiate`);

      if (!response.data.success) {
        console.error('[E2E] Session initiation failed:', response.data.error);
        return false;
      }

      const { sessionId, serverPublicKey } = response.data;

      // Generate client's ECDH key pair
      const clientECDH = crypto.createECDH('prime256v1');
      const clientPublicKey = clientECDH.generateKeys();

      // Store session data
      this.session = {
        sessionId,
        ecdh: clientECDH,
        publicKey: clientPublicKey,
        sharedSecret: null,
        aesKey: null,
        serverPublicKey: Buffer.from(serverPublicKey, 'base64'),
        createdAt: Date.now()
      };

      // Complete key exchange
      const exchangeResponse = await axios.post(`${this.apiUrl}/api/encryption/exchange`, {
        sessionId,
        clientPublicKey: clientPublicKey.toString('base64')
      });

      if (!exchangeResponse.data.success) {
        console.error('[E2E] Key exchange failed:', exchangeResponse.data.error);
        this.session = null;
        return false;
      }

      // Compute shared secret
      if (!this.session.serverPublicKey) {
        throw new Error('Server public key is missing');
      }
      this.session.sharedSecret = this.session.ecdh.computeSecret(this.session.serverPublicKey);

      // Derive AES key using HKDF
      this.session.aesKey = Buffer.from(crypto.hkdfSync(
        'sha256',
        this.session.sharedSecret,
        Buffer.from(sessionId, 'hex'),
        Buffer.from('tivra-debugmind-v1'),
        32 // 256 bits
      ));

      console.log('✅ [E2E] Secure session established:', sessionId);
      return true;

    } catch (err: any) {
      console.error('[E2E] Session initialization failed:', err.message);
      this.session = null;
      return false;
    }
  }

  /**
   * Encrypt data using AES-256-GCM
   */
  encrypt(data: any): EncryptedPayload | null {
    if (!this.session || !this.session.aesKey) {
      console.error('[E2E] Cannot encrypt: No active session');
      return null;
    }

    try {
      // Generate random 12-byte nonce
      const nonce = crypto.randomBytes(12);

      // Create cipher
      const cipher = crypto.createCipheriv('aes-256-gcm', this.session.aesKey, nonce);

      // Convert data to JSON if it's an object
      const plaintext = typeof data === 'string' ? data : JSON.stringify(data);

      // Encrypt
      let encrypted = cipher.update(plaintext, 'utf8', 'base64');
      encrypted += cipher.final('base64');

      // Get authentication tag
      const authTag = cipher.getAuthTag();

      return {
        ciphertext: encrypted,
        nonce: nonce.toString('base64'),
        authTag: authTag.toString('base64'),
        timestamp: Date.now()
      };

    } catch (err: any) {
      console.error('[E2E] Encryption failed:', err.message);
      return null;
    }
  }

  /**
   * Decrypt data using AES-256-GCM
   */
  decrypt(encryptedPayload: EncryptedPayload): any {
    if (!this.session || !this.session.aesKey) {
      console.error('[E2E] Cannot decrypt: No active session');
      return null;
    }

    try {
      const { ciphertext, nonce, authTag } = encryptedPayload;

      // Create decipher
      const decipher = crypto.createDecipheriv(
        'aes-256-gcm',
        this.session.aesKey,
        Buffer.from(nonce, 'base64')
      );

      // Set authentication tag
      decipher.setAuthTag(Buffer.from(authTag, 'base64'));

      // Decrypt
      let decrypted = decipher.update(ciphertext, 'base64', 'utf8');
      decrypted += decipher.final('utf8');

      // Try to parse as JSON
      try {
        return JSON.parse(decrypted);
      } catch {
        return decrypted;
      }

    } catch (err: any) {
      console.error('[E2E] Decryption failed:', err.message);
      return null;
    }
  }

  /**
   * Get current session ID
   */
  getSessionId(): string | null {
    return this.session?.sessionId || null;
  }

  /**
   * Check if session is active
   */
  isSessionActive(): boolean {
    return this.session !== null && this.session.aesKey !== null;
  }

  /**
   * Destroy session and clear keys
   */
  async destroySession(): Promise<void> {
    if (!this.session) {
      return;
    }

    try {
      // Notify server
      await axios.delete(`${this.apiUrl}/api/encryption/session/${this.session.sessionId}`);
    } catch (err) {
      console.error('[E2E] Failed to notify server of session destruction:', err);
    }

    // Clear sensitive data
    if (this.session.aesKey) {
      this.session.aesKey.fill(0);
    }
    if (this.session.sharedSecret) {
      this.session.sharedSecret.fill(0);
    }

    this.session = null;
    console.log('🗑️  [E2E] Session destroyed');
  }

  /**
   * Send encrypted request to server
   */
  async sendEncryptedRequest(endpoint: string, data: any, method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'POST'): Promise<any> {
    if (!this.isSessionActive()) {
      console.error('[E2E] No active session for encrypted request');
      throw new Error('No active encryption session');
    }

    const encrypted = this.encrypt(data);
    if (!encrypted) {
      throw new Error('Encryption failed');
    }

    const response = await axios({
      method,
      url: `${this.apiUrl}${endpoint}`,
      data: {
        sessionId: this.session!.sessionId,
        encrypted
      },
      headers: {
        'X-Encrypted': 'true',
        'X-Session-Id': this.session!.sessionId
      }
    });

    // Decrypt response if encrypted
    if (response.data.encrypted) {
      return this.decrypt(response.data.encrypted);
    }

    return response.data;
  }
}

export default E2EEncryption;
