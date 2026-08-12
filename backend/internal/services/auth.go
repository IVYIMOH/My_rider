package services

import (
	"context"
	"crypto/rand"
	"database/sql"
	"fmt"
	"math/big"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"github.com/sipi/backend/internal/models"
)

type AuthService struct {
	db        *sql.DB
	jwtSecret string
	sms       SMSService
}

func NewAuthService(db *sql.DB, jwtSecret string, sms SMSService) *AuthService {
	return &AuthService{db: db, jwtSecret: jwtSecret, sms: sms}
}

func (s *AuthService) SendOTP(ctx context.Context, phone string) error {
	code, err := generateOTP()
	if err != nil {
		return fmt.Errorf("generate otp: %w", err)
	}

	expiresAt := time.Now().Add(10 * time.Minute)
	_, err = s.db.ExecContext(ctx,
		`INSERT INTO otp_codes (id, phone, code, expires_at) VALUES ($1, $2, $3, $4)`,
		uuid.NewString(), phone, code, expiresAt,
	)
	if err != nil {
		return fmt.Errorf("insert otp: %w", err)
	}

	return s.sms.Send(ctx, SMSRequest{
		To:      phone,
		Message: fmt.Sprintf("Your SIPI verification code is: %s", code),
	})
}

func (s *AuthService) VerifyOTP(ctx context.Context, phone, code, requestedRole string) (string, *models.User, error) {
	var otp models.OTPCode
	err := s.db.QueryRowContext(ctx,
		`SELECT id, phone, code, expires_at, used, created_at
		 FROM otp_codes
		 WHERE phone = $1 AND code = $2 AND used = FALSE AND expires_at > CURRENT_TIMESTAMP
		 ORDER BY created_at DESC LIMIT 1`,
		phone, code,
	).Scan(&otp.ID, &otp.Phone, &otp.Code, &otp.ExpiresAt, &otp.Used, &otp.CreatedAt)
	if err != nil {
		if err == sql.ErrNoRows {
			return "", nil, fmt.Errorf("invalid or expired OTP")
		}
		return "", nil, fmt.Errorf("query otp: %w", err)
	}

	_, _ = s.db.ExecContext(ctx, `UPDATE otp_codes SET used = TRUE WHERE id = $1`, otp.ID)

	user, err := s.registerUser(ctx, phone, requestedRole)
	if err != nil {
		return "", nil, err
	}

	token, err := s.generateJWT(user)
	if err != nil {
		return "", nil, fmt.Errorf("generate jwt: %w", err)
	}

	return token, user, nil
}

func (s *AuthService) Login(ctx context.Context, phone string) (string, *models.User, error) {
	var user models.User
	err := s.db.QueryRowContext(ctx,
		`SELECT id, phone, role, created_at, updated_at FROM users WHERE phone = $1`,
		phone,
	).Scan(&user.ID, &user.Phone, &user.Role, &user.CreatedAt, &user.UpdatedAt)
	if err != nil {
		if err == sql.ErrNoRows {
			return "", nil, fmt.Errorf("no account found with this phone")
		}
		return "", nil, fmt.Errorf("query user: %w", err)
	}

	token, err := s.generateJWT(&user)
	if err != nil {
		return "", nil, fmt.Errorf("generate jwt: %w", err)
	}
	return token, &user, nil
}

func (s *AuthService) registerUser(ctx context.Context, phone, requestedRole string) (*models.User, error) {
	var exists bool
	err := s.db.QueryRowContext(ctx, `SELECT EXISTS(SELECT 1 FROM users WHERE phone = $1)`, phone).Scan(&exists)
	if err != nil {
		return nil, fmt.Errorf("check user: %w", err)
	}
	if exists {
		return nil, fmt.Errorf("an account with this phone already exists")
	}

	role := models.RoleCitizen
	if models.UserRole(requestedRole) == models.RoleDriver {
		role = models.RoleDriver
	}

	user := models.User{
		ID:    uuid.NewString(),
		Phone: phone,
		Role:  role,
	}
	err = s.db.QueryRowContext(ctx,
		`INSERT INTO users (id, phone, role) VALUES ($1, $2, $3)
		 RETURNING id, phone, role, created_at, updated_at`,
		user.ID, phone, role,
	).Scan(&user.ID, &user.Phone, &user.Role, &user.CreatedAt, &user.UpdatedAt)
	if err != nil {
		return nil, fmt.Errorf("create user: %w", err)
	}
	return &user, nil
}

func (s *AuthService) GetUserByID(ctx context.Context, userID string) (*models.User, error) {
	var user models.User
	err := s.db.QueryRowContext(ctx,
		`SELECT id, phone, role, created_at, updated_at FROM users WHERE id = $1`,
		userID,
	).Scan(&user.ID, &user.Phone, &user.Role, &user.CreatedAt, &user.UpdatedAt)
	if err != nil {
		return nil, err
	}
	return &user, nil
}

func (s *AuthService) generateJWT(user *models.User) (string, error) {
	claims := jwt.MapClaims{
		"sub":   user.ID,
		"phone": user.Phone,
		"role":  string(user.Role),
		"exp":   time.Now().Add(72 * time.Hour).Unix(),
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString([]byte(s.jwtSecret))
}

func generateOTP() (string, error) {
	const digits = "0123456789"
	code := make([]byte, 6)
	for i := range code {
		n, err := rand.Int(rand.Reader, big.NewInt(int64(len(digits))))
		if err != nil {
			return "", err
		}
		code[i] = digits[n.Int64()]
	}
	return string(code), nil
}
