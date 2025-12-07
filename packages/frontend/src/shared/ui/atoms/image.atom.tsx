import { cn } from '@/utils/cn';
import type * as React from 'react';

interface ImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'auto';
  rounded?: boolean;
  shadow?: boolean;
}

/**
 * Image Atom Component
 *
 * Basis-Image-Komponente mit Tailwind CSS Styling
 */
export function Image({ className, size = 'auto', rounded = false, shadow = false, alt = '', ...props }: ImageProps) {
  const sizeClasses = {
    xs: 'w-8 h-8',
    sm: 'w-12 h-12',
    md: 'w-16 h-16',
    lg: 'w-20 h-20',
    xl: 'w-24 h-24',
    auto: '',
  };

  return <img className={cn('object-contain', sizeClasses[size], rounded && 'rounded-full', shadow && 'shadow-lg', className)} alt={alt} {...props} />;
}
