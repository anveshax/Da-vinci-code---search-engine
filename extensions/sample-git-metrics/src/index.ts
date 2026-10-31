import { ExtensionContext, AnveshaExtension } from '@anvesha/extension-sdk';

export interface GitTelemetry {
  commitsCount: number;
  velocityScore: number;
  activeBranches: number;
  lastCalculated: number;
}

export class GitMetricsExtension implements AnveshaExtension {
  private context: ExtensionContext | null = null;
  private unsubscribeEvents: (() => void) | null = null;

  async onActivate(context: ExtensionContext): Promise<void> {
    this.context = context;
    console.log('[GitMetrics] Extension activated.');

    // Initialize metrics cache in isolated storage if absent
    const cached = await context.storage.get<GitTelemetry>('telemetry');
    if (!cached) {
      const initial: GitTelemetry = {
        commitsCount: 128,
        velocityScore: 94,
        activeBranches: 4,
        lastCalculated: Date.now(),
      };
      await context.storage.set('telemetry', initial);
    }

    // Subscribe to codebase file change events
    this.unsubscribeEvents = context.events.on('workspace:fileChanged', async (payload: any) => {
      console.log('[GitMetrics] Detected file change:', payload?.path);
      await this.incrementCommitMetrics();
    });

    context.ui.showNotification('Git Productivity & Metrics extension ready', 'info');
  }

  async onDeactivate(): Promise<void> {
    console.log('[GitMetrics] Extension deactivating.');
    if (this.unsubscribeEvents) {
      this.unsubscribeEvents();
      this.unsubscribeEvents = null;
    }
    this.context = null;
  }

  private async incrementCommitMetrics(): Promise<void> {
    if (!this.context) return;
    const current = (await this.context.storage.get<GitTelemetry>('telemetry')) || {
      commitsCount: 0,
      velocityScore: 50,
      activeBranches: 1,
      lastCalculated: Date.now(),
    };
    current.commitsCount += 1;
    current.velocityScore = Math.min(100, current.velocityScore + 1);
    current.lastCalculated = Date.now();
    await this.context.storage.set('telemetry', current);
    this.context.events.emit('gitMetrics:updated', current);
  }
}

export default new GitMetricsExtension();
