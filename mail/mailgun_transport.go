package mail

import (
	"errors"
	"github.com/spf13/viper"
	"gopkg.in/mailgun/mailgun-go.v1"
)

type MailgunTransport struct {
	mg mailgun.Mailgun
}

func (t MailgunTransport) Setup() error {
	if !viper.IsSet("MailgunDomain") ||
		!viper.IsSet("MailgunSecretKey") ||
		!viper.IsSet("MailgunPublicKey") {
		t.mg = nil
		return errors.New("Configuration incomplete for Mailgun transport")
	}

	t.mg = mailgun.NewMailgun(
		viper.GetString("MailgunDomain"),
		viper.GetString("MailgunSecretKey"),
		viper.GetString("MailgunPublicKey"),
	)

	return nil
}

func (t MailgunTransport) Send(mail Mail) error {
	if t.mg == nil {
		return errors.New("Configuration incomplete for Mailgun transport")
	}

	message := t.mg.NewMessage(mail.Sender, mail.Subject, mail.Body, mail.Recipient)
	_, _, err := t.mg.Send(message)
	if err != nil {
		return err
	}
	return nil
}
