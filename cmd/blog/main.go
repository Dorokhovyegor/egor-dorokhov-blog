package main

import (
	"context"
	"log"
	"os/signal"
	"syscall"
	"time"

	"egor-dorokhov-blog/cmd/blog/common"
	httphandlers "egor-dorokhov-blog/internal/handlers/http"
	"egor-dorokhov-blog/internal/infrastructure"
)

func main() {
	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stop()

	configuration, err := infrastructure.NewConfiguration(ctx)
	if err != nil {
		log.Fatalf("configure infrastructure: %v", err)
	}
	if configuration.PostgresPool != nil {
		defer configuration.PostgresPool.Close()
	}

	httpHandlers := httphandlers.NewConfiguration(
		configuration.Articles,
		configuration.Engagement,
		configuration.Environment.DistDir,
	)
	httpHandlers.Register(configuration.HTTPServer.Mux())

	common.StartServer(ctx, 10*time.Second, configuration.HTTPServer.HTTPServer())
}
