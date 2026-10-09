// Quiz sets: which items a quiz draws from, and how a round is put together.
//
// A set is addressed by a key in the URL (#/quiz/<key>):
//   u-<unit id>    one unit                     p-<n>     a study path
//   x-<exam part>  one part of the exam         t-<n>     fixed test n (same questions every time)
//   me-daily       today's ten (same all day)   me-bad    questions answered wrongly before
//   me-learnt      lessons marked as learnt     me-new    lessons never quizzed
import { U, PATHS, unitById } from '../data.js'
import { S, save, dayKey } from '../state.js'
import { href } from '../ui.js'
import { makeQuestion } from './make.js'
import { rng, shuffled } from './rng.js'

const unitId = (title) => U.find((u) => u.t === title)?.id
const PHRASAL = unitId('Phrasal Verbs')
const PREPOSITIONS = unitId('Prepositions')
const CONVERSATION = unitId('Communication Functions')
// sentence grammar: everything except vocabulary lists, pronunciation and conversation
const VOCABULARY = new Set([PHRASAL, PREPOSITIONS, CONVERSATION, unitId('Word Stress'), unitId('English Sounds'), unitId('Word Formation')])

/** Parts of the exam, each with the items that belong to it. */
export const EXAM_PARTS = [
  { id: 'grammar', label: 'Ngữ pháp tổng hợp', hint: 'Thì, bị động, điều kiện, mệnh đề…', has: (x) => !VOCABULARY.has(x.u) && (x.k === 'gap' || x.k === 'pick') },
  { id: 'stress', label: 'Trọng âm', hint: 'Tìm từ nhấn khác vị trí', has: (x) => x.k === 'stress' },
  { id: 'sound', label: 'Phát âm', hint: 'Đuôi -ed và -s/-es', has: (x) => x.k === 'sound' },
  { id: 'prep', label: 'Giới từ', hint: 'Tính từ, động từ đi với giới từ', has: (x) => x.u === PREPOSITIONS },
  { id: 'phrasal', label: 'Cụm động từ', hint: 'Nghĩa và tiểu từ', has: (x) => x.u === PHRASAL },
  { id: 'comm', label: 'Giao tiếp', hint: 'Chọn câu đáp phù hợp', has: (x) => x.u === CONVERSATION },
]

export const TEST_COUNT = 10
export const TEST_SIZE = 40
// how many questions of each kind a fixed test holds, in the order they are asked
const TEST_MIX = [['sound', 1], ['stress', 3], ['gap', 14], ['pick', 6], ['prep', 5], ['mean', 8], ['reply', 3]]

/** The items of fixed test `n` (1-based): a seeded shuffle of each kind, dealt out test by test. */
function testItems(bank, n) {
  const items = []
  for (const [kind, count] of TEST_MIX) {
    const all = shuffled((bank.byKind[kind] || []).slice().sort((a, b) => (a.i < b.i ? -1 : 1)), rng(`tests-${kind}`))
    for (let j = 0; j < count && all.length; j++) items.push(all[((n - 1) * count + j) % all.length])
  }
  return items
}

const HOME = { back: '#/review', backLabel: 'Về Ôn tập', tab: 'review' }

/**
 * Describes the set behind a key: {key, label, items, size, ...}, or null for an unknown key.
 * `fixed` sets ask their items in the given order; `seed` makes wrong options and order repeatable.
 */
export function resolveSet(key, bank) {
  const [type, arg] = /^\d+$/.test(key) ? ['u', key] : [key.slice(0, key.indexOf('-')), key.slice(key.indexOf('-') + 1)]
  const all = bank.items

  if (type === 'u') {
    const u = unitById(arg)
    return u && { key: `u-${u.id}`, label: u.t, items: bank.ofUnit(u.id), size: 20, unit: u, back: href('u', u.id), backLabel: 'Về chuyên đề', tab: 'units' }
  }
  if (type === 'p') {
    const p = PATHS[Number(arg)]
    return p && { key, label: `Lộ trình ${p.title}`, items: all.filter((x) => p.units.includes(x.u)), size: 20, ...HOME }
  }
  if (type === 'x') {
    const part = EXAM_PARTS.find((e) => e.id === arg)
    return part && { key, label: part.label, items: all.filter(part.has), size: 20, ...HOME }
  }
  if (type === 't') {
    const n = Number(arg)
    if (!(n >= 1 && n <= TEST_COUNT)) return null
    return { key, label: `Đề số ${n}`, items: testItems(bank, n), size: TEST_SIZE, fixed: true, seed: key, test: n, ...HOME }
  }
  if (key === 'me-bad' || key === 'miss') {
    const items = Object.keys(S.bad).map((id) => bank.byId.get(id)).filter(Boolean)
    return { key: 'me-bad', label: 'Câu từng sai', items, size: 20, empty: 'Chưa có câu sai nào cần ôn. Làm quiz, câu nào sai sẽ được gom về đây.', ...HOME }
  }
  if (key === 'me-learnt') {
    return { key, label: 'Bài đã học', items: all.filter((x) => S.done[x.n]), size: 20, empty: 'Bạn chưa đánh dấu bài nào là đã học.', ...HOME }
  }
  if (key === 'me-new') {
    return { key, label: 'Bài chưa làm quiz', items: all.filter((x) => !S.tried[x.n]), size: 20, empty: 'Bài nào bạn cũng đã làm quiz ít nhất một lần.', ...HOME }
  }
  if (key === 'me-daily' || key === 'all') {
    // Chosen once and kept for the day: up to four old mistakes, then lessons already learnt, then anything.
    const today = dayKey()
    if (S.daily.d !== today || !S.daily.ids?.length) {
      const rnd = rng(`daily-${today}`)
      const bad = shuffled(Object.keys(S.bad).map((id) => bank.byId.get(id)).filter(Boolean), rnd).slice(0, 4)
      const learnt = all.filter((x) => S.done[x.n])
      const rest = mix(learnt.length >= 20 ? learnt : all, 10, rnd).filter((x) => !bad.includes(x))
      S.daily = { d: today, ids: [...bad, ...rest].slice(0, 10).map((x) => x.i) }
      save()
    }
    const items = S.daily.ids.map((id) => bank.byId.get(id)).filter(Boolean)
    return { key: 'me-daily', label: 'Ôn hôm nay', items, size: 10, fixed: true, seed: `daily-${today}`, daily: today, back: '#/', backLabel: 'Về trang chủ', tab: 'review' }
  }
  return null
}

/** `n` items drawn evenly across the kinds present, so one large kind does not crowd out the others. */
function mix(items, n, rnd) {
  const byKind = new Map()
  for (const x of items) byKind.set(x.k, [...(byKind.get(x.k) || []), x])
  const piles = shuffled([...byKind.values()], rnd).map((pile) => shuffled(pile, rnd))
  const out = []
  while (out.length < n && piles.some((p) => p.length)) for (const pile of piles) if (pile.length && out.length < n) out.push(pile.pop())
  return out
}

/** The questions of one round of a set. */
export function buildRound(set, bank) {
  const rnd = rng(set.seed)
  // a few spares: an item is skipped when the bank cannot give it three wrong options
  const items = set.fixed ? set.items : mix(set.items, set.size + 5, rnd)
  const questions = []
  for (const item of items) {
    const q = makeQuestion(item, bank, rnd)
    if (q) questions.push(q)
    if (questions.length === set.size) break
  }
  return questions
}
