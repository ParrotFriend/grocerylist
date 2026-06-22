# JZ_VAPE Loyalty System - Multi-Location Version

Ito ang updated loyalty system para sa JZ_VAPE na may multi-location support.

## 🆕 New Features

### Multi-Location Management
- **Admin** can manage up to 3 locations (e.g., PPC, El Nido, etc.)
- Each **customer** is assigned to a specific location
- Each **inventory item** is assigned to a specific location
- **Customers** only see inventory from their assigned location

## 📁 File Structure

```
jz_vape_app/
├── index.html       - Clean HTML structure
├── styles.css       - All CSS styles
├── app.js          - JavaScript logic with location support
└── README.md       - This file
```

## 🗄️ Database Setup

Kailangan mong i-update ang Supabase database mo with the following changes:

### 1. Create `locations` table

```sql
CREATE TABLE locations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE locations ENABLE ROW LEVEL SECURITY;

-- Allow read access to everyone
CREATE POLICY "Allow public read access" ON locations
  FOR SELECT USING (true);

-- Allow admin to insert/update/delete
CREATE POLICY "Allow authenticated insert" ON locations
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated update" ON locations
  FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated delete" ON locations
  FOR DELETE USING (auth.role() = 'authenticated');
```

### 2. Add `location_id` column to `customers` table

```sql
ALTER TABLE customers 
ADD COLUMN location_id UUID REFERENCES locations(id);
```

### 3. Add `location_id` column to `inventory` table

```sql
ALTER TABLE inventory 
ADD COLUMN location_id UUID REFERENCES locations(id);
```

### 4. (Optional) Create initial locations

```sql
INSERT INTO locations (name) VALUES 
  ('PPC'),
  ('El Nido');
```

## 🚀 How to Use

### For Admin:

1. **Login** - Use admin email and password
2. **Locations Tab** - Create and manage locations (max 3)
3. **Add Customer** - Select location when adding new customer
4. **Inventory Tab** - Select location when adding new inventory items
5. **View Customers** - See location info for each customer

### For Customer:

1. **Login** - Enter your 8-digit code
2. **View Inventory** - Only see products from your location
3. **Check Stamps** - Track your loyalty stamps
4. **View Utang** - See your debt/credits

## ⚙️ Configuration

Edit these variables in `app.js`:

```javascript
const MAX_STAMPS = 10;          // Maximum stamps for reward
const SHOP_NAME = "JZ_VAPE";    // Shop name
const MAX_LOCATIONS = 3;        // Maximum locations allowed
const SUPA_URL = "your-url";    // Supabase URL
const SUPA_KEY = "your-key";    // Supabase anon key
```

## 📋 Features List

### Existing Features:
- ✅ Customer loyalty card system (stamp card)
- ✅ Admin & Customer login
- ✅ Inventory management
- ✅ Utang (debt/credit) tracking
- ✅ Transaction history
- ✅ Reward redemption

### New Features:
- ✅ Multi-location support (up to 3 locations)
- ✅ Location-based customer assignment
- ✅ Location-based inventory filtering
- ✅ Location management UI
- ✅ Separate inventory per location

## 🎨 UI Updates

### Admin Side:
- New "📍 Locations" tab
- Location dropdown in customer add form
- Location dropdown in inventory add form
- Location display in customer list
- Location delete with validation

### Customer Side:
- Inventory filtered by customer's location
- Location info visible in account

## 🔒 Important Notes

1. **Database Migration**: Kailangan mong i-run ang SQL commands sa Supabase
2. **Existing Data**: Existing customers at inventory will have `NULL` location_id, kailangan mong i-assign manually
3. **Location Deletion**: Hindi pwedeng i-delete ang location kung may customers o inventory pa
4. **Maximum Locations**: Limited to 3 locations only

## 🐛 Troubleshooting

### "Piliin ang location" error when adding customer/inventory
- Make sure may created locations ka na sa Locations tab

### Customers can't see inventory
- Check if customer has assigned location
- Check if inventory items have the same location_id

### Location won't delete
- May customers o inventory pa sa location na yan
- I-reassign muna or i-delete ang customers/inventory

## 📞 Support

For questions or issues, contact your developer.

---

**Version**: 2.0 (Multi-Location)  
**Last Updated**: April 2026
