// Shared by the search endpoint and the search box.

export type RouteSearchItem = {
  did: string;
  rkey: string;
  name: string;
  activity: string;
  distance: string;
};

export const MIN_QUERY_LENGTH = 2;
export const MAX_QUERY_LENGTH = 100;
