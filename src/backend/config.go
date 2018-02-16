package main

type ConfigPaths struct {
	Databases    string `json:"databases"`
	Results      string `json:"results"`
	SearchScript string `json:"searchscript"`
	Mmseqs       string `json:"mmseqs"`
}

type ConfigRedis struct {
	Network  string `json:"network"`
	Address  string `json:"address"`
	Password string `json:"password"`
	DbIndex  int    `json:"index"`
}

type ConfigMailTemplate struct {
	Subject string `json:"subject"`
	Body    string `json:"body"`
}

type ConfigMailTemplates struct {
	Success ConfigMailTemplate `json:"success"`
	Timeout ConfigMailTemplate `json:"timeout"`
	Error   ConfigMailTemplate `json:"error"`
}

type ConfigMail struct {
	Transport string              `json:"type"`
	Sender    string              `json:"sender"`
	Templates ConfigMailTemplates `json:"templates"`
}

type ConfigRoot struct {
	Address string      `json:"address"`
	Paths   ConfigPaths `json:"paths"`
	Redis   ConfigRedis `json:"redis"`
	Mail    ConfigMail  `json:"default"`
}
