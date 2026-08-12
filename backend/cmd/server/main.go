package main

import (
	"context"
	"log"

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/cors"
	"github.com/gofiber/fiber/v2/middleware/logger"
	"github.com/sipi/backend/internal/config"
	"github.com/sipi/backend/internal/database"
	"github.com/sipi/backend/internal/handlers"
	"github.com/sipi/backend/internal/middleware"
	"github.com/sipi/backend/internal/services"
)

func main() {
	cfg := config.Load()

	ctx := context.Background()

	db, err := database.Connect(ctx, cfg.DatabasePath)
	if err != nil {
		log.Fatalf("database connection failed: %v", err)
	}
	defer db.Close()

	smsSvc := services.NewSMSService()

	authSvc := services.NewAuthService(db, cfg.JWTSecret, smsSvc)
	driverSvc := services.NewDriverService(db)
	bookingSvc := services.NewBookingService(db)
	ratingSvc := services.NewRatingService(db)

	authHandler := handlers.NewAuthHandler(authSvc)
	driverHandler := handlers.NewDriverHandler(driverSvc)
	bookingHandler := handlers.NewBookingHandler(bookingSvc)
	ratingHandler := handlers.NewRatingHandler(ratingSvc)
	sosHandler := handlers.NewSOSHandler(bookingSvc, smsSvc)
	driverSignupHandler := handlers.NewDriverSignupHandler(db)

	app := fiber.New()
	app.Use(logger.New())
	app.Use(cors.New())

	api := app.Group("/api")

	auth := api.Group("/auth")
	auth.Post("/login", authHandler.Login)
	auth.Post("/send-otp", authHandler.SendOTP)
	auth.Post("/verify-otp", authHandler.VerifyOTP)

	authProtected := api.Group("/auth", middleware.AuthRequired(cfg.JWTSecret))
	authProtected.Get("/me", authHandler.Me)

	api.Get("/trips/share/:token", bookingHandler.Share)

	protected := api.Group("", middleware.AuthRequired(cfg.JWTSecret))
	{
		protected.Get("/drivers", driverHandler.List)
		protected.Get("/drivers/me", driverHandler.Me)
		protected.Get("/drivers/:id", driverHandler.Get)

		protected.Post("/bookings", bookingHandler.Create)
		protected.Get("/bookings", bookingHandler.List)
		protected.Get("/bookings/:id", bookingHandler.Get)
		protected.Patch("/bookings/:id/status", bookingHandler.UpdateStatus)

		protected.Post("/ratings", ratingHandler.Create)

		protected.Post("/bookings/:id/sos", sosHandler.Send)
		protected.Post("/drivers", driverSignupHandler.Create)
	}

	log.Fatal(app.Listen(":" + cfg.Port))
}
