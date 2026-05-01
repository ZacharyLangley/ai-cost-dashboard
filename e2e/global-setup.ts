import { execSync } from 'child_process';

export default function globalSetup() {
  execSync('npm run db:seed', { stdio: 'inherit' });
}
