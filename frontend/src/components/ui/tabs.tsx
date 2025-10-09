import { createContext, useContext, useMemo, useState } from 'react';

interface TabsContextValue {
  active: string;
  setActive: (value: string) => void;
}

interface TabsProps {
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  children: React.ReactNode;
}

interface TabsListProps {
  children: React.ReactNode;
  className?: string;
}

interface TabsTriggerProps {
  value: string;
  children: React.ReactNode;
  className?: string;
}

interface TabsContentProps {
  value: string;
  children: React.ReactNode;
  className?: string;
}

const TabsContext = createContext<TabsContextValue | undefined>(undefined);

export function Tabs({ value, defaultValue, onValueChange, children }: TabsProps) {
  const [internalValue, setInternalValue] = useState<string>(defaultValue ?? '');
  const isControlled = value !== undefined;
  const active = isControlled ? (value as string) : internalValue;

  const setActive = (next: string) => {
    if (!isControlled) {
      setInternalValue(next);
    }
    onValueChange?.(next);
  };

  const ctx = useMemo<TabsContextValue>(() => ({ active, setActive }), [active]);

  return <TabsContext.Provider value={ctx}>{children}</TabsContext.Provider>;
}

export function TabsList({ children, className }: TabsListProps) {
  return (
    <div className={`inline-flex gap-2 rounded-xl bg-slate-100 p-1 text-sm font-medium text-slate-600 ${className ?? ''}`}>
      {children}
    </div>
  );
}

export function TabsTrigger({ value, children, className }: TabsTriggerProps) {
  const ctx = useContext(TabsContext);
  if (!ctx) {
    throw new Error('TabsTrigger must be used within <Tabs>');
  }
  const isActive = ctx.active === value;
  return (
    <button
      type="button"
      onClick={() => ctx.setActive(value)}
      className={`rounded-lg px-3 py-1.5 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${
        isActive ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'
      } ${className ?? ''}`}
    >
      {children}
    </button>
  );
}

export function TabsContent({ value, children, className }: TabsContentProps) {
  const ctx = useContext(TabsContext);
  if (!ctx) {
    throw new Error('TabsContent must be used within <Tabs>');
  }
  if (ctx.active !== value) {
    return null;
  }
  return <div className={className}>{children}</div>;
}

export const TabsPrimitives = { Tabs, TabsList, TabsTrigger, TabsContent };
