/**
 * Shared CSV/Excel column detection for the bulk Finder and bulk Verification
 * flows.
 *
 * Both flows already parse files with PapaParse (`header: true`) or `xlsx`.
 * This module only interprets the resulting header row — it never parses a
 * file itself, so there is exactly one parser stack in the app.
 *
 * Matching is deterministic and explicit:
 *   - a header is normalised (camelCase split, separators to spaces, lowercased)
 *     and looked up in an ordered synonym list per field;
 *   - the earliest entry in that list wins, so `Email` beats `Email Address`
 *     and `Domain` beats `Website` by documented precedence, not by guessing;
 *   - only a genuine tie (two different headers matching the *same* entry)
 *     is reported as ambiguous, and the caller is expected to block on it.
 */

export type DetectableField = 'email' | 'firstName' | 'lastName' | 'domain' | 'role'

export type DetectionMode = 'verify' | 'find'

/** How a field's value is obtained from a row. */
export type DetectionSource = 'direct' | 'split-from-full-name'

export interface DetectedColumn {
  field: DetectableField
  /** Header exactly as it appears in the uploaded file. */
  header: string
  source: DetectionSource
  /** Lower-precedence headers that also looked like this field, if any. */
  alternates: string[]
}

export interface AmbiguousField {
  field: DetectableField
  /** Headers that matched equally well — detection refuses to pick one. */
  candidates: string[]
}

export interface ColumnDetectionResult {
  mode: DetectionMode
  /** Headers read off the file, in their original order. */
  headers: string[]
  mapping: Partial<Record<DetectableField, DetectedColumn>>
  /** Required fields with no matching column. */
  missing: DetectableField[]
  /** Required fields with more than one equally good column. */
  ambiguous: AmbiguousField[]
  /** True when every required field resolved to exactly one column. */
  ok: boolean
}

export const FIELD_LABELS: Record<DetectableField, string> = {
  email: 'Email',
  firstName: 'First Name',
  lastName: 'Last Name',
  domain: 'Domain',
  role: 'Role',
}

/**
 * Header normalisation. Kept byte-identical to the rule the bulk finder has
 * always used, so no CSV that imported before stops importing now.
 */
export const normalizeColumnName = (name: string) => {
  const withSpaces = String(name ?? '').replace(/([a-z])([A-Z])/g, '$1 $2')
  return withSpaces.toLowerCase().replace(/[_\-.]+/g, ' ').replace(/\s+/g, ' ').trim()
}

/* Ordered synonym lists — earlier entries take precedence over later ones. */

const EMAIL_TARGETS = [
  'email',
  'e mail',
  'email address',
  'e mail address',
  'email addresses',
  'email id',
  'work email',
  'business email',
  'company email',
  'professional email',
  'contact email',
  'primary email',
  'personal email',
  'lead email',
  'prospect email',
  'person email',
  'user email',
  'recipient email',
  'verified email',
  'mail',
  'mail address',
  'mail id',
]

const FIRST_NAME_TARGETS = [
  'first name',
  'firstname',
  'fname',
  'f name',
  'first',
  'given name',
  'givenname',
  'forename',
  'person first name',
  'contact first name',
  'lead first name',
  'prospect first name',
]

const LAST_NAME_TARGETS = [
  'last name',
  'lastname',
  'lname',
  'l name',
  'last',
  'surname',
  'sur name',
  'family name',
  'familyname',
  'family',
  'person last name',
  'contact last name',
  'lead last name',
  'prospect last name',
]

const FULL_NAME_TARGETS = [
  'full name',
  'fullname',
  'name',
  'person name',
  'contact name',
  'full contact name',
  'display name',
  'employee name',
  'customer name',
  'client name',
  'lead name',
  'prospect name',
  'individual name',
]

const DOMAIN_TARGETS = [
  'domain',
  'domain name',
  'company domain',
  'business domain',
  'organization domain',
  'organisation domain',
  'website domain',
  'email domain',
  'company url',
  'website url',
  'company website',
  'website',
  'web site',
  'web address',
  'url',
  'site',
]

const ROLE_TARGETS = [
  'role',
  'job title',
  'title',
  'position',
  'designation',
  'person title',
  'work title',
  'occupation',
  'function',
]

interface FieldMatch {
  header: string
  alternates: string[]
  /** Populated only when several headers matched the same synonym entry. */
  tied: string[]
}

const matchField = (
  normalized: Array<{ orig: string; norm: string }>,
  targets: string[]
): FieldMatch | null => {
  const hits: Array<{ orig: string; rank: number }> = []
  for (const col of normalized) {
    const rank = targets.indexOf(col.norm)
    if (rank !== -1) hits.push({ orig: col.orig, rank })
  }
  if (hits.length === 0) return null

  hits.sort((a, b) => a.rank - b.rank)
  const bestRank = hits[0].rank
  const tied = Array.from(new Set(hits.filter(h => h.rank === bestRank).map(h => h.orig)))
  const alternates = Array.from(new Set(hits.filter(h => h.rank !== bestRank).map(h => h.orig)))

  return {
    header: tied[0],
    alternates,
    tied: tied.length > 1 ? tied : [],
  }
}

/**
 * Split a single "Full Name" cell into first and last parts.
 *
 * The separator handling matches `buildBulkFindRequest` in bulk-find-utils so
 * a name split here produces exactly the payload the API already receives for
 * a file that had separate first/last columns.
 */
