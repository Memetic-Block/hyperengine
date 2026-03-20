import { collectTemplatesFromDir } from './templates.js'
import type { TemplateEntry } from './templates.js'

export interface AdminOptions {
  /** Absolute path to the admin source directory */
  dir: string
  /** File extensions to collect as admin templates (default: HTML extensions) */
  extensions?: string[]
}

/**
 * Collect admin template files from the user's admin directory.
 *
 * Scans for HTML files in the admin dir and returns entries prefixed
 * with "admin/" so they sit alongside user templates without collision.
 */
export async function collectAdminTemplates(options: AdminOptions): Promise<TemplateEntry[]> {
  const extensions = options.extensions ?? ['.html', '.htm']
  return collectTemplatesFromDir(options.dir, extensions, 'admin/')
}
