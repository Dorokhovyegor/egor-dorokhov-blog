package httpserver

import "net/http"

type Server struct {
	server *http.Server
}

func New(addr string) *Server {
	mux := http.NewServeMux()

	return &Server{
		server: &http.Server{
			Addr:    addr,
			Handler: mux,
		},
	}
}

func (s *Server) Mux() *http.ServeMux {
	return s.server.Handler.(*http.ServeMux)
}

func (s *Server) HTTPServer() *http.Server {
	return s.server
}
