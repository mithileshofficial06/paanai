import React from 'react';
import { Composition } from 'remotion';
import { Paanai } from './Paanai';
import { FPS, TOTAL_FRAMES } from './timeline';

export const Root: React.FC = () => (
  <Composition id="Paanai" component={Paanai} durationInFrames={TOTAL_FRAMES} fps={FPS} width={1920} height={1080} />
);
