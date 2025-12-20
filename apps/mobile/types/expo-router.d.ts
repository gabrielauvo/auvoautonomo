declare module 'expo-router' {
  import { ComponentType } from 'react';

  export interface StackScreenProps {
    name: string;
    options?: {
      title?: string;
      headerShown?: boolean;
      [key: string]: any;
    };
  }

  export const Stack: ComponentType<any> & {
    Screen: ComponentType<StackScreenProps>;
  };

  export const Tabs: ComponentType<any>;
  export const Drawer: ComponentType<any>;

  export function useRouter(): any;
  export function useLocalSearchParams(): any;
  export function usePathname(): string;
  export function useSegments(): string[];
}
