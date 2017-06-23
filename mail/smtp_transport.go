package mail

type SmtpTransport struct {
}

func (t SmtpTransport) Setup() error {
	return nil
}

func (t SmtpTransport) Send(mail Mail) error {
	return nil
}
