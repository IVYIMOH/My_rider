package handlers

import (
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/sipi/backend/internal/models"
	"github.com/sipi/backend/internal/services"
)

type BookingHandler struct {
	svc *services.BookingService
}

func NewBookingHandler(svc *services.BookingService) *BookingHandler {
	return &BookingHandler{svc: svc}
}

type createBookingRequest struct {
	DriverID              string  `json:"driver_id"`
	TripDate             string  `json:"trip_date"`
	PickupLat            float64 `json:"pickup_lat"`
	PickupLng            float64 `json:"pickup_lng"`
	EmergencyContactName *string `json:"emergency_contact_name"`
	EmergencyContactPhone *string `json:"emergency_contact_phone"`
}

func (h *BookingHandler) Create(c *fiber.Ctx) error {
	var req createBookingRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid request"})
	}
	tripDate, err := time.Parse("2006-01-02", req.TripDate)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid trip_date format, use YYYY-MM-DD"})
	}
	riderID := c.Locals("userID").(string)

	booking, err := h.svc.Create(c.Context(), services.CreateBookingInput{
		RiderID:              riderID,
		DriverID:             req.DriverID,
		TripDate:             tripDate,
		PickupLat:            req.PickupLat,
		PickupLng:            req.PickupLng,
		EmergencyContactName: req.EmergencyContactName,
		EmergencyContactPhone: req.EmergencyContactPhone,
	})
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}
	return c.Status(fiber.StatusCreated).JSON(booking)
}

func (h *BookingHandler) List(c *fiber.Ctx) error {
	userID := c.Locals("userID").(string)
	bookings, err := h.svc.ListForUser(c.Context(), userID)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to list bookings"})
	}
	return c.JSON(bookings)
}

func (h *BookingHandler) Get(c *fiber.Ctx) error {
	id := c.Params("id")
	booking, err := h.svc.GetByID(c.Context(), id)
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "booking not found"})
	}
	return c.JSON(booking)
}

type updateStatusRequest struct {
	Status string `json:"status"`
}

func (h *BookingHandler) UpdateStatus(c *fiber.Ctx) error {
	var req updateStatusRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid request"})
	}
	userID := c.Locals("userID").(string)

	booking, err := h.svc.UpdateStatus(c.Context(), c.Params("id"), userID, models.BookingStatus(req.Status))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(booking)
}

func (h *BookingHandler) Share(c *fiber.Ctx) error {
	token := c.Params("token")
	booking, driver, err := h.svc.GetByShareToken(c.Context(), token)
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "trip not found"})
	}
	return c.JSON(fiber.Map{
		"driver_name":   driver.Name,
		"driver_photo":  driver.PhotoURL,
		"vehicle_type":  driver.VehicleType,
		"sacco":         driver.SaccoName,
		"trip_date":     booking.TripDate,
		"status":        booking.Status,
	})
}
