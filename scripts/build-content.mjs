// Turns the Obsidian vault in Grammar/ into the JSON the app imports:
//   src/generated/index.json       units + light per-note metadata (always loaded)
//   src/generated/units/<id>.json  lessons split into typed sections + flashcards, one chunk per unit
//   src/generated/search.json      plain text of every lesson, loaded on first search
//   src/generated/quiz.json        raw quiz material (see quiz-bank.mjs), loaded with the first quiz
//
// Each note may end with "## Ghi chú tiếng Việt": a Vietnamese mirror of its sections, one
// "### <English section title>" part per section. The mirror is woven into the lesson item by item
// (see weave below).
//
//   node scripts/build-content.mjs                    build
//   node scripts/build-content.mjs --check [notes…]   report Vietnamese mirrors that are missing or do not line up
import { readFile, readdir, mkdir, writeFile, rm } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { marked } from 'marked'
import { parse as parseHtml } from 'node-html-parser'
import { quizItems, finishBank } from './quiz-bank.mjs'

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
  html = html.replace(/<table>[\s\S]*?<\/table>/g, labelTable)
  return html.trim()
}

/** Wraps a table for scrolling and copies each column heading onto its cells, so narrow screens can show rows as cards. */
function labelTable(table) {
  const heads = [...table.matchAll(/<th[^>]*>([\s\S]*?)<\/th>/g)].map((m) => escAttr(unescHtml(m[1].replace(/<[^>]+>/g, '')).trim()))
  const body = table.replace(/<tr>([\s\S]*?)<\/tr>/g, (row) => {
    let i = 0
    // one wrapper per cell, so a stacked cell can lay out "label | content" as two columns
    return row.replace(/<td>([\s\S]*?)<\/td>/g,(_, cell) => `<td data-label="${heads[i++] ?? ''}"><span>${cell}</span></td>`)
  })
  // three or more columns are too wide for a phone; the stylesheet stacks those
  return `<div class="tw${heads.length >= 3 ? ' stack' : ''}">${body}</div>`
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

const topBullets = (md) => (md || '').split('\n').filter((l) => l.startsWith('- ')).map((l) => l.slice(2))

function flashcard(sections, vi) {
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
  const en = topBullets(sections[exKey])
  const viEx = topBullets(vi[exKey])
  // translations are attached only when they line up one to one with the examples
  const examples = en.slice(0, 3).map((line, i) => renderInline(line) + (viEx.length === en.length ? viSpan(renderInline(viEx[i])) : ''))
  return { f: form ? render(form) : '', e: examples }
}

/** Wrong/right sentence pairs from "Common mistakes": [bad, good, why, Vietnamese explanation]. */
function quizPairs(sections, vi) {
  const pairs = []
  const lines = topBullets(sections['Common mistakes'])
  // the Vietnamese part explains each mistake, bullet for bullet
  const viLines = topBullets(vi['Common mistakes'])
  const explain = (i) => (viLines.length === lines.length ? plain(viLines[i]) : '')
  for (const [i, text] of lines.entries()) {
    const m = `- ${text}`.match(/^- [❌✗]\s*(.+?)\s*→\s*[✅✓]\s*(.+)$/)
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
    pairs.push([bad, good, why.join('; '), explain(i)])
  }
  return pairs
}

// Known section headings: [kind, Vietnamese label]. Anything else keeps its English title.
const SECTION = {
  Form: ['form', 'Công thức'],
  Rule: ['form', 'Quy tắc'],
  Rules: ['form', 'Quy tắc'],
  'When to use': ['use', 'Cách dùng'],
  'When to use each': ['use', 'Cách dùng'],
  Uses: ['use', 'Cách dùng'],
  'Main uses': ['use', 'Cách dùng'],
  Examples: ['ex', 'Ví dụ'],
  'Notes & exceptions': ['note', 'Lưu ý & ngoại lệ'],
  'Common mistakes': ['fix', 'Lỗi thường gặp'],
  'Contrast with': ['vs', 'Phân biệt với'],
  Related: ['rel', 'Bài liên quan'],
  'The list': ['list', 'Danh sách'],
  List: ['list', 'Danh sách'],
  'Reference list': ['list', 'Danh sách'],
  'Full lists by preposition': ['list', 'Danh sách theo giới từ'],
  'The set': ['list', 'Nhóm từ'],
  'The group': ['list', 'Nhóm từ'],
  'The pairs': ['list', 'Các cặp từ'],
  'Useful patterns': ['other', 'Mẫu câu hay dùng'],
  Patterns: ['other', 'Mẫu câu'],
  'Common fixed expressions': ['other', 'Cụm cố định'],
}

function sectionMeta(title) {
  if (SECTION[title]) return { k: SECTION[title][0], vn: SECTION[title][1], en: title }
  const ex = title.match(/^Examples\s*[—-]\s*(.+)$/)
  if (ex) return { k: 'ex', vn: `Ví dụ — ${ex[1]}`, en: '' }
  return { k: 'other', vn: '', en: title }
}

/** Section titles may carry inline markdown such as `code`. */
function titleHtml(meta) {
  return { ...meta, vn: escHtml(meta.vn), en: meta.vn ? escHtml(meta.en) : renderInline(meta.en) }
}

/** "❌ wrong → ✅ right" bullets become correction cards; other lines render as usual. */
function renderMistakes(md) {
  const out = []
  for (const line of md.split('\n')) {
    const m = line.match(/^- [❌✗]\s*(.+?)\s*→\s*[✅✓]\s*(.+)$/)
    if (!m) {
      out.push(line)
      continue
    }
    const cell = (cls, mark, text) => `<p class="fix-${cls}"><span class="${cls}">${mark}</span><span>${renderInline(text)}</span></p>`
    // entities, so render() does not wrap the marks a second time
    out.push('', `<div class="fix">${cell('x', '&#10007;', m[1])}${cell('v', '&#10003;', m[2])}</div>`, '')
  }
  return render(out.join('\n'))
}

/** Bullets of the form "[[Note]] — why it differs". Returns null when the section holds anything else. */
function linkBullets(md) {
  const items = []
  for (const line of md.split('\n')) {
    if (!line.trim()) continue
    const m = line.match(/^- \[\[([^\]|]+)(?:\|[^\]]+)?\]\]\s*(?:[—–-]\s*(.+))?$/)
    if (!m) return null
    items.push({ t: m[1].trim(), d: m[2] || '' })
  }
  return items
}

