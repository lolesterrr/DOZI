# Product Spec — Dozi (working name)

> Pharmacology study companion for pharmacy students at Mbarara University of Science and
> Technology (MUST), Uganda. Android first, offline first.

---

## 1. Vision

Pharmacology is the hardest course unit MUST pharmacy students take. There are hundreds of
drugs, each with a mechanism, pharmacokinetics, uses, adverse effects, interactions and doses.
It is examined in every format, from multiple true/false to long essays and practical stations.

Dozi combines three things in one app:

1. **Freedom.** A personal study workspace: your own notes, flashcards, diagrams and quizzes,
   in whatever form suits you.
2. **Structure.** A curriculum-aligned **roadmap** with reviewed, Uganda-relevant content, so a
   student always knows what to study next.
3. **Motivation.** Dozi the crane mascot, XP, daily streaks and visible topic progress, so
   studying becomes a daily habit instead of a panic before exams.

### Who it's for
- **Primary:** Bachelor of Pharmacy students at MUST (all years that take pharmacology).
- **Secondary (later):** Other health programmes that take pharmacology (MBChB, Nursing),
  other Ugandan universities, and pharmacy interns.
- **Content team:** The founder plus student reviewers and, where possible, a lecturer.

### Product principles
1. **Offline is the default.** Nothing important needs data.
2. **Respect the student's data bundle and phone.** Keep the app small, images compressed and
   downloads optional.
3. **The student owns their content.** Anything they make can be edited, exported and deleted.
4. **Official content is trustworthy.** It is reviewed, versioned and labelled; students can report
   errors in one tap.
5. **Encourage, never shame.** Streaks and reminders motivate; they never guilt-trip.
6. **Exam-real practice.** Practise in the same formats MUST actually examines.

---

## 2. Navigation

Five bottom tabs, plus a global search button in the header:

| Tab | Purpose |
|---|---|
| **Today** | Home. Dozi greeting, streak, daily goal ring, "Continue roadmap", reviews due, today's plan, quick-create. |
| **Learn** | The roadmap path, plus the curriculum browser (course units → topics → drugs/lessons). |
| **Practice** | Review due cards, quizzes, mock exams, weak-spot drills, PK calculation trainer. |
| **Library** | Everything the student created: Notes · Decks · Quizzes, with folders and tags. |
| **Me** | Profile, stats and progress, achievements, settings, account and sync. |

A floating **"+ Create"** button on Today and Library opens: New note · New deck · New card ·
New quiz · Scan diagram (camera → note or image-occlusion card).

---

## 3. Onboarding (first launch, offline)

1. Dozi introduces itself (animated).
2. "Which year are you in?" and "Which semester?" This preselects course units.
3. Choose a daily goal: Casual 20 XP · Regular 50 XP · Serious 100 XP · Intense 150 XP.
4. Reminder time (default 19:00), then the notification permission prompt.
5. Optional: "When is your next pharmacology exam?" (date). This powers the study planner.
6. Optional: create an account now or later. The app is fully usable without one; an account
   adds backup and sync.

---

## 4. Personal content — "study your way"

Everything here works offline and belongs to the user. All types support **folders, tags,
pin/favourite, search, a link to a curriculum topic or drug (optional), duplicate, export and
delete (with undo)**.

### 4.1 Notes
- **Rich-text editor:** headings, bold/italic/underline, highlight colours, bullet/numbered/check
  lists, tables, blockquote, divider, and **callout blocks** (Exam tip · Mnemonic · Warning ·
  Clinical pearl).
- **Images:** insert from the camera or gallery; they are compressed automatically. Add a caption and
  tap to view full screen with pinch-zoom.
