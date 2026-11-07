# Turn my notes into a Dozi notes CSV

> **For the person:** paste this whole file into a chatbot (ChatGPT, Claude, Gemini…), then paste
> or upload your notes (typed notes, a lecture PDF, slides, a photo of your book). Save the
> chatbot's answer as a `.csv` file and import it in Dozi: **Library → Notes → the import button
> (arrow out of a page) → Choose a CSV file**. Check the notes afterwards: the chatbot can make
> mistakes.

---

## Instructions for the chatbot

You are converting study notes into a CSV file that the Dozi study app imports. Follow these
rules exactly.

### What to output

- Output **only** the CSV, inside one code block marked `csv`. No comments before or after it.
- Use commas between columns and put **every** cell in double quotes `"…"`.
- Inside a cell, write a double quote as two double quotes (`""`).
- The first line is this header, exactly:

```csv
"note","section","text","kind","sheet"
```

### One row = one part of a note

| Column | Required | What goes in it |
|---|---|---|
| `note` | yes on the first row of each note | The note's title, e.g. `Binary search`. Rows with the same title become **one note**, in order. You may leave it empty on the following rows of the same note. Keep titles under 120 characters. |
| `section` | no | A heading for this part, e.g. `How it works`. Leave empty to carry on under the previous heading. |
| `text` | yes | The words for this part (see "Writing the text"). |
| `kind` | no | What sort of block it is (see "Kinds"). Leave empty for normal text. |
| `sheet` | no | On the first row of a note only: which sheet (template) the note is filed under (see "Sheets"). |

### Writing the text

- Each line in the cell becomes its own paragraph. Put real line breaks inside the quoted cell,
  or write `\n` where a new line starts.
- `- ` at the start of a line makes a bullet. `1. ` makes a numbered list.
- `[ ] ` makes a checklist item, `[x] ` a ticked one.
- Wrap key words in `**double stars**` to make them bold. Use bold for the words a student must
  remember. No other formatting (no `#` headings, no tables, no links, no images).
- Keep each cell under 20,000 characters. Split long parts into several rows with their own
  sections.

### Kinds

| `kind` | Use it for |
|---|---|
| *(empty)* or `text` | Normal notes, bullets and numbered lists. |
| `mnemonic` | A memory trick, e.g. a phrase built from first letters. |
| `tip` | An exam tip or "remember this". |
| `warning` | A common mistake, a trap or a danger. |
| `pearl` | A short practical insight (a "clinical pearl" in medicine). |
| `code` | Program code. Each line is kept exactly, including spaces. |
| `quote` | A definition or quotation to keep word for word. |
| `checklist` | A list of things to know or do: every line becomes a checkbox. |

### Sheets

Pick the one that fits the note best, or leave it empty:

| `sheet` | For |
|---|---|
| `concept` | One idea: in one line, how it works, example, mistakes, links. |
| `classDay` | Notes from one class or lecture. |
| `examRevision` | Revision for an exam: must-knows, mistakes to fix, past paper questions. |
| `algorithm` | An algorithm: the idea, steps, code, time and space cost, edge cases. |
| `bugDiary` | A bug: what broke, why, the fix, the lesson. |
| `compare` | Comparing two or more things. |
| `drugProfile` | A medicine (pharmacy students). |
| `lecture` | A pharmacy lecture. |
| `classComparison` | Comparing the drugs in one class (pharmacy). |
| `caseSummary` | A patient case summary (no names or other identifying details). |

### How to structure the notes

1. Split the material into notes of one topic each (one concept, one lecture, one drug…).
   Several notes in one file is fine (up to 300).
2. Give each note clear sections, in a sensible study order. Good sections for most topics:
   **In one line**, **How it works**, **Example**, **Key numbers**, **Common mistakes**,
   **Links to**. For a lecture: **Big ideas**, **Main notes**, **New words**, **Still confused
   by**.
3. Prefer short bullets over long paragraphs.
4. Add a `mnemonic` row when a list has to be memorised in order, and a `tip` or `warning` row
   for the points exams like to test.
5. **Only use what is in the student's material.** Do not add facts, numbers, doses or examples
   that are not in it. If something is unclear or missing, leave it out rather than guess. For
   medicines, never invent doses.
6. Keep the student's own wording where it is clear. Use British English spelling.

### Example

```csv
"note","section","text","kind","sheet"
"Binary search","In one line","Find an item in a **sorted** list by halving the part you search each step.","","concept"
"","How it works","1. Look at the middle item
2. Too big? Search the left half. Too small? Search the right half.
3. Repeat until you find it or nothing is left","",""
"","Code","lo, hi = 0, len(a) - 1
while lo <= hi:
    mid = (lo + hi) // 2","code",""
"","Key numbers","- Time: O(log n)
- Space: O(1)","",""
"","Common mistakes","Off-by-one errors when moving hi or lo.","warning",""
"OSI model","The layers (1 to 7)","- Physical
- Data link
- Network
- Transport
- Session
- Presentation
- Application","","concept"
"","Mnemonic","Please Do Not Throw Sausage Pizza Away","mnemonic",""
```

### Before you answer, check

- The header is exactly `"note","section","text","kind","sheet"`.
- Every row has 5 cells, all in double quotes.
- Each note's first row has its title in `note`.
- `kind` is empty or one of: text, mnemonic, tip, warning, pearl, code, quote, checklist.
- `sheet` is empty or one of the names in the Sheets table.
- Nothing was added that isn't in the student's material.
