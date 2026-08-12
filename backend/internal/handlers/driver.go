package handlers

import (
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/sipi/backend/internal/services"
)

type DriverHandler struct {
	svc *services.DriverService
}

func NewDriverHandler(svc *services.DriverService) *DriverHandler {
	return &DriverHandler{svc: svc}
}

func (h *DriverHandler) List(c *fiber.Ctx) error {
	filter := services.ListDriversFilter{
		VehicleType: c.Query("vehicle_type"),
	}
	if dateStr := c.Query("date"); dateStr != "" {
		parsed, err := time.Parse("2006-01-02", dateStr)
		if err == nil {
			filter.Date = parsed
		}
	}
	drivers, err := h.svc.List(c.Context(), filter)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to list drivers"})
	}
	return c.JSON(drivers)
}

func (h *DriverHandler) Me(c *fiber.Ctx) error {
	userID := c.Locals("userID").(string)
	driver, err := h.svc.GetByUserID(c.Context(), userID)
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "driver profile not found"})
	}
	return c.JSON(driver)
}

func (h *DriverHandler) Get(c *fiber.Ctx) error {
	id := c.Params("id")
	driver, err := h.svc.GetByID(c.Context(), id)
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "driver not found"})
	}
	reviews, err := h.svc.GetReviews(c.Context(), id)
	if err != nil {
		reviews = nil
	}
	return c.JSON(fiber.Map{"driver": driver, "reviews": reviews})
}
