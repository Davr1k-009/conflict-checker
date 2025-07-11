# Testing Guide for Conflict Checker

## Overview

This guide provides step-by-step instructions for testing all features of the Conflict Checker application.

## 1. Initial Setup Testing

### 1.1 First Login
1. Navigate to http://localhost:3000
2. You should see the login page with Apple-style design
3. Enter credentials:
   - Username: `admin`
   - Password: `admin123`
4. Click "Sign In"
5. **Expected**: Redirect to dashboard with welcome message

### 1.2 Change Default Password
1. Click on your profile icon (top right)
2. Go to "Profile" page
3. Click "Change Password"
4. Enter:
   - Current Password: `admin123`
   - New Password: `newpassword123`
   - Confirm Password: `newpassword123`
5. Click "Save Password"
6. **Expected**: Success message and form clears

## 2. User Management Testing (Admin Only)

### 2.1 Create New User
1. Navigate to "Users" from the navigation menu
2. Click "Add User" button
3. Fill in the form:
   - Full Name: `John Doe`
   - Position: `Senior Lawyer`
   - Email: `john.doe@company.com`
   - Username: `jdoe`
   - Password: `password123`
   - Role: `User`
   - Permissions: Check "Create" and "Edit"
4. Click "Create User"
5. **Expected**: User appears in the list with correct details

### 2.2 Test User Permissions
1. Log out (click logout icon)
2. Log in as the new user:
   - Username: `jdoe`
   - Password: `password123`
3. Navigate to "Cases"
4. **Expected**: 
   - Can see "New Case" button (has create permission)
   - Cannot see "Users" menu item (not admin)

### 2.3 Deactivate User (as Admin)
1. Log back in as admin
2. Go to "Users"
3. Find John Doe in the list
4. Click the status toggle to deactivate
5. **Expected**: Status changes to "Inactive"
6. Try logging in as jdoe
7. **Expected**: Login fails

## 3. Case Management Testing

### 3.1 Create a Case (No Conflict)
1. Navigate to "Cases"
2. Click "New Case"
3. Fill in:
   - Case Number: `2024-001`
   - Client Name: `ABC Corporation`
   - Client INN: `1234567890`
   - Case Type: `Litigation`
   - Description: `Contract dispute case`
   - Assign Lawyer: Select any user
4. Click "Create Case"
5. **Expected**: 
   - Success message
   - Redirect to case details
   - No conflict warnings

### 3.2 Create a Conflicting Case
1. Go back to "Cases"
2. Click "New Case"
3. Fill in:
   - Case Number: `2024-002`
   - Client Name: `XYZ Limited`
   - Opponent Name: `ABC Corporation` (same as previous client)
   - Opponent INN: `1234567890`
4. Click "Create Case"
5. **Expected**:
   - Conflict warning appears
   - Case is created but marked with conflict
   - Notification appears about conflict

### 3.3 Add Related Entities
1. Create another case
2. In the "Related Entities" section:
   - Add Related Company: `ABC Subsidiary, INN: 1234567891`
   - Add Founder: `John Smith`
   - Add Director: `Jane Doe`
3. Create the case
4. Create another case with `John Smith` as the opponent
5. **Expected**: Medium-level conflict detected

## 4. Document Management Testing

### 4.1 Upload Document
1. Go to any case details page
2. In the Documents section, click "Upload"
3. Select a PDF or image file (< 10MB)
4. **Expected**:
   - Upload progress shows
   - Document appears in the list
   - Shows correct file size and uploader name

### 4.2 Download Document
1. Click the download icon next to any document
2. **Expected**: File downloads with original filename

### 4.3 Delete Document
1. Click the trash icon next to a document
2. **Expected**: 
   - Document is removed from list
   - Success message appears

## 5. Conflict Checking Features

### 5.1 Manual Conflict Check
1. Go to "Check Conflicts" from navigation
2. Enter partial information:
   - Client Name: `Test Company`
   - Opponent Name: `ABC Corporation`
3. Click "Check for Conflicts"
4. **Expected**: Shows any cases involving ABC Corporation

### 5.2 Re-check Conflicts
1. Go to any case details
2. Click "Check Conflicts" button
3. **Expected**: 
   - Loading state while checking
   - Updated conflict status
   - New entry in conflict history

## 6. Search and Filter Testing

### 6.1 Search Cases
1. Go to "Cases" page
2. In search box, type "ABC"
3. **Expected**: Only cases involving ABC show up

### 6.2 Filter by Type
1. Select "Litigation" from type filter
2. **Expected**: Only litigation cases show

### 6.3 Clear Filters
1. Click "Clear Filters"
2. **Expected**: All cases show again

## 7. Real-time Features Testing

### 7.1 Conflict Notifications
1. Open the app in two browser windows
2. Log in as different users in each
3. In window 1, create a case that conflicts with existing data
4. **Expected**: Window 2 shows notification bell with red dot

### 7.2 User Creation Notification
1. Keep two windows open
2. In window 1 (as admin), create a new user
3. **Expected**: Window 2 shows notification about new user

