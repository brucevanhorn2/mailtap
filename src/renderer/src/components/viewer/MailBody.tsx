import React, { useEffect, useRef, useCallback } from 'react'
import { sanitizeEmailHtml, buildIframeSrcDoc } from '../../utils/sanitizeHtml'

interface MailBodyProps {
  html: string
  text: string
  showExternalImages?: boolean
  onExternalImagesDetected?: (hasImages: boolean) => void
}

export function MailBody({
  html,
  text,
  showExternalImages = false,
  onExternalImagesDetected
}: MailBodyProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const { html: sanitizedHtml, hasExternalImages } = html
    ? sanitizeEmailHtml(html, { showExternalImages })
    : { html: '', hasExternalImages: false }

  useEffect(() => {
    if (html && onExternalImagesDetected) {
      onExternalImagesDetected(hasExternalImages)
    }
  }, [html, hasExternalImages, onExternalImagesDetected])

  const handleIframeLoad = useCallback(() => {
    const iframe = iframeRef.current
    if (!iframe) return
    try {
      const contentDoc = iframe.contentWindow?.document
      if (!contentDoc) return

      const resize = () => {
        // Use documentElement.scrollHeight for most reliable measurement
        const h = contentDoc.documentElement.scrollHeight
        if (h > 0) {
          iframe.style.height = `${h}px`
        }
      }

      resize()

      // Re-measure after each image finishes loading (or errors)
      const images = Array.from(contentDoc.querySelectorAll<HTMLImageElement>('img'))
      images.forEach((img) => {
        if (!img.complete) {
          img.addEventListener('load', resize, { once: true })
          img.addEventListener('error', resize, { once: true })
        }
      })

      // Also use ResizeObserver as a catch-all for dynamic content changes
      const observer = new ResizeObserver(resize)
      if (contentDoc.body) {
        observer.observe(contentDoc.body)
      }
      iframe.addEventListener('beforeunload', () => observer.disconnect(), { once: true })
    } catch {
      // Cross-origin or access errors — ignore
    }
  }, [])

  if (html) {
    const srcDoc = buildIframeSrcDoc(sanitizedHtml)
    return (
      // No flex:1 or overflow:hidden — let the block height grow with the iframe
      <div>
        <iframe
          key={showExternalImages ? 'images-on' : 'images-off'}
          ref={iframeRef}
          srcDoc={srcDoc}
          sandbox="allow-same-origin allow-popups"
          onLoad={handleIframeLoad}
          style={{
            width: '100%',
            height: 0,
            border: 'none',
            backgroundColor: 'white',
            display: 'block'
          }}
          title="Email content"
        />
      </div>
    )
  }

  if (text) {
    return (
      <div style={{ padding: '16px 20px' }}>
        <pre
          style={{
            fontFamily:
              '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
            fontSize: 14,
            color: '#e2e2e2',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            margin: 0,
            lineHeight: 1.6
          }}
        >
          {text}
        </pre>
      </div>
    )
  }

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 200,
        color: '#a0a0a8',
        fontSize: 14
      }}
    >
      No content
    </div>
  )
}
