import { execSync } from 'child_process';

export default async () => {
  console.log('\n[Jest] Tearing down Integration Test Environment...');
  try {
    execSync('docker compose down', { stdio: 'inherit' });
  } catch (e) {
    console.error('\n[Jest] Failed to stop Docker services.');
  }
};
