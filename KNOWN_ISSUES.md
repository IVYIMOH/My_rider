## Frontend doesn't handle NO_SHARED_RIDE

The messaging API returns 403 NO_SHARED_RIDE for a thread whose participants
share no ride — including pre-existing threads, which are also hidden from
GET /api/messages. frontend/src/lib/api.ts calls the messages endpoints but
nothing in frontend/ or admin/ branches on that code, so a user deep-linking
a blocked thread gets a generic error rather than "you can only message
someone you share a trip with". Backend enforcement is correct; this is
presentation only. See backend/src/routes/messages.ts (assertThreadAccess).