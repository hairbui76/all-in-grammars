// Turns the Obsidian vault in Grammar/ into the JSON the app imports:
//   src/generated/index.json       units + light per-note metadata (always loaded)
//   src/generated/units/<id>.json  rendered lessons + flashcards, one chunk per unit
//   src/generated/search.json      plain text of every lesson, loaded on first search
import { readFile, readdir, mkdir, writeFile, rm } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { marked } from 'marked'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const conceptsDir = path.join(root, 'Grammar', 'Concepts')
const outDir = path.join(root, 'src', 'generated')

const config = JSON.parse(await readFile(path.join(root, 'content', 'units.json'), 'utf8'))

const escAttr = (s) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;')
const escHtml = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const unescHtml = (s) =>
  s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&')

/** Markdown emphasis and code markers removed, for list previews and quiz options. */
const plain = (s) =>
  s
    .replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, '$2')
    .replace(/\[\[([^\]]+)\]\]/g, '$1')
    .replace(/`([^`]*)`/g, '$1')
    .replace(/\*{1,3}([^*]+)\*{1,3}/g, '$1')
    .replace(/\s+/g, ' ')
    .trim()

function parseFrontmatter(raw) {
  const text = raw.replace(/\r\n/g, '\n')
  const m = text.match(/^---\n([\s\S]*?)\n---\n?/)
  const fm = {}
  if (m) {
    for (const line of m[1].split('\n')) {
      const kv = line.match(/^(\w+):\s*(.*)$/)
      if (!kv) continue
      let v = kv[2].trim()
      if (v.startsWith('[') && v.endsWith(']')) {
        v = v.slice(1, -1).split(',').map((x) => x.trim().replace(/^"|"$/g, '')).filter(Boolean)
      } else {
        v = v.replace(/^"|"$/g, '')
      }
      fm[kv[1]] = v
    }
  }
  return { fm, body: m ? text.slice(m[0].length) : text }
}

/** `> [!type] Title` blockquotes become <div class="callout">. */
function convertCallouts(md) {
  const lines = md.split('\n')
  const out = []
  for (let i = 0; i < lines.length; i++) {
    const head = lines[i].match(/^> \[!(\w+)\]\s*(.*)$/)
    if (!head) {
      out.push(lines[i])
      continue
    }
    const inner = []
    while (i + 1 < lines.length && lines[i + 1].startsWith('>')) inner.push(lines[++i].replace(/^> ?/, ''))
    const [, type, title] = head
    out.push(`<div class="callout c-${type}">`)
    if (title && type !== 'abstract') out.push(`<div class="ct">${marked.parseInline(title)}</div>`)
    out.push('', ...inner, '', '</div>', '')
  }
  return out.join('\n')
}

let linkTarget = () => null

function render(md) {
  let html = marked.parse(convertCallouts(md))
  // Obsidian wikilinks
  html = html.replace(/\[\[([^\]]+)\]\]/g, (_, inner) => {
    const [target, alias] = unescHtml(inner).split('|')
    const href = linkTarget(target.trim())
    const label = escHtml((alias || target).trim())
    return href ? `<a class="wl" href="${escAttr(href)}">${label}</a>` : `<span class="dead">${label}</span>`
  })
  // marked leaves ** alone inside inline code and around bare punctuation; in these notes it is always emphasis
  html = html
    .split(/(<pre>[\s\S]*?<\/pre>)/)
    .map((part, i) => (i % 2 ? part : part.replace(/\*\*([^*<\n]+?)\*\*/g, '<strong>$1</strong>')))
    .join('')
  html = html.replace(/[❌✗]/g, '<span class="x">✗</span>').replace(/[✅✓]/g, '<span class="v">✓</span>')
  html = html.replace(/<table>/g, '<div class="tw"><table>').replace(/<\/table>/g, '</table></div>')
  return html.trim()
}

const renderInline = (md) => render(md).replace(/^<p>|<\/p>$/g, '')

function splitSections(body) {
  const sections = {}
  let name = null
  for (const line of body.split('\n')) {
    const h = line.match(/^## (.+)$/)
    if (h) {
      name = h[1].trim()
      sections[name] = ''
    } else if (name) sections[name] += line + '\n'
  }
  return sections
}

function flashcard(sections) {
  let form = (sections['Form'] || sections['Rule'] || sections['Rules'] || '').trim()
  if (form.length > 700) {
    // keep whole blocks only, so tables and code fences are never cut in half
    let kept = ''
    for (const block of form.split(/\n{2,}/)) {
      if (kept && kept.length + block.length > 700) break
      kept += (kept ? '\n\n' : '') + block
    }
    form = kept
  }
  const exKey = Object.keys(sections).find((k) => k.startsWith('Examples'))
  const examples = exKey
    ? sections[exKey].split('\n').filter((l) => l.startsWith('- ')).slice(0, 3).map((l) => renderInline(l.slice(2)))
    : []
  return { f: form ? render(form) : '', e: examples }
}

function quizPairs(sections) {
  const pairs = []
  for (const line of (sections['Common mistakes'] || '').split('\n')) {
    const m = line.match(/^- [❌✗]\s*(.+?)\s*→\s*[✅✓]\s*(.+)$/)
    if (!m) continue
    // a trailing "(…)" explains the answer, so it is shown only after answering
    const why = []
    const [bad, good] = [m[1], m[2]].map((side) =>
      plain(side)
        .replace(/\s*\(([^()]*)\)\.?$/, (_, w) => (why.push(w), ''))
        .replace(/\.$/, ''),
    )
    // a wrong side that lists alternatives, or a gloss with "=", does not work as a two-way choice
    if ([bad, good].some((x) => x.length < 3 || / = /.test(x)) || bad.includes(' / ') || bad === good) continue
    pairs.push(why.length ? [bad, good, why.join('; ')] : [bad, good])
  }
  return pairs
}

// ---------- read the vault ----------
const files = (await readdir(conceptsDir)).filter((f) => f.endsWith('.md'))
const raw = new Map()
for (const f of files) {
  const { fm, body } = parseFrontmatter(await readFile(path.join(conceptsDir, f), 'utf8'))
  raw.set(fm.title || f.slice(0, -3), { fm, body })
}

const unitByTitle = new Map(config.units.map((u) => [u.title, u]))
const noteUnit = new Map()
for (const u of config.units) {
  u.notes = u.notes.filter((t) => {
    if (!raw.has(t)) console.warn(`! units.json lists "${t}" (${u.title}) but Grammar/Concepts has no such note`)
    return raw.has(t)
  })
  for (const t of u.notes) noteUnit.set(t, u)
}
// notes added to the vault but not yet listed in units.json: file them under their first hub link
for (const [title, { body }] of raw) {
  if (noteUnit.has(title)) continue
  const related = body.split(/^## Related$/m)[1] || ''
  const hub = [...related.matchAll(/\[\[([^\]|]+)/g)].map((m) => unitByTitle.get(m[1].trim())).find(Boolean)
  if (!hub) {
    console.warn(`! "${title}" is not in content/units.json and links to no unit — skipped`)
    continue
  }
  console.warn(`+ "${title}" is not in content/units.json — added to ${hub.title}`)
  hub.notes.push(title)
  noteUnit.set(title, hub)
}

linkTarget = (target) => {
  if (noteUnit.has(target)) return `#/n/${encodeURIComponent(target)}`
  if (unitByTitle.has(target)) return `#/u/${unitByTitle.get(target).id}`
  if (target === 'English Grammar MOC') return '#/'
  return null
}

