import type { ImgHTMLAttributes } from 'react'

interface BrandLogoProps extends Omit<ImgHTMLAttributes<HTMLImageElement>, 'src'> {
  size?: number | string
}

export function BrandLogo({ className = 'size-9', alt = 'Finance', ...props }: BrandLogoProps) {
  return (
    <img
      src="/icon.svg"
      alt={alt}
      className={`select-none object-contain ${className}`}
      {...props}
    />
  )
}

export default BrandLogo
