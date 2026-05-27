.PHONY: runx

runx:
	docker compose up -d
	npm run dev -- --port 5573