export const splitFullName = (value: string): { first: string; last: string } => {
  const normalized = String(value ?? '')
    .trim()
    .replace(/[/,._\-@#$%]+/g, ' ')
  const parts = normalized.split(/\s+/).filter(Boolean)
  return {
    first: parts[0] || '',
    last: parts.slice(1).join(' ') || '',
  }
}

/**
 * Case-insensitive cell read. Headers come from the file itself so an exact
 * hit is the normal path; the fallback protects against trailing whitespace
 * differences between the header row and the parsed keys.
 */
export const readCell = (row: Record<string, unknown>, header?: string): string => {
  if (!header) return ''
  const direct = row[header]
  if (typeof direct === 'string') return direct
  if (typeof direct === 'number') return String(direct)

  const match = Object.keys(row).find(k => k.toLowerCase().trim() === header.toLowerCase().trim())
  if (!match) return ''
  const value = row[match]
  if (typeof value === 'string') return value
  if (typeof value === 'number') return String(value)
  return ''
}

/**
 * Read First/Last for one row, honouring a Full Name column when that is what
 * the file provided.
 */
export const readNameParts = (
  row: Record<string, unknown>,
  detection: ColumnDetectionResult
): { first: string; last: string } => {
  const first = detection.mapping.firstName
  const last = detection.mapping.lastName

  if (first?.source === 'split-from-full-name' || last?.source === 'split-from-full-name') {
    const source = first ?? last
    return splitFullName(readCell(row, source?.header))
  }

  return {
    first: readCell(row, first?.header).trim(),
    last: readCell(row, last?.header).trim(),
  }
}

/**
 * Detect the columns a flow needs.
 *
 * `verify` requires Email. `find` requires First Name, Last Name and Domain,
 * where the two name fields may be derived from a single Full Name column.
 * Role stays optional for `find`, exactly as before.
 */
export const detectColumns = (
  rawHeaders: string[],
  mode: DetectionMode
): ColumnDetectionResult => {
  const headers = (rawHeaders || []).filter(h => typeof h === 'string' && h.trim() !== '')
  const normalized = headers.map(h => ({ orig: h, norm: normalizeColumnName(h) }))

  const mapping: Partial<Record<DetectableField, DetectedColumn>> = {}
  const missing: DetectableField[] = []
  const ambiguous: AmbiguousField[] = []

  const assign = (field: DetectableField, match: FieldMatch | null, source: DetectionSource) => {
    if (!match) return false
    if (match.tied.length > 1) {
      ambiguous.push({ field, candidates: match.tied })
      return false
    }
    mapping[field] = { field, header: match.header, source, alternates: match.alternates }
    return true
  }

  if (mode === 'verify') {
    const email = matchField(normalized, EMAIL_TARGETS)
    if (!assign('email', email, 'direct') && !email) missing.push('email')
  } else {
    const firstMatch = matchField(normalized, FIRST_NAME_TARGETS)
    const lastMatch = matchField(normalized, LAST_NAME_TARGETS)
    const fullMatch = matchField(normalized, FULL_NAME_TARGETS)

    // Separate first/last columns win; otherwise a Full Name column is split.
    if (firstMatch && lastMatch) {
      if (!assign('firstName', firstMatch, 'direct') && !firstMatch) missing.push('firstName')
      if (!assign('lastName', lastMatch, 'direct') && !lastMatch) missing.push('lastName')
    } else if (fullMatch) {
      const placed = assign('firstName', fullMatch, 'split-from-full-name')
      if (placed) {
        mapping.lastName = {
          field: 'lastName',
          header: fullMatch.header,
          source: 'split-from-full-name',
          alternates: fullMatch.alternates,
        }
      }
    } else {
      if (!assign('firstName', firstMatch, 'direct') && !firstMatch) missing.push('firstName')
      if (!assign('lastName', lastMatch, 'direct') && !lastMatch) missing.push('lastName')
    }

    const domain = matchField(normalized, DOMAIN_TARGETS)
    if (!assign('domain', domain, 'direct') && !domain) missing.push('domain')

    // Role is optional: a tie is simply left undetected rather than blocking.
    const role = matchField(normalized, ROLE_TARGETS)
    if (role && role.tied.length <= 1) {
      mapping.role = { field: 'role', header: role.header, source: 'direct', alternates: role.alternates }
    }
  }

  return {
    mode,
    headers,
    mapping,
    missing,
    ambiguous,
    ok: missing.length === 0 && ambiguous.length === 0,
  }
}

/** Fields a flow shows in the preview, in display order. */
export const previewFields = (mode: DetectionMode): DetectableField[] =>
  mode === 'verify' ? ['email'] : ['firstName', 'lastName', 'domain', 'role']

/** Fields a flow cannot run without. */
export const requiredFields = (mode: DetectionMode): DetectableField[] =>
  mode === 'verify' ? ['email'] : ['firstName', 'lastName', 'domain']

/** One-line summary suitable for a toast. */
export const describeDetectionProblem = (detection: ColumnDetectionResult): string => {
  if (detection.ambiguous.length > 0) {
    const first = detection.ambiguous[0]
    return `Ambiguous ${FIELD_LABELS[first.field]} column — ${first.candidates.join(' and ')} both match. Rename one and re-upload.`
  }
  if (detection.missing.length > 0) {
    const names = detection.missing.map(f => FIELD_LABELS[f]).join(', ')
    return `Could not detect required column${detection.missing.length === 1 ? '' : 's'}: ${names}.`
  }
  return ''
}
