# Plan Management System Implementation

## Overview

This implementation adds a comprehensive plan management system with automatic trial management, credit-based upgrades, and automated plan expiry handling.

## Changes Made

### 1. User Model Updates (`models/userModel.js`)

- Added `hasUsedProTrial` field to track if user has used their free Pro trial

### 2. Plan Utilities (`utils/planUtils.js`)

**Functions added:**

- `getDefaultPlan()` - Gets Pro plan if available, otherwise first active plan
- `getStarterPlan()` - Gets Starter plan
- `getProPlan()` - Gets Pro plan
- `setupInitialPlan(user, plan)` - Sets up initial plan for new users with proper trial periods
- `checkAndHandlePlanExpiry(user)` - Handles plan expiry, credit upgrades, and reversion to Starter
- `validateAndUpdatePlanStatus(userId)` - Validates and updates a user's plan status

### 3. Plan Scheduler (`utils/planScheduler.js`)

- `checkAllExpiredPlans()` - Checks all users for expired plans
- `startPlanExpiryScheduler()` - Starts daily cron job at 2 AM
- `manualPlanExpiryCheck()` - Manual trigger for plan expiry checks

### 4. Plan Validation Middleware (`middlewares/planValidation.js`)

- `checkPlanStatus()` - Middleware to validate user plan status on each request

### 5. User Controller Updates (`controllers/userControllers.js`)

**Updated signup methods:**

- `signupWithEmail` - Uses plan utilities instead of hardcoded Pro plan
- `signupWithPhoneNumber` - Uses plan utilities
- `googleCallback` - Uses plan utilities for Google OAuth
- `linkedinCallback` - Uses plan utilities for LinkedIn OAuth

**Changes:**

- All signup methods now use `setupInitialPlan()` utility
- Pro trial usage is marked when Pro plan is assigned
- Removed hardcoded Pro plan assignments

### 6. GetUser Controller Updates (`controllers/getUserControllers.js`)

- Added plan validation import
- Plan validation happens via middleware (cleaner approach)

### 7. GetUser Routes Updates (`routes/getUserRoutes.js`)

- Added authentication and plan validation middlewares
- Plan status is checked on every user data fetch

### 8. Admin Routes (`routes/admin/planExpiryCheckRoutes.js`)

- Added admin endpoint to manually trigger plan expiry checks
- Restricted to superadmin role

### 9. Test Routes (`routes/testRoutes.js`)

- Added test endpoints to verify plan utilities are working
- `/test/plan-utils` - Tests all plan utility functions
- `/test/validate-plan` - Tests plan validation for authenticated user

### 10. Main App Updates (`index.js`)

- Added plan expiry scheduler startup
- Added new routes for admin plan checks and testing
- Added node-cron dependency to package.json

## System Flow

### New User Signup:

1. User signs up via any method (email, phone, Google, LinkedIn)
2. `setupInitialPlan()` is called to assign default plan
3. If Pro plan is assigned, 14-day trial is set
4. `hasUsedProTrial` flag is set to true if Pro plan assigned
5. User gets immediate access to Pro features

### Plan Expiry Handling:

1. Daily cron job checks all users with expired plans
2. For each expired user:
   - If has 10+ credits: Auto-upgrade to Pro for 30 days (paid)
   - Otherwise: Revert to Starter plan
3. Manual admin trigger available for immediate checks

### API Request Flow:

1. User makes authenticated API request
2. Plan validation middleware checks for expiry
3. If expired, handles according to credit/reversion logic
4. Request continues with updated plan status

## Key Features

### Automatic Trial Management:

- Pro plan gets 14-day trial by default
- Trial usage is tracked to prevent abuse
- Automatic reversion to Starter after trial

### Credit-Based Upgrades:

- Users with sufficient credits auto-upgrade when plan expires (based on actual Pro plan price)
- Credits are deducted based on Pro plan price (price in cents converted to dollar credits)
- Paid Pro subscriptions last 30 days

### Flexible Plan Assignment:

- Prefers Pro plan but falls back to any available active plan
- Handles missing plans gracefully
- Starter plan never expires

### Admin Controls:

- Manual plan expiry checks
- Comprehensive testing endpoints
- Detailed logging and error handling

### Error Handling:

- Graceful fallbacks for missing plans
- Comprehensive error logging
- Non-blocking plan validation

## Database Considerations

### Required Plans:

The system expects these plans to exist in the database:

- **Starter** (free, price: 0) - Default fallback plan
- **Pro** - Default trial plan with 14-day trial
- **Business** - Available for assignment

### Migration Notes:

- Existing users will get `hasUsedProTrial: false` by default
- Plan validation will run on their next API request
- No immediate database migration required

## Configuration

### Scheduler:

- Runs daily at 2:00 AM
- Can be customized by modifying cron expression in `planScheduler.js`

### Credit System:

- Credits required = Pro plan price (in cents) / 100 (converted to dollar credits)
- Dynamically calculated based on actual Pro plan pricing in database
- Configurable in `checkAndHandlePlanExpiry()` function

### Trial Period:

- Default: 14 days for Pro plan
- Configurable in `setupInitialPlan()` function

## Testing

### Endpoints Available:

- `GET /test/plan-utils` - Test all plan utility functions
- `POST /test/validate-plan` - Test plan validation (requires auth)
- `POST /admin/plan-expiry-check` - Manual expiry check (superadmin only)

### Recommended Testing:

1. Create test users with different plans
2. Manually expire plans by setting `planExpiresAt` to past date
3. Call validation endpoints to verify behavior
4. Test credit-based upgrades with users having sufficient credits

## Dependencies Added:

- `node-cron: ^3.0.3` - For scheduled plan expiry checks

## Notes:

- All changes are backward compatible
- Existing users will seamlessly transition to new system
- No frontend changes required in this phase
- System is designed to handle edge cases gracefully