- **Annotate images:** draw arrows, circles, boxes, freehand strokes and text labels over a diagram
  (for example, a photo of the lecturer's board). The original is kept.
- **Links:** mention a drug or topic (`@propranolol`) to create a tappable link to its profile.
- **Templates:** Blank · Lecture notes · Drug profile (MOA / PK / uses / ADRs / CIs / interactions /
  dose) · Drug class comparison table · Case summary.
- **Make flashcards from notes:** select text → "Make card" (basic or cloze). The card keeps a
  link back to the note.
- **Autosave** runs continuously. There is also a word count, a "last edited" time and note history
  (last 10 versions, kept locally).
- **Later:** voice-note attachments and handwriting/drawing pages.

### 4.2 Decks & flashcards
Card types:

| Type | Description |
|---|---|
| **Basic** | Front → back. |
| **Basic + reverse** | Creates two cards (front→back and back→front). |
| **Cloze** | `{{c1::...}}` deletions. One card per cloze number. |
| **Type-in answer** | The user types the answer; it is checked with a fuzzy match and the diff is shown. |
| **Image occlusion** | Draw boxes over labels on a diagram. Mode A "hide one, show others" or mode B "hide all, reveal one"; one card per box. Ideal for ANS diagrams, receptor pathways and synapses. |

- Each card face is rich text with images. Cards also have an optional "Extra" field (shown after
  reveal) for mnemonics or explanations.
- **Bulk-add mode** keeps the editor open to add card after card quickly.
- **Deck settings:** new cards per day (default 15), max reviews per day (default 200), desired
  retention (default 0.90).
- **Card actions:** edit during review, suspend, bury until tomorrow, reset, move to another deck.
- **Import/export:** CSV (front, back, tags). Later: Anki `.apkg` import.

### 4.3 Quizzes and question banks
The user can create a **question bank** and assemble **quizzes** from it, or write questions
directly inside a quiz. Official questions can be saved into "My bank".

Supported question types (the same engine is used for official content):

| Type | Shape | Scoring |
|---|---|---|
| **SBA** | Stem + 4–5 options, one correct | 1 / 0 |
| **MTF** | Stem + 5 statements, each T/F | Per statement: +1 correct, 0 or −1 wrong (quiz setting "negative marking"), 0 unanswered |
| **Multiple response** | Choose all that apply | Partial credit |
| **Fill in the blank** | Text with blanks; accepted answers list | Per blank, case/spacing-insensitive, with synonyms |
| **Matching** | Match left items to right items (e.g. drug ↔ class) | Per pair |
| **Ordering** | Put steps in order (e.g. mechanism steps) | Full or partial |
| **SAQ** | Question + model answer + **marking points** | Self-marked by ticking the points you covered (AI marking in Phase 7) |
| **LEQ / essay** | Prompt + model outline + rubric | Self-assessed with the rubric; timed writing practice |
| **Calculation** | Numeric answer with unit and tolerance | Exact within tolerance; the worked solution is shown |
| **Image-based** | Any of the above with an image in the stem | As the base type |
| **Image label (hotspot)** | Tap the correct region of a diagram | Per hotspot |
| **Case-based** | A vignette with several sub-questions of mixed types | Sum of parts |

**Quiz settings:** practice mode (instant feedback with explanation) or exam mode (timer,
flag-for-review, question navigator grid, submit at the end), shuffle questions/options, pass
mark, negative marking on/off.

**Results** show the score, the time taken, per-question review with explanations, "Retry wrong
only", and "Add wrong ones to flashcards".

Every question has an **explanation**. For SBA/MTF, each option or statement also gets its own
rationale, explaining why each option is right or wrong.

### 4.4 Sharing (Phase 6)
Share a deck, quiz or note by link or 6-character code. The recipient gets a **copy** ("fork")
they can edit. Visibility can be private, link-only or public. The public library shows a
**Verified** badge on reviewed content and a **Community** badge on everything else.

---

## 5. Review & practice engine

### 5.1 Flashcard reviews (FSRS)
- Scheduling uses **FSRS** (`ts-fsrs`) with per-deck desired retention.
- Rating buttons **Again · Hard · Good · Easy** show the next interval on each ("10m", "3d").
- A session combines due reviews and new cards within the deck limits. Order: learning cards
  first, then reviews, then new cards (interleaved).
- The review screen has a flip animation, a progress bar, **undo last answer**, edit card, and
  suspend/bury.
- The session summary shows cards reviewed, accuracy, XP earned and Dozi's reaction.
- **Cram mode** (before exams) reviews a chosen deck, tag or topic *without* affecting FSRS
  scheduling.

### 5.2 Practice hub
- **Due now:** all due cards across decks, or per deck.
- **Weak-spot drill:** 15 questions and cards from the 3 lowest-mastery topics.
- **Quick quiz:** 10 random questions from the chosen topics.
- **Mock exams** (Phase 5): full timed papers matching the MUST paper format.
- **PK calculation trainer** (Phase 5): endless generated problems with worked solutions.
- **Clinical cases** (Phase 5): branching patient scenarios.

---

## 6. Official curriculum content (Phase 4)

### 6.1 Structure
`Course unit → Topic → Sub-topic → items` (lessons, drug profiles, official decks, questions).
Example: *Pharmacology II → Autonomic Pharmacology → Adrenergic antagonists → Propranolol*.

Course units, topics and their order follow the **MUST course outline**. The founder supplies it.

### 6.2 Drug profiles
The sections are fixed so every drug looks the same:
- Generic name (INN), class and sub-class, **Ugandan brand names**
- **Mechanism of action** (with an optional diagram)
- **Pharmacokinetics:** absorption, distribution, metabolism, excretion, half-life, special notes
- **Indications** (tagged with the UCG where relevant)
- **Adverse effects** (common vs serious)
- **Contraindications & cautions** (including pregnancy and breastfeeding)
- **Important interactions**
- **Dosing** (educational, from UCG/EMHSLU; always shown with the disclaimer)
- **EMHSLU status:** level of care and VEN
- **Exam tips & mnemonics**
- **Linked items:** official cards, questions and lessons for this drug
- Buttons: "Add cards to my reviews" · "Quiz me on this drug" · "Compare with class"

### 6.3 Class comparison tables
Side-by-side tables within a class (e.g. β-blockers: selectivity, ISA, lipid solubility,
membrane-stabilising activity, uses, notable ADRs). They can be turned into a matching quiz.

### 6.4 Lessons (micro-lessons, 3–7 minutes)
A lesson is a sequence of blocks: **text**, **image/diagram**, **key point**, **mnemonic**,
**check question** (any question type, answered inline) and **summary**. Finishing a lesson awards
XP and adds its linked official cards to the user's reviews (if the user opts in).

### 6.5 Glossary
Pharmacology terms with short definitions, linked from any content.

### 6.6 Local focus
Content should give appropriate weight to conditions and drugs that dominate Ugandan practice:
antimalarials, antiretrovirals, anti-TB drugs, antimicrobials and antimicrobial resistance, and
maternal and child health. Include key local interactions (e.g. rifampicin with dolutegravir or
with hormonal contraceptives) and the essential medicines list.

---

## 7. Study roadmap (Phase 4)

### 7.1 The path
Each course unit has a **vertical, winding path of nodes** grouped into **sections** (one section
per topic). Dozi stands beside the student's current node.

Node types:

| Node | What it opens | Typical length |
|---|---|---|
| 📖 Lesson | A micro-lesson | 3–7 min |
| 🃏 Drill | New official cards for the topic, then a short review | 5 min |
| ✏️ Practice | A 10-question mixed quiz on the topic | 5–8 min |
| 🧮 Calc | PK calculation set (in PK sections) | 5–10 min |
| 🩺 Case | A clinical case | 5–10 min |
| 🏁 Checkpoint | End-of-section test; ≥ 70 % unlocks the next section | 10–15 min |
| 🏆 Unit exam | A mock paper for the whole course unit | 30–90 min |

### 7.2 Node states
**Locked** → **Available** → **Completed** (1–3 stars by score) → **Needs review**. A node
"cracks" and needs review when the mastery of its topic decays below 60 %. Doing a short review
restores it. Students can **skip ahead** by passing a section's checkpoint.

### 7.3 Personal study plan
- The student enters exam date(s), the minutes available per day and any days off.
- The planner spreads the remaining roadmap nodes over the days until the exam. It keeps the last
  20 % of days (minimum 3) for revision and mock exams, and adds the expected FSRS review load.
- The **Today** screen shows today's plan items with checkboxes. If the student falls behind,
  the plan rebalances automatically, and Dozi tells them kindly.
- **Freedom:** students can add their own decks, quizzes or notes to the plan ("Revise my
  antimalarials deck on Mondays") and create personal goals ("Finish ANS notes by Friday").

---

## 8. Motivation system

### 8.1 XP

| Action | XP |
|---|---|
| Review a card (first review of that card each day) | 1 |
| Complete a lesson | 10 (+5 if all check questions correct) |
| Correct answer in an official or shared quiz | 2 |
| Correct answer in your own quiz | 1 |
| Complete a practice or drill node | 10 |
| Pass a checkpoint | 25 (+10 for 3 stars) |
| Finish a mock exam | 50 |
| Create a card (max 20 XP/day from creating) | 1 |
| Create a note of more than 100 words (max 10 XP/day) | 2 |
| Meet the daily goal | 5 bonus |
| An error report you made is accepted | 20 |

Keep the XP rules in one pure function (`gamification/logic.ts`) with a rules table so the
values can be tuned.

### 8.2 Daily goal & streak
- A **study day** rolls over at **03:00 local time** (Africa/Kampala), so late-night sessions
  still count for the same day.
- The streak goes up when the student earns **≥ 10 XP** in a study day. Meeting the full daily goal
  fills the ring and gives bonus XP, but only 10 XP is needed to keep the streak alive.
- **Streak freeze:** one is earned at every 7-day milestone, and a student can hold at most 2. A
  missed day uses a freeze automatically.
- **Streak repair:** if the streak breaks, the student can earn **2× the daily goal within 48
  hours** to restore it. This is allowed once every 30 days.
- The student sees the current streak, their longest streak and a calendar of active days.

### 8.3 Levels
Cumulative XP thresholds, level 1–50 (e.g. `threshold(n) = round(40 * n^1.6)`). Every 5 levels,
the student earns a new title: Intern → Dispenser → Compounder → Pharmacologist →
Clinical Pharmacist → Professor. Titles appear on the profile.

### 8.4 Achievements (initial set)
First Dose (first lesson) · Card Collector (make 50 cards) · Note Taker (10 notes) · Diagram
Master (5 image-occlusion cards) · Week Warrior (7-day streak) · Unbreakable (30-day) · Century
(100-day) · Perfect Checkpoint · Topic Mastered (any topic ≥ 90 %) · ANS Ace · Antimicrobial
Guardian · PK Pro (50 calculation problems) · Mock Survivor (first mock exam) · Sharp Eye
(accepted error report) · Early Bird (study before 08:00 on 5 days).

### 8.5 Progress
- **Topic mastery** (0–100 %) is shown per topic and per course unit with levels: Not started ·
  Learning · Familiar · Proficient · Mastered. The formula is in ARCHITECTURE §Mastery.
- **Stats screen:** activity heatmap, XP per day, cards reviewed, accuracy by question type,
  time studied, 30-day review forecast and strongest/weakest topics.
- **Exam readiness** (Phase 5): a 0–100 estimate for the selected exam, combining coverage,
  mastery and mock performance, with the top 3 things to fix.

### 8.6 Leagues (Phase 6)
These are opt-in weekly leaderboards within the student's class cohort, using display names only.
Only XP from official or shared content counts, so students can't farm XP from easy
self-made quizzes.

---

## 9. Dozi the mascot

- **Who:** Dozi is a young **grey crowned crane** (Uganda's national bird) wearing a small white
  lab coat. The name plays on "dose". Dozi is curious, upbeat and a little nerdy about drugs.
- **Must be original art.** It must not resemble Duolingo's owl or any other brand's mascot.
  Commission a local illustrator if possible; Claude Code builds simple placeholder art until then.
- **Expressions (asset list):** idle · happy · celebrating (wings up) · thinking (wing on chin) ·
  encouraging (thumbs-up wing) · concerned (streak at risk) · sleepy (after 22:00) ·
  studying (reading a book) · proud (holding a trophy) · surprised.
- **Where Dozi appears:** onboarding, the Today greeting, beside the current roadmap node, quiz
  feedback (small reaction on correct/wrong), session end, streak events, empty states,
  notifications and errors ("Dozi dropped the pill bottle — try again").
- **Voice:** short, warm, encouraging, lightly funny. It never shames the student. Examples:
  - Correct: "Spot on! Your β-receptors must be firing 🔥"
  - Wrong: "Close one. Let's look at why — this one trips everyone up."
  - Streak at risk: "Just 5 minutes keeps our streak alive. I'll hold the flashcards 🪶"
  - Streak lost: "Streaks break, knowledge stays. Let's start a new one today."
- **Tech:** start with static SVG/PNG expressions in `<Dozi mood="happy" />` with small
  Reanimated bounces. Upgrade later to a **Rive** state machine for smooth transitions.

---

## 10. Notifications
- **Local notifications only** (they work offline) until social features arrive.
- A daily reminder at the user's chosen time, sent only if the daily goal isn't met yet.
- A streak-at-risk nudge at 20:30 if no XP has been earned today.
- **Quiet hours** from 22:00 to 07:00, with no exceptions. At most 2 notifications per day.
- An exam countdown (7, 3 and 1 day before, if an exam date is set).
- Each type can be turned off separately.

---

## 11. Errors, reporting & reviewer mode (Phase 4)
- A **"Report a problem"** button on every official item offers: incorrect fact · outdated ·
  typo · unclear · other, plus an optional comment.
- **Reviewer Mode** is shown only to users with the reviewer role. It contains a queue of draft
  and in-review content and reported items. Reviewers read the item as students will see it, then
  choose **Approve** or **Request changes** with a comment. Workflow details are in
  CONTENT_GUIDE.md.
- Each item shows a "Reviewed by N reviewers · Lecturer-verified" badge where applicable.

---

## 12. Settings
Theme (system/light/dark) · text size · daily goal · reminder time and notification toggles ·
exam dates · data saver (Wi-Fi-only media sync and content downloads) · storage used (with
clear caches) · downloaded content packs · export my data (JSON + media zip) · account and
sync status · delete account · about, disclaimer and privacy policy.

---

## 13. Later phases (not in current scope)
- **AI tutor (Phase 7, Claude API):** "Explain this" on any item, SAQ/LEQ marking, generate
  cards and questions from your notes, and a Socratic topic tutor. Answers are grounded only in
  reviewed content and never give patient-specific advice.
- **Community (Phase 6):** sharing, a public library, study groups, leagues, live quiz battles
  and discussion threads.
- **Monetisation (Phase 8):** mobile money (MTN MoMo, Airtel Money) through a payment
  aggregator. Principle: **all personal creation tools and core study stay free.** Premium
  unlocks things like the AI tutor quota, the full mock-exam bank and advanced analytics. The
  likely model is a semester pass priced for students, plus institutional licences.
- **Work Mode / Quick Reference** for interns and pharmacists: much later, only with validated
  data.
- **iOS** and a **web admin portal** for lecturers.

## 14. Out of scope (for now)
Clinical decision support, patient data of any kind, US exam prep (NAPLEX etc.), video
hosting.
