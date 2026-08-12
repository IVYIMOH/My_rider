package services

import (
	"context"
	"database/sql"
	"fmt"
	"time"

	"github.com/sipi/backend/internal/models"
)

type DriverService struct {
	db *sql.DB
}

func NewDriverService(db *sql.DB) *DriverService {
	return &DriverService{db: db}
}

type ListDriversFilter struct {
	VehicleType string
	Date        time.Time
}

func (s *DriverService) List(ctx context.Context, filter ListDriversFilter) ([]models.Driver, error) {
	query := `SELECT d.id, d.user_id, d.name, d.photo_url, d.vehicle_type,
	                  d.sacco_name, d.years_driving, d.average_rating, d.trip_count,
	                  d.created_at, d.updated_at
	           FROM drivers d
	           WHERE 1=1`
	args := []interface{}{}
	argIdx := 1

	if filter.VehicleType != "" {
		query += fmt.Sprintf(" AND d.vehicle_type = $%d", argIdx)
		args = append(args, filter.VehicleType)
		argIdx++
	}
	if !filter.Date.IsZero() {
		query += fmt.Sprintf(` AND d.id IN (
			SELECT b.driver_id FROM bookings b
			WHERE b.trip_date = $%d AND b.status != 'declined'
		)`, argIdx)
		args = append(args, filter.Date.Format("2006-01-02"))
		argIdx++
	}
	query += " ORDER BY d.average_rating DESC, d.trip_count DESC"

	rows, err := s.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, fmt.Errorf("query drivers: %w", err)
	}
	defer rows.Close()

	var drivers []models.Driver
	for rows.Next() {
		var d models.Driver
		if err := rows.Scan(
			&d.ID, &d.UserID, &d.Name, &d.PhotoURL, &d.VehicleType,
			&d.SaccoName, &d.YearsDriving, &d.AverageRating, &d.TripCount,
			&d.CreatedAt, &d.UpdatedAt,
		); err != nil {
			return nil, fmt.Errorf("scan driver: %w", err)
		}
		drivers = append(drivers, d)
	}
	return drivers, nil
}

func (s *DriverService) GetByID(ctx context.Context, id string) (*models.Driver, error) {
	var d models.Driver
	err := s.db.QueryRowContext(ctx,
		`SELECT d.id, d.user_id, d.name, d.photo_url, d.vehicle_type,
		        d.sacco_name, d.years_driving, d.average_rating, d.trip_count,
		        d.created_at, d.updated_at
		 FROM drivers d WHERE d.id = $1`, id,
	).Scan(
		&d.ID, &d.UserID, &d.Name, &d.PhotoURL, &d.VehicleType,
		&d.SaccoName, &d.YearsDriving, &d.AverageRating, &d.TripCount,
		&d.CreatedAt, &d.UpdatedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("query driver: %w", err)
	}
	return &d, nil
}

func (s *DriverService) GetReviews(ctx context.Context, driverID string) ([]models.Rating, error) {
	rows, err := s.db.QueryContext(ctx,
		`SELECT r.id, r.booking_id, r.rider_id, r.driver_id, r.rating, r.comment, r.created_at
		 FROM ratings r
		 JOIN drivers d ON d.user_id = r.driver_id
		 WHERE d.id = $1
		 ORDER BY r.created_at DESC LIMIT 20`, driverID,
	)
	if err != nil {
		return nil, fmt.Errorf("query reviews: %w", err)
	}
	defer rows.Close()

	var ratings []models.Rating
	for rows.Next() {
		var r models.Rating
		if err := rows.Scan(&r.ID, &r.BookingID, &r.RiderID, &r.DriverID, &r.Rating, &r.Comment, &r.CreatedAt); err != nil {
			return nil, fmt.Errorf("scan rating: %w", err)
		}
		ratings = append(ratings, r)
	}
	return ratings, nil
}

func (s *DriverService) GetByUserID(ctx context.Context, userID string) (*models.Driver, error) {
	var d models.Driver
	err := s.db.QueryRowContext(ctx,
		`SELECT d.id, d.user_id, d.name, d.photo_url, d.vehicle_type,
		        d.sacco_name, d.years_driving, d.average_rating, d.trip_count,
		        d.created_at, d.updated_at
		 FROM drivers d WHERE d.user_id = $1`, userID,
	).Scan(
		&d.ID, &d.UserID, &d.Name, &d.PhotoURL, &d.VehicleType,
		&d.SaccoName, &d.YearsDriving, &d.AverageRating, &d.TripCount,
		&d.CreatedAt, &d.UpdatedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("query driver by user id: %w", err)
	}
	return &d, nil
}
