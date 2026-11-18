// Paanai: the film. 1920x1080, 60 fps, about 2 min 56 s. Real footage of the game (3D wheel shots
// captured frame by frame, phone shots from the harness), the game's own palette and type.
import React from 'react';
import { AbsoluteFill, Audio, interpolate, Sequence, staticFile } from 'remotion';
import { Grain } from './fx';
import { clamp, s2f, useFonts } from './lib';
import { SceneClay, SceneHook, SceneOpen, SceneThrow } from './scenes1';
import { SceneCommunity, SceneOut, ScenePaint, SceneReveal, SceneScore, SceneTech } from './scenes2';
import { Captions } from './text';
import { SCENES, SceneId, TOTAL, VO, VO_AT } from './timeline';
import { Enter, Reveal } from './transitions';

const ORDER: [SceneId, React.FC, Enter][] = [
  ['open', SceneOpen, 'none'],
  ['hook', SceneHook, 'iris'],
  ['throw', SceneThrow, 'smear'],
  ['clay', SceneClay, 'zoom'],
  ['score', SceneScore, 'sweep'],
  ['paint', ScenePaint, 'smear'],
  ['reveal', SceneReveal, 'flash'],
  ['comm', SceneCommunity, 'iris'],
  ['tech', SceneTech, 'blinds'],
  ['out', SceneOut, 'iris'],
];

// Sound effects: [file, absolute second, volume]
const SFX: [string, number, number][] = [
  ['whoosh', SCENES.hook[0] - 0.1, 0.55],
  ['whoosh', SCENES.throw[0] - 0.1, 0.5],
  ['whoosh', SCENES.clay[0] - 0.1, 0.5],
  ['whoosh', SCENES.score[0] - 0.1, 0.5],
  ['whoosh', SCENES.paint[0] - 0.1, 0.5],
  ['firewhoosh', SCENES.reveal[0] - 0.2, 0.45],
  ['whoosh', SCENES.comm[0] - 0.1, 0.5],
  ['whoosh', SCENES.tech[0] - 0.1, 0.5],
  ['whoosh', SCENES.out[0] - 0.1, 0.55],
  ['firewhoosh', 9.6, 0.35],
  ['ceramic', 72.4, 0.0],
  ['firewhoosh', 97.9, 0.3],
];

const voOn = (t: number) => Object.keys(VO_AT).some((k) => t >= VO_AT[k]! - 0.25 && t <= VO_AT[k]! + (VO[k]?.dur ?? 0) + 0.2);

export const Film: React.FC = () => {
  useFonts();
  return (
    <AbsoluteFill style={{ background: '#000' }}>
      {ORDER.map(([id, Scene, enter]) => {
        const [a, b] = SCENES[id];
        return (
          <Sequence key={id} from={s2f(a)} durationInFrames={s2f(b - a)} name={id}>
            <Reveal type={enter} dur={0.6}>
              <Scene />
            </Reveal>
          </Sequence>
        );
      })}
      <Captions />
      <Grain opacity={0.09} />
      {/* Narration */}
      {Object.entries(VO_AT).map(([id, at]) => (
        <Sequence key={id} from={s2f(at)} durationInFrames={s2f((VO[id]?.dur ?? 3) + 0.3)} name={`vo ${id}`}>
          <Audio src={staticFile(`film/vo/${id}.mp3`)} volume={1} />
        </Sequence>
      ))}
      {/* Music bed, ducked under the narration */}
      <Audio
        src={staticFile('film/music.wav')}
        volume={(f) => {
          const t = f / 60;
          const fadeIn = interpolate(t, [0, 1.5], [0, 1], clamp);
          // smooth duck: look at a small window around t
          let duck = 0;
          for (const d of [-0.3, -0.15, 0, 0.15, 0.3]) duck += voOn(t + d) ? 0.2 : 0;
          const base = 0.62 - duck * 0.36;
          return fadeIn * base;
        }}
      />
      {/* Wheel hum under the throwing scenes */}
      <Sequence from={0} durationInFrames={s2f(SCENES.open[1])}>
        <Audio src={staticFile('film/sfx/wheel.mp3')} volume={(f) => interpolate(f / 60, [0, 1.5, 12, 15.5], [0, 0.22, 0.22, 0], clamp)} loop />
      </Sequence>
      <Sequence from={s2f(SCENES.clay[0])} durationInFrames={s2f(SCENES.clay[1] - SCENES.clay[0])}>
        <Audio src={staticFile('film/sfx/wheel.mp3')} volume={(f) => interpolate(f / 60, [0, 0.8, 10, 12], [0, 0.2, 0.2, 0], clamp)} loop />
      </Sequence>
      <Sequence from={s2f(97.8)} durationInFrames={s2f(SCENES.paint[1] - 97.8)}>
        <Audio src={staticFile('film/sfx/furnace.mp3')} volume={(f) => interpolate(f / 60, [0, 1.5, 15, 17.5], [0, 0.13, 0.13, 0], clamp)} />
      </Sequence>
      {SFX.filter((s) => s[2] > 0).map(([name, at, vol], i) => (
        <Sequence key={i} from={s2f(Math.max(0, at))} durationInFrames={s2f(3.5)}>
          <Audio src={staticFile(`film/sfx/${name}.mp3`)} volume={vol} />
        </Sequence>
      ))}
    </AbsoluteFill>
  );
};

export const FILM_FRAMES = TOTAL;
