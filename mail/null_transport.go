package mail

type NullTransport struct {
}

func (t NullTransport) Setup() error {
	return nil
}

func (t NullTransport) Send(mail Mail) error {
	return nil
}
