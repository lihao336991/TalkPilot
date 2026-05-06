#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { networkInterfaces } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const appJsonPath = path.join(repoRoot, 'app.json');
const infoPlistPath = path.join(repoRoot, 'ios', 'TalkPilot', 'Info.plist');
const plistBuddyPath = '/usr/libexec/PlistBuddy';

const EXCEPTION_VALUE = {
  NSIncludesSubdomains: true,
  NSExceptionAllowsInsecureHTTPLoads: true,
};

const isPrivateIPv4 = (address) =>
  /^10\./.test(address) ||
  /^192\.168\./.test(address) ||
  /^172\.(1[6-9]|2\d|3[0-1])\./.test(address) ||
  /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./.test(address);

const localIPv4s = Object.values(networkInterfaces())
  .flatMap((items) => items ?? [])
  .filter((item) => item.family === 'IPv4' && !item.internal && isPrivateIPv4(item.address))
  .map((item) => item.address);

const envIPv4s = (process.env.TALKPILOT_IOS_ATS_IPS ?? process.env.TALKPILOT_DEV_IPS ?? '')
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean);

const ips = [...new Set([...localIPv4s, ...envIPv4s])].sort();

if (ips.length === 0) {
  console.log('[ios-ats] No private IPv4 address found; Info.plist unchanged.');
  process.exit(0);
}

const syncAppJson = () => {
  if (!existsSync(appJsonPath)) {
    return;
  }

  const appJson = JSON.parse(readFileSync(appJsonPath, 'utf8'));
  const infoPlist = (appJson.expo.ios.infoPlist ??= {});
  const ats = (infoPlist.NSAppTransportSecurity ??= {});
  const domains = (ats.NSExceptionDomains ??= {});

  for (const ip of ips) {
    domains[ip] = EXCEPTION_VALUE;
  }

  writeFileSync(appJsonPath, `${JSON.stringify(appJson, null, 2)}\n`);
};

const plistBuddy = (...args) => {
  execFileSync(plistBuddyPath, args, { stdio: 'ignore' });
};

const tryPlistBuddy = (...args) => {
  try {
    plistBuddy(...args);
    return true;
  } catch {
    return false;
  }
};

const ensurePlistDict = (plistPath, keyPath) => {
  if (!tryPlistBuddy('-c', `Print ${keyPath}`, plistPath)) {
    plistBuddy('-c', `Add ${keyPath} dict`, plistPath);
  }
};

const syncInfoPlist = () => {
  if (!existsSync(infoPlistPath)) {
    return;
  }

  ensurePlistDict(infoPlistPath, ':NSAppTransportSecurity');
  ensurePlistDict(infoPlistPath, ':NSAppTransportSecurity:NSExceptionDomains');

  for (const ip of ips) {
    const domainPath = `:NSAppTransportSecurity:NSExceptionDomains:${ip}`;
    ensurePlistDict(infoPlistPath, domainPath);

    if (!tryPlistBuddy('-c', `Set ${domainPath}:NSIncludesSubdomains true`, infoPlistPath)) {
      plistBuddy('-c', `Add ${domainPath}:NSIncludesSubdomains bool true`, infoPlistPath);
    }

    if (!tryPlistBuddy('-c', `Set ${domainPath}:NSExceptionAllowsInsecureHTTPLoads true`, infoPlistPath)) {
      plistBuddy('-c', `Add ${domainPath}:NSExceptionAllowsInsecureHTTPLoads bool true`, infoPlistPath);
    }
  }
};

syncAppJson();
syncInfoPlist();

console.log(`[ios-ats] Synced ATS exception domains: ${ips.join(', ')}`);
