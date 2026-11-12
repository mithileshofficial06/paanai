import { render } from 'preact';
import '../styles/tokens.css';
import '../styles/base.css';
import { App } from './App';
import { boot } from './controller';

const root = document.getElementById('app');
if (root) render(<App />, root);
void boot();
