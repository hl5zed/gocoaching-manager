export type User = {
  id: string;
  email: string | null;
};

export type GetSessionResult = {
  user: User | null;
  error: string | null;
};
