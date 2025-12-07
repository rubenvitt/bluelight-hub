import mobileLogo from '@/assets/brandbook/mobile-logo.png';
import mobileLogoWhite from '@/assets/brandbook/mobile-white.png';
import { useColorModeValue } from '@/hooks/use-color-mode';

interface LogoWithIndicatorProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showIndicator?: boolean;
}

/**
 * Logo mit animiertem Online-Indikator
 *
 * Zeigt das Bluelight Hub Logo mit einem optionalen
 * pulsierenden Online-Status-Indikator.
 */
export function LogoWithIndicator({ size = 'lg', showIndicator = true }: LogoWithIndicatorProps) {
  const logoSrc = useColorModeValue(mobileLogo, mobileLogoWhite);

  const sizeClasses = {
    sm: 'h-12 w-12',
    md: 'h-16 w-16',
    lg: 'h-20 w-20',
    xl: 'h-24 w-24',
  };

  return (
    <div className="relative inline-block">
      <img src={logoSrc} alt="Bluelight Hub Logo" className={`${sizeClasses[size]} object-contain drop-shadow-[0_10px_30px_rgba(0,61,122,0.3)]`} />
      {showIndicator && <div className="-right-0.5 -top-0.5 absolute h-4 w-4 animate-pulse-shadow rounded-full border-[3px] border-white bg-green-400 dark:border-gray-800" />}
    </div>
  );
}
