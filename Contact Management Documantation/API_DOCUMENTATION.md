# Contacts Management API Documentation

## Table of Contents
1. [Overview](#overview)
2. [Base URL](#base-url)
3. [Authentication](#authentication)
4. [Error Handling](#error-handling)
5. [API Endpoints](#api-endpoints)
   - [User Authentication](#user-authentication)
   - [User Management](#user-management)
   - [Contact Management](#contact-management)
   - [Tag Management](#tag-management)
   - [Payment Management](#payment-management)
   - [Admin Management](#admin-management)
   - [Contact Import & Integration](#contact-import--integration)
   - [Scan & QR Code](#scan--qr-code)
   - [Reminders & Tasks](#reminders--tasks)
   - [Email & Communication](#email--communication)
   - [Account Management](#account-management)
   - [Other Endpoints](#other-endpoints)

## Overview

The Contacts Management API is a comprehensive REST API for managing contacts, user authentication, and subscription plans. It supports multiple authentication methods including email/password, Google OAuth, Apple Sign-In, and LinkedIn OAuth.

## Base URL

**Production:** `https://100rjobf76.execute-api.eu-north-1.amazonaws.com`  
**Local Development:** `http://localhost:3000`

## Authentication

The API uses JWT (JSON Web Token) based authentication. Include the token in the Authorization header:

```
Authorization: Bearer <your_jwt_token>
```

### Authentication Levels

1. **No Authentication Required**: Public endpoints (signup, login, password reset)
2. **User Authentication Required**: Most endpoints require valid JWT token
3. **Admin Authentication Required**: Admin-only endpoints require both authentication and admin role

## Error Handling

All API responses follow a consistent format:

### Success Response
```json
{
  "status": "success",
  "message": "Operation completed successfully",
  "data": {
    // Response data
  }
}
```

### Error Response
```json
{
  "status": "error",
  "message": "Error description",
  "error": "Detailed error message"
}
```

### HTTP Status Codes
- `200` - Success
- `201` - Created
- `400` - Bad Request
- `401` - Unauthorized
- `403` - Forbidden
- `404` - Not Found
- `409` - Conflict
- `500` - Internal Server Error

---

## API Endpoints

## User Authentication

### 1. User Signup with Email

**Endpoint:** `POST /user/signup/email`

**Description:** Register a new user with email and password

**Authentication:** Not required

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "securePassword123",
  "firstname": "John",
  "lastname": "Doe",
  "referralCode": "abc123def456" // Optional
}
```

**Response:**
```json
{
  "status": "success",
  "message": "Signup started. Please verify your email to activate your account.",
  "data": {
    "_id": "user_id",
    "email": "user@example.com",
    "registeredWith": "email",
    "referUrl": "https://app.contacts.management/register?ref=user_referral_code"
  }
}
```

### 2. User Signup with Phone Number

**Endpoint:** `POST /user/signup/phoneNumber`

**Description:** Register a new user with phone number and password

**Authentication:** Not required

**Request Body:**
```json
{
  "countryCode": "91",
  "phonenumber": "9876543210",
  "password": "securePassword123",
  "firstname": "John",
  "lastname": "Doe",
  "referralCode": "abc123def456", // Optional
  "apiType": "mobile" // "mobile" or "web"
}
```

**Response:**
```json
{
  "status": "pending",
  "message": "OTP sent to your WhatsApp number"
}
```

### 3. Verify Phone OTP

**Endpoint:** `POST /user/signup/phoneNumber`

**Description:** Complete phone number signup by verifying OTP

**Authentication:** Not required

**Request Body:**
```json
{
  "countryCode": "91",
  "phonenumber": "9876543210",
  "password": "securePassword123",
  "firstname": "John",
  "lastname": "Doe",
  "otp": "123456"
}
```

**Response:**
```json
{
  "status": "success",
  "message": "Phone signup completed successfully",
  "data": {
    "_id": "user_id",
    "token": "jwt_token",
    "registeredWith": "phoneNumber",
    "referUrl": "https://app.contacts.management/register?ref=user_referral_code"
  }
}
```

### 4. Email Verification

**Endpoint:** `POST /user/signup/email`

**Description:** Verify email address using verification token

**Authentication:** Not required

**Request Body:**
```json
{
  "verifyToken": "verification_token_from_email"
}
```

**Response:**
```json
{
  "status": "success",
  "message": "Email verified successfully. You can now log in.",
  "data": {
    "token": "jwt_token",
    "registeredWith": "email"
  }
}
```

### 5. Resend Verification Email

**Endpoint:** `POST /user/resendVerificationLink`

**Description:** Resend email verification link

**Authentication:** Not required

**Request Body:**
```json
{
  "email": "user@example.com"
}
```

**Response:**
```json
{
  "status": "success",
  "message": "Verification email resent successfully",
  "verificationLink": "https://app.contacts.management/user-verification?verificationToken=token"
}
```

### 6. Unified Login

**Endpoint:** `POST /user/login`

**Description:** Login with email/password, Google token, or Apple token

**Authentication:** Not required

**Request Body (Email/Password):**
```json
{
  "email": "user@example.com",
  "password": "securePassword123"
}
```

**Request Body (Phone/Password):**
```json
{
  "phonenumber": "9876543210",
  "countryCode": "91",
  "password": "securePassword123",
  "apiType": "mobile"
}
```

**Request Body (Google):**
```json
{
  "googleToken": "google_id_token"
}
```

**Request Body (Apple):**
```json
{
  "appleToken": "apple_id_token"
}
```

**Response:**
```json
{
  "status": "success",
  "message": "Login successful",
  "data": {
    "token": "jwt_token",
    "hasAccess": true,
    "isTrialActive": true,
    "isPremium": false,
    "trialEndsAt": "2024-01-15T00:00:00.000Z",
    "registeredWith": "email",
    "role": "user"
  }
}
```

### 7. Google OAuth Login

**Endpoint:** `GET /user/google/login`

**Description:** Get Google OAuth URL for login

**Authentication:** Not required

**Query Parameters:**
- `ref` (optional): Referral code

**Response:**
```json
{
  "status": "success",
  "message": "Google OAuth URL generated",
  "url": "https://accounts.google.com/oauth/authorize?..."
}
```

### 8. Google OAuth Callback

**Endpoint:** `GET /user/google/callback`

**Description:** Handle Google OAuth callback

**Authentication:** Not required

**Query Parameters:**
- `code`: Authorization code from Google
- `state`: State parameter containing referral code

**Response:** HTML page that posts message to parent window

### 9. LinkedIn OAuth Login

**Endpoint:** `GET /user/linkedin/login`

**Description:** Get LinkedIn OAuth URL for login

**Authentication:** Not required

**Query Parameters:**
- `ref` (optional): Referral code

**Response:**
```json
{
  "status": "success",
  "message": "LinkedIn OAuth URL generated",
  "url": "https://www.linkedin.com/oauth/v2/authorization?..."
}
```

### 10. LinkedIn OAuth Callback

**Endpoint:** `GET /user/linkedin/callback`

**Description:** Handle LinkedIn OAuth callback

**Authentication:** Not required

**Query Parameters:**
- `code`: Authorization code from LinkedIn
- `state`: State parameter containing referral code

**Response:** HTML page that posts message to parent window

### 11. Logout

**Endpoint:** `POST /user/logout`

**Description:** Logout user and mark as inactive

**Authentication:** Required

**Response:**
```json
{
  "message": "Logout successful"
}
```

---

## User Management

### 12. Get User Data

**Endpoint:** `POST /getUser`

**Description:** Get authenticated user's data

**Authentication:** Required

**Response:**
```json
{
  "status": "success",
  "message": "User data retrieved successfully",
  "data": {
    "_id": "user_id",
    "firstname": "John",
    "lastname": "Doe",
    "email": "user@example.com",
    "phonenumbers": [
      {
        "countryCode": "91",
        "number": "9876543210"
      }
    ],
    "profileImageURL": "https://example.com/profile.jpg",
    "isPremium": false,
    "trialEnd": "2024-01-15T00:00:00.000Z",
    "creditBalance": 0,
    "referralCode": "abc123def456",
    "tags": [
      {
        "tag_id": "tag_id",
        "tag": "Family",
        "emoji": "🖤"
      }
    ],
    "whatsappTemplates": [
      {
        "whatsappTemplate_id": "template_id",
        "whatsappTemplateTitle": "Welcome Message",
        "whatsappTemplateMessage": "Hey {{firstName}}! 👋 Welcome...",
        "whatsappTemplateIsFavourite": true
      }
    ],
    "emailTemplates": [
      {
        "emailTemplate_id": "template_id",
        "emailTemplateTitle": "Welcome Email",
        "emailTemplateSubject": "Welcome to Our Platform!",
        "emailTemplateBody": "Hi {{firstName}}...",
        "emailTemplateIsFavourite": true
      }
    ]
  }
}
```

### 13. Edit User Profile

**Endpoint:** `POST /editProfile`

**Description:** Update user profile information

**Authentication:** Required

**Request Body (Form Data):**
```
firstname: John
lastname: Doe
designation: Software Engineer
company: Tech Corp
gender: Male
linkedin: https://linkedin.com/in/johndoe
instagram: https://instagram.com/johndoe
telegram: @johndoe
twitter: https://twitter.com/johndoe
facebook: https://facebook.com/johndoe
profileImage: [file] // Optional image file
```

**Response:**
```json
{
  "status": "success",
  "message": "Profile updated successfully",
  "data": {
    "profileImageURL": "https://s3.amazonaws.com/bucket/profile.jpg"
  }
}
```

### 14. Change Password

**Endpoint:** `POST /changePassword`

**Description:** Change user password

**Authentication:** Required

**Request Body:**
```json
{
  "currentPassword": "oldPassword123",
  "newPassword": "newPassword123"
}
```

**Response:**
```json
{
  "status": "success",
  "message": "Password changed successfully"
}
```

### 15. Email Password Reset

**Endpoint:** `POST /email`

**Description:** Send password reset email

**Authentication:** Not required

**Request Body:**
```json
{
  "email": "user@example.com"
}
```

**Response:**
```json
{
  "status": "success",
  "message": "Password reset email sent"
}
```

### 16. Phone Number Password Reset

**Endpoint:** `POST /phoneNumber`

**Description:** Send password reset OTP to phone

**Authentication:** Not required

**Request Body:**
```json
{
  "phonenumber": "9876543210",
  "countryCode": "91"
}
```

**Response:**
```json
{
  "status": "success",
  "message": "Password reset OTP sent"
}
```

---

## Contact Management

### 17. Add/Edit Contact

**Endpoint:** `POST /addEditContact`

**Description:** Create or update a contact

**Authentication:** Required

**Request Body (Form Data):**
```
contact_id: existing_contact_id // Optional, for updates
firstname: John
lastname: Doe
company: Tech Corp
designation: Software Engineer
emailaddresses: ["john@example.com", "j.doe@company.com"]
phonenumbers: [{"countryCode": "91", "number": "9876543210"}]
website: https://johndoe.com
notes: Important client
linkedin: https://linkedin.com/in/johndoe
instagram: https://instagram.com/johndoe
telegram: @johndoe
twitter: https://twitter.com/johndoe
facebook: https://facebook.com/johndoe
contactImage: [file] // Optional image file
```

**Response:**
```json
{
  "status": "success",
  "message": "Contact saved successfully",
  "data": {
    "contact_id": "contact_id",
    "contactImageURL": "https://s3.amazonaws.com/bucket/contact.jpg"
  }
}
```

### 18. Get Contacts

**Endpoint:** `POST /getContact`

**Description:** Get user's contacts with pagination and filtering

**Authentication:** Required

**Request Body:**
```json
{
  "page": 1,
  "limit": 10,
  "search": "john", // Optional search term
  "tag": "tag_id", // Optional tag filter
  "isFavourite": true // Optional favorite filter
}
```

**Response:**
```json
{
  "status": "success",
  "message": "Contacts retrieved successfully",
  "data": {
    "contacts": [
      {
        "contact_id": "contact_id",
        "firstname": "John",
        "lastname": "Doe",
        "company": "Tech Corp",
        "designation": "Software Engineer",
        "emailaddresses": ["john@example.com"],
        "phonenumbers": [
          {
            "countryCode": "91",
            "number": "9876543210"
          }
        ],
        "website": "https://johndoe.com",
        "notes": "Important client",
        "linkedin": "https://linkedin.com/in/johndoe",
        "instagram": "https://instagram.com/johndoe",
        "telegram": "@johndoe",
        "twitter": "https://twitter.com/johndoe",
        "facebook": "https://facebook.com/johndoe",
        "contactImageURL": "https://s3.amazonaws.com/bucket/contact.jpg",
        "isFavourite": true,
        "tags": [
          {
            "tag_id": "tag_id",
            "tag": "Family",
            "emoji": "🖤"
          }
        ],
        "tasks": [
          {
            "task_id": "task_id",
            "taskDescription": "Follow up on project",
            "taskDueDate": "2024-01-15T00:00:00.000Z",
            "taskDueTime": "10:00",
            "taskIsCompleted": false
          }
        ],
        "meetings": [
          {
            "meeting_id": "meeting_id",
            "meetingTitle": "Project Discussion",
            "meetingDescription": "Discuss project requirements",
            "meetingStartDate": "2024-01-15T00:00:00.000Z",
            "meetingStartTime": "14:00",
            "meetingType": "online",
            "meetingLink": "https://meet.google.com/abc-def-ghi",
            "meetingLocation": ""
          }
        ],
        "activities": [
          {
            "action": "contact_created",
            "type": "contact",
            "title": "Contact Created",
            "description": "New contact added",
            "timestamp": "2024-01-01T00:00:00.000Z"
          }
        ],
        "createdAt": "2024-01-01T00:00:00.000Z",
        "updatedAt": "2024-01-01T00:00:00.000Z"
      }
    ],
    "totalContacts": 25,
    "currentPage": 1,
    "totalPages": 3
  }
}
```

### 19. Get Contact by ID

**Endpoint:** `POST /getContactById`

**Description:** Get specific contact by ID

**Authentication:** Required

**Request Body:**
```json
{
  "contact_id": "contact_id"
}
```

**Response:**
```json
{
  "status": "success",
  "message": "Contact retrieved successfully",
  "data": {
    // Same as contact object in getContact response
  }
}
```

### 20. Get All Contacts

**Endpoint:** `POST /getAllContact`

**Description:** Get all user's contacts without pagination

**Authentication:** Required

**Response:**
```json
{
  "status": "success",
  "message": "All contacts retrieved successfully",
  "data": {
    "contacts": [
      // Array of contact objects
    ]
  }
}
```

### 21. Delete Contact

**Endpoint:** `POST /deleteContact`

**Description:** Delete a contact

**Authentication:** Required

**Request Body:**
```json
{
  "contact_id": "contact_id"
}
```

**Response:**
```json
{
  "status": "success",
  "message": "Contact deleted successfully"
}
```

### 22. Delete All Contacts

**Endpoint:** `POST /deleteAllContacts`

**Description:** Delete all user's contacts

**Authentication:** Required

**Response:**
```json
{
  "status": "success",
  "message": "All contacts deleted successfully"
}
```

### 23. Save Bulk Contacts

**Endpoint:** `POST /save-bulk-contacts`

**Description:** Import multiple contacts at once

**Authentication:** Required

**Request Body:**
```json
{
  "contacts": [
    {
      "firstname": "John",
      "lastname": "Doe",
      "emailaddresses": ["john@example.com"],
      "phonenumbers": [{"countryCode": "91", "number": "9876543210"}]
    },
    {
      "firstname": "Jane",
      "lastname": "Smith",
      "emailaddresses": ["jane@example.com"],
      "phonenumbers": [{"countryCode": "1", "number": "1234567890"}]
    }
  ]
}
```

**Response:**
```json
{
  "status": "success",
  "message": "Bulk contacts saved successfully",
  "data": {
    "savedCount": 2,
    "failedCount": 0
  }
}
```

---

## Tag Management

### 24. Add Tag

**Endpoint:** `POST /addTag`

**Description:** Create a new tag

**Authentication:** Required

**Request Body:**
```json
{
  "tag": "Important",
  "emoji": "⭐"
}
```

**Response:**
```json
{
  "status": "success",
  "message": "Tag added successfully",
  "data": {
    "tag_id": "tag_id",
    "tag": "Important",
    "emoji": "⭐"
  }
}
```

### 25. Get Tags

**Endpoint:** `POST /getTag`

**Description:** Get user's tags

**Authentication:** Required

**Response:**
```json
{
  "status": "success",
  "message": "Tags retrieved successfully",
  "data": {
    "tags": [
      {
        "tag_id": "tag_id",
        "tag": "Family",
        "emoji": "🖤"
      },
      {
        "tag_id": "tag_id",
        "tag": "Important",
        "emoji": "⭐"
      }
    ]
  }
}
```

### 26. Edit Tag

**Endpoint:** `POST /editTag`

**Description:** Update a tag

**Authentication:** Required

**Request Body:**
```json
{
  "tag_id": "tag_id",
  "tag": "Very Important",
  "emoji": "🔥"
}
```

**Response:**
```json
{
  "status": "success",
  "message": "Tag updated successfully"
}
```

### 27. Delete Tag

**Endpoint:** `POST /deleteTag`

**Description:** Delete a tag

**Authentication:** Required

**Request Body:**
```json
{
  "tag_id": "tag_id"
}
```

**Response:**
```json
{
  "status": "success",
  "message": "Tag deleted successfully"
}
```

### 28. Assign/Unassign Tag to Contact

**Endpoint:** `POST /assign-unassign-tag`

**Description:** Assign or unassign a tag to/from a contact

**Authentication:** Required

**Request Body:**
```json
{
  "contact_id": "contact_id",
  "tag_id": "tag_id",
  "action": "assign" // "assign" or "unassign"
}
```

**Response:**
```json
{
  "status": "success",
  "message": "Tag assigned to contact successfully"
}
```

### 29. Get Tags with Contacts

**Endpoint:** `POST /getTagWithContact`

**Description:** Get tags with their associated contacts

**Authentication:** Required

**Response:**
```json
{
  "status": "success",
  "message": "Tags with contacts retrieved successfully",
  "data": {
    "tags": [
      {
        "tag_id": "tag_id",
        "tag": "Family",
        "emoji": "🖤",
        "contacts": [
          {
            "contact_id": "contact_id",
            "firstname": "John",
            "lastname": "Doe"
          }
        ]
      }
    ]
  }
}
```

---

## Payment Management

### 30. Get Payment Status

**Endpoint:** `POST /user/payment/status`

**Description:** Get user's current payment and plan status

**Authentication:** Required

**Response:**
```json
{
  "status": "success",
  "message": "Payment status retrieved successfully",
  "data": {
    "currentPlan": {
      "plan_id": "plan_id",
      "name": "Pro",
      "price": 29.99,
      "pricePeriod": "monthly"
    },
    "planActivatedAt": "2024-01-01T00:00:00.000Z",
    "planExpiresAt": "2024-02-01T00:00:00.000Z",
    "isPremium": true,
    "trialEnd": null,
    "creditBalance": 50,
    "autoRenewal": true,
    "remainingDays": []
  }
}
```

### 31. Create Payment Intent

**Endpoint:** `POST /user/payment/create-intent`

**Description:** Create payment intent for plan purchase

**Authentication:** Required

**Request Body:**
```json
{
  "planId": "plan_id",
  "autoRenewal": false
}
```

**Response:**
```json
{
  "status": "success",
  "message": "Payment intent created successfully",
  "data": {
    "paymentMethod": "stripe", // "credits" or "stripe"
    "clientSecret": "pi_stripe_client_secret", // Only if paymentMethod is "stripe"
    "canPayWithCredits": true,
    "creditCost": 29.99
  }
}
```

### 32. Purchase with Credits

**Endpoint:** `POST /user/payment/purchase-with-credits`

**Description:** Purchase plan using user credits only

**Authentication:** Required

**Request Body:**
```json
{
  "planId": "plan_id",
  "autoRenewal": false
}
```

**Response:**
```json
{
  "status": "success",
  "message": "Plan purchased successfully with credits",
  "data": {
    "newPlan": {
      "plan_id": "plan_id",
      "name": "Pro",
      "price": 29.99
    },
    "remainingCredits": 20.01,
    "planActivatedAt": "2024-01-01T00:00:00.000Z",
    "planExpiresAt": "2024-02-01T00:00:00.000Z"
  }
}
```

### 33. Confirm Stripe Payment

**Endpoint:** `POST /user/payment/confirm`

**Description:** Confirm Stripe payment and activate plan

**Authentication:** Required

**Request Body:**
```json
{
  "paymentIntentId": "pi_stripe_payment_intent_id"
}
```

**Response:**
```json
{
  "status": "success",
  "message": "Payment confirmed and plan activated successfully",
  "data": {
    "newPlan": {
      "plan_id": "plan_id",
      "name": "Pro",
      "price": 29.99
    },
    "planActivatedAt": "2024-01-01T00:00:00.000Z",
    "planExpiresAt": "2024-02-01T00:00:00.000Z"
  }
}
```

### 34. Toggle Auto-renewal

**Endpoint:** `PATCH /user/payment/auto-renewal`

**Description:** Enable or disable auto-renewal for current plan

**Authentication:** Required

**Request Body:**
```json
{
  "autoRenewal": true
}
```

**Response:**
```json
{
  "status": "success",
  "message": "Auto-renewal updated successfully",
  "data": {
    "autoRenewal": true
  }
}
```

---

## Admin Management

### 35. Admin Login

**Endpoint:** `POST /admin/login`

**Description:** Login as admin

**Authentication:** Not required

**Request Body:**
```json
{
  "email": "admin@example.com",
  "password": "adminPassword123"
}
```

**Response:**
```json
{
  "status": "success",
  "message": "Admin login successful",
  "data": {
    "token": "admin_jwt_token",
    "role": "superadmin"
  }
}
```

### 36. Get Admin Users

**Endpoint:** `GET /admin/users`

**Description:** Get all users (admin only)

**Authentication:** Required (Admin)

**Query Parameters:**
- `page` (optional): Page number
- `limit` (optional): Items per page
- `search` (optional): Search term

**Response:**
```json
{
  "status": "success",
  "message": "Users retrieved successfully",
  "data": {
    "users": [
      {
        "_id": "user_id",
        "firstname": "John",
        "lastname": "Doe",
        "email": "user@example.com",
        "role": "user",
        "isPremium": false,
        "createdAt": "2024-01-01T00:00:00.000Z",
        "lastSeen": "2024-01-15T00:00:00.000Z"
      }
    ],
    "totalUsers": 100,
    "currentPage": 1,
    "totalPages": 10
  }
}
```

### 37. Get Admin Plans

**Endpoint:** `GET /admin/plans`

**Description:** Get all subscription plans (admin only)

**Authentication:** Required (Admin)

**Response:**
```json
{
  "status": "success",
  "message": "Plans retrieved successfully",
  "data": {
    "plans": [
      {
        "_id": "plan_id",
        "name": "Free",
        "price": 0,
        "pricePeriod": "monthly",
        "features": ["Basic contact management"],
        "isActive": true,
        "createdAt": "2024-01-01T00:00:00.000Z"
      },
      {
        "_id": "plan_id",
        "name": "Pro",
        "price": 29.99,
        "pricePeriod": "monthly",
        "features": ["Advanced contact management", "Unlimited contacts"],
        "isActive": true,
        "createdAt": "2024-01-01T00:00:00.000Z"
      }
    ]
  }
}
```

### 38. Add/Edit Plan

**Endpoint:** `POST /admin/addEditPlan`

**Description:** Create or update a subscription plan (admin only)

**Authentication:** Required (Admin)

**Request Body:**
```json
{
  "plan_id": "plan_id", // Optional, for updates
  "name": "Premium",
  "price": 49.99,
  "pricePeriod": "monthly",
  "features": ["Advanced features", "Priority support"],
  "isActive": true
}
```

**Response:**
```json
{
  "status": "success",
  "message": "Plan saved successfully",
  "data": {
    "plan_id": "plan_id"
  }
}
```

---

## Contact Import & Integration

### 60. Fetch Google Contacts

**Endpoint:** `GET /fetch-google-contacts`

**Description:** Get Google OAuth URL for contact import

**Authentication:** Required

**Response:**
```json
{
  "status": "success",
  "message": "Google OAuth URL generated",
  "url": "https://accounts.google.com/oauth/authorize?..."
}
```

### 61. Google Contacts Callback

**Endpoint:** `GET /fetch-google-contacts/google/callback`

**Description:** Handle Google OAuth callback and import contacts

**Authentication:** Not required

**Query Parameters:**
- `code`: Authorization code from Google
- `state`: State parameter

**Response:** HTML page that posts message to parent window

### 62. Fetch LinkedIn Contacts

**Endpoint:** `GET /fetch-linkedin-contacts`

**Description:** Get LinkedIn OAuth URL for contact import

**Authentication:** Required

**Response:**
```json
{
  "status": "success",
  "message": "LinkedIn OAuth URL generated",
  "url": "https://www.linkedin.com/oauth/v2/authorization?..."
}
```

### 63. LinkedIn Contacts Callback

**Endpoint:** `GET /fetch-linkedin-contacts/linkedin/callback`

**Description:** Handle LinkedIn OAuth callback and import contacts

**Authentication:** Not required

**Query Parameters:**
- `code`: Authorization code from LinkedIn
- `state`: State parameter

**Response:** HTML page that posts message to parent window

### 64. Fetch HubSpot Contacts

**Endpoint:** `GET /fetch-hubspot-contacts`

**Description:** Get HubSpot OAuth URL for contact import

**Authentication:** Required

**Response:**
```json
{
  "status": "success",
  "message": "HubSpot OAuth URL generated",
  "url": "https://app.hubspot.com/oauth/authorize?..."
}
```

### 65. HubSpot Contacts Callback

**Endpoint:** `GET /fetch-hubspot-contacts/hubspot/callback`

**Description:** Handle HubSpot OAuth callback and import contacts

**Authentication:** Not required

**Query Parameters:**
- `code`: Authorization code from HubSpot
- `state`: State parameter

**Response:** HTML page that posts message to parent window

### 66. Fetch Zoho Contacts

**Endpoint:** `GET /fetch-zoho-contacts`

**Description:** Get Zoho OAuth URL for contact import

**Authentication:** Required

**Response:**
```json
{
  "status": "success",
  "message": "Zoho OAuth URL generated",
  "url": "https://accounts.zoho.com/oauth/v2/auth?..."
}
```

### 67. Zoho Contacts Callback

**Endpoint:** `GET /fetch-zoho-contacts/zoho/callback`

**Description:** Handle Zoho OAuth callback and import contacts

**Authentication:** Not required

**Query Parameters:**
- `code`: Authorization code from Zoho
- `state`: State parameter

**Response:** HTML page that posts message to parent window

---

## Scan & QR Code

### 45. Scan User

**Endpoint:** `POST /scan`

**Description:** Scan a user using their QR code

**Authentication:** Not required

**Request Body:**
```json
{
  "ScannerID": "67ef95cc9da0a004d4691015",
  "UserID": "67ffbebad9d8d9a32c8b9c5d"
}
```

**Response:**
```json
{
  "status": "success",
  "message": "Scan successful",
  "data": {
    "iScanned": ["user_id_1", "user_id_2"],
    "scannedMe": ["scanner_id_1", "scanner_id_2"]
  }
}
```

### 46. Get Scan Data

**Endpoint:** `POST /scan/get_data`

**Description:** Get scan data for authenticated user

**Authentication:** Required

**Response:**
```json
{
  "status": "success",
  "message": "Scan data retrieved successfully",
  "data": {
    "iScanned": [
      {
        "_id": "user_id",
        "firstname": "John",
        "lastname": "Doe",
        "email": "john@example.com",
        "profileImageURL": "https://example.com/profile.jpg"
      }
    ],
    "scannedMe": [
      {
        "_id": "scanner_id",
        "firstname": "Jane",
        "lastname": "Smith",
        "email": "jane@example.com",
        "profileImageURL": "https://example.com/profile.jpg"
      }
    ]
  }
}
```

---

## Reminders & Tasks

### 47. Get Reminders

**Endpoint:** `GET /reminders/getReminders`

**Description:** Get user's reminders

**Authentication:** Required

**Response:**
```json
{
  "status": "success",
  "message": "Reminders retrieved successfully",
  "data": {
    "reminders": [
      {
        "_id": "reminder_id",
        "title": "Meeting with client",
        "description": "Discuss project requirements",
        "date": "2024-01-15T10:00:00.000Z"
      }
    ]
  }
}
```

### 48. Add/Edit Reminder

**Endpoint:** `POST /reminders/addEditReminder`

**Description:** Create or update a reminder

**Authentication:** Required

**Request Body:**
```json
{
  "reminder_id": "reminder_id", // Optional, for updates
  "title": "Follow up call",
  "description": "Call client about project status",
  "date": "2024-01-20T14:00:00.000Z"
}
```

**Response:**
```json
{
  "status": "success",
  "message": "Reminder saved successfully",
  "data": {
    "reminder_id": "reminder_id"
  }
}
```

### 49. Delete Reminder

**Endpoint:** `DELETE /reminders/deleteReminder`

**Description:** Delete a reminder

**Authentication:** Required

**Request Body:**
```json
{
  "reminder_id": "reminder_id"
}
```

**Response:**
```json
{
  "status": "success",
  "message": "Reminder deleted successfully"
}
```

### 71. Delete Task

**Endpoint:** `POST /deleteTask`

**Description:** Delete a task from a contact

**Authentication:** Required

**Request Body:**
```json
{
  "contact_id": "contact_id",
  "task_id": "task_id"
}
```

**Response:**
```json
{
  "status": "success",
  "message": "Task deleted successfully"
}
```

### 72. Delete Meeting

**Endpoint:** `POST /deleteMeeting`

**Description:** Delete a meeting from a contact

**Authentication:** Required

**Request Body:**
```json
{
  "contact_id": "contact_id",
  "meeting_id": "meeting_id"
}
```

**Response:**
```json
{
  "status": "success",
  "message": "Meeting deleted successfully"
}
```

---

## Email & Communication

### 50. Send Email

**Endpoint:** `POST /sendEmail`

**Description:** Send email to contacts

**Authentication:** Required

**Request Body:**
```json
{
  "contactIds": ["contact_id_1", "contact_id_2"],
  "subject": "Project Update",
  "message": "Here's the latest update on our project...",
  "templateId": "template_id" // Optional
}
```

**Response:**
```json
{
  "status": "success",
  "message": "Email sent successfully",
  "data": {
    "sentCount": 2,
    "failedCount": 0
  }
}
```

### 51. WhatsApp/Email Activity Log

**Endpoint:** `POST /whatsapp-email-activity`

**Description:** Log WhatsApp or email activity

**Authentication:** Required

**Request Body:**
```json
{
  "contactId": "contact_id",
  "type": "whatsapp", // "whatsapp" or "email"
  "message": "Sent follow-up message",
  "timestamp": "2024-01-15T10:00:00.000Z"
}
```

**Response:**
```json
{
  "status": "success",
  "message": "Activity logged successfully"
}
```

### 69. Get Contact Email

**Endpoint:** `POST /getContactEmail`

**Description:** Get contact's email addresses

**Authentication:** Required

**Request Body:**
```json
{
  "contact_id": "contact_id"
}
```

**Response:**
```json
{
  "status": "success",
  "message": "Contact emails retrieved successfully",
  "data": {
    "emailaddresses": ["john@example.com", "j.doe@company.com"]
  }
}
```

---

## Account Management

### 54. Connect Google Account

**Endpoint:** `POST /connect/google`

**Description:** Connect user's Google account for contact import

**Authentication:** Required

**Request Body:**
```json
{
  "accessToken": "google_access_token"
}
```

**Response:**
```json
{
  "status": "success",
  "message": "Google account connected successfully"
}
```

### 55. Google Account Callback

**Endpoint:** `GET /connect/google-callback`

**Description:** Handle Google OAuth callback for account connection

**Authentication:** Not required

**Query Parameters:**
- `code`: Authorization code from Google
- `state`: State parameter

**Response:** HTML page that posts message to parent window

### 56. Connect Microsoft Account

**Endpoint:** `POST /connect/microsoft`

**Description:** Connect user's Microsoft account for contact import

**Authentication:** Required

**Request Body:**
```json
{
  "accessToken": "microsoft_access_token"
}
```

**Response:**
```json
{
  "status": "success",
  "message": "Microsoft account connected successfully"
}
```

### 57. Microsoft Account Callback

**Endpoint:** `GET /connect/microsoft-callback`

**Description:** Handle Microsoft OAuth callback for account connection

**Authentication:** Not required

**Query Parameters:**
- `code`: Authorization code from Microsoft
- `state`: State parameter

**Response:** HTML page that posts message to parent window

### 58. Connect SMTP

**Endpoint:** `POST /connect/smtp`

**Description:** Connect SMTP server for email sending

**Authentication:** Required

**Request Body:**
```json
{
  "host": "smtp.gmail.com",
  "port": 587,
  "user": "your-email@gmail.com",
  "password": "your-app-password",
  "secure": true
}
```

**Response:**
```json
{
  "status": "success",
  "message": "SMTP connected successfully"
}
```

### 59. Disconnect Account

**Endpoint:** `POST /disconnect`

**Description:** Disconnect a connected account

**Authentication:** Required

**Request Body:**
```json
{
  "provider": "google" // "google", "microsoft", "smtp"
}
```

**Response:**
```json
{
  "status": "success",
  "message": "Account disconnected successfully"
}
```

---

## Other Endpoints

### 39. Get User Card

**Endpoint:** `GET /shareProfile`

**Description:** Get user's public profile card

**Authentication:** Not required

**Query Parameters:**
- `user_id` (optional): User ID to get profile for

**Response:**
```json
{
  "status": "success",
  "message": "User card retrieved successfully",
  "data": {
    "firstname": "John",
    "lastname": "Doe",
    "email": "user@example.com",
    "phonenumbers": [
      {
        "countryCode": "91",
        "number": "9876543210"
      }
    ],
    "linkedin": "https://linkedin.com/in/johndoe",
    "instagram": "https://instagram.com/johndoe",
    "profileImageURL": "https://s3.amazonaws.com/bucket/profile.jpg"
  }
}
```

### 40. Get My Referrals

**Endpoint:** `POST /my-referrals`

**Description:** Get user's referral information

**Authentication:** Required

**Response:**
```json
{
  "status": "success",
  "message": "Referrals retrieved successfully",
  "data": {
    "myReferrals": [
      {
        "_id": "referred_user_id",
        "firstname": "Jane",
        "lastname": "Smith",
        "email": "jane@example.com",
        "phonenumbers": [
          {
            "countryCode": "1",
            "number": "1234567890"
          }
        ],
        "signupDate": "2024-01-01T00:00:00.000Z"
      }
    ],
    "referralCode": "abc123def456",
    "referralUrl": "https://app.contacts.management/register?ref=abc123def456",
    "totalReferrals": 5,
    "totalCreditsEarned": 50
  }
}
```

### 41. Help and Support

**Endpoint:** `POST /help-support`

**Description:** Submit help and support request

**Authentication:** Required

**Request Body (Form Data):**
```
subject: Technical Issue
message: I'm having trouble with the app
priority: high // low, medium, high
attachments: [file] // Optional file attachment
```

**Response:**
```json
{
  "status": "success",
  "message": "Support request submitted successfully",
  "data": {
    "ticket_id": "ticket_id"
  }
}
```

### 42. Get Contact Activities

**Endpoint:** `POST /getContactActivities`

**Description:** Get activities for a specific contact

**Authentication:** Required

**Request Body:**
```json
{
  "contact_id": "contact_id"
}
```

**Response:**
```json
{
  "status": "success",
  "message": "Contact activities retrieved successfully",
  "data": {
    "activities": [
      {
        "action": "contact_created",
        "type": "contact",
        "title": "Contact Created",
        "description": "New contact added",
        "timestamp": "2024-01-01T00:00:00.000Z"
      },
      {
        "action": "task_created",
        "type": "task",
        "title": "Task Created",
        "description": "Follow up on project",
        "timestamp": "2024-01-02T00:00:00.000Z"
      }
    ]
  }
}
```

### 43. Check Duplicate User

**Endpoint:** `POST /check-duplicate-user`

**Description:** Check if email or phone number already exists

**Authentication:** Required

**Request Body:**
```json
{
  "email": "user@example.com",
  "phonenumber": "9876543210",
  "countryCode": "91"
}
```

**Response:**
```json
{
  "status": "success",
  "message": "Duplicate check completed",
  "data": {
    "emailExists": false,
    "phoneExists": false
  }
}
```

### 44. Webhook Endpoint

**Endpoint:** `POST /webhooks/stripe`

**Description:** Stripe webhook endpoint for payment events

**Authentication:** Not required (uses Stripe signature verification)

**Request Body:** Stripe webhook payload

**Response:**
```json
{
  "status": "success",
  "message": "Webhook processed successfully"
}
```

### 52. Get Plans

**Endpoint:** `GET /plans/get`

**Description:** Get all available subscription plans

**Authentication:** Not required

**Response:**
```json
{
  "status": "success",
  "message": "Plans retrieved successfully",
  "data": {
    "plans": [
      {
        "_id": "plan_id",
        "name": "Free",
        "price": 0,
        "pricePeriod": "monthly",
        "features": ["Basic contact management"],
        "isActive": true
      },
      {
        "_id": "plan_id",
        "name": "Pro",
        "price": 29.99,
        "pricePeriod": "monthly",
        "features": ["Advanced contact management", "Unlimited contacts"],
        "isActive": true
      }
    ]
  }
}
```

### 53. Purchase Plan

**Endpoint:** `POST /plans/purchase`

**Description:** Purchase a subscription plan

**Authentication:** Required

**Request Body:**
```json
{
  "planId": "plan_id",
  "paymentMethod": "stripe" // "stripe" or "credits"
}
```

**Response:**
```json
{
  "status": "success",
  "message": "Plan purchased successfully",
  "data": {
    "newPlan": {
      "plan_id": "plan_id",
      "name": "Pro",
      "price": 29.99
    },
    "planActivatedAt": "2024-01-01T00:00:00.000Z",
    "planExpiresAt": "2024-02-01T00:00:00.000Z"
  }
}
```

### 68. Add to Favorites

**Endpoint:** `POST /addToFavourite`

**Description:** Add contact to favorites

**Authentication:** Required

**Request Body:**
```json
{
  "contact_id": "contact_id",
  "isFavourite": true
}
```

**Response:**
```json
{
  "status": "success",
  "message": "Contact added to favorites"
}
```

### 70. Get Profile Events

**Endpoint:** `POST /getProfileEvent`

**Description:** Get user's profile events/activities

**Authentication:** Required

**Response:**
```json
{
  "status": "success",
  "message": "Profile events retrieved successfully",
  "data": {
    "events": [
      {
        "action": "profile_updated",
        "description": "Profile information updated",
        "timestamp": "2024-01-15T10:00:00.000Z"
      }
    ]
  }
}
```

### 73. Delete Template

**Endpoint:** `POST /deleteTemplate`

**Description:** Delete a WhatsApp or email template

**Authentication:** Required

**Request Body:**
```json
{
  "template_id": "template_id",
  "template_type": "whatsapp" // "whatsapp" or "email"
}
```

**Response:**
```json
{
  "status": "success",
  "message": "Template deleted successfully"
}
```

### 74. Delete User

**Endpoint:** `POST /deleteUser`

**Description:** Delete user account

**Authentication:** Required

**Response:**
```json
{
  "status": "success",
  "message": "User account deleted successfully"
}
```

### 75. Sign Document

**Endpoint:** `POST /sign`

**Description:** Sign a document (if applicable)

**Authentication:** Required

**Request Body:**
```json
{
  "document_id": "document_id",
  "signature": "base64_signature_data"
}
```

**Response:**
```json
{
  "status": "success",
  "message": "Document signed successfully"
}
```

### 76. Get User Info

**Endpoint:** `POST /user-info`

**Description:** Get detailed user information

**Authentication:** Required

**Response:**
```json
{
  "status": "success",
  "message": "User info retrieved successfully",
  "data": {
    "userInfo": {
      "helps": ["Contact management", "Email templates"],
      "goals": "Grow my network",
      "categories": "Business",
      "employeeCount": "1-10",
      "companyName": "Tech Corp"
    }
  }
}
```

### 77. API Health Check

**Endpoint:** `GET /check`

**Description:** Check API health status

**Authentication:** Not required

**Response:**
```json
{
  "message": "API checkPage"
}
```

### 78. Homepage

**Endpoint:** `GET /`

**Description:** API homepage

**Authentication:** Not required

**Response:**
```json
{
  "message": "API Homepage"
}
```

---

## Data Models

### User Model
```json
{
  "_id": "ObjectId",
  "firstname": "String",
  "lastname": "String",
  "email": "String (unique)",
  "phonenumbers": [
    {
      "countryCode": "String",
      "number": "String"
    }
  ],
  "password": "String (hashed)",
  "salt": "String",
  "provider": "String (local|google|apple|linkedin)",
  "signupMethod": "String (email|phoneNumber|google|apple|linkedin)",
  "role": "String (user|superadmin)",
  "isVerified": "Boolean",
  "isActive": "Boolean",
  "isPremium": "Boolean",
  "plan": "ObjectId (ref: Plan)",
  "planActivatedAt": "Date",
  "planExpiresAt": "Date",
  "trialStart": "Date",
  "trialEnd": "Date",
  "creditBalance": "Number",
  "referralCode": "String (unique)",
  "referredBy": "ObjectId (ref: User)",
  "profileImageURL": "String",
  "tags": [
    {
      "tag_id": "ObjectId",
      "tag": "String",
      "emoji": "String"
    }
  ],
  "whatsappTemplates": [
    {
      "whatsappTemplate_id": "ObjectId",
      "whatsappTemplateTitle": "String",
      "whatsappTemplateMessage": "String",
      "whatsappTemplateIsFavourite": "Boolean"
    }
  ],
  "emailTemplates": [
    {
      "emailTemplate_id": "ObjectId",
      "emailTemplateTitle": "String",
      "emailTemplateSubject": "String",
      "emailTemplateBody": "String",
      "emailTemplateIsFavourite": "Boolean"
    }
  ],
  "createdAt": "Date",
  "updatedAt": "Date"
}
```

### Contact Model
```json
{
  "_id": "ObjectId",
  "contact_id": "ObjectId (unique)",
  "firstname": "String",
  "lastname": "String",
  "company": "String",
  "designation": "String",
  "emailaddresses": ["String"],
  "phonenumbers": [
    {
      "countryCode": "String",
      "number": "String"
    }
  ],
  "website": "String",
  "notes": "String",
  "contactImageURL": "String",
  "isFavourite": "Boolean",
  "tags": [
    {
      "tag_id": "ObjectId",
      "tag": "String",
      "emoji": "String"
    }
  ],
  "linkedin": "String",
  "instagram": "String",
  "telegram": "String",
  "twitter": "String",
  "facebook": "String",
  "tasks": [
    {
      "task_id": "ObjectId",
      "taskDescription": "String",
      "taskDueDate": "Date",
      "taskDueTime": "String",
      "taskIsCompleted": "Boolean"
    }
  ],
  "meetings": [
    {
      "meeting_id": "ObjectId",
      "meetingTitle": "String",
      "meetingDescription": "String",
      "meetingStartDate": "Date",
      "meetingStartTime": "String",
      "meetingType": "String (online|offline)",
      "meetingLink": "String",
      "meetingLocation": "String"
    }
  ],
  "activities": [
    {
      "action": "String",
      "type": "String (contact|task|meeting|tag|email|whatsapp)",
      "title": "String",
      "description": "String",
      "timestamp": "Date"
    }
  ],
  "createdBy": "ObjectId (ref: User)",
  "createdAt": "Date",
  "updatedAt": "Date"
}
```

---

## Rate Limiting

The API implements rate limiting to prevent abuse:

- **Authentication endpoints**: 10 requests per minute per IP
- **General endpoints**: 100 requests per minute per authenticated user
- **Admin endpoints**: 50 requests per minute per admin user

## CORS

The API supports CORS for cross-origin requests from:
- `https://app.contacts.management`
- `http://localhost:3000` (development)

## File Upload

File uploads are supported for:
- Profile images (max 5MB)
- Contact images (max 5MB)
- Support attachments (max 10MB)

Supported formats: JPG, PNG, GIF, PDF

## Webhooks

The API supports Stripe webhooks for payment processing:
- Payment succeeded
- Payment failed
- Subscription created/updated/cancelled

---

## Support

For API support and questions:
- Email: support@contacts.management
- Documentation: https://docs.contacts.management
- Status Page: https://status.contacts.management
