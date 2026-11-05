// The Exam Outline: the collapsible list of an open Exam's Questions in print
// order, grouped under their Section Headings, beside the pages.
//
// It is a way to get around the Exam and to rearrange it, not a second place
// to edit it. Choosing an entry brings its Question into view and marks it
// briefly — it never changes what is selected on the page. Dragging an entry
// moves that one Question, within its Section or into another, through the
// same workspace gesture and the same store operation as dragging it on the
// page. Sections are not dragged here.

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import type { Arrangement, Exam, QuestionType } from './exam'
import { outlineOf } from './exam-outline'
import { QuestionLine } from './question-summary'
import type { WorkspaceDrag } from './use-workspace-drag'
import { dropStateOf } from './workspace-drag'

/** Where a set of several rows draws a drop line: above its first, below its
 *  last. */
function edgeDrop(state: 'before' | 'after' | null, item: number, span: number) {
  if (state === 'before' && item === 0) return 'before'
  if (state === 'after' && item === span - 1) return 'after'
  return undefined
}

/** How long a Question chosen from the outline stays marked on the page. */
const FLASH_MS = 1_200

/** The pieces of a Question on the page: one per sheet it runs across. */
function piecesOf(questionId: string): HTMLElement[] {
  return [...document.querySelectorAll<HTMLElement>(
    `.exam-question[data-question-id="${CSS.escape(questionId)}"]`,
  )]
}

/** Which Question the teacher is looking at: the last to have started above
 *  the upper third of the Exam's lane — or, scrolled as far as it goes, the
 *  last to have started in view at all, since nothing lower can rise further. */
function questionInView(): string | null {
  const lane = document.querySelector('.editor-output')
  const scroller = lane && /auto|scroll/.test(getComputedStyle(lane).overflowY)
    ? lane
    : document.scrollingElement
  if (!scroller) return null
  const bounds = scroller === lane
    ? lane.getBoundingClientRect()
    : { top: 0, bottom: window.innerHeight, height: window.innerHeight }
  const atEnd = scroller.scrollTop + scroller.clientHeight >= scroller.scrollHeight - 2
  const line = atEnd ? bounds.bottom - 24 : bounds.top + bounds.height / 3
  let current: string | null = null
  for (const piece of document.querySelectorAll<HTMLElement>('.exam-workspace .exam-question[data-question-id]')) {
    if (piece.getBoundingClientRect().top > line) break
    current = piece.dataset.questionId ?? current
  }
  return current ?? document.querySelector<HTMLElement>('.exam-workspace .exam-question[data-question-id]')?.dataset.questionId ?? null
}

