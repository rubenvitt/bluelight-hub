import type { ModuleColor } from '@/shared/ui/organisms/command-palette';
import type { ComponentType, ReactNode } from 'react';

export type WorkspaceVisibilityState = 'visible' | 'hidden' | 'disabled';
export type WorkspaceBadgeKind = 'status' | 'count' | 'info';
export type WorkspaceStatusTone = 'neutral' | 'info' | 'active' | 'loading' | 'warning' | 'blocked' | 'readonly';

export interface WorkspaceVisibilityRule {
  default: WorkspaceVisibilityState;
  reason?: string;
}

export interface WorkspaceShortcutMeta {
  modifiers: string[];
  key: string;
  ariaLabel?: string;
}

export interface WorkspaceBadgeHint {
  kind: WorkspaceBadgeKind;
  label: string;
  value?: string | number;
}

export interface WorkspaceSubPage {
  id: string;
  label: string;
  href: string;
  icon: ComponentType<{ className?: string }>;
  description?: string;
  badge?: string | number;
  visibility: WorkspaceVisibilityRule;
}

export type WorkspaceSubPageList = [WorkspaceSubPage, ...WorkspaceSubPage[]];

export interface WorkspaceModuleDefinition {
  id: string;
  label: string;
  routeTarget: string;
  icon: ComponentType<{ className?: string }>;
  description?: string;
  color: ModuleColor;
  priority: number;
  visibility: WorkspaceVisibilityRule;
  shortcut: WorkspaceShortcutMeta;
  badgeHint?: WorkspaceBadgeHint;
  subPages: WorkspaceSubPageList;
}

export interface WorkspaceBlockingOverlayState {
  isBlocking: boolean;
}

export interface WorkspaceContextBarBackAction {
  href: string;
  label: string;
  icon?: ComponentType<{ className?: string }>;
}

export interface WorkspaceContextBarModel {
  title: ReactNode;
  subtitle?: ReactNode;
  icon?: ComponentType<{ className?: string }>;
  backAction?: WorkspaceContextBarBackAction;
  endSlot?: ReactNode;
  ariaLabel?: string;
}

export interface WorkspaceStatusItem {
  id: string;
  label: string;
  description?: string;
  tone: WorkspaceStatusTone;
  icon?: ComponentType<{ className?: string }>;
  value?: ReactNode;
  nextActionLabel?: string;
  nextActionDescription?: string;
  role?: 'status' | 'alert';
  primaryAction?: {
    label: string;
    onClick: () => void;
    autoFocus?: boolean;
    ariaLabel?: string;
    disabled?: boolean;
  };
}

export interface WorkspaceModuleSelection {
  currentModule: WorkspaceModuleDefinition;
  currentPage: WorkspaceSubPage;
}

export type WorkspaceRouteParams = Record<string, string>;
