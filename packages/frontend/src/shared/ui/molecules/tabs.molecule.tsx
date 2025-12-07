import { cn } from '@/utils/cn';
import { Tab, TabGroup, TabList, TabPanel, TabPanels } from '@headlessui/react';
import type { ReactNode } from 'react';

interface TabItem {
  label: string;
  content: ReactNode;
}

interface TabsProps {
  items: Array<TabItem>;
  defaultIndex?: number;
  onChange?: (index: number) => void;
  className?: string;
}

/**
 * Tabs-Komponente mit Headless UI
 *
 * Bietet eine zugängliche Tab-Navigation mit Inhalten.
 */
export function Tabs({ items, defaultIndex = 0, onChange, className }: TabsProps) {
  return (
    <TabGroup defaultIndex={defaultIndex} onChange={onChange}>
      <TabList className={cn('flex space-x-1 rounded-xl bg-gray-100 p-1 dark:bg-gray-900', className)}>
        {items.map((item) => (
          <Tab
            key={item.label}
            className={({ selected }) =>
              cn(
                'w-full rounded-lg py-2.5 font-medium text-sm leading-5',
                'ring-white/60 ring-offset-2 ring-offset-blue-400 focus:outline-none focus:ring-2',
                selected ? 'bg-white text-blue-700 shadow dark:bg-gray-800 dark:text-blue-400' : 'text-gray-600 hover:bg-white/[0.12] hover:text-gray-800 dark:text-gray-400 dark:hover:text-white',
              )
            }
          >
            {item.label}
          </Tab>
        ))}
      </TabList>
      <TabPanels className="mt-2">
        {items.map((item) => (
          <TabPanel key={item.label} className={cn('rounded-xl p-3', 'ring-white/60 ring-offset-2 ring-offset-blue-400 focus:outline-none focus:ring-2')}>
            {item.content}
          </TabPanel>
        ))}
      </TabPanels>
    </TabGroup>
  );
}
