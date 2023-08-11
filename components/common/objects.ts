export function trimKeysAndValues(item: {[key: string]: string}): {
  [key: string]: string;
} {
  const result: {[key: string]: string} = {};

  for (const key of Object.keys(item)) {
    result[key.trim()] = item[key].trim();
  }

  return result;
}

export function cleanSpaces(
  items: {[key: string]: string}[]
): {[key: string]: string}[] {
  return items.map(trimKeysAndValues);
}
