import { render } from 'preact';
import '../styles/tokens.css';
import '../styles/base.css';
import '../styles/components.css';
import '../styles/screens.css';
import '../styles/kiln-hero.css';
import '../styles/tour.css';
import { App } from './App';
import { boot } from './controller';

type BootUi = { to: (pct: number) => void; done: () => void };
export const bootUi = (): BootUi | undefined => (window as unknown as { __boot?: BootUi }).__boot;

bootUi()?.to(62);
const root = document.getElementById('app');
if (root) render(<App />, root);
void boot();
