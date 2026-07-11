import { defineManifest } from '@crxjs/vite-plugin';

export default defineManifest({
  manifest_version: 3,
  name: 'H Company Agentic Layout Overlay',
  version: '0.1.0',
  action: { default_title: 'Open layout overlay' },
  background: { service_worker: 'src/background/serviceWorker.ts', type: 'module' },
  side_panel: { default_path: 'index.html' },
  permissions: ['sidePanel', 'storage', 'scripting', 'activeTab'],
  host_permissions: ['<all_urls>'],
  content_scripts: [
    { matches: ['<all_urls>'], js: ['src/content/index.ts'], run_at: 'document_idle' },
  ],
});
