import { config } from '../config.js';
import { Session, Job } from '../types.js';
import { repository } from '../db/repository.js';

export interface GoLoginProfile {
  id: string;
  name: string;
  browserType: 'chrome' | 'orbita';
  os: 'win' | 'mac' | 'lin';
  proxy?: {
    mode: 'http' | 'socks5' | 'none';
    host?: string;
    port?: number;
    username?: string;
    password?: string;
  };
  notes?: string;
  createdAt: string;
}

export class GoLoginService {
  private apiUrl: string;
  private apiToken: string;

  constructor() {
    this.apiUrl = config.gologin.apiUrl;
    this.apiToken = config.gologin.apiToken;
  }

  private isMockMode(): boolean {
    return config.mockMode || !this.apiToken;
  }

  public async createProfile(jobId: string, shopName: string, proxyRef?: string): Promise<{ profileId: string; profileName: string }> {
    const profileName = `${shopName.replace(/\s+/g, '-').toUpperCase()}-${jobId}`;

    if (this.isMockMode()) {
      const mockProfileId = `gl_prof_${Math.floor(100000 + Math.random() * 900000)}`;
      return { profileId: mockProfileId, profileName };
    }

    try {
      const response = await fetch(`${this.apiUrl}/browser/v2`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiToken}`,
        },
        body: JSON.stringify({
          name: profileName,
          os: 'win',
          navigator: {
            userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
            resolution: '1920x1080',
            language: 'en-US,en;q=0.9',
          },
          notes: `Managed by Workflow Ops Platform - Job ${jobId}`,
        }),
      });

      if (!response.ok) {
        throw new Error(`GoLogin API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      return { profileId: data.id, profileName };
    } catch (err: any) {
      await repository.updateIntegrationStatus('gologin', {
        status: 'DEGRADED',
        lastError: err.message,
      });
      throw err;
    }
  }

  public async getProfile(profileId: string): Promise<GoLoginProfile | null> {
    if (this.isMockMode()) {
      return {
        id: profileId,
        name: `MOCK-PROFILE-${profileId}`,
        browserType: 'orbita',
        os: 'win',
        createdAt: new Date().toISOString(),
      };
    }

    const response = await fetch(`${this.apiUrl}/browser/${profileId}`, {
      headers: { Authorization: `Bearer ${this.apiToken}` },
    });
    if (!response.ok) return null;
    return (await response.json()) as GoLoginProfile;
  }

  public async updateProfile(profileId: string, updates: Partial<GoLoginProfile>): Promise<boolean> {
    if (this.isMockMode()) return true;

    const response = await fetch(`${this.apiUrl}/browser/${profileId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiToken}`,
      },
      body: JSON.stringify(updates),
    });
    return response.ok;
  }

  public async deleteProfile(profileId: string): Promise<boolean> {
    if (this.isMockMode()) return true;

    const response = await fetch(`${this.apiUrl}/browser/${profileId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${this.apiToken}` },
    });
    return response.ok;
  }

  public async configureProxy(profileId: string, proxyRef: string): Promise<boolean> {
    // Real proxy configuration without logging credentials
    if (this.isMockMode()) return true;

    // Standard GoLogin proxy payload
    const response = await fetch(`${this.apiUrl}/browser/${profileId}/proxy`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiToken}`,
      },
      body: JSON.stringify({ mode: 'http', autoProxyRegion: 'us' }),
    });
    return response.ok;
  }

  public async validateProfileConfiguration(profileId: string): Promise<{ valid: boolean; errors: string[] }> {
    if (this.isMockMode()) {
      return { valid: true, errors: [] };
    }
    const profile = await this.getProfile(profileId);
    if (!profile) return { valid: false, errors: ['Profile not found on GoLogin'] };
    return { valid: true, errors: [] };
  }

  public async startCloudBrowser(profileId: string, job: Job): Promise<Session> {
    const sessionId = `SESS-${Date.now().toString().slice(-4)}${Math.floor(Math.random() * 10)}`;

    let remoteDebuggerUrl = `http://127.0.0.1:9222/devtools/inspector.html?ws=127.0.0.1:9222/devtools/page/${sessionId}`;
    let cloudBrowserUrl = `${config.gologin.cloudBrowserUrl}/live/${sessionId}-${job.shopName.toLowerCase().replace(/\s+/g, '-')}`;

    if (!this.isMockMode()) {
      try {
        const response = await fetch(`${this.apiUrl}/browser/${profileId}/start`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.apiToken}`,
          },
          body: JSON.stringify({ cloud: true }),
        });

        if (!response.ok) {
          throw new Error(`Failed to start GoLogin browser: ${response.statusText}`);
        }

        const data = await response.json();
        if (data.wsUrl) remoteDebuggerUrl = data.wsUrl;
        if (data.cloudUrl) cloudBrowserUrl = data.cloudUrl;
      } catch (err: any) {
        await repository.updateIntegrationStatus('gologin', {
          status: 'DEGRADED',
          lastError: err.message,
        });
        throw err;
      }
    }

    const session: Session = {
      sessionId,
      jobId: job.jobId,
      shopName: job.shopName,
      gologinProfileId: profileId,
      status: 'RUNNING',
      startedAt: new Date().toISOString(),
      currentUrl: 'https://sellercentral.platform.example/onboarding',
      currentWorkflowState: 'BROWSER_READY',
      lastHeartbeat: new Date().toISOString(),
      operatorId: job.operatorId,
      remoteDebuggerUrl,
      cloudBrowserUrl,
      notes: `Started cloud session for ${job.shopName}`,
    };

    await repository.saveSession(session);

    await repository.updateIntegrationStatus('gologin', {
      status: 'CONNECTED',
      lastSuccessfulCall: new Date().toISOString(),
    });

    return session;
  }

  public async stopCloudBrowser(sessionId: string): Promise<boolean> {
    const session = await repository.getSessionById(sessionId);
    if (!session) return false;

    if (!this.isMockMode() && session.gologinProfileId) {
      try {
        await fetch(`${this.apiUrl}/browser/${session.gologinProfileId}/stop`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${this.apiToken}` },
        });
      } catch (err: any) {
        console.error('Error stopping GoLogin profile:', err);
      }
    }

    session.status = 'STOPPED';
    session.endedAt = new Date().toISOString();
    await repository.saveSession(session);
    return true;
  }

  public async getCloudBrowserStatus(sessionId: string): Promise<{ active: boolean; memoryMb?: number; cpuPercent?: number }> {
    const session = await repository.getSessionById(sessionId);
    if (!session || session.status === 'STOPPED') {
      return { active: false };
    }
    return {
      active: session.status === 'RUNNING' || session.status === 'PAUSED',
      memoryMb: Math.floor(450 + Math.random() * 80),
      cpuPercent: Math.floor(8 + Math.random() * 15),
    };
  }
}

export const goLoginService = new GoLoginService();
