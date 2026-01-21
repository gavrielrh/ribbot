/** Truncates text to maxLength, collapsing whitespace and appending "..." if needed. */
export function truncate(input: string, maxLength: number): string {
  const trimmedInput = input.replace(/\s+/g, " ").trim();
  return trimmedInput.length > maxLength
    ? `${trimmedInput.substring(0, maxLength)}...`
    : trimmedInput;
}
