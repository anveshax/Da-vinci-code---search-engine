import { ExtensionContext, AnveshaExtension } from '@anvesha/extension-sdk';

export class MyCustomToolExtension implements AnveshaExtension {
  async onActivate(context: ExtensionContext): Promise<void> {
    console.log(`[MyCustomTool] Activated for manifest:`, context.manifest.id);

    // Read stored settings or initialize
    const stored = await context.storage.get('initialized_timestamp');
    if (!stored) {
      await context.storage.set('initialized_timestamp', Date.now());
    }

    context.ui.showNotification('My Custom Tool is now active in Anvesha', 'success');
  }

  async onDeactivate(): Promise<void> {
    console.log(`[MyCustomTool] Cleaned up and deactivated.`);
  }

  renderSidePanel(container: HTMLElement, context: ExtensionContext): () => void {
    container.innerHTML = `
      <div style="padding: 16px; font-family: sans-serif; color: #fff;">
        <h3 style="font-size: 14px; font-weight: bold; margin-bottom: 8px;">My Tool Widget</h3>
        <p style="font-size: 12px; color: #94a3b8;">Welcome to your first Anvesha Extension.</p>
        <button id="action-btn" style="margin-top: 12px; padding: 6px 12px; background: #0284c7; border: none; border-radius: 6px; color: white; cursor: pointer;">
          Run Action
        </button>
      </div>
    `;

    const btn = container.querySelector('#action-btn');
    const clickHandler = () => {
      context.ui.showNotification('Custom button clicked!', 'info');
    };
    btn?.addEventListener('click', clickHandler);

    return () => {
      btn?.removeEventListener('click', clickHandler);
      container.innerHTML = '';
    };
  }
}

export default new MyCustomToolExtension();
