// The Exam Outline: an open Exam's Questions in print order, grouped under
// their Section Headings, one entry per Question however many Items or Parts
// it has.
//
// Numbers are counted here the way the page counts them (`deriveItems` in
// export-plan.ts): continuously across Sections, a Matching set taking one
// number per Item. Kept pure so the outline cannot disagree with the sheet
// about what number a Question prints with.

import {
  promptsOf,
  questionsInSection,
  sectionsOf,
  type Arrangement,
  type Exam,
  type ExamSection,
  type Question,
} from './exam'

export type OutlineEntry = {
  question: Question
  /** The number it prints with — the first of a Matching set's run. */
  number: number
  /** As a teacher would say it: `4`, or `4–7` for a Matching set of four. */
  numberLabel: string
}

export type OutlineSection = {
  section: ExamSection
  entries: OutlineEntry[]
}

/** How many numbers a Question takes on the test. */
function numbersTakenBy(question: Question): number {
  return question.type === 'matching' ? Math.max(1, promptsOf(question).length) : 1
}

export function outlineOf(exam: Exam, arrangement: Arrangement): OutlineSection[] {
  let number = 1
  return sectionsOf(exam).map((section) => ({
    section,
    entries: questionsInSection(exam, arrangement, section.id).map((question) => {
      const span = numbersTakenBy(question)
      const entry: OutlineEntry = {
        question,
        number,
        numberLabel: span > 1 ? `${number}–${number + span - 1}` : String(number),
      }
      number += span
      return entry
    }),
  }))
}
