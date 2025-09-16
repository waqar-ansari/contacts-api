# Complete Payment Flow Documentation

## 🎯 Payment Integration Overview

This document explains the complete payment flow from user action to plan activation, including how Stripe, credits, and upgrades work together.

---

## 📊 Payment Flow Architecture

### 1. **Frontend User Journey**

```
User Dashboard → Plans Page → Select Plan → Payment Options → Payment Processing → Plan Activated
```

### 2. **Backend Payment Flow**

```
API Request → Validation → Cost Calculation → Payment Processing → Plan Update → Response
```

---

## 🔄 Complete Payment Flow (Step by Step)

### **Phase 1: User Initiates Payment**

1. **User Action**: User clicks "Upgrade to Pro" or "Purchase Plan"
2. **Frontend**: Sends request to `/user/payment/create-subscription`
3. **Backend Receives**:
   ```json
   {
     "planId": "plan_123",
     "autoRenewal": true
   }
   ```

### **Phase 2: Cost Calculation & Validation**

4. **Plan Validation**:

   - Check if plan exists and is active
   - Verify user permissions

5. **Current Plan Analysis**:

   - Get user's current plan (if any)
   - Calculate remaining days if upgrading mid-cycle
   - Example: User has 15 days left on $10/month plan

6. **Upgrade Cost Calculation** (if upgrading):

   ```javascript
   // SIMPLIFIED: User pays full price of new plan
   // Remaining days from old plan are stored for later use
   currentPlan = "Pro ($10/month)" // 15 days remaining
   newPlan = "Business ($20/month)"
   upgradeCost = $20.00 // Full price of new plan
   storedDays = 15 // Days from Pro plan stored for future use
   ```

7. **Payment Method Decision** (NO MIXED PAYMENTS):

   ```javascript
   userCredits = $12.00
   upgradeCost = $20.00

   if (userCredits >= upgradeCost) {
     paymentMethod = "credits" // Pay entirely with credits
   } else {
     paymentMethod = "stripe" // Pay entirely with Stripe (no credits used)
   }
   ```

### **Phase 3: Payment Processing**

#### **Scenario A: Credits Only**

8a. **Direct Processing**:

- User has sufficient credits to pay full amount
- Deduct full plan price from user credits
- Store remaining days from previous plan (if upgrading)
- Update user plan immediately
- Store payment record with paymentMethod: "credits"
- Return success response

#### **Scenario B: Stripe Payment Only**

8b. **Stripe Payment Intent Creation**:

```javascript
stripePaymentIntent = {
  amount: 2000, // $20.00 in cents (full plan price)
  currency: "usd",
  metadata: {
    userId: "user_123",
    planId: "plan_456",
    creditUsage: "0", // No credits used in Stripe payments
    finalAmount: "2000",
    isUpgrade: true,
  },
};
```

9b. **Return to Frontend**:

```json
{
  "paymentMethod": "stripe",
  "clientSecret": "pi_xxx_secret_xxx",
  "planDetails": {
    "finalAmount": 2000,
    "upgradeCost": 2000,
    "remainingValue": 0
  },
  "credits": {
    "available": 1200,
    "willUse": 0
  },
  "stripe": {
    "amount": 2000,
    "paymentIntentId": "pi_stripe_123"
  }
}
```

### **Phase 4: Frontend Payment Processing (Stripe)**

10. **Frontend Stripe Integration**:

    ```javascript
    // Frontend JavaScript
    const stripe = Stripe("pk_test_...");

    const { error, paymentIntent } = await stripe.confirmCardPayment(
      clientSecret,
      {
        payment_method: {
          card: cardElement,
          billing_details: { name: "Customer name" },
        },
      }
    );

    if (paymentIntent.status === "succeeded") {
      // Call backend to confirm payment
      confirmPayment(paymentIntent.id);
    }
    ```

### **Phase 5: Payment Confirmation**

11. **Backend Confirmation** (`/user/payment/confirm`):
    - Verify payment with Stripe
    - NO credit deduction (credits not used in Stripe payments)
    - Store remaining days from previous plan (if upgrading)
    - Update user plan and expiry with stored days applied
    - Create payment record with paymentMethod: "stripe"
    - Send success response

### **Phase 6: Plan Activation**

