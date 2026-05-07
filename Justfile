set shell := ["powershell.exe", "-c"]

start:
	python -m http.server 8123 --bind 127.0.0.1

start-swarm:
	swarmer run -- python -m http.server 8123 --bind 127.0.0.1

git-add:
	git add *
	gitllm
	git push