export function ExamOutline({
  exam,
  arrangement,
  drag,
  onReveal,
}: {
  exam: Exam
  arrangement: Arrangement
  drag: WorkspaceDrag
  /** Scrolls the Question into view on the page. */
  onReveal: (questionId: string) => void
}) {
  const outline = outlineOf(exam, arrangement)
  const [inView, setInView] = useState<string | null>(null)
  const flashes = useRef(new Map<string, ReturnType<typeof setTimeout>>())

  // The row for the Question in view follows the page as it scrolls — the
  // Exam's own lane, or the window on a layout too narrow to give it one.
  useEffect(() => {
    let frame: number | null = null
    const update = () => {
      frame = null
      setInView(questionInView())
    }
    const schedule = () => {
      if (frame === null) frame = requestAnimationFrame(update)
    }
    schedule()
    window.addEventListener('scroll', schedule, true)
    window.addEventListener('resize', schedule)
    return () => {
      if (frame !== null) cancelAnimationFrame(frame)
      window.removeEventListener('scroll', schedule, true)
      window.removeEventListener('resize', schedule)
    }
  }, [exam, arrangement])

  useEffect(() => {
    const timers = flashes.current
    return () => {
      for (const timer of timers.values()) clearTimeout(timer)
      timers.clear()
    }
  }, [])

  const reveal = (questionId: string) => {
    onReveal(questionId)
    clearTimeout(flashes.current.get(questionId))
    for (const piece of piecesOf(questionId)) piece.dataset.outlineFlash = 'true'
    flashes.current.set(questionId, setTimeout(() => {
      flashes.current.delete(questionId)
      for (const piece of piecesOf(questionId)) delete piece.dataset.outlineFlash
    }, FLASH_MS))
  }

  // A press that has not moved far enough to be a drag is still on its way to
  // being a click. One pointer drags at a time, so this is the outline's.
  const gesture = useRef<{
    id: number
    questionId: string
    type: QuestionType
    startX: number
    startY: number
    dragging: boolean
  } | null>(null)
  const suppressClick = useRef<string | null>(null)

  const release = (event: ReactPointerEvent<HTMLElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
  }

  const dragHandlers = (questionId: string, type: QuestionType) => ({
    onPointerDown: (event: ReactPointerEvent<HTMLElement>) => {
      if (event.button !== 0) return
      gesture.current = {
        id: event.pointerId,
        questionId,
        type,
        startX: event.clientX,
        startY: event.clientY,
        dragging: false,
      }
      suppressClick.current = null
      event.currentTarget.setPointerCapture(event.pointerId)
    },
    onPointerMove: (event: ReactPointerEvent<HTMLElement>) => {
      const held = gesture.current
      if (!held || held.id !== event.pointerId) return
      if (!held.dragging) {
        if (Math.hypot(event.clientX - held.startX, event.clientY - held.startY) < 5) return
        held.dragging = true
        suppressClick.current = held.questionId
        drag.begin(
          { pane: 'exam-draft', questionIds: [held.questionId], type: held.type },
          {
            elements: [event.currentTarget],
            bounds: event.currentTarget.getBoundingClientRect(),
            point: { x: held.startX, y: held.startY },
          },
        )
      }
      event.preventDefault()
      drag.move({ x: event.clientX, y: event.clientY })
    },
    onPointerUp: (event: ReactPointerEvent<HTMLElement>) => {
      const held = gesture.current
      if (!held || held.id !== event.pointerId) return
      gesture.current = null
      release(event)
      if (!held.dragging) return
      event.preventDefault()
      drag.drop()
      // Click is dispatched before timers, so this outlives exactly the click
      // this press is about to raise.
      setTimeout(() => { suppressClick.current = null }, 0)
    },
    onPointerCancel: (event: ReactPointerEvent<HTMLElement>) => {
      const held = gesture.current
      if (!held || held.id !== event.pointerId) return
      gesture.current = null
      release(event)
      if (held.dragging) drag.cancel()
    },
    onLostPointerCapture: (event: ReactPointerEvent<HTMLElement>) => {
      const held = gesture.current
      if (!held || held.id !== event.pointerId) return
      gesture.current = null
      if (held.dragging) drag.cancel()
    },
  })

  return (
    <nav className="exam-outline" aria-label="Exam Outline" data-outline-drop-zone="">
      {/* The toggle that closes it sits over this line, at its left. */}
      <header className="exam-outline-header">
        <h2>Outline</h2>
      </header>
      {outline.length === 0 ? (
        <p className="exam-outline-empty">No questions on this exam yet.</p>
      ) : (
        <ol className="exam-outline-sections">
          {outline.map(({ section, entries }) => (
            <li className="exam-outline-section" key={section.id}>
              <h3 className="exam-outline-heading">{section.title || 'Untitled section'}</h3>
              {entries.length === 0 ? (
                <p className="exam-outline-empty" data-outline-empty-section={section.id}>
                  No questions in this section
                </p>
              ) : (
                <ol className="exam-outline-list">
                  {/* One line per number on the test: a Matching set takes a
                      line for each of its Items, and every one of them stands
                      for — moves, and goes to — the whole set. */}
                  {entries.flatMap(({ question, number, span }) => Array.from(
                    { length: span },
                    (_, item) => (
                    <li key={`${question.id}-${item}`}>
                      <button
                        type="button"
                        className="exam-outline-row"
                        data-outline-question-id={question.id}
                        data-section-id={section.id}
                        data-drop={edgeDrop(dropStateOf(drag.intent, question.id), item, span)}
                        data-dragging={drag.draggedQuestionIds.has(question.id) ? 'true' : undefined}
                        aria-current={inView === question.id ? 'location' : undefined}
                        {...dragHandlers(question.id, question.type)}
                        onClick={() => {
                          if (suppressClick.current === question.id) {
                            suppressClick.current = null
                            return
                          }
                          reveal(question.id)
                        }}
                      >
                        <QuestionLine question={question} number={number + item} />
                      </button>
                    </li>
                  )))}
                </ol>
              )}
            </li>
          ))}
        </ol>
      )}
    </nav>
  )
}
