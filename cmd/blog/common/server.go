package common

import (
	"context"
	"errors"
	"log"
	"net/http"
	"time"
)

func StartServer(ctx context.Context, shutdownTimeout time.Duration, server *http.Server) {
	go func() {
		log.Printf("blog server listening on http://%s", server.Addr)
		if err := server.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			log.Fatalf("listen and serve: %v", err)
		}
	}()

	<-ctx.Done()

	shutdownCtx, cancel := context.WithTimeout(context.Background(), shutdownTimeout)
	defer cancel()

	if err := server.Shutdown(shutdownCtx); err != nil {
		log.Printf("shutdown server: %v", err)
	}
}
