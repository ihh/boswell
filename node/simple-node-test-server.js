var http = require('http'),
    url = require("url"),
    path = require("path"),
    fs = require("fs")
    port = process.argv[2] || 8000,
    faye = require('faye'),
    child_process = require('child_process')

// Start pub/sub on /faye
var server = http.createServer(),
    bayeux = new faye.NodeAdapter({mount: '/faye', timeout: 45});

// Handle non-Bayeux requests
var n = 0;
var server = http.createServer(function(request, response) {
    console.log(request.url);

    // GET /id returns new unique (ascending) integer ID
    var regex = new RegExp("^/id/?$")
    if (regex.test(request.url)) {
	response.writeHead(200, {"Content-Type": "text/plain"});
	response.write("" + ++n);
	response.end();
	return;
    } else {

	// default to static fileserver
	var uri = url.parse(request.url).pathname,
	filename = path.join(process.cwd(), uri);

	path.exists(filename, function(exists) {
	    if(!exists) {
		response.writeHead(404, {"Content-Type": "text/plain"});
		response.write("404 Not Found\n");
		response.end();
		return;
	    }

	    if (fs.statSync(filename).isDirectory()) filename += '/index.html';

	    fs.readFile(filename, "binary", function(err, file) {
		if(err) {        
		    response.writeHead(500, {"Content-Type": "text/plain"});
		    response.write(err + "\n");
		    response.end();
		    return;
		}

		response.writeHead(200);
		response.write(file, "binary");
		response.end();
	    });
	});
    }
});

bayeux.attach(server);
server.listen(port);

var server_url = "http://localhost:" + port + "/"
console.log("Server up. Try here:\n" + server_url)
child_process.spawn('open', [server_url])