// ---------- render ----------
const index = { meta: { book: config.book, total: 0, quiz: 0 }, units: [], notes: {} }
const chunks = new Map(config.units.map((u) => [u.id, {}]))
const search = {}

for (const u of config.units) {
  index.units.push({ id: u.id, t: u.title, vn: u.vn, g: u.group, desc: u.desc, n: u.notes })
  for (const title of u.notes) {
    const { fm, body } = raw.get(title)
    let md = body.replace(/^# .+\n/m, '').replace(/<!--[\s\S]*?-->/g, '')
    // the Vietnamese section is a placeholder in most notes; drop it while it is empty
    md = md.replace(/\n## Ghi chú tiếng Việt\s*$/, '\n')

    const abstract = (md.match(/^> \[!abstract\][^\n]*\n((?:>.*\n?)+)/m)?.[1] || '').replace(/^> ?/gm, '').trim()
    const sections = splitSections(md)
    const html = render(md)
    const q = quizPairs(sections)

    index.notes[title] = { u: u.id, ab: plain(abstract), al: Array.isArray(fm.aliases) ? fm.aliases : [], q }
    chunks.get(u.id)[title] = { h: html, src: fm.source || '', fc: flashcard(sections) }
    search[title] = unescHtml(html.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim()
    index.meta.total++
    index.meta.quiz += q.length
  }
}

await rm(outDir, { recursive: true, force: true })
await mkdir(path.join(outDir, 'units'), { recursive: true })
await writeFile(path.join(outDir, 'index.json'), JSON.stringify(index))
await writeFile(path.join(outDir, 'search.json'), JSON.stringify(search))
for (const [id, chunk] of chunks) await writeFile(path.join(outDir, 'units', `${id}.json`), JSON.stringify(chunk))

console.log(`content: ${index.meta.total} notes, ${index.units.length} units, ${index.meta.quiz} quiz pairs`)
