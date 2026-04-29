export const LIVE_STRIPE_CHECKOUT_URL = 'https://buy.stripe.com/3cI00j9wN8ZQ1Gs90XfrW02';

export function getStripeCheckoutUrl() {
  const deployEnv = process.env.NEXT_PUBLIC_DEPLOY_ENV;
  if (deployEnv === 'staging' || deployEnv === 'v2') {
    return process.env.NEXT_PUBLIC_STRIPE_TEST_CHECKOUT_URL || '/schedule';
  }

  return process.env.NEXT_PUBLIC_STRIPE_CHECKOUT_URL || LIVE_STRIPE_CHECKOUT_URL;
}
