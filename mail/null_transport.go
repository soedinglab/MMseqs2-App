package mail

type NullTransport struct {
}

func (t NullTransport) Send(mail Mail) error {
	return nil
}
