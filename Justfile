set shell := ["nu.exe", "-c"]

start:
	python -m http.server 8123 --bind 127.0.0.1

start-swarm:
	swarmer run -- python -m http.server 8123 --bind 127.0.0.1
