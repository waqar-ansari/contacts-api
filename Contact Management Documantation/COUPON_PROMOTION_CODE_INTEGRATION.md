# Coupon and Promotion Code Integration

## Overview

This system automatically creates **Stripe Promotion Codes** whenever you create or update coupons through the admin panel. This ensures that coupons work seamlessly with Stripe's hosted checkout.

## How It Works

### 🎯 **The Problem Solved**

- **Before**: Creating coupons via admin panel only created Stripe coupons
- **Issue**: Hosted checkout requires "promotion codes" to recognize coupons
- **Solution**: Automatically create promotion codes for every coupon

### 🔄 **Automatic Workflow**

#### **Creating a Coupon:**

1. Admin creates coupon via admin panel
2. System creates **Stripe Coupon** (discount rules)
3. System creates **Stripe Promotion Code** (customer-facing code)
4. System stores both IDs in MongoDB
5. ✅ Coupon now works in hosted checkout!

#### **Updating a Coupon:**

1. Admin updates coupon details
2. System creates new Stripe coupon (coupons are immutable)
3. System deactivates old promotion code
4. System creates new promotion code with updated details
5. ✅ Changes reflected in hosted checkout immediately!

#### **Deleting a Coupon:**

1. Admin deletes coupon
2. System deactivates promotion code
3. System deletes Stripe coupon
4. System removes MongoDB record
5. ✅ Coupon no longer available anywhere!

### 🗄️ **Database Schema Updates**

Added new field to `couponModel.js`:

```javascript
stripePromotionCodeId: {
  type: String,
  unique: true,
  sparse: true,
  index: true,
}
```

### 🛠️ **New Utility Functions**

Added to `stripeUtils.js`:

- `createStripePromotionCode()`
- `updateStripePromotionCode()`
- `deleteStripePromotionCode()`

### 📊 **Admin Panel Integration**

**Routes Updated:**

- `POST /api/admin/coupons` - Creates coupon + promotion code
- `PUT /api/admin/coupons/:id` - Updates both coupon and promotion code
- `DELETE /api/admin/coupons/:id` - Deletes both
- `PATCH /api/admin/coupons/:id/status` - Toggles both (now enabled)

### 🔄 **Migration**

For existing coupons, run:

```bash
node migrations/addPromotionCodesToExistingCoupons.js
```

This will:

- Find active coupons without promotion codes
- Create promotion codes for them
- Update the database with new IDs

### ✅ **Testing the Integration**

1. **Create a coupon** via admin panel
2. **Check Stripe Dashboard**:
   - Should see both coupon and promotion code
   - Promotion code should have same name as coupon
3. **Test hosted checkout**:
   - Enter the coupon code in "promotion code" field
   - Should apply discount correctly
4. **Update the coupon**:
   - Old promotion code should be deactivated
   - New promotion code should be created

### 🚀 **Benefits**

- ✅ **Seamless Integration**: Coupons work automatically in hosted checkout
- ✅ **No Manual Work**: Promotion codes created automatically
- ✅ **Consistent Naming**: Promotion code matches coupon code
- ✅ **Full Lifecycle Management**: Create, update, delete all handled
- ✅ **Error Handling**: Rollback if any step fails
- ✅ **Migration Support**: Existing coupons can be migrated

### 🔍 **Troubleshooting**

**Issue**: Coupon not appearing in hosted checkout
**Solution**: Check if `stripePromotionCodeId` exists in database

**Issue**: Promotion code creation fails
**Solution**: Check Stripe dashboard for duplicate codes, system will clean up automatically

**Issue**: Old coupons not working
**Solution**: Run the migration script to add promotion codes

### 📝 **Technical Notes**

- **Stripe Coupons**: Define discount rules (immutable once created)
- **Stripe Promotion Codes**: Customer-facing codes that apply coupons
- **Relationship**: One coupon can have multiple promotion codes, but we use 1:1 mapping
- **Hosted Checkout**: Only recognizes promotion codes, not direct coupon IDs
- **Error Handling**: If promotion code creation fails, the entire coupon creation is rolled back
