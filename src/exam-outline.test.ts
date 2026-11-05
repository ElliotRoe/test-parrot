import { describe, expect, test } from 'bun:test'
import type { Arrangement, Exam, Question } from './exam'
import { outlineOf } from './exam-outline'

function open(id: string): Question {
  return { id, type: 'open', doc: { type: 'doc', content: [] }, columns: 2 }
}

function multipleChoice(id: string): Question {
  return { id, type: 'multiple-choice', doc: { type: 'doc', content: [] }, columns: 2 }
}

function matching(id: string, items: number): Question {
  return {
    id,
    type: 'matching',
    doc: {
      type: 'doc',
      content: [
        { type: 'paragraph' },
        {
          type: 'matching',
          content: Array.from({ length: items }, (_, index) => ({
            type: 'matchingPrompt',
            attrs: { id: `${id}-p${index}`, answer: '' },
            content: [{ type: 'paragraph' }],
          })),
        },
      ],
    },
    columns: 2,
  }
}

const arrangement = (questionOrder: string[]): Arrangement => ({
  id: 'v1', letter: 'A', questionOrder, choiceOrder: {},
})

describe('the Exam Outline', () => {
  test('lists Questions in print order under their Section Headings', () => {
    const exam: Exam = {
      title: 'Test',
      questions: [open('sa1'), multipleChoice('mc1'), multipleChoice('mc2')],
      sections: [
        { id: 's1', title: 'Part One', instructions: '' },
        { id: 's2', title: 'Part Two', instructions: '' },
      ],
      sectionOf: { mc1: 's1', mc2: 's1', sa1: 's2' },
    }
    const outline = outlineOf(exam, arrangement(['mc2', 'mc1', 'sa1']))
    expect(outline.map(({ section, entries }) => [section.title, entries.map(({ question }) => question.id)]))
      .toEqual([['Part One', ['mc2', 'mc1']], ['Part Two', ['sa1']]])
  })

  test('numbers run on across Sections, a Matching set taking one per Item', () => {
    const exam: Exam = {
      title: 'Test',
      questions: [multipleChoice('mc1'), matching('m1', 4), open('sa1')],
      sections: [
        { id: 's1', title: 'One', instructions: '' },
        { id: 's2', title: 'Two', instructions: '' },
      ],
      sectionOf: { mc1: 's1', m1: 's1', sa1: 's2' },
    }
    const labels = outlineOf(exam, arrangement(['mc1', 'm1', 'sa1']))
      .flatMap(({ entries }) => entries.map(({ numberLabel }) => numberLabel))
    expect(labels).toEqual(['1', '2–5', '6'])
  })

  test('keeps an empty Section, so a Question can be moved into it', () => {
    const exam: Exam = {
      title: 'Test',
      questions: [open('sa1')],
      sections: [
        { id: 's1', title: 'One', instructions: '' },
        { id: 's2', title: 'Empty', instructions: '' },
      ],
      sectionOf: { sa1: 's1' },
    }
    expect(outlineOf(exam, arrangement(['sa1']))[1]).toMatchObject({ section: { title: 'Empty' }, entries: [] })
  })
})
