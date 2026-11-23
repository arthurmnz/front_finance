import clsx from 'clsx'

export interface TabItem<K extends string> {
  key: K
  label: string
  badge?: number
}

export interface TabsProps<K extends string> {
  tabs: TabItem<K>[]
  value: K
  onChange: (k: K) => void
  className?: string
}

export function Tabs<K extends string>({ tabs, value, onChange, className }: TabsProps<K>) {
  return (
    <div
      role="tablist"
      className={clsx(
        'flex max-w-full gap-1 overflow-x-auto overscroll-x-contain scroll-smooth rounded-2xl bg-surface p-1 border border-border-subtle select-none card-highlight',
        className,
      )}
    >
      {tabs.map((t) => {
        const isActive = value === t.key
        return (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(t.key)}
            className={clsx(
              'inline-flex min-h-10 min-w-fit flex-1 items-center justify-center whitespace-nowrap rounded-xl px-3 py-2 text-xs font-medium transition-all duration-150 cursor-pointer active:scale-[0.98] sm:min-h-9 sm:px-3.5',
              isActive
                ? 'bg-accent text-canvas font-semibold shadow-[inset_0_1px_0_0_rgba(255,255,255,0.28),0_2px_8px_rgba(251,191,36,0.28)]'
                : 'text-ink-secondary hover:text-ink-primary hover:bg-surface-elevated',
            )}
          >
            {t.label}
            {typeof t.badge === 'number' && t.badge > 0 && (
              <span
                className={clsx(
                  'ml-1.5 rounded-full px-1.5 py-0.5 text-[10px] font-mono font-bold',
                  isActive ? 'bg-canvas/20 text-canvas' : 'bg-white/15 text-ink-primary',
                )}
              >
                {t.badge}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
