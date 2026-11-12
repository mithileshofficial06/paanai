import { context, media, reddit, redis, settings } from '@devvit/web/server';
import { RichTextBuilder } from '@devvit/shared-types/richtext/RichTextBuilder.js';
import type { KV, Platform, Tx } from './types';

type T3 = `t3_${string}`;
const asT3 = (id: string): T3 => (id.startsWith('t3_') ? (id as T3) : (`t3_${id}` as T3));

const kv: KV = {
  get: (k) => redis.get(k),
  set: (k, v, o) => redis.set(k, v, o),
  del: async (...k) => {
    if (k.length) await redis.del(...k);
  },
  exists: (...k) => redis.exists(...k),
  incrBy: (k, n) => redis.incrBy(k, n),
  expire: (k, s) => redis.expire(k, s),
  hGet: (k, f) => redis.hGet(k, f),
  hMGet: (k, f) => redis.hMGet(k, f),
  hGetAll: async (k) => (await redis.hGetAll(k)) ?? {},
  hSet: (k, v) => redis.hSet(k, v),
  hIncrBy: (k, f, n) => redis.hIncrBy(k, f, n),
  hDel: (k, f) => redis.hDel(k, f),
  zAdd: (k, ...m) => redis.zAdd(k, ...m),
  zRange: (k, a, b, o) => redis.zRange(k, a, b, o ?? { by: 'rank' }),
  zRem: (k, m) => redis.zRem(k, m),
  zScore: (k, m) => redis.zScore(k, m),
  zRank: (k, m) => redis.zRank(k, m),
  zCard: (k) => redis.zCard(k),
  zIncrBy: (k, m, n) => redis.zIncrBy(k, m, n),
  zRemRangeByRank: (k, a, b) => redis.zRemRangeByRank(k, a, b),
  watch: async (...keys) => {
    const tx = await redis.watch(...keys);
    const wrapped: Tx = {
      multi: () => tx.multi(),
      hSet: (k, v) => tx.hSet(k, v),
      zAdd: (k, ...m) => tx.zAdd(k, ...m),
      exec: async () => {
        const r = await tx.exec();
        return Array.isArray(r) ? r : null;
      },
      unwatch: () => tx.unwatch(),
      discard: () => tx.discard(),
    };
    return wrapped;
  },
};

export const devvitPlatform: Platform = {
  kv,
  now: () => Date.now(),
  ctx: () => ({
    userId: context.userId,
    username: context.username,
    postId: context.postId,
    subredditName: context.subredditName ?? '',
  }),
  reddit: {
    async submitPost(o) {
      const post = await reddit.submitCustomPost({
        subredditName: context.subredditName ?? '',
        title: o.title,
        entry: o.entry ?? 'default',
        ...(o.postData ? { postData: o.postData } : {}),
        ...(o.textFallback ? { textFallback: { text: o.textFallback } } : {}),
        ...(o.runAsUser ? { runAs: 'USER' as const, userGeneratedContent: { text: o.title } } : {}),
      });
      return { id: post.id, url: post.url };
    },
    async submitComment(o) {
      const runAs = o.runAsUser ? ('USER' as const) : ('APP' as const);
      if (o.imageUrl) {
        const rt = new RichTextBuilder().image({ mediaUrl: o.imageUrl, ...(o.caption ? { caption: o.caption } : {}) });
        if (o.text) rt.paragraph((p) => p.text({ text: o.text ?? '' }));
        const c = await reddit.submitComment({ id: asT3(o.postId), richtext: rt, runAs });
        return { id: c.id };
      }
      const c = await reddit.submitComment({ id: asT3(o.postId), text: o.text ?? '', runAs });
      return { id: c.id };
    },
    async setUserFlair(username, text) {
      await reddit.setUserFlair({ subredditName: context.subredditName ?? '', username, text });
    },
    getSnoovatarUrl: (u) => reddit.getSnoovatarUrl(u),
    async removePost(postId) {
      const post = await reddit.getPostById(asT3(postId));
      await post.remove();
    },
  },
  media: {
    async uploadImage(dataUrl) {
      const a = await media.upload({ url: dataUrl, type: 'image' });
      return { mediaId: a.mediaId, mediaUrl: a.mediaUrl };
    },
  },
  settings: {
    get: (name) => settings.get(name),
  },
};
