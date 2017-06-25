package mail

type SmtpTransport struct {
}

func (t SmtpTransport) Send(mail Mail) error {
	return nil
}
