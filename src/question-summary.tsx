// One Question as a single row: what a teacher scans for when picking one out
// of a list. The Question Bank Pane and the Exam Outline both show Questions
// this way, so they are drawn by this one component — the outline adds the
// number the Question prints with, and neither list's own actions belong here.
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
