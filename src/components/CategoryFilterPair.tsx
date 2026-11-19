import { useMemo } from 'react'
import clsx from 'clsx'
import { buildCategoryTree } from '@/lib/categories'
import type { Category } from '@/lib/types'
import { Field, Select, type SelectOption } from '@/components/ui'

export interface CategoryFilterPairProps {
  categories: Category[]
  generalCategoryId: string
  specificCategoryId: string
  onChange: (next: { generalCategoryId: string; specificCategoryId: string }) => void
  generalLabel?: string
  specificLabel?: string
  className?: string
}

export default function CategoryFilterPair({
  categories,
  generalCategoryId,
  specificCategoryId,
  onChange,
  generalLabel = 'Categoria geral',
  specificLabel = 'Categoria específica',
  className,
}: CategoryFilterPairProps) {
  const tree = useMemo(() => buildCategoryTree(categories), [categories])

  const generalOptions = useMemo<SelectOption[]>(() => {
    const opts: SelectOption[] = [
      { value: '', label: 'Todas as categorias gerais' },
      { value: 'none', label: 'Sem categoria' },
    ]
    tree.forEach((node) => {
      if (node.general.id === '__orphan__') return
      opts.push({
        value: node.general.id,
        label: `${node.general.icon ? `${node.general.icon} ` : ''}${node.general.name}`,
      })
    })
    return opts
  }, [tree])

  const selectedGeneralNode = useMemo(
    () => (generalCategoryId && generalCategoryId !== 'none'
      ? tree.find((n) => n.general.id === generalCategoryId)
      : undefined),
    [tree, generalCategoryId],
  )

  const specificDisabled = generalCategoryId === 'none'

  const specificOptions = useMemo<SelectOption[]>(() => {
    if (specificDisabled) {
      return [{ value: '', label: 'Indisponível (sem categoria)' }]
    }

    if (generalCategoryId) {
      const genName = selectedGeneralNode?.general.name ?? 'categoria geral'
      const opts: SelectOption[] = [
        { value: '', label: `Todas de ${genName} (incl. sem específica)` },
        { value: '__none_specific__', label: `Apenas direto em ${genName} (sem específica)` },
      ]
      ;(selectedGeneralNode?.children ?? []).forEach((sub) => {
        opts.push({
          value: sub.id,
          label: `${sub.icon ? `${sub.icon} ` : ''}${sub.name}`,
        })
      })
      return opts
    }

    const opts: SelectOption[] = [
      { value: '', label: 'Todas as específicas' },
      { value: '__none_specific__', label: 'Apenas sem específica (só geral)' },
    ]
    tree.forEach((node) => {
      const groupLabel = `${node.general.icon ? `${node.general.icon} ` : ''}${node.general.name}`
      node.children.forEach((sub) => {
        opts.push({
          value: sub.id,
          label: `${sub.icon ? `${sub.icon} ` : ''}${sub.name}`,
          group: groupLabel,
        })
      })
    })
    return opts
  }, [specificDisabled, generalCategoryId, selectedGeneralNode, tree])

  const handleGeneralChange = (nextGeneralId: string) => {
    if (nextGeneralId === 'none') {
      onChange({ generalCategoryId: 'none', specificCategoryId: '' })
      return
    }

    if (!nextGeneralId) {
      onChange({ generalCategoryId: '', specificCategoryId })
      return
    }

    const isSpecialSpecific = !specificCategoryId || specificCategoryId === '__none_specific__'
    if (isSpecialSpecific) {
      onChange({ generalCategoryId: nextGeneralId, specificCategoryId })
      return
    }

    const nextNode = tree.find((n) => n.general.id === nextGeneralId)
    const isCompatibleSpecific = Boolean(nextNode?.children.some((c) => c.id === specificCategoryId))
    onChange({
      generalCategoryId: nextGeneralId,
      specificCategoryId: isCompatibleSpecific ? specificCategoryId : '',
    })
  }

  const handleSpecificChange = (nextSpecificId: string) => {
    if (!nextSpecificId || nextSpecificId === '__none_specific__') {
      onChange({ generalCategoryId, specificCategoryId: nextSpecificId })
      return
    }

    if (!generalCategoryId) {
      const parentNode = tree.find((n) => n.children.some((c) => c.id === nextSpecificId))
      if (parentNode && parentNode.general.id !== '__orphan__') {
        onChange({ generalCategoryId: parentNode.general.id, specificCategoryId: nextSpecificId })
        return
      }
    }

    onChange({ generalCategoryId, specificCategoryId: nextSpecificId })
  }

  return (
    <div className={clsx('grid gap-3 sm:grid-cols-2 sm:col-span-2', className)}>
      <Field label={generalLabel}>
        <Select
          aria-label={generalLabel}
          value={generalCategoryId}
          onChange={(e) => handleGeneralChange(e.target.value)}
          options={generalOptions}
        />
      </Field>
      <Field label={specificLabel}>
        <Select
          aria-label={specificLabel}
          value={specificDisabled ? '' : specificCategoryId}
          disabled={specificDisabled}
          onChange={(e) => handleSpecificChange(e.target.value)}
          options={specificOptions}
        />
      </Field>
    </div>
  )
}
