/* ============================================================
   Payment Engine Unit Tests
   ============================================================ */

import test from 'node:test';
import assert from 'node:assert/strict';
import { setupDOMEnvironment } from '../helpers/dom-env.js';

setupDOMEnvironment();

const { paymentGateway, VirtualAccountProvider, CardRailProvider, CryptoRailProvider, getAllTransactions } = await import('../../js/lib/payment-engine.js');

test('Payment: Virtual Account provider initiates dedicated account', async () => {
  const provider = new VirtualAccountProvider();
  const tx = await provider.initiate({
    amount: '500.00',
    currency: 'USD',
    customerEmail: 'test@example.com',
    customerName: 'Acme Corp',
    description: 'Engineering Consulting',
  });

  assert.ok(tx.reference.startsWith('VA-'));
  assert.equal(tx.status, 'PENDING');
  assert.equal(tx.amount, 500);
  assert.ok(tx.details.accountNumber);
  assert.ok(tx.details.bankName);

  // Test simulation
  const confirmed = await provider.simulatePayment(tx.reference);
  assert.equal(confirmed.status, 'SUCCEEDED');
  assert.ok(confirmed.paidAt > 0);
});

test('Payment: Card Rail provider validates card checkout', async () => {
  const provider = new CardRailProvider();
  const tx = await provider.initiate({
    amount: '120.00',
    currency: 'USD',
    customerEmail: 'card@example.com',
    description: 'Digital License',
  });

  assert.ok(tx.reference.startsWith('CRD-'));
  assert.equal(tx.status, 'INITIATED');

  // Process valid card
  const processed = await provider.processCard(tx.reference, {
    cardNumber: '4242 4242 4242 4242',
    expMonth: '12',
    expYear: '28',
    cvc: '123',
    nameOnCard: 'John Doe',
  });

  assert.equal(processed.status, 'SUCCEEDED');
  assert.equal(processed.details.cardBrand, 'Visa');
  assert.equal(processed.details.last4, '4242');
});

test('Payment: Crypto Rail provider generates wallet addresses and lightning invoice', async () => {
  const provider = new CryptoRailProvider();
  const tx = await provider.initiate({
    amount: '1000.00',
    currency: 'USD',
    customerEmail: 'crypto@example.com',
    description: 'Server Hosting Payment',
  });

  assert.ok(tx.reference.startsWith('CRY-'));
  assert.equal(tx.status, 'PENDING');
  assert.ok(tx.details.walletAddress.startsWith('0x'));
  assert.ok(tx.details.lightningInvoice.startsWith('lnbc'));

  // Test simulation
  const confirmed = await provider.simulateConfirmation(tx.reference);
  assert.equal(confirmed.status, 'SUCCEEDED');
  assert.ok(confirmed.details.txHash.startsWith('0x'));
});

test('Payment: PaymentGateway routes requests across rails', async () => {
  const tx = await paymentGateway.initiate({
    amount: '250.00',
    currency: 'USD',
    rail: 'virtual-account',
    customerEmail: 'gw@example.com',
    description: 'Gateway test',
  });

  assert.ok(tx.reference);
  const found = await paymentGateway.verify(tx.reference);
  assert.equal(found.reference, tx.reference);
});
