import test from 'node:test';
import assert from 'node:assert/strict';
import { paymentGateway, VirtualAccountProvider, CardRailProvider, CryptoRailProvider, getAllTransactions } from '../../js/lib/payment-engine.js';

for (const Provider of [VirtualAccountProvider, CardRailProvider, CryptoRailProvider]) {
  test(`Payment: ${Provider.name} cannot fabricate receiving details`, async () => {
    await assert.rejects(new Provider().initiate({ amount: '500', currency: 'NGN' }), /not configured/);
  });
}
test('Payment: local records cannot verify a payment or appear as receipts', async () => {
  await assert.rejects(paymentGateway.verify('VA-OLD-DEMO'), /not configured/);
  assert.deepEqual(getAllTransactions(), []);
});
