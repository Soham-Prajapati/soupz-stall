import { useMemo } from 'react';

/**
 * Extracts previewable content from AI agent response text
 * Scans for code blocks (HTML, CSS, JSX, TSX) and file paths
 * Returns preview HTML, preview status, and changed files
 */
export function usePreviewExtractor(messageContent = '') {
  return useMemo(() => {
    const result = {
      previewHtml: null,
      hasPreview: false,
      changedFiles: [],
      detectedLanguages: [],
    };

    if (!messageContent || typeof messageContent !== 'string') {
      return result;
    }

    // Extract code blocks with their language
    const codeBlockRegex = /```(\w+)?\n?([\s\S]*?)```/g;
    const codeBlocks = [];
    let match;

    while ((match = codeBlockRegex.exec(messageContent)) !== null) {
      const language = match[1] || '';
      const content = match[2] || '';
      codeBlocks.push({ language: language.toLowerCase(), content });
      result.detectedLanguages.push(language.toLowerCase());
    }

    // Find HTML block
    const htmlBlock = codeBlocks.find(
      (block) => block.language === 'html' || block.language === ''
    );

    // Find CSS block
    const cssBlock = codeBlocks.find((block) => block.language === 'css');

    // Check for JSX/TSX — don't preview these, defer to dev server
    const hasJsxOrTsx = codeBlocks.some(
      (block) => block.language === 'jsx' || block.language === 'tsx' || block.language === 'javascript'
    );

    // If HTML block exists, build preview
    if (htmlBlock) {
      let htmlContent = htmlBlock.content.trim();

      // Inject CSS if found
      if (cssBlock) {
        const cssContent = cssBlock.content.trim();
        // Insert <style> tag before closing </head> or at the beginning if no head
        if (htmlContent.includes('</head>')) {
          htmlContent = htmlContent.replace(
            '</head>',
            `<style>\n${cssContent}\n</style>\n</head>`
          );
        } else if (htmlContent.includes('<body')) {
          htmlContent = htmlContent.replace(
            '<body',
            `<style>\n${cssContent}\n</style>\n<body`
          );
        } else {
          htmlContent = `<style>\n${cssContent}\n</style>\n${htmlContent}`;
        }
      }

      result.previewHtml = htmlContent;
      result.hasPreview = true;
    } else if (hasJsxOrTsx) {
      // JSX/TSX detected but no HTML — preview not available
      result.hasPreview = false;
    }

    // Extract file paths from patterns like "Created: src/..." or "Modified: src/..."
    const filePathRegex = /(?:Created|Modified|Updated|Edited|Added):\s*(src\/[^\s\n]+|packages\/[^\s\n]+|[a-zA-Z0-9._\-/]+\.(?:js|ts|jsx|tsx|css|html|json))/gi;
    const foundFiles = new Set();

    while ((match = filePathRegex.exec(messageContent)) !== null) {
      const filePath = match[1].trim();
      if (filePath) {
        foundFiles.add(filePath);
      }
    }

    result.changedFiles = Array.from(foundFiles);

    return result;
  }, [messageContent]);
}
