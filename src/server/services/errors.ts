export class ApiErr extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status: 400 | 401 | 403 | 404 | 409 | 429 | 500 = 400
  ) {
    super(message);
  }
}

export const requireUser = (userId: string | undefined, username: string | undefined): { userId: string; username: string } => {
  if (!userId || !username) throw new ApiErr('login', 'Log in to Reddit to do this.', 401);
  return { userId, username };
};
