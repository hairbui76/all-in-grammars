# Vietnamese part of a note

Every note in `Grammar/Concepts/` ends with a `## Ghi chú tiếng Việt` section. It holds a Vietnamese
mirror of the note. The build weaves it into the lesson so each Vietnamese line appears right under
the English line it belongs to: paragraph under paragraph, bullet under bullet, table cell under
table cell.

The English above that heading is the source and is never edited for this.

## Layout

One level-3 heading (`###`) part per English section, titled with the **exact English `##` title**, in the same order,
after a first part for the one-line summary:

```markdown
## Ghi chú tiếng Việt

### In one line

Diễn tả một hành động đã kết thúc tại một thời điểm xác định trong quá khứ.

### When to use

- Hành động đã xảy ra và kết thúc trong quá khứ
- Chuỗi hành động xảy ra nối tiếp nhau trong quá khứ

### Examples

- Hồi nhỏ, tôi **sống** ở một ngôi làng nhỏ.
```

`Grammar/Concepts/Past Simple.md` and `Grammar/Concepts/Adjective Plus About.md` are complete examples.

## Rules that keep the two languages aligned

Each part mirrors its English section **block for block, in the same order**:

| English block | Vietnamese part |
| --- | --- |
| Paragraph | One paragraph |
| Bullet or numbered list | A list of the same type with the **same number of items**; nested bullets stay nested under the same item |
| Table | A table with the **same number of rows and columns** |
| `###` sub-heading inside the section | A `###` sub-heading, translated |
| Callout (`> [!note] Title`) | The same callout, title and body translated |
| Code block (three backticks) | Leave it out, or copy it unchanged |
| Paragraph that is only formulas in backticks | Leave it out, or copy it unchanged |

A block copied unchanged gets no second line in the app. Copy a code block rather than dropping it
when it sits between two lists: without it, Markdown would merge your two lists into one.

Whole sections:

- `Related`: leave it out.
- A section that holds only code blocks or formulas: leave it out.
- Every other section needs its part, and `### In one line` comes first.

Special sections:

- **Common mistakes**: one bullet per English bullet. For a `❌ … → ✅ …` line, write a short explanation
  of why the first sentence is wrong (the rule being broken). Do not repeat the two sentences.
- **Contrast with**: one line per English line, same link, Vietnamese description:
  `- [[Present Perfect]] — không có thời điểm quá khứ xác định`. A line with no description is copied as is.

Inside tables:

- Copy the header row unchanged.
- Copy unchanged any cell that is the English word, form, formula or transcription itself. A cell
  identical to the English one gets no second line in the app.
- Translate cells that give a meaning or an explanation, and translate example sentences.

## How to write the Vietnamese

- Natural Vietnamese for Vietnamese learners of English, using the usual school grammar terms
  (thì quá khứ đơn, mệnh đề quan hệ, câu bị động, động từ khuyết thiếu, danh động từ, động từ nguyên mẫu,
  phân từ, đảo ngữ, thức giả định, tân ngữ, chủ ngữ, trạng từ, giới từ…).
- English that is the thing being taught stays in English with its formatting: anything in backticks,
  and quoted or italic English words and phrases. Example: *Verbs such as `start`, `begin`* →
  *Các động từ như `start`, `begin`*.
- Example sentences are translated in full, as a Vietnamese speaker would say them. Where the English
  bolds the target words, bold the matching Vietnamese words if there is a natural match; otherwise
  use no bold.
- Keep `[[wiki links]]` exactly as written (the titles are English).
- Say what the English says: no added rules, no dropped items.

## Checking

```bash
node scripts/build-content.mjs --check "Grammar/Concepts/Past Simple.md"   # one or more notes
node scripts/build-content.mjs --check                                      # every note
```

The check lists notes whose Vietnamese part is missing, lacks a section, or does not line up
(different number of list items, table rows, blocks). A part that does not line up is still shown in
the app, as one block after the English section instead of line by line.