12. **User Plan Update**:

    ```javascript
    // SIMPLIFIED: Store ALL remaining days from previous plan
    if (isUpgrade && oldPlan && remainingDays > 0) {
      user.remainingDays.push({
        planId: oldPlan._id,
        days: remainingDays, // ALL remaining days stored
        storedAt: new Date(),
        planSnapshot: {
          name: "Pro",
          price: 1000, // $10.00 in cents
          pricePeriod: "month",
        },
      });
    }

    // Activate new plan
    user.plan = newPlan._id;
    user.planActivatedAt = new Date();

    // Calculate base expiry + apply stored days from most expensive plan
    const baseExpiry = calculateExpiryDate(new Date(), newPlan.pricePeriod);
    const { newExpiryDate, usedRemainingDays } = applyStoredRemainingDays(
      user,
      baseExpiry
    );

    user.planExpiresAt = newExpiryDate;

    // Credit deduction (only for credits payments)
    if (paymentMethod === "credits") {
      user.creditBalance -= finalAmount;
    }
    ```

---

## 💳 Stripe Integration Details

### **What is Stripe?**

Stripe is a payment processor that handles credit card transactions securely. We never store credit card details - Stripe handles all sensitive data.

### **Key Stripe Concepts:**

1. **Payment Intent**: A Stripe object representing a payment attempt

   - Contains amount, currency, and metadata
   - Has a `client_secret` that frontend uses
   - Tracks payment status (pending → succeeded/failed)

2. **Client Secret**: A secure token that allows frontend to complete payment

   - Safe to send to frontend
   - Cannot be used maliciously
   - Expires after payment completion

3. **Webhooks**: Stripe sends notifications to our server when events occur
   - Payment succeeded/failed
   - Subscription renewed
   - Used as backup if frontend confirmation fails

### **Payment Security:**

- Card details never touch our servers
- Stripe handles PCI compliance
- We only receive payment confirmation
- Webhook signatures verify authenticity

---

## 🔄 Auto-Renewal Flow

### **When Plan Expires:**

1. **Expiry Check** (runs via middleware):

   ```javascript
   if (user.planExpiresAt <= now && user.autoRenewal) {
     // Try to renew with credits ONLY (all or nothing)
     if (user.creditBalance >= currentPlan.price) {
       renewWithCredits(currentPlan.price); // Use full plan price
     } else {
       // TODO: Implement Stripe auto-renewal
       // For now: disable auto-renewal
       console.log(
         "Insufficient credits for auto-renewal. Stripe auto-renewal not yet implemented."
       );
       disableAutoRenewal();
       proceedWithExpiryLogic();
     }
   }
   ```

2. **Remaining Days Logic** (when plan expires):

   ```javascript
   // Apply stored remaining days from most expensive plan
   const mostExpensivePlan = findMostExpensivePlanWithRemainingDays(
     user.remainingDays
   );

   if (mostExpensivePlan) {
     // Extend current plan with stored days
     const newExpiryDate = new Date(baseExpiryDate);
     newExpiryDate.setDate(newExpiryDate.getDate() + mostExpensivePlan.days);

     // Mark those days as used
     user.remainingDays = user.remainingDays
       .map((item) =>
         item.planId === mostExpensivePlan.planId ? { ...item, days: 0 } : item
       )
       .filter((item) => item.days > 0);
   }
   ```

---

## 📈 Dynamic Plans & Remaining Days Logic

### **Problem**: User can upgrade through multiple plans

```
Free → Starter ($5) → Pro ($15) → Business ($30) → Enterprise ($50)
```

### **Solution**: Array of Remaining Days

```javascript
user.remainingDays = [
  {
    planId: "starter_id",
    days: 10,
    planSnapshot: { name: "Starter", price: 500, pricePeriod: "month" },
  },
  {
    planId: "pro_id",
    days: 5,
    planSnapshot: { name: "Pro", price: 1500, pricePeriod: "month" },
  },
];
```

### **Most Expensive Plan Logic**:

```javascript
function findMostExpensivePlanWithRemainingDays(remainingDaysArray) {
  return remainingDaysArray
    .filter((item) => item.days > 0)
    .sort((a, b) => b.planSnapshot.price - a.planSnapshot.price)[0];
}
```

---

## 🗃️ Payment Records (Payment Model)

### **Why We Need Payment Model:**

