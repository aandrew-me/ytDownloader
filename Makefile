.PHONY: docker-build docker-run docker-stop docker-clean docker-test help

help: ## Show this help message
	@echo "ytDownloader Docker Management"
	@echo "=============================="
	@echo ""
	@echo "Available commands:"
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "  %-20s %s\n", $$1, $$2}'

docker-build: ## Build the Docker image
	docker-compose build

docker-run: ## Run the application with Docker Compose
	docker-compose up -d

docker-stop: ## Stop the running containers
	docker-compose down

docker-dev: ## Run in development mode
	docker-compose -f docker-compose.dev.yml up -d

docker-test: ## Run Docker tests
	chmod +x docker-test.sh
	./docker-test.sh

docker-clean: ## Clean up Docker resources
	docker-compose down -v
	docker system prune -f

docker-logs: ## Show logs
	docker-compose logs -f

docker-shell: ## Open shell in the container
	docker-compose exec ytdownloader sh