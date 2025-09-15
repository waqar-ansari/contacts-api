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
2. **Frontend**: Sends request to `/user/payment/create-intent`
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
   // Example calculation
   currentPlan = $10/month = $0.33/day
   remainingValue = 15 days × $0.33 = $5.00
   newPlan = $20/month
   upgradeCost = $20.00 - $5.00 = $15.00
   ```

7. **Payment Method Decision**:

   ```javascript
   userCredits = $12.00
   upgradeCost = $15.00

   if (userCredits >= upgradeCost) {
     paymentMethod = "credits_only"
   } else {
     creditsToUse = $12.00
     stripeAmount = $15.00 - $12.00 = $3.00
     paymentMethod = "mixed" // credits + stripe
   }
   ```

### **Phase 3: Payment Processing**

#### **Scenario A: Credits Only (No Stripe Needed)**

8a. **Direct Processing**:

- Deduct credits from user account
- Update user plan immediately
- Store payment record
- Return success response

#### **Scenario B: Stripe Payment Required**

8b. **Stripe Payment Intent Creation**:

```javascript
stripePaymentIntent = {
  amount: 300, // $3.00 in cents
  currency: "usd",
  metadata: {
    userId: "user_123",
    planId: "plan_456",
    creditUsage: 1200, // $12.00 in cents
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
    "upgradeCost": 1500,
    "creditsUsed": 1200,
    "stripeAmount": 300
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
    - Deduct credits from user account
    - Update user plan and expiry
    - Store remaining days for future upgrades
    - Create payment record
    - Send success response

### **Phase 6: Plan Activation**

12. **User Plan Update**:

    ```javascript
    // Store remaining days from previous plan
    user.remainingDays.push({
      planId: oldPlan._id,
      days: 15,
      planSnapshot: {
        name: "Starter",
        price: 1000, // $10.00 in cents
        pricePeriod: "month",
      },
    });

    // Activate new plan
    user.plan = newPlan._id;
    user.planActivatedAt = new Date();
    user.planExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days
    user.creditBalance -= creditsUsed;
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
     // Try to renew with credits
     if (user.creditBalance >= currentPlan.price) {
       renewWithCredits();
     } else {
       // Could charge Stripe here (future enhancement)
       disableAutoRenewal();
       revertToStarter();
     }
   }
   ```

2. **Remaining Days Logic** (when reverting to Starter):

   ```javascript
   // User had remaining days from previous plans
   // Find most expensive plan with remaining days
   const mostExpensivePlan = findMostExpensivePlanWithRemainingDays(
     user.remainingDays
   );

   if (mostExpensivePlan) {
     // Apply those days to extend current plan
     extendPlanBy(mostExpensivePlan.days);
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
  planId: "pro_plan_456",
  paymentMethod: "mixed",
  amounts: {
    totalAmount: 2000, // $20.00
    creditUsed: 1200,  // $12.00
    stripeAmount: 800, // $8.00
    upgradeCost: 2000,
    remainingValue: 500 // $5.00 from previous plan
  },
  stripe: {
    paymentIntentId: "pi_stripe_123",
    paymentStatus: "succeeded"
  },
  isUpgrade: true,
  previousPlan: {
    planId: "starter_plan",
    remainingDays: 15
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
   - Stripe payment for $15 fails
   - Result: Payment fails, user stays on current plan

2. **Payment Succeeds but Confirmation Fails**:

   - Stripe charges card successfully
   - Our server crashes before updating user plan
   - Solution: Webhook receives payment success and updates plan

3. **Multiple Rapid Upgrades**:

   - User upgrades from Free → Pro → Business quickly
   - Each upgrade stores remaining days from previous plan
   - Final plan gets benefit of all stored days

4. **Plan Deleted After Payment**:
   - Admin deletes plan while user payment is processing
   - Solution: Store plan snapshot in payment record

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

1. Credits-only purchase
2. Mixed payment (credits + Stripe)
3. Pure Stripe payment
4. Failed payment
5. Mid-cycle upgrade
6. Auto-renewal with credits
7. Multiple plan upgrades

---

## 🎯 Summary

The payment system is designed to:

1. **Prioritize Credits**: Always use user credits first
2. **Handle Complexity**: Support any number of dynamic plans
3. **Track Everything**: Complete audit trail of all payments
4. **Be Secure**: Follow Stripe best practices
5. **Handle Failures**: Graceful error handling and recovery
6. **Support Growth**: Easily add new payment features

The key insight is that payments are not just "charge money" - they involve complex business logic around prorations, credits, plan upgrades, and ensuring users get fair value for their money.
