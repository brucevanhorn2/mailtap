import path from 'path'
import { simpleParser } from 'mailparser'
import { logger } from '../utils/logger'

/** Maximum bytes of attachment content we'll extract (5 MB) to keep FTS index small */
const MAX_EXTRACT_BYTES = 5 * 1024 * 1024

/** Strip XML/HTML tags and collapse whitespace */
function stripXml(xml: string): string {
  return xml
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Extract readable text from an OpenDocument ZIP (ODT/ODP/Keynote/Pages/Numbers) */
async function extractOpenDocument(buf: Buffer): Promise<string> {
  // ODT, ODS, ODP and Apple iWork formats are ZIP archives; text lives in content.xml
  try {
    const JSZip = require('jszip') as { loadAsync: (buf: Buffer) => Promise<{ files: Record<string, { async: (type: string) => Promise<string> }> }> }
    const zip = await JSZip.loadAsync(buf)
    const entry = zip.files['content.xml'] ?? zip.files['index.xml']
    if (!entry) return ''
    const xml = await entry.async('string')
    return stripXml(xml).slice(0, MAX_EXTRACT_BYTES)
  } catch {
    return ''
  }
}

/**
 * Extract plain text from an attachment buffer given its MIME content-type and filename.
 * Returns empty string if extraction is not supported or fails.
 */
export async function extractAttachmentText(
  buf: Buffer,
  contentType: string,
  filename: string
): Promise<string> {
  if (buf.length > MAX_EXTRACT_BYTES) {
    logger.debug(`AttachmentExtractor: skipping large attachment (${buf.length} bytes) — ${filename}`)
    return ''
  }

  const ext = path.extname(filename).toLowerCase()
  const mime = contentType.toLowerCase().split(';')[0].trim()

  try {
    // ── Plain text ────────────────────────────────────────────────────────────
    if (
      mime === 'text/plain' ||
      mime === 'text/csv' ||
      ext === '.txt' ||
      ext === '.csv' ||
      ext === '.md' ||
      ext === '.log'
    ) {
      return buf.toString('utf8').slice(0, MAX_EXTRACT_BYTES)
    }

    // ── HTML ──────────────────────────────────────────────────────────────────
    if (mime === 'text/html' || ext === '.html' || ext === '.htm') {
      return stripXml(buf.toString('utf8')).slice(0, MAX_EXTRACT_BYTES)
    }

    // ── EML (nested email) ────────────────────────────────────────────────────
    if (mime === 'message/rfc822' || ext === '.eml') {
      const nested = await simpleParser(buf)
      return (nested.text ?? nested.subject ?? '').slice(0, MAX_EXTRACT_BYTES)
    }

    // ── PDF ───────────────────────────────────────────────────────────────────
    if (mime === 'application/pdf' || ext === '.pdf') {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const pdfParse: (buf: Buffer) => Promise<{ text: string }> = require('pdf-parse')
      const result = await pdfParse(buf)
      return result.text.slice(0, MAX_EXTRACT_BYTES)
    }

    // ── DOCX (Word) ───────────────────────────────────────────────────────────
    if (
      mime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
      ext === '.docx'
    ) {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const mammoth: { extractRawText: (opts: { buffer: Buffer }) => Promise<{ value: string }> } = require('mammoth')
      const result = await mammoth.extractRawText({ buffer: buf })
      return result.value.slice(0, MAX_EXTRACT_BYTES)
    }

    // ── XLSX / XLS / ODS via SheetJS ─────────────────────────────────────────
    if (
      mime === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
      mime === 'application/vnd.ms-excel' ||
      mime === 'application/vnd.oasis.opendocument.spreadsheet' ||
      ext === '.xlsx' ||
      ext === '.xls' ||
      ext === '.ods'
    ) {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const XLSX: { read: (buf: Buffer, opts?: object) => object; utils: { sheet_to_txt: (sheet: object) => string } } = require('xlsx')
      const workbook = XLSX.read(buf, { type: 'buffer' }) as any
      const texts: string[] = []
      for (const sheetName of workbook.SheetNames as string[]) {
        const sheet = workbook.Sheets[sheetName]
        texts.push(XLSX.utils.sheet_to_txt(sheet))
      }
      return texts.join('\n').slice(0, MAX_EXTRACT_BYTES)
    }

    // ── ODT / ODP (OpenDocument Text / Presentation) ──────────────────────────
    if (
      mime === 'application/vnd.oasis.opendocument.text' ||
      mime === 'application/vnd.oasis.opendocument.presentation' ||
      ext === '.odt' ||
      ext === '.odp' ||
      ext === '.odg'
    ) {
      return extractOpenDocument(buf)
    }

    // ── Pages / Numbers / Keynote (Apple iWork) ───────────────────────────────
    // These are also ZIP archives with index.xml / index.apxl
    if (ext === '.pages' || ext === '.numbers' || ext === '.key') {
      return extractOpenDocument(buf)
    }

  } catch (err) {
    logger.warn(`AttachmentExtractor: failed to extract text from ${filename}:`, err)
  }

  return ''
}
