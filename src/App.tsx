/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import GrowthDashboard from './components/GrowthDashboard';
import PasswordGate from './components/PasswordGate';

export default function App() {
  return (
    <div className="min-h-screen bg-gray-50/50">
      <a 
        href="#main-content" 
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-blue-600 focus:text-white focus:font-bold focus:rounded-lg focus:shadow-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
      >
        メインコンテンツにスキップする
      </a>
      <PasswordGate>
        <GrowthDashboard />
      </PasswordGate>
    </div>
  );
}

