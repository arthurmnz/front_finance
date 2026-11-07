import {
  Children,
  isValidElement,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactElement,
  type ReactNode,
} from 'react'
import clsx from 'clsx'
import { Check, ChevronDown, Search } from 'lucide-react'

export interface SelectOption {
  value: string
  label: ReactNode
  group?: string
  disabled?: boolean
}

export interface SelectProps {
  value?: string | number
  onChange?: (e: { target: { value: string }; currentTarget: { value: string } }) => void
  options?: SelectOption[]
  placeholder?: string
  disabled?: boolean
  className?: string
  children?: ReactNode
  required?: boolean
  name?: string
  id?: string
  searchable?: boolean
  'aria-label'?: string
}

export function Select({
  value,
  onChange,
  options: explicitOptions,
  placeholder = 'Selecione…',
  disabled = false,
  className,
  children,
  required,
  name,
  id,
  searchable,
  'aria-label': ariaLabel,
}: SelectProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [highlightedIndex, setHighlightedIndex] = useState(-1)
  const containerRef = useRef<HTMLDivElement>(null)
  const listboxRef = useRef<HTMLUListElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const generatedId = useId()
  const selectId = id || generatedId

  // Extrai options a partir de children (<option> ou <optgroup>) quando não passados via props
  const extractedOptions = useMemo(() => {
    if (explicitOptions) return explicitOptions
    const items: SelectOption[] = []

    const parseChildren = (nodes: ReactNode, groupName?: string) => {
      Children.forEach(nodes, (child) => {
        if (!isValidElement(child)) return
        const element = child as ReactElement<{
          value?: string | number
          label?: string
          children?: ReactNode
          disabled?: boolean
        }>

        // Suporte para <optgroup> ou similar
        if (element.type === 'optgroup' || (element.props && 'label' in element.props && !('value' in element.props))) {
          parseChildren(element.props.children, element.props.label)
          return
        }

        // Suporte para <option>
        const val = element.props.value !== undefined ? String(element.props.value) : ''
        const lbl = element.props.children ?? element.props.label ?? val
        items.push({
          value: val,
          label: lbl,
          group: groupName,
          disabled: element.props.disabled,
        })
      })
    }

    parseChildren(children)
    return items
  }, [explicitOptions, children])

  const strValue = value !== undefined && value !== null ? String(value) : ''

  const selectedOption = useMemo(
    () => extractedOptions.find((o) => o.value === strValue),
    [extractedOptions, strValue],
  )

  const isSearchable = searchable ?? extractedOptions.length > 8

  const filteredOptions = useMemo(() => {
    if (!isSearchable || !search.trim()) return extractedOptions
    const term = search.trim().toLowerCase()
    return extractedOptions.filter((o) => {
      const text = typeof o.label === 'string' ? o.label : String(o.value)
      return text.toLowerCase().includes(term) || (o.group && o.group.toLowerCase().includes(term))
    })
  }, [extractedOptions, isSearchable, search])

  // Fecha ao clicar fora
  useEffect(() => {
    if (!open) return
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
        setSearch('')
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [open])

  // Autofoco no input de busca se aberto
  useEffect(() => {
    if (open && isSearchable) {
      setTimeout(() => searchInputRef.current?.focus(), 50)
    }
  }, [open, isSearchable])

  const handleSelect = (val: string) => {
    if (disabled) return
    onChange?.({ target: { value: val }, currentTarget: { value: val } })
    setOpen(false)
    setSearch('')
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLButtonElement | HTMLDivElement>) => {
    if (disabled) return

    if (!open) {
      if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(e.key)) {
        e.preventDefault()
        setOpen(true)
        const currentIdx = filteredOptions.findIndex((o) => o.value === strValue)
        setHighlightedIndex(currentIdx >= 0 ? currentIdx : 0)
      }
      return
    }

    switch (e.key) {
      case 'Escape':
        e.preventDefault()
        setOpen(false)
        setSearch('')
        break
      case 'ArrowDown':
        e.preventDefault()
        setHighlightedIndex((prev) => (prev < filteredOptions.length - 1 ? prev + 1 : 0))
        break
      case 'ArrowUp':
        e.preventDefault()
        setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : filteredOptions.length - 1))
        break
      case 'Enter':
        e.preventDefault()
        if (highlightedIndex >= 0 && filteredOptions[highlightedIndex]) {
          const item = filteredOptions[highlightedIndex]
          if (!item.disabled) handleSelect(item.value)
        }
        break
    }
  }

  // Agrupa options por grupo para renderização
  const grouped = useMemo(() => {
    const map = new Map<string, SelectOption[]>()
    filteredOptions.forEach((o) => {
      const g = o.group || ''
      if (!map.has(g)) map.set(g, [])
      map.get(g)!.push(o)
    })
    return map
  }, [filteredOptions])

  return (
    <div ref={containerRef} className={clsx('relative w-full', className)}>
      {/* Hidden input para formulários HTML / RHF */}
      {name && <input type="hidden" name={name} value={strValue} required={required} />}

      {/* Trigger button */}
      <button
        id={selectId}
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        onClick={() => {
          if (!disabled) {
            setOpen((prev) => !prev)
            if (!open) {
              const currentIdx = filteredOptions.findIndex((o) => o.value === strValue)
              setHighlightedIndex(currentIdx >= 0 ? currentIdx : 0)
            }
          }
        }}
        onKeyDown={handleKeyDown}
        className={clsx(
          'flex h-11 w-full items-center justify-between gap-2 rounded-xl border px-3.5 text-left text-sm transition select-none cursor-pointer',
          'bg-surface-1 border-border text-white',
          'hover:border-border-strong',
          open && '!border-lime ring-1 ring-lime',
          disabled && 'opacity-40 cursor-not-allowed pointer-events-none',
        )}
      >
        <span className={clsx('truncate flex-1', !selectedOption && 'text-text-dim')}>
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <ChevronDown
          className={clsx('size-4 shrink-0 text-text-dim transition-transform duration-200', open && 'rotate-180 text-lime')}
        />
      </button>

      {/* Popover listbox */}
      {open && (
        <div
          className={clsx(
            'absolute left-0 top-full z-50 mt-1.5 w-full min-w-[14rem] max-h-72 overflow-hidden rounded-2xl border border-border bg-surface-1 shadow-2xl shadow-black/90 p-1.5 animate-in fade-in-0 zoom-in-95',
          )}
        >
          {isSearchable && (
            <div className="relative mb-1.5 p-1">
              <Search className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-text-dim" />
              <input
                ref={searchInputRef}
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (['ArrowDown', 'ArrowUp', 'Enter', 'Escape'].includes(e.key)) {
                    handleKeyDown(e)
                  }
                }}
                placeholder="Buscar…"
                className="w-full rounded-lg bg-surface-2 border border-border px-8 py-1.5 text-xs text-white placeholder:text-text-dim outline-none focus:border-lime focus:ring-1 focus:ring-lime caret-lime"
              />
            </div>
          )}

          <ul
            ref={listboxRef}
            role="listbox"
            tabIndex={-1}
            className="max-h-56 overflow-y-auto space-y-0.5"
          >
            {filteredOptions.length === 0 ? (
              <li className="px-3 py-4 text-center text-xs text-text-dim">Nenhuma opção encontrada</li>
            ) : (
              Array.from(grouped.entries()).map(([grp, items]) => (
                <div key={grp || 'default'}>
                  {grp && (
                    <li className="px-2.5 pt-2 pb-1 text-[11px] font-semibold uppercase tracking-wider text-text-dim select-none">
                      {grp}
                    </li>
                  )}
                  {items.map((item) => {
                    const isSelected = item.value === strValue
                    const flatIdx = filteredOptions.indexOf(item)
                    const isHighlighted = flatIdx === highlightedIndex

                    return (
                      <li
                        key={item.value || `opt-${flatIdx}`}
                        role="option"
                        aria-selected={isSelected}
                        aria-disabled={item.disabled}
                        onClick={() => !item.disabled && handleSelect(item.value)}
                        onMouseEnter={() => setHighlightedIndex(flatIdx)}
                        className={clsx(
                          'flex items-center justify-between gap-2 rounded-xl px-3 py-2 text-sm transition cursor-pointer select-none',
                          isSelected && 'bg-violet/20 text-white font-medium',
                          !isSelected && isHighlighted && 'bg-surface-2 text-white',
                          !isSelected && !isHighlighted && 'text-text-muted hover:text-white',
                          item.disabled && 'opacity-30 cursor-not-allowed pointer-events-none',
                        )}
                      >
                        <span className="truncate flex-1">{item.label}</span>
                        {isSelected && <Check className="size-4 shrink-0 text-lime" />}
                      </li>
                    )
                  })}
                </div>
              ))
            )}
          </ul>
        </div>
      )}
    </div>
  )
}
