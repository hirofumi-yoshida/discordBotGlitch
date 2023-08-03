
const http = require("http"); 

//Glitchを寝かせないため、GASからのPOSTリクエストを受け取る
http.createServer( (request, response) => {
  //console.log('post from gas')
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  response.statusCode = 200;
  const responseBody = {message: 'API is active now.'};
  response.write(JSON.stringify(responseBody));
  response.end();
  })
  .listen(3000);

require("./code.js")
require("./comand.js")