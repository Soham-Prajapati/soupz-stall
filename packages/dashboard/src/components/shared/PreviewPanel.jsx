import { useState, useRef, useEffect } from 'react';
import { RefreshCw, ExternalLink, Globe, Code2, Monitor } from 'lucide-react';
import { cn } from '../../lib/cn';

export default function PreviewPanel({
  previewHtml = null,
  previewUrl = null,
  onRefresh = null,
}) {
  const iframeRef = useRef(null);
  const [mode, setMode] = useState(previewUrl ? 'url' : 'html'); // 'url' or 'html'

  useEffect(() => {
    if (previewUrl && mode !== 'url') {
      setMode('url');
    } else if (!previewUrl && mode === 'url') {
      setMode('html');
    }
  }, [previewUrl, mode]);

  // Validate URL format
  const isValidUrl = previewUrl && (
    previewUrl.startsWith('http://') ||
    previewUrl.startsWith('https://') ||
    previewUrl.startsWith('localhost:')
  );

  const shouldShowUrl = mode === 'url' && isValidUrl;
  const shouldShowHtml = mode === 'html' && previewHtml;
  const hasContent = shouldShowUrl || shouldShowHtml;
  const canToggle = isValidUrl && previewHtml;

  // Wrap raw HTML in a complete document
  const wrapHtml = (html) => {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      line-height: 1.5;
    }
  </style>
</head>
<body>
${html}
</body>
</html>`;
  };

  const handleRefresh = () => {
    if (onRefresh) onRefresh();
    if (iframeRef.current) {
      iframeRef.current.src = iframeRef.current.src;
    }
  };

  const handleOpenNewTab = () => {
    if (shouldShowUrl && previewUrl) {
      window.open(previewUrl, '_blank');
    }
  };

  // Truncate URL for display
  const displayUrl = previewUrl && previewUrl.length > 40
    ? previewUrl.substring(0, 40) + '...'
    : previewUrl;

  const modeIcon = shouldShowUrl ? Globe : Code2;
  const ModeIcon = modeIcon;

  return (
    <div className="flex flex-col h-full bg-bg-surface border border-border-subtle rounded-lg overflow-hidden">
      {/* Top Bar */}
      <div className="flex items-center justify-between px-3 py-2 bg-bg-elevated border-b border-border-subtle">
        <div className="flex items-center gap-2">
          <ModeIcon className="w-4 h-4 text-text-sec" />
          <span className="text-xs font-ui text-text-sec">
            {shouldShowUrl ? 'Dev Server' : 'HTML Preview'}
          </span>
          {displayUrl && (
            <span className="text-xs font-mono text-text-faint ml-1 max-w-[120px] truncate">
              {displayUrl}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1">
          {canToggle && (
            <button
              onClick={() => setMode(mode === 'url' ? 'html' : 'url')}
              title="Toggle preview mode"
              className={cn(
                'p-1.5 rounded transition-colors',
                'hover:bg-bg-surface text-text-sec hover:text-text-pri',
              )}
            >
              <Monitor className="w-4 h-4" />
            </button>
          )}

          <button
            onClick={handleRefresh}
            title="Refresh preview"
            disabled={!hasContent}
            className={cn(
              'p-1.5 rounded transition-colors',
              hasContent
                ? 'hover:bg-bg-surface text-text-sec hover:text-text-pri cursor-pointer'
                : 'text-text-faint opacity-50 cursor-not-allowed',
            )}
          >
            <RefreshCw className="w-4 h-4" />
          </button>

          {shouldShowUrl && (
            <button
              onClick={handleOpenNewTab}
              title="Open in new tab"
              className={cn(
                'p-1.5 rounded transition-colors',
                'hover:bg-bg-surface text-text-sec hover:text-text-pri',
              )}
            >
              <ExternalLink className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Preview Content */}
      <div className="flex-1 overflow-hidden bg-white">
        {hasContent ? (
          shouldShowUrl ? (
            <iframe
              ref={iframeRef}
              src={previewUrl}
              title="Preview"
              sandbox="allow-scripts allow-same-origin allow-forms allow-modals allow-popups allow-presentation"
              className="w-full h-full border-none"
            />
          ) : (
            <iframe
              ref={iframeRef}
              srcDoc={wrapHtml(previewHtml)}
              title="Preview"
              sandbox="allow-scripts allow-same-origin allow-forms"
              className="w-full h-full border-none"
            />
          )
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <div className="text-center">
              <Code2 className="w-8 h-8 text-text-faint mx-auto mb-2 opacity-50" />
              <p className="text-text-sec text-sm">
                Preview will appear when code is generated
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
