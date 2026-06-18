import { SignClient } from '@walletconnect/sign-client';

async function test() {
  try {
    const client = await SignClient.init({
      projectId: '37016fd71f4d35906f67ec93aa5225ec',
      metadata: {
        name: 'WagerHub',
        description: 'Test',
        url: 'https://wagerhub.vercel.app',
        icons: []
      }
    });
    console.log('SUCCESS! Client initialized.');
    process.exit(0);
  } catch (e) {
    console.log('FAILED TO INITIALIZE:', e.message);
    process.exit(1);
  }
}

test();
