// One Question as a row: what a teacher scans for when picking one out of a
// list. The Question Bank Pane shows its stem and classification; the Exam
// Outline, where the page beside it already shows the stem, shows one line —
// its number and the same classification — drawn from the same parts so the
// two lists agree about what a Question is.
//
// A row is a projection, not a rendering. It shows one line of the stem and
// the classification; answer choices and correctness stay behind the editor,
// which remains the only place the whole of a Question is presented.

import { DifficultyBadge, TopicBadge } from './badges'
import { SECTION_LABELS, topicsOf, type Question } from './exam'
import { pointsLabel, pointsOfQuestion } from './points'
import { stemPreview, type StemPreviewBadge } from './stem-preview'

const BADGE_LABELS: Record<StemPreviewBadge, string> = {
  image: 'Image',
  math: 'Math',
}

/** What a row with nothing written into it is called. A question saves whether
 *  or not it says anything, so this is a real state rather than a placeholder. */
export const UNTITLED = 'Untitled question'

export function QuestionSummary({ question, number }: {
  question: Question
  /** The number it prints with on the Exam, when the list is the Exam's. */
  number?: string
}) {
  const preview = stemPreview(question)
  const name = preview.text || UNTITLED
  const topics = topicsOf(question)
  const points = pointsOfQuestion(question)
  return (
    <div className="question-bank-row-content">
      <span className="question-bank-row-meta">
        {number !== undefined && <span className="question-row-number">{number}.</span>}
        <span className="question-bank-row-type">
          {SECTION_LABELS[question.type]}
          {preview.parts !== undefined
            && ` · ${preview.parts} ${preview.parts === 1 ? 'part' : 'parts'}`}
        </span>
        {question.difficulty && <DifficultyBadge difficulty={question.difficulty} />}
        {points !== undefined && <span className="question-row-points">{pointsLabel(points)}</span>}
      </span>
      <span className="question-bank-row-stem">
        <span className="question-bank-row-line">{name}</span>
        {preview.badges.map((badge) => (
          <span className="question-bank-row-content-badge" key={badge}>
            {BADGE_LABELS[badge]}
          </span>
        ))}
      </span>
      {topics.length > 0 && (
        <span className="question-bank-row-topics">
          {topics.map((topic) => <TopicBadge topic={topic} key={topic} />)}
        </span>
      )}
    </div>
  )
}

/** The Exam Outline's one line: the number it prints with, then its Question
 *  Type, Difficulty, Topics and Points. No stem — the page beside it has it. */
export function QuestionLine({ question, number }: { question: Question; number: number }) {
  const points = pointsOfQuestion(question)
  const topics = topicsOf(question)
  return (
    <span className="question-line">
      <span className="question-row-number">{number}.</span>
      <span className="question-line-type">{SECTION_LABELS[question.type]}</span>
      {question.difficulty && <DifficultyBadge difficulty={question.difficulty} iconOnly />}
      {topics.length > 0 && <span className="question-line-topics">
        {topics.map((topic) => <TopicBadge topic={topic} key={topic} />)}
      </span>}
      {points !== undefined && (
        <span className="question-row-points" title={pointsLabel(points)}>{points} pt{points === 1 ? '' : 's'}</span>
      )}
    </span>
  )
}
