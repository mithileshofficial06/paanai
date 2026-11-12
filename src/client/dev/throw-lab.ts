// Dev page: the throw stage alone. http://127.0.0.1:5173/dev/throw-lab.html (npm run harness)
// ?target=<commission id> shows that Master's pot as the target outline; ?skip=1 skips centering.
import { createThrowStage } from '../three/throwStage';
import { OFFICIAL } from '../../shared/content/commissions';
import { recipeToLog } from '../../shared/content/recipes';
import { replay } from '../../shared/core/shape';

const q = new URLSearchParams(location.search);
const c = OFFICIAL.find((x) => x.id === (q.get('target') ?? 'moon-jar'));
const target = c ? replay(recipeToLog(c.recipe)) : null;
const hud = document.getElementById('hud')!;
const stage = createThrowStage({
  canvas: document.getElementById('c') as HTMLCanvasElement,
  target,
  skipCentering: q.get('skip') === '1',
  reducedMotion: q.get('rm') === '1',
  onChange: (s) => (hud.textContent = JSON.stringify(s, null, 1).replace(/[{}"]/g, '')),
  onEvent: (e) => console.log('event', e),
});
const tools = ['hands', 'push', 'thin'] as const;
let ti = 0;
document.getElementById('bar')!.addEventListener('click', (ev) => {
  const b = (ev.target as HTMLElement).closest('button');
  const a = b?.dataset.a;
  if (a === 'open') stage.open();
  if (a === 'water') stage.addWater();
  if (a === 'undo') stage.undo();
  if (a === 'reset') stage.reset();
  if (a === 'tool' && b) {
    ti = (ti + 1) % 3;
    stage.setTool(tools[ti]!);
    b.textContent = `Tool: ${tools[ti]}`;
  }
});
(window as unknown as { stage: typeof stage }).stage = stage;
