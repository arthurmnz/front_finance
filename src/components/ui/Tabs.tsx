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
      className={clsx(
        'flex gap-1 overflow-x-auto rounded-2xl bg-surface-1 p-1 border border-border select-none',
        className,
      )}
    >
      {tabs.map((t) => {
        const isActive = value === t.key
        return (
          <button
            key={t.key}
            type="button"
            onClick={() => onChange(t.key)}
            className={clsx(
              'flex-1 whitespace-nowrap rounded-xl px-3.5 py-2 text-xs font-medium transition cursor-pointer',
              isActive
                ? 'bg-violet text-white font-semibold shadow-sm shadow-violet/30'
                : 'text-text-muted hover:text-white hover:bg-surface-2',
            )}
          >
            {t.label}
            {typeof t.badge === 'number' && t.badge > 0 && (
              <span className="ml-1.5 rounded-full bg-white/20 px-1.5 py-0.2 text-[10px] font-bold">
                {t.badge}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
