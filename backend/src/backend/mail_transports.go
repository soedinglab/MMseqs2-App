package main

import (
	"encoding/json"
	"net/smtp"

	"gopkg.in/mailgun/mailgun-go.v1"
)

type TransportType string

const (
	TransportSmtp    TransportType = "smtp"
	TransportMailgun               = "mailgun"
	TransportNull                  = "null"
)

type ConfigMailtransport struct {
	Type      TransportType `json:"type" valid:"required"`
	Transport interface{}   `json:"transport" valid:"required"`
}

func (m *ConfigMailtransport) GetTransport() MailTransport {
	if transport, ok := m.Transport.(MailTransport); ok {
		return transport
	}
	return NullTransport{}
}

type configMailtransport ConfigMailtransport

func (m *ConfigMailtransport) UnmarshalJSON(b []byte) error {
	var msg json.RawMessage
	var mt configMailtransport
	mt.Transport = &msg
	if err := json.Unmarshal(b, &mt); err != nil {
		return err
	}

	*m = ConfigMailtransport(mt)
	switch mt.Type {
	case TransportSmtp:
		var t SmtpTransport
		if err := json.Unmarshal(msg, &t); err != nil {
			return err
		}
		(*m).Transport = t
		return nil
	case TransportMailgun:
		var t MailgunTransport
		if err := json.Unmarshal(msg, &t); err != nil {
			return err
		}
		(*m).Transport = t
		return nil
	}

	var t NullTransport
	(*m).Type = "null"
	(*m).Transport = t
	return nil
}

type MailTransport interface {
	Send(mail Mail) error
}

type NullTransport struct {
}

func (t NullTransport) Send(mail Mail) error {
	return nil
}

type SmtpAuth struct {
	Identity string `json:"identity"`
	Username string `json:"username"`
	Password string `json:"password"`
	Host     string `json:"host"`
}
type SmtpTransport struct {
	Host string   `json:"host"`
	Auth SmtpAuth `json:"auth"`
}

func (t SmtpTransport) Send(mail Mail) error {
	err := smtp.SendMail(
		t.Host,
		smtp.PlainAuth(t.Auth.Identity, t.Auth.Username, t.Auth.Password, t.Auth.Host),
		mail.Sender,
		[]string{mail.Recipient},
		[]byte(mail.Body),
	)
	if err != nil {
		return err
	}
	return nil
}

type MailgunTransport struct {
	Domain    string `json:"domain"`
	SecretKey string `json:"secretkey"`
	PublicKey string `json:"publickey"`
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
