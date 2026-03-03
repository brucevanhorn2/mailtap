/**
 * Sanitize HTML for safe display in a sandboxed iframe.
 * - Removes <script> tags and event handlers
 * - Replaces external image src with data-original-src (blocked by default)
 * - Returns { html: string; hasExternalImages: boolean }
 */
export function sanitizeEmailHtml(
  rawHtml: string,
  options: { showExternalImages?: boolean; disableLinks?: boolean } = {}
): { html: string; hasExternalImages: boolean } {
  const doc = new DOMParser().parseFromString(rawHtml, 'text/html')

  // Remove all <script> elements
  const scripts = doc.querySelectorAll('script')
  scripts.forEach((el) => el.remove())

  // Remove all on* event handler attributes from all elements
  const allElements = doc.querySelectorAll('*')
  allElements.forEach((el) => {
    const attributesToRemove: string[] = []
    for (let i = 0; i < el.attributes.length; i++) {
      const attr = el.attributes[i]
      if (attr.name.toLowerCase().startsWith('on')) {
        attributesToRemove.push(attr.name)
      }
    }
    attributesToRemove.forEach((name) => el.removeAttribute(name))
  })

  // Handle external images
  let hasExternalImages = false
  const images = doc.querySelectorAll('img')
  images.forEach((img) => {
    const src = img.getAttribute('src') ?? ''
    // Protocol-relative URLs (//example.com/img.png) are also external — they
    // resolve to https: in most contexts but fail when the base is about:srcdoc.
    const isExternal =
      src.startsWith('http://') || src.startsWith('https://') || src.startsWith('//')
    if (isExternal) {
      hasExternalImages = true
      if (!options.showExternalImages) {
        img.setAttribute('data-original-src', src)
        img.setAttribute('src', '')
      } else if (src.startsWith('//')) {
        // Normalise protocol-relative to https so the iframe can fetch it
        img.setAttribute('src', 'https:' + src)
      }
    }
  })

  // Disable links for threat emails
  if (options.disableLinks) {
    const links = doc.querySelectorAll('a')
    links.forEach((a) => {
      a.removeAttribute('href')
      a.setAttribute('style', 'color: #999; text-decoration: line-through; cursor: not-allowed')
      a.setAttribute('title', 'Link disabled — this email was flagged as a potential threat')
    })
  }

  return { html: doc.body.innerHTML, hasExternalImages }
}

/**
 * Wraps sanitized HTML in a complete HTML document with dark-friendly base styles.
 */
export function buildIframeSrcDoc(html: string): string {
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<style>
  body {
    margin: 0;
    padding: 16px;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
    color: #111111;
    background: #ffffff;
    font-size: 14px;
    line-height: 1.5;
    word-wrap: break-word;
  }
  img {
    max-width: 100%;
    height: auto;
  }
  a {
    color: #1a73e8;
  }
  pre, code {
    white-space: pre-wrap;
    word-break: break-word;
  }
</style>
</head>
<body>${html}</body>
</html>`
}
