package services

import (
	"context"
	"log"
)

type SMSRequest struct {
	To      string
	Message string
}

type SMSService interface {
	Send(ctx context.Context, req SMSRequest) error
}

type consoleSMSService struct{}

func NewSMSService() SMSService {
	return &consoleSMSService{}
}

func (s *consoleSMSService) Send(_ context.Context, req SMSRequest) error {
	log.Printf("[SMS] To: %s | %s", req.To, req.Message)
	return nil
}
