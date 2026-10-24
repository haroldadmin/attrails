export type Page<T> = {
  items: T[];
  /** `null` on the last page. */
  nextCursor: string | null;
};
