#!/usr/bin/env node

/**
 * GitHub OAuth Setup Script
 *
 * This script helps you set up GitHub OAuth for the Media Logbook app.
 */

import fs from 'fs';
import path from 'path';
import readline from 'readline';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const GIST_FILE = path.join(__dirname, '../src/lib/gist.ts');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(query) {
  return new Promise(resolve => rl.question(query, resolve));
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function clearScreen() {
  console.clear();
}

function printHeader() {
  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║     GitHub OAuth Setup for Media Logbook Sync            ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');
}

function printStep(step, title) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`STEP ${step}: ${title}`);
  console.log('='.repeat(60));
}

function printSuccess(message) {
  console.log(`\n✅ ${message}`);
}

function printError(message) {
  console.log(`\n❌ ${message}`);
}

function printInfo(message) {
  console.log(`\nℹ️  ${message}`);
}

function printWarning(message) {
  console.log(`\n⚠️  ${message}`);
}

async function checkCurrentConfig() {
  printStep(1, 'Checking Current Configuration');

  const gistContent = fs.readFileSync(GIST_FILE, 'utf8');
  const isConfigured = gistContent.match(/GITHUB_CLIENT_ID = '([^']+)'/);
  const currentClientId = isConfigured ? isConfigured[1] : null;

  if (currentClientId && currentClientId !== 'YOUR_CLIENT_ID_HERE') {
    printSuccess(`GitHub Client ID is already configured: ${currentClientId.substring(0, 8)}...`);
    const reconfigure = await question('\nDo you want to reconfigure? (y/N): ');
    if (reconfigure.toLowerCase() !== 'y') {
      printInfo('Setup cancelled. Existing configuration preserved.');
      rl.close();
      process.exit(0);
    }
  } else {
    printWarning('GitHub Client ID is not configured yet.');
  }

  await sleep(1000);
  return true;
}

async function guideOAuthCreation() {
  printStep(2, 'Create GitHub OAuth App');

  console.log('\nPlease follow these steps to create a GitHub OAuth App:\n');

  console.log('1. Open this URL in your browser:');
  console.log('   🔗 https://github.com/settings/applications/new\n');

  console.log('2. Fill in the form:');
  console.log('   • Application name: Media Logbook');
  console.log('   • Homepage URL: https://jefflog.vercel.app');
  console.log('   • Authorization callback URL:');
  console.log('     https://jefflog.vercel.app/auth/callback\n');

  console.log('3. Click "Register application"\n');

  await question('Press Enter when you have created the OAuth App...');

  return true;
}

async function collectClientId() {
  printStep(3, 'Enter Your GitHub Client ID');

  console.log('\nAfter creating the OAuth App, you will see a "Client ID" on the page.');
  console.log('Copy it and paste it below.\n');

  let clientId = '';
  while (true) {
    clientId = await question('Enter your GitHub Client ID: ');

    if (!clientId || clientId.trim().length === 0) {
      printError('Client ID cannot be empty. Please try again.');
      continue;
    }

    // Basic validation
    if (clientId.length < 10) {
      printWarning('This seems short for a GitHub Client ID. Are you sure?');
      const confirm = await question('Use this ID anyway? (y/N): ');
      if (confirm.toLowerCase() !== 'y') {
        continue;
      }
    }

    break;
  }

  return clientId.trim();
}

async function updateGistFile(clientId) {
  printStep(4, 'Update Configuration');

  const gistContent = fs.readFileSync(GIST_FILE, 'utf8');
  const updatedContent = gistContent.replace(
    /export const GITHUB_CLIENT_ID = '[^']+'/,
    `export const GITHUB_CLIENT_ID = '${clientId}'`
  );

  fs.writeFileSync(GIST_FILE, updatedContent, 'utf8');
  printSuccess('Updated src/lib/gist.ts with your Client ID');

  return true;
}

async function validateSetup() {
  printStep(5, 'Validate Setup');

  const gistContent = fs.readFileSync(GIST_FILE, 'utf8');
  const isConfigured = gistContent.match(/GITHUB_CLIENT_ID = '([^']+)'/);
  const clientId = isConfigured ? isConfigured[1] : null;

  if (clientId && clientId !== 'YOUR_CLIENT_ID_HERE') {
    printSuccess('Configuration validated successfully!');
    console.log(`\n   Client ID: ${clientId.substring(0, 8)}...${clientId.substring(clientId.length - 4)}`);
    return true;
  } else {
    printError('Configuration validation failed.');
    return false;
  }
}

async function showNextSteps(clientId) {
  printStep(6, 'Next Steps');

  console.log('\n🎉 Setup complete! Here\'s what to do next:\n');

  console.log('1. Test the OAuth flow:');
  console.log('   npm run dev:vite');
  console.log('   # Open http://localhost:5173');
  console.log('   # Click the gear icon → "Sign in with GitHub"\n');

  console.log('2. Deploy to production:');
  console.log('   git add .');
  console.log('   git commit -m "Configure GitHub OAuth"');
  console.log('   git push');
  console.log('   # Vercel will auto-deploy\n');

  console.log('3. Important notes:');
  console.log('   • Never commit your Client Secret (we don\'t use it)');
  console.log('   • Keep the Callback URL matching your domain');
  console.log('   • Tokens expire after 8 hours (user must re-auth)\n');

  if (clientId) {
    console.log('   Your Client ID:', clientId.substring(0, 8) + '...');
  }
}

async function main() {
  try {
    clearScreen();
    printHeader();

    await checkCurrentConfig();
    await guideOAuthCreation();
    const clientId = await collectClientId();
    await updateGistFile(clientId);
    const valid = await validateSetup();

    if (valid) {
      await showNextSteps(clientId);
      printSuccess('\nSetup completed successfully! 🚀\n');
    } else {
      printError('\nSetup failed. Please try again.\n');
    }

  } catch (error) {
    printError(`\nAn error occurred: ${error.message}\n`);
    console.error(error);
  } finally {
    rl.close();
  }
}

// Run the script
main();
