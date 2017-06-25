package mail

type Transport interface {
	Send(mail Mail) error
}

func Factory(name string) Transport {
	switch name {
	case "Mailgun":
		return MailgunTransport{}
	case "Smtp":
		return SmtpTransport{}
	default:
		return NullTransport{}
	}
}
