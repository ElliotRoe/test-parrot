// How the Question Bank Pane is searched, filtered and sorted.
//
// A query bar in the manner of a Notion database: a search box, then Filter
// and Sort as quiet icon buttons. What is set shows on a line of its own
// beneath, under a soft rule — the sort first, then a short rule, then each
// filter as a chip naming its values, and a "+ Filter" to add another — and
// that line is not there at all while nothing is set. A chip opens a card to
// change what it holds; a filter chip's × takes it away. Newest first is the
// order with nothing set, so it is never shown as a sort of its own. Nothing
// here is authoring: the filter is the workspace's.

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { ArrowUpDown, ChevronDown, ListFilter, Plus, Search, X } from 'lucide-react'
import {
  DIFFICULTY_OPTIONS,
  SORT_OPTIONS,
  TYPE_OPTIONS,
  type FilterOption,
} from './question-bank-filter-options'
import type { QuestionBankFilter, QuestionBankSort } from './question-bank-view'

type Category = 'types' | 'difficulties' | 'topics'

const CATEGORY_LABELS: Record<Category, string> = {
  types: 'Question Type',
  difficulties: 'Difficulty',
  topics: 'Topic',
}
const CATEGORIES: readonly Category[] = ['types', 'difficulties', 'topics']

/** The gap a card keeps from the window's edge, and its width. */
const MARGIN = 8
const MENU_WIDTH = 230

type Open =
  | { kind: 'filter' }
  | { kind: 'values'; category: Category }
  | { kind: 'sort' }

const sortLabel = (sort: QuestionBankSort) =>
  SORT_OPTIONS.find((option) => option.value === sort)?.label ?? sort

/** The sorts the teacher has set, in order — none while the bank is in its
 *  own order, newest first. */
function sortsOf(filter: QuestionBankFilter): QuestionBankSort[] {
  const sorts = [filter.sort ?? 'newest', ...(filter.thenBy ?? [])]
  return sorts.length === 1 && sorts[0] === 'newest' ? [] : sorts
}

/** The filter with exactly these sorts set. */
function withSorts(filter: QuestionBankFilter, sorts: readonly QuestionBankSort[]): QuestionBankFilter {
  const [sort = 'newest', ...thenBy] = sorts
  const { thenBy: _previous, ...rest } = filter
  void _previous
  return { ...rest, sort, ...(thenBy.length > 0 ? { thenBy } : {}) }
}

/** A small card anchored under a control, portalled so the pane's own
 *  clipping cannot cut it off. Closes on Escape and on a press outside. */
function Card({ anchor, label, onClose, children }: {
  anchor: HTMLElement
  label: string
  onClose: () => void
  children: ReactNode
}) {
  const card = useRef<HTMLDivElement>(null)
  const [place, setPlace] = useState<{ left: number; top: number } | null>(null)

  useLayoutEffect(() => {
    const position = () => {
      const bounds = anchor.getBoundingClientRect()
      const left = Math.max(MARGIN, Math.min(bounds.left, window.innerWidth - MENU_WIDTH - MARGIN))
      setPlace({ left, top: bounds.bottom + 4 })
    }
    position()
    window.addEventListener('resize', position)
    window.addEventListener('scroll', position, true)
    return () => {
      window.removeEventListener('resize', position)
      window.removeEventListener('scroll', position, true)
    }
  }, [anchor])

  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node
      if (card.current?.contains(target) || anchor.contains(target)) return
      onClose()
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [anchor, onClose])

  const placed = place !== null
  useEffect(() => {
    if (placed) card.current?.querySelector<HTMLElement>('button, input')?.focus()
  }, [placed])

  if (!place) return null
  return createPortal(
    <div
      ref={card}
      className="bank-query-menu"
      role="group"
      aria-label={label}
      style={{ left: place.left, top: place.top, width: MENU_WIDTH }}
      onKeyDown={(event) => {
        if (event.key !== 'Escape') return
        // Closing the card is the whole of what Escape means while it is
        // open; the workspace listens for the same key to clear its selection.
        event.stopPropagation()
        onClose()
        anchor.focus()
      }}
    >
      {children}
    </div>,
    document.body,
  )
}

