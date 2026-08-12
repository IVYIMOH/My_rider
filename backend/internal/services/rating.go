package services

import (
	"context"
	"database/sql"
	"fmt"

	"github.com/google/uuid"
	"github.com/sipi/backend/internal/models"
)

type RatingService struct {
	db *sql.DB
}

func NewRatingService(db *sql.DB) *RatingService {
	return &RatingService{db: db}
}

type CreateRatingInput struct {
	BookingID string
	RiderID   string
	Rating    int
	Comment   *string
}

func (s *RatingService) Create(ctx context.Context, input CreateRatingInput) (*models.Rating, error) {
	var driverID string
	err := s.db.QueryRowContext(ctx,
		`SELECT driver_id FROM bookings WHERE id = $1 AND rider_id = $2 AND status = 'completed'`,
		input.BookingID, input.RiderID,
	).Scan(&driverID)
	if err != nil {
		return nil, fmt.Errorf("booking not found, not completed, or not yours")
	}

	var r models.Rating
	err = s.db.QueryRowContext(ctx,
		`INSERT INTO ratings (id, booking_id, rider_id, driver_id, rating, comment)
		 VALUES ($1, $2, $3, $4, $5, $6)
		 RETURNING id, booking_id, rider_id, driver_id, rating, comment, created_at`,
		uuid.NewString(), input.BookingID, input.RiderID, driverID, input.Rating, input.Comment,
	).Scan(&r.ID, &r.BookingID, &r.RiderID, &r.DriverID, &r.Rating, &r.Comment, &r.CreatedAt)
	if err != nil {
		return nil, fmt.Errorf("create rating: %w", err)
	}

	_, _ = s.db.ExecContext(ctx,
		`UPDATE drivers
		 SET average_rating = (SELECT ROUND(AVG(rating), 2) FROM ratings WHERE driver_id = $1),
		     trip_count = (SELECT COUNT(*) FROM ratings WHERE driver_id = $1)
		 WHERE user_id = $1`, driverID,
	)

	return &r, nil
}
