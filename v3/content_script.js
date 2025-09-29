// content_script.js

(async () => {
    // Attempt to extract meta description and keywords
    const metaDescription = document.querySelector('meta[name="description"]')?.content || '';
    const metaKeywords = document.querySelector('meta[name="keywords"]')?.content || '';

    // Extract main text content from the body, focusing on meaningful elements
    // This is a simplified approach, a more robust solution might use a library like Readability.js
    let pageText = '';
    const bodyText = document.body.textContent || '';

    // Limit the text to avoid sending excessively large content to AI,
    // as well as to focus on the "beginning" of the page often containing more relevant info.
    // A heuristic: grab up to N characters, or characters from major text blocks.
    const MAX_TEXT_LENGTH_FOR_AI = 5000; // Adjust as needed

    // Try to find main content blocks
    const mainContentElements = document.querySelectorAll('main, article, .content, .post, .entry');
    if (mainContentElements.length > 0) {
        for (const el of mainContentElements) {
            pageText += (el.textContent || ' ').trim() + ' ';
            if (pageText.length > MAX_TEXT_LENGTH_FOR_AI) break;
        }
    } else {
        // Fallback to body text if specific elements not found
        pageText = bodyText;
    }

    // Clean up text: remove multiple spaces, newlines, trim
    pageText = pageText.replace(/\s+/g, ' ').trim();

    // Prioritize title, meta description/keywords, then page text
    const combinedContent = `${document.title || ''}. ${metaDescription}. ${metaKeywords}. ${pageText}`.trim();

    // Return the combined, cleaned content.
    // This will be the result of chrome.scripting.executeScript
    return combinedContent.substring(0, MAX_TEXT_LENGTH_FOR_AI);
})();