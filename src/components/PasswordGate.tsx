import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Lock } from 'lucide-react';
import { ThemeToggle } from './ThemeToggle';
import {
  createReviewAuthSession,
  isReviewAuthSessionValid,
  REVIEW_AUTH_STORAGE_KEY,
  verifyReviewCode,
} from '../lib/review-auth';

interface PasswordGateProps {
  children: React.ReactNode;
}

const PasswordGate: React.FC<PasswordGateProps> = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);

  useEffect(() => {
    localStorage.removeItem('dgc_jp_auth');
    setIsAuthenticated(isReviewAuthSessionValid(sessionStorage.getItem(REVIEW_AUTH_STORAGE_KEY)));
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsVerifying(true);
    setError('');

    try {
      if (await verifyReviewCode(password)) {
        sessionStorage.setItem(REVIEW_AUTH_STORAGE_KEY, createReviewAuthSession());
        setPassword('');
        setError('');
        setIsAuthenticated(true);
      } else {
        setError('レビュー用パスワードが正しくありません。');
      }
    } catch {
      setError('レビュー用パスワードが正しくありません。');
    } finally {
      setIsVerifying(false);
    }
  };

  if (isAuthenticated) {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 dark:bg-zinc-950 p-4 transition-colors">
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>
      <Card className="w-full max-w-md shadow-lg border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-gray-900 dark:text-zinc-100">
        <CardHeader className="space-y-1 flex flex-col items-center">
          <div className="bg-blue-100 dark:bg-blue-950/50 p-3 rounded-full mb-2">
            <Lock className="w-6 h-6 text-blue-600 dark:text-blue-400" />
          </div>
          <CardTitle className="text-2xl font-bold tracking-tight">dGC-JP アクセス制限</CardTitle>
          <CardDescription className="text-gray-500 dark:text-zinc-400">
            このアプリはレビュー用に限定公開されています。
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="password">レビュー用パスワード</Label>
              <Input
                id="password"
                type="password"
                placeholder="パスワードを入力"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                aria-invalid={!!error}
                aria-describedby={error ? "login-error-msg" : undefined}
                disabled={isVerifying}
                className={error ? "border-red-500" : "bg-white dark:bg-zinc-800 border-gray-200 dark:border-zinc-700"}
              />
              {error && (
                <div 
                  id="login-error-msg"
                  role="alert" 
                  aria-live="assertive"
                  className="text-xs text-red-900 dark:text-red-200 font-bold bg-red-50 dark:bg-red-950/50 p-2 rounded border-l-4 border-red-600 flex items-center gap-1"
                >
                  {error}
                </div>
              )}
            </div>
            <Button 
              type="submit" 
              disabled={isVerifying}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white"
              aria-label="レビュー用パスワードを入力してアプリケーションにアクセス"
            >
              {isVerifying ? '確認中...' : 'ログイン'}
            </Button>
            <p className="text-[10px] text-gray-400 dark:text-zinc-500 text-center mt-4">
              ※本認証はレビュー期間中の簡易的なアクセス制限です。
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default PasswordGate;
