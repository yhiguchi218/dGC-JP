/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import GrowthDashboard from './components/GrowthDashboard';
import PasswordGate from './components/PasswordGate';

export default function App() {
  return (
    <div className="min-h-screen bg-gray-50/50">
      <PasswordGate>
        <GrowthDashboard />
      </PasswordGate>
    </div>
  );
}

