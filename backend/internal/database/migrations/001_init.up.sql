CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    phone VARCHAR(20) UNIQUE NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('citizen', 'driver')),
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS drivers (
    id TEXT PRIMARY KEY,
    user_id TEXT UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    photo_url TEXT,
    vehicle_type VARCHAR(100) NOT NULL,
    sacco_name VARCHAR(255) NOT NULL,
    years_driving INTEGER NOT NULL CHECK (years_driving >= 0),
    average_rating REAL NOT NULL DEFAULT 0,
    trip_count INTEGER NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS otp_codes (
    id TEXT PRIMARY KEY,
    phone VARCHAR(20) NOT NULL,
    code VARCHAR(6) NOT NULL,
    expires_at DATETIME NOT NULL,
    used BOOLEAN NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_otp_codes_phone_code ON otp_codes(phone, code);

CREATE TABLE IF NOT EXISTS bookings (
    id TEXT PRIMARY KEY,
    rider_id TEXT NOT NULL REFERENCES users(id),
    driver_id TEXT NOT NULL REFERENCES users(id),
    trip_date DATE NOT NULL,
    pickup_lat REAL,
    pickup_lng REAL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'declined', 'completed')),
    emergency_contact_name VARCHAR(255),
    emergency_contact_phone VARCHAR(20),
    share_token TEXT UNIQUE,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_bookings_rider ON bookings(rider_id);
CREATE INDEX IF NOT EXISTS idx_bookings_driver ON bookings(driver_id);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings(status);

CREATE TABLE IF NOT EXISTS ratings (
    id TEXT PRIMARY KEY,
    booking_id TEXT UNIQUE NOT NULL REFERENCES bookings(id),
    rider_id TEXT NOT NULL REFERENCES users(id),
    driver_id TEXT NOT NULL REFERENCES users(id),
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    comment TEXT,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_ratings_driver ON ratings(driver_id);
