// Payment receiving must be backed by an authenticated merchant service.
// Never generate receiving accounts or payment confirmations in the browser.
export const PAYMENT_SETUP_REQUIRED = 'Payment receiving is not configured. Use your payment provider’s hosted checkout until Toolbox has a verified merchant integration.';

export class PaymentProvider {
  async initiate() { throw new Error(PAYMENT_SETUP_REQUIRED); }
  async verify() { throw new Error(PAYMENT_SETUP_REQUIRED); }
  async cancel() { throw new Error(PAYMENT_SETUP_REQUIRED); }
  async handleWebhook() { throw new Error(PAYMENT_SETUP_REQUIRED); }
}

// Keep callers compatible while failing closed for every unconfigured rail.
export class VirtualAccountProvider extends PaymentProvider {}
export class CardRailProvider extends PaymentProvider {}
export class CryptoRailProvider extends PaymentProvider {}
export const paymentGateway = new PaymentProvider();

// Earlier versions saved simulated transactions locally. They are not receipts
// and must never be returned as verified transactions. Leave stored data intact.
export function getAllTransactions() { return []; }
