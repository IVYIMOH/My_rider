package services

import (
	"context"
	"database/sql"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/sipi/backend/internal/models"
)

type BookingService struct {
	db *sql.DB
}

func NewBookingService(db *sql.DB) *BookingService {
	return &BookingService{db: db}
}

type CreateBookingInput struct {
	RiderID               string
	DriverID              string
	TripDate              time.Time
	PickupLat             float64
	PickupLng             float64
	EmergencyContactName  *string
	EmergencyContactPhone *string
}

func (s *BookingService) Create(ctx context.Context, input CreateBookingInput) (*models.Booking, error) {
	var b models.Booking
	id := uuid.NewString()
	shareToken := uuid.NewString()

	err := s.db.QueryRowContext(ctx,
		`INSERT INTO bookings (id, rider_id, driver_id, trip_date, pickup_lat, pickup_lng,
		                      emergency_contact_name, emergency_contact_phone, share_token)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
		 RETURNING id, rider_id, driver_id, trip_date, pickup_lat, pickup_lng,
		           status, emergency_contact_name, emergency_contact_phone,
		           share_token, created_at, updated_at`,
		id, input.RiderID, input.DriverID, input.TripDate, input.PickupLat, input.PickupLng,
		input.EmergencyContactName, input.EmergencyContactPhone, shareToken,
	).Scan(
		&b.ID, &b.RiderID, &b.DriverID, &b.TripDate,
		&b.PickupLat, &b.PickupLng,
		&b.Status, &b.EmergencyContactName, &b.EmergencyContactPhone,
		&b.ShareToken, &b.CreatedAt, &b.UpdatedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("create booking: %w", err)
	}
	return &b, nil
}

func (s *BookingService) GetByID(ctx context.Context, bookingID string) (*models.Booking, error) {
	var b models.Booking
	err := s.db.QueryRowContext(ctx,
		`SELECT id, rider_id, driver_id, trip_date, pickup_lat, pickup_lng,
		        status, emergency_contact_name, emergency_contact_phone,
		        share_token, created_at, updated_at
		 FROM bookings WHERE id = $1`, bookingID,
	).Scan(
		&b.ID, &b.RiderID, &b.DriverID, &b.TripDate,
		&b.PickupLat, &b.PickupLng,
		&b.Status, &b.EmergencyContactName, &b.EmergencyContactPhone,
		&b.ShareToken, &b.CreatedAt, &b.UpdatedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("query booking: %w", err)
	}
	return &b, nil
}

func (s *BookingService) UpdateStatus(ctx context.Context, bookingID, userID string, status models.BookingStatus) (*models.Booking, error) {
	b, err := s.GetByID(ctx, bookingID)
	if err != nil {
		return nil, err
	}

	allowed := false
	switch status {
	case models.BookingConfirmed, models.BookingDeclined:
		allowed = b.Status == models.BookingPending && userID == b.DriverID
	case models.BookingCompleted:
		allowed = b.Status == models.BookingConfirmed && userID == b.DriverID
	}
	if !allowed {
		return nil, fmt.Errorf("invalid status transition or not authorized")
	}

	var updated models.Booking
	err = s.db.QueryRowContext(ctx,
		`UPDATE bookings SET status = $1, updated_at = CURRENT_TIMESTAMP
		 WHERE id = $2 RETURNING id, rider_id, driver_id, trip_date, pickup_lat, pickup_lng,
		   status, emergency_contact_name, emergency_contact_phone,
		   share_token, created_at, updated_at`,
		status, bookingID,
	).Scan(
		&updated.ID, &updated.RiderID, &updated.DriverID, &updated.TripDate,
		&updated.PickupLat, &updated.PickupLng,
		&updated.Status, &updated.EmergencyContactName, &updated.EmergencyContactPhone,
		&updated.ShareToken, &updated.CreatedAt, &updated.UpdatedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("update booking status: %w", err)
	}
	return &updated, nil
}

func (s *BookingService) ListForUser(ctx context.Context, userID string) ([]models.Booking, error) {
	rows, err := s.db.QueryContext(ctx,
		`SELECT id, rider_id, driver_id, trip_date, pickup_lat, pickup_lng,
		        status, emergency_contact_name, emergency_contact_phone,
		        share_token, created_at, updated_at
		 FROM bookings
		 WHERE rider_id = $1 OR driver_id = $1
		 ORDER BY created_at DESC`, userID,
	)
	if err != nil {
		return nil, fmt.Errorf("query bookings: %w", err)
	}
	defer rows.Close()

	var bookings []models.Booking
	for rows.Next() {
		var b models.Booking
		if err := rows.Scan(
			&b.ID, &b.RiderID, &b.DriverID, &b.TripDate,
			&b.PickupLat, &b.PickupLng,
			&b.Status, &b.EmergencyContactName, &b.EmergencyContactPhone,
			&b.ShareToken, &b.CreatedAt, &b.UpdatedAt,
		); err != nil {
			return nil, fmt.Errorf("scan booking: %w", err)
		}
		bookings = append(bookings, b)
	}
	return bookings, nil
}

func (s *BookingService) GetByShareToken(ctx context.Context, token string) (*models.Booking, *models.Driver, error) {
	var b models.Booking
	err := s.db.QueryRowContext(ctx,
		`SELECT id, rider_id, driver_id, trip_date, pickup_lat, pickup_lng,
		        status, emergency_contact_name, emergency_contact_phone,
		        share_token, created_at, updated_at
		 FROM bookings WHERE share_token = $1`, token,
	).Scan(
		&b.ID, &b.RiderID, &b.DriverID, &b.TripDate,
		&b.PickupLat, &b.PickupLng,
		&b.Status, &b.EmergencyContactName, &b.EmergencyContactPhone,
		&b.ShareToken, &b.CreatedAt, &b.UpdatedAt,
	)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, nil, fmt.Errorf("booking not found")
		}
		return nil, nil, fmt.Errorf("query booking: %w", err)
	}

	var d models.Driver
	err = s.db.QueryRowContext(ctx,
		`SELECT id, user_id, name, photo_url, vehicle_type,
		        sacco_name, years_driving, average_rating, trip_count,
		        created_at, updated_at
		 FROM drivers WHERE user_id = $1`, b.DriverID,
	).Scan(
		&d.ID, &d.UserID, &d.Name, &d.PhotoURL, &d.VehicleType,
		&d.SaccoName, &d.YearsDriving, &d.AverageRating, &d.TripCount,
		&d.CreatedAt, &d.UpdatedAt,
	)
	if err != nil {
		return nil, nil, fmt.Errorf("query driver: %w", err)
	}

	return &b, &d, nil
}
