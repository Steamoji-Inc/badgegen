
dist/main.js: index.js src/index.js
	npx webpack

clean:
	rm -f badge.pdf
