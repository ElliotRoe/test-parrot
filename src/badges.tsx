// The coloured marks a question's classification wears: its Difficulty and its
// Topics. One module, because the popup that sets them and the Question Bank
// row that shows them must agree — a Topic that is one colour in the front
// matter and another in the bank would read as two Topics.

import { Tag } from 'lucide-react'
import { DIFFICULTY_LABELS, type Difficulty } from './exam'
import { topicTint } from './topic-tint'

/** Difficulty is ordered, so it is drawn as a rising stack of arrows — one
 *  for Easy, two for Medium, three for Hard — rather than three unrelated
 *  pictures: the mark says which of the three it is even where the colour
 *  cannot, and it is the same mark wherever a Difficulty is shown. */
const ARROW_ROWS: Record<Difficulty, readonly number[]> = {
  easy: [15],
  medium: [18, 11],
  hard: [21, 14, 7],
}

export function DifficultyIcon({ difficulty }: { difficulty: Difficulty }) {
  return (
    <svg
      className="difficulty-arrows"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {ARROW_ROWS[difficulty].map((y) => <path key={y} d={`M3 ${y}l9-6 9 6`} />)}
    </svg>
  )
}

export function DifficultyBadge({ difficulty, iconOnly = false }: {
  difficulty: Difficulty
  /** The signal alone, where a line has no room for the word; it is still
   *  named for a screen reader and on hover. */
  iconOnly?: boolean
}) {
  return (
    <span
      className="badge badge-difficulty"
      data-difficulty={difficulty}
      data-icon-only={iconOnly ? 'true' : undefined}
      title={iconOnly ? DIFFICULTY_LABELS[difficulty] : undefined}
    >
      <DifficultyIcon difficulty={difficulty} />
      {iconOnly
        ? <span className="sr-only">{DIFFICULTY_LABELS[difficulty]}</span>
        : DIFFICULTY_LABELS[difficulty]}
    </span>
  )
}

/** A topic's tag icon alone, in the topic's own colours — for a list that
 *  names the topic in plain text beside it. */
export function TopicSwatch({ topic }: { topic: string }) {
  return (
    <span className="topic-swatch" data-tint={topicTint(topic)} aria-hidden="true">
      <Tag />
    </span>
  )
}

export function TopicBadge({ topic }: { topic: string }) {
  return (
    <span className="badge badge-topic" data-tint={topicTint(topic)}>
      {topic}
    </span>
  )
}
