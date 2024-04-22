export function htmlToMarkdown(html: string): string {
  return html
    .replaceAll(/<\/?h\d.*?>/g, "**")
    .replaceAll(/<p.*?>(.*?)<\/p>/g, "$1\n")
    .replaceAll(/<\/?span.*?>/g, "")
    .replaceAll(/<\/?img.*?>/g, "")
    .replaceAll(/<\/?meta.*?>/g, "")
    .replaceAll(/\*{3,}/g, "**")
    .replaceAll(/<\/?br.*?>/g, "\n")
    .replaceAll(/nbsp;/g, " ")
    .replaceAll(
      /<a [^>]*href=["']([^"']+)["'][^>]*>([^<]+)<\/a>/g,
      "[$2]($1)",
    )
    .replaceAll(/<\/?iframe.*?>/g, "")
    .replaceAll(/<\/?strong.*?>/g, "**")
    .replaceAll(/<\/?em.*?>/g, "_")
    .replaceAll(/<\/?div.*?>/g, "")
    .replaceAll(/<\/?ul.*?>/g, "")
    .replaceAll(/<li.*?>/g, "\n- ")
    .replaceAll(/<\/li.*?>/g, "")
    .replaceAll(/<(\w+)(?:\s[^>]*>|)>\s*<\/\1>/g, "")
    .replaceAll(/(\n{3,})/g, "\n\n");
}
