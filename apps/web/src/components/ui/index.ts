/**
 * Auvo Design System - UI Components
 *
 * Re-export all UI components for easy imports
 */

// Button
export { Button, buttonVariants } from './button';
export type { ButtonProps } from './button';

// Card
export {
  Card,
  CardHeader,
  CardFooter,
  CardTitle,
  CardDescription,
  CardContent,
  DashboardCard,
  cardVariants,
} from './card';
export type { CardProps, DashboardCardProps } from './card';

// Badge
export { Badge, StatusBadge, badgeVariants } from './badge';
export type { BadgeProps, StatusBadgeProps, StatusType } from './badge';

// Input
export { Input, Textarea, FormField, Select, inputVariants, textareaVariants, selectVariants } from './input';
export type { InputProps, TextareaProps, FormFieldProps, SelectProps } from './input';

// Avatar
export { Avatar, AvatarGroup, avatarVariants } from './avatar';
export type { AvatarProps, AvatarGroupProps } from './avatar';

// Alert
export { Alert, alertVariants } from './alert';
export type { AlertProps } from './alert';

// Spinner/Loading
export { Spinner, LoadingOverlay, Skeleton, spinnerVariants, skeletonVariants } from './spinner';
export type { SpinnerProps, LoadingOverlayProps, SkeletonProps } from './spinner';

// Table
export {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableHead,
  TableRow,
  TableCell,
  TableCaption,
} from './table';

// Pagination
export { Pagination } from './pagination';

// Empty State
export { EmptyState } from './empty-state';

// Tabs
export { Tabs, TabsList, TabsTrigger, TabsContent } from './tabs';

// Modal
export { Modal, ModalFooter } from './modal';

// Switch
export { Switch, switchVariants } from './switch';
export type { SwitchProps } from './switch';

// Dropdown Menu
export {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuCheckboxItem,
  DropdownMenuRadioItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuGroup,
  DropdownMenuPortal,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuRadioGroup,
} from './dropdown-menu';

// Virtualized List
export { VirtualizedList, VirtualizedGrid, useItemHeightMeasure } from './virtualized-list';
export type { VirtualizedListProps, VirtualizedGridProps } from './virtualized-list';

// Progress Bar & Loading States
export { ProgressBar, GlobalLoadingSpinner, ListSkeleton, CardSkeleton, TableSkeleton } from './progress-bar';

// Dynamic Modal - Code Splitting
export { DynamicModal, DynamicDialog } from './dynamic-modal';

// Theme Toggle
export { ThemeToggle, ThemeDropdown } from './theme-toggle';

// Search Select (Combobox with search)
export { SearchSelect, searchSelectVariants } from './search-select';
export type { SearchSelectProps, SearchSelectOption } from './search-select';
