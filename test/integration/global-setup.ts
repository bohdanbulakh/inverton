import { execSync } from 'child_process';

export default async () => {
  console.log('\n[Jest] Setting up Integration Test Environment (Docker)...');
  try {
    execSync('docker --version', { stdio: 'ignore' });

    execSync('docker compose up -d --wait', { stdio: 'inherit' });
  } catch (e) {
    console.error('\n[Jest] Failed to start Docker services. Ensure Docker is installed and running.');
    throw e;
  }
};
