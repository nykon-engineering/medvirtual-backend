import Stripe from 'stripe';
const s = new Stripe('sk_test_123');
s.invoices.create({
  customer: 'cus_123',
  discounts: [{
    // @ts-ignore
    coupon: { percent_off: 10 }
  }]
});
