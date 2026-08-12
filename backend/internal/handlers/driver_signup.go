package handlers

import (
	"database/sql"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
)

type DriverSignupHandler struct {
	db *sql.DB
}

func NewDriverSignupHandler(db *sql.DB) *DriverSignupHandler {
	return &DriverSignupHandler{db: db}
}

type createDriverRequest struct {
	Name         string `json:"name"`
	PhotoURL     string `json:"photo_url"`
	VehicleType  string `json:"vehicle_type"`
	SaccoName    string `json:"sacco_name"`
	YearsDriving int    `json:"years_driving"`
}

func (h *DriverSignupHandler) Create(c *fiber.Ctx) error {
	var req createDriverRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid request"})
	}
	if req.Name == "" || req.VehicleType == "" || req.SaccoName == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "name, vehicle_type, and sacco_name are required"})
	}

	userID := c.Locals("userID").(string)
	if role, ok := c.Locals("role").(string); ok && role != "driver" {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{"error": "only drivers can create a driver profile"})
	}

	tx, err := h.db.BeginTx(c.Context(), nil)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to start transaction"})
	}
	defer tx.Rollback()

	var exists bool
	err = tx.QueryRowContext(c.Context(), `SELECT EXISTS(SELECT 1 FROM drivers WHERE user_id = $1)`, userID).Scan(&exists)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "check failed"})
	}
	if exists {
		return c.Status(fiber.StatusConflict).JSON(fiber.Map{"error": "driver profile already exists"})
	}

	driverID := uuid.NewString()
	_, err = tx.ExecContext(c.Context(),
		`INSERT INTO drivers (id, user_id, name, photo_url, vehicle_type, sacco_name, years_driving)
		 VALUES ($1, $2, $3, NULLIF($4, ''), $5, $6, $7)`,
		driverID, userID, req.Name, req.PhotoURL, req.VehicleType, req.SaccoName, req.YearsDriving,
	)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to create driver profile"})
	}

	if err := tx.Commit(); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to commit"})
	}

	return c.Status(fiber.StatusCreated).JSON(fiber.Map{"id": driverID})
}
