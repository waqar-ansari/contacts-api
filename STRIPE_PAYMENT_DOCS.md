# Stripe Payment Integration Documentation

## Overview

This implementation provides a complete Stripe payment system for plan subscriptions with the following features:

### Features Implemented:

1. **Plan Purchase/Upgrade** - Users can purchase or upgrade plans
2. **Credits First Logic** - Always tries to use user credits before charging Stripe
3. **Mid-cycle Upgrades** - Calculates remaining days and upgrade costs
4. **Auto-renewal** - Users can enable/disable auto-renewal
5. **Remaining Days Storage** - Preserves unused days from previous plans
6. **Sandbox Environment** - Configured for testing

## API Endpoints

### User Payment Routes

All routes require authentication (`checkForAuthentication` middleware)

#### 1. Get Payment Status

```
GET /user/payment/status
```

Returns current plan, expiry, credits, auto-renewal status, etc.

#### 2. Create Payment Intent

```
POST /user/payment/create-intent
Body: {
  "planId": "plan_object_id",
  "autoRenewal": false // optional
}
```

Returns either:

- `paymentMethod: "credits"` - Can pay entirely with credits
- `paymentMethod: "stripe"` - Requires Stripe payment with `clientSecret`

#### 3. Purchase with Credits Only

```
POST /user/payment/purchase-with-credits
Body: {
  "planId": "plan_object_id",
  "autoRenewal": false // optional
}
```

Immediately processes payment using user credits only.

#### 4. Confirm Stripe Payment

```
POST /user/payment/confirm
Body: {
  "paymentIntentId": "pi_stripe_payment_intent_id"
}
```

Call after successful Stripe payment to update user plan.

#### 5. Toggle Auto-renewal

```
PATCH /user/payment/auto-renewal
Body: {
  "autoRenewal": true/false
}
```

### Webhook Endpoint

```
POST /webhooks/stripe
```

Handles Stripe webhook events (payment success/failure, etc.)

## Configuration

### Environment Variables

Add these to your `.env` file:

```env
# Stripe Test Keys (for sandbox)
STRIPE_PUBLISHABLE_KEY=pk_test_51JM78KBtOBT8b78e...
STRIPE_SECRET_KEY=sk_test_51JM78KBtOBT8b78e...
STRIPE_WEBHOOK_SECRET=whsec_... (from Stripe Dashboard)



## Database Changes

### User Model Updates

Added new fields to user schema:

- `autoRenewal: Boolean` - Auto-renewal preference
- `remainingDays: Number` - Stored remaining days from previous plan

## Logic Flow

### Plan Purchase Flow:

1. User selects a plan
2. System calculates cost (considering mid-cycle upgrade)
3. Check if user has sufficient credits
4. If yes → Process with credits only
5. If no → Create Stripe payment intent for remaining amount
6. After Stripe payment → Update user plan

### Mid-cycle Upgrade Logic:

1. Calculate remaining days in current plan
2. Calculate remaining value (daily rate × remaining days)
3. New plan cost = Full plan price - remaining value
4. Store remaining days for future use

### Auto-renewal Logic:

1. When plan expires, check if auto-renewal is enabled
2. Try to renew with user credits first
3. If insufficient credits, disable auto-renewal and revert to Starter
4. Can be extended to charge Stripe for renewal in future

## Testing

### Using Test Cards

Use Stripe test cards for testing:

- Success: `4242424242424242`
- Decline: `4000000000000002`
- Insufficient funds: `4000000000009995`

### Webhook Testing

1. Use Stripe CLI for local webhook testing:

```bash
stripe listen --forward-to localhost:3000/webhooks/stripe
```

2. Copy webhook signing secret to `.env`

## Security Notes

1. **Webhook Verification**: All webhooks verify Stripe signature
2. **Test Environment**: Currently configured for sandbox/test mode
3. **Raw Body**: Webhook endpoint receives raw body for signature verification
4. **Authentication**: All user endpoints require valid JWT token

## Future Enhancements

1. **Subscription Management**: Full subscription lifecycle with Stripe
2. **Prorations**: Automatic prorations for mid-cycle changes
3. **Invoice Management**: Store and manage invoices
4. **Failed Payment Retry**: Automatic retry logic for failed payments
5. **Plan Cancellation**: Implement plan cancellation with refunds

## Error Handling

All endpoints return standard error responses:

```json
{
  "success": false,
  "message": "Error description",
  "error": "Detailed error message"
}
```

Common error scenarios handled:

- Insufficient credits
- Invalid plan ID
- Payment failures
- Plan validation errors
- Webhook verification failures