/** Link cards for "Contrast with". Returns null when the section is not a plain list of links. */
function renderContrast(md, viMd, problems) {
  const items = linkBullets(md)
  if (!items) return null
  // the Vietnamese description is matched to its card by the note it links to
  const viItems = viMd ? linkBullets(viMd) : []
  if (viMd && !viItems) problems.push('Contrast with: every Vietnamese line must be "- [[Note]] — mô tả"')
  const viDesc = new Map((viItems || []).map((x) => [x.t, x.d]))
  const cards = items.map(({ t, d }) => {
    const to = linkTarget(t)
    const vi = viDesc.get(t)
    if (viMd && viItems && d && !vi) problems.push(`Contrast with: no Vietnamese description for [[${t}]]`)
    const inner = `<b>${escHtml(t)}</b>${d ? `<span>${renderInline(d)}</span>` : ''}${vi ? viSpan(renderInline(vi)) : ''}`
    return to ? `<a class="vs-i" href="${escAttr(to)}">${inner}</a>` : `<div class="vs-i">${inner}</div>`
  })
  return `<div class="vs">${cards.join('')}</div>`
}

// ---------- Vietnamese mirror ----------
const VI_HEADING = 'Ghi chú tiếng Việt'
const viSpan = (html) => `<span class="vi">${html}</span>`
const sameText = (a, b) => a.replace(/\s+/g, ' ').trim().toLowerCase() === b.replace(/\s+/g, ' ').trim().toLowerCase()
const elements = (node) => node.childNodes.filter((n) => n.nodeType === 1)
const isList = (el) => el.tagName === 'UL' || el.tagName === 'OL'

