package handlers

import (
	"github.com/gofiber/fiber/v2"
	"github.com/sipi/backend/internal/services"
)

type RatingHandler struct {
	svc *services.RatingService
}

func NewRatingHandler(svc *services.RatingService) *RatingHandler {
	return &RatingHandler{svc: svc}
}

type createRatingRequest struct {
	BookingID string  `json:"booking_id"`
	Rating    int     `json:"rating"`
	Comment   *string `json:"comment"`
}

func (h *RatingHandler) Create(c *fiber.Ctx) error {
	var req createRatingRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid request"})
	}
	if req.Rating < 1 || req.Rating > 5 {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "rating must be between 1 and 5"})
	}
	riderID := c.Locals("userID").(string)
	rating, err := h.svc.Create(c.Context(), services.CreateRatingInput{
		BookingID: req.BookingID,
		RiderID:   riderID,
		Rating:    req.Rating,
		Comment:   req.Comment,
	})
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
	}
	return c.Status(fiber.StatusCreated).JSON(rating)
}
