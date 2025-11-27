/**
 * Text formatting and manipulation utilities
 /**
 * Truncate text to a maximum length with ellipsis.
 * More reliable than CSS truncate for consistent server-side and client-side rendering.
 *
 * @param text - The text to truncate
 * @param maxLength - Maximum length before truncation (default: 60)
 * @returns Truncated text with ellipsis if needed
 *
 * @example
 * truncateText("This is a very long title that needs to be shortened", 20)
 * // Returns: "This is a very long..."
 */
export function truncateText(text: string, maxLength: number = 60): string {
    if (text.length <= maxLength) return text
    return text.slice(0, maxLength).trim() + '...'
}

/**
 * Truncates markdown content to a specified character limit while preserving structure
 * Attempts to break at paragraph or sentence boundaries for better readability
 *
 * @param content - The markdown content to truncate
 * @param charLimit - Maximum number of characters (default: 400)
 * @returns Truncated content with ellipsis if exceeded
 *
 * @example
 * truncateMarkdown("# Heading\n\nLong paragraph...", 50)
 * // Returns: "# Heading\n\nLong paragraph…"
 */
export function truncateMarkdown(content: string, charLimit: number = 400): string {
    if (content.length <= charLimit) {
        return content
    }

    // Find a good break point - prefer breaking at paragraph boundaries
    let truncated = content.substring(0, charLimit)

    // Try to break at the last paragraph break
    const lastParagraphBreak = truncated.lastIndexOf('\n\n')
    if (lastParagraphBreak > charLimit * 0.6) { // Only use if it's not too early
        truncated = truncated.substring(0, lastParagraphBreak)
    } else {
        // Otherwise break at the last sentence
        const lastPeriod = truncated.lastIndexOf('. ')
        if (lastPeriod > charLimit * 0.6) {
            truncated = truncated.substring(0, lastPeriod + 1)
        } else {
            // Break at the last space
            const lastSpace = truncated.lastIndexOf(' ')
            if (lastSpace > 0) {
                truncated = truncated.substring(0, lastSpace)
            }
        }
    }

    return truncated.trim() + '…'
}