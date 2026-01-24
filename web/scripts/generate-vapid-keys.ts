#!/usr/bin/env npx tsx
/**
 * Generate VAPID keys for web push notifications
 * Run: npx tsx scripts/generate-vapid-keys.ts
 */

import webpush from 'web-push';

const vapidKeys = webpush.generateVAPIDKeys();

console.log('VAPID Keys Generated');
console.log('====================\n');
console.log('Add these to your Vercel environment variables:\n');
console.log(`NEXT_PUBLIC_VAPID_PUBLIC_KEY=${vapidKeys.publicKey}`);
console.log(`VAPID_PRIVATE_KEY=${vapidKeys.privateKey}`);
console.log(`VAPID_SUBJECT=mailto:admin@texlegai.com`);
console.log('\n(Replace the email with your actual contact email)');