1. **Audit Trail**: Track all payment attempts and outcomes
2. **User History**: Show users their payment history
3. **Refunds**: Handle refund requests with proper records
4. **Analytics**: Understand revenue, popular plans, etc.
5. **Debugging**: Troubleshoot payment issues

### **Payment Record Example:**

```javascript
{
  paymentId: "PAY_1634567890_abc123",
  userId: "user_123",
  planId: "business_plan_456",
  paymentMethod: "stripe", // OR "credits" (no mixed payments)
  amounts: {
    totalAmount: 2000, // $20.00 (full plan price)
    creditUsed: 0,     // $0.00 (no credits in Stripe payments)
    stripeAmount: 2000, // $20.00 (full amount via Stripe)
    upgradeCost: 2000,  // $20.00 (user pays full price)
    remainingValue: 0   // No value deduction (days stored instead)
  },
  stripe: {
    paymentIntentId: "pi_stripe_123",
    paymentStatus: "succeeded"
  },
  isUpgrade: true,
  previousPlan: {
    planId: "pro_plan",
    remainingDays: 15 // Stored for future use
  },
  newPlan: {
    activatedAt: "2025-09-15T10:30:00Z",
    expiresAt: "2025-10-20T10:30:00Z", // Base expiry + applied stored days
    autoRenewal: true
  },
  status: "completed",
  completedAt: "2025-09-15T10:30:00Z"
}
```

---

## 🚀 Error Handling & Edge Cases

### **Common Scenarios:**

1. **Insufficient Credits + Card Declined**:

   - User has $5 credits, needs $20 plan
   - System shows: "Pay $20 with Stripe" (no partial credit usage)
   - Stripe payment fails
   - Result: Payment fails, user stays on current plan, credits unchanged

2. **Payment Succeeds but Confirmation Fails**:

   - Stripe charges card successfully for full $20
   - Our server crashes before updating user plan
   - Solution: Webhook receives payment success and updates plan
   - No credit deduction needed since Stripe payment was standalone

3. **Multiple Rapid Upgrades**:

   - User upgrades: Starter ($5) → Pro ($15) → Business ($30)
   - Each upgrade: pays full price + stores remaining days from previous plan
   - Final Business plan gets extended by stored days from both Starter and Pro
   - Example: Business expires Oct 30 + 10 days from Pro + 5 days from Starter = Nov 14

4. **Plan Deleted After Payment**:
   - Admin deletes plan while user payment is processing
   - Solution: Store complete plan snapshot in payment record
   - User gets access to deleted plan features until expiry

---

## 🔧 Testing Payment Flow

### **Test Cards (Stripe Test Mode):**

```
Success: 4242424242424242
Decline: 4000000000000002
Insufficient Funds: 4000000000009995
3D Secure: 4000000000003220
```

### **Test Scenarios:**

1. **Credits-only purchase** (user has enough credits)
2. **Stripe-only payment** (user has insufficient credits)
3. **Failed Stripe payment** (card declined)
4. **Mid-cycle upgrade** (store remaining days)
5. **Auto-renewal with credits** (sufficient balance)
6. **Auto-renewal failure** (insufficient credits, Stripe not implemented)
7. **Multiple plan upgrades** (accumulate stored days)
8. **Stored days application** (when plan expires)

---

## 🎯 Summary

The payment system is designed to:

1. **Simple Payment Choice**: User chooses either credits OR Stripe (no mixing)
2. **Fair Upgrade Logic**: User pays full price, unused days stored for future
3. **Dynamic Plan Support**: Handle unlimited plans with intelligent remaining days
4. **Complete Audit Trail**: Track all payments with detailed records
5. **Secure Processing**: Follow Stripe best practices, never store card data
6. **Graceful Failures**: Handle errors without losing user value
7. **Future-Proof**: Easy to add Stripe auto-renewal and new features

### **Key Changes from Previous Version:**

- ❌ **Removed**: Mixed payments (credits + Stripe)
- ❌ **Removed**: Complex daily rate calculations
- ✅ **Added**: Simple "full price" upgrade logic
- ✅ **Added**: Complete remaining days storage system
- ✅ **Added**: Clear separation between payment methods
- ✅ **Added**: Most expensive plan priority for stored days

The core insight: **Simplicity over complexity**. Users pay clear amounts, get clear value, and the system preserves their investment through stored days rather than complex prorations.
