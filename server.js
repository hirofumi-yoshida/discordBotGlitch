
const http = require("http"); 

//Glitchを寝かせないため、GASからのPOSTリクエストを受け取る
http
  .createServer( (request, response) => {
    console.log('post from gas')
    response.end("Discord bot is active now.");
  })
  .listen(3000);

require("./code.js")