export function BankQueryBar({ filter, topics, onChange, trailing }: {
  filter: QuestionBankFilter
  /** The Topics actually in the bank, exactly as they were typed. */
  topics: readonly string[]
  onChange: (filter: QuestionBankFilter) => void
  /** What ends the bar: the pane's New. */
  trailing?: ReactNode
}) {
  const [open, setOpen] = useState<{ menu: Open; anchor: HTMLElement } | null>(null)
  const close = () => setOpen(null)
  const sorts = sortsOf(filter)

  const optionsOf = (category: Category): readonly FilterOption<string>[] =>
    category === 'types'
      ? TYPE_OPTIONS
      : category === 'difficulties'
        ? DIFFICULTY_OPTIONS
        : topics.map((topic) => ({ value: topic, label: topic }))
  const valuesOf = (category: Category): readonly string[] => filter[category]
  const setValues = (category: Category, values: string[]) =>
    onChange({ ...filter, [category]: values })
  const labelOf = (category: Category, value: string) =>
    optionsOf(category).find((option) => option.value === value)?.label ?? value
  const valuesLabel = (category: Category) =>
    valuesOf(category).map((value) => labelOf(category, value)).join(', ')

  const chips = CATEGORIES.filter((category) => valuesOf(category).length > 0)

  const openMenu = (menu: Open, anchor: HTMLElement) =>
    setOpen((current) => current && current.anchor === anchor ? null : { menu, anchor })

  const sortCard = () => {
    // Newest first is the bank's own order, so once a sort is set it is no
    // sort to add after it; only what has not been used yet can be added.
    const addable = sorts.length === 0
      ? SORT_OPTIONS
      : SORT_OPTIONS.filter(({ value }) => value !== 'newest' && !sorts.includes(value))
    return <>
      {sorts.length > 0 && <>
        <p className="bank-query-menu-title">Sorted by</p>
        {sorts.map((sort, index) => (
          <div className="bank-query-sort-row" key={sort}>
            <span className="bank-query-sort-order">{index === 0 ? 'Sort' : 'Then'}</span>
            <span className="bank-query-sort-name">{sortLabel(sort)}</span>
            <button
              type="button"
              className="bank-chip-remove"
              aria-label={`Remove sort by ${sortLabel(sort)}`}
              onClick={() => onChange(withSorts(filter, sorts.filter((other) => other !== sort)))}
            >
              <X aria-hidden="true" />
            </button>
          </div>
        ))}
        {addable.length > 0 && <p className="bank-query-menu-title">Then by</p>}
      </>}
      {addable.map((option) => (
        <button
          type="button"
          role="menuitem"
          className="bank-query-item"
          key={option.value}
          onClick={() => {
            // Newest on its own is the order with nothing set.
            onChange(withSorts(filter, option.value === 'newest' ? [] : [...sorts, option.value]))
            close()
          }}
        >
          {option.label}
        </button>
      ))}
    </>
  }

  const menuBody = (menu: Open) => {
    if (menu.kind === 'sort') return sortCard()
    if (menu.kind === 'filter') {
      return CATEGORIES.map((category) => (
        <button
          type="button"
          role="menuitem"
          className="bank-query-item"
          key={category}
          onClick={() => setOpen((current) => current && { ...current, menu: { kind: 'values', category } })}
        >
          {CATEGORY_LABELS[category]}
          {valuesOf(category).length > 0 && <span className="bank-query-count">{valuesOf(category).length}</span>}
        </button>
      ))
    }
    const options = optionsOf(menu.category)
    const selected = valuesOf(menu.category)
    return <>
      <p className="bank-query-menu-title">{CATEGORY_LABELS[menu.category]}</p>
      {options.length === 0
        ? <p className="bank-query-empty">No {CATEGORY_LABELS[menu.category]}s yet</p>
        : options.map((option) => (
          <label className="bank-query-option" key={option.value}>
            <input
              type="checkbox"
              checked={selected.includes(option.value)}
              onChange={(event) => setValues(
                menu.category,
                event.target.checked
                  ? [...selected, option.value]
                  : selected.filter((value) => value !== option.value),
              )}
            />
            {option.label}
          </label>
        ))}
    </>
  }

  const menuLabel = (menu: Open) =>
    menu.kind === 'values' ? CATEGORY_LABELS[menu.category] : menu.kind === 'sort' ? 'Sort' : 'Filter'

  return (
    <div className="bank-query">
      <div className="bank-query-row">
        <div className="bank-search">
          <Search aria-hidden="true" />
          <input
            type="search"
            aria-label="Search question stems"
            placeholder="Search"
            value={filter.search}
            onChange={(event) => onChange({ ...filter, search: event.target.value })}
          />
        </div>
        <button
          type="button"
          className="bank-query-button"
          aria-label="Filter"
          title="Filter"
          aria-haspopup="true"
          data-active={chips.length > 0 ? 'true' : undefined}
          onClick={(event) => openMenu({ kind: 'filter' }, event.currentTarget)}
        >
          <ListFilter aria-hidden="true" />
        </button>
        <button
          type="button"
          className="bank-query-button"
          aria-label="Sort"
          title="Sort"
          aria-haspopup="true"
          data-active={sorts.length > 0 ? 'true' : undefined}
          onClick={(event) => openMenu({ kind: 'sort' }, event.currentTarget)}
        >
          <ArrowUpDown aria-hidden="true" />
        </button>
        {trailing}
      </div>
      {(chips.length > 0 || sorts.length > 0) && (
        <div className="bank-chips" aria-label="Sort and filters">
          {sorts.length > 0 && <>
            <span className="bank-chip" data-kind="sort">
              <button
                type="button"
                className="bank-chip-label"
                aria-haspopup="true"
                onClick={(event) => openMenu({ kind: 'sort' }, event.currentTarget)}
              >
                <ArrowUpDown aria-hidden="true" />
                {sorts.length === 1 ? sortLabel(sorts[0]!) : `${sorts.length} sorts`}
                <ChevronDown aria-hidden="true" />
              </button>
            </span>
            <span className="bank-chips-rule" aria-hidden="true" />
          </>}
          {chips.map((category) => (
            <span className="bank-chip" key={category}>
              <button
                type="button"
                className="bank-chip-label"
                aria-haspopup="true"
                aria-label={`${CATEGORY_LABELS[category]}: ${valuesLabel(category)}`}
                onClick={(event) => openMenu({ kind: 'values', category }, event.currentTarget)}
              >
                {valuesLabel(category)}
                <ChevronDown aria-hidden="true" />
              </button>
              <button
                type="button"
                className="bank-chip-remove"
                aria-label={`Remove ${CATEGORY_LABELS[category]} filter`}
                onClick={() => setValues(category, [])}
              >
                <X aria-hidden="true" />
              </button>
            </span>
          ))}
          <button
            type="button"
            className="bank-chips-add"
            aria-label="Add filter"
            aria-haspopup="true"
            onClick={(event) => openMenu({ kind: 'filter' }, event.currentTarget)}
          >
            <Plus aria-hidden="true" />
            Filter
          </button>
        </div>
      )}
      {open && (
        <Card anchor={open.anchor} label={menuLabel(open.menu)} onClose={close}>
          {menuBody(open.menu)}
        </Card>
      )}
    </div>
  )
}
