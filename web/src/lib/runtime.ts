export function getDeployEnv() {
  return (process.env.NEXT_PUBLIC_DEPLOY_ENV || process.env.VERCEL_ENV || process.env.NODE_ENV || 'development').toLowerCase();
}

export function isStagingEnvironment() {
  const env = getDeployEnv();
  return env === 'staging' || env === 'preview' || env === 'v2';
}

export function isProductionEnvironment() {
  return getDeployEnv() === 'production';
}

export function externalActionsDisabled() {
  return process.env.DISABLE_EXTERNAL_ACTIONS === 'true';
}

export function emailMode() {
  return (process.env.EMAIL_MODE || (isStagingEnvironment() ? 'redirect' : 'live')).toLowerCase();
}

export function stagingEmailRecipient() {
  return process.env.STAGING_EMAIL_RECIPIENT || process.env.DEMO_NOTIFY_EMAIL || '';
}

export function resolveOutboundRecipients(input: string | string[] | undefined | null) {
  const recipients = Array.isArray(input) ? input.filter(Boolean) : input ? [input] : [];
  const mode = emailMode();

  if (mode === 'disabled') {
    return { recipients: [], originalRecipients: recipients, skipped: true };
  }

  if (mode === 'redirect') {
    const redirectTo = stagingEmailRecipient();
    return { recipients: redirectTo ? [redirectTo] : [], originalRecipients: recipients, redirected: true, skipped: !redirectTo };
  }

  return { recipients, originalRecipients: recipients, redirected: false, skipped: recipients.length === 0 };
}

export function stagingEmailBanner(originalRecipients: string[]) {
  if (!isStagingEnvironment()) return '';
  return `<div style="padding:12px 16px;margin-bottom:16px;background:#fef3c7;border:1px solid #f59e0b;border-radius:8px;color:#92400e;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;font-size:13px;line-height:1.5;">
    <strong>STAGING EMAIL — not sent to real client.</strong><br />
    Original recipient(s): ${originalRecipients.length ? originalRecipients.join(', ') : 'none'}
  </div>`;
}

export function stripeCheckoutUrl() {
  if (isStagingEnvironment()) {
    return process.env.NEXT_PUBLIC_STRIPE_TEST_CHECKOUT_URL || '/schedule';
  }

  return process.env.NEXT_PUBLIC_STRIPE_CHECKOUT_URL || 'https://buy.stripe.com/3cI00j9wN8ZQ1Gs90XfrW02';
}
