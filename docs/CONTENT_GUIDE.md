# Content Guide — Official Content

Official content is what makes Dozi trustworthy. This guide defines **how it is written, stored,
reviewed and published**. Code that touches official content must follow it.

---

## 1. Sources

- **Primary (Uganda):** Uganda Clinical Guidelines (latest MoH edition) and the Essential
  Medicines and Health Supplies List for Uganda (latest edition). Use National Drug Authority
  notices for safety alerts and recalls.
- **Course alignment:** the MUST pharmacology course outline and lecture topics, supplied by the
  founder.
- **Reference texts** (for checking facts, **never copied**): Rang & Dale's Pharmacology,
  Katzung's Basic & Clinical Pharmacology, Goodman & Gilman, the BNF, and WHO guidance.
- Every drug profile lists its sources in `sources`. Write everything in your own words; never
  paste textbook text, figures or past-paper questions without permission.

## 2. Style rules

- Use generic (INN) names everywhere. Brand names appear only in `ug_brands`.
- Use British/Ugandan English spelling: haemoglobin, oedema, paediatric, anaemia.
- Keep sentences short and put key terms in **bold**. Spell out an abbreviation the first time
  it appears in each item.
- Write doses as `drug + dose + unit + route + frequency + duration`, e.g. "500 mg orally every
  8 hours for 5 days". Doses come **only** from UCG/EMHSLU/BNF and must cite the source.
- Explanations teach the *why*: every SBA option and MTF statement gets a one-line rationale.
- Mnemonics must be original, respectful and free of offensive content.
- Balance: include what is common in Uganda (malaria, HIV, TB, antimicrobials, maternal and
  child health) alongside the standard syllabus.

## 3. Status workflow

```
draft → in_review → (changes_requested ↺) → approved → published → retired
```

| Status | Who | Meaning |
|---|---|---|
| draft | Author (the founder, or Claude Code when asked) | Being written. AI-drafted items have `ai_drafted: true`. |
| in_review | Author | Ready for reviewers; visible in Reviewer Mode. |
| changes_requested | Reviewer | Needs fixes; the comment explains why. |
| approved | Reviewer | Needs **2 student-reviewer approvals**, or **1 lecturer approval**. `ai_drafted` items **always** need at least one approval from someone other than the author. |
| published | Author/admin | Included in the next content pack build. |
| retired | Admin | Hidden from students; kept for progress history. |

A **lecturer approval** adds the "Lecturer-verified" badge.

### Reviewer checklist (shown in Reviewer Mode)
1. Is every fact correct and consistent with UCG/EMHSLU where applicable?
2. Are doses cited and correct in units, route and frequency?
3. For SBA: is there exactly one best answer? Are the distractors plausible and clearly wrong?
4. For MTF: is every statement unambiguously true or false?
5. Does the explanation teach the reasoning?
6. Is the item at the right level for its topic and year?
7. Is the spelling, clarity and tone good? Is it original wording (no copied text)?

### Error reports
Reports from students go to Reviewer Mode. Fixing one creates a new **version** of the item
(`version + 1`) and sends it through review again. The reporter earns 20 XP when a fix is
accepted.

## 4. File layout

```
content/
├── curriculum.yaml               # course units + topic tree (ordering)
├── drugs/<class-slug>/<drug-slug>.yaml
├── classes/<class-slug>.yaml     # class info + comparison table
├── lessons/<topic-slug>/<nn>-<lesson-slug>.yaml
├── decks/<topic-slug>.yaml       # official flashcards
├── questions/<topic-slug>.yaml   # official questions
├── cases/<case-slug>.yaml        # clinical cases (Phase 5)
├── roadmap/<course-unit-code>.yaml
├── glossary.yaml
└── media/…                       # official images (compressed, original work or licensed)
```

Every item has a stable `id` (a slug such as `drug.propranolol` or `q.ans.bb.001`). **Never
change an ID once published**, because progress depends on it.

## 5. Formats (examples)

> ⚠️ The examples below are **SAMPLE** content to show the format. They are marked `draft` and
> must be reviewed like everything else before any real use.

### 5.1 Curriculum
```yaml
course_units:
  - id: cu.pharm2           # TODO: replace with real MUST course code
    code: "TODO"
    title: "Pharmacology II"
    year: 2
    semester: 1
    topics:
      - id: t.ans
        title: "Autonomic pharmacology"
        children:
          - id: t.ans.adrenergic-antagonists
            title: "Adrenergic antagonists"
```

### 5.2 Drug profile
```yaml
id: drug.propranolol
status: draft
ai_drafted: true
inn_name: Propranolol
class: class.beta-blockers
topic: t.ans.adrenergic-antagonists
ug_brands: []                       # TODO: fill from local market / NDA register
moa: >
  **Non-selective competitive antagonist** at β1 and β2 adrenoceptors. It reduces heart rate,
  contractility and renin release (β1). β2 blockade can cause bronchoconstriction.
pk:
  absorption: "Well absorbed orally; extensive first-pass hepatic metabolism (low bioavailability)."
  distribution: "Highly lipophilic; crosses the blood–brain barrier."
  metabolism: "Hepatic."
  excretion: "Renal, as metabolites."
indications:
  - Hypertension
  - Angina
  - Migraine prophylaxis
  - Symptom control in thyrotoxicosis
  - Essential tremor
adrs:
  common: [Fatigue, Cold extremities, Bradycardia, Sleep disturbance and vivid dreams]
  serious: [Bronchospasm, Heart block, "Masking of hypoglycaemia symptoms in diabetes"]
contraindications:
  - Asthma
  - Second/third-degree heart block
  - Severe bradycardia
interactions:
  - with: verapamil
    effect: "Risk of severe bradycardia, heart block and hypotension."
dosing: TODO-from-UCG           # never invent — fill from UCG/BNF with citation
emhslu: { loc: TODO, ven: TODO }
exam_tips:
  - "Non-selective → avoid in asthma; think cardioselective (e.g. atenolol) if a β-blocker is needed."
sources: ["Rang & Dale (check)", "UCG (TODO section)"]
```

