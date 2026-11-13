import { render } from 'preact';
import '../styles/tokens.css';
import '../styles/base.css';
import '../styles/components.css';
import '../styles/screens.css';
import '../styles/kiln-hero.css';
import '../styles/tour.css';
import '../styles/levels.css';
import { App } from './App';
import { boot } from './controller';
import { sfx } from '../app/audio';

// A soft click on every button press (the wheel canvas has its own sounds).
document.addEventListener('pointerdown', (e) => {
  if ((e.target as Element | null)?.closest?.('button:not(:disabled)')) sfx.click();
}, { passive: true });

type BootUi = { to: (pct: number) => void; done: () => void };
export const bootUi = (): BootUi | undefined => (window as unknown as { __boot?: BootUi }).__boot;

bootUi()?.to(62);
const root = document.getElementById('app');
if (root) render(<App />, root);
void boot();
