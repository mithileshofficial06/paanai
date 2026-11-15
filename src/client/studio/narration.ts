// The tutorial's spoken lines, recorded by Mithilesh. Each line has a clip in public/voice/tour-NN.mp3
// (made from the raw recordings by tools/voice/process.py). The text must match what Tour.tsx says,
// word for word: the first beat of each step is spoken as "<step title>. <line>".
// A line with no clip falls back to the browser's speech voice.

export const NARRATION: readonly { id: string; text: string }[] = [
  { id: '01', text: 'How it works. Each level asks for one vessel. A hundred levels, each a little harder than the last.' },
  { id: '02', text: 'Shape the spinning clay to match the glowing outline. Hold to centre it, then tap Open.' },
  { id: '03', text: 'This is the pass mark. Score above it to clear the level.' },
  { id: '04', text: 'Hands, Push and Thin. Hands: drag up along the wall to pull the pot taller.' },
  { id: '05', text: 'Push: drag sideways to swell the belly out or squeeze a neck in.' },
  { id: '06', text: 'Thin: thins the wall. Too thin and the pot wobbles, then collapses.' },
  { id: '07', text: 'Tap Water when the clay dries out. Undo takes back your last stroke.' },
  { id: '08', text: 'Scoring and the leaderboard. Matching the shape is most of your score. Even walls, the rules, and using few strokes add the rest.' },
  { id: '09', text: 'Tap Done to score: up to three stars a level. The daily commission also ranks you on today’s leaderboard.' },
  { id: '10', text: 'After you tap Done. Clear a level and the next one unlocks on the Levels map. Replay any level for more stars.' },
  { id: '11', text: 'Every day there is also a daily commission. Paint it and fire it in the kiln overnight.' },
  { id: '12', text: 'Tap here to watch this again. Now it is your turn.' },
  { id: '13', text: 'Press and hold on the clay until it stops wobbling.' },
  { id: '14', text: 'Tap Open to press a hollow into the middle.' },
  { id: '15', text: 'With Hands, drag up along the wall, two or three times, to pull it taller.' },
  { id: '16', text: 'Tap Push, then drag the middle of the wall outward.' },
  { id: '17', text: 'Happy with it? Tap Done.' },
  { id: '18', text: 'Well thrown! The tutorial is complete. Enter level one when you are ready.' },
];

const byText = new Map(NARRATION.map((l) => [l.text, l.id]));

/** The recorded clip for a line, or null when this exact line has none. */
export function clipFor(text: string): string | null {
  const id = byText.get(text);
  return id ? `/voice/tour-${id}.mp3` : null;
}
