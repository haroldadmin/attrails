const graphemes = new Intl.Segmenter();

/** The number of characters in `text` as people see them. */
export function graphemeCount(text: string): number {
  return Array.from(graphemes.segment(text)).length;
}
