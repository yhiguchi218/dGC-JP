import React from 'react';
import { Moon, Sun } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTheme } from '../context/ThemeContext';

export const ThemeToggle: React.FC = () => {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={toggleTheme}
      className="flex items-center gap-2 border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-gray-700 dark:text-zinc-200 hover:bg-gray-100 dark:hover:bg-zinc-700 transition-colors"
      aria-label={isDark ? 'ライトモードに切り替える' : 'ダークモードに切り替える'}
      title={isDark ? 'ライトモードに切り替える' : 'ダークモードに切り替える'}
    >
      {isDark ? (
        <>
          <Sun className="h-4 w-4 text-amber-400" aria-hidden="true" />
          <span className="text-xs font-medium">ライト</span>
        </>
      ) : (
        <>
          <Moon className="h-4 w-4 text-zinc-600" aria-hidden="true" />
          <span className="text-xs font-medium">ダーク</span>
        </>
      )}
    </Button>
  );
};
