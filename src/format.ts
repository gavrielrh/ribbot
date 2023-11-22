export function htmlToMarkdown(html: string): string {
  return html
    .replaceAll(/<h\d.*?>(.*?)<\/h\d>/g, "**$1**")
    .replaceAll(/<p.*?>(.*?)<\/p>/g, "$1\n")
    .replaceAll(/<span.*?>(.*?)<\/span>/g, "$1")
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
