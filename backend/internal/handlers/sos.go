package handlers

import (
	"fmt"

	"github.com/gofiber/fiber/v2"
	"github.com/sipi/backend/internal/services"
)

type SOSHandler struct {
	booking *services.BookingService
	sms     services.SMSService
}

func NewSOSHandler(booking *services.BookingService, sms services.SMSService) *SOSHandler {
	return &SOSHandler{booking: booking, sms: sms}
}

type sosRequest struct {
	Lat float64 `json:"lat"`
	Lng float64 `json:"lng"`
}

func (h *SOSHandler) Send(c *fiber.Ctx) error {
	bookingID := c.Params("id")
	userID := c.Locals("userID").(string)

	b, err := h.booking.GetByID(c.Context(), bookingID)
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "booking not found"})
	}
	if b.RiderID != userID {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{"error": "not your booking"})
	}
	if b.EmergencyContactPhone == nil || *b.EmergencyContactPhone == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "no emergency contact set for this booking"})
	}

	var req sosRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid request"})
	}

	msg := fmt.Sprintf(
		"SOS ALERT: Rider at trip %s needs help. Last known location: https://maps.google.com/?q=%f,%f. Driver ID: %s. Date: %s.",
		b.ID, req.Lat, req.Lng, b.DriverID, b.TripDate.Format("2006-01-02"),
	)

	if err := h.sms.Send(c.Context(), services.SMSRequest{
		To:      *b.EmergencyContactPhone,
		Message: msg,
	}); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to send SOS"})
	}

	return c.JSON(fiber.Map{"message": "SOS sent to emergency contact"})
}
