export function htmlToMarkdown(html: string): string {
  return html
    .replaceAll(/<\/?h\d.*?>/g, "**")
    .replaceAll(/<\/?p.*?>/g, "\n")
    .replaceAll(/<\/?span.*?>/g, "")
    .replaceAll(/<\/?img.*?>/g, "")
    .replaceAll(/<\/?meta.*?>/g, "")
    .replaceAll(/<\/?br.*?>/g, "\n")
    .replaceAll(/nbsp;/g, " ")
    .replaceAll(
      /<a [^>]*href=["']([^"']+)["'][^>]*>([^<]+)<\/a>/g,
      "[$2]($1)",
    )
    .replaceAll(/<\/?iframe.*?>/g, "")
    .replaceAll(/<\/?strong.*?>/g, "**");
}