## 8. Theme Testing

### 8.1 Toggle Dark Mode
1. Click the moon icon in navigation
2. **Expected**: 
   - Entire app switches to dark theme
   - Icon changes to sun
   - Theme persists on refresh

## 9. Dashboard Testing

### 9.1 Statistics
1. Go to Dashboard
2. Verify statistics cards show:
   - Total Cases count
   - Active Conflicts count
   - Cases This Month
   - Total Users
3. **Expected**: Numbers match actual data

### 9.2 Charts
1. Check the Cases Trend chart
2. **Expected**: Line chart shows monthly data
3. Check Conflicts by Level pie chart
4. **Expected**: Shows distribution of conflict levels

### 9.3 Recent Cases
1. Check recent cases table
2. **Expected**: Shows latest 10 cases with conflict status

## 10. Profile Features

### 10.1 View Profile
1. Go to Profile page
2. **Expected**: Shows:
   - User avatar with initials
   - Full name, email, username
   - Role badge
   - Permissions grid (for non-admin)

### 10.2 Quick Stats
1. Check Quick Stats section
2. **Expected**: Shows placeholder statistics

## 11. Error Handling Testing

### 11.1 Invalid Login
1. Log out
2. Try logging in with wrong password
3. **Expected**: Error message "Invalid credentials"

### 11.2 Session Timeout
1. Log in successfully
2. Delete token from browser localStorage (F12 → Application → Local Storage)
3. Try navigating to any page
4. **Expected**: Redirect to login page

### 11.3 Network Error
1. Stop the backend server
2. Try creating a case
3. **Expected**: Error toast message appears

## 12. Permissions Testing

### 12.1 Viewer Role
1. Create a user with "Viewer" role and no permissions
2. Log in as this user
3. **Expected**:
   - Cannot see "New Case" button
   - Cannot see edit/delete buttons
   - Can only view data

### 12.2 Limited Permissions
1. Create user with only "Edit" permission
2. Log in as this user
3. **Expected**:
   - Cannot create new cases
   - Can edit existing cases
   - Cannot delete cases

## 13. Performance Testing

### 13.1 Large Dataset
1. Create 50+ cases with various conflict levels
2. Navigate through pages
3. **Expected**: 
   - Pages load quickly
   - Search remains responsive
   - No UI freezing

### 13.2 Multiple Documents
1. Upload 10+ documents to a single case
2. **Expected**: All upload and display smoothly

## 14. Mobile Responsiveness

### 14.1 Mobile View
1. Open browser developer tools (F12)
2. Toggle device toolbar
3. Select iPhone or iPad view
4. Navigate through all pages
5. **Expected**:
   - Navigation collapses to hamburger menu
   - Tables become scrollable
   - All features remain accessible

## Test Data for Conflict Scenarios

### Scenario 1: Direct Conflict
- Case 1: Client "Alpha Corp" vs Opponent "Beta Inc"
- Case 2: Client "Beta Inc" vs Opponent "Gamma Ltd"
- **Expected**: High conflict on Case 2

### Scenario 2: Lawyer Conflict
- Case 1: Lawyer "John" represents "Alpha Corp"
- Case 2: Lawyer "John" assigned, Opponent is "Alpha Corp"
- **Expected**: Medium conflict

### Scenario 3: Related Entity Conflict
- Case 1: Client "Parent Co", Founder "Mr. Smith"
- Case 2: Opponent "Mr. Smith"
- **Expected**: Medium conflict

### Scenario 4: Complex Conflict
- Case 1: Client "Company A", Related Company "Company B"
- Case 2: Client "Company C", Opponent "Company B"
- **Expected**: Low conflict

## Automated Testing Commands

While manual testing is important, you can also add automated tests:

### Backend Testing
```bash
cd backend
npm test  # If tests are implemented
```

### Frontend Testing
```bash
cd frontend
npm test  # Runs React test suite
```

## Bug Reporting Template

When you find issues, document them:

```markdown
**Bug Title**: [Brief description]
**Steps to Reproduce**:
1. [Step 1]
2. [Step 2]
3. [Step 3]

**Expected Behavior**: [What should happen]
**Actual Behavior**: [What actually happens]
**Screenshots**: [If applicable]
**Browser/OS**: [e.g., Chrome on Windows 10]
```

## Performance Benchmarks

Expected performance metrics:
- Login: < 1 second
- Page navigation: < 500ms
- Case creation: < 2 seconds
- Conflict check: < 3 seconds
- File upload (5MB): < 5 seconds

## Security Testing Checklist

- [ ] SQL injection attempts in search fields
- [ ] XSS attempts in text inputs
- [ ] File upload with wrong extensions
- [ ] Access pages without authentication
- [ ] Try to access other users' data
- [ ] Attempt to bypass permissions
- [ ] Test with expired tokens
- [ ] Check for sensitive data in responses

This comprehensive testing guide ensures all features work correctly before deployment.