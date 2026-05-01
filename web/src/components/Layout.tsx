import { Outlet } from 'react-router-dom';
import { Nav } from './Nav';

export function Layout() {
  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      <aside className="w-48 flex-shrink-0 border-r border-gray-800">
        <Nav />
      </aside>
      <main className="flex-1 overflow-y-auto p-6">
        <Outlet />
      </main>
    </div>
  );
}
