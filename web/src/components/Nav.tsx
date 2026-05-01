import { NavLink } from 'react-router-dom';

const links = [
  { to: '/', label: 'Overview', exact: true },
  { to: '/teams', label: 'Teams' },
  { to: '/developers', label: 'Developers' },
  { to: '/products/github', label: 'GitHub' },
  { to: '/products/m365', label: 'M365' },
  { to: '/admin/identity', label: 'Identity' },
  { to: '/admin/pipelines', label: 'Pipelines' },
];

export function Nav() {
  return (
    <nav className="flex h-full flex-col bg-gray-900 px-3 py-4">
      <p className="mb-6 px-2 text-xs font-bold uppercase tracking-widest text-gray-400">
        AI Cost
      </p>
      <ul className="space-y-1">
        {links.map(({ to, label, exact }) => (
          <li key={to}>
            <NavLink
              to={to}
              end={exact}
              className={({ isActive }) =>
                `block rounded px-3 py-2 text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                }`
              }
            >
              {label}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
