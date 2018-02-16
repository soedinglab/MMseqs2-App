package main

import (
	"gopkg.in/mailgun/mailgun-go.v1"
)

type MailTransport interface {
	Send(mail Mail) error
}

func Factory(name string) MailTransport {
	switch name {
	case "Mailgun":
		return MailgunTransport{}
	case "Smtp":
		return SmtpTransport{}
	default:
		return NullTransport{}
	}
}

type NullTransport struct {
}

func (t NullTransport) Send(mail Mail) error {
	return nil
}

type SmtpTransport struct {
}

func (t SmtpTransport) Send(mail Mail) error {
	return nil
}

type MailgunTransport struct {
	Domain    string
	SecretKey string
	PublicKey string
}

func (t MailgunTransport) Send(mail Mail) error {
	m := mailgun.NewMailgun(
		t.Domain,
		t.SecretKey,
		t.PublicKey,
	)
	message := m.NewMessage(mail.Sender, mail.Subject, mail.Body, mail.Recipient)
	_, _, err := m.Send(message)
	if err != nil {
		return err
	}

	return nil
}
