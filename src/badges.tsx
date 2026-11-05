// The coloured marks a question's classification wears: its Difficulty and its
// Topics. One module, because the popup that sets them and the Question Bank
// row that shows them must agree — a Topic that is one colour in the front
// matter and another in the bank would read as two Topics.

import { SignalHigh, SignalLow, SignalMedium, Tag } from 'lucide-react'
import { DIFFICULTY_LABELS, type Difficulty } from './exam'
import type { ReactNode } from 'react'
import { topicTint } from './topic-tint'

/** Difficulty is ordered, so it is drawn as a rising signal rather than three
 *  unrelated pictures: the mark says which of the three it is even where the
 *  colour cannot. */
const DIFFICULTY_ICONS: Record<Difficulty, ReactNode> = {
  easy: <SignalLow />,
  medium: <SignalMedium />,
  hard: <SignalHigh />,
}

/** Difficulty as a meter of three bars, filled to its level and centred in
 *  its own box — for a badge with no room for the word. */
function DifficultyBars({ difficulty }: { difficulty: Difficulty }) {
  const level = { easy: 1, medium: 2, hard: 3 }[difficulty]
  return (
    <svg className="difficulty-bars" viewBox="0 0 12 12" aria-hidden="true">
      {[4, 7, 10].map((height, index) => (
        <rect
          key={height}
          x={1 + index * 3.75}
          y={11 - height}
          width={2.5}
          height={height}
          rx={0.75}
          data-off={index >= level ? '' : undefined}
        />
      ))}
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
      {iconOnly ? <DifficultyBars difficulty={difficulty} /> : DIFFICULTY_ICONS[difficulty]}
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
