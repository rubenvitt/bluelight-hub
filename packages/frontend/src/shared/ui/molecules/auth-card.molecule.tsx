import { Card } from '@/components/atoms/card.atom';
import { cn } from '@/utils/cn';
import type { ReactNode } from 'react';

interface AuthCardProps {
  children: ReactNode;
  className?: string;
  showStripe?: boolean;
}

/**
 * Spezielle Card-Komponente für Authentifizierungs-Seiten
 *
 * Erweitert die Standard-Card mit:
 * - Emergency Stripe Animation
 * - Overflow-hidden für saubere Rundungen
 * - Kein Border für cleanen Look
 */
export function AuthCard({ children, className, showStripe = true }: AuthCardProps) {
  return (
    <Card className={cn('relative animate-card-entry overflow-hidden border-0', className)} padding="lg">
      {showStripe && <div className="absolute inset-x-0 top-0 h-1 animate-stripe-move bg-[length:200%_100%] bg-gradient-to-r from-red-500 via-blue-600 to-red-500" />}
      {children}
    </Card>
  );
}
