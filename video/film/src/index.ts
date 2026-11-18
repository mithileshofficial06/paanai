import React from 'react';
import { Composition, registerRoot } from 'remotion';
import { Film, FILM_FRAMES } from './Film';
import { FPS, H, W } from './lib';

const Root: React.FC = () => React.createElement(Composition, { id: 'PaanaiFilm', component: Film, durationInFrames: FILM_FRAMES, fps: FPS, width: W, height: H });

registerRoot(Root);
