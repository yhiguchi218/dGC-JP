import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Lock } from 'lucide-react';

const AUTH_KEY = 'dgc_jp_auth';
const PASSWORD = 'yhiguchi218@gmail.com';

interface PasswordGateProps {
  children: React.ReactNode;
}

const PasswordGate: React.FC<PasswordGateProps> = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    const saved = localStorage.getItem(AUTH_KEY);
    if (saved === 'true') {
      setIsAuthenticated(true);
    }
  }, []);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (password === PASSWORD) {
      setIsAuthenticated(true);
      localStorage.setItem(AUTH_KEY, 'true');
      setError('');
    } else {
      setError('パスワードが正しくありません。');
    }
  };

  if (isAuthenticated) {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <Card className="w-full max-w-md shadow-lg border-gray-200">
        <CardHeader className="space-y-1 flex flex-col items-center">
          <div className="bg-blue-100 p-3 rounded-full mb-2">
            <Lock className="w-6 h-6 text-blue-600" />
          </div>
          <CardTitle className="text-2xl font-bold tracking-tight">dGC-JP アクセス制限</CardTitle>
          <CardDescription>
            このアプリはレビュー用に限定公開されています。
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="password">パスワード（指定のメールアドレス）</Label>
              <Input
                id="password"
                type="password"
                placeholder="メールアドレスを入力"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={error ? "border-red-500" : ""}
              />
              {error && <p className="text-xs text-red-500 font-medium">{error}</p>}
            </div>
            <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700">
              ログイン
            </Button>
            <p className="text-[10px] text-gray-400 text-center mt-4">
              ※本認証はクライアントサイドでの簡易的な制限です。
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default PasswordGate;
