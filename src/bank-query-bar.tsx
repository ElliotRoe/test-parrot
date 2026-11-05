// How the Question Bank Pane is searched, filtered and sorted.
//
// A query bar in the manner of a Notion database: a search box, then two
// quiet icon buttons — Filter and Sort — that each open a small menu. What is
// set shows as chips on a line of their own beneath, which is not there at
// all while nothing is set. A chip opens its own menu to change it, and its ×
// takes it away. Nothing here is authoring: the filter is the workspace's.

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { ArrowUpDown, Check, ChevronDown, ListFilter, Search, X } from 'lucide-react'
import {
  DIFFICULTY_OPTIONS,
  SORT_OPTIONS,
  TYPE_OPTIONS,
  type FilterOption,
} from './question-bank-filter-options'
import {
  NO_FILTER,
  type QuestionBankFilter,
  type QuestionBankSort,
} from './question-bank-view'

type Category = 'types' | 'difficulties' | 'topics'

const CATEGORY_LABELS: Record<Category, string> = {
  types: 'Question Type',
  difficulties: 'Difficulty',
  topics: 'Topic',
}
const CATEGORIES: readonly Category[] = ['types', 'difficulties', 'topics']

/** The gap a menu keeps from the window's edge, and its width. */
const MARGIN = 8
const MENU_WIDTH = 220

type Open =
  | { kind: 'filter' }
  | { kind: 'values'; category: Category }
  | { kind: 'sort' }

/** A small menu anchored under a control, portalled so the pane's own
 *  clipping cannot cut it off. Closes on Escape and on a press outside. */
function Menu({ anchor, label, onClose, children }: {
  anchor: HTMLElement
  label: string
  onClose: () => void
  children: ReactNode
}) {
  const menu = useRef<HTMLDivElement>(null)
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
      if (menu.current?.contains(target) || anchor.contains(target)) return
      onClose()
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [anchor, onClose])

  const placed = place !== null
  useEffect(() => {
    if (placed) menu.current?.querySelector<HTMLElement>('button, input')?.focus()
  }, [placed])

  if (!place) return null
  return createPortal(
    <div
      ref={menu}
      className="bank-query-menu"
      role="group"
      aria-label={label}
      style={{ left: place.left, top: place.top, width: MENU_WIDTH }}
      onKeyDown={(event) => {
        if (event.key !== 'Escape') return
        // Closing the menu is the whole of what Escape means while it is
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
  /** Actions on what the query shows, at the end of the bar. */
  trailing?: ReactNode
}) {
  const [open, setOpen] = useState<{ menu: Open; anchor: HTMLElement } | null>(null)
  const close = () => setOpen(null)
  const sort = filter.sort ?? 'newest'

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

  const chips = CATEGORIES.filter((category) => valuesOf(category).length > 0)
  const sorted = sort !== 'newest'

  const openMenu = (menu: Open, anchor: HTMLElement) =>
    setOpen((current) => current && current.anchor === anchor && current.menu.kind === menu.kind ? null : { menu, anchor })

  const menuBody = (menu: Open) => {
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
    if (menu.kind === 'sort') {
      return SORT_OPTIONS.map((option) => (
        <button
          type="button"
          role="menuitemradio"
          aria-checked={sort === option.value}
          className="bank-query-item"
          key={option.value}
          onClick={() => {
            onChange({ ...filter, sort: option.value as QuestionBankSort })
            close()
          }}
        >
          {option.label}
          {sort === option.value && <Check aria-hidden="true" />}
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
          aria-expanded={open?.menu.kind === 'filter' || open?.menu.kind === 'values' && !open.anchor.closest('.bank-chip')}
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
          aria-expanded={open?.menu.kind === 'sort'}
          data-active={sorted ? 'true' : undefined}
          onClick={(event) => openMenu({ kind: 'sort' }, event.currentTarget)}
        >
          <ArrowUpDown aria-hidden="true" />
        </button>
        {trailing}
      </div>
      {(chips.length > 0 || sorted) && (
        <div className="bank-chips" aria-label="Filters and sort">
          {sorted && (
            <span className="bank-chip" data-kind="sort">
              <button
                type="button"
                className="bank-chip-label"
                aria-haspopup="true"
                onClick={(event) => openMenu({ kind: 'sort' }, event.currentTarget)}
              >
                <ArrowUpDown aria-hidden="true" />
                {SORT_OPTIONS.find((option) => option.value === sort)?.label}
                <ChevronDown aria-hidden="true" />
              </button>
              <button
                type="button"
                className="bank-chip-remove"
                aria-label="Remove sort"
                onClick={() => onChange({ ...filter, sort: 'newest' })}
              >
                <X aria-hidden="true" />
              </button>
            </span>
          )}
          {chips.map((category) => (
            <span className="bank-chip" key={category}>
              <button
                type="button"
                className="bank-chip-label"
                aria-haspopup="true"
                onClick={(event) => openMenu({ kind: 'values', category }, event.currentTarget)}
              >
                <span className="bank-chip-name">{CATEGORY_LABELS[category]}:</span>
                {valuesOf(category).map((value) => labelOf(category, value)).join(', ')}
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
          {chips.length > 0 && (
            <button
              type="button"
              className="bank-chips-clear"
              onClick={() => onChange({ ...NO_FILTER, search: filter.search, sort })}
            >
              Clear filters
            </button>
          )}
        </div>
      )}
      {open && (
        <Menu
          anchor={open.anchor}
          label={open.menu.kind === 'values' ? CATEGORY_LABELS[open.menu.category] : open.menu.kind === 'sort' ? 'Sort' : 'Filter'}
          onClose={close}
        >
          {menuBody(open.menu)}
        </Menu>
      )}
    </div>
  )
}
