/**
 * How many whole rows of a list fit above `limit`, given each row's bottom edge measured from the
 * top of the list. Fewer than `minimum` counts as none, so a list never stands on a lone row.
 */
export function rowsThatFit(rowBottoms: readonly number[], limit: number, minimum = 1) {
  let count = 0;
  // Half a pixel absorbs subpixel layout without letting a row cross the limit visibly.
  while (count < rowBottoms.length && rowBottoms[count] <= limit + 0.5) count += 1;
  return count < minimum ? 0 : count;
}
