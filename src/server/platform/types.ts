// Everything the game needs from Devvit, behind one small interface. The real implementation
// (devvit.ts) wraps @devvit/web/server; memory.ts powers the local harness and server tests.

export type ZMember = { member: string; score: number };

export type ZRangeOpts = { reverse?: boolean; by: 'rank' | 'score'; limit?: { offset: number; count: number } };

export type Tx = {
  multi(): Promise<void>;
  hSet(key: string, values: Record<string, string>): Promise<unknown>;
  zAdd(key: string, ...members: ZMember[]): Promise<unknown>;
  exec(): Promise<unknown[] | null>;
  unwatch(): Promise<unknown>;
  discard(): Promise<void>;
};

export type KV = {
  get(key: string): Promise<string | undefined>;
  set(key: string, value: string, opts?: { nx?: boolean; expiration?: Date }): Promise<string>;
  del(...keys: string[]): Promise<void>;
  exists(...keys: string[]): Promise<number>;
  incrBy(key: string, by: number): Promise<number>;
  expire(key: string, seconds: number): Promise<void>;
  hGet(key: string, field: string): Promise<string | undefined>;
  hMGet(key: string, fields: string[]): Promise<(string | null)[]>;
  hGetAll(key: string): Promise<Record<string, string>>;
  hSet(key: string, values: Record<string, string>): Promise<number>;
  hIncrBy(key: string, field: string, by: number): Promise<number>;
  hDel(key: string, fields: string[]): Promise<number>;
  zAdd(key: string, ...members: ZMember[]): Promise<number>;
  zRange(key: string, start: number, stop: number, opts?: ZRangeOpts): Promise<ZMember[]>;
  zRem(key: string, members: string[]): Promise<number>;
  zScore(key: string, member: string): Promise<number | undefined>;
  zRank(key: string, member: string): Promise<number | undefined>;
  zCard(key: string): Promise<number>;
  zIncrBy(key: string, member: string, by: number): Promise<number>;
  zRemRangeByRank(key: string, start: number, stop: number): Promise<number>;
  watch(...keys: string[]): Promise<Tx>;
};

export type RequestContext = {
  userId: string | undefined;
  username: string | undefined;
  postId: string | undefined;
  subredditName: string;
};

export type SubmitPostOpts = {
  title: string;
  entry?: string;
  postData?: Record<string, string | number | boolean>;
  textFallback?: string;
  runAsUser?: boolean;
};

export type RedditOps = {
  submitPost(opts: SubmitPostOpts): Promise<{ id: string; url: string }>;
  /** appCaption: used instead of caption/text if posting as the player fails and the app account posts. */
  submitComment(opts: { postId: string; text?: string; imageUrl?: string; caption?: string; appCaption?: string; runAsUser?: boolean }): Promise<{ id: string }>;
  setUserFlair(username: string, text: string): Promise<void>;
  getSnoovatarUrl(username: string): Promise<string | undefined>;
  removePost(postId: string): Promise<void>;
};

export type MediaOps = {
  uploadImage(dataUrl: string): Promise<{ mediaId: string; mediaUrl: string }>;
};

export type SettingsOps = {
  get(name: string): Promise<unknown>;
};

export type Platform = {
  kv: KV;
  ctx(): RequestContext;
  reddit: RedditOps;
  media: MediaOps;
  settings: SettingsOps;
  /** Current time in ms. The harness can shift it to simulate days passing. */
  now(): number;
};
