package models

import "time"

type UserRole string

const (
	RoleCitizen UserRole = "citizen"
	RoleDriver  UserRole = "driver"
)

type BookingStatus string

const (
	BookingPending   BookingStatus = "pending"
	BookingConfirmed BookingStatus = "confirmed"
	BookingDeclined  BookingStatus = "declined"
	BookingCompleted BookingStatus = "completed"
)

type User struct {
	ID        string    `json:"id"`
	Phone     string    `json:"phone"`
	Role      UserRole  `json:"role"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

type Driver struct {
	ID            string   `json:"id"`
	UserID        string   `json:"user_id"`
	Name          string   `json:"name"`
	PhotoURL      *string  `json:"photo_url"`
	VehicleType   string   `json:"vehicle_type"`
	SaccoName     string   `json:"sacco_name"`
	YearsDriving  int      `json:"years_driving"`
	AverageRating float64  `json:"average_rating"`
	TripCount     int      `json:"trip_count"`
	CreatedAt     time.Time `json:"created_at"`
	UpdatedAt     time.Time `json:"updated_at"`
}

type Booking struct {
	ID                   string         `json:"id"`
	RiderID              string         `json:"rider_id"`
	DriverID             string         `json:"driver_id"`
	TripDate             time.Time      `json:"trip_date"`
	PickupLat            *float64       `json:"pickup_lat"`
	PickupLng            *float64       `json:"pickup_lng"`
	Status               BookingStatus  `json:"status"`
	EmergencyContactName *string        `json:"emergency_contact_name"`
	EmergencyContactPhone *string       `json:"emergency_contact_phone"`
	ShareToken           *string        `json:"share_token"`
	CreatedAt            time.Time      `json:"created_at"`
	UpdatedAt            time.Time      `json:"updated_at"`
}

type Rating struct {
	ID        string    `json:"id"`
	BookingID string    `json:"booking_id"`
	RiderID   string    `json:"rider_id"`
	DriverID  string    `json:"driver_id"`
	Rating    int       `json:"rating"`
	Comment   *string   `json:"comment"`
	CreatedAt time.Time `json:"created_at"`
}

type OTPCode struct {
	ID        string    `json:"id"`
	Phone     string    `json:"phone"`
	Code      string    `json:"code"`
	ExpiresAt time.Time `json:"expires_at"`
	Used      bool      `json:"used"`
	CreatedAt time.Time `json:"created_at"`
}