/** Splits the Vietnamese part into {section title: markdown}; `keys` are the titles it may mirror. */
function parseVi(md, keys, problems) {
  const parts = {}
  let name = null
  let stray = ''
  for (const line of md.split('\n')) {
    const h = line.match(/^### (.+)$/)
    if (h && keys.includes(h[1].trim())) {
      name = h[1].trim()
      parts[name] = ''
    } else if (name) parts[name] += line + '\n'
    else stray += line
  }
  if (stray.trim()) problems.push(`text before the first "### <section>" heading: "${stray.trim().slice(0, 40)}"`)
  return parts
}

function blockKind(el) {
  if (isList(el)) return 'list'
  if (el.tagName === 'DIV') return ['tw', 'callout', 'fix', 'ct', 'vs'].find((c) => el.classList.contains(c)) || 'div'
  return el.tagName.toLowerCase()
}

/** True for blocks the mirror may leave out because they hold nothing to translate. */
function codeOnly(el) {
  if (el.tagName === 'PRE') return true
  if (el.tagName !== 'P' || !el.querySelector('code')) return false
  // a paragraph of formulas: no words outside the code spans, only separators such as "·" or "="
  const outside = el.childNodes.filter((n) => n.tagName !== 'CODE').map((n) => n.text).join('')
  return !/\p{L}/u.test(outside)
}

/**
 * Pairs English blocks with Vietnamese ones in order; code-only English blocks may have no partner.
 * Returns null when the two do not line up.
 */
function alignBlocks(E, V) {
  const dead = new Set()
  const from = (i, j) => {
    if (i === E.length) return j === V.length ? [] : null
    const key = i * (V.length + 1) + j
    if (dead.has(key)) return null
    if (j < V.length && blockKind(E[i]) === blockKind(V[j])) {
      const rest = from(i + 1, j + 1)
      if (rest) return [[E[i], V[j]], ...rest]
    }
    // the mirror left this formula out
    const rest = codeOnly(E[i]) ? from(i + 1, j) : null
    if (!rest) dead.add(key)
    return rest
  }
  return from(0, 0)
}

const shape = (els) => els.map(blockKind).join(', ') || 'nothing'

/** Inline content of a list item: everything but its nested lists, with paragraph wrappers removed. */
function ownHtml(li) {
  return li.childNodes
    .filter((n) => !(n.nodeType === 1 && isList(n)))
    .map((n) => (n.nodeType === 1 && n.tagName === 'P' ? `${n.innerHTML} ` : n.toString()))
    .join('')
    .trim()
}
const ownText = (li) => parseHtml(ownHtml(li)).text

function weaveList(e, v, problems, where) {
  const eItems = elements(e).filter((x) => x.tagName === 'LI')
  const vItems = elements(v).filter((x) => x.tagName === 'LI')
  if (eItems.length !== vItems.length) {
    problems.push(`${where}: a list has ${eItems.length} items in English but ${vItems.length} in Vietnamese`)
    v.classList.add('vi')
    e.insertAdjacentHTML('afterend', v.toString())
    return
  }
  eItems.forEach((eLi, i) => {
    const vLi = vItems[i]
    const eNested = elements(eLi).filter(isList)
    const vNested = elements(vLi).filter(isList)
    const own = ownHtml(vLi)
    if (own && !sameText(ownText(vLi), ownText(eLi))) {
      if (eNested[0]) eNested[0].insertAdjacentHTML('beforebegin', viSpan(own))
      else eLi.insertAdjacentHTML('beforeend', viSpan(own))
    }
    if (eNested.length === vNested.length) eNested.forEach((n, k) => weaveList(n, vNested[k], problems, where))
    else problems.push(`${where}: item ${i + 1} has ${eNested.length} nested lists in English but ${vNested.length} in Vietnamese`)
  })
}

function weaveTable(e, v, problems, where) {
  const rows = (t) => t.querySelectorAll('tbody tr').map((tr) => elements(tr))
  const eRows = rows(e)
  const vRows = rows(v)
  if (eRows.length !== vRows.length || eRows.some((r, i) => r.length !== vRows[i].length)) {
    problems.push(`${where}: a table is ${eRows.length}×${eRows[0]?.length ?? 0} in English but ${vRows.length}×${vRows[0]?.length ?? 0} in Vietnamese`)
    v.classList.add('vi')
    e.insertAdjacentHTML('afterend', v.toString())
    return
  }
  eRows.forEach((cells, r) =>
    cells.forEach((eTd, c) => {
      const vTd = vRows[r][c]
      // cells that were copied unchanged (the word itself, a formula) get no second line
      if (!vTd.text.trim() || sameText(vTd.text, eTd.text)) return
      const [eWrap] = elements(eTd)
      const [vWrap] = elements(vTd)
      eWrap.insertAdjacentHTML('beforeend', viSpan(vWrap.innerHTML))
    }),
  )
}

function weaveBlocks(E, V, problems, where) {
  const pairs = alignBlocks(E, V)
  if (!pairs) return false
  for (const [e, v] of pairs) {
    const kind = blockKind(e)
    if (kind === 'list') weaveList(e, v, problems, where)
    else if (kind === 'tw') weaveTable(e, v, problems, where)
    else if (kind === 'callout' || kind === 'blockquote') {
      if (!weaveBlocks(elements(e), elements(v), problems, where)) {
        problems.push(`${where}: a callout holds [${shape(elements(e))}] in English but [${shape(elements(v))}] in Vietnamese`)
        e.insertAdjacentHTML('beforeend', `<div class="vi">${v.innerHTML}</div>`)
      }
    } else if (sameText(e.text, v.text)) continue
    else if (kind === 'p') e.insertAdjacentHTML('afterend', `<p class="vi">${v.innerHTML}</p>`)
    else if (kind === 'pre') e.insertAdjacentHTML('afterend', `<pre class="vi">${v.innerHTML}</pre>`)
    else e.insertAdjacentHTML('beforeend', viSpan(v.innerHTML))
  }
  return true
}

/**
 * Weaves the Vietnamese mirror of a section into its English HTML: each paragraph, list item, table cell
 * and correction card gets its translation right underneath. When the two do not line up, the Vietnamese
 * text is appended as one block instead and the mismatch is reported.
 */
function weave(kind, enHtml, viMd, problems, where) {
  if (!viMd || !viMd.trim()) return enHtml
  const viHtml = render(viMd)
  const en = parseHtml(enHtml)
  const vi = parseHtml(viHtml)
  const E = elements(en)
  const V = elements(vi)
  const fallback = (why) => {
    problems.push(`${where}: ${why}`)
    return `${enHtml}<div class="vi vi-block">${viHtml}</div>`
  }

  if (kind === 'fix' && E.some((el) => blockKind(el) === 'fix')) {
    // one Vietnamese bullet (why it is wrong) per English bullet, whether that became a card or stayed a bullet
    const items = (els) => els.flatMap((el) => (isList(el) ? elements(el) : codeOnly(el) ? [] : [el]))
    const eItems = items(E)
    const vItems = items(V)
    if (eItems.length !== vItems.length) return fallback(`${eItems.length} items in English but ${vItems.length} in Vietnamese`)
    eItems.forEach((e, i) => {
      const v = vItems[i]
      const html = v.tagName === 'LI' ? ownHtml(v) : v.innerHTML
      if (blockKind(e) === 'fix') e.insertAdjacentHTML('beforeend', `<p class="fix-vi vi">${html}</p>`)
      else if (e.tagName === 'LI') e.insertAdjacentHTML('beforeend', viSpan(html))
      else e.insertAdjacentHTML('afterend', `<p class="vi">${html}</p>`)
    })
    return en.toString()
  }

  if (!weaveBlocks(E, V, problems, where)) return fallback(`blocks are [${shape(E)}] in English but [${shape(V)}] in Vietnamese`)
  return en.toString()
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
const index = { meta: { book: config.book, total: 0, quiz: 0 }, paths: config.paths || [], units: [], notes: {} }
const chunks = new Map(config.units.map((u) => [u.id, {}]))
const search = {}
let bank = []
/** note title → what is missing or misaligned in its Vietnamese mirror */
const report = new Map()
/** A section made only of code blocks and formulas has nothing to translate. */
const needsVi = (text) => elements(parseHtml(render(text.trim()))).some((el) => !codeOnly(el))

for (const u of config.units) {
  index.units.push({ id: u.id, t: u.title, vn: u.vn, g: u.group, desc: u.desc, n: u.notes })
  for (const title of u.notes) {
    const { fm, body } = raw.get(title)
    const [md, viMd = ''] = body
      .replace(/^# .+\n/m, '')
      .replace(/<!--[\s\S]*?-->/g, '')
      .split(new RegExp(`^## ${VI_HEADING}\\s*$`, 'm'))

    const abstract = (md.match(/^> \[!abstract\][^\n]*\n((?:>.*\n?)+)/m)?.[1] || '').replace(/^> ?/gm, '').trim()
    const sections = splitSections(md)

    const problems = []
    const vi = parseVi(viMd, ['In one line', ...Object.keys(sections)], problems)
    const q = quizPairs(sections, vi)
    if (!Object.keys(vi).length) problems.push(viMd.trim() ? 'the Vietnamese part has no "### <English section title>" headings' : 'no Vietnamese part yet')
    else {
      const missing = Object.entries(sections).filter(([name, text]) => sectionMeta(name).k !== 'rel' && !vi[name]?.trim() && needsVi(text))
      if (missing.length) problems.push(`sections without Vietnamese: ${missing.map(([name]) => name).join(', ')}`)
      if (abstract && !vi['In one line']?.trim()) problems.push('no "### In one line"')
    }
    report.set(title, problems)

    // whatever sits between the one-line summary and the first heading
    const intro = md.split(/^## /m)[0].replace(/^> \[!abstract\][^\n]*\n(?:>.*\n?)+/m, '').trim()
    const secs = []
    let rel = []
    for (const [name, text] of Object.entries(sections)) {
      const meta = sectionMeta(name)
      const body = text.trim()
      if (!body) continue
      if (meta.k === 'rel') {
        const links = linkBullets(body)
        if (links) {
          // lessons and units that exist become chips; anything unresolved is dropped
          rel = links.map(({ t }) => ({ t, h: linkTarget(t) })).filter((l) => l.h && l.h !== '#/')
          continue
        }
      }
      const cards = meta.k === 'vs' ? renderContrast(body, vi[name], problems) : null
      const html = cards ?? weave(meta.k, meta.k === 'fix' ? renderMistakes(body) : render(body), vi[name], problems, name)
      secs.push({ ...titleHtml(meta), h: html })
    }
    const lead = renderInline(abstract)
    const leadVi = vi['In one line']?.trim() ? renderInline(vi['In one line'].trim()) : ''
    const introHtml = intro ? render(intro) : ''

    bank.push(...quizItems({ title, unit: u.title, sections, vi, pairs: q, english: md }))
    index.notes[title] = { u: u.id, ab: plain(abstract), al: Array.isArray(fm.aliases) ? fm.aliases : [], qn: 0 }
    chunks.get(u.id)[title] = { lead, leadVi, intro: introHtml, secs, rel, src: fm.source || '', fc: flashcard(sections, vi) }
    const text = [lead, leadVi, introHtml, ...secs.map((x) => `${x.en} ${x.h}`)].join(' ')
    search[title] = unescHtml(text.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim()
    index.meta.total++
  }
}

bank = finishBank(bank)
for (const item of bank) index.notes[item.n].qn++
index.meta.quiz = bank.length

const untranslated = [...report.values()].filter((p) => p.includes('no Vietnamese part yet')).length
const misaligned = [...report].filter(([, p]) => p.length && !p.includes('no Vietnamese part yet'))

const checkAt = process.argv.indexOf('--check')
if (checkAt > -1) {
  // arguments are note titles or paths to notes; none means every note
  const wanted = process.argv.slice(checkAt + 1).map((a) => path.basename(a).replace(/\.md$/, ''))
  const unknown = wanted.filter((t) => !report.has(t))
  for (const t of unknown) console.log(`? ${t}: no such note`)
  const shown = [...report].filter(([t]) => !wanted.length || wanted.includes(t))
  const bad = shown.filter(([, p]) => p.length)
  for (const [t, p] of bad) console.log(`✗ ${t}\n${p.map((x) => `    ${x}`).join('\n')}`)
  console.log(`${shown.length - bad.length}/${shown.length} notes have a complete, aligned Vietnamese part`)
  process.exit(bad.length || unknown.length ? 1 : 0)
}

await rm(outDir, { recursive: true, force: true })
await mkdir(path.join(outDir, 'units'), { recursive: true })
await writeFile(path.join(outDir, 'index.json'), JSON.stringify(index))
await writeFile(path.join(outDir, 'search.json'), JSON.stringify(search))
await writeFile(path.join(outDir, 'quiz.json'), JSON.stringify(bank))
for (const [id, chunk] of chunks) await writeFile(path.join(outDir, 'units', `${id}.json`), JSON.stringify(chunk))

const kinds = {}
for (const item of bank) kinds[item.k] = (kinds[item.k] || 0) + 1
console.log(`content: ${index.meta.total} notes, ${index.units.length} units`)
console.log(`quiz: ${bank.length} items (${Object.entries(kinds).map(([k, n]) => `${k} ${n}`).join(', ')})`)
console.log(
  `vietnamese: ${index.meta.total - untranslated}/${index.meta.total} notes` +
    (misaligned.length ? `, ${misaligned.length} with gaps (run "npm run content -- --check" for details)` : ''),
)
