# Admin Coupon Management API Documentation

## Overview

This API provides CRUD operations for coupon management, accessible only to superadmin users. Coupons can have either percentage-based or fixed amount discounts.

## Base URL

```
/admin/coupons
```

## Authentication

All endpoints require:

- Authentication token (Bearer token)
- Superadmin role

## Endpoints

### 1. Get All Coupons

**GET** `/admin/coupons`

**Query Parameters:**

- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 10)
- `sortBy` (optional): Field to sort by (default: "createdAt")
- `sortOrder` (optional): "asc" or "desc" (default: "desc")
- `search` (optional): Search in name or coupon code
- `isActive` (optional): Filter by active status ("true" or "false")
- `discountType` (optional): Filter by discount type ("percentage" or "fixed")

**Response:**

```json
{
  "success": true,
  "data": [
    {
      "_id": "coupon_id",
      "name": "Black Friday Sale",
      "couponCode": "BLACKFRIDAY2024",
      "discountType": "percentage",
      "discountValue": 25,
      "expiryDate": "2024-11-30T23:59:59.000Z",
      "isActive": true,
      "usageCount": 15,
      "maxUsage": 1000,
      "createdBy": {
        "_id": "user_id",
        "firstName": "Super",
        "lastName": "Admin",
        "email": "superadmin@example.com"
      },
      "createdAt": "2024-10-01T00:00:00.000Z",
      "updatedAt": "2024-10-01T00:00:00.000Z"
    }
  ],
  "pagination": {
    "currentPage": 1,
    "totalPages": 5,
    "totalItems": 50,
    "itemsPerPage": 10,
    "hasNextPage": true,
    "hasPrevPage": false
  }
}
```

### 2. Get Coupon by ID

**GET** `/admin/coupons/:id`

**Response:**

```json
{
  "success": true,
  "data": {
    "_id": "coupon_id",
    "name": "Black Friday Sale",
    "couponCode": "BLACKFRIDAY2024",
    "discountType": "percentage",
    "discountValue": 25,
    "expiryDate": "2024-11-30T23:59:59.000Z",
    "isActive": true,
    "usageCount": 15,
    "maxUsage": 1000,
    "createdBy": {
      "_id": "user_id",
      "firstName": "Super",
      "lastName": "Admin",
      "email": "superadmin@example.com"
    },
    "createdAt": "2024-10-01T00:00:00.000Z",
    "updatedAt": "2024-10-01T00:00:00.000Z"
  }
}
```

### 3. Create New Coupon

**POST** `/admin/coupons`

**Request Body:**

```json
{
  "name": "Black Friday Sale",
  "couponCode": "BLACKFRIDAY2024",
  "discountType": "percentage",
  "discountValue": 25,
  "expiryDate": "2024-11-30T23:59:59.000Z",
  "maxUsage": 1000,
  "isActive": true
}
```

**Required Fields:**

- `name`: String - Coupon name
- `couponCode`: String - Unique coupon code (will be converted to uppercase)
- `discountType`: String - "percentage" or "fixed"
- `discountValue`: Number - Discount value (0-100 for percentage, any positive number for fixed)
- `expiryDate`: Date - Must be in the future

**Optional Fields:**

- `maxUsage`: Number - Maximum usage limit (null for unlimited)
- `isActive`: Boolean - Default: true

**Response:**

```json
{
  "success": true,
  "message": "Coupon created successfully",
  "data": {
    "_id": "coupon_id",
    "name": "Black Friday Sale",
    "couponCode": "BLACKFRIDAY2024",
    "discountType": "percentage",
    "discountValue": 25,
    "expiryDate": "2024-11-30T23:59:59.000Z",
    "isActive": true,
    "usageCount": 0,
    "maxUsage": 1000,
    "createdBy": "user_id",
    "createdAt": "2024-10-01T00:00:00.000Z",
    "updatedAt": "2024-10-01T00:00:00.000Z"
  }
}
```

### 4. Update Coupon

**PUT** `/admin/coupons/:id`

**Request Body:** (All fields optional)

```json
{
  "name": "Updated Black Friday Sale",
  "couponCode": "NEWBLACKFRIDAY2024",
  "discountType": "fixed",
  "discountValue": 50,
  "expiryDate": "2024-12-31T23:59:59.000Z",
  "maxUsage": 500,
  "isActive": false
}
```

**Response:**

```json
{
  "success": true,
  "message": "Coupon updated successfully",
  "data": {
    // Updated coupon object
  }
}
```

### 5. Delete Coupon

**DELETE** `/admin/coupons/:id`

**Response:**

```json
{
  "success": true,
  "message": "Coupon deleted successfully",
  "deletedCoupon": {
    "id": "coupon_id",
    "name": "Black Friday Sale",
    "couponCode": "BLACKFRIDAY2024"
  }
}
```

### 6. Toggle Coupon Status

**PATCH** `/admin/coupons/:id/status`

Toggles the `isActive` status of a coupon.

**Response:**

```json
{
  "success": true,
  "message": "Coupon activated successfully",
  "data": {
    // Updated coupon object
  }
}
```

### 7. Get Coupon Statistics

**GET** `/admin/coupons/stats`

**Response:**

```json
{
  "success": true,
  "data": {
    "overview": {
      "total": 100,
      "active": 85,
      "inactive": 15,
      "expired": 10
    },
    "byType": {
      "percentage": 60,
      "fixed": 40
    },
    "mostUsed": [
      {
        "_id": "coupon_id",
        "name": "Summer Sale",
        "couponCode": "SUMMER2024",
        "usageCount": 250,
        "discountType": "percentage",
        "discountValue": 20
      }
    ]
  }
}
```

## Error Responses

### 400 Bad Request

```json
{
  "success": false,
  "message": "Validation error",
  "errors": ["Error message 1", "Error message 2"]
}
```

### 401 Unauthorized

```json
{
  "success": false,
  "message": "Authentication required"
}
```

### 403 Forbidden

```json
{
  "success": false,
  "message": "Access denied"
}
```

### 404 Not Found

```json
{
  "success": false,
  "message": "Coupon not found"
}
```

### 500 Internal Server Error

```json
{
  "success": false,
  "message": "Server error",
  "error": "Error details"
}
```

## Validation Rules

### Coupon Code

- Must be unique across all coupons
- Automatically converted to uppercase
- Cannot be empty

### Discount Value

- For percentage discounts: Must be between 0 and 100
- For fixed discounts: Must be greater than or equal to 0
- Cannot be negative

### Expiry Date

- Must be in the future
- Cannot be in the past

### Max Usage

- If provided, must be a positive integer
- If null or not provided, coupon has unlimited usage

## Coupon Model Virtual Properties

The coupon model includes virtual properties for convenience:

- `isExpired`: Boolean indicating if the coupon has passed its expiry date
- `isAvailable`: Boolean indicating if the coupon is active, not expired, and hasn't reached usage limit

## Usage Example with cURL

### Create a new coupon:

```bash
curl -X POST http://localhost:3000/admin/coupons \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "name": "New Year Special",
    "couponCode": "NEWYEAR2024",
    "discountType": "percentage",
    "discountValue": 30,
    "expiryDate": "2024-01-31T23:59:59.000Z",
    "maxUsage": 500
  }'
```

### Get all coupons with filtering:

```bash
curl -X GET "http://localhost:3000/admin/coupons?page=1&limit=20&search=NEW&isActive=true&discountType=percentage" \
  -H "Authorization: Bearer YOUR_TOKEN"
```
