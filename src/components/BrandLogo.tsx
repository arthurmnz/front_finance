import type { ImgHTMLAttributes } from 'react'

interface BrandLogoProps extends Omit<ImgHTMLAttributes<HTMLImageElement>, 'src'> {
  size?: number | string
}

export function BrandLogo({ className = 'size-9', alt = 'Finance', ...props }: BrandLogoProps) {
  return (
    <img
      src="/icon.svg"
      alt={alt}
      className={`select-none object-contain [filter:hue-rotate(-36deg)_saturate(1.1)] ${className}`}
      {...props}
    />
  )
}

export default BrandLogo
