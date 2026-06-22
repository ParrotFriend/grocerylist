# Quick Start Guide - JZ_VAPE Multi-Location

## 🚀 Mabilis na Setup

### 1. Database Setup (Supabase)

1. Buksan ang Supabase dashboard
2. Pumunta sa SQL Editor
3. I-copy paste ang buong content ng `database_migration.sql`
4. I-click ang "Run" button
5. Verify na successful ang migration

### 2. Local Testing

1. I-download ang folder `jz_vape_app`
2. I-open ang `index.html` sa browser
   - **Simple**: Double-click lang ang `index.html`
   - **Better**: Use VS Code Live Server extension
   - **Best**: Run local web server:
     ```bash
     python -m http.server 8000
     # then open http://localhost:8000
     ```

### 3. First Time Setup

#### Admin Account (if wala pa):
1. Pumunta sa Supabase Authentication
2. Create new user with email/password
3. Use this for admin login

#### Initial Locations:
1. Login as Admin
2. Pumunta sa "📍 Locations" tab
3. I-add ang locations:
   - PPC
   - El Nido
   - (optional third location)

#### Test Customer:
1. Pumunta sa "+ Dagdag" tab
2. Add customer:
   - Name: "Test Customer"
   - Location: Select "PPC"
   - Auto-generated code will appear
3. Logout
4. Login as customer using the 8-digit code

#### Test Inventory:
1. Login as Admin
2. Pumunta sa "📦 Inventory" tab
3. Add product:
   - Category: V2 PODS
   - Brand: Nox Elite
   - Puffs: 25000
   - Flavor: Mango Ice
   - Amount: 285
   - Quantity: 10
   - Location: PPC
4. Save

#### Verify Customer View:
1. Logout
2. Login as the test customer
3. Click "📦 What's Available Now?"
4. Dapat makita yung "Nox Elite Mango Ice" kasi same location

## 📱 Features to Test

### Admin Functions:
- ✅ Create locations (max 3)
- ✅ Add customers with location assignment
- ✅ Add inventory with location assignment
- ✅ Add stamps to customers
- ✅ Redeem rewards
- ✅ Track utang (debt)
- ✅ View customer list with location info

### Customer Functions:
- ✅ Login with 8-digit code
- ✅ View loyalty card & stamps
- ✅ View inventory (filtered by location)
- ✅ View transaction history
- ✅ Check utang balance

## 🧪 Test Scenarios

### Test 1: Multi-Location Filtering
1. Create 2 locations: PPC, El Nido
2. Create Customer A → PPC
3. Create Customer B → El Nido
4. Add Inventory Item 1 → PPC
5. Add Inventory Item 2 → El Nido
6. Login as Customer A → Should only see Item 1
7. Login as Customer B → Should only see Item 2

### Test 2: Location Management
1. Create location "Test Location"
2. Try to delete it (should work, no customers/inventory)
3. Add customer to "Test Location"
4. Try to delete it again (should fail with message)

### Test 3: Customer Journey
1. Customer visits public page
2. Customer logs in with code
3. Customer sees their stamps
4. Customer checks available products (their location only)
5. Customer sees transaction history

## ⚠️ Common Issues

### "Piliin ang location" error
- **Cause**: Walang locations created
- **Fix**: Create locations first sa admin panel

### Customer can't see any inventory
- **Cause**: Location mismatch
- **Fix**: Check customer's location and inventory location

### Location won't delete
- **Cause**: May customers o inventory sa location
- **Fix**: Reassign or delete customers/inventory first

### Database errors
- **Cause**: Migration not run
- **Fix**: Run `database_migration.sql` sa Supabase

## 📝 Notes

- **Codes**: Auto-generated 8-digit numbers
- **Stamps**: Max 10 stamps per customer
- **Locations**: Max 3 locations
- **RLS**: Row Level Security enabled for security

## 🎯 Next Steps

1. Customize ang SHOP_NAME sa `app.js`
2. Update ang MAX_STAMPS kung gusto mo baguhin
3. I-deploy sa production (Netlify, Vercel, etc.)
4. Test thoroughly bago i-launch

---

**Happy coding!** 🚀
