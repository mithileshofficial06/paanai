// Every Redis key is built here. Prefix "p:". TTLs live next to the keys they govern.

export const DAY_S = 86_400;

export const K = {
  daily: (date: string) => `p:daily:${date}`, // hash: commissionId, postId, format, atmosphere
  post: (postId: string) => `p:post:${postId}`, // hash: date, commissionId, kind
  comm: (id: string) => `p:comm:${id}`, // hash: player commission record
  commByUser: (user: string) => `p:commby:${user}`, // zset of commission ids by time
  commQueue: () => `p:commq`, // zset: approved player commissions by votes (for Commission Day)
  throwRec: (commId: string, user: string) => `p:throw:${commId}:${user}`, // hash: ranked throw
  pot: (potId: string) => `p:pot:${potId}`, // hash
  myPots: (user: string) => `p:mypots:${user}`, // zset potId by createdAt
  kilnQueue: (date: string) => `p:kilnq:${date}`, // zset potId by glaze time
  lbThrow: (commId: string) => `p:lb:throw:${commId}`, // zset username -> score key
  lbKiln: (date: string) => `p:lb:kiln:${date}`,
  showcase: () => `p:showcase`, // zset potId by time it was put on show
  showcaseTop: () => `p:showcase:top`, // zset potId by rating rank key
  ratings: (potId: string) => `p:ratings:${potId}`, // zset userId -> stars (1-5)
  likes: (potId: string) => `p:likes:${potId}`, // zset user -> 0
  codex: () => `p:codex`, // hash effectId -> JSON {user, date}
  user: (userId: string) => `p:user:${userId}`, // hash
  rateLimit: (route: string, user: string, minute: number) => `p:rl:${route}:${user}:${minute}`,
  idem: (user: string, key: string) => `p:idem:${user}:${key}`,
  job: (name: string, date: string) => `p:job:${name}:${date}`,
  stats: (date: string) => `p:stats:${date}`, // hash
  reports: (targetId: string) => `p:reports:${targetId}`, // zset reporter -> time
  modQueue: () => `p:modq`, // zset targetId -> report count
  seq: () => `p:seq`, // id counter
  levels: (user: string) => `p:levels:${user}`, // hash: unlocked, tutorial, b<n> = best score on level n
};

export const TTL = {
  daily: 120 * DAY_S,
  post: 120 * DAY_S,
  comm: 60 * DAY_S,
  throwRec: 30 * DAY_S,
  pot: 30 * DAY_S,
  kilnQueue: 3 * DAY_S,
  lb: 30 * DAY_S,
  likes: 30 * DAY_S,
  ratings: 30 * DAY_S,
  user: 30 * DAY_S,
  idem: DAY_S,
  job: 3 * DAY_S,
  stats: 60 * DAY_S,
  reports: 30 * DAY_S,
  levels: 365 * DAY_S,
};
