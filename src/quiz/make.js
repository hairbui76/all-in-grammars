// Builds a question from a raw quiz item (see scripts/quiz-bank.mjs): wording, wrong options, order.
// A question is {id, kind, note, ask, stem, opts, answer, explain}, all HTML except id/kind/note/answer.
import { esc } from '../ui.js'
import { shuffled } from './rng.js'

export const KIND = {
  pick: 'Chọn câu đúng',
  gap: 'Điền chỗ trống',
  mean: 'Nghĩa của cụm từ',
  prep: 'Giới từ, tiểu từ',
  stress: 'Trọng âm',
  sound: 'Phát âm',
  reply: 'Giao tiếp',
}

const low = (s) => s.toLowerCase()
const wordCount = (s) => s.trim().split(/\s+/).length
const capital = (s) => s[0].toUpperCase() + s.slice(1)
/** Lower-cases a first letter that was a capital only because it opened a sentence. */
const uncapital = (s) => (/^(I|I'[a-z]+)\b/.test(s) ? s : s[0].toLowerCase() + s.slice(1))
const blank = (sentence) => esc(sentence).replace('{_}', '<span class="gap"></span>')
const filled = (sentence, answer) => esc(sentence).replace('{_}', `<b>${esc(answer)}</b>`)
const vi = (text) => (text ? `<span class="vi">${esc(text)}</span>` : '')

/** Up to `n` entries of `pools`, searched in order, that `ok` accepts and that differ from each other. */
function choose(pools, n, rnd, ok, keyOf = low) {
  const out = []
  const seen = new Set()
  for (const pool of pools) {
    for (const c of shuffled(pool, rnd)) {
      const key = keyOf(c)
      if (seen.has(key) || !ok(c)) continue
      seen.add(key)
      out.push(c)
      if (out.length === n) return out
    }
  }
  return out
}

/** Puts the right answer among the wrong ones. Returns null when there are too few wrong ones. */
function finish(item, rnd, parts, right, wrong, need = 3) {
  if (wrong.length < need) return null
  const opts = shuffled([right, ...wrong], rnd)
  return { id: item.i, kind: item.k, note: item.n, stem: '', explain: '', ...parts, opts, answer: opts.indexOf(right) }
}

const makers = {
  pick(item, bank, rnd) {
    return finish(item, rnd, { ask: 'Câu nào đúng ngữ pháp?', explain: [item.x, item.why].filter(Boolean).map((t) => `<span class="q-line">${esc(t)}</span>`).join('') }, esc(item.good), [esc(item.bad)], 1)
  },

  gap(item, bank, rnd) {
    const a = low(item.a)
    const fit = (c) => (item.cap ? capital(c.a) : c.cap ? uncapital(c.a) : c.a)
    const others = (list) => list.filter((x) => x.k === 'gap')
    // wrong options come from the same lesson first, so they are forms the learner has just met
    const wrong = choose(
      [others(bank.ofNote(item.n)), others(bank.ofUnit(item.u)), bank.byKind.gap],
      3,
      rnd,
      (c) => low(c.a) !== a && !low(c.a).includes(a) && !a.includes(low(c.a)) && Math.abs(wordCount(c.a) - wordCount(item.a)) <= 1,
      (c) => low(c.a),
    ).map((c) => esc(fit(c)))
    const right = esc(item.cap ? capital(item.a) : item.a)
    return finish(item, rnd, { ask: 'Chọn đáp án đúng để điền vào chỗ trống', stem: blank(item.s), explain: filled(item.s, item.a) + vi(item.v) }, right, wrong)
  },

  mean(item, bank, rnd) {
    const same = (list) => list.filter((x) => x.k === 'mean' && x !== item)
    const pools = [same(bank.ofNote(item.n)), same(bank.ofUnit(item.u))]
    const explain = `<b>${esc(item.term)}</b>: ${esc(item.vi)} <span class="muted">(${esc(item.en)})</span>` + (item.ex ? `<span class="q-ex">${esc(item.ex)}${vi(item.exv)}</span>` : '')
    if (rnd() < 0.5) {
      const wrong = choose(pools, 3, rnd, (c) => low(c.vi) !== low(item.vi), (c) => low(c.vi)).map((c) => esc(c.vi))
      return finish(item, rnd, { ask: `<b class="q-term">${esc(item.term)}</b> nghĩa là gì?`, explain }, esc(item.vi), wrong)
    }
    // two phrases with the same Vietnamese meaning would both be right
    const wrong = choose(pools, 3, rnd, (c) => low(c.vi) !== low(item.vi) && low(c.term) !== low(item.term), (c) => low(c.term)).map((c) => esc(c.term))
    return finish(item, rnd, { ask: `Đáp án nào có nghĩa <b class="q-term">“${esc(item.vi)}”</b>?`, explain }, esc(item.term), wrong)
  },

  prep(item, bank, rnd) {
    const n = wordCount(item.a)
    const sameLength = (list) => list.filter((a) => wordCount(a) === n)
    const wrong = choose([sameLength(bank.prepAnswers(item.u)), sameLength(bank.byKind.prep.map((x) => x.a))], 3, rnd, (c) => c !== item.a)
    const show = (a) => esc(item.cap ? capital(a) : a)
    const explain = filled(item.s, item.cap ? capital(item.a) : item.a) + `<span class="q-ex"><b>${esc(item.term)}</b>${item.vi ? `: ${esc(item.vi)}` : ''}</span>`
    return finish(item, rnd, { ask: 'Chọn từ đúng để điền vào chỗ trống', stem: blank(item.s), explain }, show(item.a), wrong.map(show))
  },

  stress(item, bank, rnd) {
    return oddOneOut(item, rnd, bank.byKind.stress, (x) => x.pos, {
      ask: 'Từ nào có trọng âm chính ở vị trí khác với ba từ còn lại?',
      // words of the same length make the odd one harder to spot
      closeness: (x) => Math.abs(x.syl - item.syl),
      detail: (x) => `${esc(x.ipa)} · âm tiết ${x.pos}`,
    })
  },

  sound(item, bank, rnd) {
    const ending = item.fam === 'ed' ? '-ed' : '-s/-es'
    return oddOneOut(item, rnd, bank.byKind.sound.filter((x) => x.fam === item.fam), (x) => x.g, {
      ask: `Từ nào có đuôi <b>${ending}</b> phát âm khác với ba từ còn lại?`,
      closeness: () => 0,
      detail: (x) => `đuôi đọc là ${esc(x.g)}`,
    })
  },

  reply(item, bank, rnd) {
    // responses from other lessons: one from the same lesson often fits the same opening
    const wrong = choose([bank.byKind.reply.filter((x) => x.n !== item.n)], 3, rnd, (c) => low(c.b) !== low(item.b), (c) => low(c.b)).map((c) => esc(c.b))
    return finish(item, rnd, { ask: 'Chọn câu đáp phù hợp nhất', stem: `“${esc(item.a)}”` }, esc(item.b), wrong)
  },
}

/** The item against three items that share a different value of `group` (stress position, ending sound). */
function oddOneOut(item, rnd, all, group, { ask, closeness, detail }) {
  const byGroup = new Map()
  for (const x of all) if (group(x) !== group(item)) byGroup.set(group(x), [...(byGroup.get(group(x)) || []), x])
  const candidates = [...byGroup.values()].filter((list) => list.length >= 3)
  if (!candidates.length) return null
  const list = candidates[Math.floor(rnd() * candidates.length)]
  // closest first, ties broken at random
  const three = shuffled(list, rnd).sort((a, b) => closeness(a) - closeness(b)).slice(0, 3)
  const explain = [item, ...three].map((x) => `<span class="q-line"><b>${esc(x.w)}</b> ${detail(x)}</span>`).join('')
  return finish(item, rnd, { ask, explain }, esc(item.w), three.map((x) => esc(x.w)))
}

/** The question for an item, or null when the bank cannot supply enough wrong options. */
export const makeQuestion = (item, bank, rnd) => makers[item.k]?.(item, bank, rnd) ?? null
