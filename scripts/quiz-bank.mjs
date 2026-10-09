// Turns the notes into raw quiz material. Each item is one fact that can be asked about; the app
// builds the actual question (wording, wrong options, order) from it at run time, see src/quiz/.
//
//   pick    {bad, good, why, x}     from "Common mistakes": which sentence is correct (x: why, in Vietnamese)
//   gap     {s, a, cap, v}          from "Examples": fill the bold part back into the sentence
//   mean    {term, vi, en, ex, exv} from "… | Meaning | …" tables: what a phrase means
//   prep    {s, a, cap, term}       from the same tables: fill in the preposition or particle
//   stress  {w, ipa, pos, syl}      words with a transcription: where the main stress falls
//   sound   {w, g, fam}             -ed and -s endings: how the ending is pronounced
//   reply   {a, b}                  conversation tables and dialogues: the fitting response
//
// `s` holds the sentence with "{_}" where the blank goes. Every item also carries
// i (stable id), k (kind) and n (note title).

/** Markdown emphasis, code marks and wiki-link brackets removed. */
export const plain = (s) =>
  s
    .replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, '$2')
    .replace(/\[\[([^\]]+)\]\]/g, '$1')
    .replace(/`([^`]*)`/g, '$1')
    .replace(/\*{1,3}([^*]+)\*{1,3}/g, '$1')
    .replace(/\*\*/g, '')
    .replace(/\s+/g, ' ')
    .trim()

/** FNV-1a, as a short base-36 string: ids stay the same from build to build while the text does. */
function hash(s) {
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return (h >>> 0).toString(36)
}

const cellsOf = (line) => line.trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim())

/** Markdown tables of a section: [{head: [...], rows: [[...]]}]. */
export function tables(md) {
  const out = []
  const lines = (md || '').split('\n')
  for (let i = 0; i < lines.length - 1; i++) {
    if (!/^\s*\|/.test(lines[i]) || !/^\s*\|[\s:|-]+\|\s*$/.test(lines[i + 1])) continue
    const table = { head: cellsOf(lines[i]), rows: [] }
    for (i += 2; i < lines.length && /^\s*\|/.test(lines[i]); i++) table.rows.push(cellsOf(lines[i]))
    out.push(table)
  }
  return out
}

const topBullets = (md) => (md || '').split('\n').filter((l) => l.startsWith('- ')).map((l) => l.slice(2))
const boldParts = (md) => [...md.matchAll(/\*\*(.+?)\*\*/g)]
const words = (s) => s.trim().split(/\s+/).filter(Boolean)
const escapeRx = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
/** True when position `at` in `text` starts a sentence, so an answer placed there is capitalised. */
const startsSentence = (text, at) => /(^|[.!?]["”']?\s+|[—→:]\s+|["“])$/.test(text.slice(0, at))

// ---------- gap: examples with the bold part taken out ----------
function gapItems(sections, vi) {
  const items = []
  for (const [name, text] of Object.entries(sections)) {
    if (!name.startsWith('Examples')) continue
    const en = topBullets(text)
    const viLines = topBullets(vi[name])
    en.forEach((line, i) => {
      // after "→" comes the transformed sentence, which is the one worth testing
      const arrow = line.lastIndexOf('→')
      const from = arrow > -1 && /\*\*/.test(line.slice(arrow)) ? arrow : 0
      const m = /\*\*(.+?)\*\*/.exec(line.slice(from))
      if (!m) return
      const at = from + m.index
      // bold inside a word marks a spelling or an ending, not a phrase to fill in
      if (/[A-Za-z]$/.test(line.slice(0, at)) || /^[A-Za-z]/.test(line.slice(at + m[0].length))) return
      const answer = plain(m[1]).replace(/[.,;:!?]+$/, '')
      const before = plain(line.slice(0, at))
      const after = plain(line.slice(at + m[0].length))
      const sentence = `${before}${before && !/[\s"“(']$/.test(before) ? ' ' : ''}{_}${/^[\s.,;:!?)"”']/.test(after) || !after ? '' : ' '}${after}`
      // A bullet may hold two examples joined by a dash. Ask about the one with the blank only:
      // the other one often shows the very form being tested.
      const parts = sentence.split(' — ')
      const part = parts.findIndex((p) => p.includes('{_}'))
      const viParts = (viLines.length === en.length ? plain(viLines[i]) : '').split(' — ')
      const s = parts[part]
      const total = words(s).length
      // "as if / though" lists alternatives; it cannot stand as a single option
      if (!answer || /[`[\]|/]/.test(answer) || words(answer).length > 5 || total < 5 || words(answer).length > total / 2) return
      items.push({
        k: 'gap',
        s,
        a: answer,
        cap: startsSentence(s, s.indexOf('{_}')),
        v: viParts.length === parts.length ? viParts[part] : viParts.join(' — '),
      })
    })
  }
  return items
}

// ---------- mean + prep: "term | Meaning | Example" tables ----------
const TERM_COLUMNS = ['phrasal verb', 'combination', 'phrase', 'expression', 'verb', 'adjective', 'prefix']
// stand-ins such as "sb" and "sth" mark where an object goes; they are not part of the answer
const PLACEHOLDER = /^(sb|sth|somebody|something|someone|someone's|one's|oneself|sw|swh|somewhere|a|an|the|\(.*\)|v-ing|v|to|n)$/i
const PREPOSITIONS = new Set(
  'about across after against ahead along around at away back behind by down for forward from in into of off on onto out over round through to towards under up upon with without within'.split(' '),
)

/** Blanks `answer` inside the bold part of an example sentence. Returns null when it is not there. */
function blankInBold(example, answer, last) {
  const rx = new RegExp(`\\b${escapeRx(answer)}\\b`, 'i')
  const parts = boldParts(example)
  for (const m of last ? parts.reverse() : parts) {
    const hit = rx.exec(m[1])
    if (!hit) continue
    const at = m.index + 2 + hit.index
    const s = plain(`${example.slice(0, at)}{_}${example.slice(at + hit[0].length)}`)
    return { s, cap: startsSentence(s, s.indexOf('{_}')) }
  }
  return null
}

function tableItems(sections, vi) {
  const items = []
  for (const [name, text] of Object.entries(sections)) {
    const viTables = tables(vi[name])
    tables(text).forEach((table, t) => {
      const head = table.head.map((h) => plain(h).toLowerCase())
      const mean = head.indexOf('meaning')
      if (mean < 1 || !TERM_COLUMNS.includes(head[0])) return
      const example = head.indexOf('example')
      const viRows = viTables[t]?.rows.length === table.rows.length ? viTables[t].rows : null
      table.rows.forEach((row, r) => {
        const term = plain(row[0])
        const en = plain(row[mean] || '')
        const viMeaning = plain(viRows?.[r]?.[mean] || '')
        const ex = example > -1 ? row[example] || '' : ''
        const exv = example > -1 ? plain(viRows?.[r]?.[example] || '') : ''
        if (!term || !en) return
        // a meaning that was copied rather than translated cannot be asked about in Vietnamese
        if (viMeaning && viMeaning.toLowerCase() !== en.toLowerCase())
          items.push({ k: 'mean', term, vi: viMeaning, en, ex: plain(ex), exv })

        if (!ex || /[/()]/.test(term)) return
        let answer = null
        let last = false
        if (head[0] === 'combination') {
          // "careless **about**": the bold word is the preposition that goes with the adjective or verb
          const bold = boldParts(row[0]).map((m) => plain(m[1]).toLowerCase())
          if (bold.length === 1 && PREPOSITIONS.has(bold[0])) answer = bold[0]
          last = true
        } else if (head[0] === 'phrasal verb') {
          // "get on with": everything after the verb, as long as it is only particles
          const rest = words(term).slice(1)
          if (rest.length && rest.length <= 2 && rest.every((w) => PREPOSITIONS.has(w.toLowerCase()))) answer = rest.join(' ').toLowerCase()
          last = true
        } else if (head[0] === 'phrase') {
          // "in fact", "out of order": the preposition the phrase opens with
          const w = words(term).map((x) => x.toLowerCase())
          if (w[0] === 'out' && w[1] === 'of') answer = 'out of'
          else if (PREPOSITIONS.has(w[0]) && w.length > 1 && !PLACEHOLDER.test(w[1])) answer = w[0]
        }
        if (!answer) return
        const blank = blankInBold(ex, answer, last)
        if (blank && words(blank.s).length >= 4) items.push({ k: 'prep', ...blank, a: answer, term, vi: viMeaning })
      })
    })
  }
  return items
}

// ---------- stress: words with a transcription ----------
const DIPHTHONGS = ['eɪ', 'aɪ', 'ɔɪ', 'əʊ', 'oʊ', 'aʊ', 'ɪə', 'eə', 'ʊə']
const VOWELS = 'iɪeæɑɒɔʊuʌɜəaoɛ'
/** Number of syllable nuclei in a stretch of transcription. */
function nuclei(ipa) {
  let n = 0
  for (let i = 0; i < ipa.length; ) {
    if (DIPHTHONGS.includes(ipa.slice(i, i + 2))) {
      n++
      i += 2
    } else if (VOWELS.includes(ipa[i])) {
      n++
      i += ipa[i + 1] === 'ː' ? 2 : 1
    } else i++
  }
  return n
}
/** l, m or n carrying a syllable of its own, as at the end of /ˈlɪsn/ or /ˈmentl/. */
const syllabic = (ipa) => (ipa.match(/[ptkbdgfvszʃʒθð][lmn](?![iɪeæɑɒɔʊuʌɜəaoɛ])/g) || []).length

// first sound → letters a word with that sound may start with: guards against pairing a
// transcription with the wrong neighbouring word
const ONSET = { p: 'p', b: 'b', t: 't', d: 'd', k: 'ckq', g: 'g', f: 'fp', v: 'v', θ: 't', ð: 't', s: 'scp', z: 'zx', ʃ: 'sc', ʒ: 'gj', h: 'hw', m: 'm', n: 'nkgp', ŋ: 'n', l: 'l', r: 'rw', j: 'uyeh', w: 'wo' }
function plausible(word, ipa) {
  const first = ipa.replace(/[ˈˌ.]/g, '')[0]
  const letter = word[0].toLowerCase()
  if (VOWELS.includes(first)) return 'aeiouh'.includes(letter)
  return !ONSET[first] || ONSET[first].includes(letter)
}

function stressPairs(md) {
  const pairs = []
  const add = (word, ipa) => {
    // "PREsent" marks the stressed syllable with capitals; "Vietnamese" is simply a proper noun
    const w = /[A-Z]/.test(word.slice(1)) ? word.toLowerCase() : word
    const body = ipa.replace(/[()]/g, '')
    if (!body.includes('ˈ') || !plausible(w, body)) return
    const syl = nuclei(body) + syllabic(body)
    if (syl >= 2) pairs.push({ w, ipa: `/${ipa}/`, pos: nuclei(body.slice(0, body.indexOf('ˈ'))) + 1, syl })
  }
  for (const raw of md.split('\n')) {
    const line = raw.replace(/\*\*/g, '')
    // "volunteer /ˌvɒlənˈtɪə/": a word directly followed by its transcription
    for (const m of line.matchAll(/([A-Za-z][A-Za-z-]*)\s+\/([^/|\s][^/|]*)\//g)) add(m[1], m[2])
    // "| dishonest | /dɪsˈɒnɪst/ |": a word in one cell, nothing but its transcription in the next
    if (/^\s*\|/.test(line)) {
      const cells = cellsOf(line)
      cells.forEach((cell, i) => {
        const ipa = /^\/([^/]+)\/$/.exec(cell)
        if (ipa && i > 0 && /^[A-Za-z][A-Za-z-]*$/.test(cells[i - 1])) add(cells[i - 1], ipa[1])
      })
    }
  }
  return pairs
}

// ---------- sound: how -ed and -s endings are read ----------
function soundItems(title, sections) {
  const fam = /-ED\b/i.test(title) ? 'ed' : /-S\b/i.test(title) ? 's' : null
  if (!fam) return []
  const items = []
  for (const text of Object.values(sections))
    for (const table of tables(text)) {
      if (plain(table.head[0]).toLowerCase() !== 'ending is read') continue
      for (const row of table.rows) {
        const g = plain(row[0])
        for (const w of plain(row[row.length - 1]).split(',').map((x) => x.trim())) if (/^[a-z]+$/i.test(w)) items.push({ k: 'sound', w, g, fam })
      }
    }
  return items
}

// ---------- reply: what to answer ----------
const RESPONSE_COLUMNS = ['typical response', 'typical answer']
const OPENING_COLUMNS = ['typical opening', 'request', 'offer', 'invitation', 'question', 'expression']
/** First ready-to-say sentence in a cell, or '' when the cell holds a pattern such as "Let me + V ...". */
function utterance(cell) {
  const quoted = /`([^`]+)`/.exec(cell)
  const text = plain(quoted ? quoted[1] : cell)
  return /\.\.\.|…| \+ |\bV\b|\bsb\b|\bsth\b/.test(text) || words(text).length < 2 ? '' : text
}

function replyItems(sections) {
  const items = []
  for (const [name, text] of Object.entries(sections)) {
    for (const table of tables(text)) {
      const head = table.head.map((h) => plain(h).toLowerCase())
      const to = head.findIndex((h) => RESPONSE_COLUMNS.includes(h))
      const from = head.findIndex((h) => OPENING_COLUMNS.includes(h))
      if (to < 1 || from < 0 || from >= to) continue
      for (const row of table.rows) {
        const a = utterance(row[from] || '')
        const b = utterance(row[to] || '')
        if (a && b) items.push({ k: 'reply', a, b, table: true })
      }
    }
    if (!name.startsWith('Examples')) continue
    // "Could you help me?" — "Sure, I'll do it now." (two turns only)
    for (const line of topBullets(text)) {
      const m = /^["“]([^"“”]+)["”]\s*[—–-]\s*["“]([^"“”]+)["”]\.?$/.exec(plain(line))
      if (m && words(m[1]).length >= 3 && words(m[2]).length >= 2) items.push({ k: 'reply', a: m[1], b: m[2] })
    }
  }
  return items
}

/**
 * All quiz items of one note. `pairs` are the wrong/right sentences already taken from
 * "Common mistakes"; `unit` is the unit title, which decides which kinds make sense.
 */
export function quizItems({ title, unit, sections, vi, pairs, english }) {
  const items = pairs.map(([bad, good, why, x]) => ({ k: 'pick', bad, good, ...(why ? { why } : {}), ...(x ? { x } : {}) }))
  const pronunciation = unit === 'Word Stress' || unit === 'English Sounds'
  const conversation = unit === 'Communication Functions'

  // in pronunciation notes bold marks a stressed syllable; in conversation notes it marks a whole reply
  if (!pronunciation && !conversation) items.push(...gapItems(sections, vi))
  if (!pronunciation) items.push(...tableItems(sections, vi))
  if (unit === 'Word Stress') items.push(...stressPairs(english).map((p) => ({ k: 'stress', ...p })))
  if (pronunciation) items.push(...soundItems(title, sections))
  if (conversation) items.push(...replyItems(sections))

  const seen = new Set()
  return items
    .map((item) => ({ i: hash(`${item.k}|${title}|${JSON.stringify(item)}`), n: title, ...item }))
    .filter((item) => !seen.has(item.i) && seen.add(item.i))
}

/** Bank-wide clean-up: a word given two different stress positions is a noun/verb pair, not one answer. */
export function finishBank(items) {
  const positions = new Map()
  const word = (x) => x.w.toLowerCase()
  for (const x of items) if (x.k === 'stress') positions.set(word(x), (positions.get(word(x)) || new Set()).add(x.pos))
  // A response belongs to one opening. Where the notes pair it with two, trust the reference table
  // over the example dialogue, then the first one seen.
  const replies = items.filter((x) => x.k === 'reply').sort((a, b) => Number(!!b.table) - Number(!!a.table))
  const keptReply = new Map()
  for (const x of replies) if (!keptReply.has(x.b.toLowerCase())) keptReply.set(x.b.toLowerCase(), x)

  const seenWord = new Set()
  return items
    .filter((x) => {
      if (x.k === 'reply') return keptReply.get(x.b.toLowerCase()) === x
      if (x.k !== 'stress' && x.k !== 'sound') return true
      if (x.k === 'stress' && positions.get(word(x)).size > 1) return false
      // the same word listed in two notes is one question, not two
      const key = `${x.k}|${word(x)}`
      return !seenWord.has(key) && seenWord.add(key)
    })
    .map(({ table, ...x }) => x)
}
