// Harness-only stand-in for @devvit/web/client. Never bundled into the Devvit build
// (aliased only by vite.harness.config.ts).

type Toast = { text: string; appearance?: 'neutral' | 'success' };
type WebViewMode = 'inline' | 'expanded';

// A shared preview link has no ?user=: give each visitor their own potter, remembered in
// this browser, and put it in the URL so the harness server (which reads the referer) sees it.
const params = new URLSearchParams(location.search);
if (!params.has('user')) {
  let id: string | null = null;
  try {
    id = localStorage.getItem('paanai-harness-user');
  } catch {
    /* storage blocked */
  }
  if (!id) {
    id = `potter${Math.floor(1000 + Math.random() * 9000)}`;
    try {
      localStorage.setItem('paanai-harness-user', id);
    } catch {
      /* storage blocked */
    }
  }
  params.set('user', id);
  history.replaceState(null, '', `${location.pathname}?${params.toString()}${location.hash}`);
}
const user = params.get('user');

export const context = {
  username: user && user !== 'anon' ? user : undefined,
  userId: user && user !== 'anon' ? `t2_${user}` : undefined,
  postId: 't3_harness',
  subredditName: 'paanai_dev',
  postData: {},
};

function toastEl(text: string): void {
  const el = document.createElement('div');
  el.textContent = text;
  el.setAttribute('data-harness-toast', '');
  el.style.cssText =
    'position:fixed;left:50%;bottom:24px;transform:translateX(-50%);background:#111;color:#fff;padding:10px 16px;border-radius:10px;font:14px system-ui;z-index:99999;border:1px solid #444';
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 2600);
}

export function showToast(t: string | Toast): void {
  toastEl(typeof t === 'string' ? t : t.text);
}

export function navigateTo(url: string | { url: string }): void {
  toastEl(`navigateTo ${typeof url === 'string' ? url : url.url}`);
}

export function requestExpandedMode(_e: MouseEvent, entry: string, _opts?: { title?: string }): void {
  const map: Record<string, string> = { studio: 'studio.html', default: 'splash.html' };
  location.href = `/${map[entry] ?? `${entry}.html`}${location.search}`;
}

export function exitExpandedMode(_e: MouseEvent): void {
  location.href = `/splash.html${location.search}`;
}

export function getWebViewMode(): WebViewMode {
  return location.pathname.includes('splash') ? 'inline' : 'expanded';
}

export function addWebViewModeListener(_cb: (m: WebViewMode) => void): void {}
export function removeWebViewModeListener(_cb: (m: WebViewMode) => void): void {}

export function showLoginPrompt(): void {
  toastEl('Login prompt (harness): add ?user=alice to the URL');
}

export async function showShareSheet(opts: { data?: string; title?: string; text?: string }): Promise<void> {
  toastEl(`Share sheet: ${opts.data ?? ''}`);
}

export function getShareData(): string | undefined {
  return params.get('share') ?? undefined;
}

export async function canRunAsUser(_e: Event): Promise<boolean> {
  return true;
}

export async function showForm(): Promise<{ action: 'CANCELED' }> {
  return { action: 'CANCELED' };
}
