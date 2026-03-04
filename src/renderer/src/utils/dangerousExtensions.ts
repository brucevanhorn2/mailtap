/**
 * File extensions that represent executable or script content and should
 * never be silently saved from an email attachment.
 *
 * The list covers:
 *  - Windows executables / installers / scripts
 *  - PowerShell / WSH / HTA / registry / shortcut files
 *  - macOS executables and installers
 *  - Linux executables and packages
 *  - Java/JVM executables (jar, jnlp)
 *  - Office macro-enabled formats (can execute arbitrary VBA/macro code)
 */
const DANGEROUS_EXTENSIONS = new Set([
  // Windows executables & installers
  '.exe', '.msi', '.msp', '.msu', '.mst',
  // Windows scripts & shortcuts
  '.bat', '.cmd', '.com', '.pif', '.scr', '.lnk', '.cpl', '.hta', '.inf',
  // Windows scripting hosts
  '.vbs', '.vbe', '.vbscript',
  '.js',  '.jse',
  '.wsf', '.wsh', '.wsc',
  // PowerShell
  '.ps1', '.ps1xml', '.ps2', '.ps2xml', '.psm1', '.psd1', '.pssc', '.psrc',
  // Registry / system
  '.reg', '.dll', '.sys', '.drv',
  // macOS
  '.app', '.dmg', '.pkg', '.mpkg', '.command',
  // Linux
  '.run', '.sh', '.bash', '.deb', '.rpm', '.appimage',
  // Java
  '.jar', '.jnlp', '.class',
  // Office macro-enabled formats
  '.docm', '.dotm', '.xlsm', '.xlsb', '.xltm', '.xls', '.xlam',
  '.pptm', '.potm', '.ppam', '.ppsm', '.sldm',
])

/**
 * Returns true if the filename has an extension associated with executables,
 * scripts, or macro-enabled documents.
 *
 * Handles double-extension tricks like "invoice.pdf.exe" by checking only
 * the true last extension (the portion after the final dot).
 */
export function isDangerousExtension(filename: string): boolean {
  const dot = filename.lastIndexOf('.')
  if (dot === -1) return false
  const ext = filename.slice(dot).toLowerCase()
  return DANGEROUS_EXTENSIONS.has(ext)
}