### 5.3 Flashcards
```yaml
deck: { id: deck.ans.bb, title: "β-blockers", topic: t.ans.adrenergic-antagonists }
status: draft
cards:
  - id: c.ans.bb.001
    type: basic
    front: "Why is propranolol avoided in asthma?"
    back: "It blocks **β2** receptors in bronchial smooth muscle → bronchoconstriction."
    drug: drug.propranolol
  - id: c.ans.bb.002
    type: cloze
    text: "Propranolol is a {{c1::non-selective}} β-blocker with high {{c2::first-pass}} metabolism."
```

### 5.4 Questions (one example per main type)
```yaml
topic: t.ans.adrenergic-antagonists
status: draft
questions:
  - id: q.ans.bb.001
    type: mtf
    stem: "Regarding propranolol:"
    statements:
      - { text: "It is a selective β1 antagonist.", answer: false,
          why: "It is non-selective (β1 and β2)." }
      - { text: "It may mask symptoms of hypoglycaemia.", answer: true,
          why: "Tremor and tachycardia are β-mediated warning signs." }
      - { text: "It is contraindicated in asthma.", answer: true,
          why: "β2 blockade causes bronchoconstriction." }
      - { text: "It undergoes extensive first-pass metabolism.", answer: true,
          why: "This gives it low oral bioavailability." }
      - { text: "It is used for migraine prophylaxis.", answer: true,
          why: "It is an established prophylactic option." }

  - id: q.ans.bb.002
    type: sba
    stem: >
      A 34-year-old woman with asthma needs treatment for hypertension. Which drug is
      LEAST appropriate?
    options:
      - { text: "Propranolol", correct: true, why: "Non-selective β-blockade risks bronchospasm." }
      - { text: "Amlodipine", why: "A calcium channel blocker; no bronchospasm risk." }
      - { text: "Hydrochlorothiazide", why: "A thiazide; safe in asthma." }
      - { text: "Enalapril", why: "An ACE inhibitor; watch for cough, but it is not a bronchoconstrictor." }
    explanation: "Avoid non-selective β-blockers in asthma."

  - id: q.pk.001
    type: calculation
    stem: "A drug has Vd = 40 L and clearance = 4 L/h. Calculate its half-life."
    answer: { value: 6.93, unit: "h", tolerance: 0.1 }
    working: "t½ = 0.693 × Vd / CL = 0.693 × 40 / 4 = 6.93 h"

  - id: q.ans.bb.003
    type: saq
    stem: "Explain why β-blockers can mask hypoglycaemia in patients with diabetes. (4 marks)"
    marking_points:
      - "Hypoglycaemia triggers sympathetic activation."
      - "Warning signs such as tremor, palpitations and tachycardia are β-adrenergic."
      - "β-blockade blunts these signs, so the patient may not notice."
      - "Sweating (cholinergic sympathetic) is preserved."
    model_answer: "…"
```
Other types follow the same pattern: `payload` fields match the zod schema for that type in
`src/features/quizzes/types.ts`, which is the **source of truth**.

### 5.5 Lesson
```yaml
id: l.ans.bb.01
topic: t.ans.adrenergic-antagonists
title: "β-blockers: the big picture"
est_minutes: 5
status: draft
blocks:
  - { type: text, md: "β-blockers compete with noradrenaline at β-adrenoceptors…" }
  - { type: image, media: media/ans/beta-receptor.png, caption: "…" }
  - { type: key_point, md: "β1 = heart (and kidney renin); β2 = bronchi, vessels, liver…" }
  - { type: mnemonic, md: "…" }
  - { type: question, ref: q.ans.bb.001 }
  - { type: summary, md: "…" }
```

### 5.6 Roadmap
```yaml
course_unit: cu.pharm2
sections:
  - topic: t.ans.adrenergic-antagonists
    nodes:
      - { id: n.ans.bb.1, type: lesson, ref: l.ans.bb.01 }
      - { id: n.ans.bb.2, type: drill, ref: deck.ans.bb }
      - { id: n.ans.bb.3, type: practice, topic: t.ans.adrenergic-antagonists, count: 10 }
      - { id: n.ans.bb.cp, type: checkpoint, topic: t.ans.adrenergic-antagonists, count: 15, pass: 0.7 }
```

## 6. Drafting content with Claude Code

Claude Code can speed up drafting, but:
- Anything it drafts gets `status: draft` and `ai_drafted: true`.
- It must leave `TODO` rather than guess doses, EMHSLU level of care/VEN, brand names or local
  guideline details.
- Humans review everything before publishing. Paste in lecture notes or the course outline to
  give it context. Don't paste copyrighted textbook pages or past papers you don't have
  permission to use.

## 7. Content priorities (suggested order)

1. **General principles:** pharmacodynamics, pharmacokinetics (with calculations), drug
   development.
2. Autonomic pharmacology.
3. Chemotherapy: antimalarials, antibacterials, anti-TB, antiretrovirals, antifungals,
   anthelminthics.
4. Cardiovascular and renal.
5. CNS.
6. Endocrine, respiratory, GI, autacoids and inflammation, toxicology.

Replace this order with the actual MUST sequence once the course outline is in hand.
