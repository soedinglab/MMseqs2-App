package mail

import (
	"errors"
	"github.com/spf13/viper"
	"gopkg.in/mailgun/mailgun-go.v1"
)

type MailgunTransport struct {
}

func (t MailgunTransport) Send(mail Mail) error {
	if !viper.IsSet("MailgunDomain") ||
		!viper.IsSet("MailgunSecretKey") ||
		!viper.IsSet("MailgunPublicKey") {
		return errors.New("Dsa1 Configuration incomplete for Mailgun transport")
	}

	m := mailgun.NewMailgun(
		viper.GetString("MailgunDomain"),
		viper.GetString("MailgunSecretKey"),
		viper.GetString("MailgunPublicKey"),
	)
	message := m.NewMessage(mail.Sender, mail.Subject, mail.Body, mail.Recipient)
	_, _, err := m.Send(message)
	if err != nil {
		return err
	}

	return nil
}
