import http.server, socketserver, functools

PATH = "/Users/ranjithkandavelu/Desktop/Claude/Project 2"
Handler = functools.partial(http.server.SimpleHTTPRequestHandler, directory=PATH)
with socketserver.TCPServer(("", 4173), Handler) as httpd:
    httpd.serve_forever()
