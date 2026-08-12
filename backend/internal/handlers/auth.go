package handlers

import (
	"github.com/gofiber/fiber/v2"
	"github.com/sipi/backend/internal/services"
)

type AuthHandler struct {
	auth *services.AuthService
}

func NewAuthHandler(auth *services.AuthService) *AuthHandler {
	return &AuthHandler{auth: auth}
}

type loginRequest struct {
	Phone string `json:"phone" validate:"required"`
}

type sendOTPRequest struct {
	Phone string `json:"phone" validate:"required"`
}

type verifyOTPRequest struct {
	Phone string `json:"phone" validate:"required"`
	Code  string `json:"code" validate:"required"`
	Role  string `json:"role"`
}

func (h *AuthHandler) Login(c *fiber.Ctx) error {
	var req loginRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid request"})
	}
	if req.Phone == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "phone is required"})
	}
	token, user, err := h.auth.Login(c.Context(), req.Phone)
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "no account found with this phone. please register."})
	}
	return c.JSON(fiber.Map{"token": token, "user": user})
}

func (h *AuthHandler) SendOTP(c *fiber.Ctx) error {
	var req sendOTPRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid request"})
	}
	if req.Phone == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "phone is required"})
	}
	if err := h.auth.SendOTP(c.Context(), req.Phone); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to send OTP"})
	}
	return c.JSON(fiber.Map{"message": "OTP sent"})
}

func (h *AuthHandler) VerifyOTP(c *fiber.Ctx) error {
	var req verifyOTPRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid request"})
	}
	if req.Phone == "" || req.Code == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "phone and code are required"})
	}
	token, user, err := h.auth.VerifyOTP(c.Context(), req.Phone, req.Code, req.Role)
	if err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(fiber.Map{"token": token, "user": user})
}

func (h *AuthHandler) Me(c *fiber.Ctx) error {
	user, err := h.auth.GetUserByID(c.Context(), c.Locals("userID").(string))
	if err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "session expired"})
	}
	return c.JSON(fiber.Map{
		"user_id": user.ID,
		"phone":   user.Phone,
		"role":    user.Role,
	})
}
